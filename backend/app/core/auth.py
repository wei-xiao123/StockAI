from __future__ import annotations

import hashlib
import hmac
from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import Cookie, HTTPException, status

from app.core.config import get_settings

SESSION_COOKIE_NAME = "stockai_session"


@dataclass(frozen=True)
class SessionContext:
    session_id: str
    user_id: UUID


def create_session_context() -> SessionContext:
    return SessionContext(session_id=str(uuid4()), user_id=uuid4())


def verify_access_password(password: str) -> bool:
    return password == get_settings().access_password


def build_session_expiry(days: int = 30) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def require_session(session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)) -> SessionContext:
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录。")

    session_id = parse_session_cookie(session_cookie)
    session = read_session_context(session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录会话无效，请重新登录。")

    return session


def serialize_session_cookie(session: SessionContext) -> str:
    payload = session.session_id.encode("utf-8")
    signature = sign_session_id(session.session_id)
    return f"{urlsafe_b64encode(payload).decode('utf-8').rstrip('=')}.{signature}"


def parse_session_cookie(cookie_value: str) -> str:
    try:
        encoded_session_id, signature = cookie_value.split(".", 1)
        padded = encoded_session_id + "=" * (-len(encoded_session_id) % 4)
        session_id = urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录会话无效，请重新登录。") from exc

    expected_signature = sign_session_id(session_id)
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录会话无效，请重新登录。")

    return session_id


def sign_session_id(session_id: str) -> str:
    secret = get_settings().session_signing_secret.encode("utf-8")
    return hmac.new(secret, session_id.encode("utf-8"), hashlib.sha256).hexdigest()


def read_session_context(session_id: str) -> SessionContext | None:
    from app.services.storage import get_user_session_context

    return get_user_session_context(session_id)
