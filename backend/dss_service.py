from __future__ import annotations

from statistics import mean
from typing import Any, Callable

from .postgres_dataset_loader import build_dataset_from_database, list_database_sources


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


def build_forecast(dataset: dict[str, Any], periods: int) -> dict[str, Any]:
    source = dataset.get("forecast", {})
    source_rows = source.get("rows") or []
    source_periods = source.get("periods") or []
    forecast_rows: list[dict[str, Any]] = []

    for row in source_rows:
        values = list(row.get("values", []))[:periods]
        if len(values) < periods:
            values.extend([0.0] * (periods - len(values)))
        forecast_rows.append(
            {
                "id": row.get("id") or "",
                "name": row.get("name") or row.get("id") or "",
                "color": row.get("color") or "#38bdf8",
                "values": values,
                "total": round(sum(values), 2),
                "customer_order_values": list(row.get("customer_order_values", []))[:periods],
                "total_customer_order": row.get("total_customer_order", round(sum(values), 2)),
            }
        )

    period_rows: list[dict[str, Any]] = []
    for week_index in range(periods):
        source_period = source_periods[week_index] if week_index < len(source_periods) else {}
        period_row = {
            "week": week_index + 1,
            "week_number": dataset["week_numbers"][week_index],
            "period": f"W{week_index + 1}",
            "total": 0.0,
            "total_customer_order": source_period.get("total_customer_order", 0.0),
        }
        for row in forecast_rows:
            value = row["values"][week_index] if week_index < len(row["values"]) else 0.0
            period_row[row["id"]] = value
            period_row["total"] += value
        period_row["total"] = round(period_row["total"], 2)
        period_rows.append(period_row)

    return {
        "periods": period_rows,
        "rows": forecast_rows,
        "total_forecast": round(sum(row["total"] for row in forecast_rows), 2),
        "source": source.get("source") or "dss.demand_plans",
        "policy": "Forecast dibaca dari tabel PostgreSQL dss.demand_plans hasil import Agregate Demand.",
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
        "policy": "RCCP memakai load dan available time dari sheet BOL + RCCP pada data perencanaan aktif.",
    }


def build_crp(dataset: dict[str, Any], periods: int) -> dict[str, Any]:
    work_centers = dataset["work_centers"]
    crp = dataset["crp"]
    wc_loads = {
        work_center["id"]: crp["totals_by_wc"].get(work_center["id"], {}).get("values", [0.0] * periods)[:periods]
        for work_center in work_centers
    }
    available_time_lookup = {
        work_center_id: values[:periods]
        for work_center_id, values in crp.get("available_time_by_wc", {}).items()
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
        available_time_values_resolver=lambda work_center: (
            available_time_lookup.get(work_center["id"])
            or [work_center["capacity_minutes"]] * periods
        ),
        planning_factor_resolver=lambda work_center: (
            (
                (mean(available_time_lookup[work_center["id"]]) / work_center["capacity_minutes"]) * 100
            )
            if work_center["id"] in available_time_lookup and work_center["capacity_minutes"]
            else 100.0
        ),
    )

    return {
        **summary,
        "detail_rows": detail_rows,
        "policy": "CRP memakai run time, setup time, total kebutuhan, dan available time dari data CRP aktif.",
    }


def has_mrp_material_activity(item: dict[str, Any]) -> bool:
    if item.get("category") != "raw_material":
        return True

    for key in [
        "total_gross_requirement",
        "total_net_requirement",
        "total_planned_order_receipt",
        "total_planned_order_release",
    ]:
        try:
            if abs(float(item.get(key) or 0)) > 0:
                return True
        except (TypeError, ValueError):
            continue
    return False


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
    source_items = [item for item in mrp_data["items"] if has_mrp_material_activity(item)]
    all_items = [summarize_mrp_item(item) for item in source_items]
    items_by_category = {
        key: [
            summarize_mrp_item(item)
            for item in mrp_data["by_category"].get(key, [])
            if has_mrp_material_activity(item)
        ]
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
    selected_item_source = (
        mrp_data["item_lookup"].get(selected_item_id)
        if selected_item_id and selected_item_id in selectable_lookup
        else None
    )

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
        "policy": "MRP menampilkan bahan baku yang memiliki kebutuhan dari BOM/MRP; item bahan baku bernilai 0 disembunyikan.",
    }


def build_routes(dataset: dict[str, Any]) -> dict[str, Any]:
    return {
        "routes": dataset["routes"],
        "stores": dataset["stores"],
        "total_stores": len(dataset["stores"]),
    }


def build_crp_detail_lookup(crp: dict[str, Any]) -> dict[tuple[int, str, str], dict[str, float]]:
    detail_lookup: dict[tuple[int, str, str], dict[str, float]] = {}

    for row in crp.get("detail_rows", []):
        product_id = row.get("item_code", "")
        work_center_id = row.get("work_center_id", "")
        if not product_id.startswith("P-") or not work_center_id:
            continue

        value_key = "setup_minutes" if row.get("type") == "setup" else "run_minutes"
        for period_index, value in enumerate(row.get("values", [])):
            lookup_key = (period_index, product_id, work_center_id)
            detail_lookup.setdefault(lookup_key, {"run_minutes": 0.0, "setup_minutes": 0.0})
            detail_lookup[lookup_key][value_key] += float(value or 0)

    return detail_lookup


def build_product_processing_times(
    *,
    product: dict[str, Any],
    quantity: float,
    period_index: int,
    work_centers: list[dict[str, Any]],
    crp_detail_lookup: dict[tuple[int, str, str], dict[str, float]],
    routing_by_product: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    processing_times: list[dict[str, Any]] = []

    for work_center in work_centers:
        detail = crp_detail_lookup.get(
            (period_index, product["id"], work_center["id"]),
            {"run_minutes": 0.0, "setup_minutes": 0.0},
        )
        run_minutes = float(detail.get("run_minutes", 0.0))
        setup_minutes = float(detail.get("setup_minutes", 0.0))
        processing_times.append(
            {
                "work_center_id": work_center["id"],
                "work_center_name": work_center["name"],
                "run_minutes": round(run_minutes, 2),
                "setup_minutes": round(setup_minutes, 2),
                "duration_minutes": round(run_minutes + setup_minutes, 2),
            }
        )

    if sum(row["duration_minutes"] for row in processing_times) > 0 or quantity <= 0:
        return processing_times

    fallback_by_work_center: dict[str, dict[str, float]] = {}
    for routing in routing_by_product.get(product["id"], []):
        work_center_id = routing.get("work_center_id", "")
        if not work_center_id:
            continue
        fallback_by_work_center.setdefault(work_center_id, {"run_minutes": 0.0, "setup_minutes": 0.0})
        fallback_by_work_center[work_center_id]["run_minutes"] += float(routing.get("run_minutes", 0.0)) * quantity
        fallback_by_work_center[work_center_id]["setup_minutes"] += float(routing.get("setup_minutes", 0.0))

    for row in processing_times:
        fallback = fallback_by_work_center.get(row["work_center_id"], {})
        row["run_minutes"] = round(fallback.get("run_minutes", 0.0), 2)
        row["setup_minutes"] = round(fallback.get("setup_minutes", 0.0), 2)
        row["duration_minutes"] = round(row["run_minutes"] + row["setup_minutes"], 2)

    return processing_times


def johnson_sequence(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    front = sorted(
        (job for job in jobs if job["machine_a_minutes"] <= job["machine_b_minutes"]),
        key=lambda job: (job["machine_a_minutes"], job["machine_b_minutes"], job["position"]),
    )
    back = sorted(
        (job for job in jobs if job["machine_a_minutes"] > job["machine_b_minutes"]),
        key=lambda job: (-job["machine_b_minutes"], -job["machine_a_minutes"], job["position"]),
    )
    return [*front, *back]


def evaluate_flow_shop(sequence: list[dict[str, Any]], work_centers: list[dict[str, Any]]) -> dict[str, Any]:
    machine_ready = [0.0 for _ in work_centers]
    operations: list[dict[str, Any]] = []
    sequence_rows: list[dict[str, Any]] = []

    for step, job in enumerate(sequence, start=1):
        previous_machine_finish = 0.0

        for machine_index, work_center in enumerate(work_centers):
            duration = job["durations"][machine_index] if machine_index < len(job["durations"]) else 0.0
            start_minute = max(machine_ready[machine_index], previous_machine_finish)
            finish_minute = start_minute + duration

            if duration > 0:
                operations.append(
                    {
                        "step": step,
                        "product_id": job["id"],
                        "product_name": job["name"],
                        "work_center_id": work_center["id"],
                        "work_center_name": work_center["name"],
                        "start_minute": round(start_minute, 2),
                        "finish_minute": round(finish_minute, 2),
                        "duration_minutes": round(duration, 2),
                    }
                )

            machine_ready[machine_index] = finish_minute
            previous_machine_finish = finish_minute

        sequence_rows.append(
            {
                "step": step,
                "id": job["id"],
                "name": job["name"],
                "color": job["color"],
                "quantity": job["quantity"],
                "processing_times": job["processing_times"],
                "total_processing_minutes": round(sum(job["durations"]), 2),
                "completion_time_minutes": round(previous_machine_finish, 2),
            }
        )

    makespan = max(machine_ready, default=0.0)
    return {
        "makespan_minutes": round(makespan, 2),
        "operations": operations,
        "sequence": sequence_rows,
    }


def build_cds_schedule(jobs: list[dict[str, Any]], work_centers: list[dict[str, Any]]) -> dict[str, Any]:
    active_indexes = [
        index
        for index, _ in enumerate(work_centers)
        if any(job["processing_times"][index]["duration_minutes"] > 0 for job in jobs)
    ]
    active_work_centers = [
        {
            "id": work_centers[index]["id"],
            "name": work_centers[index]["name"],
            "available_time_minutes": work_centers[index].get(
                "available_time_minutes",
                work_centers[index].get("capacity_minutes", 0.0),
            ),
        }
        for index in active_indexes
    ]
    scheduled_jobs = []

    for position, job in enumerate(jobs):
        filtered_processing_times = [job["processing_times"][index] for index in active_indexes]
        durations = [row["duration_minutes"] for row in filtered_processing_times]
        scheduled_jobs.append(
            {
                **job,
                "position": position,
                "processing_times": filtered_processing_times,
                "durations": durations,
                "total_processing_minutes": round(sum(durations), 2),
            }
        )

    if not scheduled_jobs:
        return {
            "products": [],
            "sequence": [],
            "operations": [],
            "work_centers": active_work_centers,
            "cds": {
                "selected_iteration": None,
                "candidate_count": 0,
                "makespan_minutes": 0.0,
                "sequence": [],
                "sequence_label": "-",
            },
            "cds_candidates": [],
        }

    if len(active_work_centers) < 2 or len(scheduled_jobs) < 2:
        evaluation = evaluate_flow_shop(scheduled_jobs, active_work_centers)
        return {
            "products": scheduled_jobs,
            "sequence": evaluation["sequence"],
            "operations": evaluation["operations"],
            "work_centers": active_work_centers,
            "cds": {
                "selected_iteration": 0,
                "candidate_count": 0,
                "makespan_minutes": evaluation["makespan_minutes"],
                "sequence": [job["id"] for job in scheduled_jobs],
                "sequence_label": " -> ".join(job["id"] for job in scheduled_jobs),
            },
            "cds_candidates": [],
        }

    machine_count = len(active_work_centers)
    best_evaluation: dict[str, Any] | None = None
    best_sequence: list[dict[str, Any]] = []
    best_iteration = 0
    candidate_rows: list[dict[str, Any]] = []

    for split_index in range(1, machine_count):
        decorated_jobs = []
        for job in scheduled_jobs:
            decorated_jobs.append(
                {
                    **job,
                    "machine_a_minutes": round(sum(job["durations"][:split_index]), 2),
                    "machine_b_minutes": round(sum(job["durations"][machine_count - split_index :]), 2),
                }
            )

        sequence = johnson_sequence(decorated_jobs)
        evaluation = evaluate_flow_shop(sequence, active_work_centers)
        candidate_rows.append(
            {
                "iteration": split_index,
                "machine_a": [work_center["id"] for work_center in active_work_centers[:split_index]],
                "machine_b": [work_center["id"] for work_center in active_work_centers[machine_count - split_index :]],
                "sequence": [job["id"] for job in sequence],
                "sequence_label": " -> ".join(job["id"] for job in sequence),
                "makespan_minutes": evaluation["makespan_minutes"],
            }
        )

        if best_evaluation is None or evaluation["makespan_minutes"] < best_evaluation["makespan_minutes"]:
            best_evaluation = evaluation
            best_sequence = sequence
            best_iteration = split_index

    selected_evaluation = best_evaluation or evaluate_flow_shop(scheduled_jobs, active_work_centers)
    return {
        "products": scheduled_jobs,
        "sequence": selected_evaluation["sequence"],
        "operations": selected_evaluation["operations"],
        "work_centers": active_work_centers,
        "cds": {
            "selected_iteration": best_iteration,
            "candidate_count": len(candidate_rows),
            "makespan_minutes": selected_evaluation["makespan_minutes"],
            "sequence": [job["id"] for job in best_sequence],
            "sequence_label": " -> ".join(job["id"] for job in best_sequence),
        },
        "cds_candidates": candidate_rows,
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


def build_schedule(
    mps: dict[str, Any],
    crp: dict[str, Any],
    routes: dict[str, Any],
    dataset: dict[str, Any],
) -> dict[str, Any]:
    imported_schedule = build_imported_schedule(crp, routes, dataset)
    if imported_schedule["weeks"]:
        return imported_schedule

    weeks = []
    work_centers = crp.get("work_centers", dataset.get("work_centers", []))
    crp_detail_lookup = build_crp_detail_lookup(crp)

    for index, period in enumerate(mps["periods"]):
        capacity_row = crp["periods"][index]
        product_jobs = []
        for product_row in mps["rows"]:
            quantity = period[product_row["id"]]
            if quantity <= 0:
                continue

            processing_times = build_product_processing_times(
                product=product_row,
                quantity=quantity,
                period_index=index,
                work_centers=work_centers,
                crp_detail_lookup=crp_detail_lookup,
                routing_by_product=dataset.get("routing_by_product", {}),
            )
            product_jobs.append(
                {
                    "id": product_row["id"],
                    "name": product_row["name"],
                    "color": product_row["color"],
                    "quantity": quantity,
                    "processing_times": processing_times,
                }
            )

        cds_schedule = build_cds_schedule(product_jobs, work_centers)
        products = [
            {
                "id": product["id"],
                "name": product["name"],
                "color": product["color"],
                "quantity": product["quantity"],
                "processing_times": product["processing_times"],
                "total_processing_minutes": product["total_processing_minutes"],
            }
            for product in cds_schedule["products"]
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
                "work_centers": cds_schedule["work_centers"],
                "sequence": cds_schedule["sequence"],
                "operations": cds_schedule["operations"],
                "cds": cds_schedule["cds"],
                "cds_candidates": cds_schedule["cds_candidates"],
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

    return {
        "algorithm": {
            "key": "cds",
            "name": "Campbell-Dudek-Smith (CDS)",
            "description": "CDS membentuk kandidat Johnson untuk beberapa split work center, lalu memilih urutan dengan makespan terendah.",
        },
        "weeks": weeks,
    }


def build_imported_schedule(
    crp: dict[str, Any],
    routes: dict[str, Any],
    dataset: dict[str, Any],
) -> dict[str, Any]:
    schedule_rows = dataset.get("production_schedule", {}).get("rows") or []
    if not schedule_rows:
        return {
            "algorithm": {
                "key": "cds",
                "name": "Campbell-Dudek-Smith (CDS)",
                "description": "Fallback perhitungan CDS dipakai karena tabel schedule PostgreSQL belum berisi data.",
            },
            "weeks": [],
        }

    product_lookup = dataset.get("product_lookup", {})
    work_center_lookup = dataset.get("work_center_lookup", {})
    rows_by_period: dict[int, list[dict[str, Any]]] = {}
    for row in schedule_rows:
        rows_by_period.setdefault(int(row.get("period") or 0), []).append(row)

    weeks = []
    for period_no in sorted(rows_by_period):
        if period_no <= 0 or period_no > len(dataset["week_numbers"]):
            continue

        period_rows = sorted(rows_by_period[period_no], key=lambda row: row.get("product_id") or "")
        products = []
        sequence = []
        operations = []
        active_work_centers: dict[str, dict[str, Any]] = {}
        max_completion_minutes = 0.0
        has_overload = False

        for product_index, row in enumerate(period_rows, start=1):
            product_id = row.get("product_id") or ""
            product = product_lookup.get(product_id, {})
            operation_rows = row.get("operations") or []
            processing_times = []
            product_completion_minutes = 0.0
            shift_start_hour = min(
                (float(operation.get("start_hour") or 8) for operation in operation_rows),
                default=8.0,
            )

            for operation in sorted(operation_rows, key=lambda item: item.get("operation_no") or 0):
                work_center_id = operation.get("work_center_id") or ""
                work_center = work_center_lookup.get(work_center_id, {})
                duration_minutes = round(float(operation.get("duration_minutes") or 0), 2)
                start_hour = float(operation.get("start_hour") or shift_start_hour)
                finish_hour = float(operation.get("finish_hour") or start_hour)
                start_minute = round((start_hour - shift_start_hour) * 60, 2)
                finish_minute = round((finish_hour - shift_start_hour) * 60, 2)
                product_completion_minutes = max(product_completion_minutes, finish_minute)

                active_work_centers.setdefault(
                    work_center_id,
                    {
                        "id": work_center_id,
                        "name": operation.get("work_center_name") or work_center.get("name", work_center_id),
                        "available_time_minutes": work_center.get("available_time_minutes", work_center.get("capacity_minutes", 0.0)),
                    },
                )
                processing_times.append(
                    {
                        "work_center_id": work_center_id,
                        "work_center_name": operation.get("work_center_name") or work_center.get("name", work_center_id),
                        "run_minutes": round(float(operation.get("run_minutes") or 0), 2),
                        "setup_minutes": round(float(operation.get("setup_minutes") or 0), 2),
                        "duration_minutes": duration_minutes,
                        "operation_name": operation.get("operation_name") or "",
                        "start_hour": start_hour,
                        "finish_hour": finish_hour,
                        "status_label": operation.get("status_label") or "",
                    }
                )
                operations.append(
                    {
                        "step": product_index,
                        "product_id": product_id,
                        "product_name": row.get("product_name") or product.get("name", product_id),
                        "work_center_id": work_center_id,
                        "work_center_name": operation.get("work_center_name") or work_center.get("name", work_center_id),
                        "operation_name": operation.get("operation_name") or "",
                        "start_minute": start_minute,
                        "finish_minute": finish_minute,
                        "duration_minutes": duration_minutes,
                    }
                )

            total_processing_minutes = round(
                float(row.get("total_duration_minutes") or 0)
                or sum(item["duration_minutes"] for item in processing_times),
                2,
            )
            product_payload = {
                "id": product_id,
                "name": row.get("product_name") or product.get("name", product_id),
                "color": product.get("color", "#38bdf8"),
                "quantity": row.get("quantity") or 0,
                "processing_times": processing_times,
                "total_processing_minutes": total_processing_minutes,
            }
            products.append(product_payload)
            sequence.append(
                {
                    **product_payload,
                    "step": product_index,
                    "completion_time_minutes": round(product_completion_minutes or total_processing_minutes, 2),
                }
            )
            max_completion_minutes = max(max_completion_minutes, product_completion_minutes or total_processing_minutes)
            has_overload = has_overload or row.get("capacity_status") == "overload"

        total = round(sum(float(row.get("quantity") or 0) for row in period_rows), 2)
        bottleneck = crp["periods"][period_no - 1]["bottleneck"] if period_no - 1 < len(crp.get("periods", [])) else {}
        status = (
            {"key": "overload", "label": "Overload", "color": "#ef4444"}
            if has_overload
            else {"key": "normal", "label": "Normal", "color": "#22c55e"}
        )
        weeks.append(
            {
                "week": period_no,
                "week_number": dataset["week_numbers"][period_no - 1],
                "period": f"W{period_no}",
                "total": total,
                "products": products,
                "status": status,
                "bottleneck": bottleneck,
                "work_centers": list(active_work_centers.values()),
                "sequence": sequence,
                "operations": operations,
                "cds": {
                    "selected_iteration": None,
                    "candidate_count": 0,
                    "makespan_minutes": round(max_completion_minutes, 2),
                    "sequence": [row["id"] for row in sequence],
                    "sequence_label": " -> ".join(row["id"] for row in sequence),
                },
                "cds_candidates": [],
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

    return {
        "algorithm": {
            "key": "excel_forward",
            "name": "Forward Scheduling (PostgreSQL Import)",
            "description": "Jadwal dibaca dari dss.production_schedule_lines hasil import sheet Forward Scheduling (2).",
        },
        "weeks": weeks,
    }


def build_bill_of_material(dataset: dict[str, Any]) -> dict[str, Any]:
    entries = dataset.get("bom_entries", [])
    grouped = []
    bom_by_product = dataset.get("bom_by_product", {})

    for product in dataset.get("products", []):
        components = bom_by_product.get(product["id"], [])
        grouped.append(
            {
                "id": product["id"],
                "name": product["name"],
                "family_name": product.get("family_name") or "",
                "color": product.get("color") or "",
                "component_count": len(components),
                "components": components,
            }
        )

    component_ids = {entry.get("material_id") for entry in entries if entry.get("material_id")}
    return {
        "source": "PostgreSQL BOM",
        "policy": "BOM ditampilkan sebagai output dari tabel PostgreSQL dss.bom_versions dan dss.bom_lines.",
        "products": grouped,
        "rows": entries,
        "product_count": len(grouped),
        "component_count": len(component_ids),
        "line_count": len(entries),
    }


def build_dss_payload(
    periods: int = 20,
    selected_product_id: str | None = None,
    selected_component_id: str | None = None,
) -> dict[str, Any]:
    dataset = build_dataset_from_database()
    periods = max(1, min(periods, dataset["available_periods"]))

    products = dataset["products"]
    if not products:
        raise ValueError("Tidak ada data produk yang berhasil dibaca dari PostgreSQL.")

    if selected_product_id not in dataset["product_lookup"]:
        selected_product_id = products[0]["id"]

    forecast = build_forecast(dataset, periods)
    mps = build_mps(dataset, periods)
    rccp = build_rccp(dataset, periods)
    crp = build_crp(dataset, periods)
    routes = build_routes(dataset)
    mrp = build_mrp(dataset, selected_component_id, periods)
    dashboard = build_dashboard(mps, crp, routes, mrp, rccp)
    schedule = build_schedule(mps, crp, routes, dataset)
    bill_of_material = build_bill_of_material(dataset)

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
        "files": list_database_sources(),
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
        "forecast": forecast,
        "mps": mps,
        "mrp": mrp,
        "rccp": rccp,
        "crp": crp,
        "capacity": crp,
        "schedule": schedule,
        "bill_of_material": bill_of_material,
        "routes": routes,
    }
