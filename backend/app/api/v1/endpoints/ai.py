from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.services.deepseek_service import chat_fast

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


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict | None = None


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=APIResponse[ChatResponse])
async def training_chat(
    body: ChatRequest,
    _current_user: dict = Depends(get_current_user),
) -> APIResponse[ChatResponse]:
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
    return APIResponse(code=0, message="ok", data=ChatResponse(reply=reply))


@router.post("/free-chat", response_model=APIResponse[ChatResponse])
async def free_chat(
    body: ChatRequest,
    _current_user: dict = Depends(get_current_user),
) -> APIResponse[ChatResponse]:
    messages = [{"role": "system", "content": _FREE_CHAT_SYSTEM}]
    messages += [{"role": m.role, "content": m.content} for m in body.messages]
    reply = await chat_fast(messages)
    return APIResponse(code=0, message="ok", data=ChatResponse(reply=reply))
