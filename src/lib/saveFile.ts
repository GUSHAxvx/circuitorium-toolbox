// 保存文件：桌面版（Tauri）弹系统原生「另存为」，浏览器版走普通下载。
//
// 背景：WebView2 里 <a download> 不会真的落盘（没有浏览器下载界面），
// 所以桌面版改调 Rust 侧的 save_work_file 命令；网页版保持原来的下载行为。

import { downloadBlob } from '@/lib/ecp/io';

export interface SaveResult {
  /** 是否真的保存了（用户取消时为 false） */
  ok: boolean;
  /** 保存位置的人话描述，用于提示文案 */
  where: string;
  /** 用户在对话框里点了取消 */
  cancelled?: boolean;
}

/** 当前是不是跑在桌面版（Tauri）里 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Blob → base64（分块，避免大文件把参数栈撑爆） */
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  if (isDesktopApp()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string | null>('save_work_file', {
      defaultName: filename,
      dataB64: await blobToBase64(blob),
    });
    if (!path) return { ok: false, cancelled: true, where: '' };
    // 只显示所在文件夹，别把整条路径糊到提示里
    const dir = path.replace(/[\\/][^\\/]*$/, '');
    return { ok: true, where: dir || path };
  }
  downloadBlob(blob, filename);
  return { ok: true, where: '浏览器的下载文件夹' };
}
