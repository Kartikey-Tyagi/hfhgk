"""Timezone-aware timestamp handling and utilities.

Internal logic uses UTC exclusively.
User-facing dates and times are converted to Europe/London.
"""

from datetime import date, datetime, time, timedelta, timezone
from typing import List, Union
from zoneinfo import ZoneInfo

LONDON_TZ = ZoneInfo("Europe/London")
UTC_TZ = timezone.utc


def to_utc_datetime(dt_or_str: Union[str, datetime]) -> datetime:
    """Convert an ISO-8601 string or datetime into a timezone-aware UTC datetime.
    
    If the datetime is naive, it is assumed to be UTC and given UTC tzinfo.
    """
    if isinstance(dt_or_str, str):
        # Handle 'Z' suffix for python < 3.11 compatibility if needed, though fromisoformat supports it in 3.11+
        clean_str = dt_or_str.strip()
        if clean_str.endswith("Z"):
            clean_str = clean_str[:-1] + "+00:00"
        dt = datetime.fromisoformat(clean_str)
    elif isinstance(dt_or_str, datetime):
        dt = dt_or_str
    else:
        raise ValueError(f"Expected str or datetime, got {type(dt_or_str)}")

    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC_TZ)
    return dt.astimezone(UTC_TZ)


def to_london_datetime(dt_or_str: Union[str, datetime]) -> datetime:
    """Convert a UTC datetime or ISO string to Europe/London timezone-aware datetime."""
    utc_dt = to_utc_datetime(dt_or_str)
    return utc_dt.astimezone(LONDON_TZ)


def format_utc_iso(dt: datetime) -> str:
    """Format timezone-aware datetime as UTC ISO-8601 string with Z suffix."""
    utc_dt = to_utc_datetime(dt)
    return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def format_london_display(dt: datetime) -> str:
    """Format datetime in Europe/London timezone for user display."""
    ldn_dt = to_london_datetime(dt)
    tz_abbr = ldn_dt.strftime("%Z")
    return ldn_dt.strftime(f"%Y-%m-%d %H:%M {tz_abbr}")


def parse_date_string(date_str: str) -> date:
    """Parse YYYY-MM-DD string into a date object."""
    return date.fromisoformat(date_str.strip())


def parse_time_string(time_str: str) -> time:
    """Parse HH:MM or HH:MM:SS string into a time object."""
    clean = time_str.strip()
    parts = clean.split(":")
    if len(parts) == 2:
        return time(int(parts[0]), int(parts[1]), 0)
    elif len(parts) == 3:
        return time(int(parts[0]), int(parts[1]), int(parts[2]))
    raise ValueError(f"Invalid time format '{time_str}', expected HH:MM or HH:MM:SS")


def get_cutoff_datetime(delivery_date: date, cutoff_time_str: str = "12:00:00") -> datetime:
    """Calculate the day-ahead purchasing decision cutoff in UTC.
    
    By assessment convention, the day-ahead decision cutoff occurs on (delivery_date - 1 day)
    at the specified UTC time (default 12:00:00 UTC).
    """
    cutoff_time = parse_time_string(cutoff_time_str)
    decision_date = delivery_date - timedelta(days=1)
    return datetime(
        year=decision_date.year,
        month=decision_date.month,
        day=decision_date.day,
        hour=cutoff_time.hour,
        minute=cutoff_time.minute,
        second=cutoff_time.second,
        tzinfo=UTC_TZ,
    )


def get_hourly_delivery_intervals(delivery_date: date) -> List[datetime]:
    """Return the 24 hourly UTC start timestamps for the specified delivery date.
    
    Timestamps are: 00:00:00Z, 01:00:00Z, ..., 23:00:00Z.
    """
    intervals = []
    for hour in range(24):
        dt = datetime(
            year=delivery_date.year,
            month=delivery_date.month,
            day=delivery_date.day,
            hour=hour,
            minute=0,
            second=0,
            tzinfo=UTC_TZ,
        )
        intervals.append(dt)
    return intervals
