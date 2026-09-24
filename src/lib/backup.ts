// 工具箱备份与恢复：把本机全部作品打成一个 zip，换电脑/清理浏览器前先存一份

import { zipSync, unzipSync } from 'fflate';
import { getStore } from '@/lib/store';
import { importEcpToStore } from '@/lib/ecp/io';
import { buildEcpBytes } from '@/lib/share/standalone';
import { safeFileName, isSafeEntryName } from '@/lib/ecp/format';

const BACKUP_FORMAT = 'circuitorium.toolbox-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_ENTRIES = 500;
const MAX_BACKUP_BYTES = 512 * 1024 * 1024; // 512MB 上限，防止异常文件

export interface BackupResult {
  blob: Blob;
  filename: string;
  projectCount: number;
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

  const manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    projectCount: index.length,
    projects: index,
    note: '这是 CIRCUITORIUM 工具箱的整机备份，用「从备份恢复」即可一次性找回全部作品。备份里不含任何识别凭据或本机设置。',
  };
  files['manifest.json'] = [new TextEncoder().encode(JSON.stringify(manifest, null, 2)), { level: 6 }];

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped as unknown as BlobPart], { type: 'application/zip' });
  const stamp = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  const filename = `工具箱备份-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.zip`;

  return { blob, filename, projectCount: index.length, bytes: blob.size };
}

export interface RestoreResult {
  restored: number;
  skipped: number;
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

  return { restored, skipped, warnings };
}
