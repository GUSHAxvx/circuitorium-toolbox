# CIRCUITORIUM 工具箱

> 「从一个元器件，到完成一个项目。」

一个能**拷走、能传下去**的本地电子工具箱：认元件、记清单、写教程、做作品，然后把作品打包发出去——
对方双击就能看，收下就能改成自己的版本。

**不用登录、不用联网、不需要 API Key。** 数据存在你自己的电脑里。

---

## 三种用法，挑一个就行

| 想要什么 | 用哪个 | 怎么开始 |
|---|---|---|
| 双击就开一个窗口，像正常软件一样 | **桌面版** | `dist-desktop\CIRCUITORIUM工具箱.exe`（3.6 MB，免安装）<br>或者装一下：`CIRCUITORIUM工具箱-安装包.exe` |
| 拷进 U 盘 / 发到班级群，对方解压就能用 | **便携版** | 整个 `dist-toolbox` 文件夹拷过去 → 双击 `启动.bat` |
| 一台机器当服务器，多人登录、有社区和分享链接 | **服务器版** | `npm run dev` → 打开 http://localhost:3000 |

桌面版和便携版的界面是同一份（静态导出），功能完全一样；服务器版多出登录、社区广场、公开分享链接。

## 它怎么把作品传下去

```
老师：做好作品 → 分享作品
        ├── 分享页   一个 HTML 文件，微信/U盘发出去，对方双击就能看，点一下存进自己的工具箱
        ├── 作品码   小作品压成一串码（CTW1-…），可以投屏成二维码让学生扫
        └── 作品文件 一个 .ecp 文件，图片原样保留，适合大作品和长期存档

学生：收下作品 → 做同款（复制一份再改，原件不动）→ 改成自己的 → 再发给下一个人
```

作品文件里**只有作品本身**：不会带上你的识别凭据、本机设置、访问令牌或文件路径（`manifest.json` 里明确写了排除了什么）。

## 开发

```bash
npm install
npm run dev            # 服务器版（开发）
npm run build          # 服务器版（生产构建）
npm run build:portable # 便携版 → dist-toolbox/
npm run build:desktop  # 桌面版 exe → D:\rust\target\...\release\（会自动拷到 dist-desktop/）
npm run lint           # 代码检查
```

需要环境变量的话，把 `.env.example` 复制成 `.env` 再填（**只有服务器版需要**，桌面版/便携版不读任何环境变量）。

桌面版额外需要 Rust 工具链；本机的装法、国内镜像与踩过的坑都记在 `工具箱路线图.md` 的「四之十」一节里。

## 目录速览

```
src/app/toolbox/        本地工具箱（不登录、不联网，桌面版与便携版就是它）
src/app/projects|community|templates|recognize|login ...
                        服务器版：项目、社区、模板、AI 识别、登录
src/components/ProjectDetailView.tsx
                        作品页本体，一套界面两种数据源（server / local）
src/lib/store/          本地存储（IndexedDB，接口在 types.ts，换成别的实现不用改界面）
src/lib/ecp/            作品文件 .ecp 的读写与校验
src/lib/share/          自包含分享页、作品码
src/lib/ai/             AI 识别（可选）：三种模式、老师配置码
src-tauri/              桌面版外壳（Rust）
tools/                  打包、验证与回归脚本（tools/checks/ 是真实浏览器断言）
```

## 验证过的，不是"应该能用"

`tools/checks/` 里有 27 个真实浏览器断言脚本（`tools/browser-check.cjs` 驱动，能等 IndexedDB、能断网、能连桌面版的 WebView），
逐条验过：断网能用、无 Key 能分享、分享不含 Key、解压即用、作品收到后能改能再分享、学生界面不出现任何技术黑话。
结果都记在 `工具箱路线图.md`。

## 文档

| 文件 | 给谁看 |
|---|---|
| `工具箱路线图.md` | 想了解全貌、验收结果、技术选型与踩坑的人（主文档） |
| `课程演示指南.md` | 上课演示的脚本：演示账号、演示流程、备用方案 |
| `部署指南.md` | 把服务器版放到一台机器上长期跑 |
| `代理部署说明.md` | 给 AI 识别配一个中转（真 Key 留在服务器环境变量里） |
| `dist-desktop/使用说明.txt` | 直接给老师/学生看的一页说明 |

---

数据在你手里，作品随身走。<sub>LICENSE: 待定（还没有加）</sub>
