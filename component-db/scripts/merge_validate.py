#!/usr/bin/env python3
"""合并「Fritzing 技术参数」与「教学文案」，校验后输出最终 components.json。

用法：
    python scripts/merge_validate.py            # 合并 + 校验
    python scripts/merge_validate.py --strict   # 有任何一条不合规就以非零退出（给 CI / 发版用）

校验规则（对应任务书的验收标准）：
    id 唯一 · 必填字段不缺 · category 在允许列表内
    purpose ≤30 字 · appearance ≤40 字 · commonMistakes 2-3 条且每条 ≤25 字
    aliases ≤3 · commonModels ≤5 · usedInProjects ≤3 · tags ≤3
    图片存在且 <50KB
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

CATEGORIES = ["基础元件", "电源", "开关", "输出", "传感器", "模块", "工具"]
LIMITS = {
    "purpose": 30,
    "appearance": 40,
    "mistake": 25,
    "aliases": 3,
    "commonModels": 5,
    "usedInProjects": 3,
    "tags": 3,
    "imageBytes": 50 * 1024,
}


def load(name: str) -> dict:
    path = DATA / name
    if not path.exists():
        raise SystemExit(f"[合并] 缺少文件：{path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    raw = load("fritzing_raw.json")
    texts = load("components_text.json")
    raw_by_id = {p["id"]: p for p in raw["parts"]}
    text_by_id = {c["id"]: c for c in texts["components"]}

    problems: list[str] = []
    merged = []

    # 文案里有、但没提取到素材的元件
    for cid in text_by_id:
        if cid not in raw_by_id:
            problems.append(f"{cid}：文案有，但 fritzing_raw.json 里没有（先跑 extract_fritzing.py）")

    seen_ids = set()
    for cid, tech in raw_by_id.items():
        text = text_by_id.get(cid)
        if text is None:
            problems.append(f"{cid}：缺少教学文案")
            continue
        if cid in seen_ids:
            problems.append(f"{cid}：id 重复")
        seen_ids.add(cid)

        item = {
            "id": cid,
            "name": text.get("name", ""),
            "aliases": text.get("aliases", []),
            "category": text.get("category", ""),
            "purpose": text.get("purpose", ""),
            "appearance": text.get("appearance", ""),
            "polarity": text.get("polarity", ""),
            "commonModels": text.get("commonModels", []),
            "howToRead": text.get("howToRead", ""),
            "commonMistakes": text.get("commonMistakes", []),
            "usedInProjects": text.get("usedInProjects", []),
            "tags": text.get("tags", []),
            # —— 技术参数：来自 Fritzing，不要手改 ——
            "pinCount": tech["pinCount"],
            "pinNames": [c["name"] for c in tech["connectors"]],
            "package": tech["properties"].get("package", ""),
            "family": tech["properties"].get("family", ""),
            "specs": {k: v for k, v in tech["properties"].items() if v},
            "sourceTitle": tech["title"],
            # —— 资源与出处 ——
            "image": f"images/{cid}.png",
            "source": "fritzing + ai",
            "imageCredit": "元件图形来自 Fritzing（CC BY-SA 3.0）",
            "verified": bool(text.get("verified", False)),
        }

        # 必填
        for field in ("name", "category", "purpose", "appearance", "polarity", "howToRead"):
            if not item[field]:
                problems.append(f"{cid}：{field} 不能为空")
        if item["category"] not in CATEGORIES:
            problems.append(f"{cid}：category「{item['category']}」不在允许列表 {CATEGORIES}")

        # 长度
        if len(item["purpose"]) > LIMITS["purpose"]:
            problems.append(f"{cid}：purpose {len(item['purpose'])} 字，超过 {LIMITS['purpose']}")
        if len(item["appearance"]) > LIMITS["appearance"]:
            problems.append(f"{cid}：appearance {len(item['appearance'])} 字，超过 {LIMITS['appearance']}")
        if not 2 <= len(item["commonMistakes"]) <= 3:
            problems.append(f"{cid}：commonMistakes 要 2-3 条，现在是 {len(item['commonMistakes'])}")
        for mk in item["commonMistakes"]:
            if len(mk) > LIMITS["mistake"]:
                problems.append(f"{cid}：常见错误「{mk}」{len(mk)} 字，超过 {LIMITS['mistake']}")
        for field in ("aliases", "commonModels", "usedInProjects", "tags"):
            if len(item[field]) > LIMITS[field]:
                problems.append(f"{cid}：{field} 最多 {LIMITS[field]} 条，现在 {len(item[field])}")

        # 图片
        image_path = DATA / item["image"]
        if not image_path.exists():
            problems.append(f"{cid}：找不到图片 {item['image']}（先跑 render_images.mjs）")
            item["imageBytes"] = 0
        else:
            size = image_path.stat().st_size
            item["imageBytes"] = size
            if size > LIMITS["imageBytes"]:
                problems.append(f"{cid}：图片 {size/1024:.1f} KB，超过 50 KB")

        merged.append(item)

    merged.sort(key=lambda x: (CATEGORIES.index(x["category"]) if x["category"] in CATEGORIES else 99, x["id"]))

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(merged),
        "source": raw.get("source", {}),
        "textSource": "教学文案由 AI 撰写、人工校对（verified 字段标记是否已校对）",
        "components": merged,
    }
    dest = DATA / "components.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    total_img = sum(c["imageBytes"] for c in merged)
    print(f"[合并] {len(merged)} 个元件 → {dest}")
    print(f"[合并] 图片合计 {total_img/1024:.1f} KB，最大 "
          f"{max((c['imageBytes'] for c in merged), default=0)/1024:.1f} KB")
    by_cat: dict[str, int] = {}
    for c in merged:
        by_cat[c["category"]] = by_cat.get(c["category"], 0) + 1
    print("[合并] 分类：" + "、".join(f"{k} {v}" for k, v in by_cat.items()))
    print(f"[合并] 已校对：{sum(1 for c in merged if c['verified'])}/{len(merged)}")

    if problems:
        print(f"\n[校验] 发现 {len(problems)} 个问题：")
        for p in problems:
            print(f"  ✗ {p}")
        if args.strict:
            return 1
    else:
        print("\n[校验] 全部通过 ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
