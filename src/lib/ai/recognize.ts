// 本地 AI 识别：走 OpenAI 兼容接口（千问 VL 直连 / 老师代理），识别结果直接落本地库
// 说明：没配置 AI 时这里不会被调用，手动录入永远可用

import { clampFloat, clampInt, clampText, extractJson } from '@/lib/sanitize';
import type { AiConfig } from './config';

export interface RecognizedComponent {
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  packageType: string;
  pinCount: number;
  specifications: string;
  description: string;
  confidence: number;
}

export interface RecognizeOutcome {
  components: RecognizedComponent[];
  /** 服务返回的原始文本，出错排查用（不展示给学生） */
  raw?: string;
}

export class AiError extends Error {
  kind: 'no-config' | 'network' | 'auth' | 'bad-response' | 'timeout';
  constructor(kind: AiError['kind'], message: string) {
    super(message);
    this.kind = kind;
  }
}

const PROMPT = `你是电子元件识别助手。看图，找出图中所有电子元器件，输出 JSON（不要解释、不要 markdown 代码块）：
{"components":[{"name":"元件中文名","type":"类别","model":"型号或规格，没有就空","manufacturer":"厂商，没有就空","packageType":"封装，没有就空","pinCount":0,"specifications":"关键参数，没有就空","description":"它在电路里的作用，一句话","confidence":0.0}]}
要求：name 必填；confidence 是 0~1 的小数；最多识别 12 个；看不清就不要编造，宁可返回空数组。`;

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new AiError('bad-response', '图片读取失败'));
  reader.readAsDataURL(blob);
});

function normalizeRecognized(raw: unknown): RecognizedComponent[] {
  const list = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && Array.isArray((raw as { components?: unknown[] }).components)
      ? (raw as { components: unknown[] }).components
      : []);

  return list.slice(0, 12).map((item) => {
    const c = (item || {}) as Record<string, unknown>;
    return {
      name: clampText(c.name, 120).trim() || '未识别元件',
      type: clampText(c.type, 60),
      model: clampText(c.model, 80),
      manufacturer: clampText(c.manufacturer, 60),
      packageType: clampText(c.packageType, 60),
      pinCount: clampInt(c.pinCount, 0, 2000, 0),
      specifications: clampText(c.specifications, 200),
      description: clampText(c.description, 400),
      confidence: clampFloat(c.confidence, 0, 1, 0.8),
    };
  }).filter((c) => c.name && c.name !== '未识别元件');
}

/** 调一次识别接口；失败时抛出带 kind 的 AiError，方便界面给友好提示 */
export async function recognizeImage(
  config: AiConfig,
  image: Blob,
  options?: { timeoutMs?: number }
): Promise<RecognizeOutcome> {
  if (config.mode === 'manual') {
    throw new AiError('no-config', '当前是手动模式');
  }

  const dataUrl = await blobToDataUrl(image);
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.mode === 'local-key' && config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  } else if (config.proxyToken) {
    headers.Authorization = `Bearer ${config.proxyToken}`;
  } else if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options?.timeoutMs ?? 45000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        }],
        temperature: 0.1,
      }),
    });
  } catch (e) {
    window.clearTimeout(timeout);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new AiError('timeout', '识别超时，请检查网络后重试');
    }
    // 浏览器跨域被拦、断网、地址写错都会落到这里
    throw new AiError('network', '连不上识别服务：检查网络，或改用老师给的配置码');
  } finally {
    window.clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = clampText((body as { error?: { message?: string } })?.error?.message, 200);
    } catch { /* ignore */ }
    if (res.status === 401 || res.status === 403) {
      throw new AiError('auth', '识别服务拒绝了这次请求（配置可能已失效，请向老师要新的配置码）');
    }
    throw new AiError('bad-response', `识别服务返回错误（${res.status}）${detail ? '：' + detail : ''}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => (typeof part === 'string' ? part : (part as { text?: string })?.text || '')).join('')
      : '';

  const parsed = extractJson(text);
  const components = normalizeRecognized(parsed);

  if (components.length === 0) {
    throw new AiError('bad-response', '没识别出元件，换一张更清晰的照片试试');
  }
  return { components, raw: text.slice(0, 2000) };
}

/** 轻量连通性测试：只发一条文本，不传图片，省配额 */
export async function checkAiConnection(config: AiConfig): Promise<{ ok: boolean; message: string }> {
  if (config.mode === 'manual') return { ok: false, message: '当前是手动模式，不需要连接' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = config.mode === 'local-key' ? config.apiKey : (config.proxyToken || config.apiKey);
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    if (res.ok || res.status === 400) return { ok: true, message: '连接正常' };
    if (res.status === 401 || res.status === 403) return { ok: false, message: '凭据被拒绝，请检查 Key 或配置码' };
    return { ok: false, message: `服务返回 ${res.status}` };
  } catch {
    return { ok: false, message: '连不上服务：检查网络或地址是否写对' };
  }
}
