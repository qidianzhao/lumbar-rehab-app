from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.health_profile import HealthProfile
from app.schemas.common import APIResponse
from app.schemas.health_profile import HealthProfileResponse, HealthProfileUpdate

router = APIRouter()


@router.get("/me/health-profile", response_model=APIResponse[HealthProfileResponse])
async def get_health_profile(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[HealthProfileResponse]:
    user_id = int(current_user["id"])
    profile = await db.scalar(
        select(HealthProfile).where(HealthProfile.user_id == user_id)
    )
    if profile is None:
        # 档案不存在时返回空默认值，不报 404
        return APIResponse(code=0, message="ok", data=HealthProfileResponse())

    return APIResponse(code=0, message="ok", data=HealthProfileResponse.model_validate(profile))


@router.put("/me/health-profile", response_model=APIResponse[HealthProfileResponse])
async def update_health_profile(
    body: HealthProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[HealthProfileResponse]:
    user_id = int(current_user["id"])
    profile = await db.scalar(
        select(HealthProfile).where(HealthProfile.user_id == user_id)
    )

    if profile is None:
        profile = HealthProfile(user_id=user_id)
        db.add(profile)

    profile.height = body.height
    profile.weight = body.weight
    profile.disc_segments = body.disc_segments
    profile.disc_severity = body.disc_severity
    profile.other_conditions = body.other_conditions
    profile.daily_sitting_hours = body.daily_sitting_hours
    profile.exercise_habit = body.exercise_habit
    profile.is_complete = True

    await db.commit()
    await db.refresh(profile)

    return APIResponse(code=0, message="ok", data=HealthProfileResponse.model_validate(profile))
