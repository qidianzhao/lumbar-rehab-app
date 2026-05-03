from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis, get_current_user
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    LoginResponse,
    PasswordLoginRequest,
    RefreshRequest,
    SendCodeRequest,
    SetPasswordRequest,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


@router.post("/send-code")
async def send_code(
    body: SendCodeRequest,
    redis_client: Redis = Depends(get_redis),
) -> dict[str, bool]:
    await auth_service.send_login_code(redis_client, body.phone)
    return {"ok": True}


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> LoginResponse:
    result = await auth_service.login_with_sms_code(
        db, redis_client, body.phone, body.code
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期",
        )
    user, tokens = result
    return LoginResponse(
        user=UserResponse.model_validate(user),
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
    )


@router.post("/login-password", response_model=LoginResponse)
async def login_with_password(
    body: PasswordLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    result = await auth_service.login_with_password(db, body.phone, body.password)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号或密码错误",
        )
    user, tokens = result
    return LoginResponse(
        user=UserResponse.model_validate(user),
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(body: RefreshRequest) -> AccessTokenResponse:
    access = auth_service.refresh_access_token(body.refresh_token)
    if access is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 refresh_token",
        )
    return AccessTokenResponse(access_token=access)


@router.post("/set-password")
async def set_password(
    body: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, bool]:
    """设置或修改密码"""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录",
        )

    await auth_service.set_user_password(db, user_id, body.password)
    return {"ok": True}
