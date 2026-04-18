"""用户运动健康档案。"""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class HealthProfile(Base):
    __tablename__ = "health_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    # 基础身体信息
    height: Mapped[float | None] = mapped_column(nullable=True)        # cm
    weight: Mapped[float | None] = mapped_column(nullable=True)        # kg

    # 腰椎情况
    disc_segments: Mapped[list | None] = mapped_column(JSON, nullable=True)    # ["L4_L5", "L5_S1", ...]
    disc_severity: Mapped[str | None] = mapped_column(String(32), nullable=True)  # BULGING / PROTRUSION / EXTRUSION / UNSURE

    # 合并情况
    other_conditions: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["STENOSIS", ...]

    # 生活习惯
    daily_sitting_hours: Mapped[str | None] = mapped_column(String(16), nullable=True)  # LT_4H / H4_8 / GT_8H
    exercise_habit: Mapped[str | None] = mapped_column(String(16), nullable=True)       # NONE / OCCASIONAL / REGULAR

    is_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
