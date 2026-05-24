from __future__ import annotations

import unittest
from datetime import UTC, datetime, timedelta
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.core.auth import SessionContext, serialize_session_cookie
from app.main import create_app
from app.schemas.analysis import AnalysisOutput, ChartSummary
from app.schemas.stock import (
    CandlePoint,
    MovingAveragePoint,
    QuoteSnapshot,
    StockChartData,
    StockOverviewResponse,
    VolumePoint,
)
from app.services.market_data import StockNotFoundError
from app.services.storage import StorageError


def build_overview(symbol: str = "600519") -> StockOverviewResponse:
    base_date = datetime(2026, 1, 1, tzinfo=UTC)
    candles: list[CandlePoint] = []
    volumes: list[VolumePoint] = []
    ma5: list[MovingAveragePoint] = []
    ma10: list[MovingAveragePoint] = []
    ma20: list[MovingAveragePoint] = []

    for index in range(20):
        trade_date = (base_date + timedelta(days=index)).date().isoformat()
        open_price = 100 + index * 0.5
        close_price = open_price + 1
        low_price = open_price - 1
        high_price = close_price + 1
        volume = 10000 + index * 100

        candles.append(
            CandlePoint(
                trade_date=trade_date,
                open=open_price,
                close=close_price,
                low=low_price,
                high=high_price,
            )
        )
        volumes.append(VolumePoint(trade_date=trade_date, volume=volume))
        ma5.append(MovingAveragePoint(trade_date=trade_date, value=close_price - 0.5))
        ma10.append(MovingAveragePoint(trade_date=trade_date, value=close_price - 1.0))
        ma20.append(MovingAveragePoint(trade_date=trade_date, value=close_price - 1.5))

    chart = StockChartData(
        candles=candles,
        volumes=volumes,
        ma5=ma5,
        ma10=ma10,
        ma20=ma20,
    )

    return StockOverviewResponse(
        symbol=symbol,
        stock_name="测试股票",
        market="CN",
        latest_trade_date=candles[-1].trade_date,
        quote=QuoteSnapshot(
            open=candles[-1].open,
            high=candles[-1].high,
            low=candles[-1].low,
            close=candles[-1].close,
            change_percent=1.23,
            volume=volumes[-1].volume,
            amount=1234567.89,
        ),
        chart=chart,
        charts=None,
    )


def build_analysis_result(overview: StockOverviewResponse):
    return SimpleNamespace(
        analysis=AnalysisOutput(
            summary="测试摘要",
            sentiment="bullish",
            risk_level="low",
            key_drivers=["driver-1", "driver-2", "driver-3"],
            risk_factors=["risk-1", "risk-2"],
        ),
        chart_summary=ChartSummary(
            date_range="2026-01-01 ~ 2026-01-20",
            latest_close=overview.quote.close,
            latest_change_percent=overview.quote.change_percent,
            trend_note="trend",
        ),
        model_name="local-rule-v1",
        prompt_version="v2",
    )


class AnalysesApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.session = SessionContext(session_id="test-session-id", user_id=uuid4())
        self.session_cookie = serialize_session_cookie(self.session)

    def _client_with_session(self) -> TestClient:
        client = TestClient(self.app)
        client.cookies.set("stockai_session", self.session_cookie)
        return client

    def test_create_analysis_rebuilds_overview_from_symbol(self) -> None:
        captured: dict[str, object] = {}

        with (
            patch("app.core.auth.read_session_context", return_value=self.session),
            patch("app.routers.analyses.get_stock_overview", side_effect=lambda symbol: build_overview(symbol)),
            patch(
                "app.routers.analyses.run_stock_analysis",
                side_effect=lambda overview: self._capture_analysis(overview, captured),
            ),
            patch("app.routers.analyses.save_analysis_record", return_value=uuid4()),
        ):
            with self._client_with_session() as client:
                response = client.post("/api/analyses", json={"symbol": "600519"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["save_status"], "saved")
        self.assertEqual(body["stock"]["symbol"], "600519")
        self.assertEqual(captured["symbol"], "600519")

    def test_create_analysis_returns_404_when_symbol_not_found(self) -> None:
        def raise_not_found(symbol: str) -> None:
            raise StockNotFoundError(f"未找到股票代码 {symbol} 的 A 股行情数据。")

        with (
            patch("app.core.auth.read_session_context", return_value=self.session),
            patch("app.routers.analyses.get_stock_overview", side_effect=raise_not_found),
        ):
            with self._client_with_session() as client:
                response = client.post("/api/analyses", json={"symbol": "600519"})

        self.assertEqual(response.status_code, 404)
        self.assertIn("未找到股票代码", response.json()["detail"])

    def test_create_analysis_marks_save_failed_when_storage_fails(self) -> None:
        overview = build_overview("600519")

        with (
            patch("app.core.auth.read_session_context", return_value=self.session),
            patch("app.routers.analyses.get_stock_overview", return_value=overview),
            patch("app.routers.analyses.run_stock_analysis", return_value=build_analysis_result(overview)),
            patch("app.routers.analyses.save_analysis_record", side_effect=StorageError("store failed")),
        ):
            with self._client_with_session() as client:
                response = client.post("/api/analyses", json={"symbol": "600519"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["save_status"], "failed")
        self.assertIsNone(body["record_id"])

    def test_create_analysis_rejects_signed_cookie_tampering(self) -> None:
        tampered_cookie = self.session_cookie[:-1] + (
            "0" if self.session_cookie[-1] != "0" else "1"
        )

        with patch("app.core.auth.read_session_context", return_value=self.session):
            with self._client_with_session() as client:
                client.cookies.set("stockai_session", tampered_cookie)
                response = client.post("/api/analyses", json={"symbol": "600519"})

        self.assertEqual(response.status_code, 401)
        self.assertIn("登录会话无效", response.json()["detail"])

    @staticmethod
    def _capture_analysis(overview: StockOverviewResponse, captured: dict[str, object]):
        captured["symbol"] = overview.symbol
        captured["close"] = overview.quote.close
        return build_analysis_result(overview)


if __name__ == "__main__":
    unittest.main()
