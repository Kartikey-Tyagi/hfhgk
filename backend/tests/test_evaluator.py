"""Tests for alignment and end-to-end evaluation engine."""

from datetime import datetime, timezone
import pytest

from app.processing.evaluator import align_daily_evaluation, evaluate_date_range
from app.schemas import (
    FuelHalfHourRaw,
    HourlyActual,
    SelectedForecast,
    WindForecastRaw,
)

UTC = timezone.utc


def test_align_daily_evaluation_full_coverage():
    """Verify daily alignment produces 24 intervals and 100% coverage with full data."""
    actuals = []
    forecasts = []

    for h in range(24):
        st = datetime(2026, 1, 2, h, 0, tzinfo=UTC)
        actuals.append(
            HourlyActual(
                startTime=st,
                startTimeLondon=f"2026-01-02 {h:02d}:00 GMT",
                settlementDate="2026-01-02",
                hour=h,
                generation=1000.0 + h * 10,
                sp1Period=2 * h + 1,
                sp1Generation=1000.0 + h * 10,
                sp2Period=2 * h + 2,
                sp2Generation=1000.0 + h * 10,
                isValid=True,
            )
        )
        forecasts.append(
            SelectedForecast(
                startTime=st,
                startTimeLondon=f"2026-01-02 {h:02d}:00 GMT",
                publishTime=datetime(2026, 1, 1, 11, 30, tzinfo=UTC),
                publishTimeLondon="2026-01-01 11:30 GMT",
                generation=1050.0 + h * 10,  # +50 MW over-forecast
                cutoffTimeUtc=datetime(2026, 1, 1, 12, 0, tzinfo=UTC),
                isValid=True,
            )
        )

    summary = align_daily_evaluation(actuals, forecasts, "2026-01-02", "12:00:00")
    assert len(summary.intervals) == 24
    assert summary.metrics.validPairs == 24
    assert summary.metrics.coveragePercentage == 100.0
    assert summary.metrics.mae == 50.0
    assert summary.metrics.rmse == 50.0
    assert summary.metrics.me == 50.0  # +50 MW


def test_align_daily_evaluation_missing_actual_drops_pair():
    """If one hour has missing actual, it must not form a valid pair and counts against coverage."""
    actuals = []
    forecasts = []

    for h in range(24):
        st = datetime(2026, 1, 2, h, 0, tzinfo=UTC)
        # Hour 5 has missing actual
        is_h5 = (h == 5)
        actuals.append(
            HourlyActual(
                startTime=st,
                startTimeLondon=f"2026-01-02 {h:02d}:00 GMT",
                settlementDate="2026-01-02",
                hour=h,
                generation=None if is_h5 else 1000.0,
                sp1Period=2 * h + 1,
                sp1Generation=None if is_h5 else 1000.0,
                sp2Period=2 * h + 2,
                sp2Generation=None if is_h5 else 1000.0,
                isValid=not is_h5,
            )
        )
        forecasts.append(
            SelectedForecast(
                startTime=st,
                startTimeLondon=f"2026-01-02 {h:02d}:00 GMT",
                publishTime=datetime(2026, 1, 1, 11, 30, tzinfo=UTC),
                publishTimeLondon="2026-01-01 11:30 GMT",
                generation=1000.0,
                cutoffTimeUtc=datetime(2026, 1, 1, 12, 0, tzinfo=UTC),
                isValid=True,
            )
        )

    summary = align_daily_evaluation(actuals, forecasts, "2026-01-02", "12:00:00")
    assert summary.metrics.validPairs == 23
    assert summary.metrics.expectedIntervals == 24
    assert summary.metrics.coveragePercentage == round(23 / 24 * 100.0, 2)
    # Hour 5 should be marked as uncovered
    assert summary.intervals[5].isCovered is False
    assert summary.intervals[5].error is None


def test_evaluate_date_range_multi_day():
    """Multi-day evaluation computes correct expected intervals (days * 24)."""
    raw_actuals = []
    raw_forecasts = []

    for day in [1, 2]:
        d_str = f"2026-01-0{day}"
        for sp in range(1, 49):
            raw_actuals.append(
                FuelHalfHourRaw(
                    publishTime=datetime(2026, 1, day, 12, 0, tzinfo=UTC),
                    startTime=datetime(2026, 1, day, (sp - 1) // 2, (sp - 1) % 2 * 30, tzinfo=UTC),
                    settlementDate=d_str,
                    settlementPeriod=sp,
                    fuelType="WIND",
                    generation=2000.0,
                )
            )
        for h in range(24):
            raw_forecasts.append(
                WindForecastRaw(
                    publishTime=datetime(2025, 12, 31, 11, 30, tzinfo=UTC),
                    startTime=datetime(2026, 1, day, h, 0, tzinfo=UTC),
                    generation=2100.0,
                )
            )

    eval_resp = evaluate_date_range(
        raw_actuals, raw_forecasts, "2026-01-01", "2026-01-02", "12:00:00"
    )
    assert eval_resp.expectedTotalIntervals == 48
    assert eval_resp.overallMetrics.validPairs == 48
    assert eval_resp.overallMetrics.coveragePercentage == 100.0
    assert eval_resp.overallMetrics.me == 100.0
    assert len(eval_resp.dailySummaries) == 2


def test_evaluate_date_range_invalid_dates_raises():
    """Date ranges where to < from must raise ValueError."""
    with pytest.raises(ValueError):
        evaluate_date_range([], [], "2026-01-10", "2026-01-01", "12:00:00")
