from fastapi import APIRouter, HTTPException, Path

from app.schemas.stock import StockOverviewResponse
from app.services.market_data import (
    MarketDataError,
    MarketDataUnavailableError,
    StockNotFoundError,
    get_stock_overview as get_stock_overview_data,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get(
    "/{symbol}/overview",
    response_model=StockOverviewResponse,
    responses={
        404: {"description": "Stock symbol not found"},
        502: {"description": "Upstream market data provider unavailable"},
    },
)
def get_stock_overview(
    symbol: str = Path(..., pattern=r"^\d{6}$", description="A-share 6-digit stock code"),
) -> StockOverviewResponse:
    try:
        return get_stock_overview_data(symbol)
    except StockNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MarketDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketDataError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
