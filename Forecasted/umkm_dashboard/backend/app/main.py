import os
import shutil

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import forecasting

app = FastAPI(title="UMKM Forecasting API")

# ======================
# FOLDER SETUP
# ======================
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
CHART_DIR = os.path.join(BASE_DIR, "charts")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHART_DIR, exist_ok=True)

# ======================
# CORS
# ======================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================
# STATIC FILES
# ======================
app.mount("/charts", StaticFiles(directory=CHART_DIR), name="charts")

# ======================
# ROUTER
# ======================
app.include_router(forecasting.router)

# ======================
# ROOT
# ======================
@app.get("/")
def root():
    return {"message": "API running"}

# ======================
# UPLOAD FILE
# ======================
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename

    # hapus file lama
    for f in os.listdir(UPLOAD_DIR):
        try:
            os.remove(os.path.join(UPLOAD_DIR, f))
        except:
            pass

    save_path = os.path.join(UPLOAD_DIR, filename)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "message": "Upload berhasil",
        "filename": filename
    }