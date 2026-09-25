# 内置元件库（开发用流水线）

给工具箱做一个**面向初学者的元件库**：每个元件一张图 + 技术参数 + 口语化教学文案，最终打包进软件、离线可用。

> 这个目录是**开发流程**，不是给学生看的资料。学生界面上不会出现 Fritzing、SVG、JSON 这些词（见下方"集成"一节）。

---

## ⚠️ 先看这条：图形素材的许可

元件图形来自 [Fritzing 元件库](https://github.com/fritzing/fritzing-parts)，其图形与文档采用
**CC BY-SA 3.0**（署名 + 相同方式共享）。原文（仓库 `LICENSE.txt`）：

> All graphics and documentation of Fritzing are licensed under Creative Commons Attribution-ShareALike 3.0 Unported.
> …as long as you credit us, and publish your works under the same license.

也就是说，**只要用了这些图，就要署名 Fritzing，并且这些图形的衍生作品也要以相同方式共享**。
三条路，选一条（**目前还没定，等你拍板**）：

| 选择 | 做法 | 代价 |
|---|---|---|
| A. 用 Fritzing 图 + 署名 | 应用里加一句"元件图形来自 Fritzing（CC BY-SA 3.0）"，仓库里单独标注素材许可 | 图形部分要 CC BY-SA；代码许可照旧（分开标注即可） |
| B. 自己画 | 用简单几何图形重绘这些元件（电阻色环、LED 外形…） | 要花时间，但完全没有授权负担 |
| C. 先内部用 | 现在只在本地跑通流程，等确定发布方式再决定 | 不能马上打包给学生 |

**当前状态**：`data/images/` 与 `data/svg_raw/` 都**没有提交进仓库**（见 .gitignore），
就是为了等你决定许可之后再说。

---

## 目录

```
component-db/
  scripts/
    parts.json            要提取哪些元件（id → Fritzing 仓库里的路径）
    extract_fritzing.py   从 Fritzing 仓库提取技术参数 + 四视图 SVG
    render_images.mjs     SVG → 统一风格的 PNG（白底 512×512，压缩）
    merge_validate.py     合并技术参数与教学文案，校验后输出 components.json
    generate_text.py      （可选）批量生成教学文案，走 OpenAI 兼容接口
  data/
    component_names.txt   30 个核心元件清单与进度
    fritzing_raw.json     ① 提取产物：技术参数 + 引脚 + 图片路径
    components_text.json  ② 教学文案（AI 撰写 + 人工校对，verified 标记）
    components.json       ③ 最终产物（给软件用）
    images/<id>.png       元件图（生成物，当前未提交）
    svg_raw/<id>/*.svg    原始 SVG（中间产物，未提交）
```

## 怎么跑

```powershell
# 0) 一次性：拉 Fritzing 元件库（只拉目录树，按需取文件，不用全量下载）
git clone --filter=blob:none --no-checkout --depth 1 https://github.com/fritzing/fritzing-parts.git D:\fritzing-parts

cd C:\Users\Administrator\component-recognition-deploy\component-db

# 1) 提取技术参数与 SVG
python scripts\extract_fritzing.py                 # 全部（按 parts.json）
python scripts\extract_fritzing.py --only resistor led

# 2) 渲染元件图（复用项目里的 sharp，不需要装 Python 图像库）
node scripts\render_images.mjs

# 3) 合并 + 校验 → data/components.json
python scripts\merge_validate.py --strict

# 可选：扩到更多元件时批量生成文案（需要自己的识别凭据）
python scripts\generate_text.py --dry-run          # 只看提示词
python scripts\generate_text.py --only buzzer relay
```

## 字段说明

| 字段 | 来源 | 说明 |
|---|---|---|
| `id` / `name` / `aliases` | 人工 | 我们的短名与中文常用名、别名 |
| `category` | 人工 | 基础元件 / 电源 / 开关 / 输出 / 传感器 / 模块 / 工具 |
| `purpose` ≤30 字 | **AI 撰写** | 一句话作用，中学生能懂 |
| `appearance` ≤40 字 | **AI 撰写** | 怎么认出来 |
| `polarity` | **AI 撰写** | 有没有正负极、怎么区分 |
| `commonMistakes` 2-3 条 ≤25 字 | **AI 撰写** | 常见错误 |
| `howToRead` | **AI 撰写** | 怎么读参数 / 认方向 |
| `usedInProjects` ≤3 | **AI 撰写** | 适合做什么入门项目 |
| `pinCount` / `pinNames` | **Fritzing** | 引脚数与引脚名（如 LED 的 anode/cathode） |
| `package` / `family` / `specs` | **Fritzing** | 封装、家族、其余技术属性（阻值、容值、型号…） |
| `image` | 生成 | `images/<id>.png` |
| `imageCredit` | 固定 | 图形署名（CC BY-SA 3.0） |
| `verified` | 人工 | 抽查校对通过才改 `true` |

## 当前进度

| 项 | 状态 |
|---|---|
| 流程跑通（提取 → 渲染 → 合并 → 校验） | ✅ 5 个元件全流程通过 |
| 已完成的元件 | 电阻、发光二极管、陶瓷电容、三极管（NPN）、二极管 |
| 图片体积 | 合计 18.9 KB，最大 4.9 KB（上限 50 KB/张）✅ |
| 校验 | 长度、分类、条数、图片存在与体积 **全部通过** ✅ |
| 剩余 25 个 | 见 `data/component_names.txt`（已列好，含建议顺序） |
| 集成进软件 | ⬜ 未做（见下） |

## 集成到软件（未做，任务书第 5 步）

计划：
1. `components.json` + `images/` 拷进应用（放 `public/` 让静态导出一起打包）
2. 首次运行写入本地存储（和现有示例作品、模板一个路子）
3. 元件卡片：图 + 名称 + 一句话作用；点开看详情（作用 / 怎么认 / 正负极 / 常见错误 / 怎么读参数）
4. 加"补充元件资料"入口（用户可改图改说明，存本地，标记 `source: user_submitted`）
5. 加"导出元件包"按钮，可分享给他人
6. **界面用词检查**：不出现 Fritzing / SVG / JSON / 数据库 等词（跑 `tools/checks/wording-audit.json`）

体积预算：30 个元件图 ≈ 150 KB（按 5 KB/张估），远低于"整体 30 MB"的限制。

## 已知限制

- `render_images.mjs` 用的是 Node + sharp（项目已有依赖）；Python 侧只用标准库，不需要 `pip install`
- Fritzing 里同一元件有多种变体（比如电阻有 4 环/5 环、贴片/直插），`parts.json` 里挑的是**直插、最常见**的那款
- 元件图目前只用面包板视图；原理图/PCB 视图也提取了，需要时可在界面上切换
- 文案长度限制（30/40/25 字）是任务书要求，`merge_validate.py --strict` 会拦住超长
