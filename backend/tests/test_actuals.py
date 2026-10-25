"""Tests for actuals processing and half-hourly aggregation (FUELHH)."""

from datetime import datetime, timezone
import pytest

from app.processing.actuals import (
    aggregate_half_hourly_to_hourly,
    deduplicate_fuelhh_records,
)
from app.schemas import FuelHalfHourRaw

UTC = timezone.utc


def test_complete_hourly_aggregation():
    """Verify two complete half-hourly readings are averaged correctly into one hour."""
    records = [
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=1000.0,
        ),
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 1, 0, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=2,
            fuelType="WIND",
            generation=1500.0,
        ),
    ]

    hourly = aggregate_half_hourly_to_hourly(records, "2026-01-01")
    assert len(hourly) == 24
    hour_0 = hourly[0]
    assert hour_0.hour == 0
    assert hour_0.sp1Period == 1
    assert hour_0.sp2Period == 2
    assert hour_0.sp1Generation == 1000.0
    assert hour_0.sp2Generation == 1500.0
    assert hour_0.generation == 1250.0
    assert hour_0.isValid is True

    # Remaining hours without data should be invalid with None generation
    assert hourly[1].generation is None
    assert hourly[1].isValid is False


def test_missing_constituent_half_hour_preserved_as_none():
    """If one half-hour observation is missing, the hour must be None, not zero."""
    records = [
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=1000.0,
        )
        # SP 2 is missing!
    ]

    hourly = aggregate_half_hourly_to_hourly(records, "2026-01-01")
    hour_0 = hourly[0]
    assert hour_0.sp1Generation == 1000.0
    assert hour_0.sp2Generation is None
    assert hour_0.generation is None
    assert hour_0.isValid is False


def test_null_generation_in_half_hour_preserved_as_none():
    """If a half-hour record has null generation, hourly generation must be None."""
    records = [
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=None,
        ),
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 1, 0, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=2,
            fuelType="WIND",
            generation=1500.0,
        ),
    ]

    hourly = aggregate_half_hourly_to_hourly(records, "2026-01-01")
    hour_0 = hourly[0]
    assert hour_0.generation is None
    assert hour_0.isValid is False


def test_zero_generation_is_valid():
    """Zero generation (0.0 MW) is a valid measurement, not missing."""
    records = [
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=0.0,
        ),
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 1, 0, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=2,
            fuelType="WIND",
            generation=0.0,
        ),
    ]

    hourly = aggregate_half_hourly_to_hourly(records, "2026-01-01")
    hour_0 = hourly[0]
    assert hour_0.generation == 0.0
    assert hour_0.isValid is True


def test_deduplicate_fuelhh_keeps_latest_publication():
    """Duplicate records for the same settlement period resolve to the latest publishTime."""
    records = [
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=1000.0,
        ),
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 1, 30, tzinfo=UTC),  # Newer revision
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=1050.0,
        ),
    ]

    deduped, dup_count = deduplicate_fuelhh_records(records)
    assert dup_count == 1
    assert len(deduped) == 1
    assert deduped[0].generation == 1050.0


def test_filters_out_non_wind_fuels():
    """Records for other fuel types must be ignored."""
    records = [
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="NUCLEAR",
            generation=5000.0,
        ),
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=1200.0,
        ),
        FuelHalfHourRaw(
            publishTime=datetime(2026, 1, 1, 1, 0, tzinfo=UTC),
            startTime=datetime(2026, 1, 1, 0, 30, tzinfo=UTC),
            settlementDate="2026-01-01",
            settlementPeriod=2,
            fuelType="WIND",
            generation=1400.0,
        ),
    ]

    hourly = aggregate_half_hourly_to_hourly(records, "2026-01-01")
    assert hourly[0].generation == 1300.0
    assert hourly[0].isValid is True


def test_empty_fuelhh_inputs():
    """Empty inputs produce 24 invalid hourly intervals with None generation."""
    hourly = aggregate_half_hourly_to_hourly([], "2026-01-01")
    assert len(hourly) == 24
    for h in hourly:
        assert h.generation is None
        assert h.isValid is False
