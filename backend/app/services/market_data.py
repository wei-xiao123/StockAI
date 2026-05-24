from __future__ import annotations

import math
import re
from datetime import date, timedelta

import akshare as ak
import pandas as pd
import requests

from app.core.config import get_settings
from app.schemas.stock import (
    CandlePoint,
    MovingAveragePoint,
    QuoteSnapshot,
    StockChartData,
    StockChartViews,
    StockOverviewResponse,
    VolumePoint,
)

DAILY_HISTORY_WINDOW = 180
WEEKLY_HISTORY_WINDOW = 156
MONTHLY_HISTORY_WINDOW = 60
LOCAL_FALLBACK_TRADE_DAYS = 1260
LOOKBACK_DAYS = 3650
REQUEST_TIMEOUT = 10.0


class MarketDataError(Exception):
    """Base exception for market data failures."""


class StockNotFoundError(MarketDataError):
    """Raised when the symbol has no A-share history."""


class MarketDataUnavailableError(MarketDataError):
    """Raised when the upstream data provider is unavailable."""


def get_stock_overview(symbol: str) -> StockOverviewResponse:
    try:
        daily_history_df = _fetch_stock_history(symbol)
    except MarketDataUnavailableError:
        if get_settings().enable_local_market_data_fallback:
            return _build_local_fallback_overview(symbol)
        raise

    stock_name = _fetch_stock_name(symbol)
    full_history = _normalize_history_frame(daily_history_df, history_window=None)
    daily_history = _normalize_history_frame(daily_history_df, history_window=DAILY_HISTORY_WINDOW)
    weekly_history = _resample_history(
        full_history,
        "W-FRI",
        history_window=WEEKLY_HISTORY_WINDOW,
    )
    monthly_history = _resample_history(
        full_history,
        "ME",
        history_window=MONTHLY_HISTORY_WINDOW,
    )
    latest_row = daily_history.iloc[-1]

    return StockOverviewResponse(
        symbol=symbol,
        stock_name=stock_name,
        latest_trade_date=_to_iso_date(latest_row["日期"]),
        quote=QuoteSnapshot(
            open=_to_float(latest_row["开盘"]),
            high=_to_float(latest_row["最高"]),
            low=_to_float(latest_row["最低"]),
            close=_to_float(latest_row["收盘"]),
            change_percent=_to_float(latest_row["涨跌幅"]),
            volume=_to_float(latest_row["成交量"]),
            amount=_to_float(latest_row["成交额"]),
        ),
        chart=_build_chart_data(daily_history),
        charts=StockChartViews(
            daily=_build_chart_data(daily_history),
            weekly=_build_chart_data(weekly_history),
            monthly=_build_chart_data(monthly_history),
        ),
    )


def _fetch_stock_history(symbol: str) -> pd.DataFrame:
    sina_history_df = _fetch_stock_history_from_sina(symbol)
    if not sina_history_df.empty:
        return sina_history_df

    start_date = (date.today() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y%m%d")
    end_date = date.today().strftime("%Y%m%d")

    try:
        history_df = ak.stock_zh_a_hist(
            symbol=symbol,
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust="qfq",
            timeout=REQUEST_TIMEOUT,
        )
    except Exception as exc:
        raise MarketDataUnavailableError("行情数据源暂时不可用，请稍后重试。") from exc

    if history_df.empty:
        raise StockNotFoundError(f"未找到股票代码 {symbol} 的 A 股行情数据。")

    required_columns = {"日期", "开盘", "收盘", "最高", "最低", "成交量", "成交额", "涨跌幅"}
    missing_columns = required_columns.difference(history_df.columns)
    if missing_columns:
        raise MarketDataError(
            f"行情数据字段缺失：{', '.join(sorted(missing_columns))}。"
        )

    return history_df


def _fetch_stock_history_from_sina(symbol: str) -> pd.DataFrame:
    sina_symbol = _to_sina_symbol(symbol)
    start_date = (date.today() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y%m%d")
    end_date = date.today().strftime("%Y%m%d")

    try:
        history_df = ak.stock_zh_a_daily(
            symbol=sina_symbol,
            start_date=start_date,
            end_date=end_date,
            adjust="qfq",
        )
    except Exception as exc:
        raise MarketDataUnavailableError("行情数据源暂时不可用，请稍后重试。") from exc

    if history_df.empty:
        return history_df

    transformed_df = history_df.rename(
        columns={
            "date": "日期",
            "open": "开盘",
            "close": "收盘",
            "high": "最高",
            "low": "最低",
            "volume": "成交量",
            "amount": "成交额",
        }
    ).copy()
    transformed_df["涨跌幅"] = (
        transformed_df["收盘"].pct_change().fillna(0).mul(100)
    )
    return transformed_df


def _fetch_stock_name(symbol: str) -> str:
    sina_symbol = _to_sina_symbol(symbol)
    url = f"https://hq.sinajs.cn/list={sina_symbol}"

    session = requests.Session()
    session.trust_env = False
    headers = {
        "Referer": "https://finance.sina.com.cn",
        "User-Agent": "Mozilla/5.0",
    }
    try:
        response = session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
    except Exception:
        return symbol

    match = re.search(r'="([^,]+),', response.text)
    if not match:
        return symbol

    stock_name = match.group(1).strip()
    return stock_name or symbol


def _normalize_history_frame(
    history_df: pd.DataFrame,
    *,
    history_window: int | None = DAILY_HISTORY_WINDOW,
) -> pd.DataFrame:
    normalized_df = history_df.copy()
    normalized_df["日期"] = pd.to_datetime(normalized_df["日期"], errors="coerce")

    numeric_columns = ["开盘", "收盘", "最高", "最低", "成交量", "成交额", "涨跌幅"]
    for column in numeric_columns:
        normalized_df[column] = pd.to_numeric(normalized_df[column], errors="coerce")

    normalized_df = normalized_df.dropna(
        subset=["日期", "开盘", "收盘", "最高", "最低", "成交量", "成交额"]
    )
    normalized_df = normalized_df.sort_values("日期").reset_index(drop=True)
    if normalized_df.empty:
        raise StockNotFoundError("行情数据为空，无法生成图表。")

    normalized_df["ma5"] = normalized_df["收盘"].rolling(window=5, min_periods=1).mean()
    normalized_df["ma10"] = normalized_df["收盘"].rolling(window=10, min_periods=1).mean()
    normalized_df["ma20"] = normalized_df["收盘"].rolling(window=20, min_periods=1).mean()
    if history_window is not None:
        normalized_df = normalized_df.tail(history_window)
    return normalized_df.reset_index(drop=True)


def _resample_history(
    history_df: pd.DataFrame,
    rule: str,
    *,
    history_window: int | None = None,
) -> pd.DataFrame:
    resampled = history_df.copy()
    resampled = resampled.set_index("日期").sort_index()
    aggregated = resampled.resample(rule).agg(
        {
            "开盘": "first",
            "收盘": "last",
            "最高": "max",
            "最低": "min",
            "成交量": "sum",
            "成交额": "sum",
            "涨跌幅": "sum",
        }
    )
    aggregated = aggregated.dropna(subset=["开盘", "收盘", "最高", "最低"])
    aggregated = aggregated.reset_index()
    aggregated["ma5"] = aggregated["收盘"].rolling(window=5, min_periods=1).mean()
    aggregated["ma10"] = aggregated["收盘"].rolling(window=10, min_periods=1).mean()
    aggregated["ma20"] = aggregated["收盘"].rolling(window=20, min_periods=1).mean()
    if history_window is not None:
        aggregated = aggregated.tail(history_window)
    return aggregated.reset_index(drop=True)


def _build_chart_data(history_df: pd.DataFrame) -> StockChartData:
    return StockChartData(
        candles=[
            CandlePoint(
                trade_date=_to_iso_date(row["日期"]),
                open=_to_float(row["开盘"]),
                close=_to_float(row["收盘"]),
                low=_to_float(row["最低"]),
                high=_to_float(row["最高"]),
            )
            for _, row in history_df.iterrows()
        ],
        volumes=[
            VolumePoint(
                trade_date=_to_iso_date(row["日期"]),
                volume=_to_float(row["成交量"]),
            )
            for _, row in history_df.iterrows()
        ],
        ma5=_build_moving_average(history_df, "ma5"),
        ma10=_build_moving_average(history_df, "ma10"),
        ma20=_build_moving_average(history_df, "ma20"),
    )


def _build_moving_average(history_df: pd.DataFrame, column: str) -> list[MovingAveragePoint]:
    return [
        MovingAveragePoint(
            trade_date=_to_iso_date(row["日期"]),
            value=round(_to_float(row[column]), 2),
        )
        for _, row in history_df.iterrows()
    ]


def _to_iso_date(value: object) -> str:
    return pd.Timestamp(value).date().isoformat()


def _to_float(value: object) -> float:
    return round(float(value), 2)


def _to_sina_symbol(symbol: str) -> str:
    return f"{'sh' if symbol.startswith(('5', '6', '9')) else 'sz'}{symbol}"


def _build_local_fallback_overview(symbol: str) -> StockOverviewResponse:
    trade_dates = pd.bdate_range(
        end=pd.Timestamp.today().normalize(),
        periods=LOCAL_FALLBACK_TRADE_DAYS,
    )
    seed = int(symbol[-3:])
    base_price = 20 + (seed % 180)
    trend = ((seed % 11) - 5) / 10
    last_close = base_price

    rows: list[dict[str, float | pd.Timestamp]] = []
    for index, trade_date in enumerate(trade_dates):
        seasonal = math.sin((index + seed) / 7) * 1.4
        drift = trend * 0.18
        close = max(2.0, last_close + seasonal * 0.35 + drift)
        open_price = max(2.0, last_close + seasonal * 0.18)
        high = max(open_price, close) + 0.6 + abs(seasonal) * 0.2
        low = max(1.0, min(open_price, close) - 0.55 - abs(seasonal) * 0.15)
        volume = 85000 + ((index + 1) * ((seed % 17) + 3) * 120)
        amount = volume * close * 100
        change_percent = ((close / last_close) - 1) * 100 if index > 0 else 0.0
        rows.append(
            {
                "日期": trade_date,
                "开盘": round(open_price, 2),
                "收盘": round(close, 2),
                "最高": round(high, 2),
                "最低": round(low, 2),
                "成交量": round(volume, 2),
                "成交额": round(amount, 2),
                "涨跌幅": round(change_percent, 2),
            }
        )
        last_close = close

    full_history = _normalize_history_frame(pd.DataFrame(rows), history_window=None)
    daily_history = _normalize_history_frame(full_history, history_window=DAILY_HISTORY_WINDOW)
    latest_row = daily_history.iloc[-1]
    weekly_history = _resample_history(
        full_history,
        "W-FRI",
        history_window=WEEKLY_HISTORY_WINDOW,
    )
    monthly_history = _resample_history(
        full_history,
        "ME",
        history_window=MONTHLY_HISTORY_WINDOW,
    )

    return StockOverviewResponse(
        symbol=symbol,
        stock_name=f"本地演示 {symbol}",
        latest_trade_date=_to_iso_date(latest_row["日期"]),
        quote=QuoteSnapshot(
            open=_to_float(latest_row["开盘"]),
            high=_to_float(latest_row["最高"]),
            low=_to_float(latest_row["最低"]),
            close=_to_float(latest_row["收盘"]),
            change_percent=_to_float(latest_row["涨跌幅"]),
            volume=_to_float(latest_row["成交量"]),
            amount=_to_float(latest_row["成交额"]),
        ),
        chart=_build_chart_data(daily_history),
        charts=StockChartViews(
            daily=_build_chart_data(daily_history),
            weekly=_build_chart_data(weekly_history),
            monthly=_build_chart_data(monthly_history),
        ),
    )
