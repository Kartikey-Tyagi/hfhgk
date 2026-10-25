"""Tests for forecast selection and decision cutoff constraints (WINDFOR)."""

from datetime import datetime, timezone
import pytest

from app.processing.forecasts import (
    deduplicate_windfor_records,
    select_latest_eligible_forecasts,
)
from app.schemas import WindForecastRaw

UTC = timezone.utc


def test_select_latest_forecast_before_cutoff():
    """Select the latest vintage published at or before cutoff among multiple eligible runs."""
    target_start = datetime(2026, 1, 2, 12, 0, tzinfo=UTC)
    # Cutoff for 2026-01-02 delivery is 2026-01-01 at 12:00:00 UTC
    records = [
        # Vintage 1: 02:30 UTC
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 2, 30, tzinfo=UTC),
            startTime=target_start,
            generation=17000.0,
        ),
        # Vintage 2: 07:30 UTC
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 7, 30, tzinfo=UTC),
            startTime=target_start,
            generation=17500.0,
        ),
        # Vintage 3: 11:30 UTC (Latest before 12:00 cutoff)
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 11, 30, tzinfo=UTC),
            startTime=target_start,
            generation=17893.0,
        ),
    ]

    selected = select_latest_eligible_forecasts(records, "2026-01-02", "12:00:00")
    h12 = selected[12]
    assert h12.generation == 17893.0
    assert h12.publishTime == datetime(2026, 1, 1, 11, 30, tzinfo=UTC)
    assert h12.isValid is True


def test_forecast_published_after_cutoff_is_strictly_excluded():
    """Forecast published even 1 second after cutoff must never be selected."""
    target_start = datetime(2026, 1, 2, 12, 0, tzinfo=UTC)
    cutoff = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)

    records = [
        # Eligible: published before cutoff
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 11, 30, tzinfo=UTC),
            startTime=target_start,
            generation=17000.0,
        ),
        # Ineligible: published 1 second after cutoff
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 12, 0, 1, tzinfo=UTC),
            startTime=target_start,
            generation=25000.0,
        ),
        # Ineligible: published afternoon after cutoff
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 15, 30, tzinfo=UTC),
            startTime=target_start,
            generation=28000.0,
        ),
    ]

    selected = select_latest_eligible_forecasts(records, "2026-01-02", "12:00:00")
    h12 = selected[12]
    # Must select the 11:30 forecast, NOT the post-cutoff forecasts
    assert h12.generation == 17000.0
    assert h12.publishTime == datetime(2026, 1, 1, 11, 30, tzinfo=UTC)


def test_forecast_published_exactly_at_cutoff_is_eligible():
    """Forecast published exactly at cutoff boundary (publishTime == cutoff) is eligible."""
    target_start = datetime(2026, 1, 2, 14, 0, tzinfo=UTC)
    exact_cutoff = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)

    records = [
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 9, 30, tzinfo=UTC),
            startTime=target_start,
            generation=15000.0,
        ),
        WindForecastRaw(
            publishTime=exact_cutoff,
            startTime=target_start,
            generation=16000.0,
        ),
    ]

    selected = select_latest_eligible_forecasts(records, "2026-01-02", "12:00:00")
    h14 = selected[14]
    assert h14.generation == 16000.0
    assert h14.publishTime == exact_cutoff
    assert h14.isValid is True


def test_missing_forecast_when_only_post_cutoff_available():
    """If the only forecasts were published after the cutoff, the hour has no valid forecast."""
    target_start = datetime(2026, 1, 2, 12, 0, tzinfo=UTC)

    records = [
        WindForecastRaw(
            publishTime=datetime(2026, 1, 1, 15, 30, tzinfo=UTC),
            startTime=target_start,
            generation=19000.0,
        ),
    ]

    selected = select_latest_eligible_forecasts(records, "2026-01-02", "12:00:00")
    h12 = selected[12]
    assert h12.generation is None
    assert h12.isValid is False


def test_deduplicate_windfor_records():
    """Exact duplicates with same (publishTime, startTime) are deduplicated."""
    dt = datetime(2026, 1, 1, 11, 30, tzinfo=UTC)
    st = datetime(2026, 1, 2, 12, 0, tzinfo=UTC)

    records = [
        WindForecastRaw(publishTime=dt, startTime=st, generation=17000.0),
        WindForecastRaw(publishTime=dt, startTime=st, generation=17000.0),
    ]

    deduped, dup_count = deduplicate_windfor_records(records)
    assert dup_count == 1
    assert len(deduped) == 1
    assert deduped[0].generation == 17000.0


def test_january_1_cutoff_in_december():
    """For 1 January 2026 delivery, cutoff is 31 December 2025 at 12:00 UTC."""
    target_start = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)

    records = [
        # Published on Dec 31 at 11:30 UTC -> Eligible
        WindForecastRaw(
            publishTime=datetime(2025, 12, 31, 11, 30, tzinfo=UTC),
            startTime=target_start,
            generation=14500.0,
        ),
        # Published on Dec 31 at 15:30 UTC -> Ineligible (after 12:00 cutoff)
        WindForecastRaw(
            publishTime=datetime(2025, 12, 31, 15, 30, tzinfo=UTC),
            startTime=target_start,
            generation=18000.0,
        ),
    ]

    selected = select_latest_eligible_forecasts(records, "2026-01-01", "12:00:00")
    h10 = selected[10]
    assert h10.generation == 14500.0
    assert h10.publishTime == datetime(2025, 12, 31, 11, 30, tzinfo=UTC)
    assert h10.isValid is True
