from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
import os
import warnings
import json

from .database_service import get_database_config, run_psql_query, sql_identifier
from .postgres_dataset_loader import build_dataset_from_database


os.environ["LOKY_MAX_CPU_COUNT"] = str(max(1, os.cpu_count() or 4))
warnings.filterwarnings("ignore", message=r"Could not find the number of physical cores.*")

BASE_DIR = Path(__file__).resolve().parent.parent
FORECAST_ASSET_DIR = BASE_DIR / "backend" / "forecast_assets"
DEFAULT_PACKAGE_PATH = FORECAST_ASSET_DIR / "pipeline_forecasting.joblib"
REFERENCE_OUTPUT_PATH = FORECAST_ASSET_DIR / "dashboard_predictions_output.xlsx"
FORECAST_HISTORY_TABLE = "forecast_sales_history"


def load_sales_frame_from_database():
    import pandas as pd

    config = get_database_config()
    schema = sql_identifier(config["schema"])
    table = sql_identifier(FORECAST_HISTORY_TABLE)
    sql = f"""
        SELECT COALESCE(json_agg(row_to_json(source_rows)), '[]'::json)::text
        FROM (
            SELECT
                tanggal::text AS tanggal,
                id_toko,
                id_product,
                quantity_laku,
                harga,
                total_penjualan,
                nama_toko,
                nama_rute,
                id_rute
            FROM {schema}.{table}
            ORDER BY tanggal, id_toko, id_product
        ) source_rows;
    """
    result = run_psql_query(config, sql, timeout=60)
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "Data histori forecast PostgreSQL belum bisa dibaca.")

    rows = json.loads(result.stdout.strip() or "[]")
    if not rows:
        raise ValueError("Tabel dss.forecast_sales_history masih kosong. Jalankan importer PostgreSQL terlebih dahulu.")

    df = pd.DataFrame(rows)
    df["tanggal"] = pd.to_datetime(df["tanggal"], errors="coerce")
    for column in ["quantity_laku", "harga", "total_penjualan"]:
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0)
    for column in ["id_toko", "id_product", "nama_toko", "nama_rute", "id_rute"]:
        df[column] = df[column].astype(str).str.strip()
    return df


def get_sales_history_signature() -> dict[str, Any]:
    config = get_database_config()
    schema = sql_identifier(config["schema"])
    table = sql_identifier(FORECAST_HISTORY_TABLE)
    sql = f"""
        SELECT row_to_json(source_rows)::text
        FROM (
            SELECT
                COUNT(*)::int AS row_count,
                COALESCE(MAX(tanggal)::text, '') AS max_date,
                COALESCE(MAX(sale_id), 0)::bigint AS max_sale_id
            FROM {schema}.{table}
        ) source_rows;
    """
    result = run_psql_query(config, sql, timeout=15)
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "Signature histori forecast PostgreSQL belum bisa dibaca.")
    return json.loads(result.stdout.strip() or "{}")


def run_smoothing_interpolation(df_raw):
    import numpy as np
    import pandas as pd

    df = df_raw.dropna(subset=["tanggal", "id_toko", "id_product", "quantity_laku"]).copy()
    df["tanggal"] = pd.to_datetime(df["tanggal"])
    df = df[df["tanggal"].dt.dayofweek != 6].reset_index(drop=True)

    min_date = df["tanggal"].min()
    max_date = df["tanggal"].max()
    work_dates = pd.date_range(start=min_date, end=max_date, freq="D")
    work_dates = work_dates[work_dates.dayofweek != 6]

    smoothed_list = []
    for (store_id, product_id), sub_df in df.groupby(["id_toko", "id_product"]):
        sub_df = (
            sub_df.groupby("tanggal")
            .agg(
                {
                    "quantity_laku": "sum",
                    "harga": "mean",
                    "total_penjualan": "sum",
                    "nama_toko": "first",
                    "nama_rute": "first",
                    "id_rute": "first",
                }
            )
            .reset_index()
        )

        sub_df = sub_df.set_index("tanggal").reindex(work_dates)
        sub_df["id_toko"] = store_id
        sub_df["id_product"] = product_id

        for column in ["nama_toko", "nama_rute", "id_rute"]:
            known_values = sub_df[column].dropna()
            fallback = known_values.iloc[0] if not known_values.empty else f"Unknown_{column}"
            sub_df[column] = sub_df[column].fillna(fallback)

        sub_df["harga"] = sub_df["harga"].ffill().bfill().fillna(0)
        sub_df["quantity_laku"] = sub_df["quantity_laku"].fillna(0)
        sub_df["quantity_laku_original"] = sub_df["quantity_laku"].copy()
        sub_df["quantity_laku_smoothed"] = sub_df["quantity_laku"].replace(0, np.nan)
        sub_df["quantity_laku_smoothed"] = (
            sub_df["quantity_laku_smoothed"]
            .interpolate(method="linear", limit_direction="both")
            .fillna(0)
        )
        sub_df["total_penjualan_smoothed"] = sub_df["quantity_laku_smoothed"] * sub_df["harga"]
        smoothed_list.append(sub_df.reset_index().rename(columns={"index": "tanggal"}))

    return pd.concat(smoothed_list, ignore_index=True)


def prepare_time_series_features(df_cluster_daily, drop_na: bool = True):
    df = df_cluster_daily.sort_values("tanggal").copy()
    target = "quantity_laku_smoothed"

    for lag in [1, 2, 6, 12, 18, 24]:
        df[f"lag_{lag}"] = df[target].shift(lag)

    for window in [6, 12, 24]:
        df[f"rolling_mean_{window}"] = df[target].shift(1).rolling(window=window).mean()
        df[f"rolling_std_{window}"] = df[target].shift(1).rolling(window=window).std()

    df["day_of_week"] = df["tanggal"].dt.dayofweek
    df["day_of_month"] = df["tanggal"].dt.day
    df["month"] = df["tanggal"].dt.month
    df["is_weekend"] = (df["day_of_week"] == 5).astype(int)

    if drop_na:
        df = df.dropna().reset_index(drop=True)
    return df


def forecast_future_recursive(model, df_historical_cluster_product, feature_cols: list[str], future_dates):
    import numpy as np
    import pandas as pd

    df_temp = df_historical_cluster_product[["tanggal", "quantity_laku_smoothed"]].copy()
    future_df = pd.DataFrame(
        {
            "tanggal": future_dates,
            "quantity_laku_smoothed": [np.nan] * len(future_dates),
        }
    )
    df_extended = pd.concat([df_temp, future_df], ignore_index=True)

    start_index = len(df_temp)
    for index in range(start_index, len(df_extended)):
        df_features = prepare_time_series_features(df_extended, drop_na=False)
        row_features = df_features.iloc[[index]]
        prediction = float(model.predict(row_features[feature_cols])[0])
        df_extended.loc[index, "quantity_laku_smoothed"] = max(0.0, prediction)

    return df_extended.iloc[start_index:].copy()


def build_future_work_dates(last_date, horizon_days: int):
    import pandas as pd

    future_dates = []
    current_date = last_date
    while len(future_dates) < horizon_days:
        current_date += pd.Timedelta(days=1)
        if current_date.dayofweek != 6:
            future_dates.append(current_date)
    return pd.DatetimeIndex(future_dates)


@lru_cache(maxsize=2)
def load_model_package(package_path: str, mtime_ns: int, size_bytes: int) -> dict[str, Any]:
    import joblib

    warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
    try:
        from joblib.externals.loky.backend import context as loky_context

        loky_context.physical_cores_cache = max(1, os.cpu_count() or 1)
    except Exception:
        pass
    return joblib.load(package_path)


def run_prediction_pipeline(package_path: Path, horizon_days: int):
    import numpy as np
    import pandas as pd

    package_stat = package_path.stat()
    package = load_model_package(str(package_path), package_stat.st_mtime_ns, package_stat.st_size)
    df_raw = load_sales_frame_from_database()
    df_smoothed = run_smoothing_interpolation(df_raw)

    df_store_clusters = package["clustering"]["store_assignments"]
    df_store_shares = package["allocation"]["store_shares"]
    trained_models = package["models"]

    df_clustered = df_smoothed.merge(
        df_store_clusters[["id_toko", "cluster"]],
        on="id_toko",
        how="left",
    )
    df_clustered = df_clustered.dropna(subset=["cluster"]).copy()
    df_clustered["cluster"] = df_clustered["cluster"].astype(int)

    df_daily = (
        df_clustered.groupby(["cluster", "id_product", "tanggal"])
        .agg({"quantity_laku_smoothed": "sum"})
        .reset_index()
    )
    model_evaluation = build_model_evaluation(trained_models, df_daily)
    future_dates = build_future_work_dates(df_smoothed["tanggal"].max(), horizon_days)

    future_cluster_list: list[dict[str, Any]] = []
    future_store_list: list[dict[str, Any]] = []

    for cluster_name, product_id in sorted(trained_models.keys()):
        cluster_id = int(str(cluster_name).split(" ")[-1])
        model_instance = trained_models[(cluster_name, product_id)]
        historical = df_daily[
            (df_daily["cluster"] == cluster_id) & (df_daily["id_product"] == product_id)
        ].copy()

        if historical.empty:
            continue

        df_features = prepare_time_series_features(historical, drop_na=True)
        feature_cols = [
            column
            for column in df_features.columns
            if column not in ["cluster", "id_product", "tanggal", "quantity_laku_smoothed"]
        ]
        df_future = forecast_future_recursive(model_instance, historical, feature_cols, future_dates)

        for _, row in df_future.iterrows():
            future_cluster_list.append(
                {
                    "Tanggal": row["tanggal"],
                    "Cluster": cluster_name,
                    "Product": product_id,
                    "Model_Terbaik": model_instance.__class__.__name__,
                    "Qty_Forecast_Pcs": float(row["quantity_laku_smoothed"]),
                }
            )

        sub_shares = df_store_shares[
            (df_store_shares["cluster"] == cluster_name) & (df_store_shares["id_product"] == product_id)
        ]
        for _, row in df_future.iterrows():
            for _, share_row in sub_shares.iterrows():
                store_forecast_float = float(row["quantity_laku_smoothed"]) * float(share_row["share"])
                future_store_list.append(
                    {
                        "Tanggal": row["tanggal"],
                        "id_toko": share_row["id_toko"],
                        "nama_toko": share_row["nama_toko"],
                        "nama_rute": share_row["nama_rute"],
                        "id_rute": share_row["id_rute"],
                        "cluster": cluster_name,
                        "id_product": product_id,
                        "Qty_Kirim_Pcs_Float": store_forecast_float,
                        "Qty_Kirim_Pcs": int(np.round(store_forecast_float)),
                    }
                )

    return (
        pd.DataFrame(future_cluster_list),
        pd.DataFrame(future_store_list),
        package,
        df_raw,
        df_smoothed,
        model_evaluation,
    )


def records_from_frame(df, date_column: str, rename_map: dict[str, str], limit: int | None = None) -> list[dict[str, Any]]:
    if df.empty:
        return []

    output_df = df.rename(columns=rename_map).copy()
    output_df["date"] = output_df[date_column].dt.strftime("%Y-%m-%d")
    output_df = output_df.drop(columns=[date_column])
    if limit is not None:
        output_df = output_df.head(limit)
    return output_df.to_dict(orient="records")


def round_float(value: Any, digits: int = 2) -> float:
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return 0.0


def cluster_sort_key(value: Any) -> tuple[int, int | str]:
    parts = str(value).split()
    if parts and parts[-1].isdigit():
        return (0, int(parts[-1]))
    return (1, str(value))


def calculate_forecast_metrics(actual_values, predicted_values) -> dict[str, Any]:
    import numpy as np

    actual = np.asarray(actual_values, dtype=float)
    predicted = np.asarray(predicted_values, dtype=float)
    valid_mask = np.isfinite(actual) & np.isfinite(predicted)
    actual = actual[valid_mask]
    predicted = predicted[valid_mask]

    if actual.size == 0:
        return {"mae": 0.0, "mse": 0.0, "rmse": 0.0, "r2": 0.0, "sample_size": 0}

    errors = actual - predicted
    absolute_errors = np.abs(errors)
    squared_errors = errors ** 2
    mse = float(np.mean(squared_errors))
    ss_res = float(np.sum(squared_errors))
    ss_tot = float(np.sum((actual - np.mean(actual)) ** 2))
    if ss_tot == 0:
        r2 = 1.0 if ss_res == 0 else 0.0
    else:
        r2 = 1 - (ss_res / ss_tot)

    return {
        "mae": round_float(float(np.mean(absolute_errors)), 4),
        "mse": round_float(mse, 4),
        "rmse": round_float(float(np.sqrt(mse)), 4),
        "r2": round_float(r2, 4),
        "sample_size": int(actual.size),
    }


def build_model_evaluation(trained_models: dict[tuple[str, str], Any], df_daily) -> dict[str, Any]:
    import numpy as np

    segment_rows: list[dict[str, Any]] = []
    overall_actual: list[Any] = []
    overall_predicted: list[Any] = []
    model_actual: dict[str, list[Any]] = {}
    model_predicted: dict[str, list[Any]] = {}
    model_segment_count: dict[str, int] = {}

    for cluster_name, product_id in sorted(trained_models.keys()):
        cluster_id = int(str(cluster_name).split(" ")[-1])
        model_instance = trained_models[(cluster_name, product_id)]
        historical = df_daily[
            (df_daily["cluster"] == cluster_id) & (df_daily["id_product"] == product_id)
        ].copy()
        if historical.empty:
            continue

        df_features = prepare_time_series_features(historical, drop_na=True)
        if df_features.empty:
            continue

        feature_cols = [
            column
            for column in df_features.columns
            if column not in ["cluster", "id_product", "tanggal", "quantity_laku_smoothed"]
        ]
        if not feature_cols:
            continue

        actual_values = df_features["quantity_laku_smoothed"].to_numpy(dtype=float)
        predicted_values = model_instance.predict(df_features[feature_cols])
        metrics = calculate_forecast_metrics(actual_values, predicted_values)
        model_name = model_instance.__class__.__name__

        segment_rows.append(
            {
                "cluster": cluster_name,
                "product": product_id,
                "model": model_name,
                **metrics,
            }
        )
        overall_actual.append(actual_values)
        overall_predicted.append(predicted_values)
        model_actual.setdefault(model_name, []).append(actual_values)
        model_predicted.setdefault(model_name, []).append(predicted_values)
        model_segment_count[model_name] = model_segment_count.get(model_name, 0) + 1

    comparison_rows: list[dict[str, Any]] = []
    for model_name in sorted(model_actual):
        actual_values = np.concatenate(model_actual[model_name]) if model_actual[model_name] else np.array([])
        predicted_values = np.concatenate(model_predicted[model_name]) if model_predicted[model_name] else np.array([])
        metrics = calculate_forecast_metrics(actual_values, predicted_values)
        comparison_rows.append(
            {
                "model": model_name,
                "segment_count": model_segment_count.get(model_name, 0),
                **metrics,
            }
        )

    comparison_rows.sort(key=lambda row: (row["rmse"], row["mae"], -row["r2"]))
    for index, row in enumerate(comparison_rows, start=1):
        row["rank"] = index
        row["status"] = "Model terbaik" if index == 1 else "Pembanding"

    overall_metrics = calculate_forecast_metrics(
        np.concatenate(overall_actual) if overall_actual else np.array([]),
        np.concatenate(overall_predicted) if overall_predicted else np.array([]),
    )

    segment_rows.sort(key=lambda row: (row["rmse"], row["mae"], -row["r2"]))
    return {
        "method": "Evaluasi histori berbasis fitur lag dari package model; algoritma forecast masa depan tidak diubah.",
        "overall": overall_metrics,
        "best_model": comparison_rows[0] if comparison_rows else None,
        "comparison": comparison_rows,
        "segments": segment_rows,
    }


def build_prediction_payload(
    df_cluster,
    df_store,
    package: dict[str, Any],
    df_raw,
    df_smoothed,
    horizon_days: int,
    model_evaluation: dict[str, Any],
) -> dict[str, Any]:
    cluster_by_day = (
        df_cluster.groupby("Tanggal")
        .agg(total_forecast_pcs=("Qty_Forecast_Pcs", "sum"))
        .reset_index()
        .sort_values("Tanggal")
    )
    store_by_day = (
        df_store.groupby("Tanggal")
        .agg(total_shipment_pcs=("Qty_Kirim_Pcs", "sum"))
        .reset_index()
        .sort_values("Tanggal")
    )
    daily = cluster_by_day.merge(store_by_day, on="Tanggal", how="left").fillna(0)
    daily["date"] = daily["Tanggal"].dt.strftime("%Y-%m-%d")
    daily["period"] = [f"H{index + 1}" for index in range(len(daily))]
    daily_rows = [
        {
            "period": row["period"],
            "date": row["date"],
            "total_forecast_pcs": round_float(row["total_forecast_pcs"]),
            "total_shipment_pcs": int(row["total_shipment_pcs"]),
        }
        for _, row in daily.iterrows()
    ]

    product_rows = []
    if not df_cluster.empty:
        product_agg = (
            df_cluster.groupby("Product")
            .agg(total_forecast_pcs=("Qty_Forecast_Pcs", "sum"), model_count=("Model_Terbaik", "nunique"))
            .reset_index()
            .sort_values("total_forecast_pcs", ascending=False)
        )
        product_ship = (
            df_store.groupby("id_product")
            .agg(total_shipment_pcs=("Qty_Kirim_Pcs", "sum"))
            .reset_index()
        )
        product_agg = product_agg.merge(product_ship, left_on="Product", right_on="id_product", how="left").fillna(0)
        product_rows = [
            {
                "product": row["Product"],
                "total_forecast_pcs": round_float(row["total_forecast_pcs"]),
                "total_shipment_pcs": int(row["total_shipment_pcs"]),
                "model_count": int(row["model_count"]),
            }
            for _, row in product_agg.iterrows()
        ]

    cluster_rows_summary = []
    if not df_cluster.empty:
        cluster_agg = (
            df_cluster.groupby("Cluster")
            .agg(total_forecast_pcs=("Qty_Forecast_Pcs", "sum"), product_count=("Product", "nunique"))
            .reset_index()
            .sort_values("total_forecast_pcs", ascending=False)
        )
        cluster_rows_summary = [
            {
                "cluster": row["Cluster"],
                "total_forecast_pcs": round_float(row["total_forecast_pcs"]),
                "product_count": int(row["product_count"]),
            }
            for _, row in cluster_agg.iterrows()
        ]

    store_rows_summary = []
    store_product_rows = []
    if not df_store.empty:
        store_agg = (
            df_store.groupby(["id_toko", "nama_toko", "nama_rute", "id_rute"])
            .agg(total_shipment_pcs=("Qty_Kirim_Pcs", "sum"))
            .reset_index()
            .sort_values("total_shipment_pcs", ascending=False)
        )
        store_rows_summary = [
            {
                "id_toko": row["id_toko"],
                "nama_toko": row["nama_toko"],
                "nama_rute": row["nama_rute"],
                "id_rute": row["id_rute"],
                "total_shipment_pcs": int(row["total_shipment_pcs"]),
            }
            for _, row in store_agg.head(20).iterrows()
        ]
        store_product_agg = (
            df_store.groupby(["id_toko", "nama_toko", "id_product", "nama_rute", "id_rute"])
            .agg(total_shipment_pcs=("Qty_Kirim_Pcs", "sum"), total_shipment_float=("Qty_Kirim_Pcs_Float", "sum"))
            .reset_index()
            .sort_values("total_shipment_pcs", ascending=False)
        )
        store_product_rows = [
            {
                "id_toko": row["id_toko"],
                "nama_toko": row["nama_toko"],
                "product": row["id_product"],
                "nama_rute": row["nama_rute"],
                "id_rute": row["id_rute"],
                "total_shipment_pcs": int(row["total_shipment_pcs"]),
                "total_shipment_float": round_float(row["total_shipment_float"]),
            }
            for _, row in store_product_agg.head(40).iterrows()
        ]

    route_rows = []
    if not df_store.empty:
        route_agg = (
            df_store.groupby(["id_rute", "nama_rute"])
            .agg(total_shipment_pcs=("Qty_Kirim_Pcs", "sum"), store_count=("id_toko", "nunique"))
            .reset_index()
            .sort_values("total_shipment_pcs", ascending=False)
        )
        route_rows = [
            {
                "id_rute": row["id_rute"],
                "nama_rute": row["nama_rute"],
                "total_shipment_pcs": int(row["total_shipment_pcs"]),
                "store_count": int(row["store_count"]),
            }
            for _, row in route_agg.iterrows()
        ]

    segment_metrics_by_cluster: dict[str, list[dict[str, Any]]] = {}
    for segment in model_evaluation.get("segments", []):
        segment_metrics_by_cluster.setdefault(str(segment.get("cluster")), []).append(segment)
    for rows in segment_metrics_by_cluster.values():
        rows.sort(key=lambda row: (row.get("rmse", 0), row.get("mae", 0), -row.get("r2", 0)))

    cluster_detail_rows = []
    if not df_cluster.empty:
        for cluster_name in sorted(df_cluster["Cluster"].unique(), key=cluster_sort_key):
            cluster_forecast = df_cluster[df_cluster["Cluster"] == cluster_name].copy()
            cluster_store = df_store[df_store["cluster"] == cluster_name].copy() if not df_store.empty else df_store.copy()

            product_ship_map = {}
            if not cluster_store.empty:
                product_ship_map = (
                    cluster_store.groupby("id_product")
                    .agg(total_shipment_pcs=("Qty_Kirim_Pcs", "sum"))
                    .to_dict(orient="index")
                )

            product_agg = (
                cluster_forecast.groupby(["Product", "Model_Terbaik"])
                .agg(total_forecast_pcs=("Qty_Forecast_Pcs", "sum"))
                .reset_index()
                .sort_values("total_forecast_pcs", ascending=False)
            )
            segment_rows = segment_metrics_by_cluster.get(str(cluster_name), [])
            product_rows_detail = []
            for _, row in product_agg.iterrows():
                segment_metric = next(
                    (
                        segment
                        for segment in segment_rows
                        if segment.get("product") == row["Product"] and segment.get("model") == row["Model_Terbaik"]
                    ),
                    {},
                )
                product_rows_detail.append(
                    {
                        "product": row["Product"],
                        "model": row["Model_Terbaik"],
                        "total_forecast_pcs": round_float(row["total_forecast_pcs"]),
                        "total_shipment_pcs": int(product_ship_map.get(row["Product"], {}).get("total_shipment_pcs", 0)),
                        "mae": segment_metric.get("mae"),
                        "rmse": segment_metric.get("rmse"),
                        "r2": segment_metric.get("r2"),
                    }
                )

            daily_cluster = (
                cluster_forecast.groupby("Tanggal")
                .agg(total_forecast_pcs=("Qty_Forecast_Pcs", "sum"))
                .reset_index()
                .sort_values("Tanggal")
            )
            daily_store = (
                cluster_store.groupby("Tanggal")
                .agg(total_shipment_pcs=("Qty_Kirim_Pcs", "sum"))
                .reset_index()
                .sort_values("Tanggal")
                if not cluster_store.empty
                else daily_cluster.assign(total_shipment_pcs=0)[["Tanggal", "total_shipment_pcs"]]
            )
            product_daily = (
                cluster_forecast.groupby(["Tanggal", "Product"])
                .agg(qty_forecast_pcs=("Qty_Forecast_Pcs", "sum"))
                .reset_index()
            )
            product_daily_lookup: dict[Any, dict[str, float]] = {}
            for _, row in product_daily.iterrows():
                product_daily_lookup.setdefault(row["Tanggal"], {})[row["Product"]] = round_float(row["qty_forecast_pcs"])

            cluster_daily = daily_cluster.merge(daily_store, on="Tanggal", how="left").fillna(0)
            daily_rows_detail = [
                {
                    "period": f"H{index + 1}",
                    "date": row["Tanggal"].strftime("%Y-%m-%d"),
                    "total_forecast_pcs": round_float(row["total_forecast_pcs"]),
                    "total_shipment_pcs": int(row["total_shipment_pcs"]),
                    "product_forecasts": product_daily_lookup.get(row["Tanggal"], {}),
                }
                for index, (_, row) in enumerate(cluster_daily.iterrows())
            ]

            store_rows_detail = []
            if not cluster_store.empty:
                store_agg = (
                    cluster_store.groupby(["id_toko", "nama_toko", "nama_rute", "id_rute"])
                    .agg(
                        total_shipment_pcs=("Qty_Kirim_Pcs", "sum"),
                        total_shipment_float=("Qty_Kirim_Pcs_Float", "sum"),
                        product_count=("id_product", "nunique"),
                    )
                    .reset_index()
                    .sort_values("total_shipment_pcs", ascending=False)
                )
                store_rows_detail = [
                    {
                        "id_toko": row["id_toko"],
                        "nama_toko": row["nama_toko"],
                        "nama_rute": row["nama_rute"],
                        "id_rute": row["id_rute"],
                        "total_shipment_pcs": int(row["total_shipment_pcs"]),
                        "total_shipment_float": round_float(row["total_shipment_float"]),
                        "product_count": int(row["product_count"]),
                    }
                    for _, row in store_agg.iterrows()
                ]

            cluster_detail_rows.append(
                {
                    "cluster": cluster_name,
                    "total_forecast_pcs": round_float(cluster_forecast["Qty_Forecast_Pcs"].sum()),
                    "total_shipment_pcs": int(cluster_store["Qty_Kirim_Pcs"].sum() if not cluster_store.empty else 0),
                    "product_count": int(cluster_forecast["Product"].nunique()),
                    "store_count": int(cluster_store["id_toko"].nunique() if not cluster_store.empty else 0),
                    "route_count": int(cluster_store["id_rute"].nunique() if not cluster_store.empty else 0),
                    "best_model_segment": segment_rows[0] if segment_rows else None,
                    "top_product": product_rows_detail[0] if product_rows_detail else None,
                    "products": product_rows_detail,
                    "stores": store_rows_detail,
                    "daily": daily_rows_detail,
                }
            )

    total_forecast = round_float(df_cluster["Qty_Forecast_Pcs"].sum() if not df_cluster.empty else 0)
    total_shipment = int(df_store["Qty_Kirim_Pcs"].sum() if not df_store.empty else 0)

    return {
        "meta": {
            "algorithm": "Daily zero-smoothing interpolation + recursive ML forecast + top-down store allocation",
            "package_name": DEFAULT_PACKAGE_PATH.name,
            "reference_output_name": REFERENCE_OUTPUT_PATH.name,
            "metadata": package.get("metadata", {}),
            "raw_data_rows": int(len(df_raw)),
            "smoothed_rows": int(len(df_smoothed)),
            "horizon_days": horizon_days,
            "future_date_start": daily_rows[0]["date"] if daily_rows else None,
            "future_date_end": daily_rows[-1]["date"] if daily_rows else None,
        },
        "summary": {
            "total_forecast_pcs": total_forecast,
            "total_shipment_pcs": total_shipment,
            "cluster_count": int(df_cluster["Cluster"].nunique() if not df_cluster.empty else 0),
            "product_count": int(df_cluster["Product"].nunique() if not df_cluster.empty else 0),
            "store_count": int(df_store["id_toko"].nunique() if not df_store.empty else 0),
            "route_count": int(df_store["id_rute"].nunique() if not df_store.empty else 0),
            "model_count": len(package.get("models", {})),
            "best_model": model_evaluation.get("best_model"),
            "top_product": product_rows[0] if product_rows else None,
            "top_cluster": cluster_rows_summary[0] if cluster_rows_summary else None,
            "top_store": store_rows_summary[0] if store_rows_summary else None,
            "top_store_product": store_product_rows[0] if store_product_rows else None,
        },
        "model_evaluation": model_evaluation,
        "daily": daily_rows,
        "products": product_rows,
        "clusters": cluster_rows_summary,
        "cluster_details": cluster_detail_rows,
        "stores": store_rows_summary,
        "store_products": store_product_rows,
        "routes": route_rows,
        "cluster_forecast": records_from_frame(
            df_cluster,
            "Tanggal",
            {
                "Cluster": "cluster",
                "Product": "product",
                "Model_Terbaik": "model",
                "Qty_Forecast_Pcs": "qty_forecast_pcs",
            },
        ),
        "store_forecast": records_from_frame(
            df_store,
            "Tanggal",
            {
                "id_toko": "id_toko",
                "nama_toko": "nama_toko",
                "nama_rute": "nama_rute",
                "id_rute": "id_rute",
                "cluster": "cluster",
                "id_product": "product",
                "Qty_Kirim_Pcs_Float": "qty_kirim_pcs_float",
                "Qty_Kirim_Pcs": "qty_kirim_pcs",
            },
        ),
    }


@lru_cache(maxsize=8)
def get_forecast_predictions_cached(
    history_row_count: int,
    history_max_date: str,
    history_max_sale_id: int,
    package_path: str,
    package_mtime_ns: int,
    package_size_bytes: int,
    horizon_days: int,
) -> dict[str, Any]:
    df_cluster, df_store, package, df_raw, df_smoothed, model_evaluation = run_prediction_pipeline(
        package_path=Path(package_path),
        horizon_days=horizon_days,
    )
    return build_prediction_payload(df_cluster, df_store, package, df_raw, df_smoothed, horizon_days, model_evaluation)


def build_database_forecast_payload(horizon_days: int) -> dict[str, Any]:
    dataset = build_dataset_from_database()
    forecast = dataset.get("forecast", {})
    forecast_rows = forecast.get("rows") or []
    periods = (forecast.get("periods") or [])[:horizon_days]

    daily = []
    for index, period in enumerate(periods):
        daily.append(
            {
                "period": period.get("period") or f"W{index + 1}",
                "tanggal": period.get("period") or f"W{index + 1}",
                "total_forecast_pcs": round_float(period.get("total") or 0),
                "total_shipment_pcs": round_float(period.get("total_customer_order") or period.get("total") or 0),
            }
        )

    products = []
    for row in forecast_rows:
        values = list(row.get("values") or [])[:horizon_days]
        customer_values = list(row.get("customer_order_values") or [])[:horizon_days]
        total_forecast = sum(float(value or 0) for value in values)
        total_customer = sum(float(value or 0) for value in customer_values) if customer_values else total_forecast
        products.append(
            {
                "product": row.get("id") or "",
                "product_name": row.get("name") or row.get("id") or "",
                "total_forecast_pcs": round_float(total_forecast),
                "total_shipment_pcs": round_float(total_customer),
                "model_count": 0,
                "color": row.get("color") or "#38bdf8",
            }
        )
    products.sort(key=lambda row: row["total_forecast_pcs"], reverse=True)

    total_forecast = round_float(sum(row["total_forecast_pcs"] for row in products))
    total_shipment = round_float(sum(row["total_shipment_pcs"] for row in products))

    return {
        "meta": {
            "source": "PostgreSQL",
            "source_table": forecast.get("source") or "dss.demand_plans",
            "algorithm": "Forecast demand dari PostgreSQL dss.demand_plans hasil import Agregate Demand",
            "package_name": "dss.demand_plans",
            "future_date_start": daily[0]["period"] if daily else "",
            "future_date_end": daily[-1]["period"] if daily else "",
            "raw_data_rows": len(forecast_rows) * len(periods),
            "smoothed_rows": len(periods),
        },
        "summary": {
            "total_forecast_pcs": total_forecast,
            "total_shipment_pcs": total_shipment,
            "product_count": len(products),
            "store_count": 0,
            "route_count": 0,
            "cluster_count": 0,
            "model_count": 0,
        },
        "daily": daily,
        "products": products,
        "clusters": [],
        "cluster_details": [],
        "stores": [],
        "store_products": [],
        "routes": [],
        "model_evaluation": {
            "method": "Forecast dibaca dari demand_plans PostgreSQL; evaluasi model ML tidak dipakai untuk sinkronisasi angka Excel.",
            "overall": {},
            "comparison": [],
            "best_model": None,
        },
        "cluster_forecast": [],
        "store_forecast": [],
    }


def get_forecast_predictions(horizon_days: int = 20) -> dict[str, Any]:
    horizon_days = max(1, min(int(horizon_days), 20))
    return build_database_forecast_payload(horizon_days)
