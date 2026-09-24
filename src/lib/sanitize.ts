// 通用清洗与限幅：外来数据（作品文件、AI 返回）都要先过这里

export const SANITIZE_LIMITS = {
  maxTextLength: 4000,
  maxNameLength: 120,
};

export function clampText(value: unknown, max = SANITIZE_LIMITS.maxTextLength): string {
  if (typeof value !== 'string') return '';
  // 去掉控制字符（除换行/制表），长度截断，避免异常内容进入界面
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 从可能带 markdown 包裹的文本里抽出 JSON（AI 返回常见情况） */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(body.lastIndexOf(']'), body.lastIndexOf('}'));
  if (end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}
