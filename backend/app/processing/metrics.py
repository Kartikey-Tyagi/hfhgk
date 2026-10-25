"""Quantitative forecast accuracy metrics and data coverage calculation.

Critical Rules (GEMINI.md & Project Guidelines):
1. Error definition: error = forecast - actual.
   - ME > 0 means over-forecasting.
   - ME < 0 means under-forecasting.
2. Only valid forecast-actual pairs may contribute to accuracy metrics (MAE, RMSE, ME).
3. Handle missing observations, zero generation, and empty datasets explicitly.
4. Zero generation (0.0 MW) is a valid generation value, distinct from missing/null.
5. If no valid pairs exist, MAE, RMSE, and ME must return None, not 0.0.
"""

import math
from typing import Iterable, List, Optional, Sequence, Tuple
from app.schemas import AlignedEvaluationInterval, EvaluationMetrics


def calculate_metrics_from_pairs(
    pairs: Sequence[Tuple[float, float]],
    expected_intervals: int,
) -> EvaluationMetrics:
    """Calculate MAE, RMSE, ME, and coverage from a sequence of (forecast, actual) numeric pairs.
    
    Args:
        pairs: Sequence of (forecast_mw, actual_mw) tuples. Only complete, non-null numeric pairs.
        expected_intervals: The expected total number of evaluation intervals (denominator).
    """
    if expected_intervals <= 0:
        raise ValueError(f"expected_intervals must be positive, got {expected_intervals}")

    n_valid = len(pairs)
    coverage_pct = round((n_valid / expected_intervals) * 100.0, 2)

    if n_valid == 0:
        return EvaluationMetrics(
            expectedIntervals=expected_intervals,
            validPairs=0,
            coveragePercentage=coverage_pct,
            mae=None,
            rmse=None,
            me=None,
        )

    # Error definition: forecast - actual
    errors: List[float] = [fc - act for fc, act in pairs]

    mae = sum(abs(e) for e in errors) / n_valid
    mse = sum(e ** 2 for e in errors) / n_valid
    rmse = math.sqrt(mse)
    me = sum(errors) / n_valid

    return EvaluationMetrics(
        expectedIntervals=expected_intervals,
        validPairs=n_valid,
        coveragePercentage=coverage_pct,
        mae=round(mae, 2),
        rmse=round(rmse, 2),
        me=round(me, 2),
    )


def calculate_metrics_from_intervals(
    intervals: Iterable[AlignedEvaluationInterval],
    expected_intervals: int,
) -> EvaluationMetrics:
    """Calculate accuracy metrics from aligned evaluation intervals.
    
    Filters to valid pairs where isCovered is True and both forecast and actual are not None.
    """
    valid_pairs: List[Tuple[float, float]] = []

    for itv in intervals:
        if itv.isCovered and itv.forecastGeneration is not None and itv.actualGeneration is not None:
            valid_pairs.append((itv.forecastGeneration, itv.actualGeneration))

    return calculate_metrics_from_pairs(valid_pairs, expected_intervals)
