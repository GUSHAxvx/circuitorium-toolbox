// 内置示例作品：第一次打开工具箱就有的"成品样子"，可直接改、可删
// 内容基于内置模板，配上完善的描述与功能清单，让新人一眼看懂"做完是什么样"

export interface SampleSeed {
  /** 用哪个模板生成 */
  templateId: string;
  name: string;
  notes: string;
  description: string;
  features: string;
  /** 前 N 个元件标记为已备齐，模拟"做到一半"的真实状态 */
  checkedCount: number;
}

export const SAMPLE_SEED: SampleSeed[] = [
  {
    templateId: 'tpl-1',
    name: '示例 · LED 呼吸灯（入门）',
    notes: '最经典的第一课：让 LED 像呼吸一样渐亮渐灭，顺便认识面包板。',
    description:
      '用 Arduino 的 PWM 输出控制 LED 亮度，做出"呼吸"效果。\n'
      + '这个示例包含完整元件清单、接线步骤、可直接烧录的程序，以及"灯不亮"的排查顺序，'
      + '照着做完就能理解 GPIO 与 PWM 是怎么一回事。',
    features: '认识 LED、电阻、面包板\n用 PWM 控制 LED 亮度\n完成第一次程序烧录\n学会按顺序排查故障',
    checkedCount: 3,
  },
  {
    templateId: 'tpl-3',
    name: '示例 · 温湿度计（进阶）',
    notes: '把环境数据读出来显示在屏幕上，第一次做出"有读数"的作品。',
    description:
      '读取温湿度传感器的数据并显示在液晶屏上，是很多实用作品的基础模块。\n'
      + '这个示例演示了传感器接线、数据显示与刷新节奏的处理方式，做完可以继续扩展成'
      + '"超过阈值就报警"的小装置。',
    features: '认识数字传感器与单总线/串口\n读取温湿度数据\n在屏幕上显示读数\n为报警功能预留判断逻辑',
    checkedCount: 2,
  },
  {
    templateId: 'tpl-4',
    name: '示例 · 循迹小车（挑战）',
    notes: '传感器 + 电机，让作品第一次"动起来"。',
    description:
      '用红外传感器识别地面黑线，通过电机驱动让小车沿线行驶。\n'
      + '这个示例的重点是"调试"：速度、传感器阈值、轮子差速都要一点点试，'
      + '做完你会有一套自己的调参方法。',
    features: '传感器判线与阈值调试\n电机驱动与转向控制\n电池供电与走线整理\n学会分步调试而不是一次写到底',
    checkedCount: 1,
  },
];
