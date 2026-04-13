from collections.abc import AsyncGenerator
from typing import Annotated, Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import ConnectionPool, Redis

from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

_redis_pool: ConnectionPool | None = None
_redis_client: Redis | None = None


def _build_redis_pool() -> ConnectionPool:
    url = settings.REDIS_URL
    if not url:
        raise RuntimeError("REDIS_URL is not set")
    return ConnectionPool.from_url(
        url,
        decode_responses=True,
        max_connections=50,
    )


def _get_redis_client() -> Redis:
    global _redis_pool, _redis_client
    if _redis_client is None:
        if _redis_pool is None:
            _redis_pool = _build_redis_pool()
        _redis_client = Redis(connection_pool=_redis_pool)
    return _redis_client


async def get_redis() -> AsyncGenerator[Redis, None]:
    yield _get_redis_client()


async def get_current_user(
    _credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ] = None,
) -> dict[str, Any]:
    # TODO: 校验 JWT / Session，查询数据库并返回真实用户
    return {"id": 1, "phone": "13800138000", "is_authenticated": True}