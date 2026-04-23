from __future__ import annotations

from statistics import mean
from typing import Any, Callable

from .workbook_loader import get_dataset, list_available_workbooks


MRP_CATEGORY_LABELS = {
    "final_product": "Produk Final",
    "intermediate": "Semi-finished",
    "raw_material": "Bahan Baku",
}

MRP_CATEGORY_ORDER = ["raw_material", "intermediate", "final_product"]


def parse_percent_label(value: Any) -> float:
    text = str(value or "").replace("%", "").strip()
    try:
        percent = float(text)
    except ValueError:
        percent = 100.0
    return max(0.0, min(percent, 100.0))


def build_mps(dataset: dict[str, Any], periods: int) -> dict[str, Any]:
    period_rows: list[dict[str, Any]] = []
    product_rows: list[dict[str, Any]] = []

    for week_index in range(periods):
        period_row = {
            "week": week_index + 1,
            "week_number": dataset["week_numbers"][week_index],
            "period": f"W{week_index + 1}",
            "total": 0,
        }
        for product in dataset["products"]:
            quantity = product["weekly_plan"][week_index]
            period_row[product["id"]] = quantity
            period_row["total"] += quantity
        period_rows.append(period_row)

    for product in dataset["products"]:
        values = product["weekly_plan"][:periods]
        product_rows.append(
            {
                "id": product["id"],
                "name": product["name"],
                "family_name": product["family_name"],
                "color": product["color"],
                "values": values,
                "total": sum(values),
            }
        )

    return {
        "periods": period_rows,
        "rows": product_rows,
        "total_production": sum(row["total"] for row in period_rows),
    }


def build_capacity_summary(
    *,
    work_centers: list[dict[str, Any]],
    wc_loads: dict[str, list[float]],
    periods: int,
    week_numbers: list[int],
    available_time_values_resolver: Callable[[dict[str, Any]], list[float]],
    planning_factor_resolver: Callable[[dict[str, Any]], float],
) -> dict[str, Any]:
    work_center_rows: list[dict[str, Any]] = []

    for work_center in work_centers:
        raw_load_values = wc_loads.get(work_center["id"], [0.0] * periods)[:periods]
        load_values = [round(value, 2) for value in raw_load_values]
        available_time_values = [
            round(value, 2)
            for value in available_time_values_resolver(work_center)[:periods]
        ]
        if len(available_time_values) < periods:
            available_time_values.extend([0.0] * (periods - len(available_time_values)))
        available_time_minutes = round(mean(available_time_values), 2) if available_time_values else 0.0
        utilization_values = [
            round((load / available_time_values[index]) * 100, 1) if available_time_values[index] else 0.0
            for index, load in enumerate(load_values)
        ]
        peak_index = max(range(periods), key=lambda index: utilization_values[index]) if utilization_values else 0

        work_center_rows.append(
            {
                **work_center,
                "planning_factor_pct": round(planning_factor_resolver(work_center), 1),
                "available_time_minutes": available_time_minutes,
                "available_time_values": available_time_values,
                "load_values": load_values,
                "utilization_values": utilization_values,
                "average_utilization_pct": round(mean(utilization_values), 1) if utilization_values else 0.0,
                "peak_utilization_pct": utilization_values[peak_index] if utilization_values else 0.0,
                "peak_period": f"W{peak_index + 1}" if utilization_values else "-",
            }
        )

    total_capacity_minutes = round(sum(row["capacity_minutes"] for row in work_center_rows), 2)

    period_rows: list[dict[str, Any]] = []
    for week_index in range(periods):
        row = {
            "week": week_index + 1,
            "week_number": week_numbers[week_index],
            "period": f"W{week_index + 1}",
            "total_load_minutes": 0.0,
            "total_available_minutes": 0.0,
            "total_capacity_minutes": total_capacity_minutes,
        }
        bottleneck: dict[str, Any] | None = None

        for work_center in work_center_rows:
            load = work_center["load_values"][week_index]
            available = work_center["available_time_values"][week_index]
            utilization = work_center["utilization_values"][week_index]
            row[work_center["id"]] = utilization
            row[f"{work_center['id']}_load"] = load
            row[f"{work_center['id']}_available"] = available
            row["total_load_minutes"] += load
            row["total_available_minutes"] += available

            candidate = {
                "id": work_center["id"],
                "name": work_center["name"],
                "load_minutes": load,
                "available_time_minutes": available,
                "capacity_minutes": work_center["capacity_minutes"],
                "utilization_pct": utilization,
            }
            if bottleneck is None or candidate["utilization_pct"] > bottleneck["utilization_pct"]:
                bottleneck = candidate

        row["total_load_minutes"] = round(row["total_load_minutes"], 2)
        row["total_available_minutes"] = round(row["total_available_minutes"], 2)
        row["total_utilization_pct"] = (
            round((row["total_load_minutes"] / row["total_available_minutes"]) * 100, 1)
            if row["total_available_minutes"]
            else 0.0
        )
        row["bottleneck"] = bottleneck or {}
        row["bottleneck_utilization_pct"] = row["bottleneck"].get("utilization_pct", 0.0)
        period_rows.append(row)

    total_available_minutes = round(mean(row["total_available_minutes"] for row in period_rows), 2) if period_rows else 0.0

    return {
        "periods": period_rows,
        "work_centers": work_center_rows,
        "total_available_minutes": total_available_minutes,
        "total_capacity_minutes": total_capacity_minutes,
    }


def build_rccp(dataset: dict[str, Any], periods: int) -> dict[str, Any]:
    bol_rccp = dataset["bol_rccp"]
    active_work_center_ids = bol_rccp["work_center_order"][:]
    work_centers: list[dict[str, Any]] = []

    for work_center_id in active_work_center_ids:
        work_center = dataset["work_center_lookup"].get(work_center_id)
        if work_center is None:
            work_center = {
                "id": work_center_id,
                "name": work_center_id,
                "units": 0,
                "utilization_label": "",
                "queue_days": 0.0,
                "hours_per_day": 0.0,
                "capacity_hours": 0.0,
                "capacity_minutes": 0.0,
                "notes": "",
            }
        work_centers.append(work_center)

    wc_loads = {
        work_center_id: bol_rccp["loads_by_wc"].get(work_center_id, [0.0] * periods)[:periods]
        for work_center_id in active_work_center_ids
    }
    available_time_lookup = {
        work_center_id: bol_rccp["available_time_by_wc"].get(work_center_id, [])[:periods]
        for work_center_id in active_work_center_ids
    }
    available_fallback_values = next(
        (values[:periods] for values in bol_rccp["available_time_by_wc"].values() if values),
        [],
    )

    summary = build_capacity_summary(
        work_centers=work_centers,
        wc_loads=wc_loads,
        periods=periods,
        week_numbers=dataset["week_numbers"],
        available_time_values_resolver=lambda work_center: (
            available_time_lookup.get(work_center["id"])
            or available_fallback_values
            or [work_center["capacity_minutes"]] * periods
        ),
        planning_factor_resolver=lambda work_center: (
            (
                (mean(available_time_lookup.get(work_center["id"]) or available_fallback_values) / work_center["capacity_minutes"]) * 100
            )
            if work_center["capacity_minutes"] and (available_time_lookup.get(work_center["id"]) or available_fallback_values)
            else parse_percent_label(work_center["utilization_label"])
        ),
    )

    return {
        **summary,
        "active_work_center_ids": active_work_center_ids,
        "product_rows": [],
        "policy": 'RCCP mengikuti load mingguan pada sheet visible "BOL + RCCP". Available time juga memakai blok RCCP pada sheet yang sama.',
    }


def build_crp(dataset: dict[str, Any], periods: int) -> dict[str, Any]:
    work_centers = dataset["work_centers"]
    crp = dataset["crp"]
    wc_loads = {
        work_center["id"]: crp["totals_by_wc"].get(work_center["id"], {}).get("values", [0.0] * periods)[:periods]
        for work_center in work_centers
    }
    detail_rows = [
        {
            **row,
            "values": row["values"][:periods],
        }
        for row in [*crp["run_rows"], *crp["setup_rows"]]
    ]

    summary = build_capacity_summary(
        work_centers=work_centers,
        wc_loads=wc_loads,
        periods=periods,
        week_numbers=dataset["week_numbers"],
        available_time_values_resolver=lambda work_center: [work_center["capacity_minutes"]] * periods,
        planning_factor_resolver=lambda work_center: 100.0,
    )

    return {
        **summary,
        "detail_rows": detail_rows,
        "policy": 'CRP memakai total kebutuhan kapasitas dari sheet visible "CRP". Available time = capacity master WC.',
    }


def summarize_mrp_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "code": item["code"],
        "name": item["name"],
        "label": item["label"],
        "category": item["category"],
        "category_label": MRP_CATEGORY_LABELS.get(item["category"], item["category"]),
        "level": item["level"],
        "lot_size": item["lot_size"],
        "lead_time": item["lead_time"],
        "product_id": item["product_id"],
        "color": item["color"],
        "total_gross_requirement": item["total_gross_requirement"],
        "total_scheduled_receipt": item["total_scheduled_receipt"],
        "total_projected_on_hand": item["total_projected_on_hand"],
        "total_net_requirement": item["total_net_requirement"],
        "total_planned_order_receipt": item["total_planned_order_receipt"],
        "total_planned_order_release": item["total_planned_order_release"],
    }


def build_mrp(dataset: dict[str, Any], selected_item_id: str | None, periods: int) -> dict[str, Any]:
    mrp_data = dataset["mrp"]
    all_items = [summarize_mrp_item(item) for item in mrp_data["items"]]
    items_by_category = {
        key: [summarize_mrp_item(item) for item in mrp_data["by_category"].get(key, [])]
        for key in MRP_CATEGORY_ORDER
    }
    categories = [
        {
            "key": key,
            "label": MRP_CATEGORY_LABELS[key],
            "count": len(items_by_category[key]),
        }
        for key in MRP_CATEGORY_ORDER
    ]

    selectable_items = items_by_category["raw_material"] or all_items
    selectable_lookup = {item["id"]: item for item in all_items}
    if selectable_items and selected_item_id not in selectable_lookup:
        selected_item_id = selectable_items[0]["id"]
    selected_item = selectable_lookup.get(selected_item_id) if selected_item_id else None
    selected_item_source = mrp_data["item_lookup"].get(selected_item_id) if selected_item_id else None

    detail_rows: list[dict[str, Any]] = []
    if selected_item_source is not None:
        for week_index in range(periods):
            detail_rows.append(
                {
                    "week": week_index + 1,
                    "week_number": dataset["week_numbers"][week_index],
                    "period": f"W{week_index + 1}",
                    "gross_requirement": selected_item_source["gross_requirement_values"][week_index],
                    "scheduled_receipt": selected_item_source["scheduled_receipt_values"][week_index],
                    "projected_on_hand": selected_item_source["projected_on_hand_values"][week_index],
                    "net_requirement": selected_item_source["net_requirement_values"][week_index],
                    "planned_order_receipt": selected_item_source["planned_order_receipt_values"][week_index],
                    "planned_order_release": selected_item_source["planned_order_release_values"][week_index],
                }
            )

    return {
        "categories": categories,
        "items": all_items,
        "items_by_category": items_by_category,
        "selected_category": selected_item["category"] if selected_item else "raw_material",
        "selected_item": selected_item,
        "periods": detail_rows,
        "policy": 'Nilai MRP mengikuti sheet visible "MRP"; backend tidak membaca sheet hidden secara langsung.',
    }


def build_routes(dataset: dict[str, Any]) -> dict[str, Any]:
    return {
        "routes": dataset["routes"],
        "stores": dataset["stores"],
        "total_stores": len(dataset["stores"]),
    }


def build_dashboard(
    mps: dict[str, Any],
    crp: dict[str, Any],
    routes: dict[str, Any],
    mrp: dict[str, Any],
    rccp: dict[str, Any],
) -> dict[str, Any]:
    peak_capacity = max(
        crp["periods"],
        key=lambda row: row["bottleneck_utilization_pct"],
        default=None,
    )
    peak_rccp = max(
        rccp["periods"],
        key=lambda row: row["bottleneck_utilization_pct"],
        default=None,
    )
    total_production = mps["total_production"]

    distribution = []
    for product_row in mps["rows"]:
        share_pct = round((product_row["total"] / total_production) * 100, 1) if total_production else 0.0
        distribution.append(
            {
                "id": product_row["id"],
                "name": product_row["name"],
                "color": product_row["color"],
                "total": product_row["total"],
                "share_pct": share_pct,
            }
        )

    return {
        "total_production": total_production,
        "average_capacity_utilization": round(
            mean(row["total_utilization_pct"] for row in crp["periods"]),
            1,
        )
        if crp["periods"]
        else 0.0,
        "average_rccp_utilization": round(
            mean(row["total_utilization_pct"] for row in rccp["periods"]),
            1,
        )
        if rccp["periods"]
        else 0.0,
        "average_crp_utilization": round(
            mean(row["total_utilization_pct"] for row in crp["periods"]),
            1,
        )
        if crp["periods"]
        else 0.0,
        "peak_load": peak_capacity,
        "peak_rccp_load": peak_rccp,
        "active_routes": len(routes["routes"]),
        "active_stores": routes["total_stores"],
        "distribution": distribution,
        "mrp_item_count": len(mrp["items"]),
        "mrp_raw_material_count": len(mrp["items_by_category"]["raw_material"]),
        "mrp_intermediate_count": len(mrp["items_by_category"]["intermediate"]),
        "mrp_final_count": len(mrp["items_by_category"]["final_product"]),
    }


def build_schedule(mps: dict[str, Any], crp: dict[str, Any], routes: dict[str, Any]) -> dict[str, Any]:
    weeks = []

    for index, period in enumerate(mps["periods"]):
        capacity_row = crp["periods"][index]
        products = [
            {
                "id": product_row["id"],
                "name": product_row["name"],
                "color": product_row["color"],
                "quantity": period[product_row["id"]],
            }
            for product_row in mps["rows"]
            if period[product_row["id"]] > 0
        ]

        bottleneck = capacity_row["bottleneck"]
        if bottleneck.get("utilization_pct", 0) > 100:
            status = {"key": "overload", "label": "Overload", "color": "#ef4444"}
        elif bottleneck.get("utilization_pct", 0) > 80:
            status = {"key": "high", "label": "Tinggi", "color": "#f59e0b"}
        else:
            status = {"key": "normal", "label": "Normal", "color": "#22c55e"}

        weeks.append(
            {
                "week": period["week"],
                "week_number": period["week_number"],
                "period": period["period"],
                "total": period["total"],
                "products": products,
                "status": status,
                "bottleneck": bottleneck,
                "routes": [
                    {
                        "id": route["id"],
                        "name": route["name"],
                        "day": route["day"],
                        "store_count": route["store_count"],
                    }
                    for route in routes["routes"]
                ],
            }
        )

    return {"weeks": weeks}


def build_dss_payload(
    periods: int = 20,
    selected_product_id: str | None = None,
    selected_component_id: str | None = None,
    workbook: str | None = None,
) -> dict[str, Any]:
    dataset = get_dataset(workbook)
    periods = max(1, min(periods, dataset["available_periods"]))

    products = dataset["products"]
    if not products:
        raise ValueError("Tidak ada data produk yang berhasil dibaca dari workbook.")

    if selected_product_id not in dataset["product_lookup"]:
        selected_product_id = products[0]["id"]

    mps = build_mps(dataset, periods)
    rccp = build_rccp(dataset, periods)
    crp = build_crp(dataset, periods)
    routes = build_routes(dataset)
    mrp = build_mrp(dataset, selected_component_id, periods)
    dashboard = build_dashboard(mps, crp, routes, mrp, rccp)
    schedule = build_schedule(mps, crp, routes)

    return {
        "meta": {
            "source_name": dataset["source_name"],
            "source_path": dataset["source_path"],
            "visible_sheets": dataset["visible_sheets"],
            "available_periods": dataset["available_periods"],
            "periods": periods,
            "selected_product_id": selected_product_id,
            "selected_component_id": mrp["selected_item"]["id"] if mrp["selected_item"] else None,
        },
        "files": list_available_workbooks(),
        "products": [
            {
                "id": product["id"],
                "name": product["name"],
                "family_name": product["family_name"],
                "color": product["color"],
                "total_selected_periods": sum(product["weekly_plan"][:periods]),
            }
            for product in products
        ],
        "dashboard": dashboard,
        "mps": mps,
        "mrp": mrp,
        "rccp": rccp,
        "crp": crp,
        "capacity": crp,
        "schedule": schedule,
        "routes": routes,
    }
