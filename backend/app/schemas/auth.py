from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class SessionResponse(BaseModel):
    session_id: str
    user_id: str
    expires_in_days: int
