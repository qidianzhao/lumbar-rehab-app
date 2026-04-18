from datetime import date

from pydantic import BaseModel


class CheckinCalendarDay(BaseModel):
    date: date
    has_checkin: bool
    training_session_id: int | None = None


class CheckinCalendarResponse(BaseModel):
    year: int
    month: int
    days: list[CheckinCalendarDay]
    streak_days: int      # 当前连续打卡天数
    total_days: int       # 累计打卡天数
