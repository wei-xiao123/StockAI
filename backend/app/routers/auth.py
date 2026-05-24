from fastapi import APIRouter, Cookie, HTTPException, Response, status

from app.core.auth import (
    build_session_expiry,
    SESSION_COOKIE_NAME,
    create_session_context,
    require_session,
    serialize_session_cookie,
    verify_access_password,
)
from app.core.config import get_settings
from app.schemas.auth import LoginRequest, SessionResponse
from app.services.storage import (
    create_user_session,
    revoke_user_session,
    session_is_active,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest, response: Response) -> SessionResponse:
    if not verify_access_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="访问口令错误。")

    settings = get_settings()
    session = create_session_context()
    expires_at = build_session_expiry()
    create_user_session(session_id=session.session_id, user_id=session.user_id, expires_at=expires_at)
    cookie_value = serialize_session_cookie(session)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=cookie_value,
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.resolved_session_cookie_secure,
        max_age=60 * 60 * 24 * 30,
        path="/",
    )
    return SessionResponse(session_id=session.session_id, user_id=str(session.user_id), expires_in_days=30)


@router.post("/logout")
def logout(response: Response, session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)) -> dict[str, str]:
    settings = get_settings()
    if session_cookie:
        try:
            session = require_session(session_cookie)
            revoke_user_session(session.session_id)
        except HTTPException:
            pass
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        secure=settings.resolved_session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )
    return {"status": "ok"}


@router.get("/me", response_model=SessionResponse)
def me(session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)) -> SessionResponse:
    session = require_session(session_cookie)
    if not session_is_active(session.session_id, session.user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录会话已失效，请重新登录。")
    return SessionResponse(session_id=session.session_id, user_id=str(session.user_id), expires_in_days=30)
