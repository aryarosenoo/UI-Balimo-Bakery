import os
import warnings
warnings.filterwarnings("ignore")

import matplotlib
matplotlib.use("Agg")

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.tsa.stattools import adfuller

# ======================
# PATH
# ======================
CURRENT_DIR = os.path.dirname(__file__)
APP_DIR = os.path.dirname(CURRENT_DIR)
BACKEND_DIR = os.path.dirname(APP_DIR)

UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
CHART_DIR = os.path.join(BACKEND_DIR, "charts")

os.makedirs(CHART_DIR, exist_ok=True)

# ======================
# LOAD DATA
# ======================
def get_latest_file():
    files = os.listdir(UPLOAD_DIR)
    if not files:
        raise FileNotFoundError("Belum ada file upload")

    files = sorted(
        [os.path.join(UPLOAD_DIR, f) for f in files],
        key=os.path.getmtime,
        reverse=True
    )
    return files[0]


def load_data():
    path = get_latest_file()
    ext = os.path.splitext(path)[1].lower()

    if ext in [".xlsx", ".xls"]:
        df = pd.read_excel(path)
    else:
        try:
            df = pd.read_csv(path, encoding="utf-8")
        except:
            try:
                df = pd.read_csv(path, encoding="latin1")
            except:
                df = pd.read_csv(path, sep=";", encoding="latin1")

    df.columns = [str(c).strip().lower() for c in df.columns]

    rename_map = {}

    for col in df.columns:
        c = col.lower()

        if c in ["date", "tanggal", "tgl"]:
            rename_map[col] = "date"

        elif c == "quantity laku":
            rename_map[col] = "quantity"

        elif "id produk" in c or "nama produk" in c:
            rename_map[col] = "product"

        elif "nama toko" in c:
            rename_map[col] = "store"

    df = df.rename(columns=rename_map)
    df = df.loc[:, ~df.columns.duplicated()]

    if "date" not in df.columns:
        raise ValueError("Kolom date tidak ditemukan")

    if "quantity" not in df.columns:
        raise ValueError("Kolom quantity tidak ditemukan")

    if "product" not in df.columns:
        df["product"] = "ALL PRODUCT"

    if "store" not in df.columns:
        df["store"] = "UNKNOWN"

    # mapping produk
    df["product"] = (
        df["product"]
        .astype(str)
        .str.lower()
        .str.strip()
        .replace({
            "prd-01": "Roti Kecil",
            "prd-02": "Roti Besar"
        })
    )

    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0)

    df = df.dropna(subset=["date"])
    df = df.sort_values("date")

    return df


# ======================
# MAIN EDA
# ======================
def run_eda_process():
    df = load_data()

    rows = int(len(df))
    cols = int(len(df.columns))

    period_start = str(df["date"].min().date())
    period_end = str(df["date"].max().date())

    total_qty = float(df["quantity"].sum())
    avg_daily = float(df.groupby("date")["quantity"].sum().mean())
    zero_rate = float((df["quantity"] == 0).mean())
    duplicates = int(df.duplicated().sum())

    daily = df.groupby("date")["quantity"].sum()

    # Product
    product_sales = (
        df.groupby("product")["quantity"]
        .sum()
        .sort_values(ascending=False)
    )

    top_products = (
        product_sales.reset_index()
        .to_dict(orient="records")
    )

    # Store
    store_sales = (
        df.groupby("store")["quantity"]
        .sum()
        .sort_values(ascending=False)
    )

    top_stores = (
        store_sales.head(10)
        .reset_index()
        .to_dict(orient="records")
    )

    # Outlier
    q1 = df["quantity"].quantile(0.25)
    q3 = df["quantity"].quantile(0.75)
    iqr = q3 - q1

    outlier_iqr = int(
        (
            (df["quantity"] < q1 - 1.5 * iqr) |
            (df["quantity"] > q3 + 1.5 * iqr)
        ).sum()
    )

    # Stationary
    try:
        pval = adfuller(daily.values)[1]
        stationary = bool(pval <= 0.05)
    except:
        stationary = False

    # ======================
    # Charts
    # ======================

    # Trend
    plt.figure(figsize=(10,4))
    plt.plot(daily.index, daily.values)
    plt.title("Daily Sales Trend")
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, "trend.png"))
    plt.close()

    # Product Chart
    plt.figure(figsize=(8,4))
    sns.barplot(
        x=product_sales.index,
        y=product_sales.values
    )
    plt.title("Sales by Product")
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, "product.png"))
    plt.close()

    # Store Chart
    plt.figure(figsize=(10,5))
    sns.barplot(
        x=store_sales.head(10).values,
        y=store_sales.head(10).index
    )
    plt.title("Top Stores")
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, "store.png"))
    plt.close()

    # Histogram
    plt.figure(figsize=(8,4))
    sns.histplot(df["quantity"], bins=30, kde=True)
    plt.title("Demand Distribution")
    plt.tight_layout()
    plt.savefig(os.path.join(CHART_DIR, "histogram.png"))
    plt.close()

    # ======================
    # Recommendations
    # ======================
    rec = []

    if len(product_sales) > 0:
        rec.append(
            f"Produk dengan demand tertinggi adalah {product_sales.index[0]}."
        )

    if len(store_sales) > 0:
        rec.append(
            f"Toko prioritas distribusi: {store_sales.index[0]}."
        )

    if zero_rate > 0.2:
        rec.append(
            "Terdapat banyak zero sales. Cek stok kosong atau demand rendah."
        )

    if stationary:
        rec.append(
            "Data relatif stabil. Time series klasik bisa diuji."
        )
    else:
        rec.append(
            "Data fluktuatif. Gunakan model machine learning."
        )

    return {
        "summary": {
            "rows": rows,
            "columns": cols,
            "period_start": period_start,
            "period_end": period_end,
            "unique_products": int(df["product"].nunique()),
            "unique_stores": int(df["store"].nunique())
        },

        "sales_metrics": {
            "total_quantity": round(total_qty, 2),
            "average_daily_sales": round(avg_daily, 2)
        },

        "data_quality": {
            "duplicates": duplicates,
            "zero_rate": round(zero_rate, 4),
            "outlier_iqr": outlier_iqr
        },

        "top_products": top_products,
        "top_stores": top_stores,

        "forecast_readiness": {
            "stationary": stationary,
            "recommended_model":
                "Machine Learning Forecasting"
                if not stationary
                else "Classical Time Series"
        },

        "recommendations": rec,

        "charts": [
            "charts/trend.png",
            "charts/product.png",
            "charts/store.png",
            "charts/histogram.png"
        ]
    }