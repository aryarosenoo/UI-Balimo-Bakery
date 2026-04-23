from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .dss_service import build_dss_payload
from .workbook_loader import list_available_workbooks


app = FastAPI(
    title="Bakery DSS API",
    version="1.0.0",
    description="API backend untuk dashboard DSS bakery berbasis workbook Excel.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/files")
def files() -> dict[str, object]:
    return {"files": list_available_workbooks()}


@app.get("/api/dss")
def dss(
    periods: int = Query(20, ge=1, le=104),
    product_id: str | None = None,
    component_id: str | None = None,
    workbook: str | None = None,
) -> dict[str, object]:
    try:
        return build_dss_payload(
            periods=periods,
            selected_product_id=product_id,
            selected_component_id=component_id,
            workbook=workbook,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/")
def root() -> dict[str, object]:
    return {
        "message": "Bakery DSS API berjalan.",
        "endpoints": ["/api/health", "/api/files", "/api/dss"],
    }
