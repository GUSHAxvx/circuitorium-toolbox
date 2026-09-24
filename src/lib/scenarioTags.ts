// 适用场景推导：纯函数，浏览器与服务器都能用（不要在这里引入 fs/path 等 Node 模块）

const SCENARIO_MAP: Array<[RegExp, string]> = [
  [/温度|湿度|传感|sensor/i, '环境监测'],
  [/单片机|mcu|stm32|arduino|8051|51/i, '教学实验'],
  [/电源|稳压|电池|power|dcdc/i, '电源实验'],
  [/电机|驱动|舵机|motor|继电器/i, '机电控制'],
  [/显示|lcd|oled|屏幕|数码管/i, '人机交互'],
  [/通信|无线|蓝牙|wifi|esp|射频/i, '物联网通信'],
];

/** 由元器件类型推导「适用场景」标签（纯展示） */
export function deriveScenarioTags(componentTypes: string[]): string[] {
  const tags: string[] = [];
  for (const [pattern, label] of SCENARIO_MAP) {
    if (componentTypes.some((t) => pattern.test(t)) && !tags.includes(label)) {
      tags.push(label);
    }
  }
  if (tags.length === 0) tags.push('电子制作');
  return tags.slice(0, 3);
}
