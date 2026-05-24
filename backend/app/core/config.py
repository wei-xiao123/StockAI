from functools import lru_cache
from pathlib import Path

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    app_name: str = "StockAI API"
    app_env: str = "development"
    api_prefix: str = "/api"
    frontend_origin: str = "http://localhost:5174,http://127.0.0.1:5174"
    access_password: str = "rongxi"
    session_signing_secret: str = Field(min_length=16)
    siliconflow_api_key: str = ""
    siliconflow_model: str = "deepseek-ai/DeepSeek-V4-Flash"
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    enable_local_analysis_fallback: bool = True
    enable_local_market_data_fallback: bool = True

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("session_signing_secret")
    @classmethod
    def validate_session_signing_secret(cls, value: str) -> str:
        secret = value.strip()
        if len(secret) < 16:
            raise ValueError("session_signing_secret must be at least 16 characters long")
        return secret

    @property
    def cors_origins(self) -> list[str]:
        origins = [item.strip() for item in self.frontend_origin.split(",") if item.strip()]
        if "http://localhost:5174" not in origins:
            origins.append("http://localhost:5174")
        if "http://127.0.0.1:5174" not in origins:
            origins.append("http://127.0.0.1:5174")
        return list(dict.fromkeys(origins))


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        raise RuntimeError(
            "SESSION_SIGNING_SECRET 未配置或长度不足，请先在 backend/.env 中设置至少 16 位的密钥。"
        ) from exc
