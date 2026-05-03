from datetime import date
from enum import Enum

from pydantic import BaseModel


class CheckinCalendarDay(BaseModel):
    date: date
    has_checkin: bool
    training_session_ids: list[int] = []  # 支持每天多次训练


class CheckinCalendarResponse(BaseModel):
    year: int
    month: int
    days: list[CheckinCalendarDay]
    streak_days: int      # 当前连续打卡天数
    total_days: int       # 累计打卡天数


class LeaderboardPeriod(str, Enum):
    WEEK = "WEEK"
    MONTH = "MONTH"
    YEAR = "YEAR"


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    display_name: str        # 脱敏手机号
    checkin_days: int        # 周期内打卡天数
    streak_days: int         # 当前连续打卡天数
    is_me: bool = False


class LeaderboardResponse(BaseModel):
    period: str
    entries: list[LeaderboardEntry]
    my_rank: int | None      # None 表示未上榜
    my_entry: LeaderboardEntry | None
