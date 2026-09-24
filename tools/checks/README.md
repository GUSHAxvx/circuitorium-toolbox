# 回归检查脚本（真实浏览器）

这里的 JSON 文件是给 `tools/browser-check.cjs` 用的断言脚本。写在文件里而不是命令行，
是因为中文经命令行传参会乱码（`--script` 用 UTF-8 读文件，稳）。

## 用法

```powershell
# 先起开发服务：npm run dev   （或起便携版：dist-toolbox\启动.bat）
cd C:\Users\Administrator\component-recognition-deploy

# ① 本地作品页：结构 + 描述编辑 + 加元件 + AI 入口 + 分享弹层
node tools/browser-check.cjs --url http://127.0.0.1:3000/toolbox --wait 8000 `
  --script tools/checks/local-detail.json --width 1440 --height 1700

# ② 改写后刷新，验证真的落到本机存储
node tools/browser-check.cjs --url http://127.0.0.1:3000/toolbox --wait 8000 `
  --script tools/checks/local-persist-1.json --then-wait 3500 --reload2 `
  --script2 tools/checks/local-persist-2.json

# ③ 断网后继续改（本地优先）
node tools/browser-check.cjs --url http://127.0.0.1:3000/toolbox --wait 8000 `
  --then-wait 800 --offline-late --script2 tools/checks/local-offline.json

# ④ 导出作品文件，检查 zip 结构与"不含凭据"
node tools/browser-check.cjs --url http://127.0.0.1:3000/toolbox --wait 8000 `
  --script tools/checks/local-export-ecp.json

# ⑤ 服务器版项目页没被改坏（演示账号一键登录）
node tools/browser-check.cjs --url http://127.0.0.1:3000/login --wait 7000 `
  --script tools/checks/demo-login.json --then-wait 6000 `
  --script2 tools/checks/server-detail.json
```

便携版验证：把 `--url` 换成 `http://127.0.0.1:8734/toolbox/`（先跑 `启动.bat`）。

## 说明

- 每个脚本用一次性的浏览器配置目录，**不会碰你平时用的数据**
- 需要真实点击（下载这类要用户手势）时用 `--click/--click2 <CSS选择器>`
- `--script2` 里的断言在 `--then-wait` 之后跑；配 `--reload2` 可以验证"刷新后还在"
