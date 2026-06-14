from __future__ import annotations

import json
from pathlib import Path
from statistics import mean
from typing import Any

from .database_service import get_database_config, run_psql_query, sql_identifier, sql_literal


PRODUCT_COLORS = [
    "#f97316",
    "#38bdf8",
    "#22c55e",
    "#a855f7",
    "#f43f5e",
    "#eab308",
    "#14b8a6",
    "#6366f1",
    "#ec4899",
]

ROUTE_COLORS = ["#f97316", "#38bdf8", "#22c55e", "#a855f7", "#f43f5e", "#eab308"]

MRP_CATEGORY_ORDER = ["raw_material", "intermediate", "final_product"]

RUNTIME_SOURCE_TABLES = [
    "dss.planning_scenarios",
    "dss.planning_periods",
    "dss.items",
    "dss.demand_plans",
    "dss.mps_lines",
    "dss.mrp_lines",
    "dss.rccp_lines",
    "dss.crp_lines",
    "dss.production_schedule_lines",
    "dss.bom_versions",
    "dss.bom_lines",
    "dss.delivery_routes",
    "dss.stores",
]


def to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def to_int(value: Any) -> int:
    return int(round(to_float(value)))


def run_json_query(sql: str, timeout: int = 30) -> Any:
    config = get_database_config()
    if not config["password"]:
        raise ValueError("Password database belum dikonfigurasi di DSS_DB_PASSWORD atau PGPASSWORD.")
    if not Path(config["psql_path"]).exists():
        raise ValueError(f"psql tidak ditemukan di {config['psql_path']}.")
    result = run_psql_query(config, sql, timeout=timeout)
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "Query PostgreSQL gagal.")
    payload = result.stdout.strip()
    if not payload:
        return None
    return json.loads(payload)


def fetch_rows(sql_body: str, timeout: int = 30) -> list[dict[str, Any]]:
    sql = f"""
        SELECT COALESCE(json_agg(row_to_json(source_rows)), '[]'::json)::text
        FROM (
            {sql_body}
        ) source_rows;
    """
    return run_json_query(sql, timeout=timeout) or []


def fetch_one(sql_body: str, timeout: int = 30) -> dict[str, Any] | None:
    sql = f"""
        SELECT row_to_json(source_rows)::text
        FROM (
            {sql_body}
        ) source_rows;
    """
    return run_json_query(sql, timeout=timeout)


def get_active_scenario() -> dict[str, Any]:
    config = get_database_config()
    schema = sql_identifier(config["schema"])
    scenario_code = sql_literal(config.get("scenario_code", "") or "default")
    preferred = fetch_one(
        f"""
        SELECT scenario_id::text, scenario_code, scenario_name, source_name
        FROM {schema}.planning_scenarios
        WHERE scenario_code = {scenario_code}
        LIMIT 1
        """
    )
    if preferred:
        return preferred

    fallback = fetch_one(
        f"""
        SELECT scenario_id::text, scenario_code, scenario_name, source_name
        FROM {schema}.planning_scenarios
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        """
    )
    if not fallback:
        raise ValueError("Database PostgreSQL belum memiliki planning scenario. Jalankan importer database terlebih dahulu.")
    return fallback


def list_database_sources() -> list[dict[str, Any]]:
    config = get_database_config()
    schema = sql_identifier(config["schema"])
    rows = fetch_rows(
        f"""
        SELECT
            scenario_code AS name,
            scenario_name AS label,
            COALESCE(source_name, 'PostgreSQL') AS source,
            status,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM {schema}.planning_scenarios
        ORDER BY updated_at DESC, created_at DESC
        """
    )
    return rows


def build_dataset_from_database() -> dict[str, Any]:
    config = get_database_config()
    schema = sql_identifier(config["schema"])
    scenario = get_active_scenario()
    scenario_id = sql_literal(scenario["scenario_id"])

    periods = fetch_rows(
        f"""
        SELECT period_id::text, sequence_no, period_code
        FROM {schema}.planning_periods
        WHERE scenario_id = {scenario_id}
        ORDER BY sequence_no
        """
    )
    if not periods:
        raise ValueError("Database PostgreSQL belum memiliki planning periods untuk scenario aktif.")

    period_ids = [row["period_id"] for row in periods]
    period_index_by_id = {period_id: index for index, period_id in enumerate(period_ids)}
    week_numbers = [int(row["sequence_no"]) for row in periods]
    available_periods = len(periods)

    product_rows = fetch_rows(
        f"""
        SELECT
            i.item_id::text,
            i.item_code,
            i.item_name,
            COALESCE(f.family_code, '') AS family_code,
            COALESCE(f.family_name, '') AS family_name,
            p.period_id::text,
            p.sequence_no,
            COALESCE(m.mps_receipt_qty, 0) AS quantity
        FROM {schema}.items i
        JOIN {schema}.mps_lines m ON m.item_id = i.item_id AND m.scenario_id = {scenario_id}
        JOIN {schema}.planning_periods p ON p.period_id = m.period_id
        LEFT JOIN {schema}.product_families f ON f.family_id = i.family_id
        WHERE i.item_type = 'final_product'
        ORDER BY i.item_code, p.sequence_no
        """
    )
    products_by_code: dict[str, dict[str, Any]] = {}
    for row in product_rows:
        product = products_by_code.setdefault(
            row["item_code"],
            {
                "id": row["item_code"],
                "name": row["item_name"],
                "family_id": row.get("family_code") or "",
                "family_name": row.get("family_name") or "",
                "price": 0,
                "color": PRODUCT_COLORS[len(products_by_code) % len(PRODUCT_COLORS)],
                "weekly_plan": [0] * available_periods,
            },
        )
        period_index = period_index_by_id.get(row["period_id"])
        if period_index is not None:
            product["weekly_plan"][period_index] = to_int(row["quantity"])
    products = list(products_by_code.values())
    product_lookup = {product["id"]: product for product in products}

    forecast_line_rows = fetch_rows(
        f"""
        SELECT
            i.item_code,
            i.item_name,
            p.period_id::text,
            p.sequence_no,
            COALESCE(d.forecast_qty, 0) AS forecast_qty,
            COALESCE(d.customer_order_qty, 0) AS customer_order_qty
        FROM {schema}.demand_plans d
        JOIN {schema}.items i ON i.item_id = d.item_id
        JOIN {schema}.planning_periods p ON p.period_id = d.period_id
        WHERE d.scenario_id = {scenario_id}
        ORDER BY i.item_code, p.sequence_no
        """
    )
    forecast_by_code: dict[str, dict[str, Any]] = {}
    for row in forecast_line_rows:
        forecast_row = forecast_by_code.setdefault(
            row["item_code"],
            {
                "id": row["item_code"],
                "name": row["item_name"],
                "color": PRODUCT_COLORS[len(forecast_by_code) % len(PRODUCT_COLORS)],
                "values": [0.0] * available_periods,
                "customer_order_values": [0.0] * available_periods,
            },
        )
        period_index = period_index_by_id.get(row["period_id"])
        if period_index is None:
            continue
        forecast_row["values"][period_index] = to_float(row["forecast_qty"])
        forecast_row["customer_order_values"][period_index] = to_float(row["customer_order_qty"])

    forecast_rows = list(forecast_by_code.values())
    for forecast_row in forecast_rows:
        forecast_row["total"] = round(sum(forecast_row["values"]), 2)
        forecast_row["total_customer_order"] = round(sum(forecast_row["customer_order_values"]), 2)

    forecast_periods = []
    for period_index, period in enumerate(periods):
        period_row = {
            "week": period_index + 1,
            "week_number": int(period["sequence_no"]),
            "period": f"W{period_index + 1}",
            "total": 0.0,
            "total_customer_order": 0.0,
        }
        for forecast_row in forecast_rows:
            forecast_value = forecast_row["values"][period_index]
            customer_order_value = forecast_row["customer_order_values"][period_index]
            period_row[forecast_row["id"]] = forecast_value
            period_row["total"] += forecast_value
            period_row["total_customer_order"] += customer_order_value
        period_row["total"] = round(period_row["total"], 2)
        period_row["total_customer_order"] = round(period_row["total_customer_order"], 2)
        forecast_periods.append(period_row)

    work_center_rows = fetch_rows(
        f"""
        SELECT
            work_center_id::text,
            work_center_code,
            work_center_name,
            units,
            hours_per_day,
            workdays_per_period,
            efficiency_pct,
            utilization_target_pct,
            queue_days,
            notes
        FROM {schema}.work_centers
        WHERE is_active
        ORDER BY work_center_code
        """
    )
    work_centers = []
    for row in work_center_rows:
        capacity_hours = (
            to_float(row["units"])
            * to_float(row["hours_per_day"])
            * to_float(row["workdays_per_period"])
            * (to_float(row["efficiency_pct"]) / 100 if row["efficiency_pct"] is not None else 1)
        )
        work_centers.append(
            {
                "id": row["work_center_code"],
                "name": row["work_center_name"],
                "uuid": row["work_center_id"],
                "units": to_float(row["units"]),
                "utilization_label": f"{to_float(row['utilization_target_pct']):.0f}%",
                "queue_days": to_float(row["queue_days"]),
                "hours_per_day": to_float(row["hours_per_day"]),
                "capacity_hours": round(capacity_hours, 2),
                "capacity_minutes": round(capacity_hours * 60, 2),
                "notes": row.get("notes") or "",
            }
        )
    work_center_lookup = {work_center["id"]: work_center for work_center in work_centers}

    routing_rows = fetch_rows(
        f"""
        SELECT
            i.item_code,
            i.item_name,
            wc.work_center_code,
            ro.operation_no,
            ro.operation_name,
            ro.setup_minutes,
            ro.run_minutes_per_unit
        FROM {schema}.routing_operations ro
        JOIN {schema}.items i ON i.item_id = ro.item_id
        JOIN {schema}.work_centers wc ON wc.work_center_id = ro.work_center_id
        WHERE ro.is_active
        ORDER BY i.item_code, ro.operation_no
        """
    )
    routing_by_product: dict[str, list[dict[str, Any]]] = {}
    routing_by_item: dict[str, list[dict[str, Any]]] = {}
    routing_entries = []
    for row in routing_rows:
        entry = {
            "item_key": row["item_code"],
            "item_code": row["item_code"],
            "item_name": row["item_name"],
            "item_label": f"{row['item_code']} {row['item_name']}",
            "level": "L0" if str(row["item_code"]).startswith("P-") else "",
            "work_center_id": row["work_center_code"],
            "setup_minutes": to_float(row["setup_minutes"]),
            "run_minutes": to_float(row["run_minutes_per_unit"]),
            "description": row.get("operation_name") or "",
        }
        routing_entries.append(entry)
        routing_by_item.setdefault(row["item_code"], []).append(entry)
        if str(row["item_code"]).startswith("P-"):
            routing_by_product.setdefault(row["item_code"], []).append(entry)

    rccp_rows = fetch_rows(
        f"""
        SELECT
            wc.work_center_code,
            p.period_id::text,
            p.sequence_no,
            r.required_minutes,
            r.available_minutes
        FROM {schema}.rccp_lines r
        JOIN {schema}.work_centers wc ON wc.work_center_id = r.work_center_id
        JOIN {schema}.planning_periods p ON p.period_id = r.period_id
        WHERE r.scenario_id = {scenario_id}
        ORDER BY wc.work_center_code, p.sequence_no
        """
    )
    rccp_loads_by_wc = {work_center["id"]: [0.0] * available_periods for work_center in work_centers}
    rccp_available_by_wc = {work_center["id"]: [work_center["capacity_minutes"]] * available_periods for work_center in work_centers}
    for row in rccp_rows:
        period_index = period_index_by_id.get(row["period_id"])
        if period_index is None:
            continue
        rccp_loads_by_wc.setdefault(row["work_center_code"], [0.0] * available_periods)[period_index] = to_float(row["required_minutes"])
        rccp_available_by_wc.setdefault(row["work_center_code"], [0.0] * available_periods)[period_index] = to_float(row["available_minutes"])

    crp_rows = fetch_rows(
        f"""
        SELECT
            wc.work_center_code,
            wc.work_center_name,
            i.item_code,
            i.item_name,
            p.period_id::text,
            p.sequence_no,
            c.setup_minutes,
            c.run_minutes,
            c.required_minutes,
            c.available_minutes
        FROM {schema}.crp_lines c
        JOIN {schema}.work_centers wc ON wc.work_center_id = c.work_center_id
        JOIN {schema}.items i ON i.item_id = c.item_id
        JOIN {schema}.planning_periods p ON p.period_id = c.period_id
        WHERE c.scenario_id = {scenario_id}
        ORDER BY wc.work_center_code, i.item_code, p.sequence_no
        """
    )
    crp_totals_by_wc = {work_center["id"]: {"values": [0.0] * available_periods} for work_center in work_centers}
    crp_available_by_wc = {work_center["id"]: [work_center["capacity_minutes"]] * available_periods for work_center in work_centers}
    crp_run_lookup: dict[tuple[str, str], dict[str, Any]] = {}
    crp_setup_lookup: dict[tuple[str, str], dict[str, Any]] = {}
    for row in crp_rows:
        period_index = period_index_by_id.get(row["period_id"])
        if period_index is None:
            continue
        work_center_code = row["work_center_code"]
        crp_totals_by_wc.setdefault(work_center_code, {"values": [0.0] * available_periods})
        crp_totals_by_wc[work_center_code]["values"][period_index] += to_float(row["required_minutes"])
        crp_available_by_wc.setdefault(work_center_code, [0.0] * available_periods)[period_index] = to_float(row["available_minutes"])

        for row_type, source_key, lookup in [
            ("run", "run_minutes", crp_run_lookup),
            ("setup", "setup_minutes", crp_setup_lookup),
        ]:
            key = (work_center_code, row["item_code"])
            detail = lookup.setdefault(
                key,
                {
                    "type": row_type,
                    "work_center_id": work_center_code,
                    "work_center_name": row["work_center_name"],
                    "item_code": row["item_code"],
                    "item_name": row["item_name"],
                    "item_label": f"{row['item_code']} — {row['item_name']}",
                    "values": [0.0] * available_periods,
                },
            )
            detail["values"][period_index] += to_float(row[source_key])

    for work_center_code, payload in crp_totals_by_wc.items():
        work_center = work_center_lookup.get(work_center_code, {})
        payload["id"] = work_center_code
        payload["name"] = work_center.get("name", work_center_code)
        payload["description"] = "Total CRP dari PostgreSQL"
        payload["total_minutes"] = round(sum(payload["values"]), 2)

    crp_run_rows = []
    crp_setup_rows = []
    for lookup, target in [(crp_run_lookup, crp_run_rows), (crp_setup_lookup, crp_setup_rows)]:
        for detail in lookup.values():
            detail["total_minutes"] = round(sum(detail["values"]), 2)
            target.append(detail)

    schedule_line_rows = fetch_rows(
        f"""
        SELECT
            s.schedule_line_id::text,
            i.item_code,
            i.item_name,
            p.period_id::text,
            p.sequence_no,
            s.planned_qty,
            s.capacity_status,
            COALESCE(s.notes, '') AS notes
        FROM {schema}.production_schedule_lines s
        JOIN {schema}.items i ON i.item_id = s.item_id
        JOIN {schema}.planning_periods p ON p.period_id = s.period_id
        WHERE s.scenario_id = {scenario_id}
        ORDER BY p.sequence_no, i.item_code
        """
    )
    production_schedule_rows = []
    for row in schedule_line_rows:
        notes_payload: dict[str, Any] = {}
        if row.get("notes"):
            try:
                notes_payload = json.loads(row["notes"])
            except (TypeError, json.JSONDecodeError):
                notes_payload = {}
        production_schedule_rows.append(
            {
                "id": row["schedule_line_id"],
                "product_id": row["item_code"],
                "product_name": row["item_name"],
                "period": to_int(row["sequence_no"]),
                "period_id": row["period_id"],
                "quantity": to_float(row["planned_qty"]),
                "capacity_status": row.get("capacity_status") or "normal",
                "source_sheet": notes_payload.get("source_sheet") or "",
                "operations": notes_payload.get("operations") or [],
                "max_finish_hour": to_float(notes_payload.get("max_finish_hour")),
                "total_duration_minutes": to_float(notes_payload.get("total_duration_minutes")),
            }
        )

    item_rows = fetch_rows(
        f"""
        SELECT
            i.item_id::text,
            i.item_code,
            i.item_name,
            i.item_type,
            COALESCE(u.code, '') AS uom_code,
            COALESCE(i.supplier_name, '') AS supplier_name,
            COALESCE(pol.lot_size, 1) AS lot_size,
            COALESCE(pol.lead_time_periods, 0) AS lead_time_periods,
            COALESCE(pol.initial_on_hand_qty, 0) AS initial_on_hand_qty,
            COALESCE(pol.safety_stock_qty, 0) AS safety_stock_qty
        FROM {schema}.items i
        LEFT JOIN {schema}.uoms u ON u.uom_id = i.uom_id
        LEFT JOIN {schema}.item_planning_policies pol ON pol.item_id = i.item_id
        WHERE i.is_active
        ORDER BY i.item_code
        """
    )
    mrp_line_rows = fetch_rows(
        f"""
        SELECT
            i.item_code,
            p.period_id::text,
            m.gross_requirement_qty,
            m.scheduled_receipt_qty,
            m.projected_on_hand_qty,
            m.net_requirement_qty,
            m.planned_order_receipt_qty,
            m.planned_order_release_qty
        FROM {schema}.mrp_lines m
        JOIN {schema}.items i ON i.item_id = m.item_id
        JOIN {schema}.planning_periods p ON p.period_id = m.period_id
        WHERE m.scenario_id = {scenario_id}
        ORDER BY i.item_code, p.sequence_no
        """
    )
    mrp_values: dict[str, dict[str, list[float]]] = {}
    for row in mrp_line_rows:
        values = mrp_values.setdefault(
            row["item_code"],
            {
                "gross_requirement_values": [0.0] * available_periods,
                "scheduled_receipt_values": [0.0] * available_periods,
                "projected_on_hand_values": [0.0] * available_periods,
                "net_requirement_values": [0.0] * available_periods,
                "planned_order_receipt_values": [0.0] * available_periods,
                "planned_order_release_values": [0.0] * available_periods,
            },
        )
        period_index = period_index_by_id.get(row["period_id"])
        if period_index is None:
            continue
        values["gross_requirement_values"][period_index] = to_float(row["gross_requirement_qty"])
        values["scheduled_receipt_values"][period_index] = to_float(row["scheduled_receipt_qty"])
        values["projected_on_hand_values"][period_index] = to_float(row["projected_on_hand_qty"])
        values["net_requirement_values"][period_index] = to_float(row["net_requirement_qty"])
        values["planned_order_receipt_values"][period_index] = to_float(row["planned_order_receipt_qty"])
        values["planned_order_release_values"][period_index] = to_float(row["planned_order_release_qty"])

    mrp_items = []
    by_category = {key: [] for key in MRP_CATEGORY_ORDER}
    for item in item_rows:
        code = item["item_code"]
        item_type = item["item_type"]
        category = item_type if item_type in by_category else ("final_product" if code in product_lookup else "raw_material")
        values = mrp_values.get(
            code,
            {
                "gross_requirement_values": [0.0] * available_periods,
                "scheduled_receipt_values": [0.0] * available_periods,
                "projected_on_hand_values": [0.0] * available_periods,
                "net_requirement_values": [0.0] * available_periods,
                "planned_order_receipt_values": [0.0] * available_periods,
                "planned_order_release_values": [0.0] * available_periods,
            },
        )
        product_match = product_lookup.get(code)
        payload = {
            "id": f"mrp-{code.lower().replace(' ', '-')}",
            "code": code,
            "name": item["item_name"],
            "label": f"{code} — {item['item_name']}",
            "category": category,
            "level": "L0" if category == "final_product" else "",
            "lot_size": to_float(item["lot_size"]),
            "lead_time": to_int(item["lead_time_periods"]),
            "product_id": product_match["id"] if product_match else "",
            "color": product_match["color"] if product_match else "",
            **values,
            "total_gross_requirement": round(sum(values["gross_requirement_values"]), 2),
            "total_scheduled_receipt": round(sum(values["scheduled_receipt_values"]), 2),
            "total_projected_on_hand": round(sum(values["projected_on_hand_values"]), 2),
            "total_net_requirement": round(sum(values["net_requirement_values"]), 2),
            "total_planned_order_receipt": round(sum(values["planned_order_receipt_values"]), 2),
            "total_planned_order_release": round(sum(values["planned_order_release_values"]), 2),
        }
        mrp_items.append(payload)
        by_category.setdefault(category, []).append(payload)

    stores_rows = fetch_rows(
        f"""
        SELECT store_id::text, store_code, store_name, location_name
        FROM {schema}.stores
        WHERE is_active
        ORDER BY store_code
        """
    )
    stores_by_uuid = {
        row["store_id"]: {
            "id": row["store_code"],
            "name": row["store_name"],
            "location": row.get("location_name") or "",
        }
        for row in stores_rows
    }

    route_rows = fetch_rows(
        f"""
        SELECT
            dr.route_id::text,
            dr.route_code,
            dr.route_name,
            dr.delivery_day,
            dr.color_hex,
            rs.store_id::text,
            rs.sequence_no
        FROM {schema}.delivery_routes dr
        LEFT JOIN {schema}.route_stores rs ON rs.route_id = dr.route_id
        ORDER BY dr.route_code, rs.sequence_no
        """
    )
    routes_by_uuid: dict[str, dict[str, Any]] = {}
    for row in route_rows:
        route = routes_by_uuid.setdefault(
            row["route_id"],
            {
                "id": row["route_code"],
                "name": row["route_name"],
                "day": row.get("delivery_day") or "",
                "color": row.get("color_hex") or ROUTE_COLORS[len(routes_by_uuid) % len(ROUTE_COLORS)],
                "stores": [],
                "store_count": 0,
            },
        )
        store = stores_by_uuid.get(row.get("store_id"))
        if store:
            route["stores"].append(store)
    routes = list(routes_by_uuid.values())
    for route in routes:
        route["store_count"] = len(route["stores"])
    stores = list(stores_by_uuid.values())

    bom_rows = fetch_rows(
        f"""
        SELECT
            parent.item_code AS product_id,
            parent.item_name AS product_name,
            component.item_code AS material_id,
            component.item_name AS material_name,
            component.item_type AS material_type,
            COALESCE(u.code, '') AS unit,
            v.version_code,
            v.description,
            b.line_no,
            b.quantity_per_parent,
            b.scrap_factor_pct,
            b.notes
        FROM {schema}.bom_versions v
        JOIN {schema}.items parent ON parent.item_id = v.parent_item_id
        JOIN {schema}.bom_lines b ON b.bom_version_id = v.bom_version_id
        JOIN {schema}.items component ON component.item_id = b.component_item_id
        LEFT JOIN {schema}.uoms u ON u.uom_id = component.uom_id
        WHERE v.is_active
        ORDER BY parent.item_code, b.line_no, component.item_code
        """
    )
    bom_entries: list[dict[str, Any]] = []
    bom_by_product: dict[str, list[dict[str, Any]]] = {}
    for row in bom_rows:
        product_id = row["product_id"]
        entry = {
            "product_id": product_id,
            "product_name": row["product_name"],
            "material_id": row["material_id"],
            "material_name": row["material_name"],
            "material_type": row.get("material_type") or "",
            "unit": row.get("unit") or "",
            "version_code": row.get("version_code") or "",
            "description": row.get("description") or "",
            "line_no": to_int(row.get("line_no")),
            "quantity_per_parent": to_float(row.get("quantity_per_parent")),
            "scrap_factor_pct": to_float(row.get("scrap_factor_pct")),
            "notes": row.get("notes") or "",
        }
        bom_entries.append(entry)
        bom_by_product.setdefault(product_id, []).append(entry)

    return {
        "source_name": scenario.get("scenario_name") or scenario.get("scenario_code") or "PostgreSQL",
        "source_path": f"PostgreSQL schema {config['schema']}",
        "data_source": "PostgreSQL",
        "source_tables": RUNTIME_SOURCE_TABLES,
        "visible_sheets": [],
        "available_periods": available_periods,
        "week_numbers": week_numbers,
        "products": products,
        "forecast": {
            "periods": forecast_periods,
            "rows": forecast_rows,
            "total": round(sum(row["total"] for row in forecast_rows), 2),
            "source": "dss.demand_plans",
        },
        "product_lookup": product_lookup,
        "components": [],
        "bom_entries": bom_entries,
        "bom_by_product": bom_by_product,
        "routing_entries": routing_entries,
        "routing_by_product": routing_by_product,
        "routing_by_item": routing_by_item,
        "work_centers": work_centers,
        "work_center_lookup": work_center_lookup,
        "mrp": {
            "items": mrp_items,
            "item_lookup": {item["id"]: item for item in mrp_items},
            "by_category": by_category,
        },
        "bol_rccp": {
            "work_center_order": [work_center["id"] for work_center in work_centers],
            "loads_by_wc": rccp_loads_by_wc,
            "available_time_by_wc": rccp_available_by_wc,
        },
        "crp": {
            "run_rows": crp_run_rows,
            "setup_rows": crp_setup_rows,
            "totals_by_wc": crp_totals_by_wc,
            "available_time_by_wc": crp_available_by_wc,
        },
        "production_schedule": {
            "rows": production_schedule_rows,
            "source": "dss.production_schedule_lines",
            "available_periods": len({row["period"] for row in production_schedule_rows}),
        },
        "routes": routes,
        "stores": stores,
    }
