from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.actions import _build_video_url
from app.database import get_db
from app.dependencies import get_current_user
from app.models.action import Action
from app.models.training_plan import PlanStatus, TrainingPlan, PlanDay, PlanExercise
from app.schemas.common import APIResponse
from app.schemas.training_plan import AIPlanModifyRequest, AIPlanModifyResponse, PlanDayResponse, PlanExerciseResponse, PlanGenerateRequest, TrainingPlanResponse, UpdatePlanDayRequest
from app.services import plan_generator
from app.services.action_seed import ensure_actions_seeded
from app.services.ai_plan_modifier import modify_plan_with_ai
from app.services.ai_usage_service import record_usage

router = APIRouter()


def _compute_progress_week(plan: TrainingPlan) -> int:
    created = plan.created_at
    if created is None:
        return 1
    now = datetime.now(timezone.utc)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    weeks_elapsed = (now - created).days // 7 + 1
    return max(1, min(plan.estimated_weeks, weeks_elapsed))


async def _plan_to_response(plan: TrainingPlan, db: AsyncSession) -> TrainingPlanResponse:
    days_sorted = sorted(
        plan.days,
        key=lambda d: (d.week_number, d.day_number),
    )

    # 收集所有需要的action_id
    action_ids = set()
    for d in days_sorted:
        for ex in d.exercises:
            action_ids.add(ex.action_id)

    # 批量加载所有actions
    action_map = {}
    if action_ids:
        result = await db.execute(select(Action).where(Action.id.in_(action_ids)))
        actions = result.scalars().all()
        action_map = {act.id: act for act in actions}

    return TrainingPlanResponse(
        id=plan.id,
        user_id=plan.user_id,
        name=plan.name,
        description=plan.description,
        level=plan.level,
        status=plan.status,
        weekly_frequency=plan.weekly_frequency,
        estimated_weeks=plan.estimated_weeks,
        assessment_id=plan.assessment_id,
        preferred_duration_minutes=plan.preferred_duration_minutes,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        progress_week=_compute_progress_week(plan),
        days=[
            PlanDayResponse(
                id=d.id,
                week_number=d.week_number,
                day_number=d.day_number,
                day_type=d.day_type,
                title=d.title,
                estimated_duration=d.estimated_duration,
                exercises=sorted(
                    [
                        PlanExerciseResponse(
                            id=ex.id,
                            action_id=ex.action_id,
                            name=ex.name,
                            phase=ex.phase,
                            sets=ex.sets,
                            reps=ex.reps,
                            rest_seconds=ex.rest_seconds,
                            sort_order=ex.sort_order,
                            video_url=_build_video_url(action_map.get(ex.action_id).video_url) if ex.action_id in action_map and action_map.get(ex.action_id).video_url else None,
                        )
                        for ex in d.exercises
                    ],
                    key=lambda e: e.sort_order,
                ),
            )
            for d in days_sorted
        ],
    )


@router.post("/generate", response_model=APIResponse[TrainingPlanResponse])
async def generate_training_plan(
    body: PlanGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[TrainingPlanResponse]:
    user_id = int(current_user["id"])
    await ensure_actions_seeded(db)
    try:
        plan = await plan_generator.generate_plan(user_id, body, session=db)
        # 记录AI用量（计划生成）
        await record_usage(
            user_id=user_id,
            usage_type="plan_generation",
            input_tokens=0,
            output_tokens=0,
            db=db,
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    loaded = await plan_generator.load_plan_with_days(db, plan.id)
    if loaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="计划创建后加载失败")
    return APIResponse(code=0, message="ok", data=await _plan_to_response(loaded, db))


@router.get("/current", response_model=APIResponse[TrainingPlanResponse | None])
async def get_current_plan(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[TrainingPlanResponse | None]:
    user_id = int(current_user["id"])
    q_active = (
        select(TrainingPlan)
        .where(TrainingPlan.user_id == user_id, TrainingPlan.status == PlanStatus.active.value)
        .order_by(TrainingPlan.updated_at.desc())
        .limit(1)
    )
    r = await db.execute(q_active)
    plan = r.scalar_one_or_none()
    if plan is None:
        q_draft = (
            select(TrainingPlan)
            .where(TrainingPlan.user_id == user_id, TrainingPlan.status == PlanStatus.draft.value)
            .order_by(TrainingPlan.updated_at.desc())
            .limit(1)
        )
        plan = (await db.execute(q_draft)).scalar_one_or_none()
    if plan is None:
        return APIResponse(code=0, message="ok", data=None)
    loaded = await plan_generator.load_plan_with_days(db, plan.id)
    if loaded is None:
        return APIResponse(code=0, message="ok", data=None)
    return APIResponse(code=0, message="ok", data=await _plan_to_response(loaded, db))


@router.get("/", response_model=APIResponse[list[TrainingPlanResponse]])
async def get_my_plans(
    plan_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[list[TrainingPlanResponse]]:
    """获取当前用户的所有方案列表，可按plan_type筛选"""
    user_id = int(current_user["id"])

    query = select(TrainingPlan).where(TrainingPlan.user_id == user_id)

    # 按plan_type筛选
    if plan_type:
        query = query.where(TrainingPlan.plan_type == plan_type)

    # 按状态和更新时间排序：active > draft > archived，同状态按更新时间倒序
    query = query.order_by(
        TrainingPlan.status.desc(),
        TrainingPlan.updated_at.desc()
    )

    result = await db.execute(query)
    plans = result.scalars().all()

    # 转换为响应格式
    responses = []
    for plan in plans:
        loaded = await plan_generator.load_plan_with_days(db, plan.id)
        if loaded:
            responses.append(await _plan_to_response(loaded, db))

    return APIResponse(code=0, message="ok", data=responses)



@router.get("/{plan_id}", response_model=APIResponse[TrainingPlanResponse])
async def get_plan_detail(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[TrainingPlanResponse]:
    user_id = int(current_user["id"])
    loaded = await plan_generator.load_plan_with_days(db, plan_id)
    if loaded is None or loaded.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="计划不存在")
    return APIResponse(code=0, message="ok", data=await _plan_to_response(loaded, db))


@router.post("/{plan_id}/confirm", response_model=APIResponse[TrainingPlanResponse])
async def confirm_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[TrainingPlanResponse]:
    user_id = int(current_user["id"])
    loaded = await plan_generator.load_plan_with_days(db, plan_id)
    if loaded is None or loaded.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="计划不存在")
    if loaded.status != PlanStatus.draft.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅草稿计划可确认")

    q_arch = select(TrainingPlan).where(
        TrainingPlan.user_id == user_id,
        TrainingPlan.status == PlanStatus.active.value,
    )
    for p in (await db.execute(q_arch)).scalars().all():
        p.status = PlanStatus.archived.value
    loaded.status = PlanStatus.active.value
    await db.commit()
    refreshed = await plan_generator.load_plan_with_days(db, plan_id)
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="确认后加载失败")
    return APIResponse(code=0, message="ok", data=await _plan_to_response(refreshed, db))


@router.put("/{plan_id}/days/{day_id}", response_model=APIResponse[PlanDayResponse])
async def update_plan_day(
    plan_id: int,
    day_id: int,
    body: UpdatePlanDayRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[PlanDayResponse]:
    user_id = int(current_user["id"])

    # 验证计划所有权
    loaded = await plan_generator.load_plan_with_days(db, plan_id)
    if loaded is None or loaded.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="计划不存在")

    # 查找目标训练日
    day_result = await db.execute(
        select(PlanDay).where(PlanDay.id == day_id, PlanDay.plan_id == plan_id)
    )
    day = day_result.scalar_one_or_none()
    if day is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="训练日不存在")

    # 验证至少有一个动作
    if not body.exercises:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="至少需要一个动作")

    # 验证所有action_id存在
    action_ids = {ex.action_id for ex in body.exercises}
    action_result = await db.execute(select(Action).where(Action.id.in_(action_ids)))
    actions = action_result.scalars().all()
    action_map = {act.id: act for act in actions}

    if len(action_map) != len(action_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="部分动作不存在")

    # 删除旧的动作
    await db.execute(
        select(PlanExercise).where(PlanExercise.plan_day_id == day_id)
    )
    for ex in day.exercises:
        await db.delete(ex)

    # 创建新的动作
    new_exercises = []
    for ex_req in body.exercises:
        action = action_map[ex_req.action_id]
        new_ex = PlanExercise(
            plan_day_id=day_id,
            action_id=ex_req.action_id,
            name=action.name,
            phase=ex_req.phase,
            sets=ex_req.sets,
            reps=ex_req.reps,
            rest_seconds=ex_req.rest_seconds,
            sort_order=ex_req.sort_order,
        )
        db.add(new_ex)
        new_exercises.append(new_ex)

    # 更新训练日的预估时长
    total_duration = sum(
        ex.sets * (ex.reps * 2 + ex.rest_seconds) for ex in new_exercises
    ) // 60
    day.estimated_duration = max(1, total_duration)

    await db.commit()

    # 重新加载以获取完整数据
    await db.refresh(day)
    day_result = await db.execute(
        select(PlanDay).where(PlanDay.id == day_id)
    )
    refreshed_day = day_result.scalar_one()

    # 构建响应
    exercises_response = []
    for ex in sorted(refreshed_day.exercises, key=lambda e: e.sort_order):
        action = action_map.get(ex.action_id)
        exercises_response.append(
            PlanExerciseResponse(
                id=ex.id,
                action_id=ex.action_id,
                name=ex.name,
                phase=ex.phase,
                sets=ex.sets,
                reps=ex.reps,
                rest_seconds=ex.rest_seconds,
                sort_order=ex.sort_order,
                video_url=_build_video_url(action.video_url) if action and action.video_url else None,
            )
        )

    response = PlanDayResponse(
        id=refreshed_day.id,
        week_number=refreshed_day.week_number,
        day_number=refreshed_day.day_number,
        day_type=refreshed_day.day_type,
        title=refreshed_day.title,
        estimated_duration=refreshed_day.estimated_duration,
        exercises=exercises_response,
    )

    return APIResponse(code=0, message="ok", data=response)


@router.post("/{plan_id}/days/{day_id}/ai-modify", response_model=APIResponse[AIPlanModifyResponse])
async def ai_modify_plan_day(
    plan_id: int,
    day_id: int,
    body: AIPlanModifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[AIPlanModifyResponse]:
    """使用AI助手修改训练方案"""
    user_id = int(current_user["id"])

    # 验证计划所有权
    loaded = await plan_generator.load_plan_with_days(db, plan_id)
    if loaded is None or loaded.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="计划不存在")

    # 查找目标训练日
    day_result = await db.execute(
        select(PlanDay).where(PlanDay.id == day_id, PlanDay.plan_id == plan_id)
    )
    day = day_result.scalar_one_or_none()
    if day is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="训练日不存在")

    # 调用AI修改服务
    success, message, modified_exercises = await modify_plan_with_ai(
        day=day,
        instruction=body.instruction,
        db=db,
    )

    # 记录AI用量
    await record_usage(
        user_id=user_id,
        usage_type="plan_modification",
        input_tokens=0,
        output_tokens=0,
        db=db,
    )

    # 如果成功，构建响应
    exercises_response = None
    if success and modified_exercises:
        # 重新加载以获取完整数据（包括新的ID）
        await db.refresh(day)
        day_result = await db.execute(
            select(PlanDay).where(PlanDay.id == day_id)
        )
        refreshed_day = day_result.scalar_one()

        # 获取所有action信息
        action_ids = {ex.action_id for ex in refreshed_day.exercises}
        action_result = await db.execute(select(Action).where(Action.id.in_(action_ids)))
        actions = action_result.scalars().all()
        action_map = {act.id: act for act in actions}

        exercises_response = []
        for ex in sorted(refreshed_day.exercises, key=lambda e: e.sort_order):
            action = action_map.get(ex.action_id)
            exercises_response.append(
                PlanExerciseResponse(
                    id=ex.id,
                    action_id=ex.action_id,
                    name=ex.name,
                    phase=ex.phase,
                    sets=ex.sets,
                    reps=ex.reps,
                    rest_seconds=ex.rest_seconds,
                    sort_order=ex.sort_order,
                    video_url=_build_video_url(action.video_url) if action and action.video_url else None,
                )
            )

    response_data = AIPlanModifyResponse(
        success=success,
        message=message,
        modified_exercises=exercises_response,
    )

    return APIResponse(code=0, message="ok", data=response_data)

