// 把元件库流水线的产物同步进应用（数据 + 图片）
//
// 源：元件数据库/数据/components.json + 元件数据库/数据/images/*.png
// 目标：src/lib/library/builtin.json（给打包用）+ public/library/*.png（静态资源）
//
// 用法：npm run sync:library

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcJson = path.join(root, '元件数据库', '数据', 'components.json');
const srcImages = path.join(root, '元件数据库', '数据', 'images');
const dstJson = path.join(root, 'src', 'lib', 'library', 'builtin.json');
const dstImages = path.join(root, 'public', 'library');

if (!fs.existsSync(srcJson)) {
  console.error(`[同步] 找不到 ${srcJson}\n        先在 元件数据库/ 里跑：python 脚本/extract_fritzing.py && node 脚本/render_images.mjs && python 脚本/merge_validate.py`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(srcJson, 'utf8'));
const components = payload.components || [];
if (!components.length) {
  console.error('[同步] components.json 里没有元件');
  process.exit(1);
}

// 只保留界面要用的字段，避免把 imageBytes 之类的中间信息带进包体
const compact = components.map((c) => ({
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
  pinCount: c.pinCount ?? 0,
  pinNames: c.pinNames || [],
  package: c.package || '',
  family: c.family || '',
  specs: c.specs || {},
  // 内置元件的图走静态路径（用户自建元件的图才存在本地存储里）
  imagePath: `library/${c.id}.png`,
  imageCredit: c.imageCredit || '元件图形来自 Fritzing（CC BY-SA 3.0）',
}));

fs.mkdirSync(path.dirname(dstJson), { recursive: true });
fs.writeFileSync(
  dstJson,
  JSON.stringify(
    {
      _comment: '自动生成，勿手改。来源：元件数据库/数据/components.json（npm run sync:library）',
      generatedAt: payload.generatedAt,
      count: compact.length,
      components: compact,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

fs.mkdirSync(dstImages, { recursive: true });
let copied = 0;
let bytes = 0;
const missing = [];
for (const c of compact) {
  const from = path.join(srcImages, `${c.id}.png`);
  if (!fs.existsSync(from)) {
    missing.push(c.id);
    continue;
  }
  const to = path.join(dstImages, `${c.id}.png`);
  fs.copyFileSync(from, to);
  copied += 1;
  bytes += fs.statSync(to).size;
}

console.log(`[同步] ${compact.length} 个元件 → ${path.relative(root, dstJson)}`);
console.log(`[同步] 图片 ${copied} 张（${(bytes / 1024).toFixed(1)} KB）→ ${path.relative(root, dstImages)}`);
if (missing.length) {
  console.warn(`[同步] 这些元件没有图片（界面会退化成首字占位）：${missing.join(', ')}`);
}
const categories = [...new Set(compact.map((c) => c.category))];
console.log(`[同步] 分类：${categories.join('、')}`);
console.log('[同步] 别忘了界面上的署名：元件图形来自 Fritzing（CC BY-SA 3.0）');
