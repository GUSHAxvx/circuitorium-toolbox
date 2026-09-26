// 真实浏览器验证工具（CDP）：等待真实时间 + 执行断言 + 截图
// 说明：--headless --screenshot --virtual-time-budget 会让 IndexedDB 回调跑不完，
//       所以本地存储相关的验证必须用这个脚本。
//
// 用法：
//   node 工具/browser-check.cjs --url http://localhost:3000/toolbox --wait 6000 \
//        --eval "document.querySelectorAll('.tb-template').length" --shot out.png
//   node 工具/browser-check.cjs --url http://localhost:3000/toolbox --wait 6000 \
//        --script 工具/tmp-check.json --shot out.png     # 表达式写在 JSON 数组里（中文不乱码）
//
// 参数：--url <地址>  --wait <毫秒>  --eval <表达式>（可重复）  --eval2 <表达式>（交互后）
//       --script <json文件>（一次读多条表达式，UTF-8，中文安全）  --then-wait <毫秒>
//       --script2 <json文件>（刷新/交互之后再跑的表达式，同样中文安全）
//       --file-input "<选择器>=<本地文件>"（把真实文件塞给 file input，测「打开作品」这类导入）
//       --shot <png路径>  --port <调试端口>  --offline / --offline-late / --reload2
//       --downloads <目录>  --out <文件>  --width / --height

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}
function args(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === '--' + name) out.push(process.argv[i + 1]); });
  return out;
}

const URL_ = arg('url', 'http://localhost:3000/');
const WAIT = Number(arg('wait', 5000));
const PORT = Number(arg('port', 9333));
const SHOT = arg('shot', '');
// --script <json文件>：从 UTF-8 文件读要执行的表达式数组，避免中文经命令行传参乱码
const SCRIPT_FILE = arg('script', '');
const SCRIPT_FILE2 = arg('script2', '');
const CLICKS = args('click');
const CLICKS2 = args('click2');
// --file-input "<选择器>=<本地文件路径>"：把真实文件塞进 file input（等价于用户在系统对话框里选了文件）
const FILE_INPUTS = args('file-input');

// 读断言文件：去掉可能的 BOM（PowerShell 的 Set-Content -Encoding utf8 会写 BOM，JSON.parse 会炸）
function readScriptFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
const EVALS = SCRIPT_FILE
  ? readScriptFile(SCRIPT_FILE)
  : args('eval');
const EVALS2 = SCRIPT_FILE2
  ? readScriptFile(SCRIPT_FILE2)
  : args('eval2');
const THEN_WAIT = Number(arg('then-wait', 0));
const OFFLINE = process.argv.includes('--offline');
const OFFLINE_LATE = process.argv.includes('--offline-late');
const DOWNLOADS = arg('downloads', '');
const OUT_FILE = arg('out', '');
const RELOAD2 = process.argv.includes('--reload2');
const WIDTH = Number(arg('width', 1366));
const HEIGHT = Number(arg('height', 1000));

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const browser = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
// --attach：不自己开浏览器，直接连已经跑着的调试端口
// 用途：Tauri 桌面版（WebView2）带 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<端口> 启动后，
//       可以用同一套断言去测真实桌面窗口里的页面。
const ATTACH = process.argv.includes('--attach');
if (!ATTACH && !browser) {
  console.error('未找到 Edge/Chrome');
  process.exit(1);
}

const profile = ATTACH ? '' : fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-prof-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(pathname, init) {
  const res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, init);
  return res.json();
}

(async () => {
  const proc = ATTACH ? null : spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(300);
    try {
      if (ATTACH) {
        // 附着模式：找已经打开的页面（Tauri 的 WebView 已经加载了工具箱）
        const list = await json('/json/list');
        target = (list || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl) || null;
      } else {
        target = await json('/json/new?about:blank', { method: 'PUT' });
        if (!target || !target.webSocketDebuggerUrl) target = null;
      }
    } catch {
      target = null;
    }
  }
  if (!target) {
    console.error(ATTACH ? '连不上调试端口（确认程序已带 --remote-debugging-port 启动）' : '无法连接浏览器调试端口');
    proc?.kill();
    process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  const report = { url: URL_, evals: [], consoleErrors: [] };

  await new Promise((resolve) => ws.addEventListener('open', resolve));
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      report.consoleErrors.push((msg.params.args || []).map((a) => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      report.consoleErrors.push(msg.params.exceptionDetails?.exception?.description || 'exception');
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');

  // 允许下载到指定目录，用于验证「导出作品」这类真实落盘行为
  if (DOWNLOADS) {
    fs.mkdirSync(DOWNLOADS, { recursive: true });
    try {
      await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS, eventsEnabled: true });
    } catch {
      await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS });
    }
    report.downloads = DOWNLOADS;
  }

  if (ATTACH) {
    // 附着模式：用程序里已经加载好的页面（不自己导航）
    report.attached = true;
    report.url = (await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true })).result?.value || URL_;
  } else {
    await send('Page.navigate', { url: URL_ });
  }
  await sleep(WAIT);

  // --click <选择器>：用真实鼠标事件点（有用户手势，浏览器才允许下载）
  async function realClick(selector) {
    const r = await send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`,
      returnByValue: true,
    });
    const p = r.result?.value;
    if (!p) return { selector, clicked: false };
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    return { selector, clicked: true, x: p.x, y: p.y };
  }
  report.clicks = [];
  for (const sel of CLICKS) report.clicks.push(await realClick(sel));

  // 断网测试：页面已加载后切断网络，验证本地读写是否照常
  if (OFFLINE) {
    await send('Network.enable');
    await send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    });
    report.offline = true;
    await sleep(500);
  }

  for (const expr of EVALS) {
    try {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      report.evals.push({ expr, value: r.result?.value ?? null });
    } catch (e) {
      report.evals.push({ expr, error: String(e.message || e) });
    }
  }

  // 交互后再等一段真实时间，验证写入/跳转后的状态
  if (THEN_WAIT > 0) {
    // 先刷新一次页面：用于验证「数据真的落到本地存储、刷新后还在」
    if (RELOAD2) {
      await send('Page.reload', { ignoreCache: true });
      await sleep(WAIT);
      report.reloaded = true;
    }
    // 页面已经加载完、并且完成了第一批交互后再断网：验证本地读写不依赖网络
    if (OFFLINE_LATE) {
      await send('Network.enable');
      await send('Network.emulateNetworkConditions', {
        offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
      });
      report.offlineLate = true;
      await sleep(500);
    }
    await sleep(THEN_WAIT);
    report.urlAfter = (await send('Runtime.evaluate', { expression: 'location.pathname', returnByValue: true })).result?.value;
    // 把真实文件塞给 file input（真实「打开作品」流程，跳过系统对话框本身）
    report.fileInputs = [];
    if (FILE_INPUTS.length) {
      await send('DOM.enable');
      const doc = await send('DOM.getDocument', { depth: -1 });
      for (const spec of FILE_INPUTS) {
        // 用最后一个 = 分隔（选择器里常常带 = ，路径里基本不会）
        const eq = spec.lastIndexOf('=');
        const sel = spec.slice(0, eq);
        const filePath = path.resolve(spec.slice(eq + 1));
        try {
          const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel });
          await send('DOM.setFileInputFiles', { files: [filePath], nodeId: node.nodeId });
          report.fileInputs.push({ selector: sel, file: filePath, ok: true });
        } catch (e) {
          report.fileInputs.push({ selector: sel, file: filePath, ok: false, error: String(e.message || e) });
        }
      }
      await sleep(1500);
    }
    for (const sel of CLICKS2) {
      report.clicks.push(await realClick(sel));
      await sleep(1200); // 连续点击之间留出界面反应时间（页面切换/弹层展开）
    }
    if (CLICKS2.length) await sleep(2500);
    for (const expr of EVALS2) {
      try {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        report.evals.push({ expr, value: r.result?.value ?? null });
      } catch (e) {
        report.evals.push({ expr, error: String(e.message || e) });
      }
    }
  }

  if (SHOT) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
    report.screenshot = SHOT;
  }

  // --out <路径>：把第一个 eval 的字符串结果写到文件（用于把页面生成的 HTML 落盘检查）
  if (OUT_FILE && typeof report.evals[0]?.value === 'string') {
    fs.writeFileSync(OUT_FILE, report.evals[0].value, 'utf8');
    report.outFile = OUT_FILE;
    report.outBytes = Buffer.byteLength(report.evals[0].value, 'utf8');
    report.evals[0] = { expr: report.evals[0].expr, value: `(已写入 ${OUT_FILE})` };
  }

  console.log(JSON.stringify(report, null, 2));
  ws.close();
  if (ATTACH) process.exit(0); // 附着模式不动别人的程序
  proc.kill();
  await sleep(300);
  try { execSync(`rmdir /s /q "${profile}"`, { stdio: 'ignore' }); } catch { /* ignore */ }
  process.exit(0);
})().catch((e) => {
  console.error('检查失败:', e.message);
  process.exit(1);
});
