#!/usr/bin/env python3
"""从 Fritzing 元件库提取元件的技术参数与图形素材。

数据来源：fritzing/fritzing-parts（图形为 CC BY-SA 3.0，见 元件数据库/README.md）
本脚本只用 Python 标准库：git 取文件、ElementTree 解析 XML。

用法：
    python 脚本/extract_fritzing.py                 # 用 脚本/parts.json 里的清单
    python 脚本/extract_fritzing.py --only resistor led
    python 脚本/extract_fritzing.py --repo D:\\fritzing-parts --out data

产物：
    数据/fritzing_raw.json      技术参数 + 各视图 SVG 的相对路径
    数据/svg_raw/<id>/*.svg     原始 SVG（中间产物，可重新生成）
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                      # 元件数据库/
DEFAULT_REPO = Path(r"D:\fritzing-parts")
DEFAULT_OUT = ROOT / "数据"

# Windows 上控制台默认是 GBK，中文和 ✓ 会直接抛 UnicodeEncodeError
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

# 四视图：面包板图最直观，优先用它做元件图
VIEWS = ("breadboardView", "iconView", "schematicView", "pcbView")
VIEW_ALIAS = {
    "breadboardView": "breadboard",
    "iconView": "icon",
    "schematicView": "schematic",
    "pcbView": "pcb",
}


def git(repo: Path, *args: str) -> bytes:
    """调用 git（部分克隆会在取 blob 时按需联网拉取）"""
    proc = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} 失败：{proc.stderr.decode('utf-8', 'replace').strip()}"
        )
    return proc.stdout


def load_index(repo: Path) -> dict[str, str]:
    """ls-tree -r HEAD → {仓库路径: blob sha}"""
    out = git(repo, "ls-tree", "-r", "HEAD").decode("utf-8", "replace")
    index: dict[str, str] = {}
    for line in out.splitlines():
        if "\t" not in line:
            continue
        meta, path = line.split("\t", 1)
        parts = meta.split()
        if len(parts) >= 3:
            index[path] = parts[2]
    return index


def cat_blob(repo: Path, sha: str) -> bytes:
    return git(repo, "cat-file", "-p", sha)


def text_of(node: ET.Element | None) -> str:
    if node is None or node.text is None:
        return ""
    return " ".join(node.text.split())


def parse_fzp(xml_bytes: bytes) -> dict:
    """解析 .fzp（Fritzing 的元件定义，本质是 XML）"""
    root = ET.fromstring(xml_bytes)

    properties = {}
    for prop in root.iter("property"):
        name = (prop.get("name") or "").strip()
        if not name:
            continue
        # Fritzing 有两种写法：老的是 value 属性，新的是元素文本（<property name="family">Resistor</property>）
        value = (prop.get("value") or "").strip() or text_of(prop)
        properties[name] = value

    connectors = []
    for conn in root.iter("connector"):
        pin_names = []
        for point in conn.iter("p"):
            # 面包板视图里的 svgId 就是丝印上的引脚名（比如 "a" / "GND"）
            if point.get("svgId"):
                pin_names.append(point.get("svgId"))
            if point.get("name"):
                pin_names.append(point.get("name"))
        connectors.append({
            "id": conn.get("id") or "",
            "name": conn.get("name") or "",
            "type": conn.get("type") or "",
            "description": text_of(conn.find("description")),
            "pinLabels": sorted({p for p in pin_names if p and not p.startswith("connector")}),
        })

    images: dict[str, str] = {}
    for layers in root.iter("layers"):
        image = layers.get("image")
        if not image:
            continue
        # 判断这组 layers 属于哪个视图：往上找带 view 名的父节点
        for view in VIEWS:
            parent = None
            for candidate in root.iter():
                if candidate.tag == view:
                    for child in candidate.iter("layers"):
                        if child is layers:
                            parent = view
                            break
                if parent:
                    break
            if parent:
                images[VIEW_ALIAS[parent]] = image
                break

    return {
        "moduleId": root.get("moduleId") or "",
        "fritzingVersion": root.get("fritzingVersion") or "",
        "title": text_of(root.find("title")),
        "description": text_of(root.find("description")),
        "label": text_of(root.find("label")),
        "properties": properties,
        "connectors": connectors,
        "pinCount": len(connectors),
        "images": images,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=str(DEFAULT_REPO))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--only", nargs="*", help="只处理这些 id")
    args = parser.parse_args()

    repo = Path(args.repo)
    out_dir = Path(args.out)
    if not (repo / ".git").exists():
        print(f"[提取] 找不到 Fritzing 仓库：{repo}", file=sys.stderr)
        print("       先克隆一次（只要目录树，不需要全量素材）：", file=sys.stderr)
        print(f"       git clone --filter=blob:none --no-checkout --depth 1 "
              f"https://github.com/fritzing/fritzing-parts.git {repo}", file=sys.stderr)
        return 1

    config = json.loads((HERE / "parts.json").read_text(encoding="utf-8"))
    wanted = config["parts"]
    if args.only:
        wanted = [p for p in wanted if p["id"] in set(args.only)]

    print(f"[提取] 仓库：{repo}")
    index = load_index(repo)
    commit = git(repo, "rev-parse", "HEAD").decode().strip()
    print(f"[提取] commit {commit[:10]}，仓库内 {len(index)} 个文件")

    svg_dir = out_dir / "svg_raw"
    svg_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for part in wanted:
        fzp_path = part["fzp"]
        if fzp_path not in index:
            print(f"  ✗ {part['id']}：仓库里没有 {fzp_path}")
            continue
        data = parse_fzp(cat_blob(repo, index[fzp_path]))
        data["id"] = part["id"]
        data["fzpPath"] = fzp_path

        # 取图形：面包板图优先，另外把图标/原理图也留着备用
        saved: dict[str, str] = {}
        overrides = part.get("svgOverride", {})
        wanted = dict(data["images"])
        for view, path in overrides.items():
            wanted[view] = path  # 覆盖：用指定的 SVG 代替 fzp 里写的那张
            data.setdefault("svgOverrideUsed", {})[view] = path
        for view, image in wanted.items():
            # .fzp 里写的是相对于 svg/core/ 的路径，例如 "breadboard/resistor_220.svg"
            candidates = [f"svg/core/{image}", f"svg/{image}", image]
            for candidate in candidates:
                if candidate in index:
                    raw = cat_blob(repo, index[candidate])
                    dest = svg_dir / part["id"] / Path(image).name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(raw)
                    saved[view] = str(dest.relative_to(out_dir)).replace("\\", "/")
                    break
        data["svgFiles"] = saved
        if "breadboard" not in saved:
            print(f"  ! {part['id']}：没找到面包板图（views={list(data['images']) or '无'}）")

        results.append(data)
        print(f"  ✓ {part['id']:<12} {data['title'][:28]:<30} 引脚 {data['pinCount']}  "
              f"图 {','.join(saved) or '无'}")

    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "fritzing_raw.json"

    # --only 是增量：把这次提取的元件并回已有结果，别把别的元件冲掉
    if args.only and dest.exists():
        try:
            old = json.loads(dest.read_text(encoding="utf-8"))
            keep = [p for p in old.get("parts", []) if p.get("id") not in {r["id"] for r in results}]
            results = keep + results
            print(f"[提取] 增量模式：保留已有 {len(keep)} 个，本次更新 {len(results) - len(keep)} 个")
        except (OSError, ValueError):
            print("[提取] 旧的 fritzing_raw.json 读不出来，按全量重写")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {
            "repo": "https://github.com/fritzing/fritzing-parts",
            "commit": commit,
            "license": "CC BY-SA 3.0（图形）",
            "note": "图形来自 Fritzing 元件库，使用时需署名并以相同方式共享",
        },
        "parts": results,
    }
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[提取] 完成：{len(results)} 个元件 → {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
