"""Tests for timezone-aware timestamp utilities."""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
import pytest

from app.processing.timestamps import (
    format_london_display,
    format_utc_iso,
    get_cutoff_datetime,
    get_hourly_delivery_intervals,
    parse_date_string,
    parse_time_string,
    to_london_datetime,
    to_utc_datetime,
)

LONDON_TZ = ZoneInfo("Europe/London")
UTC_TZ = timezone.utc


def test_to_utc_datetime_from_iso_string():
    dt = to_utc_datetime("2026-01-01T12:00:00Z")
    assert dt.tzinfo == UTC_TZ
    assert dt.year == 2026
    assert dt.month == 1
    assert dt.day == 1
    assert dt.hour == 12
    assert dt.minute == 0


def test_to_utc_datetime_naive_assumed_utc():
    naive = datetime(2026, 1, 1, 12, 0, 0)
    aware = to_utc_datetime(naive)
    assert aware.tzinfo == UTC_TZ
    assert aware.hour == 12


def test_to_london_datetime_winter_gmt():
    # In January, London is GMT (UTC+0)
    utc_dt = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC_TZ)
    ldn_dt = to_london_datetime(utc_dt)
    assert ldn_dt.tzinfo == LONDON_TZ
    assert ldn_dt.hour == 12
    assert "GMT" in format_london_display(utc_dt)


def test_to_london_datetime_summer_bst():
    # In July, London is BST (UTC+1)
    utc_dt = datetime(2026, 7, 15, 12, 0, 0, tzinfo=UTC_TZ)
    ldn_dt = to_london_datetime(utc_dt)
    assert ldn_dt.tzinfo == LONDON_TZ
    assert ldn_dt.hour == 13  # 12:00 UTC = 13:00 BST
    assert "BST" in format_london_display(utc_dt)


def test_get_cutoff_datetime_day_ahead():
    # For delivery on 2026-01-02, cutoff should be 2026-01-01 at 12:00:00 UTC
    deliv_date = date(2026, 1, 2)
    cutoff = get_cutoff_datetime(deliv_date, "12:00:00")
    assert cutoff == datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC_TZ)


def test_get_cutoff_datetime_first_of_month():
    # For delivery on 2026-01-01, cutoff must fall on 2025-12-31 at 12:00:00 UTC
    deliv_date = date(2026, 1, 1)
    cutoff = get_cutoff_datetime(deliv_date, "12:00:00")
    assert cutoff == datetime(2025, 12, 31, 12, 0, 0, tzinfo=UTC_TZ)


def test_get_cutoff_datetime_custom_time():
    deliv_date = date(2026, 1, 10)
    cutoff = get_cutoff_datetime(deliv_date, "17:30:00")
    assert cutoff == datetime(2026, 1, 9, 17, 30, 0, tzinfo=UTC_TZ)


def test_get_hourly_delivery_intervals():
    deliv_date = date(2026, 1, 1)
    intervals = get_hourly_delivery_intervals(deliv_date)
    assert len(intervals) == 24
    assert intervals[0] == datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC_TZ)
    assert intervals[23] == datetime(2026, 1, 1, 23, 0, 0, tzinfo=UTC_TZ)
