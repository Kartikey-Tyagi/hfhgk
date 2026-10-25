"""Pydantic schemas for Wind Forecast Intelligence."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class FuelHalfHourRaw(BaseModel):
    """Raw record from /datasets/FUELHH/stream."""
    dataset: str = "FUELHH"
    publishTime: datetime
    startTime: datetime
    settlementDate: str
    settlementPeriod: int
    fuelType: str
    generation: Optional[float] = None


class WindForecastRaw(BaseModel):
    """Raw record from /datasets/WINDFOR/stream."""
    dataset: str = "WINDFOR"
    publishTime: datetime
    startTime: datetime
    generation: Optional[float] = None


class HourlyActual(BaseModel):
    """Hourly actual wind generation aggregated from two 30-minute settlement periods."""
    startTime: datetime
    startTimeLondon: str
    settlementDate: str
    hour: int
    generation: Optional[float] = None
    sp1Period: int
    sp1Generation: Optional[float] = None
    sp2Period: int
    sp2Generation: Optional[float] = None
    isValid: bool = False


class SelectedForecast(BaseModel):
    """Latest eligible wind forecast published at or before the decision cutoff."""
    startTime: datetime
    startTimeLondon: str
    publishTime: datetime
    publishTimeLondon: str
    generation: Optional[float] = None
    cutoffTimeUtc: datetime
    isValid: bool = False


class AlignedEvaluationInterval(BaseModel):
    """Single hourly interval aligning selected forecast against actual generation."""
    startTime: datetime
    startTimeLondon: str
    settlementDate: str
    hour: int
    forecastGeneration: Optional[float] = None
    actualGeneration: Optional[float] = None
    forecastPublishTime: Optional[datetime] = None
    forecastPublishTimeLondon: Optional[str] = None
    error: Optional[float] = None  # forecast - actual
    isCovered: bool = False  # True only if both forecast and actual are valid numeric values


class EvaluationMetrics(BaseModel):
    """Quantitative forecast accuracy and data coverage metrics."""
    expectedIntervals: int
    validPairs: int
    coveragePercentage: float
    mae: Optional[float] = None   # Mean Absolute Error in MW
    rmse: Optional[float] = None  # Root Mean Squared Error in MW
    me: Optional[float] = None    # Mean Error in MW (forecast - actual; >0 means over-forecast)


class DailyEvaluationSummary(BaseModel):
    """Evaluation summary for a single delivery day."""
    deliveryDate: str
    cutoffTimeUtc: str
    metrics: EvaluationMetrics
    intervals: List[AlignedEvaluationInterval]


class EvaluationResponse(BaseModel):
    """Complete evaluation response across the requested delivery date range."""
    deliveryDateFrom: str
    deliveryDateTo: str
    cutoffTimeUtc: str
    expectedTotalIntervals: int
    overallMetrics: EvaluationMetrics
    dailySummaries: List[DailyEvaluationSummary]
