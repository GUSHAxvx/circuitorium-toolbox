import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data.db');

// 开发模式热更新会反复执行本模块，通过 globalThis 复用连接，避免连接泄漏
const globalForDb = globalThis as unknown as {
  __circuitDb?: InstanceType<typeof Database>;
};

// 入门项目模板种子数据（仅在模板表为空时写入）
const PROJECT_TEMPLATES = [
  {
    name: 'LED 呼吸灯',
    emoji: '🔦',
    category: '入门',
    difficulty: '简单',
    description: '最经典的新手项目：让 LED 像呼吸一样渐亮渐灭，掌握 GPIO 与 PWM 基础知识。',
    items: [
      { component_name: 'Arduino UNO R3 开发板', component_type: '微控制器', model: 'Arduino UNO R3', package_type: 'DIP', quantity: 1, purpose: '项目主控，运行程序控制 LED 亮度' },
      { component_name: '面包板', component_type: '电路板', model: '', package_type: '', quantity: 1, purpose: '免焊接搭建电路' },
      { component_name: 'LED 发光二极管', component_type: 'LED', model: '5mm', package_type: '直插', quantity: 3, purpose: '被控制亮灭的显示器件' },
      { component_name: '电阻', component_type: 'Resistor', model: '220Ω', package_type: '直插', quantity: 3, purpose: '限流，保护 LED 不被烧毁' },
      { component_name: '杜邦线', component_type: 'Connector', model: '公对公', package_type: '', quantity: 1, purpose: '连接开发板与面包板' },
      { component_name: 'USB 数据线', component_type: 'Connector', model: '', package_type: '', quantity: 1, purpose: '供电与烧录程序' },
    ],
    sections: [
      { type: 'step', title: '认识元件', content: '本项目的 4 种元件：\n• Arduino UNO：项目的大脑，负责运行程序\n• 面包板：免焊接搭电路，中间的凹槽把左右两侧隔开，两侧竖排互相连通\n• LED：发光二极管，长脚是正极、短脚是负极\n• 220Ω 电阻：限流用，色环为红红棕金' },
      { type: 'step', title: '搭建电路', content: '接线步骤：\n1. LED 正极（长脚）→ 220Ω 电阻一端\n2. 电阻另一端 → Arduino 的 D9 引脚\n3. LED 负极（短脚）→ Arduino 的 GND\n\n接完先别上电，对照检查一遍。' },
      { type: 'step', title: '烧录程序', content: '1. 用 USB 线连接电脑与 Arduino\n2. 打开 Arduino IDE：工具 → 开发板 → Arduino Uno；工具 → 端口 → 选择串口\n3. 粘贴示例代码并点击上传：\n\nint led = 9;\nvoid setup() { pinMode(led, OUTPUT); }\nvoid loop() {\n  for (int i = 0; i < 255; i++) { analogWrite(led, i); delay(8); }\n  for (int i = 255; i > 0; i--) { analogWrite(led, i); delay(8); }\n}' },
      { type: 'step', title: '测试效果', content: '上传完成后 LED 应缓慢渐亮渐灭，像呼吸一样。\n\nLED 不亮时按顺序排查：\n① LED 是否接反（长脚接电阻一侧）\n② 电阻是否连到 D9 而不是其他引脚\n③ 程序是否提示上传成功' },
      { type: 'note', title: 'LED 正负极别搞反', content: 'LED 接反不会烧坏，但不会亮。长脚 = 正极，短脚 = 负极；看内部金属片，小的一端是正极。' },
      { type: 'note', title: '千万不要去掉电阻', content: '220Ω 电阻是 LED 的“护身符”。去掉电阻直接接 5V，LED 会瞬间烧毁。' },
      { type: 'note', title: '想学得更多', content: '把代码里的 delay(8) 改成 delay(3) 或 delay(20)，观察呼吸速度的变化，理解 PWM 占空比的概念。' },
    ],
  },
  {
    name: '蜂鸣器门铃',
    emoji: '🚨',
    category: '入门',
    difficulty: '简单',
    description: '按下按钮让蜂鸣器响起，认识数字输入、按键消抖与无源蜂鸣器。',
    items: [
      { component_name: 'Arduino UNO R3 开发板', component_type: '微控制器', model: 'Arduino UNO R3', package_type: 'DIP', quantity: 1, purpose: '项目主控，检测按键并驱动蜂鸣器' },
      { component_name: '无源蜂鸣器', component_type: 'Buzzer', model: '', package_type: '直插', quantity: 1, purpose: '发声器件' },
      { component_name: '轻触按键', component_type: 'Switch', model: '', package_type: '直插', quantity: 1, purpose: '触发门铃的输入开关' },
      { component_name: '电阻', component_type: 'Resistor', model: '10kΩ', package_type: '直插', quantity: 1, purpose: '按键上拉电阻，避免电平悬空' },
      { component_name: '面包板', component_type: '电路板', model: '', package_type: '', quantity: 1, purpose: '免焊接搭建电路' },
      { component_name: '杜邦线', component_type: 'Connector', model: '公对公', package_type: '', quantity: 1, purpose: '连接各元件' },
    ],
    sections: [
      { type: 'step', title: '认识元件', content: '• 无源蜂鸣器：需要方波信号驱动才能发声（本项目重点认识它）\n• 有源蜂鸣器：内部带振荡电路，通电就响，可作替换\n• 轻触按键：按下导通、松开断开\n• 10kΩ 电阻：上拉用，防止按键松开时引脚电平悬空' },
      { type: 'step', title: '搭建电路', content: '1. 按键一脚接 GND，另一脚接 D2\n2. D2 与 5V 之间接 10kΩ 上拉电阻\n3. 蜂鸣器正极接 D9，负极接 GND' },
      { type: 'step', title: '烧录程序', content: '示例代码（用内部上拉，可省外接电阻）：\n\nint buzzer = 9;\nint button = 2;\nvoid setup() {\n  pinMode(buzzer, OUTPUT);\n  pinMode(button, INPUT_PULLUP);\n}\nvoid loop() {\n  if (digitalRead(button) == LOW) {\n    tone(buzzer, 1000, 500);\n    delay(500);\n  }\n}' },
      { type: 'step', title: '测试', content: '按下按键，蜂鸣器响 0.5 秒。\n不响时检查：蜂鸣器是否无源型（无源必须用 tone() 驱动）、引脚是否对应。' },
      { type: 'note', title: '无源 vs 有源', content: '无源蜂鸣器直接接 5V 不会响，必须由程序产生方波；有源蜂鸣器通电即响。外观上：有源底部一般有封胶，无源能看到电路板。' },
      { type: 'note', title: '为什么要上拉', content: '按键松开时，D2 必须有一个确定的电平。没有上拉电阻时引脚悬空，程序可能读到随机值导致乱响。代码用了 INPUT_PULLUP，可直接省掉外接电阻。' },
    ],
  },
  {
    name: '温湿度计',
    emoji: '🌡️',
    category: '入门',
    difficulty: '中等',
    description: '实时显示环境温湿度，认识传感器通信协议（单总线）与 OLED 显示屏。',
    items: [
      { component_name: 'Arduino UNO R3 开发板', component_type: '微控制器', model: 'Arduino UNO R3', package_type: 'DIP', quantity: 1, purpose: '项目主控，读取传感器并驱动屏幕' },
      { component_name: 'DHT11 温湿度传感器', component_type: 'Sensor', model: 'DHT11', package_type: '直插', quantity: 1, purpose: '采集环境温湿度数据' },
      { component_name: 'OLED 显示屏', component_type: 'Display', model: 'SSD1306', package_type: 'I2C 0.96寸', quantity: 1, purpose: '显示温湿度数值' },
      { component_name: '电阻', component_type: 'Resistor', model: '4.7kΩ', package_type: '直插', quantity: 1, purpose: 'DHT11 数据线上拉电阻' },
      { component_name: '面包板', component_type: '电路板', model: '', package_type: '', quantity: 1, purpose: '免焊接搭建电路' },
      { component_name: '杜邦线', component_type: 'Connector', model: '公对母', package_type: '', quantity: 1, purpose: '连接传感器与屏幕' },
    ],
    sections: [
      { type: 'step', title: '认识元件', content: '• DHT11：温湿度传感器，单总线协议，一次输出 40 位数据（湿度 + 温度 + 校验）\n• SSD1306 OLED：0.96 寸屏，I2C 接口，四根线即可驱动\n• 4.7kΩ 电阻：DHT11 数据线的上拉电阻' },
      { type: 'step', title: '搭建电路', content: '1. DHT11：VCC→5V，GND→GND，DATA→D2（DATA 与 5V 之间并接 4.7kΩ 上拉电阻）\n2. OLED：VCC→5V，GND→GND，SDA→A4，SCL→A5' },
      { type: 'step', title: '安装库', content: 'Arduino IDE → 工具 → 管理库，搜索并安装：\n• DHT sensor library（Adafruit）\n• Adafruit SSD1306\n• Adafruit GFX Library' },
      { type: 'step', title: '烧录测试', content: '打开 DHTtester 示例：初始化 OLED 后，把串口打印的温湿度改为显示到屏幕上。\n烧录后屏幕应实时显示温度与湿度。' },
      { type: 'note', title: '读数失败/很慢', content: 'DHT11 至少间隔 2 秒读取一次，读得太快会返回错误值。' },
      { type: 'note', title: '屏幕不亮', content: '先查 I2C 地址：常见 0x3C，部分模块是 0x3D，改一下代码即可。再检查 SDA/SCL 是否接反。' },
      { type: 'note', title: '湿度显示 99%', content: '通常是 DATA 线接触不良或上拉电阻没接好，重新插拔杜邦线试试。' },
    ],
  },
  {
    name: '循迹小车',
    emoji: '🚗',
    category: '进阶',
    difficulty: '中等',
    description: '让小车沿着黑线自动行驶，综合练习电机驱动、传感器与电源系统。',
    items: [
      { component_name: 'Arduino UNO R3 开发板', component_type: '微控制器', model: 'Arduino UNO R3', package_type: 'DIP', quantity: 1, purpose: '整车主控，运行循迹算法' },
      { component_name: 'L298N 电机驱动模块', component_type: 'Driver', model: 'L298N', package_type: '模块', quantity: 1, purpose: '驱动电机正反转与调速' },
      { component_name: 'TT 直流减速电机（带轮）', component_type: 'Motor', model: 'TT130', package_type: '', quantity: 4, purpose: '提供动力' },
      { component_name: '红外循迹传感器', component_type: 'Sensor', model: 'TCRT5000', package_type: '模块', quantity: 4, purpose: '检测黑线位置' },
      { component_name: '18650 锂电池（含电池盒）', component_type: 'Battery', model: '18650', package_type: '', quantity: 2, purpose: '整车供电' },
      { component_name: '智能小车底盘套件', component_type: '结构件', model: '', package_type: '', quantity: 1, purpose: '承载所有部件' },
      { component_name: '杜邦线', component_type: 'Connector', model: '公对母', package_type: '', quantity: 1, purpose: '连接电机与传感器' },
    ],
    sections: [
      { type: 'step', title: '认识模块', content: '• L298N：双路电机驱动，可控制两个电机正反转与调速。12V 端子给电机供电，5V 端子是逻辑供电，不要接错\n• TCRT5000 循迹模块：红外发射 + 接收，检测到黑线输出低电平\n• TT 马达：直流减速电机，工作电压 3-6V' },
      { type: 'step', title: '机械组装', content: '1. 底盘安装 4 个电机（左右各 2 个），同一侧两个电机并联、转动方向一致\n2. 安装电池盒（2 节 18650 串联，约 7.4V）\n3. 循迹模块装在车头，距地面 1-2cm' },
      { type: 'step', title: '电路接线', content: '1. L298N：12V→电池正极，GND→电池负极；5V 给 Arduino 供电（或 Arduino 独立供电）\n2. IN1-IN4 → Arduino D5-D8；使能 ENA/ENB → D9/D10\n3. 左侧电机接 OUT1/OUT2，右侧电机接 OUT3/OUT4\n4. 4 个循迹传感器信号线 → D2-D5，VCC/GND → 5V/GND\n\n⚠️ 所有模块必须共地！' },
      { type: 'step', title: '烧录与调试', content: '循迹逻辑：\n• 中间两个传感器都在黑线上 → 直行\n• 左侧偏出 → 右转修正\n• 右侧偏出 → 左转修正\n\n先在浅色地面贴黑色电工胶带测试，速度先调慢，稳定后再逐步加快。' },
      { type: 'note', title: '必须共地', content: '电池、L298N、传感器、Arduino 的 GND 必须连在一起，否则信号没有参考点，电机会乱转。' },
      { type: 'note', title: '电机与逻辑分开供电', content: 'L298N 的 12V 端接电池；给 Arduino 供电最好用独立 5V，不要从 L298N 的 5V 反灌，避免干扰复位。' },
      { type: 'note', title: '电池安全', content: '18650 不要裸接反接。两节串联 7.4V，务必确认正负极，接反会烧驱动板。' },
    ],
  },
  {
    name: '蓝牙音箱',
    emoji: '🎵',
    category: '进阶',
    difficulty: '较难',
    description: '自制一个能连手机的蓝牙音箱，完整认识音频链路与锂电池供电。',
    items: [
      { component_name: '蓝牙音频模块', component_type: 'Module', model: 'MH-M18', package_type: '模块', quantity: 1, purpose: '接收手机蓝牙音频信号' },
      { component_name: '数字功放模块', component_type: 'Amplifier', model: 'PAM8403', package_type: '模块', quantity: 1, purpose: '放大音频信号驱动喇叭' },
      { component_name: '喇叭', component_type: 'Speaker', model: '3W 4Ω', package_type: '', quantity: 2, purpose: '发声单元' },
      { component_name: '18650 锂电池', component_type: 'Battery', model: '3.7V', package_type: '', quantity: 1, purpose: '供电' },
      { component_name: '充电保护模块', component_type: 'Module', model: 'TP4056', package_type: '模块', quantity: 1, purpose: '充电管理与过放保护' },
      { component_name: '拨动开关', component_type: 'Switch', model: '', package_type: '', quantity: 1, purpose: '总电源开关' },
      { component_name: '箱体', component_type: '结构件', model: '', package_type: '木质/亚克力', quantity: 1, purpose: '外壳与共鸣箱' },
      { component_name: '导线', component_type: 'Connector', model: '', package_type: '', quantity: 1, purpose: '内部连接' },
    ],
    sections: [
      { type: 'step', title: '认识模块', content: '• MH-M18 蓝牙模块：接收手机蓝牙音频，输出模拟音频信号（L/R/GND）\n• PAM8403：D 类数字功放，3W×2，供电 5V\n• TP4056：锂电池充电 + 保护板，输入 5V，输出接电池' },
      { type: 'step', title: '电路接线', content: '1. 电池 → TP4056（B+/B-）\n2. TP4056 输出 ± → 拨动开关 → 蓝牙模块 5V 与 PAM8403 5V\n3. 蓝牙模块音频输出 L/R/GND → PAM8403 输入 L/R/GND\n4. PAM8403 输出 → 左右喇叭' },
      { type: 'step', title: '组装', content: '1. 箱体开孔：喇叭孔、充电口、开关孔\n2. 喇叭用热熔胶固定，模块用双面胶固定\n3. 线材用扎带整理，避免压到开关' },
      { type: 'step', title: '测试', content: '拨动开关上电，手机蓝牙搜索 “MH-M18” 配对，播放音乐。\n音量从低到高测试，出现破音说明箱体共振，可在箱内加吸音棉。' },
      { type: 'note', title: '功放不能空载开机', content: 'PAM8403 开机时喇叭必须已经接好，空载通电容易损坏功放芯片。' },
      { type: 'note', title: '电池保护', content: '必须使用带保护板的电池或 TP4056 保护板，3.7V 锂电池过放会永久损坏。' },
      { type: 'note', title: '杂音排查', content: '底噪大时：功放输入线尽量短、远离蓝牙天线；声音断续时：检查 TP4056 输出电流是否足够（2A 以上）。' },
    ],
  },
];

function seedProjectTemplates(db: InstanceType<typeof Database>) {
  try {
    const insertTemplate = db.prepare(
      'INSERT INTO project_templates (name, emoji, category, difficulty, description, component_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO template_items (template_id, component_name, component_type, model, package_type, quantity, purpose, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertSection = db.prepare(
      'INSERT INTO template_sections (template_id, type, title, content, sort_order) VALUES (?, ?, ?, ?, ?)'
    );

    const templateCount = (db.prepare('SELECT COUNT(*) as c FROM project_templates').get() as { c: number }).c;

    const tx = db.transaction(() => {
      PROJECT_TEMPLATES.forEach((t, ti) => {
        let templateId: number | undefined;

        if (templateCount === 0) {
          // 首次运行：写入模板、BOM 条目与教程
          const info = insertTemplate.run(t.name, t.emoji, t.category, t.difficulty, t.description, t.items.length, ti);
          templateId = Number(info.lastInsertRowid);
          t.items.forEach((item, ii) => {
            insertItem.run(templateId, item.component_name, item.component_type, item.model, item.package_type, item.quantity, item.purpose, ii);
          });
        } else {
          // 老库升级：按名称匹配已有模板
          const existing = db.prepare('SELECT id FROM project_templates WHERE name = ?').get(t.name) as { id: number } | undefined;
          templateId = existing?.id;
        }

        if (templateId === undefined) return;

        // 教程内容缺失时补写
        const hasSections = db.prepare('SELECT 1 FROM template_sections WHERE template_id = ? LIMIT 1').get(templateId);
        if (hasSections) return;

        t.sections.forEach((s, si) => {
          insertSection.run(templateId, s.type, s.title, s.content, si);
        });
      });
    });
    tx();
  } catch (error) {
    console.error('写入项目模板失败:', error);
  }
}

function createDb() {
  const db = new Database(dbPath);
  // 构建时多个 worker 进程会同时打开数据库，设置等待超时避免 SQLITE_BUSY
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recognition_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      image_path TEXT NOT NULL,
      component_name TEXT,
      component_type TEXT,
      description TEXT,
      confidence REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      image_path TEXT NOT NULL,
      component_name TEXT,
      component_type TEXT,
      description TEXT,
      confidence REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      favorite_id INTEGER,
      share_token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (favorite_id) REFERENCES favorites(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      component_name TEXT,
      component_type TEXT,
      description TEXT,
      confidence REAL,
      annotation TEXT DEFAULT '',
      model TEXT DEFAULT '',
      manufacturer TEXT DEFAULT '',
      package_type TEXT DEFAULT '',
      pin_count INTEGER DEFAULT 0,
      specifications TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '🔧',
      category TEXT DEFAULT '入门',
      difficulty TEXT DEFAULT '简单',
      description TEXT DEFAULT '',
      component_count INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS template_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      component_name TEXT NOT NULL,
      component_type TEXT DEFAULT '',
      model TEXT DEFAULT '',
      package_type TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      purpose TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      type TEXT DEFAULT 'step',
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS template_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      type TEXT DEFAULT 'step',
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_stars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 卍解项目：程序代码 / 接线表 / 调试记录（与本地版的三种数据一一对应）
    CREATE TABLE IF NOT EXISTS project_code_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      language TEXT DEFAULT '',
      group_name TEXT DEFAULT '',
      content TEXT DEFAULT '',
      note TEXT DEFAULT '',
      encoding TEXT DEFAULT 'utf-8',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_pin_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      module TEXT DEFAULT '',
      pin TEXT DEFAULT '',
      board_pin TEXT DEFAULT '',
      note TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_debug_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      problem TEXT DEFAULT '',
      solution TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // 旧库字段迁移（存在则跳过）
  try { db.exec(`ALTER TABLE project_components ADD COLUMN checked INTEGER DEFAULT 0`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE project_images ADD COLUMN kind TEXT DEFAULT 'photo'`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE projects ADD COLUMN is_shared INTEGER DEFAULT 0`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE projects ADD COLUMN share_token TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE projects ADD COLUMN share_count INTEGER DEFAULT 0`); } catch { /* exists */ }
  // 项目浏览量（项目模块的「热度」统计之一）
  try { db.exec(`ALTER TABLE projects ADD COLUMN views INTEGER DEFAULT 0`); } catch { /* exists */ }
  // 项目详情页可自主编辑的两块内容：长描述 + 主要功能（每行一条）
  try { db.exec(`ALTER TABLE projects ADD COLUMN description TEXT DEFAULT ''`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE projects ADD COLUMN features TEXT DEFAULT ''`); } catch { /* exists */ }
  // 难度：始解（不用写代码，默认）/ 卍解（要写代码，项目里多出代码、接线表、调试记录）
  try { db.exec(`ALTER TABLE projects ADD COLUMN difficulty TEXT DEFAULT 'shikai'`); } catch { /* exists */ }
  // 卍解项目的开发环境说明
  try { db.exec(`ALTER TABLE projects ADD COLUMN code_note TEXT DEFAULT ''`); } catch { /* exists */ }

  // 写入入门项目模板（含教程内容）
  seedProjectTemplates(db);

  // 旧库字段迁移（存在则跳过）
  try { db.exec(`ALTER TABLE project_components ADD COLUMN quantity INTEGER DEFAULT 1`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE project_components ADD COLUMN model TEXT DEFAULT ''`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE project_components ADD COLUMN manufacturer TEXT DEFAULT ''`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE project_components ADD COLUMN package_type TEXT DEFAULT ''`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE project_components ADD COLUMN pin_count INTEGER DEFAULT 0`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE project_components ADD COLUMN specifications TEXT DEFAULT ''`); } catch { /* exists */ }

  return db;
}

const db = globalForDb.__circuitDb ?? createDb();

if (!globalForDb.__circuitDb) {
  globalForDb.__circuitDb = db;
}

export default db;
