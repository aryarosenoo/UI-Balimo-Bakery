import os
import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor, StackingRegressor
from sklearn.svm import SVR
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBRegressor
    HAS_XGB = True
except:
    HAS_XGB = False

import os

UPLOAD_DIR = r"C:\Users\khair\Desktop\umkm_dashboard\backend\uploads"
MODEL_DIR = r"C:\Users\khair\Desktop\umkm_dashboard\backend\models"
CHART_DIR = r"C:\Users\khair\Desktop\umkm_dashboard\backend\charts"

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(CHART_DIR, exist_ok=True)


def load_data():
    path = os.path.join(UPLOAD_DIR, "latest.csv")
    print("PATH:", path)
    print("ADA?:", os.path.exists(path))

    if not os.path.exists(path):
        raise FileNotFoundError("latest.csv tidak ditemukan")

    df = pd.read_csv(path)

    df.columns = df.columns.str.strip().str.lower()

    rename_map = {
        "tanggal": "date",
        "nama toko": "store",
        "id toko": "store_id",
        "id produk": "product",
        "quantity laku": "quantity",
    }

    df = df.rename(columns=rename_map)

    if "date" not in df.columns:
        raise ValueError("Kolom tanggal/date tidak ditemukan")

    if "quantity" not in df.columns:
        raise ValueError("Kolom quantity laku tidak ditemukan")

    if "store" not in df.columns:
        if "store_id" in df.columns:
            df["store"] = df["store_id"]
        else:
            df["store"] = "UNKNOWN"

    if "product" not in df.columns:
        df["product"] = "ALL"

    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0)

    df = df.dropna(subset=["date"])

    return df


def build_features(df):
    daily = df.groupby("date")["quantity"].sum().reset_index()

    daily["dayofweek"] = daily["date"].dt.dayofweek
    daily["month"] = daily["date"].dt.month
    daily["weekofyear"] = daily["date"].dt.isocalendar().week.astype(int)
    daily["is_weekend"] = (daily["dayofweek"] >= 5).astype(int)

    daily["lag_1"] = daily["quantity"].shift(1)
    daily["lag_2"] = daily["quantity"].shift(2)
    daily["lag_3"] = daily["quantity"].shift(3)
    daily["lag_7"] = daily["quantity"].shift(7)

    daily["rolling_3"] = daily["quantity"].shift(1).rolling(3).mean()
    daily["rolling_7"] = daily["quantity"].shift(1).rolling(7).mean()

    daily = daily.dropna().reset_index(drop=True)

    X = daily[
        [
            "dayofweek",
            "month",
            "weekofyear",
            "is_weekend",
            "lag_1",
            "lag_2",
            "lag_3",
            "lag_7",
            "rolling_3",
            "rolling_7",
        ]
    ]

    y = daily["quantity"]

    return daily, X, y


def train_models():
    df = load_data()
    daily, X, y = build_features(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )

    models = {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(
            n_estimators=200, random_state=42
        ),
        "SVR": make_pipeline(StandardScaler(), SVR()),
    }

    if HAS_XGB:
        models["XGBoost"] = XGBRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=5,
            random_state=42
        )

    stack_estimators = [
        ("rf", models["Random Forest"]),
        ("svr", models["SVR"]),
    ]

    if HAS_XGB:
        stack_estimators.append(("xgb", models["XGBoost"]))

    models["Stacking"] = StackingRegressor(
        estimators=stack_estimators,
        final_estimator=Ridge()
    )

    leaderboard = []
    best_model = None
    best_mae = 999999

    pred_plot = None

    for name, model in models.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)

        mae = mean_absolute_error(y_test, pred)
        rmse = np.sqrt(mean_squared_error(y_test, pred))
        mape = np.mean(np.abs((y_test - pred) / y_test.replace(0,1))) * 100
        r2 = r2_score(y_test, pred)

        leaderboard.append({
        "Model": name,
        "MAE": round(mae,2),
        "RMSE": round(rmse,2),
        "MAPE": round(mape,2),
        "R2": round(r2,4)
        })

        if mae < best_mae:
            best_mae = mae
            best_model = name
            pred_plot = pred
            joblib.dump(model, os.path.join(MODEL_DIR, "best_model.pkl"))

    leaderboard = sorted(leaderboard, key=lambda x: x["MAE"])

    plt.figure(figsize=(10,5))
    plt.plot(y_test.values, label="Actual")
    plt.plot(pred_plot, label="Prediction")
    plt.title(best_model)
    plt.legend()
    plt.tight_layout()

    chart_path = os.path.join(CHART_DIR, "forecast_result.png")
    plt.savefig(chart_path)
    plt.close()

    return {
        "best_model": best_model,
        "leaderboard": leaderboard,
        "chart": "charts/forecast_result.png"
    }


def forecast_next(days=7):
    df = load_data()
    daily, X, y = build_features(df)

    model = joblib.load(os.path.join(MODEL_DIR, "best_model.pkl"))

    history = daily[["date", "quantity"]].copy()
    results = []

    for _ in range(days):
        temp = history.copy()

        temp["dayofweek"] = temp["date"].dt.dayofweek
        temp["month"] = temp["date"].dt.month
        temp["weekofyear"] = temp["date"].dt.isocalendar().week.astype(int)
        temp["is_weekend"] = (temp["dayofweek"] >= 5).astype(int)

        temp["lag_1"] = temp["quantity"].shift(1)
        temp["lag_2"] = temp["quantity"].shift(2)
        temp["lag_3"] = temp["quantity"].shift(3)
        temp["lag_7"] = temp["quantity"].shift(7)

        temp["rolling_3"] = temp["quantity"].shift(1).rolling(3).mean()
        temp["rolling_7"] = temp["quantity"].shift(1).rolling(7).mean()

        temp = temp.dropna().reset_index(drop=True)

        x_next = temp[X.columns].iloc[-1:]
        pred = float(model.predict(x_next)[0])
        pred = max(0, round(pred))

        next_date = history["date"].max() + pd.Timedelta(days=1)

        history = pd.concat([
            history,
            pd.DataFrame([{
                "date": next_date,
                "quantity": pred
            }])
        ], ignore_index=True)

        results.append({
            "date": str(next_date.date()),
            "forecast": pred
        })

    return results

def forecast_by_store(days=7):
    df = load_data()

    results = []

    stores = df["store"].dropna().unique()

    for store_name in stores:
        df_store = df[df["store"] == store_name].copy()

        if len(df_store) < 20:
            continue

        daily = df_store.groupby("date")["quantity"].sum().reset_index()

        daily["dayofweek"] = daily["date"].dt.dayofweek
        daily["month"] = daily["date"].dt.month
        daily["weekofyear"] = daily["date"].dt.isocalendar().week.astype(int)
        daily["is_weekend"] = (daily["dayofweek"] >= 5).astype(int)

        daily["lag_1"] = daily["quantity"].shift(1)
        daily["lag_2"] = daily["quantity"].shift(2)
        daily["lag_3"] = daily["quantity"].shift(3)
        daily["lag_7"] = daily["quantity"].shift(7)

        daily["rolling_3"] = daily["quantity"].shift(1).rolling(3).mean()
        daily["rolling_7"] = daily["quantity"].shift(1).rolling(7).mean()

        daily = daily.dropna().reset_index(drop=True)

        if len(daily) == 0:
            continue

        X = daily[
            [
                "dayofweek",
                "month",
                "weekofyear",
                "is_weekend",
                "lag_1",
                "lag_2",
                "lag_3",
                "lag_7",
                "rolling_3",
                "rolling_7",
            ]
        ]

        y = daily["quantity"]

        model = joblib.load(
            os.path.join(MODEL_DIR, "best_model.pkl")
        )

        history = daily[["date", "quantity"]].copy()

        for _ in range(days):
            temp = history.copy()

            temp["dayofweek"] = temp["date"].dt.dayofweek
            temp["month"] = temp["date"].dt.month
            temp["weekofyear"] = temp["date"].dt.isocalendar().week.astype(int)
            temp["is_weekend"] = (temp["dayofweek"] >= 5).astype(int)

            temp["lag_1"] = temp["quantity"].shift(1)
            temp["lag_2"] = temp["quantity"].shift(2)
            temp["lag_3"] = temp["quantity"].shift(3)
            temp["lag_7"] = temp["quantity"].shift(7)

            temp["rolling_3"] = temp["quantity"].shift(1).rolling(3).mean()
            temp["rolling_7"] = temp["quantity"].shift(1).rolling(7).mean()

            temp = temp.dropna().reset_index(drop=True)

            x_next = temp[X.columns].iloc[-1:]

            pred = float(model.predict(x_next)[0])
            pred = max(0, round(pred))

            next_date = history["date"].max() + pd.Timedelta(days=1)

            history = pd.concat([
                history,
                pd.DataFrame([{
                    "date": next_date,
                    "quantity": pred
                }])
            ], ignore_index=True)

            results.append({
                "date": str(next_date.date()),
                "store": str(store_name),
                "forecast": pred
            })

    return results