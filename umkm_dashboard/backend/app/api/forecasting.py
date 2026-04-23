import os
import shutil
from fastapi import APIRouter, UploadFile, File

from app.services.eda import run_eda_process
from app.services.forecasting import train_models, forecast_next

from app.services.forecasting import (
    train_models,
    forecast_next,
    forecast_by_store
)

router = APIRouter(prefix="/api/forecasting", tags=["Forecasting"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-data")
async def upload_data(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()

    save_path = os.path.join(UPLOAD_DIR, f"latest{ext}")

    # hapus file lama
    for f in os.listdir(UPLOAD_DIR):
        os.remove(os.path.join(UPLOAD_DIR, f))

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "message": "uploaded",
        "filename": f"latest{ext}"
    }


@router.get("/run-eda")
def run_eda():
    return run_eda_process()


@router.get("/train-model")
def train_model():
    return train_models()


@router.get("/forecast")
def get_forecast(days: int = 7):
    return forecast_next(days)

@router.get("/forecast-by-store")
def get_forecast_by_store(days: int = 7):
    return forecast_by_store(days)