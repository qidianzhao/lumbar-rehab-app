from enum import StrEnum

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ActionCategory(StrEnum):
    """动作分类"""
    core = "core"  # 核心训练
    stretch = "stretch"  # 拉伸放松
    eye = "eye"  # 眼部保健
    warmup = "warmup"  # 热身


class Action(Base):
    """动作库，供训练计划引用真实 action_id。"""

    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    phase: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
        comment="warmup | core | stretch (保留兼容性)",
    )
    category: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
        default=ActionCategory.core.value,
        comment="动作分类: core | stretch | eye | warmup",
    )
    difficulty_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        comment="视频缩略图URL",
    )
