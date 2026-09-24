// AI 配置：三种模式，默认「手动录入」——不配任何东西也能完整使用工具箱
//
//   manual        手动录入元件（默认，永远可用）
//   local-key     自己填 Key（只存在本机，不上传、不写进作品文件）
//   teacher-code  老师生成的配置码（里面只有代理地址 + 访问令牌 + 模型名，没有真 Key）

import { getStore } from '@/lib/store';
import { clampText } from '@/lib/sanitize';

export type AiMode = 'manual' | 'local-key' | 'teacher-code';

export interface AiConfig {
  mode: AiMode;
  /** OpenAI 兼容地址，例如 https://dashscope.aliyuncs.com/compatible-mode/v1 或老师的代理地址 */
  baseUrl: string;
  /** 本机 Key（仅 local-key 模式使用） */
  apiKey: string;
  model: string;
  /** 老师配置码里的访问令牌（不是真 Key） */
  proxyToken: string;
}

export const AI_SETTING_KEY = 'ai_config';

export const DEFAULT_AI_CONFIG: AiConfig = {
  mode: 'manual',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: '',
  model: 'qwen3-vl-plus',
  proxyToken: '',
};

/** 老师配置码前缀，便于识别与升级 */
const CODE_PREFIX = 'CT1-';

export interface TeacherCodePayload {
  /** 代理地址（Cloudflare Worker 等） */
  u: string;
  /** 访问令牌（Worker 侧校验，可随时吊销） */
  t: string;
  /** 模型名 */
  m: string;
}

const base64UrlEncode = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlDecode = (text: string): string => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/** 生成老师配置码（不含真 Key，可以安全地发到群里/做成二维码） */
export function encodeTeacherCode(payload: TeacherCodePayload): string {
  const clean: TeacherCodePayload = {
    u: payload.u.trim().replace(/\/+$/, ''),
    t: payload.t.trim(),
    m: payload.m.trim() || 'qwen3-vl-plus',
  };
  return CODE_PREFIX + base64UrlEncode(JSON.stringify(clean));
}

/** 解析老师配置码；不合法返回 null */
export function decodeTeacherCode(code: string): TeacherCodePayload | null {
  const raw = code.trim();
  if (!raw.startsWith(CODE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(raw.slice(CODE_PREFIX.length))) as Partial<TeacherCodePayload>;
    const u = clampText(parsed.u, 300).trim();
    if (!/^https?:\/\//i.test(u)) return null;
    return {
      u,
      t: clampText(parsed.t, 200).trim(),
      m: clampText(parsed.m, 80).trim() || 'qwen3-vl-plus',
    };
  } catch {
    return null;
  }
}

export function normalizeConfig(raw: Partial<AiConfig> | null | undefined): AiConfig {
  const mode: AiMode = raw?.mode === 'local-key' || raw?.mode === 'teacher-code' ? raw.mode : 'manual';
  return {
    mode,
    baseUrl: clampText(raw?.baseUrl, 300).trim() || DEFAULT_AI_CONFIG.baseUrl,
    apiKey: clampText(raw?.apiKey, 300).trim(),
    model: clampText(raw?.model, 80).trim() || DEFAULT_AI_CONFIG.model,
    proxyToken: clampText(raw?.proxyToken, 300).trim(),
  };
}

/** 读取本机 AI 配置（存在本地库里，不上传） */
export async function loadAiConfig(): Promise<AiConfig> {
  const store = getStore();
  const saved = await store.getSetting(AI_SETTING_KEY);
  if (!saved) return { ...DEFAULT_AI_CONFIG };
  try {
    return normalizeConfig(JSON.parse(saved) as Partial<AiConfig>);
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  const store = getStore();
  const clean = normalizeConfig(config);
  if (clean.mode === 'manual') {
    // 手动模式：不保留任何凭据
    await store.setSetting(AI_SETTING_KEY, JSON.stringify({ ...clean, apiKey: '', proxyToken: '' }));
    return;
  }
  await store.setSetting(AI_SETTING_KEY, JSON.stringify(clean));
}

/** 当前配置能否发起识别 */
export function isAiReady(config: AiConfig): boolean {
  if (config.mode === 'manual') return false;
  if (!config.baseUrl) return false;
  if (config.mode === 'local-key') return !!config.apiKey;
  return !!config.proxyToken || !!config.apiKey;
}

/** 对外展示的状态文案（不暴露任何凭据） */
export function describeAiMode(config: AiConfig): string {
  if (config.mode === 'manual') return '手动录入';
  if (config.mode === 'local-key') return '本机配置';
  return '老师配置码';
}
