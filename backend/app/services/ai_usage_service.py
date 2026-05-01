from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_usage import AIUsage


class AIUsageLimitExceeded(Exception):
    """AI用量超限异常"""

    def __init__(self, message: str, remaining: int = 0):
        self.message = message
        self.remaining = remaining
        super().__init__(message)


async def check_free_chat_limit(user_id: int, db: AsyncSession) -> dict:
    """
    检查用户今日免费对话次数是否超限

    Returns:
        dict: {"allowed": bool, "used": int, "limit": int, "remaining": int}
    """
    limit = settings.DAILY_FREE_CHAT_LIMIT or 15
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # 统计今日free_chat用量
    stmt = select(func.count(AIUsage.id)).where(
        AIUsage.user_id == user_id,
        AIUsage.usage_type == "free_chat",
        AIUsage.created_at >= today_start,
    )
    result = await db.execute(stmt)
    used = result.scalar() or 0

    remaining = max(0, limit - used)
    allowed = used < limit

    return {
        "allowed": allowed,
        "used": used,
        "limit": limit,
        "remaining": remaining,
    }


async def record_usage(
    user_id: int,
    usage_type: str,
    input_tokens: int,
    output_tokens: int,
    db: AsyncSession,
) -> None:
    """记录AI用量"""
    usage = AIUsage(
        user_id=user_id,
        usage_type=usage_type,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    db.add(usage)
    await db.commit()


async def get_user_usage_stats(
    user_id: int,
    db: AsyncSession,
    days: int = 7,
) -> dict:
    """
    获取用户最近N天的用量统计

    Returns:
        dict: {
            "total_calls": int,
            "total_input_tokens": int,
            "total_output_tokens": int,
            "by_type": {usage_type: count},
            "daily": [{"date": "2024-01-01", "count": 5}, ...]
        }
    """
    start_date = datetime.now() - timedelta(days=days)

    # 按类型统计
    stmt = select(
        AIUsage.usage_type,
        func.count(AIUsage.id).label("count"),
        func.sum(AIUsage.input_tokens).label("input_tokens"),
        func.sum(AIUsage.output_tokens).label("output_tokens"),
    ).where(
        AIUsage.user_id == user_id,
        AIUsage.created_at >= start_date,
    ).group_by(AIUsage.usage_type)

    result = await db.execute(stmt)
    rows = result.all()

    by_type = {}
    total_calls = 0
    total_input = 0
    total_output = 0

    for row in rows:
        by_type[row.usage_type] = row.count
        total_calls += row.count
        total_input += row.input_tokens or 0
        total_output += row.output_tokens or 0

    # 按日期统计
    stmt_daily = select(
        func.date(AIUsage.created_at).label("date"),
        func.count(AIUsage.id).label("count"),
    ).where(
        AIUsage.user_id == user_id,
        AIUsage.created_at >= start_date,
    ).group_by(func.date(AIUsage.created_at)).order_by(func.date(AIUsage.created_at))

    result_daily = await db.execute(stmt_daily)
    daily_rows = result_daily.all()

    daily = [
        {"date": str(row.date), "count": row.count}
        for row in daily_rows
    ]

    return {
        "total_calls": total_calls,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "by_type": by_type,
        "daily": daily,
    }
