"""数据同步接口 —— 离线数据上传与下载。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.action import Action
from app.models.checkin import Checkin
from app.models.training import TrainingSession, TrainingRecord, SessionStatus
from app.schemas.common import APIResponse
from app.schemas.sync import (
    SyncUploadRequest,
    SyncUploadResponse,
    SyncedItem,
    SyncPullResponse,
)
from app.models.training_plan import TrainingPlan

router = APIRouter()


@router.post("/upload", response_model=APIResponse[SyncUploadResponse])
async def sync_upload(
    body: SyncUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[SyncUploadResponse]:
    """上传离线数据到服务器。"""
    user_id = int(current_user["id"])

    synced_sessions: list[SyncedItem] = []
    synced_checkins: list[SyncedItem] = []
    errors: list[str] = []

    # 映射 local_id -> server_id
    session_id_map: dict[str, int] = {}

    # ── 同步训练会话 ────────────────────────────────────────
    for offline_session in body.training_sessions:
        try:
            # 验证必要字段
            if not offline_session.plan_id:
                raise ValueError("缺少训练计划ID")
            if not offline_session.plan_day_id:
                raise ValueError("缺少训练日ID")
            if not offline_session.started_at:
                raise ValueError("缺少开始时间")

            # 创建训练会话
            session = TrainingSession(
                user_id=user_id,
                plan_id=offline_session.plan_id,
                plan_day_id=offline_session.plan_day_id,
                pre_check_status=offline_session.pre_check_status,
                started_at=offline_session.started_at,
                ended_at=offline_session.ended_at,
                status=SessionStatus.completed if offline_session.ended_at else SessionStatus.in_progress,
            )

            if offline_session.pain_info:
                session.pain_location = offline_session.pain_info.get("pain_location")
                session.pain_level = offline_session.pain_info.get("pain_level")
                session.pain_description = offline_session.pain_info.get("description")

            db.add(session)
            await db.flush()

            # 创建训练记录
            for record in offline_session.records:
                tr = TrainingRecord(
                    session_id=session.id,
                    action_id=record.action_id,
                    phase=record.phase,
                    planned_sets=record.planned_sets,
                    planned_reps=record.planned_reps,
                    actual_sets=record.actual_sets,
                    actual_reps=record.actual_reps,
                    is_completed=record.is_completed,
                    is_skipped=record.is_skipped,
                    difficulty_feedback=record.difficulty_feedback,
                    user_notes=record.user_notes,
                    pain_reported=record.pain_reported,
                )
                db.add(tr)

            await db.flush()

            # 计算完成率和时长
            if offline_session.ended_at:
                duration = (offline_session.ended_at - offline_session.started_at).total_seconds()
                session.duration_seconds = int(duration)

                completed = sum(1 for r in offline_session.records if r.is_completed and not r.is_skipped)
                total = len(offline_session.records)
                session.completion_rate = (completed / total * 100) if total > 0 else 0

            session_id_map[offline_session.local_id] = session.id
            synced_sessions.append(SyncedItem(
                local_id=offline_session.local_id,
                server_id=session.id,
            ))

        except ValueError as e:
            errors.append(f"训练会话 {offline_session.local_id[:8]}: 数据格式错误 - {str(e)}")
        except Exception as e:
            error_type = type(e).__name__
            errors.append(f"训练会话 {offline_session.local_id[:8]}: {error_type} - {str(e)}")

    # ── 同步打卡记录 ────────────────────────────────────────
    for offline_checkin in body.checkins:
        try:
            # 验证必要字段
            if not offline_checkin.checkin_date:
                raise ValueError("缺少打卡日期")

            # 查找对应的服务器 session_id
            server_session_id = session_id_map.get(offline_checkin.local_session_id)

            # 检查是否已存在
            from datetime import date
            try:
                checkin_date = date.fromisoformat(offline_checkin.checkin_date)
            except ValueError:
                raise ValueError(f"日期格式错误: {offline_checkin.checkin_date}")

            existing = await db.scalar(
                select(Checkin).where(
                    Checkin.user_id == user_id,
                    Checkin.checkin_date == checkin_date,
                )
            )

            if existing:
                synced_checkins.append(SyncedItem(
                    local_id=offline_checkin.local_id,
                    server_id=existing.id,
                ))
                continue

            checkin = Checkin(
                user_id=user_id,
                checkin_date=checkin_date,
                training_session_id=server_session_id,
            )
            db.add(checkin)
            await db.flush()

            synced_checkins.append(SyncedItem(
                local_id=offline_checkin.local_id,
                server_id=checkin.id,
            ))

        except ValueError as e:
            errors.append(f"打卡记录 {offline_checkin.local_id[:8]}: 数据格式错误 - {str(e)}")
        except Exception as e:
            error_type = type(e).__name__
            errors.append(f"打卡记录 {offline_checkin.local_id[:8]}: {error_type} - {str(e)}")

    await db.commit()

    return APIResponse(
        code=0,
        message="ok",
        data=SyncUploadResponse(
            synced_sessions=synced_sessions,
            synced_checkins=synced_checkins,
            errors=errors,
        ),
    )


@router.get("/pull", response_model=APIResponse[SyncPullResponse])
async def sync_pull(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    last_sync_at: str | None = None,
) -> APIResponse[SyncPullResponse]:
    """拉取最新数据（训练计划、动作库更新等）。"""
    user_id = int(current_user["id"])

    # 获取当前训练计划
    current_plan = None
    try:
        plan = await db.scalar(
            select(TrainingPlan).where(
                TrainingPlan.user_id == user_id,
                TrainingPlan.status == "ACTIVE",
            )
        )
        if plan:
            current_plan = {
                "id": plan.id,
                "title": plan.title,
                "level": plan.level,
                "status": plan.status,
            }
    except Exception:
        pass

    # 获取动作库更新（如果有 last_sync_at，返回更新的动作）
    actions_updated = []
    if last_sync_at:
        try:
            last_sync_dt = datetime.fromisoformat(last_sync_at.replace('Z', '+00:00'))
            updated_actions = (
                await db.execute(
                    select(Action).where(Action.updated_at > last_sync_dt)
                )
            ).scalars().all()

            actions_updated = [
                {
                    "id": a.id,
                    "name": a.name,
                    "video_url": a.video_url,
                }
                for a in updated_actions
            ]
        except Exception:
            pass

    return APIResponse(
        code=0,
        message="ok",
        data=SyncPullResponse(
            current_plan=current_plan,
            actions_updated=actions_updated,
            server_time=datetime.now(timezone.utc),
        ),
    )
