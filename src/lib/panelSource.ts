// 卍解面板的数据源适配器
//
// 同一个「程序代码 / 接线表 / 调试记录」面板，两种后端：
//   - 本地版：IndexedDB（getStore()）
//   - 服务器版：/api/projects/[id]/code|pins|debug
// 面板只认这个接口，不关心数据存在哪。

import { getStore } from '@/lib/store';
import { authHeaders } from '@/lib/client';
import type { ToolboxCodeFile, ToolboxDebugNote, ToolboxPinRow } from '@/lib/store/types';

export interface BankaiSource {
  listCode(): Promise<ToolboxCodeFile[]>;
  addCode(input: { name: string; content: string; note: string; group?: string; encoding?: string }): Promise<void>;
  renameCode(id: string, name: string): Promise<void>;
  removeCode(id: string): Promise<void>;

  listPins(): Promise<ToolboxPinRow[]>;
  addPin(input: { module: string; pin: string; boardPin: string; note: string }): Promise<void>;
  patchPin(id: string, patch: Partial<Pick<ToolboxPinRow, 'module' | 'pin' | 'boardPin' | 'note'>>): Promise<void>;
  removePin(id: string): Promise<void>;

  listDebug(): Promise<ToolboxDebugNote[]>;
  addDebug(input: { problem: string; solution: string }): Promise<void>;
  removeDebug(id: string): Promise<void>;

  /** 开发环境说明存在项目本身上 */
  saveCodeNote(text: string): Promise<void>;
}

// ===== 本地版（IndexedDB）=====
export function localBankaiSource(projectId: string): BankaiSource {
  return {
    listCode: () => getStore().listCodeFiles(projectId),
    addCode: async (input) => { await getStore().addCodeFile(projectId, input); },
    renameCode: async (id, name) => { await getStore().updateCodeFile(id, { name }); },
    removeCode: async (id) => { await getStore().removeCodeFile(id); },

    listPins: () => getStore().listPinRows(projectId),
    addPin: async (input) => { await getStore().addPinRow(projectId, input); },
    patchPin: async (id, patch) => { await getStore().updatePinRow(id, patch); },
    removePin: async (id) => { await getStore().removePinRow(id); },

    listDebug: () => getStore().listDebugNotes(projectId),
    addDebug: async (input) => { await getStore().addDebugNote(projectId, input); },
    removeDebug: async (id) => { await getStore().removeDebugNote(id); },

    saveCodeNote: async (text) => { await getStore().updateProject(projectId, { codeNote: text }); },
  };
}

// ===== 服务器版（SQLite + API）=====
interface ServerCodeRow {
  id: number; name: string; language: string; group_name: string;
  content: string; note: string; encoding: string; sort_order: number; created_at: string;
}
interface ServerPinRow {
  id: number; module: string; pin: string; board_pin: string;
  note: string; sort_order: number; created_at: string;
}
interface ServerDebugRow {
  id: number; problem: string; solution: string; sort_order: number; created_at: string;
}

export function serverBankaiSource(projectId: string | number): BankaiSource {
  const base = `/api/projects/${projectId}`;

  async function call(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || '操作失败');
    return data as Record<string, unknown>;
  }

  const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
  const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) });

  return {
    listCode: async () => {
      const data = await call('/code');
      return ((data.codeFiles as ServerCodeRow[]) || []).map((row) => ({
        id: String(row.id),
        projectId: String(projectId),
        name: row.name,
        language: row.language || '',
        group: row.group_name || '',
        content: row.content || '',
        note: row.note || '',
        encoding: row.encoding || 'utf-8',
        sortOrder: row.sort_order || 0,
        createdAt: row.created_at,
      }));
    },
    addCode: async (input) => { await call('/code', json(input)); },
    renameCode: async (id, name) => { await call(`/code/${id}`, patch({ name })); },
    removeCode: async (id) => { await call(`/code/${id}`, { method: 'DELETE' }); },

    listPins: async () => {
      const data = await call('/pins');
      return ((data.pinRows as ServerPinRow[]) || []).map((row) => ({
        id: String(row.id),
        projectId: String(projectId),
        module: row.module || '',
        pin: row.pin || '',
        boardPin: row.board_pin || '',
        note: row.note || '',
        sortOrder: row.sort_order || 0,
        createdAt: row.created_at,
      }));
    },
    addPin: async (input) => { await call('/pins', json(input)); },
    patchPin: async (id, p) => {
      await call(`/pins/${id}`, patch({
        module: p.module, pin: p.pin, boardPin: p.boardPin, note: p.note,
      }));
    },
    removePin: async (id) => { await call(`/pins/${id}`, { method: 'DELETE' }); },

    listDebug: async () => {
      const data = await call('/debug');
      return ((data.debugNotes as ServerDebugRow[]) || []).map((row) => ({
        id: String(row.id),
        projectId: String(projectId),
        problem: row.problem || '',
        solution: row.solution || '',
        sortOrder: row.sort_order || 0,
        createdAt: row.created_at,
      }));
    },
    addDebug: async (input) => { await call('/debug', json(input)); },
    removeDebug: async (id) => { await call(`/debug/${id}`, { method: 'DELETE' }); },

    // 项目本身用 PUT（见 app/api/projects/[id]/route.ts 的 PUT）
    saveCodeNote: async (text) => {
      await call('', { method: 'PUT', body: JSON.stringify({ codeNote: text }) });
    },
  };
}
