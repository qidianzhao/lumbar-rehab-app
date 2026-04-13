from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanStatus(StrEnum):
    draft = "draft"
    active = "active"
    archived = "archived"


class DayType(StrEnum):
    training = "training"
    rest = "rest"


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[str] = mapped_column(String(32), nullable=False, default="beginner")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=PlanStatus.draft.value)
    weekly_frequency: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    assessment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferred_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    days: Mapped[list["PlanDay"]] = relationship(
        "PlanDay",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanDay.week_number, PlanDay.day_number",
    )


class PlanDay(Base):
    __tablename__ = "plan_days"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    day_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    estimated_duration: Mapped[int] = mapped_column(Integer, nullable=False, comment="预计时长（分钟）")

    plan: Mapped["TrainingPlan"] = relationship("TrainingPlan", back_populates="days")
    exercises: Mapped[list["PlanExercise"]] = relationship(
        "PlanExercise",
        back_populates="plan_day",
        cascade="all, delete-orphan",
        order_by="PlanExercise.sort_order",
    )


class PlanExercise(Base):
    __tablename__ = "plan_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_day_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plan_days.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("actions.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    phase: Mapped[str] = mapped_column(String(32), nullable=False)
    sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    plan_day: Mapped["PlanDay"] = relationship("PlanDay", back_populates="exercises")
