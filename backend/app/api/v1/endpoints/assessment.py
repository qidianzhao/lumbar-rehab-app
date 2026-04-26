from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.action import Action
from app.models.assessment import Assessment, AssessmentItem
from app.schemas.assessment import (
    AssessmentHistoryResponse,
    AssessmentItemResponse,
    AssessmentResponse,
    AssessmentSubmitRequest,
)
from app.schemas.common import APIResponse
from app.services.action_seed import ensure_actions_seeded
from app.services.assessment_service import assess_user

router = APIRouter()


# 6 个测试项目配置（动作名称需与动作库一致）
_TEST_ITEMS = [
    {
        "action_name": "平板支撑",
        "dimension": "core_endurance",
        "metric_type": "seconds",
        "prompt": "保持标准姿势的持续时间（秒）",
        "raw_key": "core_endurance_seconds",
    },
    {
        "action_name": "臀桥",
        "dimension": "glute_strength",
        "metric_type": "reps",
        "prompt": "完成次数（次）",
        "raw_key": "glute_bridge_reps",
    },
    {
        "action_name": "鸟狗式",
        "dimension": "spine_stability",
        "metric_type": "reps",
        "prompt": "完成次数（次）",
        "raw_key": "bird_dog_reps",
    },
    {
        "action_name": "死虫式",
        "dimension": "core_control",
        "metric_type": "reps",
        "prompt": "完成次数（次）",
        "raw_key": "dead_bug_reps",
    },
    {
        "action_name": "猫牛式",
        "dimension": "spine_mobility",
        "metric_type": "rating_1_5",
        "prompt": "自评流畅度/舒适度（1-5）",
        "raw_key": "spine_mobility_rating",
    },
    {
        "action_name": "坐位体前屈",
        "dimension": "flexibility",
        "metric_type": "rating_1_5",
        "prompt": "自评柔韧性（1-5）",
        "raw_key": "flexibility_rating",
    },
]


async def _load_actions_by_names(db: AsyncSession, names: list[str]) -> dict[str, Action]:
    q = select(Action).where(Action.name.in_(names))
    rows = (await db.execute(q)).scalars().all()
    return {a.name: a for a in rows}


@router.get("/test-items", response_model=APIResponse[list[dict]])
async def get_test_items(
    db: AsyncSession = Depends(get_db),
    _current_user: dict = Depends(get_current_user),
) -> APIResponse[list[dict]]:
    await ensure_actions_seeded(db)
    names = [i["action_name"] for i in _TEST_ITEMS]
    actions = await _load_actions_by_names(db, names)
    missing = [n for n in names if n not in actions]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"动作库缺少测试动作: {', '.join(missing)}",
        )
    data = []
    for item in _TEST_ITEMS:
        act = actions[item["action_name"]]
        data.append(
            {
                "action_id": act.id,
                "name": act.name,
                "dimension": item["dimension"],
                "metric_type": item["metric_type"],
                "prompt": item["prompt"],
            }
        )
    return APIResponse(code=0, message="ok", data=data)


async def _load_assessment_with_items(db: AsyncSession, assessment_id: int) -> Assessment | None:
    q = (
        select(Assessment)
        .where(Assessment.id == assessment_id)
        .options(selectinload(Assessment.items))
    )
    return (await db.execute(q)).scalar_one_or_none()


def _to_response(a: Assessment) -> AssessmentResponse:
    return AssessmentResponse(
        id=a.id,
        user_id=a.user_id,
        overall_level=a.overall_level,
        scores={str(k): int(v) for k, v in (a.scores or {}).items()},
        weak_areas=[str(x) for x in (a.weak_areas or [])],
        ai_summary=a.ai_summary,
        suggested_plan_level=a.suggested_plan_level,
        created_at=a.created_at,
        items=[AssessmentItemResponse.model_validate(i) for i in (a.items or [])],
    )


@router.post("/submit", response_model=APIResponse[AssessmentResponse])
async def submit_assessment(
    body: AssessmentSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[AssessmentResponse]:
    user_id = int(current_user["id"])
    await ensure_actions_seeded(db)

    # action_id -> action.name
    action_ids = [i.action_id for i in body.items]
    actions = (await db.execute(select(Action).where(Action.id.in_(action_ids)))).scalars().all()
    actions_by_id = {a.id: a for a in actions}
    if len(actions_by_id) != len(set(action_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="包含无效 action_id")

    config_by_name = {c["action_name"]: c for c in _TEST_ITEMS}
    raw: dict[str, float] = {}
    items_to_save: list[AssessmentItem] = []

    for submitted in body.items:
        act = actions_by_id[submitted.action_id]
        cfg = config_by_name.get(act.name)
        if cfg is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"动作 {act.name} 不属于测试项目",
            )
        raw[cfg["raw_key"]] = float(submitted.metric_value)
        items_to_save.append(
            AssessmentItem(
                action_id=act.id,
                dimension=str(cfg["dimension"]),
                metric_type=str(cfg["metric_type"]),
                metric_value=float(submitted.metric_value),
                user_notes=submitted.user_notes,
            )
        )

    result = await assess_user(raw)

    assessment = Assessment(
        user_id=user_id,
        overall_level=result.overall_level,
        scores=result.scores,
        weak_areas=result.weak_areas,
        ai_summary=result.ai_summary,
        suggested_plan_level=result.suggested_plan_level,
    )
    db.add(assessment)
    await db.flush()

    for item in items_to_save:
        item.assessment_id = assessment.id
        db.add(item)

    await db.commit()

    loaded = await _load_assessment_with_items(db, assessment.id)
    if loaded is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="评估保存后加载失败")
    return APIResponse(code=0, message="ok", data=_to_response(loaded))


@router.get("/history", response_model=APIResponse[AssessmentHistoryResponse])
async def get_assessment_history(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[AssessmentHistoryResponse]:
    user_id = int(current_user["id"])
    q = (
        select(Assessment)
        .where(Assessment.user_id == user_id)
        .order_by(Assessment.created_at.desc())
        .limit(50)
    )
    rows = (await db.execute(q)).scalars().all()
    items = [
        {
            "id": a.id,
            "overall_level": a.overall_level,
            "suggested_plan_level": a.suggested_plan_level,
            "created_at": a.created_at,
            "scores": {str(k): int(v) for k, v in (a.scores or {}).items()},
            "weak_areas": [str(x) for x in (a.weak_areas or [])],
        }
        for a in rows
    ]
    return APIResponse(code=0, message="ok", data=AssessmentHistoryResponse(items=items))


@router.get("/latest", response_model=APIResponse[AssessmentResponse | None])
async def get_latest_assessment(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[AssessmentResponse | None]:
    user_id = int(current_user["id"])
    q = (
        select(Assessment)
        .where(Assessment.user_id == user_id)
        .order_by(Assessment.created_at.desc())
        .limit(1)
        .options(selectinload(Assessment.items))
    )
    a = (await db.execute(q)).scalar_one_or_none()
    if a is None:
        return APIResponse(code=0, message="ok", data=None)
    return APIResponse(code=0, message="ok", data=_to_response(a))

