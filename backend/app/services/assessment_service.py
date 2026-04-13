from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AssessmentResult:
    scores: dict[str, int]
    overall_level: str
    weak_areas: list[str]
    ai_summary: str
    suggested_plan_level: str


DIMENSIONS: dict[str, str] = {
    "core_endurance": "核心耐力",
    "glute_strength": "臀部力量",
    "spine_stability": "脊柱稳定性",
    "core_control": "核心控制",
    "spine_mobility": "脊柱灵活性",
    "flexibility": "柔韧性",
}


def _clamp_score(x: float) -> int:
    return int(max(0, min(100, round(x))))


def _linear_score(value: float, *, min_v: float, max_v: float) -> int:
    if max_v <= min_v:
        return 0
    if value <= min_v:
        return 0
    if value >= max_v:
        return 100
    return _clamp_score((value - min_v) / (max_v - min_v) * 100.0)


def _rating_1_5_to_score(value: float) -> int:
    # 自评 1..5 -> 20..100
    v = max(1.0, min(5.0, value))
    return _clamp_score((v - 1.0) / 4.0 * 80.0 + 20.0)


def assess_user(raw: dict[str, float]) -> AssessmentResult:
    """
    规则引擎版评估（可运行，可替换为 LLM）。

    raw keys（约定）：
    - core_endurance_seconds: 平板支撑（秒）
    - glute_bridge_reps: 臀桥（次数）
    - bird_dog_reps: 鸟狗式（次数）
    - dead_bug_reps: 死虫式（次数）
    - spine_mobility_rating: 猫牛式自评（1-5）
    - flexibility_rating: 坐位体前屈自评（1-5）
    """

    plank = float(raw.get("core_endurance_seconds", 0))
    glute = float(raw.get("glute_bridge_reps", 0))
    bird = float(raw.get("bird_dog_reps", 0))
    dead = float(raw.get("dead_bug_reps", 0))
    mobility = float(raw.get("spine_mobility_rating", 1))
    flex = float(raw.get("flexibility_rating", 1))

    # 评分基准（可按 PRD 标准后续替换）
    scores: dict[str, int] = {
        "core_endurance": _linear_score(plank, min_v=10, max_v=120),
        "glute_strength": _linear_score(glute, min_v=5, max_v=40),
        "spine_stability": _linear_score(bird, min_v=5, max_v=30),
        "core_control": _linear_score(dead, min_v=5, max_v=30),
        "spine_mobility": _rating_1_5_to_score(mobility),
        "flexibility": _rating_1_5_to_score(flex),
    }

    avg = sum(scores.values()) / max(1, len(scores))
    if avg < 55:
        level = "BEGINNER"
        suggested = "beginner"
    elif avg < 78:
        level = "INTERMEDIATE"
        suggested = "intermediate"
    else:
        level = "ADVANCED"
        suggested = "advanced"

    weak_sorted = sorted(scores.items(), key=lambda kv: kv[1])
    weak_dims = [DIMENSIONS.get(k, k) for k, _ in weak_sorted[:2]]

    highlights = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:2]
    strong_dims = [DIMENSIONS.get(k, k) for k, _ in highlights]

    ai_summary = (
        f"综合评级：{level}。"
        f"优势维度：{strong_dims[0]}、{strong_dims[1]}；"
        f"薄弱环节：{weak_dims[0]}、{weak_dims[1]}。"
        "建议在训练计划中优先加强薄弱维度，循序渐进，保持无痛范围训练。"
    )

    return AssessmentResult(
        scores=scores,
        overall_level=level,
        weak_areas=weak_dims,
        ai_summary=ai_summary,
        suggested_plan_level=suggested,
    )

