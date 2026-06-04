from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .auth_service import AuthServiceError, authenticate_user, change_user_password, get_public_users
from .database_service import get_database_status
from .design_contract import get_design_contract
from .dss_service import build_dss_payload
from .forecasting_service import get_forecast_predictions
from .forecasting_workflow import ForecastInputRequest, get_forecasting_workflow, prepare_forecast_input
from .postgres_dataset_loader import list_database_sources


BASE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = BASE_DIR / "dist"


def get_cors_origins() -> list[str]:
    configured_origins = os.getenv("DSS_CORS_ORIGINS", "")
    if configured_origins:
        return [
            origin.strip()
            for origin in configured_origins.split(",")
            if origin.strip()
        ]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


app = FastAPI(
    title="Bakery DSS API",
    version="1.0.0",
    description="API backend untuk dashboard DSS bakery berbasis PostgreSQL.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=100)
    new_password: str = Field(min_length=6, max_length=100)
    user_id: str | None = Field(default=None, max_length=20)
    username: str | None = Field(default=None, max_length=80)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/users")
def auth_users() -> dict[str, object]:
    try:
        return {"users": get_public_users()}
    except AuthServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@app.post("/api/auth/login")
def auth_login(request: LoginRequest) -> dict[str, object]:
    try:
        return {"user": authenticate_user(request.username, request.password)}
    except AuthServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@app.post("/api/auth/change-password")
def auth_change_password(request: ChangePasswordRequest) -> dict[str, object]:
    if not request.user_id and not request.username:
        raise HTTPException(status_code=400, detail="Isi user_id atau username untuk mengganti password.")

    try:
        user = change_user_password(
            user_id=request.user_id,
            username=request.username,
            current_password=request.current_password,
            new_password=request.new_password,
        )
    except AuthServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return {"user": user, "message": "Password berhasil diperbarui."}


@app.get("/api/files")
def files() -> dict[str, object]:
    return {"files": list_database_sources(), "source": "PostgreSQL"}


@app.get("/api/database/status")
def database_status() -> dict[str, object]:
    return get_database_status()


@app.get("/api/design-contract")
def design_contract() -> dict[str, object]:
    return get_design_contract()


@app.get("/api/forecasting/workflow")
def forecasting_workflow() -> dict[str, object]:
    return get_forecasting_workflow()


@app.post("/api/forecasting/input")
def forecasting_input(request: ForecastInputRequest) -> dict[str, object]:
    return prepare_forecast_input(request)


@app.get("/api/forecasting/predictions")
def forecasting_predictions(
    horizon_days: int = Query(20, ge=1, le=20),
) -> dict[str, object]:
    try:
        return get_forecast_predictions(horizon_days=horizon_days)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/dss")
def dss(
    periods: int = Query(20, ge=1, le=104),
    product_id: str | None = None,
    component_id: str | None = None,
) -> dict[str, object]:
    try:
        return build_dss_payload(
            periods=periods,
            selected_product_id=product_id,
            selected_component_id=component_id,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api")
def api_root() -> dict[str, object]:
    return {
        "message": "Bakery DSS API berjalan.",
        "endpoints": [
            "/api/health",
            "/api/files",
            "/api/database/status",
            "/api/auth/users",
            "/api/auth/login",
            "/api/auth/change-password",
            "/api/design-contract",
            "/api/forecasting/workflow",
            "/api/forecasting/input",
            "/api/forecasting/predictions",
            "/api/dss",
        ],
    }


@app.get("/")
def root():
    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return api_root()


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Endpoint API tidak ditemukan.")

    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    raise HTTPException(status_code=404, detail="Frontend build belum tersedia. Jalankan npm run build.")
