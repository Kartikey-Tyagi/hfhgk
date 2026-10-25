"""FastAPI application entrypoint for Wind Forecast Intelligence."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings

app = FastAPI(
    title="Wind Forecast Intelligence API",
    description="Quantitative wind forecast accuracy evaluation for UK National Wind Generation using Elexon BMRS.",
    version="1.0.0",
)

# Configurable CORS for local development and deployed frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)



@app.get("/")
async def root():
    return {
        "message": "Wind Forecast Intelligence API is running.",
        "documentation": "/docs",
    }
