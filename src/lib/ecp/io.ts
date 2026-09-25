// .ecp 作品文件的读写（浏览器端）：用 fflate 打包/解包，全程本地，不经过服务器

import { zipSync, unzipSync } from 'fflate';
import { getStore } from '@/lib/store';
import type { ImportedBundle, LibraryComponentInput, ProjectBundle } from '@/lib/store';
import {
  ECP_FORMAT,
  ECP_LIMITS,
  ECP_VERSION,
  extForMime,
  isExpectedEntry,
  isSafeEntryName,
  normalizeCode,
  normalizeComponents,
  normalizeImages,
  normalizeSections,
  normalizeSnapshot,
  safeFileName,
  sniffImageMime,
  validateManifest,
  type EcpImageMeta,
  type EcpLibraryEntry,
  type EcpLibrarySnapshot,
  type EcpManifest,
} from './format';

const APP_VERSION = '1.0';

export interface EcpExportResult {
  blob: Blob;
  filename: string;
  warnings: string[];
}

export interface EcpImportResult {
  projectId: string;
  name: string;
  author: string;
  counts: { components: number; sections: number; images: number };
  /** 作品里带来的新元件，**还没写入**：等用户点「全部加入我的元件库」再存 */
  libraryPending?: LibraryComponentInput[];
  /** 作品里带的元件本地已经有了（同 id，保留本地版本） */
  libraryAlready?: { id: string; name: string }[];
  warnings: string[];
}

const blobToBytes = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

const textBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/** 生成封面缩略图（失败就跳过，不影响导出） */
async function makeThumbnail(source: Blob): Promise<Uint8Array | null> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    const bitmap = await createImageBitmap(source);
    const max = 320;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72));
    if (!blob) return null;
    return await blobToBytes(blob);
  } catch {
    return null;
  }
}

/** 把项目打包成 .ecp 作品文件（不含任何设置 / 密钥） */
export async function exportProjectToEcp(projectId: string, authorName = ''): Promise<EcpExportResult> {
  const store = getStore();
  const bundle: ProjectBundle | null = await store.getProject(projectId);
  if (!bundle) throw new Error('项目不存在');

  const warnings: string[] = [];
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};

  const manifest: EcpManifest = {
    format: ECP_FORMAT,
    version: ECP_VERSION,
    createdAt: new Date().toISOString(),
    app: { name: 'CIRCUITORIUM 工具箱', version: APP_VERSION },
    project: {
      name: bundle.project.name,
      notes: bundle.project.notes,
      description: bundle.project.description,
      features: bundle.project.features,
      author: authorName || bundle.project.source?.author || '',
      createdAt: bundle.project.createdAt,
      updatedAt: bundle.project.updatedAt,
    },
    counts: {
      components: bundle.components.length,
      sections: bundle.sections.length,
      images: bundle.images.length,
      code: bundle.codeFiles?.length || 0,
    },
    difficulty: bundle.project.difficulty === 'bankai' ? 'bankai' : 'shikai',
    ...(bundle.project.codeNote ? { codeNote: bundle.project.codeNote } : {}),
    // 明确声明：作品文件里没有本机设置与凭据（用中文写，方便人直接看文件）
    excludes: ['本机设置', '识别凭据', '访问令牌', '本机文件路径'],
  };

  const imageMetas: EcpImageMeta[] = [];
  let index = 0;
  for (const img of bundle.images) {
    try {
      const bytes = await blobToBytes(img.blob);
      if (bytes.byteLength > ECP_LIMITS.maxSingleBytes) {
        warnings.push(`有一张图片超过 ${Math.round(ECP_LIMITS.maxSingleBytes / 1024 / 1024)}MB，已跳过`);
        continue;
      }
      const mime = sniffImageMime(bytes) || img.mime || 'image/jpeg';
      const file = `images/${index}.${extForMime(mime)}`;
      files[file] = [bytes, { level: 0 }]; // 图片本身已压缩，不再二次压缩
      imageMetas.push({ file, kind: img.kind, description: img.description, mime });
      index += 1;
    } catch {
      warnings.push('有一张图片读取失败，已跳过');
    }
  }

  // 封面缩略图
  const firstImage = bundle.images[0];
  if (firstImage) {
    const thumb = await makeThumbnail(firstImage.blob);
    if (thumb) files['thumbnail.jpg'] = [thumb, { level: 0 }];
    else warnings.push('缩略图生成失败（不影响作品内容）');
  }

  files['manifest.json'] = [textBytes(JSON.stringify(manifest, null, 2)), { level: 6 }];
  files['components.json'] = [
    textBytes(JSON.stringify(
      bundle.components.map((c) => ({
        name: c.name, type: c.type, model: c.model, manufacturer: c.manufacturer,
        packageType: c.packageType, pinCount: c.pinCount, specifications: c.specifications,
        description: c.description, annotation: c.annotation, quantity: c.quantity,
        checked: c.checked, confidence: c.confidence, sortOrder: c.sortOrder,
        ...(c.libraryId ? { libraryId: c.libraryId } : {}),
      })), null, 2)),
    { level: 6 },
  ];
  files['sections.json'] = [
    textBytes(JSON.stringify(
      bundle.sections.map((s) => ({ type: s.type, title: s.title, content: s.content, sortOrder: s.sortOrder })),
      null, 2)),
    { level: 6 },
  ];
  files['images.json'] = [textBytes(JSON.stringify(imageMetas, null, 2)), { level: 6 }];

  // ===== 程序代码（卍解项目）：跟着作品一起走，别人打开就能看、能抄、能改 =====
  const codeFiles = bundle.codeFiles || [];
  if (codeFiles.length > 0) {
    files['code.json'] = [
      textBytes(JSON.stringify(
        codeFiles.map((c) => ({
          name: c.name, language: c.language, content: c.content, note: c.note, sortOrder: c.sortOrder,
        })), null, 2)),
      { level: 6 },
    ];
  }

  // ===== 元件快照：作品用到的元件库里那些"不是内置"的元件，跟着作品走 =====
  // 内置元件只写引用（对方软件里本来就有）；用户自建 / 识别来的 / 别人传来的写完整定义 + 图片。
  const snapshot = await buildLibrarySnapshot(projectId, files, warnings);
  if (snapshot.components.length > 0) {
    files['components_snapshot.json'] = [textBytes(JSON.stringify(snapshot, null, 2)), { level: 6 }];
  }

  files['README.txt'] = [
    textBytes(
      `${bundle.project.name}\n\n`
      + `这是 CIRCUITORIUM 工具箱的作品文件（.ecp）。\n`
      + `用工具箱里的「打开作品」选择这个文件即可查看，并可一键做成自己的版本。\n`
      + `作者：${manifest.project.author || '未署名'}\n`
      + `元件 ${manifest.counts.components} 个 · 教程 ${manifest.counts.sections} 节 · 图片 ${manifest.counts.images} 张\n`
      + (codeFiles.length > 0 ? `程序代码 ${codeFiles.length} 个（${codeFiles.map((c) => c.name).join('、')}）\n` : '')
      + (manifest.difficulty === 'bankai' ? '这是「卍解」难度的作品：要写代码。\n' : '')
      + (snapshot.components.length > 0
        ? `作品里还带着 ${snapshot.components.filter((c) => c.source !== 'builtin').length} 个自定义元件，打开后可以收进自己的元件库。\n`
        : '')
      + `文件内不含任何账号、密钥或本机设置。\n`
    ),
    { level: 6 },
  ];

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped as unknown as BlobPart], { type: 'application/zip' });
  return { blob, filename: `${safeFileName(bundle.project.name)}.ecp`, warnings };
}

/**
 * 收集作品用到的库元件，生成快照。
 * - 内置元件：只写 { id, source:'builtin', ref }，不重复存数据
 * - 其他来源：写完整定义；有图的话把图也塞进 zip（images/lib_<id>.<ext>）
 *
 * 导出作品文件与生成分享页都走这里，保证两条路带的东西一样。
 */
export async function buildLibrarySnapshot(
  projectId: string,
  files: Record<string, [Uint8Array, { level: 0 | 6 }]>,
  warnings: string[]
): Promise<EcpLibrarySnapshot> {
  const store = getStore();
  const bundle = await store.getProject(projectId);
  if (!bundle) return { version: 1, components: [] };

  const ids = [...new Set(bundle.components.map((c) => c.libraryId).filter((v): v is string => !!v))];
  if (ids.length === 0) return { version: 1, components: [] };

  const entries: EcpLibraryEntry[] = [];
  for (const id of ids) {
    const item = await store.getLibraryComponent(id);
    if (!item) continue; // 库里已经没有了，跳过

    if (item.source === 'builtin') {
      entries.push({ id: item.id, source: 'builtin', ref: `builtin:${item.id}` });
      continue;
    }

    let imagePath: string | undefined;
    const url = item.imageUrl || '';
    if (url.startsWith('blob:')) {
      try {
        const blob = await fetch(url).then((r) => r.blob());
        const bytes = await blobToBytes(blob);
        if (bytes.byteLength <= ECP_LIMITS.maxSingleBytes) {
          const mime = sniffImageMime(bytes) || blob.type || 'image/png';
          imagePath = `images/lib_${item.id}.${extForMime(mime)}`;
          files[imagePath] = [bytes, { level: 0 }];
        } else {
          warnings.push(`元件「${item.name}」的图片太大，没有带进作品`);
        }
      } catch {
        warnings.push(`元件「${item.name}」的图片读取失败，没有带进作品`);
      }
    }

    entries.push({
      id: item.id,
      source: item.source,
      name: item.name,
      aliases: item.aliases || [],
      category: item.category,
      purpose: item.purpose,
      appearance: item.appearance,
      polarity: item.polarity,
      commonModels: item.commonModels || [],
      commonMistakes: item.commonMistakes || [],
      howToRead: item.howToRead,
      usedInProjects: item.usedInProjects || [],
      tags: item.tags || [],
      pinCount: item.pinCount || 0,
      package: item.package || '',
      family: item.family || '',
      specs: item.specs || {},
      ...(imagePath ? { image: imagePath } : {}),
      author: item.author || '',
      createdAt: item.createdAt || '',
    });
  }

  return { version: 1, components: entries };
}

/** 打开 .ecp 作品文件，写入本机并返回新项目 id */
export async function importEcpToStore(file: Blob, fallbackAuthor = ''): Promise<EcpImportResult> {
  const warnings: string[] = [];

  if (file.size > ECP_LIMITS.maxTotalBytes) {
    throw new Error(`文件太大（超过 ${Math.round(ECP_LIMITS.maxTotalBytes / 1024 / 1024)}MB）`);
  }

  const bytes = await blobToBytes(file);

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('文件打不开，可能不是作品文件或已损坏');
  }

  const names = Object.keys(entries);
  if (names.length === 0) throw new Error('文件里没有内容');
  if (names.length > ECP_LIMITS.maxEntries) throw new Error('文件条目过多，已拒绝打开');

  // 先看总大小（任何解析之前），避免异常文件占满内存
  let total = 0;
  for (const name of names) {
    total += entries[name].byteLength;
    if (total > ECP_LIMITS.maxTotalBytes) throw new Error('解压后体积过大，已拒绝打开');
  }

  // 再看是不是我们的作品文件（先给明确提示，再谈结构是否合法）
  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) throw new Error('这不是 CIRCUITORIUM 作品文件');

  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    throw new Error('作品信息损坏，无法打开');
  }

  const validated = validateManifest(manifestRaw);
  if (!validated.ok) throw new Error(validated.error);
  const manifest = validated.manifest;

  // 结构校验收尾：条目名必须安全且是我们认识的（防目录穿越 / 绝对路径 / 夹带文件）
  for (const name of names) {
    if (!isSafeEntryName(name) || !isExpectedEntry(name)) {
      throw new Error('文件结构不正确，已拒绝打开');
    }
  }

  const parseJson = (name: string): unknown => {
    const raw = entries[name];
    if (!raw) return null;
    try {
      return JSON.parse(new TextDecoder().decode(raw));
    } catch {
      warnings.push(`${name} 解析失败，已忽略`);
      return null;
    }
  };

  const components = normalizeComponents(parseJson('components.json'));
  const sections = normalizeSections(parseJson('sections.json'));
  const imageMetas = normalizeImages(parseJson('images.json'));

  const images: ImportedBundle['images'] = [];
  for (const meta of imageMetas) {
    const raw = entries[meta.file];
    if (!raw) {
      warnings.push('有图片在文件里缺失，已跳过');
      continue;
    }
    if (raw.byteLength > ECP_LIMITS.maxSingleBytes) {
      warnings.push('有图片超过大小上限，已跳过');
      continue;
    }
    const mime = sniffImageMime(raw);
    if (!mime) {
      warnings.push('有文件不是有效图片，已跳过');
      continue;
    }
    images.push({
      kind: meta.kind,
      description: meta.description,
      mime,
      size: raw.byteLength,
      blob: new Blob([raw as unknown as BlobPart], { type: mime }),
      createdAt: manifest.project.createdAt || new Date().toISOString(),
    });
  }

  const store = getStore();
  const author = manifest.project.author || fallbackAuthor;
  const codeFiles = normalizeCode(parseJson('code.json'));
  const projectId = await store.importBundle({
    project: {
      name: manifest.project.name,
      notes: manifest.project.notes,
      description: manifest.project.description,
      features: manifest.project.features,
      source: { type: 'shared', author, ref: manifest.project.name, version: `v${manifest.version}` },
      difficulty: manifest.difficulty === 'bankai' ? 'bankai' : 'shikai',
      ...(manifest.codeNote ? { codeNote: manifest.codeNote } : {}),
      views: 0,
      remixCount: 0,
      createdAt: manifest.project.createdAt || new Date().toISOString(),
      updatedAt: manifest.project.updatedAt || new Date().toISOString(),
    },
    components: components.map((c) => ({
      name: c.name, type: c.type, model: c.model, manufacturer: c.manufacturer,
      packageType: c.packageType, pinCount: c.pinCount, specifications: c.specifications,
      description: c.description, annotation: c.annotation, quantity: c.quantity,
      checked: c.checked, confidence: c.confidence, sortOrder: c.sortOrder,
      ...(c.libraryId ? { libraryId: c.libraryId } : {}),
      createdAt: manifest.project.createdAt || new Date().toISOString(),
    })),
    sections: sections.map((s) => ({ type: s.type, title: s.title, content: s.content, sortOrder: s.sortOrder })),
    images,
    codeFiles: codeFiles.map((c) => ({
      name: c.name, language: c.language, content: c.content, note: c.note,
      sortOrder: c.sortOrder, createdAt: manifest.project.createdAt || new Date().toISOString(),
    })),
  });

  // ===== 作品里带来的自定义元件：先攒着，等用户确认再写入本地元件库 =====
  // （任务书要求：导入后弹提示，用户选"全部加入我的元件库"还是"只看项目"）
  const snapshot = normalizeSnapshot(parseJson('components_snapshot.json'));
  const carry = snapshot.components.filter((c) => c.source !== 'builtin');
  const libraryPending: LibraryComponentInput[] = [];
  const libraryAlready: { id: string; name: string }[] = [];
  if (carry.length > 0) {
    const existing = new Set((await store.listLibrary()).map((c) => c.id));
    for (const c of carry) {
      if (existing.has(c.id)) {
        libraryAlready.push({ id: c.id, name: c.name || c.id });
        continue;
      }
      let image: Blob | null = null;
      if (c.image) {
        const raw = entries[c.image];
        const mime = raw ? sniffImageMime(raw) : null;
        if (raw && mime && raw.byteLength <= ECP_LIMITS.maxSingleBytes) {
          image = new Blob([raw as unknown as BlobPart], { type: mime });
        } else if (raw) {
          warnings.push(`元件「${c.name || c.id}」的图片没有带进来`);
        }
      }
      libraryPending.push({
        id: c.id,
        name: c.name || c.id,
        aliases: c.aliases,
        category: c.category || '模块',
        purpose: c.purpose || '',
        appearance: c.appearance || '',
        polarity: c.polarity || '',
        commonModels: c.commonModels,
        commonMistakes: c.commonMistakes,
        howToRead: c.howToRead || '',
        usedInProjects: c.usedInProjects,
        tags: c.tags,
        pinCount: c.pinCount,
        package: c.package,
        family: c.family,
        specs: c.specs,
        image,
        source: 'imported',
        author: c.author || author,
      });
    }
  }

  return {
    projectId,
    name: manifest.project.name,
    author,
    counts: { components: components.length, sections: sections.length, images: images.length },
    libraryPending,
    libraryAlready,
    warnings,
  };
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
