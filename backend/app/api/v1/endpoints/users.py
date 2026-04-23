from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.health_profile import HealthProfile
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.health_profile import HealthProfileResponse, HealthProfileUpdate

router = APIRouter()


class UserResponse(APIResponse):
    pass


from pydantic import BaseModel

class UserMeResponse(BaseModel):
    id: int
    phone: str
    show_in_leaderboard: bool

class UserMeUpdate(BaseModel):
    show_in_leaderboard: bool | None = None


@router.get("/me", response_model=APIResponse[UserMeResponse])
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[UserMeResponse]:
    user_id = int(current_user["id"])
    user = await db.scalar(select(User).where(User.id == user_id))
    return APIResponse(
        code=0,
        message="ok",
        data=UserMeResponse(
            id=user.id,
            phone=user.phone,
            show_in_leaderboard=user.show_in_leaderboard,
        ),
    )


@router.put("/me", response_model=APIResponse[UserMeResponse])
async def update_me(
    body: UserMeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[UserMeResponse]:
    user_id = int(current_user["id"])
    user = await db.scalar(select(User).where(User.id == user_id))
    if body.show_in_leaderboard is not None:
        user.show_in_leaderboard = body.show_in_leaderboard
    await db.commit()
    await db.refresh(user)
    return APIResponse(
        code=0,
        message="ok",
        data=UserMeResponse(
            id=user.id,
            phone=user.phone,
            show_in_leaderboard=user.show_in_leaderboard,
        ),
    )


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
