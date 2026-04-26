from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from app.services.deepseek_service import chat_with_reasoning

logger = logging.getLogger(__name__)

_BASE_SYSTEM_PROMPT = """你是"小核"，一位专业、友善的运动健身教练，专注于腰椎间盘突出康复期人群的核心力量训练指导。你是运动教练，不是医生。绝不提供医疗诊断或治疗建议。"""

_ASSESSMENT_SYSTEM = _BASE_SYSTEM_PROMPT + """

## 当前场景：体能测试评估

根据测试数据分析用户身体能力水平，识别薄弱环节，给出综合评级。

评分标准：
- 核心耐力（平板支撑）：<30s→0-40分，30-60s→40-70分，>60s→70-100分
- 臀部力量（臀桥）：<10次→0-40分，10-20次→40-70分，>20次→70-100分
- 脊柱稳定性（鸟狗式）：<6次→0-40分，6-12次→40-70分，>12次→70-100分
- 核心控制（死虫式）：<6次→0-40分，6-12次→40-70分，>12次→70-100分
- 脊柱灵活性（猫牛式自评1-5）：1-2→0-40分，3-4→40-70分，5→70-100分
- 后链柔韧性（坐位体前屈自评1-5）：1-2→0-40分，3-4→40-70分，5→70-100分

综合评级：平均分<45→BEGINNER，45-65→INTERMEDIATE，>65→ADVANCED。
特殊规则：任意2个维度低于30分，即使平均分达到中级仍评为BEGINNER。

严格按以下JSON格式输出，不含任何JSON之外的文字：
{
  "overall_level": "BEGINNER|INTERMEDIATE|ADVANCED",
  "scores": {
    "core_endurance": 0,
    "glute_strength": 0,
    "spine_stability": 0,
    "core_control": 0,
    "spine_mobility": 0,
    "flexibility": 0
  },
  "weak_areas": ["薄弱维度中文名"],
  "ai_summary": "3-5句综合评价，鼓励语气",
  "suggested_plan_level": "beginner|intermediate|advanced"
}"""


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


def _clamp(x: float) -> int:
    return int(max(0, min(100, round(x))))


def _linear_score(value: float, *, min_v: float, max_v: float) -> int:
    if value <= min_v:
        return 0
    if value >= max_v:
        return 100
    return _clamp((value - min_v) / (max_v - min_v) * 100.0)


def _rating_score(value: float) -> int:
    v = max(1.0, min(5.0, value))
    return _clamp((v - 1.0) / 4.0 * 80.0 + 20.0)


def _rule_based_scores(raw: dict[str, float]) -> dict[str, int]:
    return {
        "core_endurance": _linear_score(raw.get("core_endurance_seconds", 0), min_v=10, max_v=120),
        "glute_strength": _linear_score(raw.get("glute_bridge_reps", 0), min_v=5, max_v=40),
        "spine_stability": _linear_score(raw.get("bird_dog_reps", 0), min_v=5, max_v=30),
        "core_control": _linear_score(raw.get("dead_bug_reps", 0), min_v=5, max_v=30),
        "spine_mobility": _rating_score(raw.get("spine_mobility_rating", 1)),
        "flexibility": _rating_score(raw.get("flexibility_rating", 1)),
    }


def _fallback(raw: dict[str, float]) -> AssessmentResult:
    scores = _rule_based_scores(raw)
    avg = sum(scores.values()) / len(scores)
    level = "BEGINNER" if avg < 55 else ("INTERMEDIATE" if avg < 78 else "ADVANCED")
    suggested = level.lower()
    weak = [DIMENSIONS.get(k, k) for k, _ in sorted(scores.items(), key=lambda x: x[1])[:2]]
    strong = [DIMENSIONS.get(k, k) for k, _ in sorted(scores.items(), key=lambda x: x[1], reverse=True)[:2]]
    summary = (
        f"综合评级：{level}。优势维度：{strong[0]}、{strong[1]}；"
        f"薄弱环节：{weak[0]}、{weak[1]}。建议循序渐进，保持无痛范围训练。"
    )
    return AssessmentResult(scores=scores, overall_level=level, weak_areas=weak,
                            ai_summary=summary, suggested_plan_level=suggested)


async def assess_user(raw: dict[str, float]) -> AssessmentResult:
    user_prompt = f"""体能测试结果：
1. 平板支撑（核心耐力）：{raw.get('core_endurance_seconds', 0):.0f}秒
2. 臀桥（臀部力量）：{raw.get('glute_bridge_reps', 0):.0f}次
3. 鸟狗式（脊柱稳定性）：{raw.get('bird_dog_reps', 0):.0f}次
4. 死虫式（核心控制）：{raw.get('dead_bug_reps', 0):.0f}次
5. 猫牛式（脊柱灵活性）：自评{raw.get('spine_mobility_rating', 1):.0f}/5
6. 坐位体前屈（后链柔韧性）：自评{raw.get('flexibility_rating', 1):.0f}/5

请严格按JSON格式输出评估结果。"""

    try:
        content = await chat_with_reasoning([
            {"role": "system", "content": _ASSESSMENT_SYSTEM},
            {"role": "user", "content": user_prompt},
        ])
        # 提取 JSON（模型可能包裹在 ```json ... ``` 中）
        text = content.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())

        scores_raw = data.get("scores", {})
        scores = {k: _clamp(float(v)) for k, v in scores_raw.items()}
        # 确保所有维度都有值，缺失的用规则引擎补
        rule_scores = _rule_based_scores(raw)
        for k in rule_scores:
            if k not in scores:
                scores[k] = rule_scores[k]

        weak_areas = data.get("weak_areas", [])
        if not isinstance(weak_areas, list):
            weak_areas = []
        weak_areas = [str(w) for w in weak_areas]

        return AssessmentResult(
            scores=scores,
            overall_level=str(data.get("overall_level", "BEGINNER")).upper(),
            weak_areas=weak_areas,
            ai_summary=str(data.get("ai_summary", "")),
            suggested_plan_level=str(data.get("suggested_plan_level", "beginner")).lower(),
        )
    except Exception as e:
        logger.warning("DeepSeek assessment failed, falling back to rule engine: %s", e)
        return _fallback(raw)
