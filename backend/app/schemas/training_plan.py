from datetime import datetime

from pydantic import BaseModel, Field


class PlanGenerateRequest(BaseModel):
    assessment_id: int | None = Field(default=None, description="关联测评（可选）")
    weekly_frequency: int = Field(ge=2, le=5, description="每周训练天数")
    preferred_duration: int = Field(ge=15, le=45, description="单次训练偏好时长（分钟）")


class PlanExerciseResponse(BaseModel):
    id: int
    action_id: int
    name: str
    phase: str
    sets: int
    reps: int
    rest_seconds: int
    sort_order: int
    video_url: str | None = None

    model_config = {"from_attributes": True}


class PlanDayResponse(BaseModel):
    id: int
    week_number: int
    day_number: int
    day_type: str
    title: str
    estimated_duration: int
    exercises: list[PlanExerciseResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TrainingPlanResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None
    level: str
    status: str
    weekly_frequency: int
    estimated_weeks: int
    assessment_id: int | None = None
    preferred_duration_minutes: int | None = None
    created_at: datetime
    updated_at: datetime
    days: list[PlanDayResponse] = Field(default_factory=list)
    progress_week: int | None = Field(
        default=None,
        description="当前进度周（从 1 起）",
    )

    model_config = {"from_attributes": True}


class UpdatePlanDayExerciseRequest(BaseModel):
    id: int | None = Field(default=None, description="动作ID（新增时为None）")
    action_id: int = Field(description="关联的动作库ID")
    phase: str = Field(description="阶段：warmup/core/stretch")
    sets: int = Field(ge=1, le=10, description="组数")
    reps: int = Field(ge=1, le=100, description="次数")
    rest_seconds: int = Field(ge=0, le=300, description="休息时间（秒）")
    sort_order: int = Field(ge=0, description="排序")


class UpdatePlanDayRequest(BaseModel):
    exercises: list[UpdatePlanDayExerciseRequest] = Field(description="动作列表")


class AIPlanModifyRequest(BaseModel):
    instruction: str = Field(description="用户的修改指令，例如：'增加核心训练强度'、'减少拉伸时间'")


class AIPlanModifyResponse(BaseModel):
    success: bool
    message: str
    modified_exercises: list[PlanExerciseResponse] | None = None
