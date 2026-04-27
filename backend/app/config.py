from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    DATABASE_URL: Optional[str] = None
    REDIS_URL: Optional[str] = None
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_DAYS: Optional[int] = None
    REFRESH_TOKEN_EXPIRE_DAYS: Optional[int] = None
    ZHIPU_API_KEY: Optional[str] = None
    XFYUN_APP_ID: Optional[str] = None
    XFYUN_API_KEY: Optional[str] = None
    XFYUN_API_SECRET: Optional[str] = None
    ALIYUN_OSS_ACCESS_KEY_ID: Optional[str] = None
    ALIYUN_OSS_ACCESS_KEY_SECRET: Optional[str] = None
    ALIYUN_OSS_BUCKET: Optional[str] = None
    ALIYUN_OSS_ENDPOINT: Optional[str] = None
    ALIYUN_SMS_ACCESS_KEY_ID: Optional[str] = None
    ALIYUN_SMS_ACCESS_KEY_SECRET: Optional[str] = None
    ALIYUN_SMS_SIGN_NAME: Optional[str] = None
    ALIYUN_SMS_TEMPLATE_CODE: Optional[str] = None
    JPUSH_APP_KEY: Optional[str] = None
    JPUSH_MASTER_SECRET: Optional[str] = None
    DAILY_FREE_CHAT_LIMIT: Optional[int] = None
    MAX_INPUT_LENGTH: Optional[int] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: Optional[str] = None
    DEEPSEEK_MODEL: Optional[str] = None
    VIDEO_SERVER_URL: Optional[str] = "http://localhost:8080"


settings = Settings()