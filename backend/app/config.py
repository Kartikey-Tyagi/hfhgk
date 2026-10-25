import os
from typing import List, Optional
from pydantic import BaseModel


def parse_cors_origins(raw: Optional[str]) -> List[str]:
    """Parse comma-separated CORS origins with whitespace trimming and sensible defaults."""
    default_origins = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ]
    if not raw or not raw.strip():
        return default_origins
    parsed = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return parsed if parsed else default_origins


class Settings(BaseModel):
    # Elexon Insights Solution (BMRS) API
    elexon_base_url: str = os.getenv(
        "ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1"
    )

    # HTTP client timeout in seconds
    request_timeout_seconds: float = float(
        os.getenv("ELEXON_REQUEST_TIMEOUT", "30.0")
    )

    # Provisional default day-ahead purchasing decision cutoff: 12:00 UTC on D-1.
    # Note: Configurable per evaluation run as an assessment assumption.
    default_cutoff_time: str = os.getenv("DEFAULT_CUTOFF_TIME", "12:00:00")

    # Timezone identifiers
    internal_timezone: str = "UTC"
    user_facing_timezone: str = "Europe/London"

    # Configurable CORS allowed origins (defaults to sensible local dev ports)
    cors_origins: List[str] = parse_cors_origins(os.getenv("CORS_ORIGINS"))


settings = Settings()

