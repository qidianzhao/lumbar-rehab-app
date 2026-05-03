"""根据用户等级与偏好从动作库组装训练计划（模板 + 真实 action_id）。"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.action import Action
from app.models.training_plan import DayType, PlanDay, PlanExercise, PlanStatus, TrainingPlan
from app.schemas.training_plan import PlanGenerateRequest

logger = logging.getLogger(__name__)

# 每周训练日：day_number 1=周一 … 7=周日
_FREQ_TRAINING_DAYS: dict[int, list[int]] = {
    2: [2, 5],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
}

_LEVEL_CONFIG: dict[str, dict[str, int | str]] = {
    "beginner": {"estimated_weeks": 8, "max_difficulty": 1, "name": "腰突康复 · 入门计划"},
    "intermediate": {"estimated_weeks": 10, "max_difficulty": 2, "name": "腰突康复 · 进阶计划"},
    "advanced": {"estimated_weeks": 12, "max_difficulty": 3, "name": "腰突康复 · 强化计划"},
}

_WEEKDAY_CN = ["一", "二", "三", "四", "五", "六", "日"]


async def _ai_plan_description(level: str, weekly_freq: int, duration: int, weeks: int) -> str:
    from app.services.deepseek_service import chat_with_reasoning
    level_cn = {"beginner": "入门", "intermediate": "进阶", "advanced": "强化"}.get(level, level)
    prompt = (
        f"为腰突康复用户生成一句训练计划描述（2-3句话，鼓励语气）：\n"
        f"等级：{level_cn}，每周{weekly_freq}天，每次约{duration}分钟，共{weeks}周。\n"
        "只输出描述文字，不要任何标题或格式。"
    )
    try:
        return await chat_with_reasoning([{"role": "user", "content": prompt}])
    except Exception as e:
        logger.warning("DeepSeek plan description failed: %s", e)
        return f"每周 {weekly_freq} 天训练，单次约 {duration} 分钟；结构为热身→核心→拉伸，共 {weeks} 周。"


def _resolve_level(_request: PlanGenerateRequest) -> str:
    # 预留：可根据 assessment_id 查询测评结果映射等级
    return "beginner"


def _warmup_core_stretch_counts(preferred_duration: int) -> tuple[int, int, int]:
    if preferred_duration <= 22:
        return (2, 3, 2)
    if preferred_duration <= 32:
        return (2, 4, 2)
    if preferred_duration <= 40:
        return (3, 4, 3)
    return (3, 4, 3)


def _sets_reps_rest(level: str, preferred_duration: int) -> tuple[int, int, int, int]:
    if level == "intermediate":
        sets, reps, rest, duration = 3, 12, 12, 40
    elif level == "advanced":
        sets, reps, rest, duration = 3, 15, 10, 35
    else:
        sets, reps, rest, duration = 2, 10, 15, 30
    if preferred_duration >= 35:
        reps += 2
    return sets, reps, rest, duration


async def _load_actions_for_phase(
    session: AsyncSession,
    phase: str,
    limit: int,
    max_difficulty: int,
) -> list[Action]:
    q = (
        select(Action)
        .where(Action.phase == phase, Action.difficulty_level <= max_difficulty)
        .order_by(Action.id)
        .limit(limit)
    )
    r = await session.execute(q)
    return list(r.scalars().all())


async def generate_plan(
    user_id: int,
    request: PlanGenerateRequest,
    *,
    session: AsyncSession,
) -> TrainingPlan:
    level = _resolve_level(request)
    cfg = _LEVEL_CONFIG.get(level, _LEVEL_CONFIG["beginner"])
    estimated_weeks = int(cfg["estimated_weeks"])
    max_difficulty = int(cfg["max_difficulty"])
    plan_name = str(cfg["name"])

    wf = request.weekly_frequency
    training_days = _FREQ_TRAINING_DAYS.get(wf, _FREQ_TRAINING_DAYS[3])
    w_need, c_need, s_need = _warmup_core_stretch_counts(request.preferred_duration)
    sets, reps, rest_sec, set_dur = _sets_reps_rest(level, request.preferred_duration)

    warmups = await _load_actions_for_phase(session, "warmup", w_need, max_difficulty)
    cores = await _load_actions_for_phase(session, "core", c_need, max_difficulty)
    stretches = await _load_actions_for_phase(session, "stretch", s_need, max_difficulty)

    if len(warmups) < 2 or len(cores) < 2 or len(stretches) < 2:
        raise ValueError("动作库数据不足，请先初始化动作库")

    description = await _ai_plan_description(level, wf, request.preferred_duration, estimated_weeks)

    plan = TrainingPlan(
        user_id=user_id,
        name=plan_name,
        description=description,
        level=level,
        status=PlanStatus.draft.value,
        weekly_frequency=wf,
        estimated_weeks=estimated_weeks,
        assessment_id=request.assessment_id,
        preferred_duration_minutes=request.preferred_duration,
    )
    session.add(plan)
    await session.flush()

    # 计算实际训练时长：(动作数 × 组数 × (每组时长 + 休息时长)) / 60
    total_actions = w_need + c_need + s_need
    duration_minutes = int((total_actions * sets * (set_dur + rest_sec)) / 60)

    for week in range(1, estimated_weeks + 1):
        for day_idx, day_num in enumerate(training_days, start=1):
            weekday_cn = _WEEKDAY_CN[day_num - 1]
            pd = PlanDay(
                plan_id=plan.id,
                week_number=week,
                day_number=day_num,
                day_type=DayType.training.value,
                title=f"第{week}周 · 第{day_idx}练（周{weekday_cn}）",
                estimated_duration=duration_minutes,
            )
            session.add(pd)
            await session.flush()

            sort_order = 0
            for act in warmups:
                sort_order += 1
                session.add(
                    PlanExercise(
                        plan_day_id=pd.id,
                        action_id=act.id,
                        name=act.name,
                        phase="warmup",
                        sets=sets,
                        reps=reps,
                        rest_seconds=rest_sec,
                        set_duration_seconds=set_dur,
                        sort_order=sort_order,
                    )
                )
            for act in cores:
                sort_order += 1
                session.add(
                    PlanExercise(
                        plan_day_id=pd.id,
                        action_id=act.id,
                        name=act.name,
                        phase="core",
                        sets=sets,
                        reps=reps,
                        rest_seconds=rest_sec,
                        set_duration_seconds=set_dur,
                        sort_order=sort_order,
                    )
                )
            for act in stretches:
                sort_order += 1
                session.add(
                    PlanExercise(
                        plan_day_id=pd.id,
                        action_id=act.id,
                        name=act.name,
                        phase="stretch",
                        sets=sets,
                        reps=reps,
                        rest_seconds=rest_sec,
                        set_duration_seconds=set_dur,
                        sort_order=sort_order,
                    )
                )

    await session.flush()
    return plan


async def load_plan_with_days(session: AsyncSession, plan_id: int) -> TrainingPlan | None:
    from sqlalchemy.orm import selectinload

    q = (
        select(TrainingPlan)
        .where(TrainingPlan.id == plan_id)
        .options(
            selectinload(TrainingPlan.days).selectinload(PlanDay.exercises),
        )
    )
    r = await session.execute(q)
    return r.scalar_one_or_none()
