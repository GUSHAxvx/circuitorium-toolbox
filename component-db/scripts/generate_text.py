#!/usr/bin/env python3
"""（可选）批量生成教学文案：调用项目里已有的 AI 接口，不部署本地模型。

为什么是"可选"：5 个测试元件的文案是 AI（助手）直接写的，已经落在
data/components_text.json 里。要扩到 30 个时，用这个脚本批量生成更省事。

用法：
    # 先看提示词长什么样（不联网、不需要 Key）
    python scripts/generate_text.py --dry-run --only capacitor-electrolytic buzzer

    # 真正生成（OpenAI 兼容接口）
    set OPENAI_API_KEY=sk-xxx
    set OPENAI_BASE_URL=https://api.openai.com/v1     # 走中转就填中转地址
    set OPENAI_MODEL=gpt-4o
    python scripts/generate_text.py --out data/components_text_batch2.json

注意：
    - 输出只写新文件，不会覆盖已校对好的 data/components_text.json
    - 生成完必须人工抽查，然后把 verified 改成 true
    - 本机没有本地大模型；RTX 4060 8GB 也不到 Qwen3-VL-8B 建议的 12GB
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

PROMPT = """你是电子入门教材编辑，面向刚接触电子的中学生。

为下面每个元件输出一条 JSON，字段：
- id：英文小写短名
- name：中文常用名
- aliases：别名，最多 3 个
- category：从【基础元件、电源、开关、输出、传感器、模块、工具】选一个
- purpose：≤30 字，口语化
- appearance：≤40 字
- polarity：有没有正负极，怎么区分
- commonModels：常见型号，最多 5 个
- pinCount：数字
- package：封装形式
- commonMistakes：2-3 条，每条 ≤25 字
- howToRead：一句话
- usedInProjects：最多 3 个
- tags：最多 3 个
- verified：false

要求：
1. 口语化，像老师讲课。
2. 不确定的留空，不要编造。
3. 只输出 JSON 数组，不要解释。
4. 顺序和输入一致。

已知技术参数（来自元件库，权威，不要改）：
{tech}

元件名单：
{names}
"""


def extract_json(text: str):
    """模型有时会裹一层 ```json，这里抠出数组"""
    start = text.find("[")
    end = text.rfind("]")
    if start < 0 or end < 0:
        raise ValueError("返回里没有 JSON 数组")
    return json.loads(text[start:end + 1])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="只生成这些 id")
    parser.add_argument("--out", default="data/components_text_batch.json")
    parser.add_argument("--dry-run", action="store_true", help="只打印提示词")
    parser.add_argument("--names", nargs="*", help="直接给中文元件名（不给就用 parts.json 里缺文案的）")
    args = parser.parse_args()

    raw_path = DATA / "fritzing_raw.json"
    tech_by_id = {}
    if raw_path.exists():
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
        for part in raw["parts"]:
            tech_by_id[part["id"]] = {
                "title": part["title"],
                "family": part["properties"].get("family", ""),
                "package": part["properties"].get("package", ""),
                "pinCount": part["pinCount"],
                "pinNames": [c["name"] for c in part["connectors"]],
                "specs": {k: v for k, v in part["properties"].items() if v},
            }

    ids = args.only or list(tech_by_id)
    names = args.names or [f"{i}（{tech_by_id.get(i, {}).get('title', '')}）" for i in ids]
    tech = json.dumps({i: tech_by_id.get(i, {}) for i in ids}, ensure_ascii=False, indent=2)
    prompt = PROMPT.replace("{tech}", tech).replace("{names}", "\n".join(names))

    if args.dry_run:
        print(prompt)
        print(f"\n[文案] dry-run：本次会处理 {len(ids)} 个元件，未调用任何接口")
        return 0

    key = os.environ.get("OPENAI_API_KEY", "")
    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")
    if not key:
        print("[文案] 没有 OPENAI_API_KEY。要么先设置环境变量，要么用 --dry-run 看提示词，", file=sys.stderr)
        print("       要么直接手写 data/components_text.json（5 个测试元件就是这么来的）。", file=sys.stderr)
        return 1

    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    print(f"[文案] 调用 {base}（模型 {model}），{len(ids)} 个元件…")
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    content = payload["choices"][0]["message"]["content"]
    items = extract_json(content)

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.write_text(
        json.dumps({"_comment": "AI 生成，未校对（verified 应为 false）", "components": items},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[文案] 生成 {len(items)} 条 → {out_path}")
    print("[文案] 下一步：人工抽查 → 把 verified 改成 true → 合并进 components_text.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
