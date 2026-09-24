// .ecp 作品文件格式定义与校验（纯逻辑，浏览器与 Node 都能用）
//
// 文件结构（zip）：
//   manifest.json          作品信息（格式版本、作者、统计、明确声明不含密钥）
//   components.json        元件清单
//   sections.json          图文教程小节
//   images.json            图片索引（文件名 / 分类 / 说明）
//   images/<n>.<ext>       图片二进制
//   thumbnail.jpg          封面缩略图（可选）
//   README.txt             给人看的说明（用工具箱打开）

export const ECP_FORMAT = 'circuitorium.ecp';
export const ECP_VERSION = 1;
export const ECP_EXT = '.ecp';

/** 安全上限：防止恶意/损坏文件把内存和磁盘打满 */
export const ECP_LIMITS = {
  maxEntries: 300,
  maxTotalBytes: 64 * 1024 * 1024, // 解压后总大小 64MB
  maxSingleBytes: 16 * 1024 * 1024, // 单张图片 16MB
  maxTextLength: 4000,
  maxComponents: 200,
  maxSections: 200,
  maxImages: 100,
  maxNameLength: 120,
};

export type EcpImageKind = 'schematic' | 'circuit' | 'wiring' | 'photo';

export const ECP_IMAGE_KINDS: EcpImageKind[] = ['schematic', 'circuit', 'wiring', 'photo'];

export interface EcpManifest {
  format: typeof ECP_FORMAT;
  version: number;
  createdAt: string;
  app: { name: string; version: string };
  project: {
    name: string;
    notes: string;
    description: string;
    features: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  };
  counts: { components: number; sections: number; images: number };
  /** 明确记录：作品文件不包含任何本机设置与密钥 */
  excludes: string[];
}

export interface EcpComponent {
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  packageType: string;
  pinCount: number;
  specifications: string;
  description: string;
  annotation: string;
  quantity: number;
  checked: boolean;
  confidence: number;
  sortOrder: number;
}

export interface EcpSection {
  type: 'step' | 'note';
  title: string;
  content: string;
  sortOrder: number;
}

export interface EcpImageMeta {
  file: string;
  kind: EcpImageKind;
  description: string;
  mime: string;
}

/** 判断某个 zip 条目名是否安全（防目录穿越 / 绝对路径 / 反斜杠） */
export function isSafeEntryName(name: string): boolean {
  if (!name || name.length > 200) return false;
  if (name.includes('\\')) return false;
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false;
  const parts = name.split('/');
  if (parts.some((p) => p === '..' || p === '.' || p === '')) return false;
  return true;
}

/** 只允许我们认识的条目名 */
export function isExpectedEntry(name: string): boolean {
  if (['manifest.json', 'components.json', 'sections.json', 'images.json', 'thumbnail.jpg', 'README.txt'].includes(name)) {
    return true;
  }
  return /^images\/[A-Za-z0-9._-]+$/.test(name);
}

// 文本/数字清洗统一放在 @/lib/sanitize（作品文件与 AI 返回共用）
import { clampText, clampInt, clampFloat } from '@/lib/sanitize';
export { clampText, clampInt, clampFloat };

export function normalizeImageKind(value: unknown): EcpImageKind {
  return ECP_IMAGE_KINDS.includes(value as EcpImageKind) ? (value as EcpImageKind) : 'photo';
}
/** 校验 manifest，返回可用的 manifest 或错误原因 */
export function validateManifest(raw: unknown): { ok: true; manifest: EcpManifest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '作品信息缺失或格式不正确' };
  const m = raw as Partial<EcpManifest>;

  if (m.format !== ECP_FORMAT) return { ok: false, error: '这不是 CIRCUITORIUM 作品文件' };
  const version = clampInt(m.version, 1, 999, 0);
  if (version < 1) return { ok: false, error: '作品文件版本无法识别' };
  if (version > ECP_VERSION) {
    return { ok: false, error: `这个作品由更新版本的工具箱保存（v${version}），请升级后再打开` };
  }

  const p = (m.project || {}) as Partial<EcpManifest['project']>;
  const name = clampText(p.name, ECP_LIMITS.maxNameLength).trim();
  if (!name) return { ok: false, error: '作品没有名称' };

  return {
    ok: true,
    manifest: {
      format: ECP_FORMAT,
      version,
      createdAt: clampText(m.createdAt, 40) || new Date().toISOString(),
      app: {
        name: clampText((m.app || {}).name, 40) || 'CIRCUITORIUM',
        version: clampText((m.app || {}).version, 20) || '1',
      },
      project: {
        name,
        notes: clampText(p.notes),
        description: clampText(p.description),
        features: clampText(p.features),
        author: clampText(p.author, 60),
        createdAt: clampText(p.createdAt, 40),
        updatedAt: clampText(p.updatedAt, 40),
      },
      counts: {
        components: clampInt((m.counts || {}).components, 0, ECP_LIMITS.maxComponents, 0),
        sections: clampInt((m.counts || {}).sections, 0, ECP_LIMITS.maxSections, 0),
        images: clampInt((m.counts || {}).images, 0, ECP_LIMITS.maxImages, 0),
      },
      excludes: Array.isArray(m.excludes) ? m.excludes.filter((x) => typeof x === 'string').slice(0, 20) : [],
    },
  };
}

export function normalizeComponents(raw: unknown): EcpComponent[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, ECP_LIMITS.maxComponents).map((item, i) => {
    const c = (item || {}) as Partial<EcpComponent>;
    return {
      name: clampText(c.name, ECP_LIMITS.maxNameLength).trim() || '未命名元件',
      type: clampText(c.type, 80),
      model: clampText(c.model, 80),
      manufacturer: clampText(c.manufacturer, 80),
      packageType: clampText(c.packageType, 60),
      pinCount: clampInt(c.pinCount, 0, 2000, 0),
      specifications: clampText(c.specifications, 200),
      description: clampText(c.description, 600),
      annotation: clampText(c.annotation, 600),
      quantity: clampInt(c.quantity, 1, 9999, 1),
      checked: Boolean(c.checked),
      confidence: clampFloat(c.confidence, 0, 1, 0),
      sortOrder: clampInt(c.sortOrder, 0, 9999, i),
    };
  });
}

export function normalizeSections(raw: unknown): EcpSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, ECP_LIMITS.maxSections).map((item, i) => {
    const s = (item || {}) as Partial<EcpSection>;
    return {
      type: s.type === 'note' ? 'note' : 'step',
      title: clampText(s.title, ECP_LIMITS.maxNameLength).trim() || `第 ${i + 1} 节`,
      content: clampText(s.content, ECP_LIMITS.maxTextLength * 2),
      sortOrder: clampInt(s.sortOrder, 0, 9999, i),
    };
  });
}

export function normalizeImages(raw: unknown): EcpImageMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, ECP_LIMITS.maxImages)
    .map((item) => {
      const img = (item || {}) as Partial<EcpImageMeta>;
      const file = typeof img.file === 'string' ? img.file : '';
      return {
        file,
        kind: normalizeImageKind(img.kind),
        description: clampText(img.description, 300),
        mime: clampText(img.mime, 60) || 'image/jpeg',
      };
    })
    .filter((img) => img.file.startsWith('images/') && isSafeEntryName(img.file) && isExpectedEntry(img.file));
}

/** 按 magic bytes 判断图片真实类型，防止伪装扩展名 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  return null;
}

export function extForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  return 'jpg';
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim();
  return (cleaned || '作品').slice(0, 60);
}
