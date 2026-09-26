// 批量跑工具/checks 里的浏览器断言，输出一张通过/失败表
//
// 用法：
//   node 工具/run-checks.mjs --url http://127.0.0.1:3000/toolbox a.json b.json ...
//   node 工具/run-checks.mjs --dir 工具/checks --list local-*.json      （支持通配）
//
// 说明：断言脚本里若自带失败信息（value.error）会打印出来；控制台报错一律算失败。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, def = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const many = (name) => {
  const out = [];
  args.forEach((a, i) => { if (a === `--${name}`) out.push(args[i + 1]); });
  return out;
};

const root = path.resolve(import.meta.dirname, '..');
const url = arg('url', 'http://127.0.0.1:3000/toolbox');
const dir = arg('dir', path.join(root, '工具', 'checks'));
const patterns = args.filter((a) => !a.startsWith('--') && a.endsWith('.json'));

const expand = (pattern) => {
  if (!pattern.includes('*')) return [pattern];
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return fs.readdirSync(dir).filter((f) => re.test(f));
};

const files = patterns.flatMap(expand).map((f) => (path.isAbsolute(f) ? f : path.join(dir, f)));
if (!files.length) {
  console.error('没有匹配到任何断言脚本');
  process.exit(1);
}

const results = [];
for (const file of files) {
  const name = path.basename(file);
  const tmp = path.join(root, '截图', `_run_${name}`);
  const run = spawnSync('node', [
    path.join(root, '工具', 'browser-check.cjs'),
    '--url', url, '--wait', '10000', '--script', file,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });

  // browser-check 把报告打到 stdout；直接解析最后一段 JSON
  let report = null;
  try {
    const text = (run.stdout || '').trim();
    const start = text.indexOf('{');
    report = JSON.parse(text.slice(start));
  } catch {
    results.push({ name, ok: false, why: '报告解析失败（脚本可能报错）' });
    continue;
  }

  const errs = (report.consoleErrors || []).length;
  const failed = (report.evals || []).filter((e) => e.error || String(e.value || '').includes('"error"'));
  const ok = errs === 0 && failed.length === 0;
  const why = ok ? '' : [
    errs ? `${errs} 个控制台报错` : '',
    ...failed.map((f) => f.error || String(f.value).slice(0, 120)),
  ].filter(Boolean).join(' | ');
  results.push({ name, ok, why });
  void tmp;
}

const pad = Math.max(...results.map((r) => r.name.length));
console.log('');
console.log('断言结果');
console.log('─'.repeat(pad + 30));
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(pad)}  ${r.why}`);
}
const pass = results.filter((r) => r.ok).length;
console.log('─'.repeat(pad + 30));
console.log(`${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
