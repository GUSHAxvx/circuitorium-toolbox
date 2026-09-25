// 自包含分享页：把一件作品变成「一个 HTML 文件」，双击就能看，不需要装工具箱、不需要联网
// 页面里同时内嵌作品文件（base64），学生点一下就能存进自己的工具箱

import { zipSync } from 'fflate';
import type { ProjectBundle } from '@/lib/store';
import { ECP_FORMAT, ECP_LIMITS, ECP_VERSION, extForMime, safeFileName, sniffImageMime } from '@/lib/ecp/format';
import { buildLibrarySnapshot } from '@/lib/ecp/io';

/** 分享页里内嵌作品文件的上限：超过就不内嵌（页面仍可浏览，另发 .ecp 文件） */
export const EMBED_LIMIT_BYTES = 3 * 1024 * 1024;

/** 作品码上限：二维码装得下的体量（纯文本作品通常几 KB） */
export const WORK_CODE_LIMIT_BYTES = 2000;

export interface ShareHtmlOptions {
  bundle: ProjectBundle;
  author?: string;
  /** 已打包好的 .ecp 字节；给了就内嵌，学生可一键保存 */
  ecpBytes?: Uint8Array;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const KIND_LABELS: Record<string, string> = {
  schematic: '原理图',
  circuit: '电路图',
  wiring: '接线图',
  photo: '实物图',
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const blobToBase64 = async (blob: Blob): Promise<string> => bytesToBase64(new Uint8Array(await blob.arrayBuffer()));

/** 组装作品文件字节（与导出功能同一套结构，供分享页内嵌） */
export async function buildEcpBytes(bundle: ProjectBundle, author: string): Promise<{ bytes: Uint8Array; skipped: number }> {
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  let skipped = 0;
  let index = 0;

  for (const img of bundle.images) {
    const bytes = new Uint8Array(await img.blob.arrayBuffer());
    if (bytes.byteLength > ECP_LIMITS.maxSingleBytes) {
      skipped += 1;
      continue;
    }
    const mime = sniffImageMime(bytes) || img.mime || 'image/jpeg';
    files[`images/${index}.${extForMime(mime)}`] = [bytes, { level: 0 }];
    index += 1;
  }

  const manifest = {
    format: ECP_FORMAT,
    version: ECP_VERSION,
    createdAt: new Date().toISOString(),
    app: { name: 'CIRCUITORIUM 工具箱', version: '1.0' },
    project: {
      name: bundle.project.name,
      notes: bundle.project.notes,
      description: bundle.project.description,
      features: bundle.project.features,
      author,
      createdAt: bundle.project.createdAt,
      updatedAt: bundle.project.updatedAt,
    },
    counts: {
      components: bundle.components.length,
      sections: bundle.sections.length,
      images: index,
      code: (bundle.codeFiles || []).length,
    },
    difficulty: bundle.project.difficulty === 'bankai' ? 'bankai' : 'shikai',
    ...(bundle.project.codeNote ? { codeNote: bundle.project.codeNote } : {}),
    excludes: ['本机设置', '识别凭据', '访问令牌', '本机文件路径'],
  };

  files['manifest.json'] = [new TextEncoder().encode(JSON.stringify(manifest, null, 2)), { level: 6 }];
  files['components.json'] = [
    new TextEncoder().encode(JSON.stringify(bundle.components.map((c) => ({
      name: c.name, type: c.type, model: c.model, manufacturer: c.manufacturer,
      packageType: c.packageType, pinCount: c.pinCount, specifications: c.specifications,
      description: c.description, annotation: c.annotation, quantity: c.quantity,
      checked: false, confidence: c.confidence, sortOrder: c.sortOrder,
    })), null, 2)),
    { level: 6 },
  ];
  files['sections.json'] = [
    new TextEncoder().encode(JSON.stringify(bundle.sections.map((s) => ({
      type: s.type, title: s.title, content: s.content, sortOrder: s.sortOrder,
    })), null, 2)),
    { level: 6 },
  ];
  files['images.json'] = [new TextEncoder().encode('[]'), { level: 6 }];

  // 卍解作品的程序代码：分享页存下来的作品也要带着
  if ((bundle.codeFiles || []).length > 0) {
    files['code.json'] = [
      new TextEncoder().encode(JSON.stringify(
        (bundle.codeFiles || []).map((c) => ({
          name: c.name, language: c.language, content: c.content, note: c.note, sortOrder: c.sortOrder,
        })), null, 2)),
      { level: 6 },
    ];
  }

  // 作品用到的自定义元件也一起带上：对方从分享页存下作品时，元件会跟着进他的元件库
  try {
    const warnings: string[] = [];
    const snapshot = await buildLibrarySnapshot(bundle.project.id, files, warnings);
    if (snapshot.components.length > 0) {
      files['components_snapshot.json'] = [
        new TextEncoder().encode(JSON.stringify(snapshot, null, 2)),
        { level: 6 },
      ];
    }
  } catch {
    // 分享页不因为快照失败而打不开
  }

  files['README.txt'] = [
    new TextEncoder().encode(`${bundle.project.name}\n\n用 CIRCUITORIUM 工具箱的「打开作品」选择本文件即可查看，并可一键做成自己的版本。\n`),
    { level: 6 },
  ];

  return { bytes: zipSync(files, { level: 6 }), skipped };
}

/** 生成自包含分享页（单个 HTML 字符串） */
export async function buildShareHtml(options: ShareHtmlOptions): Promise<{ html: string; filename: string; embedded: boolean; warnings: string[] }> {
  const { bundle, author = '' } = options;
  const warnings: string[] = [];

  let embeddedEcp = '';
  let embedded = false;
  if (options.ecpBytes && options.ecpBytes.byteLength > 0) {
    if (options.ecpBytes.byteLength <= EMBED_LIMIT_BYTES) {
      embeddedEcp = bytesToBase64(options.ecpBytes);
      embedded = true;
    } else {
      warnings.push('作品较大，分享页里没有内嵌作品文件，请把作品文件一起发给对方');
    }
  }

  const steps = bundle.sections.filter((s) => s.type === 'step');
  const caution = bundle.sections.filter((s) => s.type === 'note');
  const features = (bundle.project.features || steps.map((s) => s.title).join('\n'))
    .split('\n').map((f) => f.trim()).filter(Boolean);

  const imageBlocks: string[] = [];
  for (const img of bundle.images.slice(0, 6)) {
    const b64 = await blobToBase64(img.blob);
    const mime = img.mime || 'image/jpeg';
    imageBlocks.push(
      `<figure class="shot"><img alt="${escapeHtml(img.description || bundle.project.name)}" src="data:${mime};base64,${b64}">`
      + `<figcaption>${escapeHtml(KIND_LABELS[img.kind] || '实物图')}${img.description ? ' · ' + escapeHtml(img.description) : ''}</figcaption></figure>`
    );
  }
  if (bundle.images.length > 6) warnings.push('分享页只放了前 6 张图片');

  const componentRows = bundle.components.map((c) => `
      <tr>
        <td class="c-name">${escapeHtml(c.name)}${c.type ? `<span class="c-type">${escapeHtml(c.type)}</span>` : ''}</td>
        <td class="c-model">${escapeHtml(c.model || '—')}</td>
        <td class="c-qty">${c.quantity || 1}</td>
        <td class="c-desc">${escapeHtml(c.description || '')}</td>
      </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(bundle.project.name)} · 作品分享</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #070a14; color: #e8eeff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; line-height: 1.7; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 28px 18px 60px; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 800; letter-spacing: 1px; }
  .logo { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center;
    background: linear-gradient(135deg, #3b6bff, #7c5cf0); font-size: 16px; }
  .card { background: linear-gradient(165deg, rgba(17,25,45,.92), rgba(10,15,28,.94));
    border: 1px solid rgba(120,150,255,.12); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
  h1 { margin: 0 0 8px; font-size: clamp(21px, 3.4vw, 29px); font-weight: 800; letter-spacing: -.3px; }
  h2 { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #dbe4ff; }
  .meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12.5px; color: rgba(255,255,255,.45); align-items: center; }
  .avatar { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800;
    background: linear-gradient(140deg, #4f7cff, #7c5cf0); color: #fff; }
  .notes { margin: 12px 0 0; font-size: 13.5px; color: rgba(255,255,255,.6); }
  .tags { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 12px; }
  .tag { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
    background: rgba(79,124,255,.12); color: #9db8ff; border: 1px solid rgba(79,124,255,.26); }
  .save { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 10px; border: none;
    background: linear-gradient(135deg, #3b6bff, #4f7cff); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
  .save:disabled { opacity: .55; cursor: default; }
  .hint { margin: 10px 0 0; font-size: 12px; color: rgba(255,255,255,.4); }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px; font-size: 11.5px; color: rgba(255,255,255,.42); border-bottom: 1px solid rgba(255,255,255,.08); }
  td { padding: 10px 8px; font-size: 12.5px; color: rgba(255,255,255,.62); border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: top; }
  .c-name { color: #eef3ff; font-weight: 600; }
  .c-type { display: block; font-size: 11px; color: #9db8ff; font-weight: 400; margin-top: 2px; }
  .c-model { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: #9db8ff; }
  .c-qty { text-align: center; }
  .shots { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); }
  .shot { margin: 0; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; background: #060a14; }
  .shot img { display: block; width: 100%; height: 170px; object-fit: cover; }
  .shot figcaption { padding: 6px 9px; font-size: 11.5px; color: rgba(255,255,255,.5); }
  .step { background: rgba(79,124,255,.06); border: 1px solid rgba(79,124,255,.16); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
  .step h3 { margin: 0 0 6px; font-size: 13px; color: #bcd0ff; }
  .step p { margin: 0; white-space: pre-wrap; font-size: 12.5px; color: rgba(255,255,255,.62); }
  .caution { background: rgba(251,191,36,.07); border-color: rgba(251,191,36,.2); }
  .caution h3 { color: #fcd34d; }
  ol.features { margin: 0; padding-left: 20px; font-size: 12.5px; color: rgba(255,255,255,.62); }
  .foot { text-align: center; font-size: 12px; color: rgba(255,255,255,.28); margin-top: 26px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="brand"><span class="logo">🔬</span>CIRCUITORIUM</div>
    <span class="meta">作品分享 · 无需安装</span>
  </div>

  <div class="card">
    <h1>${escapeHtml(bundle.project.name)}</h1>
    <div class="meta">
      <span class="avatar">${escapeHtml((author || '匿').slice(0, 1))}</span>
      ${author ? `<span>${escapeHtml(author)}</span>` : '<span>未署名</span>'}
      <span>元件 ${bundle.components.length} 个</span>
      <span>教程 ${steps.length} 节</span>
      ${bundle.images.length ? `<span>图片 ${bundle.images.length} 张</span>` : ''}
    </div>
    ${bundle.project.notes ? `<p class="notes">${escapeHtml(bundle.project.notes)}</p>` : ''}
    ${features.length ? `<div class="tags">${features.slice(0, 6).map((f) => `<span class="tag">${escapeHtml(f)}</span>`).join('')}</div>` : ''}
  </div>

  <div class="card">
    <h2>保存下来自己动手做</h2>
    <button class="save" id="save"${embedded ? '' : ' disabled'}>
      ${embedded ? '保存到我的工具箱' : '请让分享者把作品文件一起发给你'}
    </button>
    <p class="hint">${embedded
      ? '点一下会得到作品文件；在工具箱里点「打开作品」选它，就能一键做出自己的版本。'
      : '这个作品体积较大，分享页里没有内嵌文件。'}</p>
  </div>

  ${bundle.components.length ? `<div class="card">
    <h2>元件清单</h2>
    <table>
      <thead><tr><th>元件</th><th>型号 / 规格</th><th style="text-align:center">数量</th><th>作用</th></tr></thead>
      <tbody>${componentRows}
      </tbody>
    </table>
  </div>` : ''}

  ${imageBlocks.length ? `<div class="card"><h2>项目图片</h2><div class="shots">${imageBlocks.join('')}</div></div>` : ''}

  ${steps.length ? `<div class="card"><h2>图文教程</h2>${steps.map((s, i) => `
    <div class="step"><h3>第 ${i + 1} 步 · ${escapeHtml(s.title)}</h3><p>${escapeHtml(s.content)}</p></div>`).join('')}</div>` : ''}

  ${caution.length ? `<div class="card"><h2>注意事项</h2>${caution.map((s) => `
    <div class="step caution"><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.content)}</p></div>`).join('')}</div>` : ''}

  <p class="foot">用 CIRCUITORIUM 工具箱做的作品 · 本页面可离线打开</p>
</div>
<script>
  var ECP = ${embedded ? `"${embeddedEcp}"` : 'null'};
  document.getElementById('save').addEventListener('click', function () {
    if (!ECP) return;
    var bin = atob(ECP);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = ${JSON.stringify(safeFileName(bundle.project.name))} + '.ecp';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });
</script>
</body>
</html>`;

  return {
    html,
    filename: `${safeFileName(bundle.project.name)}-分享.html`,
    embedded,
    warnings,
  };
}

/** 作品码：体量小的作品可以压成一串码，做成二维码让学生扫 */
export function encodeWorkCode(zipBytes: Uint8Array): { code: string; ok: boolean } {
  if (zipBytes.byteLength > WORK_CODE_LIMIT_BYTES) return { code: '', ok: false };
  const base64 = bytesToBase64(zipBytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { code: `CTW1-${base64}`, ok: true };
}

export function decodeWorkCode(code: string): Uint8Array | null {
  const raw = code.trim();
  if (!raw.startsWith('CTW1-')) return null;
  try {
    const padded = raw.slice(5).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}
