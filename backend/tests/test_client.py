"""Tests for Elexon API client with mocked HTTP responses."""

import httpx
import pytest

from app.client import (
    ElexonAPIError,
    ElexonClient,
    ElexonResponseParseError,
    ElexonTimeoutError,
)
from app.schemas import FuelHalfHourRaw, WindForecastRaw


@pytest.mark.asyncio
async def test_fetch_fuelhh_success():
    """Verify successful parsing of FUELHH stream response."""
    sample_data = [
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 12500,
        }
    ]

    def mock_handler(request: httpx.Request) -> httpx.Response:
        assert "/datasets/FUELHH/stream" in request.url.path
        assert request.url.params["fuelType"] == "WIND"
        return httpx.Response(200, json=sample_data)

    client = ElexonClient(transport=httpx.MockTransport(mock_handler))
    results = await client.fetch_fuelhh_actuals("2026-01-01", "2026-01-01")

    assert len(results) == 1
    assert isinstance(results[0], FuelHalfHourRaw)
    assert results[0].settlementPeriod == 1
    assert results[0].generation == 12500.0


@pytest.mark.asyncio
async def test_fetch_windfor_success():
    """Verify successful parsing of WINDFOR stream response."""
    sample_data = [
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T11:30:00Z",
            "startTime": "2026-01-02T12:00:00Z",
            "generation": 17893,
        }
    ]

    def mock_handler(request: httpx.Request) -> httpx.Response:
        assert "/datasets/WINDFOR/stream" in request.url.path
        return httpx.Response(200, json=sample_data)

    client = ElexonClient(transport=httpx.MockTransport(mock_handler))
    results = await client.fetch_windfor_forecasts(
        "2026-01-01T00:00:00Z", "2026-01-01T23:59:59Z"
    )

    assert len(results) == 1
    assert isinstance(results[0], WindForecastRaw)
    assert results[0].generation == 17893.0


@pytest.mark.asyncio
async def test_api_error_raises_elexon_api_error():
    """HTTP 400 or 500 error from API raises ElexonAPIError."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    client = ElexonClient(transport=httpx.MockTransport(mock_handler))
    with pytest.raises(ElexonAPIError) as exc_info:
        await client.fetch_fuelhh_actuals("2026-01-01", "2026-01-01")

    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_timeout_raises_elexon_timeout_error():
    """Client timeout raises ElexonTimeoutError."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Connection timed out", request=request)

    client = ElexonClient(transport=httpx.MockTransport(mock_handler))
    with pytest.raises(ElexonTimeoutError):
        await client.fetch_fuelhh_actuals("2026-01-01", "2026-01-01")


@pytest.mark.asyncio
async def test_malformed_json_raises_parse_error():
    """Non-list response or invalid fields raise ElexonResponseParseError."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        # Returns an unexpected dictionary rather than list of records
        return httpx.Response(200, json={"unexpected": "structure"})

    client = ElexonClient(transport=httpx.MockTransport(mock_handler))
    with pytest.raises(ElexonResponseParseError):
        await client.fetch_fuelhh_actuals("2026-01-01", "2026-01-01")
