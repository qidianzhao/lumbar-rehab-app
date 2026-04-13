from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AssessmentLevel(StrEnum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"


class Assessment(Base):
    """体能测试记录（一次完整测评）。"""

    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    overall_level: Mapped[str] = mapped_column(String(32), nullable=False)
    scores: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    weak_areas: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    ai_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    suggested_plan_level: Mapped[str] = mapped_column(String(32), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    items: Mapped[list["AssessmentItem"]] = relationship(
        "AssessmentItem",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentItem.id",
    )


class AssessmentItem(Base):
    """测试项目明细（每个动作一条）。"""

    __tablename__ = "assessment_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assessment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("actions.id", ondelete="RESTRICT"), nullable=False
    )
    dimension: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    metric_type: Mapped[str] = mapped_column(String(32), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    user_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="items")

