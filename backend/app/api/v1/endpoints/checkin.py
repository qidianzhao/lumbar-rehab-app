from __future__ import annotations

import calendar
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.checkin import Checkin
from app.models.user import User
from app.schemas.checkin import (
    CheckinCalendarDay,
    CheckinCalendarResponse,
    LeaderboardEntry,
    LeaderboardPeriod,
    LeaderboardResponse,
)
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

    # 按日期分组，支持每天多条记录
    checkin_map: dict[date, list[Checkin]] = {}
    for r in rows:
        checkin_map.setdefault(r.checkin_date, []).append(r)

    # 构建当月每天
    _, days_in_month = calendar.monthrange(year, month)
    days: list[CheckinCalendarDay] = []
    for d in range(1, days_in_month + 1):
        day_date = date(year, month, d)
        records = checkin_map.get(day_date, [])
        session_ids = [r.training_session_id for r in records if r.training_session_id]
        days.append(
            CheckinCalendarDay(
                date=day_date,
                has_checkin=len(records) > 0,
                training_session_ids=session_ids,
            )
        )

    # 累计打卡天数（统计不重复的日期数）
    total_days = int(
        (
            await db.scalar(
                select(func.count(func.distinct(Checkin.checkin_date)))
                .select_from(Checkin)
                .where(Checkin.user_id == user_id)
            )
        )
        or 0
    )

    # 连续打卡天数（从今天往前数，使用不重复的日期）
    all_dates_q = await db.execute(
        select(func.distinct(Checkin.checkin_date))
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


def _calc_streak(dates_desc: list[date]) -> int:
    """给定降序排列的打卡日期列表，计算当前连续天数。"""
    if not dates_desc:
        return 0
    today = date.today()
    dates_set = set(dates_desc)
    start = today if today in dates_set else today - timedelta(days=1)
    if start not in dates_set:
        return 0
    streak = 0
    d = start
    while d in dates_set:
        streak += 1
        d -= timedelta(days=1)
    return streak


def _mask_phone(phone: str) -> str:
    """138****8000 脱敏。"""
    if len(phone) == 11:
        return f"{phone[:3]}****{phone[7:]}"
    return f"用户{phone[-4:]}"


@router.get("/leaderboard", response_model=APIResponse[LeaderboardResponse])
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    period: LeaderboardPeriod = Query(LeaderboardPeriod.WEEK),
) -> APIResponse[LeaderboardResponse]:
    user_id = int(current_user["id"])
    today = date.today()

    # 确定周期起始日
    if period == LeaderboardPeriod.WEEK:
        start_date = today - timedelta(days=today.weekday())   # 本周一
    elif period == LeaderboardPeriod.MONTH:
        start_date = today.replace(day=1)
    else:  # YEAR
        start_date = today.replace(month=1, day=1)

    # 统计周期内每个用户的打卡天数（不重复日期）
    count_q = (
        select(Checkin.user_id, func.count(func.distinct(Checkin.checkin_date)).label("cnt"))
        .where(Checkin.checkin_date >= start_date)
        .group_by(Checkin.user_id)
        .order_by(func.count(func.distinct(Checkin.checkin_date)).desc())
        .limit(50)
    )
    rows = (await db.execute(count_q)).all()          # [(user_id, cnt), ...]

    # 批量查询涉及用户的信息
    involved_ids = [r[0] for r in rows]
    if user_id not in involved_ids:
        involved_ids.append(user_id)

    users_map: dict[int, User] = {
        u.id: u
        for u in (
            await db.execute(select(User).where(User.id.in_(involved_ids)))
        ).scalars().all()
    }

    # 批量查询这些用户的全部打卡日期（用于计算 streak，使用不重复日期）
    all_dates_q = (
        await db.execute(
            select(Checkin.user_id, func.distinct(Checkin.checkin_date))
            .where(Checkin.user_id.in_(involved_ids))
            .order_by(Checkin.checkin_date.desc())
        )
    ).all()

    # 按用户分组
    user_dates: dict[int, list[date]] = {}
    for uid, d in all_dates_q:
        user_dates.setdefault(uid, []).append(d)

    # 构建榜单
    entries: list[LeaderboardEntry] = []
    my_rank: int | None = None
    my_entry: LeaderboardEntry | None = None

    for rank, (uid, cnt) in enumerate(rows, start=1):
        u = users_map.get(uid)
        display = _mask_phone(u.phone) if u else f"用户{uid}"
        streak = _calc_streak(user_dates.get(uid, []))
        entry = LeaderboardEntry(
            rank=rank,
            user_id=uid,
            display_name=display,
            checkin_days=cnt,
            streak_days=streak,
            is_me=(uid == user_id),
        )
        entries.append(entry)
        if uid == user_id:
            my_rank = rank
            my_entry = entry

    # 当前用户不在榜单内，单独计算
    if my_entry is None:
        my_cnt_row = await db.scalar(
            select(func.count(func.distinct(Checkin.checkin_date))).where(
                Checkin.user_id == user_id,
                Checkin.checkin_date >= start_date,
            )
        )
        my_cnt = int(my_cnt_row or 0)
        u = users_map.get(user_id)
        display = _mask_phone(u.phone) if u else f"用户{user_id}"
        streak = _calc_streak(user_dates.get(user_id, []))
        my_entry = LeaderboardEntry(
            rank=len(rows) + 1,   # 超出榜单范围
            user_id=user_id,
            display_name=display,
            checkin_days=my_cnt,
            streak_days=streak,
            is_me=True,
        )

    return APIResponse(
        code=0,
        message="ok",
        data=LeaderboardResponse(
            period=period.value,
            entries=entries,
            my_rank=my_rank,
            my_entry=my_entry,
        ),
    )
