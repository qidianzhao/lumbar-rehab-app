from datetime import datetime, timezone

from jose import JWTError, jwt
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.services.sms_service import generate_code, send_sms


def _jwt_secret() -> str:
    secret = settings.JWT_SECRET_KEY
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not set")
    return secret


def _jwt_algorithm() -> str:
    return settings.JWT_ALGORITHM or "HS256"


def _access_expire_seconds() -> int:
    days = settings.ACCESS_TOKEN_EXPIRE_DAYS or 7
    return int(days * 24 * 3600)


def _refresh_expire_seconds() -> int:
    days = settings.REFRESH_TOKEN_EXPIRE_DAYS or 30
    return int(days * 24 * 3600)


async def save_code_to_redis(redis_client: Redis, phone: str, code: str) -> None:
    key = f"sms_code:{phone}"
    await redis_client.setex(key, 300, code)


async def verify_code(redis_client: Redis, phone: str, code: str) -> bool:
    key = f"sms_code:{phone}"
    stored = await redis_client.get(key)
    if stored is None or stored != code:
        return False
    await redis_client.delete(key)
    return True


def create_jwt_tokens(user_id: int) -> TokenResponse:
    secret = _jwt_secret()
    alg = _jwt_algorithm()
    sub = str(user_id)
    now = int(datetime.now(timezone.utc).timestamp())
    access_exp = now + _access_expire_seconds()
    refresh_exp = now + _refresh_expire_seconds()
    access_token = jwt.encode(
        {"sub": sub, "typ": "access", "iat": now, "exp": access_exp},
        secret,
        algorithm=alg,
    )
    refresh_token = jwt.encode(
        {"sub": sub, "typ": "refresh", "iat": now, "exp": refresh_exp},
        secret,
        algorithm=alg,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


def create_access_token_only(user_id: int) -> str:
    secret = _jwt_secret()
    alg = _jwt_algorithm()
    sub = str(user_id)
    now = int(datetime.now(timezone.utc).timestamp())
    access_exp = now + _access_expire_seconds()
    return jwt.encode(
        {"sub": sub, "typ": "access", "iat": now, "exp": access_exp},
        secret,
        algorithm=alg,
    )


async def login_or_register(db: AsyncSession, phone: str) -> User:
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user is not None:
        return user
    user = User(phone=phone)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def send_login_code(redis_client: Redis, phone: str) -> str:
    code = generate_code()
    send_sms(phone, code)
    await save_code_to_redis(redis_client, phone, code)
    return code


async def login_with_sms_code(
    db: AsyncSession,
    redis_client: Redis,
    phone: str,
    code: str,
) -> tuple[User, TokenResponse] | None:
    if not await verify_code(redis_client, phone, code):
        return None
    user = await login_or_register(db, phone)
    tokens = create_jwt_tokens(user.id)
    return user, tokens


def refresh_access_token(refresh_token: str) -> str | None:
    try:
        payload = jwt.decode(
            refresh_token,
            _jwt_secret(),
            algorithms=[_jwt_algorithm()],
        )
    except JWTError:
        return None
    if payload.get("typ") != "refresh":
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        return None
    return create_access_token_only(user_id)
