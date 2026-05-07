import json
import os
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.action import Action

router = APIRouter()

_MAPPING_FILE = Path(__file__).parent.parent.parent.parent.parent / "video_mapping.json"


def _load_mapping() -> dict[str, str]:
    if _MAPPING_FILE.exists():
        return json.loads(_MAPPING_FILE.read_text(encoding="utf-8"))
    return {}


def _build_video_url(path: str | None) -> str | None:
    if not path:
        return None
    if path.startswith("http"):
        return path
    base = (settings.VIDEO_SERVER_URL or "http://localhost:8080").rstrip("/")
    # URL encode the path to handle Chinese characters
    encoded_path = quote(path, safe='/')
    return f"{base}{encoded_path}"


class ActionOut(BaseModel):
    id: int
    name: str
    phase: str
    category: str | None = None
    body_part: str | None = None
    difficulty_level: int
    description: str | None
    video_url: str | None
    thumbnail_url: str | None = None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ActionOut])
async def list_actions(body_part: str | None = None, db: AsyncSession = Depends(get_db)):
    mapping = _load_mapping()
    query = select(Action).order_by(Action.phase, Action.difficulty_level)
    if body_part:
        query = query.where(Action.body_part == body_part)
    rows = (await db.execute(query)).scalars().all()
    result = []
    for row in rows:
        video_url = _build_video_url(row.video_url or mapping.get(row.name))
        thumbnail_url = _build_video_url(row.thumbnail_url) if row.thumbnail_url else None
        result.append(ActionOut(
            id=row.id,
            name=row.name,
            phase=row.phase,
            category=row.category,
            body_part=row.body_part,
            difficulty_level=row.difficulty_level,
            description=row.description,
            video_url=video_url,
            thumbnail_url=thumbnail_url,
        ))
    return result


@router.get("/{action_id}", response_model=ActionOut)
async def get_action(action_id: int, db: AsyncSession = Depends(get_db)):
    mapping = _load_mapping()
    row = (await db.execute(select(Action).where(Action.id == action_id))).scalar_one_or_none()
    if row is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="动作不存在")
    video_url = _build_video_url(row.video_url or mapping.get(row.name))
    thumbnail_url = _build_video_url(row.thumbnail_url) if row.thumbnail_url else None
    return ActionOut(
        id=row.id,
        name=row.name,
        phase=row.phase,
        category=row.category,
        body_part=row.body_part,
        difficulty_level=row.difficulty_level,
        description=row.description,
        video_url=video_url,
        thumbnail_url=thumbnail_url,
    )
