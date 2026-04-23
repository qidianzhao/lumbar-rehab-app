from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


SECTION = Literal[
    "health_profile",
    "training_stats",
    "pain_records",
    "assessment_results",
]


class ExportPdfRequest(BaseModel):
    start_date: date
    end_date: date
    include_sections: list[str] = Field(
        default_factory=lambda: [
            "health_profile",
            "training_stats",
            "pain_records",
            "assessment_results",
        ]
    )


class ExportPdfResponse(BaseModel):
    pdf_url: str
    expires_at: datetime
