from __future__ import annotations

import json
from dataclasses import dataclass

import httpx
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.analysis import AnalysisOutput, ChartSummary
from app.schemas.stock import StockOverviewResponse

PROMPT_VERSION = "v2"
MAX_ANALYSIS_ATTEMPTS = 2


class AnalysisServiceError(Exception):
    """Base exception for AI analysis failures."""


class AnalysisServiceUnavailableError(AnalysisServiceError):
    """Raised when the upstream model service is unavailable or misconfigured."""


class AnalysisResponseFormatError(AnalysisServiceError):
    """Raised when the model does not return a valid structured payload."""


@dataclass(frozen=True)
class AnalysisRunResult:
    analysis: AnalysisOutput
    chart_summary: ChartSummary
    model_name: str
    prompt_version: str


def run_stock_analysis(overview: StockOverviewResponse) -> AnalysisRunResult:
    settings = get_settings()
    chart_summary = build_chart_summary(overview)
    if not settings.siliconflow_api_key:
        return _run_local_analysis(overview, chart_summary, model_name="local-rule-v1")

    prompt = build_analysis_prompt(overview, chart_summary)
    last_error: Exception | None = None

    for _ in range(MAX_ANALYSIS_ATTEMPTS):
        try:
            analysis = _call_siliconflow(prompt)
            return AnalysisRunResult(
                analysis=analysis,
                chart_summary=chart_summary,
                model_name=settings.siliconflow_model,
                prompt_version=PROMPT_VERSION,
            )
        except AnalysisResponseFormatError as exc:
            last_error = exc
        except Exception as exc:  # pragma: no cover - provider specific failures.
            last_error = exc

    if isinstance(last_error, AnalysisResponseFormatError):
        if settings.enable_local_analysis_fallback:
            return _run_local_analysis(
                overview,
                chart_summary,
                model_name="local-rule-fallback-v2",
            )
        raise AnalysisResponseFormatError("AI 分析结果格式校验失败，请稍后重试。") from last_error

    if settings.enable_local_analysis_fallback:
        return _run_local_analysis(
            overview,
            chart_summary,
            model_name="local-rule-fallback-v2",
        )

    raise AnalysisServiceUnavailableError("AI 分析服务暂时不可用，请稍后重试。") from last_error


def build_chart_summary(overview: StockOverviewResponse) -> ChartSummary:
    candles = overview.chart.candles
    latest_candle = candles[-1]
    first_candle = candles[0]
    ma5_value = overview.chart.ma5[-1].value
    ma20_value = overview.chart.ma20[-1].value
    window_return = ((latest_candle.close / first_candle.close) - 1) * 100

    trend_parts: list[str] = []
    trend_parts.append("价格站上 MA20" if latest_candle.close >= ma20_value else "价格位于 MA20 下方")
    trend_parts.append("短线强于 MA5" if latest_candle.close >= ma5_value else "短线弱于 MA5")
    trend_parts.append("90 日区间上涨" if window_return >= 0 else "90 日区间回落")

    return ChartSummary(
        date_range=f"{candles[0].trade_date} ~ {candles[-1].trade_date}",
        latest_close=overview.quote.close,
        latest_change_percent=overview.quote.change_percent,
        trend_note="，".join(trend_parts),
    )


def build_analysis_prompt(overview: StockOverviewResponse, chart_summary: ChartSummary) -> str:
    latest_candles = overview.chart.candles[-10:]
    latest_volumes = overview.chart.volumes[-10:]
    latest_ma5 = overview.chart.ma5[-10:]
    latest_ma10 = overview.chart.ma10[-10:]
    latest_ma20 = overview.chart.ma20[-10:]
    latest_points = [
        {
            "date": candle.trade_date,
            "open": candle.open,
            "close": candle.close,
            "low": candle.low,
            "high": candle.high,
            "volume": volume.volume,
            "ma5": ma5.value,
            "ma10": ma10.value,
            "ma20": ma20.value,
        }
        for candle, volume, ma5, ma10, ma20 in zip(
            latest_candles,
            latest_volumes,
            latest_ma5,
            latest_ma10,
            latest_ma20,
            strict=True,
        )
    ]

    return f"""
你是一个只基于给定行情数据输出结构化结论的 A 股分析助手。
不要输出 Markdown，不要输出解释，不要补充任何 schema 外字段。
你必须只返回符合 schema 的 JSON。

输出要求：
- summary: 2 到 4 句中文总结，聚焦当前走势、动量和风险，不要出现“无法保证”之类套话。
- sentiment: 只能是 bullish / neutral / bearish 之一。
- risk_level: 只能是 low / medium / high 之一。
- key_drivers: 必须正好 3 条，每条一句简洁中文。
- risk_factors: 必须 2 到 3 条，每条一句简洁中文。
- 只能依据提供的数据做判断，不要杜撰新闻、财报、政策或基本面。

股票信息：
- 股票代码: {overview.symbol}
- 股票名称: {overview.stock_name}
- 市场: {overview.market}
- 最新交易日: {overview.latest_trade_date}

最新报价：
- 开盘: {overview.quote.open}
- 最高: {overview.quote.high}
- 最低: {overview.quote.low}
- 收盘: {overview.quote.close}
- 涨跌幅: {overview.quote.change_percent}%
- 成交量: {overview.quote.volume}
- 成交额: {overview.quote.amount}

图表摘要：
- 时间区间: {chart_summary.date_range}
- 最新收盘: {chart_summary.latest_close}
- 最新涨跌幅: {chart_summary.latest_change_percent}%
- 趋势备注: {chart_summary.trend_note}

最近 10 个交易日样本：
{json.dumps(latest_points, ensure_ascii=False, indent=2)}
""".strip()


def _call_siliconflow(prompt: str) -> AnalysisOutput:
    settings = get_settings()
    url = f"{settings.siliconflow_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.siliconflow_model,
        "messages": [
            {
                "role": "system",
                "content": "你是一个严格输出 JSON 的 A 股分析助手。只返回合法 JSON，不要输出其他内容。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 512,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {settings.siliconflow_api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise AnalysisServiceUnavailableError(
            f"硅基流动接口调用失败：{exc.response.status_code} {exc.response.text}"
        ) from exc
    except Exception as exc:
        raise AnalysisServiceUnavailableError("硅基流动接口暂时不可用，请稍后重试。") from exc

    data = response.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AnalysisResponseFormatError("模型返回内容结构不完整。") from exc

    if isinstance(content, dict):
        try:
            return AnalysisOutput.model_validate(content)
        except ValidationError as exc:
            raise AnalysisResponseFormatError("AI 返回的 JSON 结构不符合预期。") from exc

    if not isinstance(content, str) or not content.strip():
        raise AnalysisResponseFormatError("AI 未返回可解析的结构化内容。")

    try:
        return AnalysisOutput.model_validate_json(content)
    except ValidationError as exc:
        raise AnalysisResponseFormatError("AI 返回的文本无法解析为合法 JSON。") from exc


def _run_local_analysis(
    overview: StockOverviewResponse,
    chart_summary: ChartSummary,
    *,
    model_name: str,
) -> AnalysisRunResult:
    analysis = _build_local_analysis_output(overview, chart_summary)
    return AnalysisRunResult(
        analysis=analysis,
        chart_summary=chart_summary,
        model_name=model_name,
        prompt_version=PROMPT_VERSION,
    )


def _build_local_analysis_output(
    overview: StockOverviewResponse,
    chart_summary: ChartSummary,
) -> AnalysisOutput:
    candles = overview.chart.candles
    latest_candle = candles[-1]
    first_candle = candles[0]
    ma5_value = overview.chart.ma5[-1].value
    ma10_value = overview.chart.ma10[-1].value
    ma20_value = overview.chart.ma20[-1].value
    window_return = ((latest_candle.close / first_candle.close) - 1) * 100
    intraday_range = ((latest_candle.high - latest_candle.low) / latest_candle.close) * 100
    close_positions = sum(
        1 for candle in candles[-5:] if candle.close >= candle.open
    )

    bullish_score = 0
    risk_score = 0

    if latest_candle.close >= ma20_value:
        bullish_score += 1
    if latest_candle.close >= ma5_value >= ma10_value:
        bullish_score += 1
    if window_return >= 3:
        bullish_score += 1
    elif window_return <= -3:
        bullish_score -= 1
    if overview.quote.change_percent >= 1:
        bullish_score += 1
    elif overview.quote.change_percent <= -1:
        bullish_score -= 1

    if intraday_range >= 4:
        risk_score += 1
    if latest_candle.close < ma10_value:
        risk_score += 1
    if window_return <= -5:
        risk_score += 1

    sentiment: str
    if bullish_score >= 3:
        sentiment = "bullish"
    elif bullish_score <= 0:
        sentiment = "bearish"
    else:
        sentiment = "neutral"

    risk_level: str
    if risk_score >= 2:
        risk_level = "high"
    elif risk_score == 1:
        risk_level = "medium"
    else:
        risk_level = "low"

    summary_parts = [
        f"{overview.stock_name} 最近 90 日区间{('上涨' if window_return >= 0 else '回落')}{abs(window_return):.2f}%，当前收盘价为 {overview.quote.close:.2f} 元。",
        f"股价{('位于' if latest_candle.close >= ma20_value else '跌回')}中期均线附近，{chart_summary.trend_note}。",
        f"最近 5 个交易日中有 {close_positions} 天收阳，单日振幅约 {intraday_range:.2f}%。",
    ]
    if risk_level == "high":
        summary_parts.append("短线波动与回撤压力偏大，适合先观察量价延续性。")
    elif sentiment == "bullish":
        summary_parts.append("整体结构仍偏强，但更适合结合后续量能确认趋势延续。")
    else:
        summary_parts.append("趋势暂无单边确认，更适合把它视为区间博弈或等待信号明朗。")

    key_drivers = [
        f"最新收盘价{('站上' if latest_candle.close >= ma20_value else '位于')} MA20，说明中期趋势{('仍偏稳' if latest_candle.close >= ma20_value else '存在压力')}。",
        f"MA5 为 {ma5_value:.2f}、MA10 为 {ma10_value:.2f}，短线均线关系反映当前动量{('偏强' if ma5_value >= ma10_value else '偏弱')}。",
        f"90 日区间收益约为 {window_return:.2f}%，与最新单日涨跌幅 {overview.quote.change_percent:.2f}% 一起构成当前强弱判断。",
    ]

    risk_factors = [
        f"最新单日振幅约 {intraday_range:.2f}%，若波动继续放大，短线追价的回撤风险会上升。",
        f"若后续收盘价持续跌破 MA10 {ma10_value:.2f} 一线，当前趋势判断可能转弱。",
    ]
    if risk_level != "low":
        risk_factors.append("当前结构对后续量价配合较敏感，成交衰减时趋势延续性会下降。")

    return AnalysisOutput(
        summary=" ".join(summary_parts),
        sentiment=sentiment,
        risk_level=risk_level,
        key_drivers=key_drivers,
        risk_factors=risk_factors[:3],
    )
