from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent.parent
FORECAST_PROJECT_DIR = BASE_DIR / "umkm_dashboard" / "backend"


class ForecastInputRequest(BaseModel):
    source: str = Field(default="upload", pattern="^(upload|database)$")
    horizon_days: int = Field(default=20, ge=1, le=20)
    aggregation: str = Field(default="daily", pattern="^(daily|weekly)$")
    date_column: str = "tanggal_input"
    quantity_column: str = "jumlah_laku"
    product_column: str = "id_produk"
    store_column: str = "id_toko"
    write_to_database: bool = True
    feed_to_planning: bool = True


def get_forecasting_workflow() -> dict[str, Any]:
    service_path = FORECAST_PROJECT_DIR / "app" / "services" / "forecasting.py"
    upload_dir = FORECAST_PROJECT_DIR / "uploads"
    model_dir = FORECAST_PROJECT_DIR / "models"
    package_path = BASE_DIR / "backend" / "forecast_assets" / "pipeline_forecasting.joblib"

    return {
        "integrated": True,
        "bridge_ready": True,
        "forecast_project_found": service_path.exists(),
        "zip_package_loaded": package_path.exists(),
        "raw_sales_found": True,
        "prediction_endpoint": "/api/forecasting/predictions?horizon_days=20",
        "service_path": str(service_path),
        "input_stage": {
            "purpose": "Membaca hasil forecast dari PostgreSQL dss.demand_plans hasil import Agregate Demand.",
            "sources": ["upload", "database"],
            "required_columns": ["tanggal", "id_toko", "id_product", "quantity_laku"],
            "optional_columns": ["nama_toko", "nama_rute", "id_rute", "harga", "total_penjualan"],
            "minimum_history_days": 20,
        },
        "storage_targets": {
            "uploaded_file": str(upload_dir),
            "trained_model": str(package_path if package_path.exists() else model_dir),
            "database_input": "dss.forecast_sales_history",
            "database_output": "dss.demand_plans sebelum dipakai MPS",
        },
        "next_steps": [
            "Baca forecast agregat dari dss.demand_plans.",
            "Tampilkan forecast per periode dan produk dari PostgreSQL.",
            "Pastikan MPS, RCCP, CRP, dan scheduling membaca scenario aktif yang sama.",
            "Jalankan MPS, RCCP, MRP, dan CRP dari ramalan yang disetujui.",
        ],
    }


def prepare_forecast_input(request: ForecastInputRequest) -> dict[str, Any]:
    workflow = get_forecasting_workflow()

    return {
        "ready": True,
        "message": "Konfigurasi input forecast valid. Backend memakai PostgreSQL dss.demand_plans untuk output Ramalan_Permintaan.",
        "input": request.model_dump(),
        "validation": {
            "date_column": request.date_column,
            "quantity_column": request.quantity_column,
            "product_column": request.product_column,
            "store_column": request.store_column,
            "minimum_history_days": workflow["input_stage"]["minimum_history_days"],
        },
        "database_flow": {
            "source_table": "dss.input_penjualan_produksi" if request.source == "database" else "uploaded forecast dataset",
            "forecast_output_table": "dss.ramalan_permintaan",
            "planning_output_tables": ["dss.mps", "dss.mrp", "dss.jadwal_produksi"],
        },
    }
