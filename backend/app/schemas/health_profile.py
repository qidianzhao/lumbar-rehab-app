from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HealthProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    height: float | None = None
    weight: float | None = None
    disc_segments: list[str] = Field(default_factory=list)
    disc_severity: str | None = None
    other_conditions: list[str] = Field(default_factory=list)
    daily_sitting_hours: str | None = None
    exercise_habit: str | None = None
    is_complete: bool = False
    updated_at: datetime | None = None


class HealthProfileUpdate(BaseModel):
    height: float | None = None
    weight: float | None = None
    disc_segments: list[str] = Field(default_factory=list)
    disc_severity: str | None = None
    other_conditions: list[str] = Field(default_factory=list)
    daily_sitting_hours: str | None = None
    exercise_habit: str | None = None
