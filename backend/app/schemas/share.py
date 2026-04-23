from pydantic import BaseModel
from enum import Enum


class CardType(str, Enum):
    TRAINING_REPORT = "TRAINING_REPORT"


class ShareCardRequest(BaseModel):
    card_type: CardType
    session_id: int


class ShareCardResponse(BaseModel):
    image_url: str
    card_type: CardType
    session_id: int
