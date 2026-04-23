"""社交分享卡片接口 —— 生成训练报告分享图片。"""
from __future__ import annotations

import base64
import io

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.training import TrainingSession, TrainingRecord, SessionStatus
from app.models.action import Action
from app.schemas.common import APIResponse
from app.schemas.share import ShareCardRequest, ShareCardResponse, CardType

router = APIRouter()


def _build_card_image(
    completion_rate: float,
    duration_seconds: int,
    action_count: int,
    ai_summary: str | None,
) -> bytes:
    """生成分享卡片图片，返回 PNG bytes。优先用 Pillow，不可用时返回最小 PNG。"""
    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore[import-untyped]

        W, H = 600, 400
        img = Image.new("RGB", (W, H), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)

        # 背景渐变色块
        draw.rectangle([0, 0, W, 80], fill=(74, 144, 226))

        # 标题
        draw.text((20, 20), "LDH 腰突康复训练报告", fill=(255, 255, 255))

        # 数据
        minutes = (duration_seconds or 0) // 60
        draw.text((20, 100), f"完成率: {completion_rate:.0f}%", fill=(50, 50, 50))
        draw.text((20, 130), f"训练时长: {minutes} 分钟", fill=(50, 50, 50))
        draw.text((20, 160), f"完成动作: {action_count} 个", fill=(50, 50, 50))

        if ai_summary:
            summary = ai_summary[:60] + ("..." if len(ai_summary) > 60 else "")
            draw.text((20, 200), f"AI 总结: {summary}", fill=(100, 100, 100))

        draw.text((20, 360), "腰突康复运动 App", fill=(150, 150, 150))

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    except ImportError:
        return _minimal_png()


def _minimal_png() -> bytes:
    """返回 1x1 白色 PNG，Pillow 不可用时的兜底。"""
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
    )


@router.post("/card", response_model=APIResponse[ShareCardResponse])
async def create_share_card(
    body: ShareCardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[ShareCardResponse]:
    user_id = int(current_user["id"])

    session = await db.scalar(
        select(TrainingSession).where(
            TrainingSession.id == body.session_id,
            TrainingSession.user_id == user_id,
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="训练记录不存在")
    if session.status != SessionStatus.completed:
        raise HTTPException(status_code=400, detail="训练尚未完成")

    records = (
        await db.execute(
            select(TrainingRecord).where(TrainingRecord.session_id == session.id)
        )
    ).scalars().all()

    action_count = sum(1 for r in records if r.is_completed and not r.is_skipped)

    img_bytes = _build_card_image(
        completion_rate=session.completion_rate or 0,
        duration_seconds=session.duration_seconds or 0,
        action_count=action_count,
        ai_summary=session.ai_summary,
    )

    b64 = base64.b64encode(img_bytes).decode("ascii")
    image_url = f"data:image/png;base64,{b64}"

    return APIResponse(
        code=0,
        message="ok",
        data=ShareCardResponse(
            image_url=image_url,
            card_type=body.card_type,
            session_id=body.session_id,
        ),
    )
