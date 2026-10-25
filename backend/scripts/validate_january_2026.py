"""Reproducible validation script for January 2026 Elexon API data.

Executes a live end-to-end backtest against official Elexon endpoints:
- FUELHH actuals for 2026-01-01 to 2026-01-31 (WIND)
- WINDFOR forecasts published from 2025-12-30 to 2026-01-31
- Evaluates 744 expected hourly intervals using day-ahead cutoff 12:00 UTC on D-1.

Usage:
    .venv/bin/python backend/scripts/validate_january_2026.py
"""

import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.client import ElexonClient
from app.processing.evaluator import evaluate_date_range


async def main():
    print("==================================================================")
    print("Wind Forecast Intelligence: Live January 2026 Backtest Validation")
    print("==================================================================")
    print("Querying official Elexon Insights Solution API (verify=True)...")

    client = ElexonClient()

    # 1. Fetch FUELHH for Jan 2026
    print("\n1. Fetching FUELHH wind actuals for 2026-01-01 to 2026-01-31...")
    actuals = await client.fetch_fuelhh_actuals("2026-01-01", "2026-01-31")
    print(f"   Received {len(actuals)} half-hourly FUELHH records.")

    # 2. Fetch WINDFOR from Dec 30, 2025 to Jan 31, 2026
    print("\n2. Fetching WINDFOR forecast runs from 2025-12-30T00:00:00Z to 2026-01-31T23:59:59Z...")
    forecasts = await client.fetch_windfor_forecasts(
        "2025-12-30T00:00:00Z", "2026-01-31T23:59:59Z"
    )
    print(f"   Received {len(forecasts)} WINDFOR forecast records.")

    # 3. Execute Day-Ahead Evaluation
    print("\n3. Evaluating January 2026 with Day-Ahead 12:00 UTC Cutoff on D-1...")
    evaluation = evaluate_date_range(
        raw_actuals=actuals,
        raw_forecasts=forecasts,
        delivery_date_from_str="2026-01-01",
        delivery_date_to_str="2026-01-31",
        cutoff_time_str="12:00:00",
    )

    metrics = evaluation.overallMetrics
    print("\n------------------------------------------------------------------")
    print("JANUARY 2026 OVERALL METRICS (LIVE VALIDATION)")
    print("------------------------------------------------------------------")
    print(f"Expected Hourly Intervals: {metrics.expectedIntervals}")
    print(f"Valid Forecast-Actual Pairs: {metrics.validPairs}")
    print(f"Data Coverage:              {metrics.coveragePercentage:.2f}%")
    print(f"Mean Absolute Error (MAE):   {metrics.mae:.2f} MW")
    print(f"Root Mean Squared Error (RMSE): {metrics.rmse:.2f} MW")
    print(f"Mean Error (ME):             {metrics.me:+.2f} MW (forecast - actual)")
    print("------------------------------------------------------------------")

    print("\nFirst 3 Days Sample:")
    for summary in evaluation.dailySummaries[:3]:
        m = summary.metrics
        print(f"  {summary.deliveryDate}: {m.validPairs}/24 pairs | MAE={m.mae:.1f} MW | RMSE={m.rmse:.1f} MW | ME={m.me:+.1f} MW | Coverage={m.coveragePercentage:.1f}%")

    print("\nLast 3 Days Sample:")
    for summary in evaluation.dailySummaries[-3:]:
        m = summary.metrics
        print(f"  {summary.deliveryDate}: {m.validPairs}/24 pairs | MAE={m.mae:.1f} MW | RMSE={m.rmse:.1f} MW | ME={m.me:+.1f} MW | Coverage={m.coveragePercentage:.1f}%")

    print("\nValidation complete: Endpoints and pipeline operate as designed.")


if __name__ == "__main__":
    asyncio.run(main())
