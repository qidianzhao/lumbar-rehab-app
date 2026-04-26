"""DeepSeek V4 服务封装，兼容 OpenAI SDK 格式。"""

from openai import AsyncOpenAI

from app.config import settings

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL or "https://api.deepseek.com",
        )
    return _client


async def chat_with_reasoning(
    messages: list[dict],
    effort: str = "high",
) -> str:
    """深度推理模式，用于体能评估、训练计划生成、阶段报告。"""
    client = _get_client()
    resp = await client.chat.completions.create(
        model="deepseek-reasoner",
        messages=messages,
        # DeepSeek R1 系列通过 model 选择开启思考，无需额外参数
    )
    return resp.choices[0].message.content or ""


async def chat_fast(messages: list[dict]) -> str:
    """快速对话模式，用于训练中问答、不适评估、鼓励话语。"""
    client = _get_client()
    resp = await client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
    )
    return resp.choices[0].message.content or ""
