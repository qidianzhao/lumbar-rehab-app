"""
扫描 ldh_video 目录，生成 video_mapping.json。
用法: python backend/scripts/sync_videos.py
"""

import json
import os
from pathlib import Path

VIDEO_ROOT = Path("C:/belearning/ldh_video")
BASE_URL = "http://192.168.5.119:8080"
OUT_FILE = Path(__file__).parent.parent / "video_mapping.json"

# 中文动作名 -> 英文关键词列表（顺序即优先级）
NAME_TO_KEYWORDS: dict[str, list[str]] = {
    "臀桥":           ["glute-bridge"],
    "鸟狗式":         ["bird-dog"],
    "死虫式":         ["dead-bug"],
    "平板支撑":       ["forearm-plank"],
    "平板支撑（膝落地）": ["knee-plank-up-down", "forearm-plank"],
    "侧桥（膝支撑）": ["elbow-side-plank"],
    "侧桥（足支撑）": ["hand-side-plank"],
    "猫牛式":         ["thoracic-flexion-and-extensions"],
    "骨盆后倾练习":   ["lumbar-rotation"],
    "仰卧踝泵":       ["dorsal-flexion"],
    "腹式呼吸激活":   ["core-stability"],
    "侧卧蚌式热身":   ["clamshells"],
    "侧卧蚌式":       ["clamshells"],
    "跪姿髋环绕":     ["hip-openers"],
    "仰卧抱膝拉伸":   ["knee-pull-and-lumbar-rotation", "lumbar-flexion-knee-pull"],
    "腘绳肌拉伸":     ["hamstring-stretch"],
    "梨状肌拉伸":     ["glute-hip-rotator-stretch", "glute-stretch-static"],
    "腰方肌侧弯拉伸": ["lat-and-lateral-line-stretch", "lateral-line-stretch"],
    "胸腰椎旋转拉伸": ["lumbar-rotation"],
    "婴儿式放松":     ["prayer-stretch"],
    "坐位体前屈":     ["deadlift-bounces-stretch"],
}


def all_videos() -> list[Path]:
    return sorted(VIDEO_ROOT.rglob("*.mp4"))


def pick_best(candidates: list[Path]) -> Path:
    """优先选 front 视图，无重复后缀的文件。"""
    front = [p for p in candidates if "front" in p.stem and "(" not in p.name]
    if front:
        return front[0]
    clean = [p for p in candidates if "(" not in p.name]
    return (clean or candidates)[0]


def build_mapping() -> dict[str, str]:
    videos = all_videos()
    mapping: dict[str, str] = {}

    for name, keywords in NAME_TO_KEYWORDS.items():
        matched: list[Path] = []
        for kw in keywords:
            matched = [v for v in videos if kw in v.stem.lower()]
            if matched:
                break
        if not matched:
            continue
        best = pick_best(matched)
        # 构造 URL：将 Windows 路径转为相对于 VIDEO_ROOT 的 URL 路径
        rel = best.relative_to(VIDEO_ROOT).as_posix()
        mapping[name] = f"{BASE_URL}/{rel}"

    return mapping


if __name__ == "__main__":
    mapping = build_mapping()
    OUT_FILE.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"写入 {OUT_FILE}，共 {len(mapping)} 条映射：")
    for k, v in mapping.items():
        print(f"  {k}: {v}")
