// 由 data.db 自动导出，请勿手改（重新生成：node 工具/export-templates.cjs）
// 内置项目模板：本地工具箱离线自带，无需服务器
import type { ToolboxTemplate } from './types';

export const TEMPLATE_SEED: ToolboxTemplate[] = [
  {
    "id": "tpl-1",
    "name": "LED 呼吸灯",
    "emoji": "🔦",
    "category": "入门",
    "difficulty": "简单",
    "description": "最经典的新手项目：让 LED 像呼吸一样渐亮渐灭，掌握 GPIO 与 PWM 基础知识。",
    "sortOrder": 0,
    "components": [
      {
        "name": "Arduino UNO R3 开发板",
        "type": "微控制器",
        "model": "Arduino UNO R3",
        "manufacturer": "",
        "packageType": "DIP",
        "pinCount": 0,
        "specifications": "",
        "description": "项目主控，运行程序控制 LED 亮度",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 0
      },
      {
        "name": "面包板",
        "type": "电路板",
        "model": "",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "免焊接搭建电路",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 1
      },
      {
        "name": "LED 发光二极管",
        "type": "LED",
        "model": "5mm",
        "manufacturer": "",
        "packageType": "直插",
        "pinCount": 0,
        "specifications": "",
        "description": "被控制亮灭的显示器件",
        "annotation": "",
        "quantity": 3,
        "checked": false,
        "confidence": 0,
        "sortOrder": 2
      },
      {
        "name": "电阻",
        "type": "Resistor",
        "model": "220Ω",
        "manufacturer": "",
        "packageType": "直插",
        "pinCount": 0,
        "specifications": "",
        "description": "限流，保护 LED 不被烧毁",
        "annotation": "",
        "quantity": 3,
        "checked": false,
        "confidence": 0,
        "sortOrder": 3
      },
      {
        "name": "杜邦线",
        "type": "Connector",
        "model": "公对公",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "连接开发板与面包板",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 4
      },
      {
        "name": "USB 数据线",
        "type": "Connector",
        "model": "",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "供电与烧录程序",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 5
      }
    ],
    "sections": [
      {
        "type": "step",
        "title": "认识元件",
        "content": "本项目的 4 种元件：\n• Arduino UNO：项目的大脑，负责运行程序\n• 面包板：免焊接搭电路，中间的凹槽把左右两侧隔开，两侧竖排互相连通\n• LED：发光二极管，长脚是正极、短脚是负极\n• 220Ω 电阻：限流用，色环为红红棕金",
        "sortOrder": 0
      },
      {
        "type": "step",
        "title": "搭建电路",
        "content": "接线步骤：\n1. LED 正极（长脚）→ 220Ω 电阻一端\n2. 电阻另一端 → Arduino 的 D9 引脚\n3. LED 负极（短脚）→ Arduino 的 GND\n\n接完先别上电，对照检查一遍。",
        "sortOrder": 1
      },
      {
        "type": "step",
        "title": "烧录程序",
        "content": "1. 用 USB 线连接电脑与 Arduino\n2. 打开 Arduino IDE：工具 → 开发板 → Arduino Uno；工具 → 端口 → 选择串口\n3. 粘贴示例代码并点击上传：\n\nint led = 9;\nvoid setup() { pinMode(led, OUTPUT); }\nvoid loop() {\n  for (int i = 0; i < 255; i++) { analogWrite(led, i); delay(8); }\n  for (int i = 255; i > 0; i--) { analogWrite(led, i); delay(8); }\n}",
        "sortOrder": 2
      },
      {
        "type": "step",
        "title": "测试效果",
        "content": "上传完成后 LED 应缓慢渐亮渐灭，像呼吸一样。\n\nLED 不亮时按顺序排查：\n① LED 是否接反（长脚接电阻一侧）\n② 电阻是否连到 D9 而不是其他引脚\n③ 程序是否提示上传成功",
        "sortOrder": 3
      },
      {
        "type": "note",
        "title": "LED 正负极别搞反",
        "content": "LED 接反不会烧坏，但不会亮。长脚 = 正极，短脚 = 负极；看内部金属片，小的一端是正极。",
        "sortOrder": 4
      },
      {
        "type": "note",
        "title": "千万不要去掉电阻",
        "content": "220Ω 电阻是 LED 的“护身符”。去掉电阻直接接 5V，LED 会瞬间烧毁。",
        "sortOrder": 5
      },
      {
        "type": "note",
        "title": "想学得更多",
        "content": "把代码里的 delay(8) 改成 delay(3) 或 delay(20)，观察呼吸速度的变化，理解 PWM 占空比的概念。",
        "sortOrder": 6
      }
    ]
  },
  {
    "id": "tpl-2",
    "name": "蜂鸣器门铃",
    "emoji": "🚨",
    "category": "入门",
    "difficulty": "简单",
    "description": "按下按钮让蜂鸣器响起，认识数字输入、按键消抖与无源蜂鸣器。",
    "sortOrder": 1,
    "components": [
      {
        "name": "Arduino UNO R3 开发板",
        "type": "微控制器",
        "model": "Arduino UNO R3",
        "manufacturer": "",
        "packageType": "DIP",
        "pinCount": 0,
        "specifications": "",
        "description": "项目主控，检测按键并驱动蜂鸣器",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 0
      },
      {
        "name": "无源蜂鸣器",
        "type": "Buzzer",
        "model": "",
        "manufacturer": "",
        "packageType": "直插",
        "pinCount": 0,
        "specifications": "",
        "description": "发声器件",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 1
      },
      {
        "name": "轻触按键",
        "type": "Switch",
        "model": "",
        "manufacturer": "",
        "packageType": "直插",
        "pinCount": 0,
        "specifications": "",
        "description": "触发门铃的输入开关",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 2
      },
      {
        "name": "电阻",
        "type": "Resistor",
        "model": "10kΩ",
        "manufacturer": "",
        "packageType": "直插",
        "pinCount": 0,
        "specifications": "",
        "description": "按键上拉电阻，避免电平悬空",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 3
      },
      {
        "name": "面包板",
        "type": "电路板",
        "model": "",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "免焊接搭建电路",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 4
      },
      {
        "name": "杜邦线",
        "type": "Connector",
        "model": "公对公",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "连接各元件",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 5
      }
    ],
    "sections": [
      {
        "type": "step",
        "title": "认识元件",
        "content": "• 无源蜂鸣器：需要方波信号驱动才能发声（本项目重点认识它）\n• 有源蜂鸣器：内部带振荡电路，通电就响，可作替换\n• 轻触按键：按下导通、松开断开\n• 10kΩ 电阻：上拉用，防止按键松开时引脚电平悬空",
        "sortOrder": 0
      },
      {
        "type": "step",
        "title": "搭建电路",
        "content": "1. 按键一脚接 GND，另一脚接 D2\n2. D2 与 5V 之间接 10kΩ 上拉电阻\n3. 蜂鸣器正极接 D9，负极接 GND",
        "sortOrder": 1
      },
      {
        "type": "step",
        "title": "烧录程序",
        "content": "示例代码（用内部上拉，可省外接电阻）：\n\nint buzzer = 9;\nint button = 2;\nvoid setup() {\n  pinMode(buzzer, OUTPUT);\n  pinMode(button, INPUT_PULLUP);\n}\nvoid loop() {\n  if (digitalRead(button) == LOW) {\n    tone(buzzer, 1000, 500);\n    delay(500);\n  }\n}",
        "sortOrder": 2
      },
      {
        "type": "step",
        "title": "测试",
        "content": "按下按键，蜂鸣器响 0.5 秒。\n不响时检查：蜂鸣器是否无源型（无源必须用 tone() 驱动）、引脚是否对应。",
        "sortOrder": 3
      },
      {
        "type": "note",
        "title": "无源 vs 有源",
        "content": "无源蜂鸣器直接接 5V 不会响，必须由程序产生方波；有源蜂鸣器通电即响。外观上：有源底部一般有封胶，无源能看到电路板。",
        "sortOrder": 4
      },
      {
        "type": "note",
        "title": "为什么要上拉",
        "content": "按键松开时，D2 必须有一个确定的电平。没有上拉电阻时引脚悬空，程序可能读到随机值导致乱响。代码用了 INPUT_PULLUP，可直接省掉外接电阻。",
        "sortOrder": 5
      }
    ]
  },
  {
    "id": "tpl-3",
    "name": "温湿度计",
    "emoji": "🌡️",
    "category": "入门",
    "difficulty": "中等",
    "description": "实时显示环境温湿度，认识传感器通信协议（单总线）与 OLED 显示屏。",
    "sortOrder": 2,
    "components": [
      {
        "name": "Arduino UNO R3 开发板",
        "type": "微控制器",
        "model": "Arduino UNO R3",
        "manufacturer": "",
        "packageType": "DIP",
        "pinCount": 0,
        "specifications": "",
        "description": "项目主控，读取传感器并驱动屏幕",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 0
      },
      {
        "name": "DHT11 温湿度传感器",
        "type": "Sensor",
        "model": "DHT11",
        "manufacturer": "",
        "packageType": "直插",
        "pinCount": 0,
        "specifications": "",
        "description": "采集环境温湿度数据",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 1
      },
      {
        "name": "OLED 显示屏",
        "type": "Display",
        "model": "SSD1306",
        "manufacturer": "",
        "packageType": "I2C 0.96寸",
        "pinCount": 0,
        "specifications": "",
        "description": "显示温湿度数值",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 2
      },
      {
        "name": "电阻",
        "type": "Resistor",
        "model": "4.7kΩ",
        "manufacturer": "",
        "packageType": "直插",
        "pinCount": 0,
        "specifications": "",
        "description": "DHT11 数据线上拉电阻",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 3
      },
      {
        "name": "面包板",
        "type": "电路板",
        "model": "",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "免焊接搭建电路",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 4
      },
      {
        "name": "杜邦线",
        "type": "Connector",
        "model": "公对母",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "连接传感器与屏幕",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 5
      }
    ],
    "sections": [
      {
        "type": "step",
        "title": "认识元件",
        "content": "• DHT11：温湿度传感器，单总线协议，一次输出 40 位数据（湿度 + 温度 + 校验）\n• SSD1306 OLED：0.96 寸屏，I2C 接口，四根线即可驱动\n• 4.7kΩ 电阻：DHT11 数据线的上拉电阻",
        "sortOrder": 0
      },
      {
        "type": "step",
        "title": "搭建电路",
        "content": "1. DHT11：VCC→5V，GND→GND，DATA→D2（DATA 与 5V 之间并接 4.7kΩ 上拉电阻）\n2. OLED：VCC→5V，GND→GND，SDA→A4，SCL→A5",
        "sortOrder": 1
      },
      {
        "type": "step",
        "title": "安装库",
        "content": "Arduino IDE → 工具 → 管理库，搜索并安装：\n• DHT sensor library（Adafruit）\n• Adafruit SSD1306\n• Adafruit GFX Library",
        "sortOrder": 2
      },
      {
        "type": "step",
        "title": "烧录测试",
        "content": "打开 DHTtester 示例：初始化 OLED 后，把串口打印的温湿度改为显示到屏幕上。\n烧录后屏幕应实时显示温度与湿度。",
        "sortOrder": 3
      },
      {
        "type": "note",
        "title": "读数失败/很慢",
        "content": "DHT11 至少间隔 2 秒读取一次，读得太快会返回错误值。",
        "sortOrder": 4
      },
      {
        "type": "note",
        "title": "屏幕不亮",
        "content": "先查 I2C 地址：常见 0x3C，部分模块是 0x3D，改一下代码即可。再检查 SDA/SCL 是否接反。",
        "sortOrder": 5
      },
      {
        "type": "note",
        "title": "湿度显示 99%",
        "content": "通常是 DATA 线接触不良或上拉电阻没接好，重新插拔杜邦线试试。",
        "sortOrder": 6
      }
    ]
  },
  {
    "id": "tpl-4",
    "name": "循迹小车",
    "emoji": "🚗",
    "category": "进阶",
    "difficulty": "中等",
    "description": "让小车沿着黑线自动行驶，综合练习电机驱动、传感器与电源系统。",
    "sortOrder": 3,
    "components": [
      {
        "name": "Arduino UNO R3 开发板",
        "type": "微控制器",
        "model": "Arduino UNO R3",
        "manufacturer": "",
        "packageType": "DIP",
        "pinCount": 0,
        "specifications": "",
        "description": "整车主控，运行循迹算法",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 0
      },
      {
        "name": "L298N 电机驱动模块",
        "type": "Driver",
        "model": "L298N",
        "manufacturer": "",
        "packageType": "模块",
        "pinCount": 0,
        "specifications": "",
        "description": "驱动电机正反转与调速",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 1
      },
      {
        "name": "TT 直流减速电机（带轮）",
        "type": "Motor",
        "model": "TT130",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "提供动力",
        "annotation": "",
        "quantity": 4,
        "checked": false,
        "confidence": 0,
        "sortOrder": 2
      },
      {
        "name": "红外循迹传感器",
        "type": "Sensor",
        "model": "TCRT5000",
        "manufacturer": "",
        "packageType": "模块",
        "pinCount": 0,
        "specifications": "",
        "description": "检测黑线位置",
        "annotation": "",
        "quantity": 4,
        "checked": false,
        "confidence": 0,
        "sortOrder": 3
      },
      {
        "name": "18650 锂电池（含电池盒）",
        "type": "Battery",
        "model": "18650",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "整车供电",
        "annotation": "",
        "quantity": 2,
        "checked": false,
        "confidence": 0,
        "sortOrder": 4
      },
      {
        "name": "智能小车底盘套件",
        "type": "结构件",
        "model": "",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "承载所有部件",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 5
      },
      {
        "name": "杜邦线",
        "type": "Connector",
        "model": "公对母",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "连接电机与传感器",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 6
      }
    ],
    "sections": [
      {
        "type": "step",
        "title": "认识模块",
        "content": "• L298N：双路电机驱动，可控制两个电机正反转与调速。12V 端子给电机供电，5V 端子是逻辑供电，不要接错\n• TCRT5000 循迹模块：红外发射 + 接收，检测到黑线输出低电平\n• TT 马达：直流减速电机，工作电压 3-6V",
        "sortOrder": 0
      },
      {
        "type": "step",
        "title": "机械组装",
        "content": "1. 底盘安装 4 个电机（左右各 2 个），同一侧两个电机并联、转动方向一致\n2. 安装电池盒（2 节 18650 串联，约 7.4V）\n3. 循迹模块装在车头，距地面 1-2cm",
        "sortOrder": 1
      },
      {
        "type": "step",
        "title": "电路接线",
        "content": "1. L298N：12V→电池正极，GND→电池负极；5V 给 Arduino 供电（或 Arduino 独立供电）\n2. IN1-IN4 → Arduino D5-D8；使能 ENA/ENB → D9/D10\n3. 左侧电机接 OUT1/OUT2，右侧电机接 OUT3/OUT4\n4. 4 个循迹传感器信号线 → D2-D5，VCC/GND → 5V/GND\n\n⚠️ 所有模块必须共地！",
        "sortOrder": 2
      },
      {
        "type": "step",
        "title": "烧录与调试",
        "content": "循迹逻辑：\n• 中间两个传感器都在黑线上 → 直行\n• 左侧偏出 → 右转修正\n• 右侧偏出 → 左转修正\n\n先在浅色地面贴黑色电工胶带测试，速度先调慢，稳定后再逐步加快。",
        "sortOrder": 3
      },
      {
        "type": "note",
        "title": "必须共地",
        "content": "电池、L298N、传感器、Arduino 的 GND 必须连在一起，否则信号没有参考点，电机会乱转。",
        "sortOrder": 4
      },
      {
        "type": "note",
        "title": "电机与逻辑分开供电",
        "content": "L298N 的 12V 端接电池；给 Arduino 供电最好用独立 5V，不要从 L298N 的 5V 反灌，避免干扰复位。",
        "sortOrder": 5
      },
      {
        "type": "note",
        "title": "电池安全",
        "content": "18650 不要裸接反接。两节串联 7.4V，务必确认正负极，接反会烧驱动板。",
        "sortOrder": 6
      }
    ]
  },
  {
    "id": "tpl-5",
    "name": "蓝牙音箱",
    "emoji": "🎵",
    "category": "进阶",
    "difficulty": "较难",
    "description": "自制一个能连手机的蓝牙音箱，完整认识音频链路与锂电池供电。",
    "sortOrder": 4,
    "components": [
      {
        "name": "蓝牙音频模块",
        "type": "Module",
        "model": "MH-M18",
        "manufacturer": "",
        "packageType": "模块",
        "pinCount": 0,
        "specifications": "",
        "description": "接收手机蓝牙音频信号",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 0
      },
      {
        "name": "数字功放模块",
        "type": "Amplifier",
        "model": "PAM8403",
        "manufacturer": "",
        "packageType": "模块",
        "pinCount": 0,
        "specifications": "",
        "description": "放大音频信号驱动喇叭",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 1
      },
      {
        "name": "喇叭",
        "type": "Speaker",
        "model": "3W 4Ω",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "发声单元",
        "annotation": "",
        "quantity": 2,
        "checked": false,
        "confidence": 0,
        "sortOrder": 2
      },
      {
        "name": "18650 锂电池",
        "type": "Battery",
        "model": "3.7V",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "供电",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 3
      },
      {
        "name": "充电保护模块",
        "type": "Module",
        "model": "TP4056",
        "manufacturer": "",
        "packageType": "模块",
        "pinCount": 0,
        "specifications": "",
        "description": "充电管理与过放保护",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 4
      },
      {
        "name": "拨动开关",
        "type": "Switch",
        "model": "",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "总电源开关",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 5
      },
      {
        "name": "箱体",
        "type": "结构件",
        "model": "",
        "manufacturer": "",
        "packageType": "木质/亚克力",
        "pinCount": 0,
        "specifications": "",
        "description": "外壳与共鸣箱",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 6
      },
      {
        "name": "导线",
        "type": "Connector",
        "model": "",
        "manufacturer": "",
        "packageType": "",
        "pinCount": 0,
        "specifications": "",
        "description": "内部连接",
        "annotation": "",
        "quantity": 1,
        "checked": false,
        "confidence": 0,
        "sortOrder": 7
      }
    ],
    "sections": [
      {
        "type": "step",
        "title": "认识模块",
        "content": "• MH-M18 蓝牙模块：接收手机蓝牙音频，输出模拟音频信号（L/R/GND）\n• PAM8403：D 类数字功放，3W×2，供电 5V\n• TP4056：锂电池充电 + 保护板，输入 5V，输出接电池",
        "sortOrder": 0
      },
      {
        "type": "step",
        "title": "电路接线",
        "content": "1. 电池 → TP4056（B+/B-）\n2. TP4056 输出 ± → 拨动开关 → 蓝牙模块 5V 与 PAM8403 5V\n3. 蓝牙模块音频输出 L/R/GND → PAM8403 输入 L/R/GND\n4. PAM8403 输出 → 左右喇叭",
        "sortOrder": 1
      },
      {
        "type": "step",
        "title": "组装",
        "content": "1. 箱体开孔：喇叭孔、充电口、开关孔\n2. 喇叭用热熔胶固定，模块用双面胶固定\n3. 线材用扎带整理，避免压到开关",
        "sortOrder": 2
      },
      {
        "type": "step",
        "title": "测试",
        "content": "拨动开关上电，手机蓝牙搜索 “MH-M18” 配对，播放音乐。\n音量从低到高测试，出现破音说明箱体共振，可在箱内加吸音棉。",
        "sortOrder": 3
      },
      {
        "type": "note",
        "title": "功放不能空载开机",
        "content": "PAM8403 开机时喇叭必须已经接好，空载通电容易损坏功放芯片。",
        "sortOrder": 4
      },
      {
        "type": "note",
        "title": "电池保护",
        "content": "必须使用带保护板的电池或 TP4056 保护板，3.7V 锂电池过放会永久损坏。",
        "sortOrder": 5
      },
      {
        "type": "note",
        "title": "杂音排查",
        "content": "底噪大时：功放输入线尽量短、远离蓝牙天线；声音断续时：检查 TP4056 输出电流是否足够（2A 以上）。",
        "sortOrder": 6
      }
    ]
  }
];
