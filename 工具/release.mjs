// 一键发版：类型检查 → 代码检查 → 便携版 → 桌面版（可选安装包）→ 归拢产物 → 汇总
//
// 用法：
//   npm run release                 出便携版 + 桌面版 exe
//   npm run release -- --installer  额外打 NSIS 安装包（需要能访问 GitHub 下载 NSIS）
//   npm run release -- --tag        完成后自动 git 提交并打版本标签（版本号取 package.json）
//   npm run release -- --skip-checks 跳过 tsc/eslint（着急出包时用）
//
// 产物统一放到 便携版/ 与 桌面版/，两个目录都在 .gitignore 里。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const withInstaller = has('--installer');
const withTag = has('--tag');
const skipChecks = has('--skip-checks');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const rustBin = 'D:\\rust\\cargo\\bin';
const env = {
  ...process.env,
  RUSTUP_HOME: process.env.RUSTUP_HOME || 'D:\\rust\\rustup',
  CARGO_HOME: process.env.CARGO_HOME || 'D:\\rust\\cargo',
  PATH: `${rustBin};${process.env.PATH}`,
};

const steps = [];
function run(label, cmd, args) {
  const t0 = Date.now();
  process.stdout.write(`\n[发版] ${label} …\n`);
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  steps.push({ label, ok, ms });
  if (!ok) {
    console.error(`\n[发版] ✗ ${label} 失败（exit ${r.status}），已停下。`);
    summary();
    process.exit(r.status ?? 1);
  }
  return ms;
}

// ---- 1. 检查 ----
if (!skipChecks) {
  run('类型检查（tsc）', 'npx', ['tsc', '--noEmit']);
  run('代码检查（eslint）', 'npx', ['eslint']);
}

// ---- 2. 便携版（静态站点）----
run('打包便携版', 'node', ['工具/build-portable.mjs']);

// ---- 3. 桌面版 ----
run(withInstaller ? '打包桌面版 exe + 安装包' : '打包桌面版 exe', 'node',
  ['工具/build-desktop.mjs', ...(withInstaller ? ['--bundle'] : [])]);

// ---- 4. 归拢产物到 桌面版 ----
const releaseDir = 'D:\\rust\\target\\circuitorium\\release';
const distDesktop = path.join(root, '桌面版');
fs.mkdirSync(distDesktop, { recursive: true });
const staged = [];
const copy = (from, toName) => {
  if (!fs.existsSync(from)) return false;
  const to = path.join(distDesktop, toName);
  fs.copyFileSync(from, to);
  staged.push(to);
  return true;
};
copy(path.join(releaseDir, 'circuitorium-toolbox.exe'), 'CIRCUITORIUM工具箱.exe');
// 桌面版的使用说明：源文件在 工具/desktop/，随仓库走（以前只躺在 桌面版/ 里，被 gitignore 掉，丢了就没了）
copy(path.join(root, '工具', 'desktop', '使用说明.txt'), '使用说明.txt');
let staleInstaller = false;
const nsisDir = path.join(releaseDir, 'bundle', 'nsis');
if (withInstaller && fs.existsSync(nsisDir)) {
  const setup = fs.readdirSync(nsisDir).find((f) => f.endsWith('-setup.exe'));
  if (setup) copy(path.join(nsisDir, setup), 'CIRCUITORIUM工具箱-安装包.exe');
} else if (fs.existsSync(path.join(distDesktop, 'CIRCUITORIUM工具箱-安装包.exe'))) {
  // 这次没打安装包：不覆盖、也不用它冒充新产物
  staleInstaller = true;
}
// 安装过旧安装包的话，旧文件会残留在 桌面版，这里只报告不删

// ---- 5. 版本标签 ----
if (withTag) {
  const git = 'D:\\Git\\cmd\\git.exe';
  const dirty = spawnSync(git, ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (dirty) {
    run('提交改动', git, ['add', '-A']);
    run(`提交（发版 v${version}）`, git, ['commit', '-m', `发版 v${version}`]);
  } else {
    console.log('\n[发版] 工作区没有改动，跳过提交');
  }
  const tagExists = spawnSync(git, ['tag', '-l', `v${version}`], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (tagExists) {
    console.log(`[发版] 标签 v${version} 已存在，跳过`);
  } else {
    run(`打标签 v${version}`, git, ['tag', '-a', `v${version}`, '-m', `CIRCUITORIUM 工具箱 v${version}`]);
  }
}

function mb(p) {
  return `${(fs.statSync(p).size / 1024 / 1024).toFixed(2)} MB`;
}
function summary() {
  console.log('\n──────── 发版汇总 ────────');
  for (const s of steps) console.log(`  ${s.ok ? '✓' : '✗'} ${s.label}  ${(s.ms / 1000).toFixed(1)}s`);
  console.log('\n  产物：');
  const listDir = (dir, label) => {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) return;
    const top = fs.readdirSync(full, { withFileTypes: true });
    const all = [];
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p); else all.push(p);
      }
    })(full);
    const total = all.reduce((n, p) => n + fs.statSync(p).size, 0);
    console.log(`   ${label}  ${dir}\\  （${all.length} 个文件，${(total / 1024 / 1024).toFixed(2)} MB）`);
    for (const f of top.filter((f) => f.isFile())) {
      console.log(`     - ${f.name}  ${mb(path.join(full, f.name))}`);
    }
  };
  listDir('桌面版', '桌面版');
  listDir('便携版', '便携版');
  if (staleInstaller) {
    console.log('   注意：桌面版\\CIRCUITORIUM工具箱-安装包.exe 是上一次打的，本次没有重新生成');
    console.log('        要一起更新就加 --installer（npm run release:installer）');
  }
  if (withTag) {
    console.log('\n  推上去： git push origin main --tags');
  }
  console.log('');
}
summary();
