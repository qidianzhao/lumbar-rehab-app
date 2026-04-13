from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.training_plan import PlanStatus, TrainingPlan
from app.schemas.common import APIResponse
from app.schemas.training_plan import PlanDayResponse, PlanExerciseResponse, PlanGenerateRequest, TrainingPlanResponse
from app.services import plan_generator
from app.services.action_seed import ensure_actions_seeded

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


def _plan_to_response(plan: TrainingPlan) -> TrainingPlanResponse:
    days_sorted = sorted(
        plan.days,
        key=lambda d: (d.week_number, d.day_number),
    )
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
                    [PlanExerciseResponse.model_validate(ex) for ex in d.exercises],
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
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    loaded = await plan_generator.load_plan_with_days(db, plan.id)
    if loaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="计划创建后加载失败")
    return APIResponse(code=0, message="ok", data=_plan_to_response(loaded))


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
    return APIResponse(code=0, message="ok", data=_plan_to_response(loaded))


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
    return APIResponse(code=0, message="ok", data=_plan_to_response(loaded))


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
    return APIResponse(code=0, message="ok", data=_plan_to_response(refreshed))
