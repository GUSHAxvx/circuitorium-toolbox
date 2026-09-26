// 一键自检：自己拉起便携版服务，跑一遍关键断言，最后给一张通过/失败表
//
// 用法：
//   npm run selfcheck                用便携版（不需要开发服务器，测的就是发给别人的那一包）
//   npm run selfcheck -- --server    用正在运行的服务器版（默认 http://127.0.0.1:3000）
//
// 退出码 0 表示全通过，1 表示有失败项。

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const useServer = args.includes('--server');
const withOffline = !args.includes('--no-offline');

// 单阶段断言（用 run-checks 批量跑）
//
// 注意：这里只放「正式构建里也能跑」的断言。
// 有一类断言要读 window.__toolboxStore（开发期调试入口，生产构建里会被剥掉），
// 那种只能在 `npm run dev` 期间手动跑，例如：
//     npm run checks -- --url http://127.0.0.1:3000/toolbox library-store.json
const CHECKS = [
  'library-view.json',     // 元件库：20 张卡、图片、详情
  'library-intro.json',    // 元件库首页的鼓励说明
  'wording-audit.json',    // 12 个界面不出现技术黑话
  'local-detail.json',     // 作品详情页
  'open-first-work.json',  // 打开第一件作品
  'local-export-ecp.json', // 保存作品文件
  'share-chain.json',      // 分享链路（作品码/分享页）
  'share-embed.json',      // 分享页内嵌作品文件
  'ai-optional.json',      // 没配 AI 也能用
  'layout-metrics.json',   // 版心宽度（防止"尺寸很奇怪"回归）
  'header-metrics.json',   // 页头尺寸
  'diag-page.json',        // 页面无报错
  'standalone-nav.json',   // 独立版导航只应有「工具箱」
];

const PORT = Number(process.env.SELFCHECK_PORT || 8791);
let server = null;

function log(msg) { console.log(msg); }

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  let baseUrl;
  if (useServer) {
    baseUrl = process.env.SELFCHECK_URL || 'http://127.0.0.1:3000/toolbox';
    log(`[自检] 使用服务器版：${baseUrl}`);
  } else {
    const siteDir = path.join(root, '便携版', 'site');
    if (!fs.existsSync(siteDir)) {
      console.error('[自检] 没有找到 便携版/site —— 先跑一次 npm run build:portable');
      process.exit(1);
    }
    log(`[自检] 启动便携版服务（端口 ${PORT}）…`);
    server = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(root, '便携版', 'server.ps1'),
      '-Port', String(PORT),
      '-Root', siteDir,
    ], { cwd: root, stdio: 'ignore' });
    baseUrl = `http://127.0.0.1:${PORT}/toolbox/`;
    const ok = await waitFor(baseUrl);
    if (!ok) {
      console.error('[自检] 便携版服务没起来，先看它自己的输出（手动双击 便携版\\启动.bat 试试）');
      server.kill();
      process.exit(1);
    }
  }

  let failed = 0;

  // ① 批量断言
  const batch = spawnSync('node', [
    path.join(root, '工具', 'run-checks.mjs'),
    '--url', baseUrl,
    ...CHECKS,
  ], { cwd: root, stdio: 'inherit' });
  if (batch.status !== 0) failed += 1;

  // ② 断网测试（单独跑，要带 --offline 开关）
  if (withOffline) {
    log('');
    log('断网可用性（断网后还能打开作品、改描述、加元件）');
    log('─'.repeat(60));
    const off = spawnSync('node', [
      path.join(root, '工具', 'browser-check.cjs'),
      '--url', baseUrl, '--wait', '10000',
      '--script', path.join(root, '工具', 'checks', 'local-offline.json'),
      '--offline',
    ], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    let ok = false;
    try {
      const text = (off.stdout || '').trim();
      const report = JSON.parse(text.slice(text.indexOf('{')));
      const value = JSON.parse(report.evals[0].value);
      ok = report.consoleErrors.length === 0 && value.online === false && value.after > value.before;
      log(`${ok ? '✓' : '✗'} local-offline.json   ${ok ? '' : '断网后没能正常读写'}`);
    } catch {
      log('✗ local-offline.json   报告解析失败');
    }
    if (!ok) failed += 1;
  }

  if (server) { server.kill(); }

  log('');
  if (failed === 0) {
    log('全部自检通过 ✓');
  } else {
    log(`有 ${failed} 组检查未通过 ✗（细节见上面的表）`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('[自检] 出错了：', e);
  if (server) server.kill();
  process.exit(1);
});
