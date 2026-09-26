// 存储入口：界面统一通过 getStore() 取数据源
// 现在只有 IndexedDB 实现；Tauri 版启动时用 setStore() 换成 SQLite 实现即可

import { localStore } from './local';
import type { ToolboxStore } from './types';

let current: ToolboxStore = localStore;

export function setStore(next: ToolboxStore): void {
  current = next;
}

export function getStore(): ToolboxStore {
  return current;
}

// 开发期为验证脚本留一个入口（工具/browser-check.cjs 直接调存储层做断言，见 工具/checks/）。
// 生产构建里 NODE_ENV 是 'production'，这段会被去掉，正式包没有这个后门。
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __toolboxStore?: ToolboxStore }).__toolboxStore = current;
}

export * from './types';
