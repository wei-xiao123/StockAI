from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from uuid import UUID

from supabase import Client, create_client

from app.core.config import get_settings
from app.schemas.analysis import (
    AnalysisDetailResponse,
    AnalysisListItem,
    AnalysisListResponse,
    AnalysisOutput,
    ChartSummary,
    RiskLevel,
    Sentiment,
)
from app.schemas.stock import QuoteSnapshot
from app.schemas.stock import StockOverviewResponse


class StorageError(Exception):
    """Base exception for storage failures."""


class StorageUnavailableError(StorageError):
    """Raised when Supabase is not configured."""


class AnalysisRecordNotFoundError(StorageError):
    """Raised when an analysis record cannot be found."""


class SessionNotFoundError(StorageError):
    """Raised when a session cannot be found."""


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise StorageUnavailableError("Supabase 未配置，分析结果暂未保存。")

    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def create_user_session(*, session_id: str, user_id: UUID, expires_at: datetime) -> None:
    client = get_supabase_client()
    payload = {
        "session_id": session_id,
        "user_id": str(user_id),
        "is_active": True,
        "expires_at": expires_at.astimezone(timezone.utc).isoformat(),
        "revoked_at": None,
    }

    try:
        client.table("user_sessions").insert(payload).execute()
    except Exception as exc:  # pragma: no cover - provider-specific
        raise StorageError("会话创建失败。") from exc


def revoke_user_session(session_id: str) -> None:
    client = get_supabase_client()
    payload = {
        "is_active": False,
        "revoked_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        response = client.table("user_sessions").update(payload).eq("session_id", session_id).execute()
    except Exception as exc:  # pragma: no cover - provider-specific
        raise StorageError("会话注销失败。") from exc

    if not response.data:
        raise SessionNotFoundError("会话不存在。")


def session_is_active(session_id: str, user_id: UUID) -> bool:
    client = get_supabase_client()

    try:
        response = (
            client.table("user_sessions")
            .select("session_id,user_id,is_active,expires_at")
            .eq("session_id", session_id)
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
    except Exception as exc:  # pragma: no cover - provider-specific
        raise StorageError("会话校验失败。") from exc

    records = response.data or []
    if not records:
        return False

    record = records[0]
    if not record.get("is_active", False):
        return False

    expires_at_raw = record.get("expires_at")
    if not expires_at_raw:
        return False

    expires_at = datetime.fromisoformat(str(expires_at_raw).replace("Z", "+00:00"))
    return expires_at > datetime.now(timezone.utc)


def get_user_session_context(session_id: str):
    from app.core.auth import SessionContext

    client = get_supabase_client()

    try:
        response = (
            client.table("user_sessions")
            .select("session_id,user_id,is_active,expires_at")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # pragma: no cover - provider-specific
        raise StorageError("会话查询失败。") from exc

    records = response.data or []
    if not records:
        return None

    record = records[0]
    if not record.get("is_active", False):
        return None

    expires_at_raw = record.get("expires_at")
    if not expires_at_raw:
        return None

    expires_at = datetime.fromisoformat(str(expires_at_raw).replace("Z", "+00:00"))
    if expires_at <= datetime.now(timezone.utc):
        return None

    try:
        user_id = UUID(str(record["user_id"]))
    except ValueError:
        return None

    return SessionContext(session_id=session_id, user_id=user_id)


def save_analysis_record(
    *,
    user_id: UUID | None,
    overview: StockOverviewResponse,
    chart_summary: ChartSummary,
    analysis: AnalysisOutput,
    model_name: str,
    prompt_version: str,
) -> UUID:
    payload = {
        "user_id": str(user_id) if user_id else None,
        "symbol": overview.symbol,
        "stock_name": overview.stock_name,
        "market": overview.market,
        "latest_trade_date": overview.latest_trade_date,
        "sentiment": analysis.sentiment,
        "risk_level": analysis.risk_level,
        "summary": analysis.summary,
        "key_drivers": analysis.key_drivers,
        "risk_factors": analysis.risk_factors,
        "quote_snapshot": overview.quote.model_dump(mode="json"),
        "chart_meta": chart_summary.model_dump(mode="json"),
        "analysis_json": analysis.model_dump(mode="json"),
        "llm_provider": "siliconflow",
        "llm_model": model_name,
        "prompt_version": prompt_version,
        "source_provider": "akshare",
    }

    client = get_supabase_client()

    try:
        response = client.table("analysis_records").insert(payload).execute()
    except Exception as exc:  # pragma: no cover - SDK raises provider-specific exceptions.
        raise StorageError("分析结果保存失败。") from exc

    if not response.data:
        raise StorageError("分析结果保存失败，数据库没有返回记录。")

    record_id = response.data[0].get("id")
    if not record_id:
        raise StorageError("分析结果保存失败，数据库返回了空记录 ID。")

    return UUID(str(record_id))


def list_analysis_records(
    *,
    limit: int,
    offset: int,
    symbol: str | None,
    sentiment: Sentiment | None,
    risk_level: RiskLevel | None,
    user_id: UUID | None,
) -> AnalysisListResponse:
    client = get_supabase_client()
    query = (
        client.table("analysis_records")
        .select("id,symbol,stock_name,created_at,sentiment,risk_level,summary", count="exact")
        .order("created_at", desc=True)
    )

    if symbol:
        query = query.eq("symbol", symbol)
    if sentiment:
        query = query.eq("sentiment", sentiment)
    if risk_level:
        query = query.eq("risk_level", risk_level)
    if user_id:
        query = query.eq("user_id", str(user_id))

    try:
        response = query.range(offset, offset + limit - 1).execute()
    except Exception as exc:  # pragma: no cover - SDK raises provider-specific exceptions.
        raise StorageError("历史记录查询失败。") from exc

    records = response.data or []
    total = int(response.count or 0)
    next_offset = offset + limit if offset + limit < total else None

    return AnalysisListResponse(
        items=[_build_analysis_list_item(record) for record in records],
        total=total,
        next_offset=next_offset,
    )


def get_analysis_record_detail(analysis_id: UUID, *, user_id: UUID | None = None) -> AnalysisDetailResponse:
    client = get_supabase_client()

    try:
        response = (
            client.table("analysis_records")
            .select("*")
            .eq("id", str(analysis_id))
            .execute()
        )
    except Exception as exc:  # pragma: no cover - SDK raises provider-specific exceptions.
        raise StorageError("历史详情查询失败。") from exc

    records = response.data or []
    if not records:
        raise AnalysisRecordNotFoundError(f"未找到分析记录 {analysis_id}。")

    if user_id and str(records[0].get("user_id")) != str(user_id):
        raise AnalysisRecordNotFoundError(f"未找到分析记录 {analysis_id}。")

    return _build_analysis_detail_response(records[0])


def _build_analysis_list_item(record: dict) -> AnalysisListItem:
    return AnalysisListItem(
        id=UUID(str(record["id"])),
        symbol=str(record["symbol"]),
        stock_name=str(record["stock_name"]),
        created_at=str(record["created_at"]),
        sentiment=str(record["sentiment"]),
        risk_level=str(record["risk_level"]),
        summary=str(record["summary"]),
    )


def _build_analysis_detail_response(record: dict) -> AnalysisDetailResponse:
    return AnalysisDetailResponse(
        id=UUID(str(record["id"])),
        symbol=str(record["symbol"]),
        stock_name=str(record["stock_name"]),
        market=str(record.get("market", "CN")),
        created_at=str(record["created_at"]),
        sentiment=str(record["sentiment"]),
        risk_level=str(record["risk_level"]),
        summary=str(record["summary"]),
        quote_snapshot=QuoteSnapshot.model_validate(record["quote_snapshot"]),
        chart_meta=ChartSummary.model_validate(record["chart_meta"]),
        analysis=AnalysisOutput.model_validate(record["analysis_json"]),
        model_name=str(record["llm_model"]),
        prompt_version=str(record["prompt_version"]),
    )
