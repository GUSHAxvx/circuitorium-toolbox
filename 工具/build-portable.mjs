// 便携版打包：把工具箱打成「解压即用」的文件夹
//
// 做法（全程不动正在开发用的源码，也不影响正在运行的 dev server）：
//   1. 把源码子集复制到 .portable-build/，并在副本里删掉服务器专属路由
//   2. 用 TOOLBOX_EXPORT=1 在副本里跑 next build（产出纯静态 out/）
//   3. 组装 便携版/：静态站点 + 启动.bat + server.ps1 + 使用说明
//   4. 清掉副本
//
// 用法：node 工具/build-portable.mjs

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workDir = path.join(root, '.portable-build');
const distDir = path.join(root, '便携版');
const siteDir = path.join(distDir, 'site');
const portableFiles = path.join(root, '工具', 'portable');

// 静态导出用不到的路由（服务器版仍然需要，这里只在副本里删掉）
const SERVER_ONLY = [
  'api', 'projects', 'templates', 'community', 'share', 'share-project',
  'favorites', 'history', 'login', 'register', 'recognize', 'page.tsx',
];

const ROOT_FILES = ['package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs'];

// 绝对不能打进分发出去的工具箱：用户自己的数据（上传的图片、数据库、环境变量）
const PUBLIC_EXCLUDE = ['uploads', 'data.db', 'data.db-wal', 'data.db-shm'];

const log = (msg) => console.log(`[portable] ${msg}`);

function copyDir(from, to, excludeTop = []) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (excludeTop.includes(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function dirSize(dir) {
  let bytes = 0;
  let files = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else { bytes += fs.statSync(p).size; files += 1; }
    }
  };
  walk(dir);
  return { bytes, files };
}

const REDIRECT_HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>CIRCUITORIUM 工具箱</title>
<meta http-equiv="refresh" content="0; url=./toolbox/">
<style>body{margin:0;background:#070a14;color:#e8eeff;font-family:-apple-system,"Microsoft YaHei",sans-serif;
display:grid;place-items:center;height:100vh}a{color:#7f9cff}</style>
</head><body><p>正在打开工具箱…… 如果没有自动跳转，请点 <a href="./toolbox/">这里</a>。</p></body></html>`;

const README = `CIRCUITORIUM 工具箱（便携版）
==============================

怎么用
------
双击「启动.bat」→ 浏览器自动打开工具箱。
不需要安装任何东西，不需要联网（拍照识别除外，那个要老师配置过才可用）。

数据存在哪
----------
存在这台电脑上：浏览器为 http://127.0.0.1:8734 这个地址保存的本地数据。
- 换电脑：把整个文件夹拷过去即可；作品要跟着走，就在项目里点「分享作品」带走作品文件
- 不要改端口：改了端口浏览器会当成另一个站点，看不到原来的项目
- 清理：在浏览器里清除该站点的数据即可

停止服务
--------
关掉那个最小化的「CIRCUITORIUM-本地服务」窗口即可（不会丢数据）。

文件说明
--------
启动.bat      双击这个
server.ps1    本地静态服务（用 Windows 自带的 PowerShell，无需安装）
site/         工具箱界面
`;

try {
  log('准备构建副本…');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  copyDir(path.join(root, 'src'), path.join(workDir, 'src'));
  if (fs.existsSync(path.join(root, 'public'))) {
    copyDir(path.join(root, 'public'), path.join(workDir, 'public'), PUBLIC_EXCLUDE);
    log(`已排除用户数据：${PUBLIC_EXCLUDE.join(', ')}`);
  }
  for (const name of ROOT_FILES) {
    const from = path.join(root, name);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(workDir, name));
  }

  // 副本里删掉服务器专属路由
  let removed = 0;
  for (const name of SERVER_ONLY) {
    const target = path.join(workDir, 'src', 'app', name);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      removed += 1;
    }
  }
  log(`副本就绪，已移除 ${removed} 个服务器专属路由`);

  // 复用真实 node_modules（junction 不需要管理员权限）
  const modulesLink = path.join(workDir, 'node_modules');
  const realModules = path.join(root, 'node_modules');
  try {
    fs.symlinkSync(realModules, modulesLink, 'junction');
    log('已链接 node_modules（junction）');
  } catch (e) {
    throw new Error(`无法链接 node_modules：${e.message}`);
  }

  log('开始静态导出构建…');
  execSync('npx next build', {
    cwd: workDir,
    stdio: 'inherit',
    env: { ...process.env, TOOLBOX_EXPORT: '1' },
  });

  const outDir = path.join(workDir, 'out');
  if (!fs.existsSync(outDir)) throw new Error('构建没有产出 out/ 目录');
  if (!fs.existsSync(path.join(outDir, 'toolbox'))) throw new Error('out/ 里没有 toolbox 页面');

  log('组装 便携版 …');
  fs.rmSync(distDir, { recursive: true, force: true });
  copyDir(outDir, siteDir);
  fs.writeFileSync(path.join(siteDir, 'index.html'), REDIRECT_HTML, 'utf8');
  for (const name of fs.readdirSync(portableFiles)) {
    fs.copyFileSync(path.join(portableFiles, name), path.join(distDir, name));
  }
  fs.writeFileSync(path.join(distDir, '使用说明.txt'), README, 'utf8');

  const { bytes, files } = dirSize(distDir);
  log(`完成：便携版/（${files} 个文件，${(bytes / 1024 / 1024).toFixed(2)} MB）`);

  fs.rmSync(workDir, { recursive: true, force: true });
  log('已清理构建副本');
} catch (error) {
  console.error('[portable] 构建失败：', error.message);
  console.error(`[portable] 构建副本保留在 ${workDir}，方便排查`);
  process.exit(1);
}
