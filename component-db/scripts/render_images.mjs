// 把 Fritzing 的 SVG 渲染成统一风格的元件图（PNG）
//
// 统一风格：去四周空白 → 居中放到 512×512 白底画布 → 调色板压缩（目标 <50KB）
// 为什么用 Node + sharp：项目里本来就有 sharp（libvips，能读 SVG），不用再装 Python 图像库
//
// 用法：node scripts/render_images.mjs [--size 512] [--only resistor led]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATA = path.join(ROOT, 'data');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const SIZE = Number(arg('size', 512));
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? argv.slice(onlyIdx + 1) : [];

const LIMIT_BYTES = 50 * 1024;

async function renderOne(part) {
  // 面包板图最直观，没有就退到图标 / 原理图
  const order = ['breadboard', 'icon', 'schematic'];
  const pick = order.map((v) => [v, part.svgFiles?.[v]]).find(([, p]) => p && fs.existsSync(path.join(DATA, p)));
  if (!pick) return { id: part.id, ok: false, reason: '没有可用图形' };
  const [view, rel] = pick;

  const svg = fs.readFileSync(path.join(DATA, rel));
  // Fritzing 的 SVG 常以英寸为单位，density 给小了会渲得很小
  const raster = sharp(svg, { density: 384 }).trim({ threshold: 8 });
  const meta = await raster.metadata();

  const inner = Math.round(SIZE * 0.88); // 留一圈边距，四张图看起来一样大
  const body = await raster
    .resize({
      width: meta.width >= meta.height ? inner : undefined,
      height: meta.height > meta.width ? inner : undefined,
      fit: 'inside',
    })
    .png()
    .toBuffer();

  const outDir = path.join(DATA, 'images');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${part.id}.png`);

  const info = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: body, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, colors: 128, effort: 8 })
    .toFile(outFile);

  return {
    id: part.id,
    ok: true,
    view,
    file: path.relative(DATA, outFile).replace(/\\/g, '/'),
    bytes: info.size,
    size: `${info.width}×${info.height}`,
    over: info.size > LIMIT_BYTES,
  };
}

const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'fritzing_raw.json'), 'utf8'));
const parts = ONLY.length ? raw.parts.filter((p) => ONLY.includes(p.id)) : raw.parts;

console.log(`[图形] 渲染 ${parts.length} 个元件 → ${SIZE}×${SIZE} 白底 PNG`);
let worst = 0;
for (const part of parts) {
  const r = await renderOne(part);
  if (!r.ok) {
    console.log(`  ✗ ${r.id}：${r.reason}`);
    continue;
  }
  worst = Math.max(worst, r.bytes);
  const flag = r.over ? '  ⚠ 超过 50KB' : '';
  console.log(`  ✓ ${r.id.padEnd(18)} ${r.view.padEnd(11)} ${(r.bytes / 1024).toFixed(1).padStart(6)} KB  ${r.size}${flag}`);
}
console.log(`[图形] 最大一张 ${(worst / 1024).toFixed(1)} KB（上限 50 KB）`);
