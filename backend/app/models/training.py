"""训练执行：会话与动作执行记录。"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionStatus(StrEnum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"


class PreCheckStatus(StrEnum):
    normal = "normal"
    discomfort = "discomfort"


class PainLog(Base):
    """训练前不适时的疼痛记录（供 TrainingSession.pain_log_id 引用）。"""

    __tablename__ = "pain_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body_region: Mapped[str] = mapped_column(String(64), nullable=False)
    pain_level: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TrainingSession(Base):
    """单次训练会话。"""

    __tablename__ = "training_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_day_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plan_days.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=SessionStatus.in_progress.value)
    pre_check_status: Mapped[str] = mapped_column(String(32), nullable=False)
    pain_log_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("pain_logs.id", ondelete="SET NULL"), nullable=True
    )

    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    records: Mapped[list["TrainingRecord"]] = relationship(
        "TrainingRecord",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="TrainingRecord.id",
    )


class TrainingRecord(Base):
    """会话内每个动作的执行记录。"""

    __tablename__ = "training_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("actions.id", ondelete="RESTRICT"), nullable=False
    )
    phase: Mapped[str] = mapped_column(String(32), nullable=False)

    planned_sets: Mapped[int] = mapped_column(Integer, nullable=False)
    planned_reps: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_sets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    actual_reps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_completed: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_skipped: Mapped[bool] = mapped_column(default=False, nullable=False)
    difficulty_feedback: Mapped[int | None] = mapped_column(Integer, nullable=True)

    session: Mapped["TrainingSession"] = relationship("TrainingSession", back_populates="records")
