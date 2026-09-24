import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
// 与前端提示保持一致：最大 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// 超过该尺寸的图片先缩放再识别，减少上传流量与响应时间
const MAX_IMAGE_DIMENSION = 1600;

const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || '';
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || '';

const COMPONENT_DESCRIPTIONS: Record<string, string> = {
  '电阻': '电阻是限制电流流动的被动元件，常用色环标记阻值。单位为欧姆(Ω)。',
  '电容': '电容是存储电荷的被动元件，用于滤波、耦合等。单位为法拉(F)。',
  '电解电容': '电解电容具有较大容量，有正负极性，常用于电源滤波。',
  '电感': '电感是存储磁场能量的被动元件，常用于滤波、振荡电路。',
  '二极管': '二极管只允许电流单向流动，常用于整流、保护电路。',
  '三极管': '三极管是电流控制器件，用于放大和开关电路。',
  'MOSFET': 'MOSFET是电压控制器件，具有高输入阻抗，广泛用于开关电路。',
  '集成电路': '集成电路将多个电子元件集成在一块芯片上，实现特定功能。',
  '晶振': '晶振提供稳定的时钟信号，常用于微控制器和通信设备。',
  '继电器': '继电器是用小电流控制大电流的自动开关。',
  '变压器': '变压器用于改变交流电压，实现电压转换和隔离。',
  '连接器': '连接器用于电子设备之间的电气连接。',
  '开关': '开关用于控制电路的通断。',
  '保险丝': '保险丝用于过流保护，电流过大时熔断。',
  'LED': 'LED是发光二极管，将电能转换为光能。',
};

const COMPONENTS_DATABASE = [
  { name: '电阻', type: 'Resistor', keywords: ['resistor', '电阻', '色环', 'resistance'] },
  { name: '电容', type: 'Capacitor', keywords: ['capacitor', '电容', '陶瓷电容'] },
  { name: '电解电容', type: 'Electrolytic Capacitor', keywords: ['电解', 'electrolytic', 'capacitor'] },
  { name: '电感', type: 'Inductor', keywords: ['inductor', '电感', '线圈', 'inductor'] },
  { name: '二极管', type: 'Diode', keywords: ['diode', '二极管', 'LED'] },
  { name: '三极管', type: 'Transistor', keywords: ['transistor', '三极管', 'BJT'] },
  { name: 'MOSFET', type: 'MOSFET', keywords: ['mosfet', '场效应管', 'MOS'] },
  { name: '集成电路', type: 'IC', keywords: ['ic', '芯片', '集成电路', 'chip', 'integrated'] },
  { name: '晶振', type: 'Crystal Oscillator', keywords: ['crystal', '晶振', 'oscillator'] },
  { name: '继电器', type: 'Relay', keywords: ['relay', '继电器'] },
  { name: '变压器', type: 'Transformer', keywords: ['transformer', '变压器'] },
  { name: '连接器', type: 'Connector', keywords: ['connector', '连接器', '排针', 'header'] },
  { name: '开关', type: 'Switch', keywords: ['switch', '开关', '按键', 'button'] },
  { name: '保险丝', type: 'Fuse', keywords: ['fuse', '保险丝'] },
  { name: 'LED', type: 'LED', keywords: ['led', '发光二极管', 'light emitting'] },
];

// 过大图片缩放后上传；压缩失败时回退原图，不影响主流程
async function prepareImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const format = metadata.format;
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    // 只处理大图；GIF 等动图或无法识别格式的图片保持原样
    if (!format || !['jpeg', 'png', 'webp'].includes(format)) {
      return buffer;
    }
    if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
      return buffer;
    }

    const resized = image.resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });

    return format === 'png'
      ? resized.png().toBuffer()
      : resized.jpeg({ quality: 85 }).toBuffer();
  } catch (error) {
    console.error('图片压缩失败，使用原图:', error);
    return buffer;
  }
}

async function removeFileQuietly(filePath: string | null): Promise<void> {
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // 清理失败可忽略
  }
}

// ====== OpenAI GPT-4o Vision ======

async function recognizeWithOpenAI(imageBase64: string): Promise<{
  name: string;
  type: string;
  description: string;
  confidence: number;
  model?: string;
  manufacturer?: string;
  packageType?: string;
  pinCount?: number;
  specifications?: string;
} | null> {
  if (!OPENAI_API_KEY) {
    console.log('OpenAI API Key 未配置，跳过');
    return null;
  }

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的电子元器件识别专家。请仔细观察图片中的电子元器件，用中文输出以下JSON：\n\n' +
'{\n' +
'  "name": "元器件中文名称（如：贴片电阻、电解电容、ATmega328P微控制器）",\n' +
'  "type": "元器件英文类型（如 Resistor, Capacitor, IC, MOSFET, LED, Diode, Transistor, Inductor, Crystal Oscillator, Relay, Transformer, Connector, Switch, Fuse 等）",\n' +
'  "description": "详细描述（先说明该类型的工作原理和典型应用，约80-150字）",\n' +
'  "model": "型号/料号（从丝印、标识上读取，如 10kΩ、100μF、STM32F103C8T6、2N2222、LM358。若看不到丝印但可推测则加 ~ 前缀，完全看不到则填空字符串）",\n' +
'  "manufacturer": "制造商（如 STMicroelectronics、TI、Samsung、Yageo、Murata，推测不出则填空字符串）",\n' +
'  "packageType": "封装类型（如 0805、SOT-23、QFP-44、TO-220、DIP-8、BGA 等，看不出则填空字符串）",\n' +
'  "pinCount": "引脚数量（数字，看不出填0）",\n' +
'  "specifications": "规格参数（如实在看不到丝印可推测典型值，如：阻值10kΩ、容值100μF/25V、工作电压3.3V、Flash 32KB，不确定可填空字符串）",\n' +
'  "confidence": 0.85\n' +
'}\n\n' +
'关键规则：\n' +
'- 如果图片中有丝印/标识文字，务必读取并填入model字段\n' +
'- 必须仔细观察引脚数量和封装形态来推测封装类型\n' +
'- 如果图片中没有任何电子元器件，name填"非电子元器件"，type填"N/A"，confidence填0\n' +
'- 只返回纯JSON，不要带markdown代码块标记',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      console.error('OpenAI 返回为空:', data);
      return null;
    }

    const content = data.choices[0].message.content;
    console.log('OpenAI 识别结果:', content);

    let parsed;
    try {
      const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('OpenAI 返回JSON解析失败:', content);
      return null;
    }

    return {
      name: parsed.name || '未知元器件',
      type: parsed.type || 'Unknown',
      description: parsed.description || '未能识别该元器件',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      model: parsed.model || undefined,
      manufacturer: parsed.manufacturer || undefined,
      packageType: parsed.packageType || undefined,
      pinCount: typeof parsed.pinCount === 'number' ? parsed.pinCount : undefined,
      specifications: parsed.specifications || undefined,
    };
  } catch (error) {
    console.error('OpenAI API 错误:', error);
    return null;
  }
}

// ====== 百度 API 兜底 ======

let baiduToken: string | null = null;
let baiduTokenExpire = 0;

async function getBaiduToken(): Promise<string | null> {
  if (baiduToken && Date.now() < baiduTokenExpire) {
    return baiduToken;
  }

  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    console.log('百度 API Key 未配置');
    return null;
  }

  try {
    const response = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`,
      { method: 'POST' }
    );

    const data = await response.json();

    if (data.access_token) {
      baiduToken = data.access_token;
      baiduTokenExpire = Date.now() + (data.expires_in - 300) * 1000;
      return baiduToken;
    }
  } catch (error) {
    console.error('获取百度Token失败:', error);
  }

  return null;
}

async function recognizeWithBaidu(imageBase64: string): Promise<{
  name: string;
  type: string;
  description: string;
  confidence: number;
} | null> {
  const accessToken = await getBaiduToken();

  if (!accessToken) return null;

  try {
    const response = await fetch(
      `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `image=${encodeURIComponent(imageBase64)}`,
      }
    );

    const data = await response.json();
    console.log('百度API返回:', JSON.stringify(data));

    if (data.result && data.result.length > 0) {
      const topResult = data.result[0];
      const enResults = data.result.slice(0, 3).map((r: { keyword: string; score: number }) => r.keyword.toLowerCase()).join(' ');

      for (const component of COMPONENTS_DATABASE) {
        if (component.keywords.some(k => enResults.includes(k.toLowerCase()))) {
          return {
            name: component.name,
            type: component.type,
            description: COMPONENT_DESCRIPTIONS[component.name] || '电子元器件',
            confidence: topResult.score || 0.8,
          };
        }
      }

      return {
        name: topResult.keyword,
        type: 'Unknown',
        description: '未能识别具体元器件类型，请上传更清晰的图片',
        confidence: topResult.score || 0.5,
      };
    }
  } catch (error) {
    console.error('百度API错误:', error);
  }

  return null;
}

// ====== 主识别流程 ======

async function recognize(imageBase64: string) {
  if (AI_PROVIDER === 'baidu') {
    return await recognizeWithBaidu(imageBase64);
  }

  if (AI_PROVIDER === 'openai') {
    const result = await recognizeWithOpenAI(imageBase64);
    if (result) return result;

    console.log('OpenAI 识别失败，尝试百度兜底...');
    const fallback = await recognizeWithBaidu(imageBase64);
    if (fallback) return fallback;
  }

  return null;
}

export async function POST(request: NextRequest) {
  let savedPath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '请上传图片' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '图片大小不能超过10MB' },
        { status: 400 }
      );
    }

    // 空 type 放行（保持兼容），明确非图片的类型拒绝
    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '请上传图片文件' },
        { status: 400 }
      );
    }

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const buffer = await prepareImage(rawBuffer);

    // 清洗文件名，防止路径穿越
    const rawName = path.basename(file.name || '') || 'upload';
    const safeName = rawName.replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '');
    const fileName = `${Date.now()}-${safeName}${path.extname(safeName) ? '' : '.jpg'}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    await writeFile(filePath, buffer);
    savedPath = filePath;

    const imageBase64 = buffer.toString('base64');

    const result = await recognize(imageBase64);

    if (!result) {
      await removeFileQuietly(savedPath);
      return NextResponse.json(
        { error: '识别失败，请检查AI服务配置或稍后重试' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (user) {
      db.prepare(
        'INSERT INTO recognition_history (user_id, image_path, component_name, component_type, description, confidence) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        user.userId,
        `/uploads/${fileName}`,
        result.name,
        result.type,
        result.description,
        result.confidence
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        ...result,
        imagePath: `/uploads/${fileName}`,
      },
    });
  } catch (error) {
    console.error('识别错误:', error);
    await removeFileQuietly(savedPath);
    return NextResponse.json(
      { error: '识别失败，请重试' },
      { status: 500 }
    );
  }
}
