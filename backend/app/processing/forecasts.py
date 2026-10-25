"""Processing logic for wind generation forecasts (WINDFOR).

Critical Data Rules:
1. Never select a forecast published after the applicable decision cutoff (publishTime <= cutoff).
2. For each delivery interval (startTime), select the latest eligible forecast (max publishTime).
3. Preserve missing values; never silently replace missing forecasts with zero.
4. Detect duplicate records and handle them deterministically.
"""

from collections import defaultdict
from datetime import datetime
import logging
from typing import Dict, Iterable, List, Optional, Tuple

from app.processing.timestamps import (
    format_london_display,
    get_cutoff_datetime,
    get_hourly_delivery_intervals,
    parse_date_string,
    to_utc_datetime,
)
from app.schemas import SelectedForecast, WindForecastRaw

logger = logging.getLogger(__name__)


def deduplicate_windfor_records(
    records: Iterable[WindForecastRaw],
) -> Tuple[List[WindForecastRaw], int]:
    """Deduplicate exact duplicates on (publishTime, startTime).
    
    If exact duplicate keys occur, retain one and record the duplicate count.
    """
    seen: Dict[Tuple[datetime, datetime], WindForecastRaw] = {}
    duplicate_count = 0

    for r in records:
        pub_utc = to_utc_datetime(r.publishTime)
        start_utc = to_utc_datetime(r.startTime)
        key = (pub_utc, start_utc)

        if key in seen:
            duplicate_count += 1
        else:
            seen[key] = r

    if duplicate_count > 0:
        logger.warning("Detected and deduplicated %d duplicate WINDFOR records.", duplicate_count)

    return list(seen.values()), duplicate_count


def select_latest_eligible_forecasts(
    records: Iterable[WindForecastRaw],
    delivery_date_str: str,
    cutoff_time_str: str = "12:00:00",
) -> List[SelectedForecast]:
    """Select the latest eligible WINDFOR forecast for each delivery hour of delivery_date.
    
    Eligibility rule:
      r.startTime belongs to delivery_date (00:00 to 23:00 UTC)
      r.publishTime <= cutoff_datetime (where cutoff is 12:00:00 UTC on delivery_date - 1 day)
    
    Selection rule:
      For each delivery hour, select r with max(r.publishTime).
    
    If no forecast was published at or before the cutoff, generation is None and isValid is False.
    """
    delivery_date = parse_date_string(delivery_date_str)
    cutoff_dt = get_cutoff_datetime(delivery_date, cutoff_time_str)
    hourly_intervals = get_hourly_delivery_intervals(delivery_date)

    deduped_records, _ = deduplicate_windfor_records(records)

    # Group eligible forecasts by startTime (normalized to UTC)
    eligible_by_start: Dict[datetime, List[WindForecastRaw]] = defaultdict(list)

    for r in deduped_records:
        start_utc = to_utc_datetime(r.startTime)
        pub_utc = to_utc_datetime(r.publishTime)

        # Check if record is for this delivery date
        if start_utc.date() == delivery_date:
            # Check decision cutoff constraint: publishTime <= cutoff
            if pub_utc <= cutoff_dt:
                eligible_by_start[start_utc].append(r)

    selected_forecasts: List[SelectedForecast] = []

    for start_dt in hourly_intervals:
        candidates = eligible_by_start.get(start_dt, [])

        if candidates:
            # Pick candidate with latest publishTime
            best_candidate = max(candidates, key=lambda c: to_utc_datetime(c.publishTime))
            best_pub_utc = to_utc_datetime(best_candidate.publishTime)
            gen = best_candidate.generation
            is_valid = gen is not None

            selected_forecasts.append(
                SelectedForecast(
                    startTime=start_dt,
                    startTimeLondon=format_london_display(start_dt),
                    publishTime=best_pub_utc,
                    publishTimeLondon=format_london_display(best_pub_utc),
                    generation=gen,
                    cutoffTimeUtc=cutoff_dt,
                    isValid=is_valid,
                )
            )
        else:
            # Missing forecast: no forecast was published on or before cutoff
            selected_forecasts.append(
                SelectedForecast(
                    startTime=start_dt,
                    startTimeLondon=format_london_display(start_dt),
                    publishTime=cutoff_dt,  # reference cutoff
                    publishTimeLondon=format_london_display(cutoff_dt),
                    generation=None,
                    cutoffTimeUtc=cutoff_dt,
                    isValid=False,
                )
            )

    return selected_forecasts
