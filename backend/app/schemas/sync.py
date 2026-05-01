"""数据同步相关的 Schema 定义。"""
from datetime import datetime
from pydantic import BaseModel


class OfflineTrainingRecord(BaseModel):
    """离线训练记录（单个动作）"""
    action_id: int
    phase: str
    planned_sets: int
    planned_reps: str
    actual_sets: int
    actual_reps: str
    is_completed: bool
    is_skipped: bool
    difficulty_feedback: int | None = None
    user_notes: str | None = None
    pain_reported: bool = False


class OfflineTrainingSession(BaseModel):
    """离线训练会话"""
    local_id: str
    plan_id: int
    plan_day_id: int
    pre_check_status: str
    started_at: datetime
    ended_at: datetime | None = None
    records: list[OfflineTrainingRecord]
    pain_info: dict | None = None


class OfflineCheckin(BaseModel):
    """离线打卡记录"""
    local_id: str
    checkin_date: str  # YYYY-MM-DD
    local_session_id: str  # 关联到 OfflineTrainingSession 的 local_id


class SyncUploadRequest(BaseModel):
    """上传离线数据请求"""
    training_sessions: list[OfflineTrainingSession] = []
    checkins: list[OfflineCheckin] = []


class SyncedItem(BaseModel):
    """同步成功的项"""
    local_id: str
    server_id: int


class SyncUploadResponse(BaseModel):
    """上传离线数据响应"""
    synced_sessions: list[SyncedItem]
    synced_checkins: list[SyncedItem]
    errors: list[str]


class SyncPullResponse(BaseModel):
    """拉取最新数据响应"""
    current_plan: dict | None = None
    actions_updated: list[dict] = []
    server_time: datetime
