from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """统一 API 响应：code, message, data。"""

    code: int = Field(default=0, description="业务码，0 表示成功")
    message: str = Field(default="ok", description="说明信息")
    data: T | None = Field(default=None, description="载荷")
