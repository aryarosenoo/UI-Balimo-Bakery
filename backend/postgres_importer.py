from __future__ import annotations

from pathlib import Path
from typing import Any
import json
import math
import re
import uuid

from .database_service import get_database_config, run_psql_script, sql_literal
from .workbook_loader import get_dataset, normalize_key, resolve_workbook_path


NAMESPACE = uuid.UUID("89e23f58-268b-5e24-8c2e-83fd1f4a6e75")
DEFAULT_RAW_SALES_PATH = Path(__file__).resolve().parent.parent / "umkm_dashboard" / "backend" / "uploads" / "data_penjualan.xlsx"

CANONICAL_COLUMNS = {
    "tanggal": {"tanggal", "tanggalinput", "date"},
    "id_toko": {"idtoko", "idstore", "storeid"},
    "nama_toko": {"namatoko", "store", "namastore"},
    "id_rute": {"idrute", "routeid"},
    "nama_rute": {"namarute", "route", "namaroute"},
    "id_product": {"idproduk", "idproduct", "id_product", "productid"},
    "quantity_laku": {"quantitylaku", "jumlahlaku", "qtylaku", "quantitysold"},
    "harga": {"harga", "price"},
    "total_penjualan": {"totalpenjualan", "sales", "totalsales"},
}


def normalize_column_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").strip().lower())


def resolve_column(columns: list[str], target: str) -> str | None:
    aliases = CANONICAL_COLUMNS[target]
    for column in columns:
        if normalize_column_name(column) in aliases:
            return column
    return None


def normalize_sales_frame(raw_excel_path: Path):
    import pandas as pd

    workbook = pd.ExcelFile(raw_excel_path)
    sheet_name = next(
        (
            candidate
            for candidate in ["raw_data", "Hitung2 Demand"]
            if candidate in workbook.sheet_names
        ),
        workbook.sheet_names[0],
    )
    df_raw = pd.read_excel(raw_excel_path, sheet_name=sheet_name)
    source_columns = list(df_raw.columns)

    rename_map: dict[str, str] = {}
    missing_columns = []
    for target in CANONICAL_COLUMNS:
        source = resolve_column(source_columns, target)
        if source:
            rename_map[source] = target
        elif target in {"tanggal", "id_toko", "id_product", "quantity_laku"}:
            missing_columns.append(target)

    if missing_columns:
        raise ValueError(
            "Kolom wajib forecast tidak ditemukan: "
            + ", ".join(missing_columns)
            + ". Kolom yang diterima: tanggal, id_toko, id_product, quantity_laku."
        )

    df = df_raw.rename(columns=rename_map)
    for optional_column in ["harga", "total_penjualan", "nama_toko", "nama_rute", "id_rute"]:
        if optional_column not in df.columns:
            df[optional_column] = 0 if optional_column in {"harga", "total_penjualan"} else f"Unknown_{optional_column}"

    df = df[
        [
            "tanggal",
            "id_toko",
            "id_product",
            "quantity_laku",
            "harga",
            "total_penjualan",
            "nama_toko",
            "nama_rute",
            "id_rute",
        ]
    ].copy()
    df["tanggal"] = pd.to_datetime(df["tanggal"], dayfirst=True, errors="coerce")
    df["quantity_laku"] = pd.to_numeric(df["quantity_laku"], errors="coerce")
    df["harga"] = pd.to_numeric(df["harga"], errors="coerce").fillna(0)
    df["total_penjualan"] = pd.to_numeric(df["total_penjualan"], errors="coerce")
    df["total_penjualan"] = df["total_penjualan"].fillna(df["quantity_laku"].fillna(0) * df["harga"])
    df = df.dropna(subset=["tanggal", "quantity_laku"]).copy()

    for column in ["id_toko", "id_product", "nama_toko", "nama_rute", "id_rute"]:
        df[column] = df[column].astype(str).str.strip()
    df = df[
        (df["id_toko"].str.lower() != "id toko")
        & (df["id_product"].str.lower() != "id produk")
        & (df["id_toko"] != "")
        & (df["id_product"] != "")
    ].copy()

    return df


def stable_uuid(key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, key))


def lit(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    return sql_literal(str(value))


def num(value: Any, default: float = 0.0) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = default
    if not math.isfinite(numeric):
        numeric = default
    return str(round(numeric, 6))


def int_num(value: Any, default: int = 0) -> str:
    try:
        return str(int(round(float(value))))
    except (TypeError, ValueError):
        return str(default)


def slug(value: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "-", str(value or "").strip()).strip("-")
    return text or "unknown"


def parse_lot_size(value: Any) -> float:
    if isinstance(value, (int, float)):
        return max(1.0, float(value))
    match = re.search(r"\d+(?:[.,]\d+)?", str(value or ""))
    if not match:
        return 1.0
    return max(1.0, float(match.group(0).replace(",", ".")))


def uom_code(value: str | None) -> str:
    normalized = str(value or "pcs").strip().lower()
    if normalized in {"pc", "pcs", "piece", "pieces", "unit"}:
        return "pcs"
    if normalized in {"gr", "gram", "grams"}:
        return "gr"
    if normalized in {"kg", "kilogram", "kilograms"}:
        return "kg"
    return normalized or "pcs"


def values_sql(rows: list[str], chunk_size: int = 500) -> list[str]:
    return [
        ",\n".join(rows[index : index + chunk_size])
        for index in range(0, len(rows), chunk_size)
    ]


def run_script(sql: str, timeout: int = 180) -> None:
    config = get_database_config()
    result = run_psql_script(config, sql, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Script PostgreSQL gagal.")


def build_item_catalog(dataset: dict[str, Any]) -> dict[str, dict[str, Any]]:
    items: dict[str, dict[str, Any]] = {}

    for forecast_row in dataset.get("forecast", {}).get("rows", []):
        code = forecast_row.get("id")
        if not code:
            continue
        items[code] = {
            "code": code,
            "name": forecast_row.get("name") or code,
            "type": "final_product",
            "family_code": "",
            "family_name": "",
            "uom": "pcs",
            "lot_size": 1,
            "lead_time": 0,
            "safety_stock": 0,
            "initial_on_hand": 0,
            "supplier_name": "",
        }

    for product in dataset["products"]:
        items[product["id"]] = {
            "code": product["id"],
            "name": product["name"],
            "type": "final_product",
            "family_code": product.get("family_id") or "FAM-ROTI",
            "family_name": product.get("family_name") or "Produk Roti",
            "uom": "pcs",
            "lot_size": 1,
            "lead_time": 0,
            "safety_stock": 0,
            "initial_on_hand": 0,
            "supplier_name": "",
        }

    for item in dataset["mrp"]["items"]:
        code = item.get("code") or item.get("id")
        if not code:
            continue
        items.setdefault(
            code,
            {
                "code": code,
                "name": item.get("name") or code,
                "type": item.get("category") or "raw_material",
                "family_code": "",
                "family_name": "",
                "uom": "pcs",
                "lot_size": parse_lot_size(item.get("lot_size")),
                "lead_time": item.get("lead_time") or 0,
                "safety_stock": 0,
                "initial_on_hand": 0,
                "supplier_name": "",
            },
        )
        items[code]["type"] = item.get("category") or items[code]["type"]
        items[code]["lot_size"] = parse_lot_size(item.get("lot_size"))
        items[code]["lead_time"] = item.get("lead_time") or 0

    for component in dataset.get("components", []):
        code = component.get("code") or f"CMP-{slug(component.get('name', 'component'))}"
        items.setdefault(
            code,
            {
                "code": code,
                "name": component.get("name") or code,
                "type": "raw_material",
                "family_code": "",
                "family_name": "",
                "uom": uom_code(component.get("unit")),
                "lot_size": 1,
                "lead_time": 0,
                "safety_stock": 0,
                "initial_on_hand": 0,
                "supplier_name": component.get("supplier") or "",
            },
        )

    for row in [*dataset["crp"]["run_rows"], *dataset["crp"]["setup_rows"]]:
        code = row.get("item_code")
        if code and code not in items:
            items[code] = {
                "code": code,
                "name": row.get("item_name") or code,
                "type": "intermediate",
                "family_code": "",
                "family_name": "",
                "uom": "pcs",
                "lot_size": 1,
                "lead_time": 0,
                "safety_stock": 0,
                "initial_on_hand": 0,
                "supplier_name": "",
            }

    lot_size_by_item = dataset.get("bol_rccp", {}).get("lot_size_by_item", {})
    lot_size_by_name = dataset.get("bol_rccp", {}).get("lot_size_by_name", {})
    for item in items.values():
        lot_size = lot_size_by_item.get(item.get("code") or "")
        if lot_size is None:
            lot_size = lot_size_by_name.get(normalize_key(item.get("name")))
        if lot_size is not None:
            item["lot_size"] = parse_lot_size(lot_size)

    return items


def seed_postgres_from_workbook(workbook: str | None = None) -> dict[str, Any]:
    workbook_path = resolve_workbook_path(workbook)
    dataset = get_dataset(workbook)
    try:
        sales_frame = normalize_sales_frame(workbook_path)
    except ValueError:
        sales_frame = normalize_sales_frame(DEFAULT_RAW_SALES_PATH)

    scenario_id = stable_uuid("scenario:default")
    scenario_code = "default"
    scenario_name = "Default PostgreSQL Planning"
    source_name = "PostgreSQL import"

    periods = dataset["week_numbers"]
    item_catalog = build_item_catalog(dataset)
    product_codes = [product["id"] for product in dataset["products"]]
    work_center_ids = [work_center["id"] for work_center in dataset["work_centers"]]
    route_ids = [route["id"] for route in dataset["routes"]]

    uom_codes = sorted({uom_code(item.get("uom")) for item in item_catalog.values()} | {"pcs", "kg", "gr"})
    family_rows = {}
    for product in dataset["products"]:
        code = product.get("family_id") or "FAM-ROTI"
        family_rows[code] = product.get("family_name") or "Produk Roti"

    sql_parts = [
        "BEGIN;",
        """
        CREATE TABLE IF NOT EXISTS dss.forecast_sales_history (
            sale_id bigserial PRIMARY KEY,
            tanggal date NOT NULL,
            id_toko varchar(30) NOT NULL,
            id_product varchar(30) NOT NULL,
            quantity_laku numeric NOT NULL,
            harga numeric NOT NULL DEFAULT 0,
            total_penjualan numeric NOT NULL DEFAULT 0,
            nama_toko text,
            nama_rute text,
            id_rute varchar(30)
        );
        CREATE INDEX IF NOT EXISTS idx_forecast_sales_history_product_date
            ON dss.forecast_sales_history(id_product, tanggal);
        """,
        f"""
        DELETE FROM dss.workbook_imports WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.production_schedule_lines WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.crp_lines WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.rccp_lines WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.mrp_lines WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.mps_lines WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.demand_plans WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.scheduled_receipts WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.on_hand_balances WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.work_center_period_capacity
        WHERE period_id IN (SELECT period_id FROM dss.planning_periods WHERE scenario_id = {lit(scenario_id)}::uuid);
        DELETE FROM dss.planning_periods WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.planning_scenarios WHERE scenario_id = {lit(scenario_id)}::uuid;
        DELETE FROM dss.forecast_sales_history;
        """,
    ]

    uom_values = [
        f"({lit(stable_uuid(f'uom:{code}'))}::uuid, {lit(code)}, {lit(code.upper())})"
        for code in uom_codes
    ]
    sql_parts.append(
        f"""
        INSERT INTO dss.uoms (uom_id, code, name)
        VALUES {','.join(uom_values)}
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
        """
    )

    family_values = [
        f"({lit(stable_uuid(f'family:{code}'))}::uuid, {lit(code)}, {lit(name)})"
        for code, name in family_rows.items()
    ]
    if family_values:
        sql_parts.append(
            f"""
            INSERT INTO dss.product_families (family_id, family_code, family_name)
            VALUES {','.join(family_values)}
            ON CONFLICT (family_code) DO UPDATE SET family_name = EXCLUDED.family_name;
            """
        )

    if item_catalog:
        active_item_codes = ",".join(lit(item["code"]) for item in item_catalog.values())
        sql_parts.append(
            f"""
            UPDATE dss.items
            SET is_active = false
            WHERE item_code NOT IN ({active_item_codes});
            """
        )

    item_values = []
    for item in item_catalog.values():
        code = item["code"]
        item_uuid = stable_uuid(f"item:{code}")
        item_uom_uuid = stable_uuid(f"uom:{uom_code(item.get('uom'))}")
        family_code = item.get("family_code") or None
        family_id = f"{lit(stable_uuid(f'family:{family_code}'))}::uuid" if family_code else "NULL"
        item_values.append(
            "("
            f"{lit(item_uuid)}::uuid, "
            f"{lit(code)}, {lit(item['name'])}, {lit(item['type'])}, "
            f"{family_id}, {lit(item_uom_uuid)}::uuid, "
            f"{lit(item.get('supplier_name') or '')}, true"
            ")"
        )
    for chunk in values_sql(item_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.items
                (item_id, item_code, item_name, item_type, family_id, uom_id, supplier_name, is_active)
            VALUES {chunk}
            ON CONFLICT (item_code) DO UPDATE SET
                item_name = EXCLUDED.item_name,
                item_type = EXCLUDED.item_type,
                family_id = EXCLUDED.family_id,
                uom_id = EXCLUDED.uom_id,
                supplier_name = EXCLUDED.supplier_name,
                is_active = true;
            """
        )

    policy_values = []
    for item in item_catalog.values():
        item_uuid = stable_uuid(f"item:{item['code']}")
        policy_values.append(
            "("
            f"{lit(item_uuid)}::uuid, 'LFL', "
            f"{num(item.get('lot_size'), 1)}, 0, 1, {int_num(item.get('lead_time'))}, "
            f"{num(item.get('safety_stock'))}, {num(item.get('initial_on_hand'))}"
            ")"
        )
    for chunk in values_sql(policy_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.item_planning_policies
                (item_id, lot_sizing_method, lot_size, min_order_qty, order_multiple,
                 lead_time_periods, safety_stock_qty, initial_on_hand_qty)
            VALUES {chunk}
            ON CONFLICT (item_id) DO UPDATE SET
                lot_size = EXCLUDED.lot_size,
                lead_time_periods = EXCLUDED.lead_time_periods,
                safety_stock_qty = EXCLUDED.safety_stock_qty,
                initial_on_hand_qty = EXCLUDED.initial_on_hand_qty;
            """
        )

    wc_values = []
    for work_center in dataset["work_centers"]:
        work_center_code = work_center["id"]
        work_center_uuid = stable_uuid(f"wc:{work_center_code}")
        capacity_hours = float(work_center.get("capacity_hours") or 0)
        units = float(work_center.get("units") or 1)
        hours_per_day = float(work_center.get("hours_per_day") or 8)
        workdays = capacity_hours / max(units * hours_per_day, 1)
        wc_values.append(
            "("
            f"{lit(work_center_uuid)}::uuid, "
            f"{lit(work_center_code)}, {lit(work_center['name'])}, "
            f"{num(units, 1)}, {num(hours_per_day, 8)}, 1, {num(workdays, 1)}, "
            "100, 100, "
            f"{num(work_center.get('queue_days'))}, {lit(work_center.get('notes') or '')}, true"
            ")"
        )
    if wc_values:
        active_work_center_codes = ",".join(lit(work_center_id) for work_center_id in work_center_ids)
        sql_parts.append(
            f"""
            UPDATE dss.work_centers
            SET is_active = false
            WHERE work_center_code NOT IN ({active_work_center_codes});
            """
        )
        sql_parts.append(
            f"""
            INSERT INTO dss.work_centers
                (work_center_id, work_center_code, work_center_name, units, hours_per_day,
                 shifts_per_day, workdays_per_period, efficiency_pct, utilization_target_pct,
                 queue_days, notes, is_active)
            VALUES {','.join(wc_values)}
            ON CONFLICT (work_center_code) DO UPDATE SET
                work_center_name = EXCLUDED.work_center_name,
                units = EXCLUDED.units,
                hours_per_day = EXCLUDED.hours_per_day,
                workdays_per_period = EXCLUDED.workdays_per_period,
                queue_days = EXCLUDED.queue_days,
                notes = EXCLUDED.notes,
                is_active = true;
            """
        )

    store_values = []
    for store in dataset["stores"]:
        store_uuid = stable_uuid(f"store:{store['id']}")
        store_values.append(
            "("
            f"{lit(store_uuid)}::uuid, "
            f"{lit(store['id'])}, {lit(store['name'])}, {lit(store.get('location') or '')}, true"
            ")"
        )
    for chunk in values_sql(store_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.stores (store_id, store_code, store_name, location_name, is_active)
            VALUES {chunk}
            ON CONFLICT (store_code) DO UPDATE SET
                store_name = EXCLUDED.store_name,
                location_name = EXCLUDED.location_name,
                is_active = true;
            """
        )

    route_values = []
    route_store_values = []
    for route in dataset["routes"]:
        route_uuid = stable_uuid(f"route:{route['id']}")
        route_values.append(
            "("
            f"{lit(route_uuid)}::uuid, "
            f"{lit(route['id'])}, {lit(route['name'])}, {lit(route.get('day') or '')}, "
            f"{lit(route.get('color') or '#38bdf8')}"
            ")"
        )
        for index, store in enumerate(route.get("stores", []), start=1):
            store_uuid = stable_uuid(f"store:{store['id']}")
            route_store_values.append(
                "("
                f"{lit(route_uuid)}::uuid, "
                f"{lit(store_uuid)}::uuid, {index}"
                ")"
            )
    if route_values:
        sql_parts.append(
            f"""
            DELETE FROM dss.route_stores
            WHERE route_id IN ({','.join(f"{lit(stable_uuid(f'route:{route_id}'))}::uuid" for route_id in route_ids)});
            INSERT INTO dss.delivery_routes
                (route_id, route_code, route_name, delivery_day, color_hex)
            VALUES {','.join(route_values)}
            ON CONFLICT (route_code) DO UPDATE SET
                route_name = EXCLUDED.route_name,
                delivery_day = EXCLUDED.delivery_day,
                color_hex = EXCLUDED.color_hex;
            """
        )
    for chunk in values_sql(route_store_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.route_stores (route_id, store_id, sequence_no)
            VALUES {chunk}
            ON CONFLICT (route_id, store_id) DO UPDATE SET sequence_no = EXCLUDED.sequence_no;
            """
        )

    sql_parts.append(
        f"""
        INSERT INTO dss.planning_scenarios
            (scenario_id, scenario_code, scenario_name, description, status, source_name)
        VALUES (
            {lit(scenario_id)}::uuid, {lit(scenario_code)}, {lit(scenario_name)},
            {lit(f'Imported from {workbook_path.name} into PostgreSQL')}, 'active', {lit(source_name)}
        );
        """
    )

    period_values = []
    for index, week_number in enumerate(periods, start=1):
        period_values.append(
            "("
            f"{lit(stable_uuid(f'period:{scenario_code}:{index}'))}::uuid, "
            f"{lit(scenario_id)}::uuid, {index}, {lit(f'W{index}')}, NULL, NULL"
            ")"
        )
    sql_parts.append(
        f"""
        INSERT INTO dss.planning_periods
            (period_id, scenario_id, sequence_no, period_code, start_date, end_date)
        VALUES {','.join(period_values)};
        """
    )

    wc_capacity_values = []
    for work_center in dataset["work_centers"]:
        work_center_code = work_center["id"]
        work_center_uuid = stable_uuid(f"wc:{work_center_code}")
        available_values = dataset["bol_rccp"]["available_time_by_wc"].get(work_center["id"]) or [work_center["capacity_minutes"]] * len(periods)
        for index, available in enumerate(available_values[: len(periods)], start=1):
            capacity_uuid = stable_uuid(f"capacity:{work_center_code}:{index}")
            period_uuid = stable_uuid(f"period:{scenario_code}:{index}")
            wc_capacity_values.append(
                "("
                f"{lit(capacity_uuid)}::uuid, "
                f"{lit(work_center_uuid)}::uuid, "
                f"{lit(period_uuid)}::uuid, "
                f"{num(available)}, 'imported'"
                ")"
            )
    for chunk in values_sql(wc_capacity_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.work_center_period_capacity
                (capacity_id, work_center_id, period_id, available_minutes, capacity_reason)
            VALUES {chunk}
            ON CONFLICT (work_center_id, period_id) DO UPDATE SET
                available_minutes = EXCLUDED.available_minutes,
                capacity_reason = EXCLUDED.capacity_reason;
            """
        )

    mps_values = []
    demand_values = []
    for product in dataset["products"]:
        product_code = product["id"]
        for index, quantity in enumerate(product["weekly_plan"][: len(periods)], start=1):
            item_id = stable_uuid(f"item:{product_code}")
            period_id = stable_uuid(f"period:{scenario_code}:{index}")
            mps_values.append(
                "("
                f"{lit(stable_uuid(f'mps:{product_code}:{index}'))}::uuid, "
                f"{lit(scenario_id)}::uuid, {lit(item_id)}::uuid, {lit(period_id)}::uuid, "
                f"{num(quantity)}, 0, {num(quantity)}, 0, 0, 'imported'"
                ")"
            )

    forecast_rows = dataset.get("forecast", {}).get("rows") or [
        {
            "id": product["id"],
            "values": product["weekly_plan"],
        }
        for product in dataset["products"]
    ]
    for forecast_row in forecast_rows:
        forecast_code = forecast_row["id"]
        forecast_values = forecast_row.get("values", [])
        for index in range(len(periods)):
            quantity = forecast_values[index] if index < len(forecast_values) else 0
            item_id = stable_uuid(f"item:{forecast_code}")
            period_id = stable_uuid(f"period:{scenario_code}:{index + 1}")
            demand_values.append(
                "("
                f"{lit(stable_uuid(f'demand:{forecast_code}:{index + 1}'))}::uuid, "
                f"{lit(scenario_id)}::uuid, {lit(item_id)}::uuid, {lit(period_id)}::uuid, "
                f"{num(quantity)}, {num(quantity)}, 'imported'"
                ")"
            )
    for table, columns, rows in [
        (
            "mps_lines",
            "(mps_line_id, scenario_id, item_id, period_id, gross_demand_qty, scheduled_receipt_qty, mps_receipt_qty, projected_available_qty, available_to_promise_qty, notes)",
            mps_values,
        ),
        (
            "demand_plans",
            "(demand_plan_id, scenario_id, item_id, period_id, forecast_qty, customer_order_qty, source)",
            demand_values,
        ),
    ]:
        for chunk in values_sql(rows):
            sql_parts.append(
                f"""
                INSERT INTO dss.{table} {columns}
                VALUES {chunk};
                """
            )

    mrp_values = []
    for item in dataset["mrp"]["items"]:
        code = item.get("code") or item.get("id")
        if not code:
            continue
        for index in range(len(periods)):
            period_no = index + 1
            mrp_values.append(
                "("
                f"{lit(stable_uuid(f'mrp:{code}:{period_no}'))}::uuid, "
                f"{lit(scenario_id)}::uuid, {lit(stable_uuid(f'item:{code}'))}::uuid, "
                f"{lit(stable_uuid(f'period:{scenario_code}:{period_no}'))}::uuid, "
                f"{num(item['gross_requirement_values'][index])}, "
                f"{num(item['scheduled_receipt_values'][index])}, "
                f"{num(item['projected_on_hand_values'][index])}, "
                f"{num(item['net_requirement_values'][index])}, "
                f"{num(item['planned_order_receipt_values'][index])}, "
                f"{num(item['planned_order_release_values'][index])}, 0"
                ")"
            )
    for chunk in values_sql(mrp_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.mrp_lines
                (mrp_line_id, scenario_id, item_id, period_id, gross_requirement_qty,
                 scheduled_receipt_qty, projected_on_hand_qty, net_requirement_qty,
                 planned_order_receipt_qty, planned_order_release_qty, past_due_release_qty)
            VALUES {chunk};
            """
        )

    rccp_values = []
    for work_center in dataset["work_centers"]:
        work_center_code = work_center["id"]
        work_center_uuid = stable_uuid(f"wc:{work_center_code}")
        loads = dataset["bol_rccp"]["loads_by_wc"].get(work_center["id"], [0] * len(periods))
        available_values = dataset["bol_rccp"]["available_time_by_wc"].get(work_center["id"], [work_center["capacity_minutes"]] * len(periods))
        for index in range(len(periods)):
            period_no = index + 1
            period_uuid = stable_uuid(f"period:{scenario_code}:{period_no}")
            required = float(loads[index] if index < len(loads) else 0)
            available = float(available_values[index] if index < len(available_values) else work_center["capacity_minutes"])
            utilization = (required / available * 100) if available else 0
            rccp_values.append(
                "("
                f"{lit(stable_uuid(f'rccp:{work_center_code}:{period_no}'))}::uuid, "
                f"{lit(scenario_id)}::uuid, {lit(work_center_uuid)}::uuid, "
                f"{lit(period_uuid)}::uuid, "
                f"{num(required)}, {num(available)}, {num(utilization)}, "
                f"{num(max(0, required - available))}, {'true' if required > available else 'false'}"
                ")"
            )
    for chunk in values_sql(rccp_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.rccp_lines
                (rccp_line_id, scenario_id, work_center_id, period_id, required_minutes,
                 available_minutes, utilization_pct, overload_minutes, is_overload)
            VALUES {chunk};
            """
        )

    routing_values = []
    for product_code, operations in dataset["routing_by_product"].items():
        for index, operation in enumerate(operations, start=1):
            operation_wc_uuid = stable_uuid(f"wc:{operation['work_center_id']}")
            routing_values.append(
                "("
                f"{lit(stable_uuid(f'routeop:{product_code}:{index}'))}::uuid, "
                f"{lit(stable_uuid(f'item:{product_code}'))}::uuid, "
                f"{lit(operation_wc_uuid)}::uuid, "
                f"{index}, {lit(operation.get('description') or operation['work_center_id'])}, "
                f"{num(operation.get('setup_minutes'))}, {num(operation.get('run_minutes'))}, 0, true"
                ")"
            )
    for chunk in values_sql(routing_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.routing_operations
                (routing_operation_id, item_id, work_center_id, operation_no, operation_name,
                 setup_minutes, run_minutes_per_unit, transfer_minutes, is_active)
            VALUES {chunk}
            ON CONFLICT (item_id, operation_no) DO UPDATE SET
                work_center_id = EXCLUDED.work_center_id,
                operation_name = EXCLUDED.operation_name,
                setup_minutes = EXCLUDED.setup_minutes,
                run_minutes_per_unit = EXCLUDED.run_minutes_per_unit,
                is_active = true;
            """
        )

    crp_detail: dict[tuple[str, str, int], dict[str, float]] = {}
    for row_type, value_key in [("run", "run_minutes"), ("setup", "setup_minutes")]:
        for row in dataset["crp"][f"{row_type}_rows"]:
            item_code = row.get("item_code")
            work_center_id = row.get("work_center_id")
            if not item_code or not work_center_id or item_code not in item_catalog:
                continue
            for index, value in enumerate(row.get("values", [])[: len(periods)], start=1):
                target = crp_detail.setdefault(
                    (work_center_id, item_code, index),
                    {"run_minutes": 0.0, "setup_minutes": 0.0},
                )
                target[value_key] += float(value or 0)

    crp_values = []
    crp_available_by_wc = dataset["crp"].get("available_time_by_wc", {})
    for (work_center_id, item_code, period_no), detail in crp_detail.items():
        required = detail["run_minutes"] + detail["setup_minutes"]
        if required <= 0:
            continue
        fallback_available = next((wc["capacity_minutes"] for wc in dataset["work_centers"] if wc["id"] == work_center_id), 0)
        available_values = crp_available_by_wc.get(work_center_id, [])
        available = float(
            available_values[period_no - 1]
            if period_no - 1 < len(available_values) and available_values[period_no - 1]
            else fallback_available
        )
        utilization = (required / available * 100) if available else 0
        routing_operation_id = (
            f"{lit(stable_uuid(f'routeop:{item_code}:1'))}::uuid"
            if item_code in product_codes
            else "NULL"
        )
        crp_values.append(
            "("
            f"{lit(stable_uuid(f'crp:{work_center_id}:{item_code}:{period_no}'))}::uuid, "
            f"{lit(scenario_id)}::uuid, {routing_operation_id}, "
            f"{lit(stable_uuid(f'wc:{work_center_id}'))}::uuid, "
            f"{lit(stable_uuid(f'item:{item_code}'))}::uuid, "
            f"{lit(stable_uuid(f'period:{scenario_code}:{period_no}'))}::uuid, "
            f"0, {num(detail['setup_minutes'])}, {num(detail['run_minutes'])}, "
            f"{num(required)}, {num(available)}, {num(utilization)}"
            ")"
        )
    for chunk in values_sql(crp_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.crp_lines
                (crp_line_id, scenario_id, routing_operation_id, work_center_id, item_id, period_id,
                 order_qty, setup_minutes, run_minutes, required_minutes, available_minutes, utilization_pct)
            VALUES {chunk};
            """
        )

    schedule_groups: dict[tuple[str, int], dict[str, Any]] = {}
    for row in dataset.get("production_schedule", {}).get("rows", []):
        product_code = row.get("product_id")
        period_no = int(row.get("period") or 0)
        if not product_code or product_code not in item_catalog or period_no <= 0 or period_no > len(periods):
            continue

        group = schedule_groups.setdefault(
            (product_code, period_no),
            {
                "product_id": product_code,
                "product_name": row.get("product_name") or product_code,
                "period": period_no,
                "quantity": row.get("quantity") or 0,
                "source_sheet": dataset.get("production_schedule", {}).get("source_sheet") or "Forward Scheduling",
                "operations": [],
            },
        )
        group["quantity"] = row.get("quantity") or group["quantity"]
        group["operations"].append(
            {
                "operation_no": row.get("operation_no"),
                "level": row.get("level") or "",
                "work_center_id": row.get("work_center_id") or "",
                "work_center_name": row.get("work_center_name") or "",
                "operation_name": row.get("operation_name") or "",
                "setup_minutes": row.get("setup_minutes") or 0,
                "run_minutes": row.get("run_minutes") or 0,
                "duration_minutes": row.get("duration_minutes") or 0,
                "duration_hours": row.get("duration_hours") or 0,
                "start_hour": row.get("start_hour") or 0,
                "finish_hour": row.get("finish_hour") or 0,
                "status_label": row.get("status_label") or "",
            }
        )

    schedule_values = []
    for (product_code, period_no), group in sorted(schedule_groups.items()):
        operations = group["operations"]
        max_finish_hour = max((float(operation.get("finish_hour") or 0) for operation in operations), default=0.0)
        total_duration_minutes = sum(float(operation.get("duration_minutes") or 0) for operation in operations)
        capacity_status = "overload" if max_finish_hour > 16 else "normal"
        notes = {
            **group,
            "max_finish_hour": round(max_finish_hour, 6),
            "total_duration_minutes": round(total_duration_minutes, 6),
        }
        schedule_values.append(
            "("
            f"{lit(stable_uuid(f'schedule:{product_code}:{period_no}'))}::uuid, "
            f"{lit(scenario_id)}::uuid, "
            f"{lit(stable_uuid(f'item:{product_code}'))}::uuid, "
            f"{lit(stable_uuid(f'period:{scenario_code}:{period_no}'))}::uuid, "
            f"NULL, {num(group.get('quantity'))}, {lit(capacity_status)}, "
            f"{lit(json.dumps(notes, ensure_ascii=False))}"
            ")"
        )
    for chunk in values_sql(schedule_values):
        sql_parts.append(
            f"""
            INSERT INTO dss.production_schedule_lines
                (schedule_line_id, scenario_id, item_id, period_id, route_id,
                 planned_qty, capacity_status, notes)
            VALUES {chunk};
            """
        )

    forecast_values = []
    for row in sales_frame.itertuples(index=False):
        forecast_values.append(
            "("
            f"{lit(row.tanggal.date().isoformat())}::date, {lit(row.id_toko)}, {lit(row.id_product)}, "
            f"{num(row.quantity_laku)}, {num(row.harga)}, {num(row.total_penjualan)}, "
            f"{lit(row.nama_toko)}, {lit(row.nama_rute)}, {lit(row.id_rute)}"
            ")"
        )
    for chunk in values_sql(forecast_values, chunk_size=1000):
        sql_parts.append(
            f"""
            INSERT INTO dss.forecast_sales_history
                (tanggal, id_toko, id_product, quantity_laku, harga, total_penjualan,
                 nama_toko, nama_rute, id_rute)
            VALUES {chunk};
            """
        )

    sql_parts.append(
        f"""
        INSERT INTO dss.workbook_imports
            (import_id, scenario_id, file_name, file_path, file_size_bytes, import_status, message)
        VALUES (
            {lit(stable_uuid('import:default'))}::uuid, {lit(scenario_id)}::uuid,
            {lit(workbook_path.name)}, {lit(str(workbook_path))}, {workbook_path.stat().st_size},
            'success', 'Imported once into PostgreSQL; runtime no longer reads Excel.'
        );
        COMMIT;
        """
    )

    run_script("\n".join(sql_parts), timeout=240)
    return {
        "scenario_code": scenario_code,
        "periods": len(periods),
        "products": len(dataset["products"]),
        "items": len(item_catalog),
        "work_centers": len(dataset["work_centers"]),
        "routes": len(dataset["routes"]),
        "stores": len(dataset["stores"]),
        "forecast_rows": len(demand_values),
        "schedule_rows": len(schedule_values),
        "sales_rows": len(sales_frame),
    }


if __name__ == "__main__":
    import sys

    result = seed_postgres_from_workbook(sys.argv[1] if len(sys.argv) > 1 else None)
    print(result)
