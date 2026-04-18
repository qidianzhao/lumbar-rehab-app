from __future__ import annotations

import calendar
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.checkin import Checkin
from app.schemas.checkin import CheckinCalendarDay, CheckinCalendarResponse
from app.schemas.common import APIResponse

router = APIRouter()


@router.get("/calendar", response_model=APIResponse[CheckinCalendarResponse])
async def get_checkin_calendar(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> APIResponse[CheckinCalendarResponse]:
    user_id = int(current_user["id"])

    # 当月所有打卡记录
    rows = (
        await db.execute(
            select(Checkin).where(
                Checkin.user_id == user_id,
                extract("year", Checkin.checkin_date) == year,
                extract("month", Checkin.checkin_date) == month,
            )
        )
    ).scalars().all()

    checkin_map: dict[date, Checkin] = {r.checkin_date: r for r in rows}

    # 构建当月每天
    _, days_in_month = calendar.monthrange(year, month)
    days: list[CheckinCalendarDay] = []
    for d in range(1, days_in_month + 1):
        day_date = date(year, month, d)
        record = checkin_map.get(day_date)
        days.append(
            CheckinCalendarDay(
                date=day_date,
                has_checkin=record is not None,
                training_session_id=record.training_session_id if record else None,
            )
        )

    # 累计打卡天数（全历史）
    total_days = int(
        (
            await db.scalar(
                select(func.count()).select_from(Checkin).where(Checkin.user_id == user_id)
            )
        )
        or 0
    )

    # 连续打卡天数（从今天往前数）
    all_dates_q = await db.execute(
        select(Checkin.checkin_date)
        .where(Checkin.user_id == user_id)
        .order_by(Checkin.checkin_date.desc())
    )
    all_dates = [r[0] for r in all_dates_q.all()]

    streak = 0
    if all_dates:
        today = date.today()
        # 今天或昨天有打卡才算连续
        check_date = today
        if all_dates[0] < today:
            # 最近打卡不是今天，从昨天开始检查
            from datetime import timedelta
            check_date = today - timedelta(days=1)
            if all_dates[0] != check_date:
                check_date = None  # 断了

        if check_date is not None:
            dates_set = set(all_dates)
            from datetime import timedelta
            d = check_date
            while d in dates_set:
                streak += 1
                d -= timedelta(days=1)

    return APIResponse(
        code=0,
        message="ok",
        data=CheckinCalendarResponse(
            year=year,
            month=month,
            days=days,
            streak_days=streak,
            total_days=total_days,
        ),
    )
