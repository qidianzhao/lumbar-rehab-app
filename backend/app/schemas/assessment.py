from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TestItemSubmit(BaseModel):
    action_id: int
    metric_value: float = Field(description="用户输入的原始指标值（秒/次/评分等）")
    user_notes: str | None = None


class AssessmentSubmitRequest(BaseModel):
    items: list[TestItemSubmit] = Field(min_length=1)


class AssessmentItemResponse(BaseModel):
    id: int
    action_id: int
    dimension: str
    metric_type: str
    metric_value: float
    user_notes: str | None

    model_config = {"from_attributes": True}


class AssessmentResponse(BaseModel):
    id: int
    user_id: int
    overall_level: str
    scores: dict[str, int]
    weak_areas: list[str]
    ai_summary: str
    suggested_plan_level: str
    created_at: datetime
    items: list[AssessmentItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AssessmentHistoryItem(BaseModel):
    id: int
    overall_level: str
    suggested_plan_level: str
    created_at: datetime
    scores: dict[str, int]
    weak_areas: list[str]

    model_config = {"from_attributes": True}


class AssessmentHistoryResponse(BaseModel):
    items: list[AssessmentHistoryItem] = Field(default_factory=list)

