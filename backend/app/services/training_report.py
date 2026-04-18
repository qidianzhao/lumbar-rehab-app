"""训练完成率、时长与总结（规则模板，可替换为 LLM）。"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.training import TrainingRecord


def calculate_completion_rate(records: list[TrainingRecord]) -> float:
    if not records:
        return 0.0
    parts: list[float] = []
    for r in records:
        if r.is_skipped:
            parts.append(0.0)
            continue
        if r.is_completed:
            parts.append(1.0)
            continue
        ps = max(1, r.planned_sets)
        pr = max(1, r.planned_reps)
        as_ = max(0, r.actual_sets)
        ar = max(0, r.actual_reps)
        parts.append(min(1.0, ((as_ / ps) + (ar / pr)) / 2))
    return round(100.0 * sum(parts) / len(parts), 1)


def calculate_duration_seconds(started_at: datetime, ended_at: datetime) -> int:
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    if ended_at.tzinfo is None:
        ended_at = ended_at.replace(tzinfo=timezone.utc)
    delta = ended_at - started_at
    return max(0, int(delta.total_seconds()))


def format_duration_display(seconds: int) -> str:
    s = max(0, seconds)
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}小时{m}分{s}秒"
    if m > 0:
        return f"{m}分{s}秒"
    return f"{s}秒"


def generate_ai_summary(records: list[TrainingRecord], completion_rate: float) -> str:
    done = sum(1 for r in records if r.is_completed and not r.is_skipped)
    skipped = sum(1 for r in records if r.is_skipped)
    total = len(records)
    return (
        f"本次训练完成率约 {completion_rate:.0f}%（共 {total} 个动作），"
        f"其中完成 {done} 个，跳过 {skipped} 个。"
        "建议保持规律训练，优先保证动作质量与无痛范围。"
    )
