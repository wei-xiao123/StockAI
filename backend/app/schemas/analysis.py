from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.stock import QuoteSnapshot

Sentiment = Literal["bullish", "neutral", "bearish"]
RiskLevel = Literal["low", "medium", "high"]


class AnalysisOutput(BaseModel):
    summary: str = Field(min_length=1)
    sentiment: Sentiment
    risk_level: RiskLevel
    key_drivers: list[str] = Field(min_length=3, max_length=3)
    risk_factors: list[str] = Field(min_length=2, max_length=3)


class AnalysisRequest(BaseModel):
    symbol: str = Field(pattern=r"^\d{6}$")
    user_id: UUID | None = None


class StockRef(BaseModel):
    symbol: str
    stock_name: str
    market: str = "CN"


class ChartSummary(BaseModel):
    date_range: str
    latest_close: float
    latest_change_percent: float
    trend_note: str


class AnalysisResponse(BaseModel):
    record_id: UUID | None
    save_status: Literal["saved", "failed"]
    stock: StockRef
    quote: QuoteSnapshot
    chart_summary: ChartSummary
    analysis: AnalysisOutput


class AnalysisListItem(BaseModel):
    id: UUID
    symbol: str
    stock_name: str
    created_at: str
    sentiment: Sentiment
    risk_level: RiskLevel
    summary: str


class AnalysisListResponse(BaseModel):
    items: list[AnalysisListItem]
    total: int
    next_offset: int | None


class AnalysisDetailResponse(BaseModel):
    id: UUID
    symbol: str
    stock_name: str
    market: str = "CN"
    created_at: str
    sentiment: Sentiment
    risk_level: RiskLevel
    summary: str
    quote_snapshot: QuoteSnapshot
    chart_meta: ChartSummary
    analysis: AnalysisOutput
    model_name: str
    prompt_version: str
