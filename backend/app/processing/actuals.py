"""Processing logic for actual wind generation (FUELHH).

Rules:
1. FUELHH actuals must be filtered to fuelType = WIND.
2. Aggregate two consecutive 30-minute settlement periods (SP 2h+1 and SP 2h+2) into one hourly average.
3. Preserve missing values: if either constituent half-hour is missing or null, do not substitute zero;
   mark the hourly generation as None.
4. Detect duplicate (settlementDate, settlementPeriod) records and handle them deterministically.
"""

from collections import defaultdict
import logging
from typing import Dict, Iterable, List, Optional, Tuple

from app.processing.timestamps import (
    format_london_display,
    get_hourly_delivery_intervals,
    to_utc_datetime,
)
from app.schemas import FuelHalfHourRaw, HourlyActual

logger = logging.getLogger(__name__)


def deduplicate_fuelhh_records(
    records: Iterable[FuelHalfHourRaw],
) -> Tuple[List[FuelHalfHourRaw], int]:
    """Deduplicate FUELHH records by (settlementDate, settlementPeriod).
    
    If duplicates exist for the same settlement period, the one with the latest publishTime
    is retained. Returns deduplicated records and the count of duplicates resolved.
    """
    latest_by_key: Dict[Tuple[str, int], FuelHalfHourRaw] = {}
    duplicate_count = 0

    for r in records:
        # Ignore non-wind fuels defensively
        if r.fuelType.upper() != "WIND":
            continue

        key = (r.settlementDate, r.settlementPeriod)
        if key in latest_by_key:
            duplicate_count += 1
            existing = latest_by_key[key]
            # Retain the one with latest publishTime
            if to_utc_datetime(r.publishTime) > to_utc_datetime(existing.publishTime):
                latest_by_key[key] = r
        else:
            latest_by_key[key] = r

    if duplicate_count > 0:
        logger.warning("Detected and deduplicated %d duplicate FUELHH records.", duplicate_count)

    return list(latest_by_key.values()), duplicate_count


def aggregate_half_hourly_to_hourly(
    records: Iterable[FuelHalfHourRaw],
    delivery_date_str: str,
) -> List[HourlyActual]:
    """Aggregate half-hourly settlement periods for a delivery date into 24 hourly actuals.
    
    Delivery date format: 'YYYY-MM-DD'.
    Hour h (0..23) corresponds to:
      - sp1 = 2 * h + 1 (e.g. Hour 0 -> SP 1, 00:00 to 00:30)
      - sp2 = 2 * h + 2 (e.g. Hour 0 -> SP 2, 00:30 to 01:00)
    
    Critical Rule: Both half-hours must be present and valid numbers.
    If either is missing, generation is None (not zero), and isValid is False.
    """
    from app.processing.timestamps import parse_date_string

    d_date = parse_date_string(delivery_date_str)
    hourly_intervals = get_hourly_delivery_intervals(d_date)

    # First, deduplicate records
    deduped_records, _ = deduplicate_fuelhh_records(records)

    # Index records by settlementPeriod for this date
    sp_map: Dict[int, FuelHalfHourRaw] = {}
    for r in deduped_records:
        if r.settlementDate == delivery_date_str and r.fuelType.upper() == "WIND":
            sp_map[r.settlementPeriod] = r

    hourly_actuals: List[HourlyActual] = []

    for hour_idx, start_dt in enumerate(hourly_intervals):
        sp1_period = 2 * hour_idx + 1
        sp2_period = 2 * hour_idx + 2

        r1 = sp_map.get(sp1_period)
        r2 = sp_map.get(sp2_period)

        gen1 = r1.generation if r1 is not None else None
        gen2 = r2.generation if r2 is not None else None

        # Check if both half-hours have valid numeric generation values
        if gen1 is not None and gen2 is not None:
            hourly_avg = (gen1 + gen2) / 2.0
            is_valid = True
        else:
            hourly_avg = None
            is_valid = False

        hourly_actuals.append(
            HourlyActual(
                startTime=start_dt,
                startTimeLondon=format_london_display(start_dt),
                settlementDate=delivery_date_str,
                hour=hour_idx,
                generation=hourly_avg,
                sp1Period=sp1_period,
                sp1Generation=gen1,
                sp2Period=sp2_period,
                sp2Generation=gen2,
                isValid=is_valid,
            )
        )

    return hourly_actuals
