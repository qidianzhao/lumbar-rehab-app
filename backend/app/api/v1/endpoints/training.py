from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.action import Action
from app.models.checkin import Checkin
from app.models.training import PainLog, PreCheckStatus, SessionStatus, TrainingRecord, TrainingSession
from app.models.training_plan import PlanDay, PlanExercise, TrainingPlan
from app.api.v1.endpoints.actions import _build_video_url, _load_mapping
from app.schemas.common import APIResponse
from app.schemas.training import (
    RecordSubmitRequest,
    SessionCreateRequest,
    SessionFinishActionDetail,
    SessionFinishResponse,
    SessionHistoryResponse,
    SessionHistoryItem,
    SessionStartActionItem,
    SessionStartResponse,
)
from app.services import training_report
from app.services.ai_usage_service import record_usage

router = APIRouter()


async def _get_owned_session(
    db: AsyncSession, session_id: int, user_id: int
) -> TrainingSession:
    q = (
        select(TrainingSession)
        .where(TrainingSession.id == session_id, TrainingSession.user_id == user_id)
        .options(selectinload(TrainingSession.records))
    )
    sess = (await db.execute(q)).scalar_one_or_none()
    if sess is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="训练会话不存在")
    return sess


@router.post("/sessions", response_model=APIResponse[SessionStartResponse])
async def create_training_session(
    body: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[SessionStartResponse]:
    user_id = int(current_user["id"])

    q_open = select(TrainingSession).where(
        TrainingSession.user_id == user_id,
        TrainingSession.status == SessionStatus.in_progress.value,
    )
    for s in (await db.execute(q_open)).scalars().all():
        s.status = SessionStatus.abandoned.value

    q_day = (
        select(PlanDay)
        .where(PlanDay.id == body.plan_day_id, PlanDay.plan_id == body.plan_id)
        .options(
            selectinload(PlanDay.exercises),
            selectinload(PlanDay.plan),
        )
    )
    plan_day = (await db.execute(q_day)).scalar_one_or_none()
    if plan_day is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="训练日不存在或不属于该计划")
    plan = plan_day.plan
    if plan.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该计划")

    pain_log_id: int | None = None
    if body.pre_check_status == PreCheckStatus.discomfort.value:
        if body.pain_info is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="选择「不适」时请填写疼痛信息",
            )
        pl = PainLog(
            user_id=user_id,
            body_region=body.pain_info.body_region,
            pain_level=body.pain_info.pain_level,
            description=body.pain_info.description,
        )
        db.add(pl)
        await db.flush()
        pain_log_id = pl.id

    safety_notice: str | None = None
    degraded = False
    if body.pre_check_status == PreCheckStatus.discomfort.value:
        safety_notice = (
            "您标记了身体不适：建议降低强度、减少组数与次数；若疼痛加重或出现麻木，请立即停止并咨询医生。"
        )
        degraded = True

    ts = TrainingSession(
        user_id=user_id,
        plan_id=body.plan_id,
        plan_day_id=body.plan_day_id,
        status=SessionStatus.in_progress.value,
        pre_check_status=body.pre_check_status,
        pain_log_id=pain_log_id,
    )
    db.add(ts)
    await db.flush()

    exercises = sorted(plan_day.exercises, key=lambda e: e.sort_order)
    action_ids = list({e.action_id for e in exercises})
    actions = (await db.execute(select(Action).where(Action.id.in_(action_ids)))).scalars().all()
    actions_by_id = {a.id: a for a in actions}
    video_mapping = _load_mapping()

    action_items: list[SessionStartActionItem] = []
    for pe in exercises:
        act = actions_by_id.get(pe.action_id)
        if act is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"动作 id={pe.action_id} 不存在",
            )
        tr = TrainingRecord(
            session_id=ts.id,
            action_id=pe.action_id,
            phase=pe.phase,
            planned_sets=pe.sets,
            planned_reps=pe.reps,
        )
        db.add(tr)
        await db.flush()
        action_items.append(
            SessionStartActionItem(
                record_id=tr.id,
                action_id=pe.action_id,
                name=pe.name,
                phase=pe.phase,
                planned_sets=pe.sets,
                planned_reps=pe.reps,
                rest_seconds=pe.rest_seconds,
                set_duration_seconds=pe.set_duration_seconds,
                video_url=_build_video_url(act.video_url or video_mapping.get(act.name)),
                tips=act.description,
            )
        )

    await db.commit()

    return APIResponse(
        code=0,
        message="ok",
        data=SessionStartResponse(
            session_id=ts.id,
            plan_day_title=plan_day.title,
            safety_notice=safety_notice,
            degraded=degraded,
            actions=action_items,
        ),
    )


@router.post("/sessions/{session_id}/records", response_model=APIResponse[dict])
async def submit_training_record(
    session_id: int,
    body: RecordSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[dict]:
    user_id = int(current_user["id"])
    sess = await _get_owned_session(db, session_id, user_id)
    if sess.status != SessionStatus.in_progress.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="会话已结束")

    rec: TrainingRecord | None = None
    if body.record_id is not None:
        rec = await db.get(TrainingRecord, body.record_id)
        if rec is None or rec.session_id != session_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    else:
        q = (
            select(TrainingRecord)
            .where(TrainingRecord.session_id == session_id, TrainingRecord.action_id == body.action_id)
            .order_by(TrainingRecord.id)
        )
        recs = list((await db.execute(q)).scalars().all())
        if not recs:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到该动作记录")
        rec = next((r for r in recs if not r.is_completed and not r.is_skipped), recs[0])

    rec.actual_sets = body.actual_sets
    rec.actual_reps = body.actual_reps
    rec.is_completed = body.is_completed
    rec.is_skipped = body.is_skipped
    rec.difficulty_feedback = body.difficulty_feedback

    await db.commit()
    return APIResponse(code=0, message="ok", data={"ok": True})


@router.post("/sessions/{session_id}/finish", response_model=APIResponse[SessionFinishResponse])
async def finish_training_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[SessionFinishResponse]:
    user_id = int(current_user["id"])
    sess = await _get_owned_session(db, session_id, user_id)
    if sess.status != SessionStatus.in_progress.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="会话已结束")

    ended_at = datetime.now(timezone.utc)
    started = sess.started_at
    if started.tzinfo is None:
        started_utc = started.replace(tzinfo=timezone.utc)
    else:
        started_utc = started

    duration_sec = training_report.calculate_duration_seconds(started_utc, ended_at)
    records = list(sess.records)
    rate = training_report.calculate_completion_rate(records)
    summary = await training_report.generate_ai_summary(records, rate)

    sess.ended_at = ended_at.replace(tzinfo=None)
    sess.duration_seconds = duration_sec
    sess.completion_rate = rate
    sess.ai_summary = summary
    sess.status = SessionStatus.completed.value

    today = ended_at.date()
    existing = await db.scalar(
        select(Checkin).where(Checkin.user_id == user_id, Checkin.checkin_date == today)
    )
    checkin_ok = existing is None
    if existing is None:
        db.add(
            Checkin(
                user_id=user_id,
                checkin_date=today,
                training_session_id=sess.id,
            )
        )

    # 记录AI用量（训练总结）
    await record_usage(
        user_id=user_id,
        usage_type="training_summary",
        input_tokens=0,
        output_tokens=0,
        db=db,
    )

    await db.commit()

    await db.refresh(sess)
    records = (await db.execute(select(TrainingRecord).where(TrainingRecord.session_id == sess.id))).scalars().all()
    action_map = {
        a.id: a
        for a in (
            await db.execute(select(Action).where(Action.id.in_([r.action_id for r in records])))
        ).scalars().all()
    }

    details: list[SessionFinishActionDetail] = []
    for r in sorted(records, key=lambda x: x.id):
        act = action_map.get(r.action_id)
        details.append(
            SessionFinishActionDetail(
                action_id=r.action_id,
                name=act.name if act else "",
                phase=r.phase,
                planned_sets=r.planned_sets,
                planned_reps=r.planned_reps,
                actual_sets=r.actual_sets,
                actual_reps=r.actual_reps,
                is_completed=r.is_completed,
                is_skipped=r.is_skipped,
            )
        )

    return APIResponse(
        code=0,
        message="ok",
        data=SessionFinishResponse(
            session_id=sess.id,
            completion_rate=rate,
            duration_display=training_report.format_duration_display(duration_sec),
            action_details=details,
            ai_summary=summary,
            checkin_ok=checkin_ok,
        ),
    )


@router.get("/sessions/{session_id}/report", response_model=APIResponse[SessionFinishResponse])
async def get_training_session_report(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[SessionFinishResponse]:
    user_id = int(current_user["id"])
    sess = await _get_owned_session(db, session_id, user_id)

    records = (
        await db.execute(select(TrainingRecord).where(TrainingRecord.session_id == sess.id))
    ).scalars().all()
    action_map = {
        a.id: a
        for a in (
            await db.execute(select(Action).where(Action.id.in_([r.action_id for r in records])))
        ).scalars().all()
    }

    details: list[SessionFinishActionDetail] = [
        SessionFinishActionDetail(
            action_id=r.action_id,
            name=action_map[r.action_id].name if r.action_id in action_map else "",
            phase=r.phase,
            planned_sets=r.planned_sets,
            planned_reps=r.planned_reps,
            actual_sets=r.actual_sets,
            actual_reps=r.actual_reps,
            is_completed=r.is_completed,
            is_skipped=r.is_skipped,
        )
        for r in sorted(records, key=lambda x: x.id)
    ]

    duration_sec = sess.duration_seconds or 0
    return APIResponse(
        code=0,
        message="ok",
        data=SessionFinishResponse(
            session_id=sess.id,
            completion_rate=sess.completion_rate or 0.0,
            duration_display=training_report.format_duration_display(duration_sec),
            action_details=details,
            ai_summary=sess.ai_summary or "",
            checkin_ok=False,
        ),
    )


@router.get("/sessions/history", response_model=APIResponse[SessionHistoryResponse])
async def training_session_history(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> APIResponse[SessionHistoryResponse]:
    user_id = int(current_user["id"])
    total = int(
        (
            await db.scalar(
                select(func.count()).select_from(TrainingSession).where(TrainingSession.user_id == user_id)
            )
        )
        or 0
    )

    q = (
        select(TrainingSession)
        .where(TrainingSession.user_id == user_id)
        .order_by(TrainingSession.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    items = [SessionHistoryItem.model_validate(r) for r in rows]
    return APIResponse(
        code=0,
        message="ok",
        data=SessionHistoryResponse(items=items, total=total, page=page, page_size=page_size),
    )
