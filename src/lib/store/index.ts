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

export * from './types';
