"""Tests for accuracy metrics calculation and coverage (MAE, RMSE, ME)."""

import math
import pytest

from app.processing.metrics import calculate_metrics_from_pairs
from app.schemas import AlignedEvaluationInterval
from datetime import datetime, timezone

UTC = timezone.utc


def test_metrics_calculation_standard_values():
    """Verify MAE, RMSE, ME with standard known values.
    
    Pair 1: Forecast = 120, Actual = 100 -> error = +20
    Pair 2: Forecast = 80,  Actual = 100 -> error = -20
    MAE = (20 + 20) / 2 = 20.0
    MSE = (400 + 400) / 2 = 400.0 -> RMSE = 20.0
    ME  = (+20 - 20) / 2 = 0.0
    """
    pairs = [(120.0, 100.0), (80.0, 100.0)]
    metrics = calculate_metrics_from_pairs(pairs, expected_intervals=2)

    assert metrics.validPairs == 2
    assert metrics.expectedIntervals == 2
    assert metrics.coveragePercentage == 100.0
    assert metrics.mae == 20.0
    assert metrics.rmse == 20.0
    assert metrics.me == 0.0


def test_error_sign_convention_over_forecasting():
    """Positive Mean Error (ME > 0) indicates net over-forecasting."""
    pairs = [
        (1500.0, 1000.0),  # err = +500
        (2000.0, 1800.0),  # err = +200
    ]
    metrics = calculate_metrics_from_pairs(pairs, expected_intervals=2)
    assert metrics.me == 350.0  # (500 + 200) / 2
    assert metrics.me > 0


def test_error_sign_convention_under_forecasting():
    """Negative Mean Error (ME < 0) indicates net under-forecasting."""
    pairs = [
        (800.0, 1000.0),  # err = -200
        (1500.0, 1900.0),  # err = -400
    ]
    metrics = calculate_metrics_from_pairs(pairs, expected_intervals=2)
    assert metrics.me == -300.0  # (-200 - 400) / 2
    assert metrics.me < 0


def test_zero_generation_is_valid_in_metrics():
    """Zero generation (0.0 MW) must be evaluated as a valid numeric observation."""
    pairs = [
        (0.0, 0.0),     # err = 0
        (100.0, 0.0),   # err = +100
    ]
    metrics = calculate_metrics_from_pairs(pairs, expected_intervals=2)
    assert metrics.validPairs == 2
    assert metrics.mae == 50.0
    assert metrics.rmse == round(math.sqrt(5000), 2)  # sqrt((0 + 10000) / 2) = 70.71
    assert metrics.me == 50.0


def test_empty_pairs_returns_none_for_metrics():
    """When no valid pairs exist, metrics must return None (not 0.0) with 0.0% coverage."""
    metrics = calculate_metrics_from_pairs([], expected_intervals=24)
    assert metrics.validPairs == 0
    assert metrics.expectedIntervals == 24
    assert metrics.coveragePercentage == 0.0
    assert metrics.mae is None
    assert metrics.rmse is None
    assert metrics.me is None


def test_partial_coverage_calculation():
    """Coverage percentage reflects valid pairs divided by expected intervals."""
    pairs = [(100.0, 100.0)] * 12  # 12 pairs
    metrics = calculate_metrics_from_pairs(pairs, expected_intervals=24)
    assert metrics.validPairs == 12
    assert metrics.expectedIntervals == 24
    assert metrics.coveragePercentage == 50.0


def test_invalid_expected_intervals_raises():
    """Expected intervals must be positive."""
    with pytest.raises(ValueError):
        calculate_metrics_from_pairs([], expected_intervals=0)
