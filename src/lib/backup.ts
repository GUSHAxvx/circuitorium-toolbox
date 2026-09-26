// 工具箱备份与恢复：把本机全部作品 + 自己加的元件打成一个 zip，换电脑/清理浏览器前先存一份

import { zipSync, unzipSync } from 'fflate';
import { getStore } from '@/lib/store';
import { importEcpToStore } from '@/lib/ecp/io';
import { buildEcpBytes } from '@/lib/share/standalone';
import { safeFileName, isSafeEntryName, sniffImageMime, extForMime } from '@/lib/ecp/format';

const BACKUP_FORMAT = 'circuitorium.toolbox-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_ENTRIES = 500;
const MAX_BACKUP_BYTES = 512 * 1024 * 1024; // 512MB 上限，防止异常文件

export interface BackupResult {
  blob: Blob;
  filename: string;
  projectCount: number;
  /** 备份里带走的自己加的元件个数（内置元件不带，对方软件里本来就有） */
  libraryCount: number;
  bytes: number;
}

/** 打包本机全部作品：<作品名>.ecp + manifest.json */
export async function createToolboxBackup(): Promise<BackupResult> {
  const store = getStore();
  const projects = await store.listProjects();

  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  const index: Array<{ file: string; name: string; components: number; sections: number; images: number; updatedAt: string }> = [];
  const used = new Set<string>();

  for (const summary of projects) {
    const bundle = await store.getProject(summary.id);
    if (!bundle) continue;

    const { bytes } = await buildEcpBytes(bundle, '');
    // 同名作品加序号，避免互相覆盖
    const base = safeFileName(summary.name);
    let file = `${base}.ecp`;
    let n = 2;
    while (used.has(file)) { file = `${base} (${n}).ecp`; n += 1; }
    used.add(file);

    files[file] = [bytes, { level: 0 }];
    index.push({
      file,
      name: summary.name,
      components: bundle.components.length,
      sections: bundle.sections.length,
      images: bundle.images.length,
      updatedAt: summary.updatedAt,
    });
  }

  // ===== 自己加的元件也一起备份 =====
  // 内置元件不带（对方软件里本来就有）；带的是用户自建 / 识别来的 / 别人传给他的那些，
  // 包含完整定义和图片，恢复时按同 id 去重合并进本地元件库。
  const library = await store.listLibrary();
  const mine = library.filter((c) => c.source !== 'builtin');
  const libComponents: Array<Record<string, unknown>> = [];
  for (const c of mine) {
    let imagePath: string | undefined;
    const url = c.imageUrl || '';
    if (url.startsWith('blob:')) {
      try {
        const blob = await fetch(url).then((r) => r.blob());
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const mime = sniffImageMime(bytes) || blob.type || 'image/png';
        imagePath = `library/${safeFileName(c.id)}.${extForMime(mime)}`;
        files[imagePath] = [bytes, { level: 0 }];
      } catch {
        // 单张图读不到就不带它，元件本身照样备份
      }
    }
    libComponents.push({
      id: c.id,
      name: c.name,
      aliases: c.aliases || [],
      category: c.category,
      purpose: c.purpose,
      appearance: c.appearance,
      polarity: c.polarity,
      commonModels: c.commonModels || [],
      commonMistakes: c.commonMistakes || [],
      howToRead: c.howToRead,
      usedInProjects: c.usedInProjects || [],
      tags: c.tags || [],
      pinCount: c.pinCount || 0,
      package: c.package || '',
      family: c.family || '',
      specs: c.specs || {},
      image: imagePath || '',
      author: c.author || '',
      source: c.source,
      createdAt: c.createdAt || '',
    });
  }
  if (libComponents.length > 0) {
    files['library.json'] = [
      new TextEncoder().encode(JSON.stringify({ version: 1, components: libComponents }, null, 2)),
      { level: 6 },
    ];
  }

  const manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    projectCount: index.length,
    libraryCount: libComponents.length,
    projects: index,
    note: '这是 CIRCUITORIUM 工具箱的整机备份，用「从备份恢复」即可一次性找回全部作品和自己加的元件。备份里不含任何识别凭据或本机设置。',
  };
  files['manifest.json'] = [new TextEncoder().encode(JSON.stringify(manifest, null, 2)), { level: 6 }];

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped as unknown as BlobPart], { type: 'application/zip' });
  const stamp = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  const filename = `工具箱备份-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.zip`;

  return { blob, filename, projectCount: index.length, libraryCount: libComponents.length, bytes: blob.size };
}

export interface RestoreResult {
  restored: number;
  skipped: number;
  /** 从备份里收进元件库的元件个数（新的才计数，已有的跳过） */
  libraryRestored: number;
  warnings: string[];
}

/** 从备份恢复：逐个作品导入（每个都走作品文件那套校验） */
export async function restoreToolboxBackup(file: Blob): Promise<RestoreResult> {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error('备份文件过大，无法恢复');
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('打不开这个备份文件，可能不是工具箱备份或已损坏');
  }

  const names = Object.keys(entries);
  if (names.length === 0) throw new Error('备份文件里没有内容');
  if (names.length > MAX_BACKUP_ENTRIES) throw new Error('备份文件条目过多，已拒绝');

  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) throw new Error('这不是工具箱备份文件（缺少说明文件）');
  try {
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as { format?: string };
    if (manifest.format !== BACKUP_FORMAT) throw new Error('格式不符');
  } catch {
    throw new Error('这不是工具箱备份文件');
  }

  let restored = 0;
  let skipped = 0;
  let libraryRestored = 0;
  const warnings: string[] = [];

  for (const name of names) {
    if (!name.endsWith('.ecp') || !isSafeEntryName(name)) continue;
    try {
      const bytes = entries[name];
      await importEcpToStore(new Blob([bytes as unknown as BlobPart], { type: 'application/zip' }));
      restored += 1;
    } catch (e) {
      skipped += 1;
      if (warnings.length < 3) warnings.push(`${name}：${e instanceof Error ? e.message : '无法恢复'}`);
    }
  }

  // ===== 元件库（备份里带的那些自定义元件）=====
  const libBytes = entries['library.json'];
  if (libBytes) {
    try {
      const raw = JSON.parse(new TextDecoder().decode(libBytes)) as {
        components?: Array<Record<string, unknown>>;
      };
      const items = (raw.components || []).slice(0, 200).map((c) => {
        let image: Blob | null = null;
        const imagePath = typeof c.image === 'string' ? c.image : '';
        if (imagePath && isSafeEntryName(imagePath)) {
          const bytes = entries[imagePath];
          const mime = bytes ? sniffImageMime(bytes) : null;
          if (bytes && mime) image = new Blob([bytes as unknown as BlobPart], { type: mime });
        }
        const id = typeof c.id === 'string' ? c.id : '';
        const name = typeof c.name === 'string' ? c.name : '';
        if (!id || !name) return null;
        return {
          id,
          name,
          aliases: Array.isArray(c.aliases) ? (c.aliases as string[]) : [],
          category: typeof c.category === 'string' ? c.category : '模块',
          purpose: typeof c.purpose === 'string' ? c.purpose : '',
          appearance: typeof c.appearance === 'string' ? c.appearance : '',
          polarity: typeof c.polarity === 'string' ? c.polarity : '',
          commonModels: Array.isArray(c.commonModels) ? (c.commonModels as string[]) : [],
          commonMistakes: Array.isArray(c.commonMistakes) ? (c.commonMistakes as string[]) : [],
          howToRead: typeof c.howToRead === 'string' ? c.howToRead : '',
          usedInProjects: Array.isArray(c.usedInProjects) ? (c.usedInProjects as string[]) : [],
          tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
          pinCount: typeof c.pinCount === 'number' ? c.pinCount : 0,
          package: typeof c.package === 'string' ? c.package : '',
          family: typeof c.family === 'string' ? c.family : '',
          specs: (c.specs && typeof c.specs === 'object' ? c.specs : {}) as Record<string, string>,
          image,
          source: 'imported' as const,
          author: typeof c.author === 'string' ? c.author : '',
        };
      }).filter((x): x is NonNullable<typeof x> => !!x);

      if (items.length > 0) {
        const res = await getStore().importLibraryComponents(items, '备份恢复');
        libraryRestored = res.added.length;
        if (res.skipped.length > 0) {
          warnings.push(`${res.skipped.length} 个元件你这里已经有了，保留了本地的版本`);
        }
      }
    } catch {
      warnings.push('备份里的元件库读不出来，已跳过（作品不受影响）');
    }
  }

  return { restored, skipped, libraryRestored, warnings };
}
