"""Official Elexon Insights Solution (BMRS) API client for FUELHH and WINDFOR.

Enforces:
- Explicit timeouts.
- TLS certificate verification (verify=True).
- Pydantic model validation.
- Clean custom exception handling.
"""

from datetime import datetime
import logging
from typing import List, Optional, Union
import httpx
from pydantic import ValidationError

from app.config import settings
from app.schemas import FuelHalfHourRaw, WindForecastRaw

logger = logging.getLogger(__name__)


class ElexonClientException(Exception):
    """Base exception for Elexon API operations."""
    pass


class ElexonTimeoutError(ElexonClientException):
    """Raised when an Elexon API request times out."""
    pass


class ElexonAPIError(ElexonClientException):
    """Raised when Elexon API returns a non-200 HTTP response."""
    def __init__(self, status_code: int, message: str, url: str):
        super().__init__(f"Elexon API error {status_code} from {url}: {message}")
        self.status_code = status_code
        self.message = message
        self.url = url


class ElexonResponseParseError(ElexonClientException):
    """Raised when Elexon response format or data validation fails."""
    pass


class ElexonClient:
    """Client for Elexon BMRS datasets FUELHH (actuals) and WINDFOR (forecasts)."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self.base_url = (base_url or settings.elexon_base_url).rstrip("/")
        self.timeout = timeout_seconds or settings.request_timeout_seconds
        self._transport = transport

    def _get_client(self) -> httpx.AsyncClient:
        # TLS certificate verification is strictly enabled (verify=True)
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            verify=True,
            transport=self._transport,
            headers={"User-Agent": "WindForecastIntelligence/1.0"},
        )

    async def fetch_fuelhh_actuals(
        self,
        settlement_date_from: str,
        settlement_date_to: str,
    ) -> List[FuelHalfHourRaw]:
        """Fetch half-hourly generation outturn for WIND from /datasets/FUELHH/stream.
        
        Args:
            settlement_date_from: Date string in YYYY-MM-DD format.
            settlement_date_to: Date string in YYYY-MM-DD format.
        """
        endpoint = "/datasets/FUELHH/stream"
        params = {
            "settlementDateFrom": settlement_date_from,
            "settlementDateTo": settlement_date_to,
            "fuelType": "WIND",
        }

        async with self._get_client() as client:
            try:
                logger.info(
                    "Fetching FUELHH from %s (%s to %s)",
                    endpoint, settlement_date_from, settlement_date_to
                )
                response = await client.get(endpoint, params=params)
            except httpx.TimeoutException as exc:
                raise ElexonTimeoutError(
                    f"Request to {endpoint} timed out after {self.timeout}s"
                ) from exc
            except httpx.RequestError as exc:
                raise ElexonClientException(
                    f"Network error querying {endpoint}: {exc}"
                ) from exc

        if response.status_code != 200:
            raise ElexonAPIError(
                status_code=response.status_code,
                message=response.text,
                url=str(response.url),
            )

        try:
            raw_items = response.json()
            if not isinstance(raw_items, list):
                raise ValueError(f"Expected JSON list from stream, got {type(raw_items)}")
            return [FuelHalfHourRaw.model_validate(item) for item in raw_items]
        except (ValueError, ValidationError) as exc:
            raise ElexonResponseParseError(
                f"Failed to parse FUELHH response: {exc}"
            ) from exc

    async def fetch_windfor_forecasts(
        self,
        publish_datetime_from: str,
        publish_datetime_to: str,
    ) -> List[WindForecastRaw]:
        """Fetch wind forecasts from /datasets/WINDFOR/stream within publish window.
        
        Args:
            publish_datetime_from: UTC ISO-8601 string (e.g. 2025-12-30T00:00:00Z).
            publish_datetime_to: UTC ISO-8601 string (e.g. 2026-01-31T23:59:59Z).
        """
        endpoint = "/datasets/WINDFOR/stream"
        params = {
            "publishDateTimeFrom": publish_datetime_from,
            "publishDateTimeTo": publish_datetime_to,
        }

        async with self._get_client() as client:
            try:
                logger.info(
                    "Fetching WINDFOR from %s (%s to %s)",
                    endpoint, publish_datetime_from, publish_datetime_to
                )
                response = await client.get(endpoint, params=params)
            except httpx.TimeoutException as exc:
                raise ElexonTimeoutError(
                    f"Request to {endpoint} timed out after {self.timeout}s"
                ) from exc
            except httpx.RequestError as exc:
                raise ElexonClientException(
                    f"Network error querying {endpoint}: {exc}"
                ) from exc

        if response.status_code != 200:
            raise ElexonAPIError(
                status_code=response.status_code,
                message=response.text,
                url=str(response.url),
            )

        try:
            raw_items = response.json()
            if not isinstance(raw_items, list):
                raise ValueError(f"Expected JSON list from stream, got {type(raw_items)}")
            return [WindForecastRaw.model_validate(item) for item in raw_items]
        except (ValueError, ValidationError) as exc:
            raise ElexonResponseParseError(
                f"Failed to parse WINDFOR response: {exc}"
            ) from exc
