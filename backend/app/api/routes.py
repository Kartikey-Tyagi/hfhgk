"""FastAPI route handlers for Wind Forecast Intelligence."""

from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.client import ElexonAPIError, ElexonClient, ElexonTimeoutError
from app.config import settings
from app.processing.actuals import aggregate_half_hourly_to_hourly
from app.processing.evaluator import evaluate_date_range
from app.processing.forecasts import select_latest_eligible_forecasts
from app.processing.timestamps import parse_date_string, parse_time_string
from app.schemas import (
    DailyEvaluationSummary,
    EvaluationResponse,
    HourlyActual,
    SelectedForecast,
)

router = APIRouter(prefix="/api", tags=["evaluation"])


def get_elexon_client() -> ElexonClient:
    """Dependency provider for ElexonClient."""
    return ElexonClient()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Wind Forecast Intelligence API",
        "defaultCutoffTimeUtc": settings.default_cutoff_time,
        "internalTimezone": settings.internal_timezone,
        "userFacingTimezone": settings.user_facing_timezone,
    }


@router.get("/evaluation", response_model=EvaluationResponse)
async def get_evaluation(
    deliveryDateFrom: str = Query(
        "2026-01-01",
        description="Start delivery date in YYYY-MM-DD format",
        examples=["2026-01-01"],
    ),
    deliveryDateTo: str = Query(
        "2026-01-31",
        description="End delivery date in YYYY-MM-DD format",
        examples=["2026-01-31"],
    ),
    cutoffTimeUtc: str = Query(
        settings.default_cutoff_time,
        description="Day-ahead purchasing decision cutoff time on D-1 in UTC (HH:MM:SS)",
        examples=["12:00:00"],
    ),
    client: ElexonClient = Depends(get_elexon_client),
):
    """Evaluate day-ahead wind generation forecasts against actuals across a delivery date range.
    
    1. Fetches actual generation from Elexon FUELHH for fuelType=WIND.
    2. Fetches historical forecast vintages from Elexon WINDFOR starting 48 hours prior to delivery.
    3. Selects the latest forecast published at or before each delivery day's cutoff.
    4. Aggregates half-hourly actuals to hourly resolution.
    5. Calculates MAE, RMSE, ME, and data coverage.
    """
    try:
        start_d = parse_date_string(deliveryDateFrom)
        end_d = parse_date_string(deliveryDateTo)
        parse_time_string(cutoffTimeUtc)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date or time parameter: {exc}",
        )

    if end_d < start_d:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="deliveryDateTo must be on or after deliveryDateFrom",
        )

    # To capture day-ahead forecasts published on D-1 (or D-2), query WINDFOR starting 48h prior
    fetch_wf_start = (start_d - timedelta(days=2)).isoformat() + "T00:00:00Z"
    fetch_wf_end = end_d.isoformat() + "T23:59:59Z"

    try:
        raw_actuals = await client.fetch_fuelhh_actuals(deliveryDateFrom, deliveryDateTo)
        raw_forecasts = await client.fetch_windfor_forecasts(fetch_wf_start, fetch_wf_end)
    except ElexonTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Elexon API timed out: {exc}",
        )
    except ElexonAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Elexon API returned error {exc.status_code}: {exc.message}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to retrieve data from Elexon API: {exc}",
        )

    response = evaluate_date_range(
        raw_actuals=raw_actuals,
        raw_forecasts=raw_forecasts,
        delivery_date_from_str=deliveryDateFrom,
        delivery_date_to_str=deliveryDateTo,
        cutoff_time_str=cutoffTimeUtc,
    )
    return response


@router.get("/actuals/{deliveryDate}", response_model=list[HourlyActual])
async def get_hourly_actuals(
    deliveryDate: str,
    client: ElexonClient = Depends(get_elexon_client),
):
    """Retrieve 24 hourly aggregated wind actuals for a single delivery date."""
    try:
        parse_date_string(deliveryDate)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    try:
        raw = await client.fetch_fuelhh_actuals(deliveryDate, deliveryDate)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return aggregate_half_hourly_to_hourly(raw, deliveryDate)


@router.get("/forecasts/{deliveryDate}", response_model=list[SelectedForecast])
async def get_selected_forecasts(
    deliveryDate: str,
    cutoffTimeUtc: str = Query(settings.default_cutoff_time),
    client: ElexonClient = Depends(get_elexon_client),
):
    """Retrieve 24 latest eligible forecasts for a delivery date at the specified cutoff."""
    try:
        d = parse_date_string(deliveryDate)
        parse_time_string(cutoffTimeUtc)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    fetch_start = (d - timedelta(days=2)).isoformat() + "T00:00:00Z"
    fetch_end = d.isoformat() + "T23:59:59Z"

    try:
        raw = await client.fetch_windfor_forecasts(fetch_start, fetch_end)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return select_latest_eligible_forecasts(raw, deliveryDate, cutoff_time_str=cutoffTimeUtc)
