from pydantic import BaseModel, Field


class QuoteSnapshot(BaseModel):
    open: float
    high: float
    low: float
    close: float
    change_percent: float
    volume: float
    amount: float


class CandlePoint(BaseModel):
    trade_date: str = Field(description="ISO date string")
    open: float
    close: float
    low: float
    high: float


class VolumePoint(BaseModel):
    trade_date: str = Field(description="ISO date string")
    volume: float


class MovingAveragePoint(BaseModel):
    trade_date: str = Field(description="ISO date string")
    value: float


class StockChartData(BaseModel):
    candles: list[CandlePoint]
    volumes: list[VolumePoint]
    ma5: list[MovingAveragePoint]
    ma10: list[MovingAveragePoint]
    ma20: list[MovingAveragePoint]


class StockChartViews(BaseModel):
    daily: StockChartData
    weekly: StockChartData
    monthly: StockChartData


class StockOverviewResponse(BaseModel):
    symbol: str
    stock_name: str
    market: str = "CN"
    latest_trade_date: str
    quote: QuoteSnapshot
    chart: StockChartData
    charts: StockChartViews | None = None
