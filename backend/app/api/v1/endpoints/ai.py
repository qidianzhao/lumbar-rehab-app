from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.services.deepseek_service import chat_fast
from app.services.ai_usage_service import (
    check_free_chat_limit,
    record_usage,
    get_user_usage_stats,
    AIUsageLimitExceeded,
)

router = APIRouter()

_BASE_SYSTEM = """你是"小核"，一位专业、友善的运动健身教练，专注于腰椎间盘突出康复期人群的核心力量训练指导。你是运动教练，不是医生。绝不提供医疗诊断或治疗建议。回复口语化，简短亲切。"""

_TRAINING_SYSTEM = _BASE_SYSTEM + """

## 当前场景：训练中实时指导
你正在陪用户训练，回复会被转成语音播放。每次回复控制在1-3句话，不超过50字，适合朗读。"""

_FREE_CHAT_SYSTEM = _BASE_SYSTEM + """

## 当前场景：自由问答
用户在非训练时段提问，可以稍微详细一些，但仍控制在5句话以内。只回答与腰突康复运动相关的问题。"""


class ChatMessage(BaseModel):
    role: str
    content: str

    @field_validator("content")
    @classmethod
    def validate_content_length(cls, v: str) -> str:
        max_length = settings.MAX_INPUT_LENGTH or 200
        if len(v) > max_length:
            raise ValueError(f"输入内容不能超过{max_length}字符")
        return v


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict | None = None


class ChatResponse(BaseModel):
    reply: str


class UsageLimitResponse(BaseModel):
    """用量限制信息"""

    allowed: bool
    used: int
    limit: int
    remaining: int


@router.get("/usage-limit", response_model=APIResponse[UsageLimitResponse])
async def get_usage_limit(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse[UsageLimitResponse]:
    """获取今日免费对话剩余次数"""
    try:
        print(f"[DEBUG] current_user: {current_user}")
        user_id = int(current_user["id"])
        print(f"[DEBUG] user_id: {user_id}")
        limit_info = await check_free_chat_limit(user_id, db)
        print(f"[DEBUG] limit_info: {limit_info}")
        return APIResponse(
            code=0,
            message="ok",
            data=UsageLimitResponse(**limit_info),
        )
    except Exception as e:
        print(f"[ERROR] get_usage_limit failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise


@router.get("/usage-stats", response_model=APIResponse[dict])
async def get_usage_stats(
    days: int = 7,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse[dict]:
    """获取用户最近N天的用量统计"""
    user_id = int(current_user["id"])
    stats = await get_user_usage_stats(user_id, db, days)
    return APIResponse(code=0, message="ok", data=stats)


@router.post("/chat", response_model=APIResponse[ChatResponse])
async def training_chat(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse[ChatResponse]:
    """训练中AI对话 - 不限制次数"""
    messages = [{"role": "system", "content": _TRAINING_SYSTEM}]
    if body.context:
        ctx = body.context
        ctx_lines = []
        if ctx.get("action_name"):
            ctx_lines.append(f"当前动作：{ctx['action_name']}")
        if ctx.get("current_set") and ctx.get("total_sets"):
            ctx_lines.append(f"第{ctx['current_set']}组/共{ctx['total_sets']}组")
        if ctx.get("phase"):
            ctx_lines.append(f"训练阶段：{ctx['phase']}")
        if ctx_lines:
            messages.append({"role": "system", "content": "训练上下文：" + "，".join(ctx_lines)})
    messages += [{"role": m.role, "content": m.content} for m in body.messages]

    reply = await chat_fast(messages)

    # 计算token数
    input_text = "".join(m.get("content", "") for m in messages)
    input_tokens = len(input_text) * 2
    output_tokens = len(reply) * 2

    # 记录用量（训练中对话）
    user_id = int(current_user["id"])
    await record_usage(
        user_id=user_id,
        usage_type="training_chat",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        db=db,
    )

    return APIResponse(code=0, message="ok", data=ChatResponse(reply=reply))


@router.post("/free-chat", response_model=APIResponse[ChatResponse])
async def free_chat(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> APIResponse[ChatResponse]:
    """自由问答 - 每日限制次数"""
    user_id = int(current_user["id"])

    # 检查今日免费次数
    limit_info = await check_free_chat_limit(user_id, db)
    if not limit_info["allowed"]:
        raise HTTPException(
            status_code=429,
            detail=f"今日免费对话次数已用完（{limit_info['limit']}次），明天再来吧~",
        )

    messages = [{"role": "system", "content": _FREE_CHAT_SYSTEM}]
    messages += [{"role": m.role, "content": m.content} for m in body.messages]

    # 先调用AI，成功后再记录用量
    reply = await chat_fast(messages)

    # 计算token数（简化：按字符数估算，1个中文字约等于2个token）
    input_text = "".join(m.get("content", "") for m in messages)
    input_tokens = len(input_text) * 2
    output_tokens = len(reply) * 2

    # 只有成功返回后才记录用量
    await record_usage(
        user_id=user_id,
        usage_type="free_chat",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        db=db,
    )

    return APIResponse(code=0, message="ok", data=ChatResponse(reply=reply))
