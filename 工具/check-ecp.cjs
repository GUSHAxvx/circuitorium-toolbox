// 检查导出的 .ecp：结构、内容、有没有夹带凭据
// 用法：node 工具/check-ecp.cjs <文件路径>
const fs = require('fs');
const path = require('path');
const { unzipSync } = require('fflate');

const file = process.argv[2];
if (!file) {
  console.error('用法：node 工具/check-ecp.cjs <作品文件.ecp>');
  process.exit(1);
}
const buf = new Uint8Array(fs.readFileSync(file));
const head = Array.from(buf.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
console.log(`文件: ${path.basename(file)}  ${buf.length} 字节  zip 头: ${head}`);

const files = unzipSync(buf);
const names = Object.keys(files);
console.log(`条目(${names.length}): ${names.join(', ')}`);

const dec = new TextDecoder();
if (files['manifest.json']) {
  const m = JSON.parse(dec.decode(files['manifest.json']));
  console.log(`作品名: ${m.name} | 作者: ${m.author || '(无)'} | 格式: ${m.format || '?'} v${m.version || '?'}`);
  if (m.excludes) console.log(`manifest 声明不含: ${JSON.stringify(m.excludes)}`);
}
if (files['components.json']) {
  const c = JSON.parse(dec.decode(files['components.json']));
  const list = c.components || c;
  console.log(`元件数: ${Array.isArray(list) ? list.length : '?'}${Array.isArray(list) && list.length ? ` （例：${list.slice(0, 3).map((x) => x.component_name || x.name).join('、')}）` : ''}`);
  if (Array.isArray(list)) {
    const withLib = list.filter((x) => x.libraryId);
    console.log(`  带元件库编号的行: ${withLib.length}${withLib.length ? ` （${withLib.map((x) => `${x.name}→${x.libraryId}`).join('、')}）` : ''}`);
  }
}
if (files['components_snapshot.json']) {
  const snap = JSON.parse(dec.decode(files['components_snapshot.json']));
  const list = snap.components || [];
  console.log(`元件快照(${list.length}): ${list.map((x) => `${x.id}[${x.source}]${x.image ? '+' + x.image : ''}`).join('、')}`);
  const builtin = list.filter((x) => x.source === 'builtin');
  const carry = list.filter((x) => x.source !== 'builtin');
  console.log(`  只写引用的内置元件: ${builtin.length}${builtin.length ? ` （${builtin.map((x) => x.ref).join('、')}）` : ''}`);
  console.log(`  带完整定义的自定义元件: ${carry.length}`);
  for (const c of carry) {
    const img = c.image ? (files[c.image] ? `图片 ${c.image} 在（${files[c.image].length} 字节）` : `图片 ${c.image} 缺失！`) : '无图';
    console.log(`    - ${c.name || c.id}：${c.purpose || ''}｜${img}`);
  }
} else {
  console.log('元件快照: 无（作品没用到自定义元件）');
}
if (files['sections.json']) {
  const s = JSON.parse(dec.decode(files['sections.json']));
  const list = s.sections || s;
  console.log(`教程小节: ${Array.isArray(list) ? list.length : '?'}`);
}
if (files['images.json']) {
  const i = JSON.parse(dec.decode(files['images.json']));
  const list = i.images || i;
  console.log(`图片: ${Array.isArray(list) ? list.length : '?'}`);
}
if (files['code.json']) {
  const code = JSON.parse(dec.decode(files['code.json']));
  console.log(`程序代码(${code.length}): ${code.map((c) => `${c.name}[${c.language}] ${c.content.split('\n').length}行`).join('、')}`);
} else {
  console.log('程序代码: 无');
}
if (files['pinmap.json']) {
  const pins = JSON.parse(dec.decode(files['pinmap.json']));
  console.log(`接线表(${pins.length}): ${pins.map((p) => `${p.module}/${p.pin}→${p.boardPin}`).join('、')}`);
} else {
  console.log('接线表: 无');
}
if (files['debug.json']) {
  const dbg = JSON.parse(dec.decode(files['debug.json']));
  console.log(`调试记录(${dbg.length}): ${dbg.map((d) => d.problem).join('、')}`);
} else {
  console.log('调试记录: 无');
}
const raw = dec.decode(buf);
const leak = raw.match(/sk-[A-Za-z0-9]{4,}|apiKey|api_key|ai_config|teacherCode|"token"/g);
console.log(`凭据泄漏检查: ${leak ? `发现可疑内容 ${JSON.stringify([...new Set(leak)])}` : '干净（没有 Key / 配置项）'}`);
