// 打包桌面版（Tauri）：先做静态站点，再编 Rust 外壳
// 用法：
//   node tools/build-desktop.mjs            只出 exe（便携，双击即用）
//   node tools/build-desktop.mjs --bundle   再尝试做安装包（需要能访问 GitHub 下载 NSIS，国内可能失败）
//
// 说明：
// - Rust 工具链装在 D:\rust（RUSTUP_HOME / CARGO_HOME 指向那里）
// - cargo 的 target 目录也在 D 盘（D:\rust\target\circuitorium，见 D:\rust\cargo\config.toml）
// - 前端就是 dist-toolbox/site（Next 静态导出，只有 /toolbox 一个页面）

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = process.argv.includes('--bundle');

const rustBin = 'D:\\rust\\cargo\\bin';
const env = {
  ...process.env,
  RUSTUP_HOME: process.env.RUSTUP_HOME || 'D:\\rust\\rustup',
  CARGO_HOME: process.env.CARGO_HOME || 'D:\\rust\\cargo',
  PATH: `${rustBin};${process.env.PATH}`,
};

function run(cmd, args, label) {
  console.log(`\n[desktop] ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`[desktop] 失败：${label}（exit ${r.status}）`);
    process.exit(r.status ?? 1);
  }
}

// 1) 前端静态站点
if (!fs.existsSync(path.join(root, 'dist-toolbox', 'site', 'toolbox', 'index.html'))) {
  run('node', ['tools/build-portable.mjs'], '生成静态站点（dist-toolbox/site）');
} else {
  console.log('[desktop] 复用已有静态站点 dist-toolbox/site（需要重新生成就删掉它再跑）');
}

// 2) Rust 外壳
const tauriArgs = ['tauri', 'build', '--no-bundle'];
if (bundle) tauriArgs.pop();
run('npx', tauriArgs, bundle ? '编译 + 打安装包' : '编译 exe（便携版）');

// 3) 报告产物
const releaseDir = 'D:\\rust\\target\\circuitorium\\release';
const exe = path.join(releaseDir, 'CIRCUITORIUM Toolbox.exe');
const alt = path.join(releaseDir, 'circuitorium-toolbox.exe');
for (const p of [exe, alt]) {
  if (fs.existsSync(p)) {
    console.log(`\n[desktop] 完成：${p}（${(fs.statSync(p).size / 1024 / 1024).toFixed(1)} MB）`);
  }
}
const bundleDir = path.join(releaseDir, 'bundle');
if (fs.existsSync(bundleDir)) {
  console.log(`[desktop] 安装包目录：${bundleDir}`);
  for (const f of fs.readdirSync(bundleDir)) console.log(`  - ${f}`);
}
