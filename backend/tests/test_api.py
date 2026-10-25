"""Tests for FastAPI endpoints using TestClient with mocked dependencies."""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.api.routes import get_elexon_client
from app.client import ElexonClient
from app.main import app
from app.schemas import FuelHalfHourRaw, WindForecastRaw

UTC = timezone.utc


class MockElexonClient(ElexonClient):
    """Mocked Elexon client returning canned deterministic data."""
    async def fetch_fuelhh_actuals(self, settlement_date_from: str, settlement_date_to: str):
        records = []
        for sp in range(1, 49):
            records.append(
                FuelHalfHourRaw(
                    publishTime=datetime(2026, 1, 1, 12, 0, tzinfo=UTC),
                    startTime=datetime(2026, 1, 1, (sp - 1) // 2, ((sp - 1) % 2) * 30, tzinfo=UTC),
                    settlementDate="2026-01-01",
                    settlementPeriod=sp,
                    fuelType="WIND",
                    generation=10000.0,
                )
            )
        return records

    async def fetch_windfor_forecasts(self, publish_datetime_from: str, publish_datetime_to: str):
        records = []
        for h in range(24):
            records.append(
                WindForecastRaw(
                    publishTime=datetime(2025, 12, 31, 11, 30, tzinfo=UTC),
                    startTime=datetime(2026, 1, 1, h, 0, tzinfo=UTC),
                    generation=10500.0,
                )
            )
        return records


@pytest.fixture
def client_fixture():
    mock = MockElexonClient()
    app.dependency_overrides[get_elexon_client] = lambda: mock
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_health_check(client_fixture):
    response = client_fixture.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["defaultCutoffTimeUtc"] == "12:00:00"


def test_evaluation_endpoint(client_fixture):
    response = client_fixture.get(
        "/api/evaluation?deliveryDateFrom=2026-01-01&deliveryDateTo=2026-01-01&cutoffTimeUtc=12:00:00"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["deliveryDateFrom"] == "2026-01-01"
    assert data["deliveryDateTo"] == "2026-01-01"
    assert data["expectedTotalIntervals"] == 24
    assert data["overallMetrics"]["validPairs"] == 24
    assert data["overallMetrics"]["coveragePercentage"] == 100.0
    assert data["overallMetrics"]["mae"] == 500.0
    assert data["overallMetrics"]["me"] == 500.0  # +500 over-forecast


def test_evaluation_invalid_date_returns_400(client_fixture):
    response = client_fixture.get(
        "/api/evaluation?deliveryDateFrom=invalid-date&deliveryDateTo=2026-01-01"
    )
    assert response.status_code == 400
    assert "Invalid date" in response.json()["detail"]


def test_evaluation_inverted_date_range_returns_400(client_fixture):
    response = client_fixture.get(
        "/api/evaluation?deliveryDateFrom=2026-01-05&deliveryDateTo=2026-01-01"
    )
    assert response.status_code == 400
    assert "deliveryDateTo must be on or after" in response.json()["detail"]


def test_cors_headers_allowed_origin(client_fixture):
    """Test that allowed origins receive appropriate CORS headers without credentials."""
    response = client_fixture.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") is None


def test_parse_cors_origins_logic():
    """Test CORS origin parsing handles whitespace, empty items, and custom inputs."""
    from app.config import parse_cors_origins

    # Empty or None returns defaults
    defaults = parse_cors_origins(None)
    assert "http://localhost:5173" in defaults
    assert "http://localhost:8080" in defaults

    empty = parse_cors_origins("   ,  ")
    assert "http://localhost:5173" in empty

    # Custom origins with whitespace
    custom = parse_cors_origins(" https://app.vercel.app , http://example.com ,  ")
    assert custom == ["https://app.vercel.app", "http://example.com"]

