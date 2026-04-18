"""训练执行相关请求/响应模型。"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PreCheckInfo(BaseModel):
    """训练前不适时的疼痛信息（与 PainLog 字段对应）。"""

    body_region: str = Field(
        ...,
        description="疼痛部位，如 waist_left / waist_right / waist_center / leg",
    )
    pain_level: int = Field(..., ge=0, le=10, description="疼痛等级 0-10")
    description: str | None = Field(default=None, description="症状描述")


class SessionCreateRequest(BaseModel):
    plan_id: int
    plan_day_id: int
    pre_check_status: str = Field(
        ...,
        description="normal | discomfort，对应 PreCheckStatus",
    )
    pain_info: PreCheckInfo | None = Field(
        default=None,
        description="pre_check_status 为 discomfort 时建议填写",
    )

    @field_validator("pre_check_status")
    @classmethod
    def _validate_pre_check(cls, v: str) -> str:
        allowed = {"normal", "discomfort"}
        if v not in allowed:
            raise ValueError(f"pre_check_status must be one of {allowed}")
        return v


class RecordSubmitRequest(BaseModel):
    """提交时可带 record_id，避免同日计划内同一 action_id 重复时歧义。"""

    record_id: int | None = None
    action_id: int
    actual_sets: int = Field(ge=0)
    actual_reps: int = Field(ge=0)
    is_completed: bool = False
    is_skipped: bool = False
    difficulty_feedback: int | None = Field(default=None, ge=1, le=5)


class SessionStartActionItem(BaseModel):
    record_id: int
    action_id: int
    name: str
    phase: str
    planned_sets: int
    planned_reps: int
    rest_seconds: int
    video_url: str | None = None
    tips: str | None = None


class SessionStartResponse(BaseModel):
    session_id: int
    plan_day_title: str
    safety_notice: str | None = None
    degraded: bool = False
    actions: list[SessionStartActionItem] = Field(default_factory=list)


class SessionFinishActionDetail(BaseModel):
    """结束训练报告中单个动作的完成情况。"""

    action_id: int
    name: str
    phase: str
    planned_sets: int
    planned_reps: int
    actual_sets: int
    actual_reps: int
    is_completed: bool
    is_skipped: bool


class SessionFinishResponse(BaseModel):
    session_id: int
    completion_rate: float = Field(..., ge=0, le=100, description="完成率 0-100")
    duration_display: str = Field(..., description="人类可读时长，如 12分30秒")
    action_details: list[SessionFinishActionDetail] = Field(default_factory=list)
    ai_summary: str = Field(default="", description="训练总结（规则或 LLM 生成）")
    checkin_ok: bool = Field(default=False, description="是否已成功写入打卡")


class SessionHistoryItem(BaseModel):
    id: int
    plan_id: int
    plan_day_id: int
    status: str
    pre_check_status: str
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: int | None
    completion_rate: float | None

    model_config = {"from_attributes": True}


class SessionHistoryResponse(BaseModel):
    items: list[SessionHistoryItem] = Field(default_factory=list)
    total: int = Field(default=0, description="当前筛选条件下的总条数")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
