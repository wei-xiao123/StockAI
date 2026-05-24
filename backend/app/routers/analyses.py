from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.core.auth import SessionContext, require_session
from app.schemas.analysis import (
    AnalysisDetailResponse,
    AnalysisListResponse,
    AnalysisRequest,
    AnalysisResponse,
    RiskLevel,
    Sentiment,
)
from app.services.analysis import (
    AnalysisResponseFormatError,
    AnalysisServiceError,
    AnalysisServiceUnavailableError,
    run_stock_analysis,
)
from app.services.market_data import (
    MarketDataError,
    MarketDataUnavailableError,
    StockNotFoundError,
    get_stock_overview,
)
from app.services.storage import (
    AnalysisRecordNotFoundError,
    StorageError,
    StorageUnavailableError,
    get_analysis_record_detail,
    list_analysis_records,
    save_analysis_record,
)

router = APIRouter(prefix="/analyses", tags=["analyses"])


@router.post(
    "",
    response_model=AnalysisResponse,
    responses={
        502: {"description": "Upstream service returned invalid response"},
        503: {"description": "AI analysis service is not configured"},
    },
)
def create_analysis(
    payload: AnalysisRequest,
    session: SessionContext = Depends(require_session),
) -> AnalysisResponse:
    try:
        overview = get_stock_overview(payload.symbol)
    except StockNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MarketDataUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except MarketDataError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        analysis_result = run_stock_analysis(overview)
    except AnalysisServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AnalysisResponseFormatError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except AnalysisServiceError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    record_id = None
    save_status = "failed"
    try:
        record_id = save_analysis_record(
            user_id=session.user_id,
            overview=overview,
            chart_summary=analysis_result.chart_summary,
            analysis=analysis_result.analysis,
            model_name=analysis_result.model_name,
            prompt_version=analysis_result.prompt_version,
        )
        save_status = "saved"
    except StorageError:
        save_status = "failed"

    return AnalysisResponse(
        record_id=record_id,
        save_status=save_status,
        stock={
            "symbol": overview.symbol,
            "stock_name": overview.stock_name,
            "market": overview.market,
        },
        quote=overview.quote,
        chart_summary=analysis_result.chart_summary,
        analysis=analysis_result.analysis,
    )


@router.get(
    "",
    response_model=AnalysisListResponse,
    responses={
        503: {"description": "Storage service is not configured"},
    },
)
def list_analyses(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    symbol: str | None = Query(default=None, pattern=r"^\d{6}$"),
    sentiment: Sentiment | None = Query(default=None),
    risk_level: RiskLevel | None = Query(default=None),
    session: SessionContext = Depends(require_session),
) -> AnalysisListResponse:
    try:
        return list_analysis_records(
            limit=limit,
            offset=offset,
            symbol=symbol,
            sentiment=sentiment,
            risk_level=risk_level,
            user_id=session.user_id,
        )
    except StorageUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/{analysis_id}",
    response_model=AnalysisDetailResponse,
    responses={
        404: {"description": "Analysis record not found"},
        503: {"description": "Storage service is not configured"},
    },
)
def get_analysis_detail(
    analysis_id: UUID = Path(..., description="Analysis record ID"),
    session: SessionContext = Depends(require_session),
) -> AnalysisDetailResponse:
    try:
        return get_analysis_record_detail(analysis_id, user_id=session.user_id)
    except AnalysisRecordNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except StorageUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
