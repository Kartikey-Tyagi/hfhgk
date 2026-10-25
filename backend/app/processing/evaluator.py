"""End-to-end evaluation engine aligning forecasts and actuals across date ranges."""

from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional
from app.processing.actuals import aggregate_half_hourly_to_hourly
from app.processing.forecasts import select_latest_eligible_forecasts
from app.processing.metrics import calculate_metrics_from_intervals
from app.processing.timestamps import (
    format_london_display,
    parse_date_string,
    to_utc_datetime,
)
from app.schemas import (
    AlignedEvaluationInterval,
    DailyEvaluationSummary,
    EvaluationResponse,
    FuelHalfHourRaw,
    HourlyActual,
    SelectedForecast,
    WindForecastRaw,
)


def align_daily_evaluation(
    actuals: List[HourlyActual],
    forecasts: List[SelectedForecast],
    delivery_date_str: str,
    cutoff_time_str: str,
) -> DailyEvaluationSummary:
    """Align 24 hourly actuals with 24 selected forecasts for a single delivery date."""
    intervals: List[AlignedEvaluationInterval] = []

    # Map actuals and forecasts by hour 0..23
    actual_map: Dict[int, HourlyActual] = {a.hour: a for a in actuals}
    forecast_map: Dict[int, SelectedForecast] = {int(f.startTime.hour): f for f in forecasts}

    for hour in range(24):
        act = actual_map.get(hour)
        fc = forecast_map.get(hour)

        act_gen = act.generation if (act is not None and act.isValid) else None
        fc_gen = fc.generation if (fc is not None and fc.isValid) else None

        # Interval start time
        if act is not None:
            start_dt = act.startTime
            start_ldn = act.startTimeLondon
        elif fc is not None:
            start_dt = fc.startTime
            start_ldn = fc.startTimeLondon
        else:
            raise ValueError(f"Neither actual nor forecast provided for hour {hour}")

        # An interval is covered only when both forecast and actual are valid numeric values
        is_covered = (act_gen is not None) and (fc_gen is not None)
        error = (fc_gen - act_gen) if is_covered else None

        pub_dt = fc.publishTime if (fc is not None and fc.isValid) else None
        pub_ldn = fc.publishTimeLondon if (fc is not None and fc.isValid) else None

        intervals.append(
            AlignedEvaluationInterval(
                startTime=start_dt,
                startTimeLondon=start_ldn,
                settlementDate=delivery_date_str,
                hour=hour,
                forecastGeneration=fc_gen,
                actualGeneration=act_gen,
                forecastPublishTime=pub_dt,
                forecastPublishTimeLondon=pub_ldn,
                error=round(error, 2) if error is not None else None,
                isCovered=is_covered,
            )
        )

    # Daily expected intervals denominator is always 24
    daily_metrics = calculate_metrics_from_intervals(intervals, expected_intervals=24)

    return DailyEvaluationSummary(
        deliveryDate=delivery_date_str,
        cutoffTimeUtc=cutoff_time_str,
        metrics=daily_metrics,
        intervals=intervals,
    )


def evaluate_date_range(
    raw_actuals: Iterable[FuelHalfHourRaw],
    raw_forecasts: Iterable[WindForecastRaw],
    delivery_date_from_str: str,
    delivery_date_to_str: str,
    cutoff_time_str: str = "12:00:00",
) -> EvaluationResponse:
    """Evaluate day-ahead forecast accuracy across a delivery date range.
    
    For each delivery date D:
      1. Aggregates half-hourly actuals for D into 24 hourly actuals.
      2. Selects latest eligible forecast for D published on or before cutoff on D-1.
      3. Aligns intervals and calculates daily metrics.
    
    Overall evaluation combines all intervals across the date range.
    For complete January 2026 (2026-01-01 to 2026-01-31), expectedTotalIntervals = 744.
    """
    start_date = parse_date_string(delivery_date_from_str)
    end_date = parse_date_string(delivery_date_to_str)

    if end_date < start_date:
        raise ValueError("deliveryDateTo must be on or after deliveryDateFrom")

    total_days = (end_date - start_date).days + 1
    expected_total_intervals = total_days * 24

    daily_summaries: List[DailyEvaluationSummary] = []
    all_intervals: List[AlignedEvaluationInterval] = []

    curr_date = start_date
    while curr_date <= end_date:
        d_str = curr_date.isoformat()

        # 1. Aggregate actuals for this date
        hourly_actuals = aggregate_half_hourly_to_hourly(raw_actuals, d_str)

        # 2. Select forecasts for this date
        selected_forecasts = select_latest_eligible_forecasts(
            raw_forecasts, d_str, cutoff_time_str=cutoff_time_str
        )

        # 3. Align daily
        daily_summary = align_daily_evaluation(
            hourly_actuals, selected_forecasts, d_str, cutoff_time_str
        )
        daily_summaries.append(daily_summary)
        all_intervals.extend(daily_summary.intervals)

        curr_date += timedelta(days=1)

    overall_metrics = calculate_metrics_from_intervals(
        all_intervals, expected_intervals=expected_total_intervals
    )

    return EvaluationResponse(
        deliveryDateFrom=delivery_date_from_str,
        deliveryDateTo=delivery_date_to_str,
        cutoffTimeUtc=cutoff_time_str,
        expectedTotalIntervals=expected_total_intervals,
        overallMetrics=overall_metrics,
        dailySummaries=daily_summaries,
    )
