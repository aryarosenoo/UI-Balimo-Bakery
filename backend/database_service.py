from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_PSQL_PATH = Path(r"D:\PostgreeSQL\bin\psql.exe")
ENV_FILE_NAMES = (".env.local", ".env")
_ENV_FILES_LOADED = False

KEY_TABLES = [
    {"name": "planning_scenarios", "label": "Planning Scenarios"},
    {"name": "planning_periods", "label": "Planning Periods"},
    {"name": "items", "label": "Items"},
    {"name": "item_planning_policies", "label": "Item Planning Policies"},
    {"name": "mps_lines", "label": "MPS Lines"},
    {"name": "mrp_lines", "label": "MRP Lines"},
    {"name": "rccp_lines", "label": "RCCP Lines"},
    {"name": "crp_lines", "label": "CRP Lines"},
    {"name": "work_centers", "label": "Work Centers"},
    {"name": "work_center_period_capacity", "label": "Work Center Capacity"},
    {"name": "routing_operations", "label": "Routing Operations"},
    {"name": "delivery_routes", "label": "Delivery Routes"},
    {"name": "stores", "label": "Stores"},
    {"name": "route_stores", "label": "Route Stores"},
    {"name": "production_schedule_lines", "label": "Production Schedule"},
    {"name": "demand_plans", "label": "Demand Plans"},
    {"name": "bom_versions", "label": "BOM Versions"},
    {"name": "bom_lines", "label": "BOM Lines"},
    {"name": "bol_versions", "label": "BOL Versions"},
    {"name": "bol_lines", "label": "BOL Lines"},
    {"name": "forecast_sales_history", "label": "Forecast Sales History"},
]


def load_env_files() -> None:
    global _ENV_FILES_LOADED

    if _ENV_FILES_LOADED:
        return

    for file_name in ENV_FILE_NAMES:
        env_path = BASE_DIR / file_name
        if not env_path.exists():
            continue

        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value

    _ENV_FILES_LOADED = True


def get_database_config() -> dict[str, str]:
    load_env_files()
    return {
        "host": os.getenv("DSS_DB_HOST", "127.0.0.1"),
        "port": os.getenv("DSS_DB_PORT", "5432"),
        "database": os.getenv("DSS_DB_NAME", "balimo_bakery_dss"),
        "user": os.getenv("DSS_DB_USER", "postgres"),
        "password": os.getenv("DSS_DB_PASSWORD", os.getenv("PGPASSWORD", "")),
        "schema": os.getenv("DSS_DB_SCHEMA", "dss"),
        "scenario_code": os.getenv("DSS_SCENARIO_CODE", "default"),
        "psql_path": os.getenv("DSS_PSQL_PATH", str(DEFAULT_PSQL_PATH)),
    }


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def run_psql_query(config: dict[str, str], sql: str, timeout: int = 15) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = config["password"]
    return subprocess.run(
        [
            config["psql_path"],
            "-h",
            config["host"],
            "-p",
            config["port"],
            "-U",
            config["user"],
            "-d",
            config["database"],
            "-tA",
            "-c",
            sql,
        ],
        cwd=BASE_DIR,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
        check=False,
    )


def run_psql_script(config: dict[str, str], sql: str, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = config["password"]
    return subprocess.run(
        [
            config["psql_path"],
            "-h",
            config["host"],
            "-p",
            config["port"],
            "-U",
            config["user"],
            "-d",
            config["database"],
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            "-",
        ],
        cwd=BASE_DIR,
        env=env,
        input=sql,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
        check=False,
    )


def get_database_status() -> dict[str, Any]:
    config = get_database_config()
    psql_path = Path(config["psql_path"])

    if not psql_path.exists():
        return {
            "configured": False,
            "connected": False,
            "database": config["database"],
            "schema": config["schema"],
            "message": f"psql tidak ditemukan di {psql_path}.",
            "tables": [],
        }

    if not config["password"]:
        return {
            "configured": False,
            "connected": False,
            "database": config["database"],
            "schema": config["schema"],
            "message": "Password database belum dikonfigurasi di DSS_DB_PASSWORD atau PGPASSWORD.",
            "tables": [],
        }

    schema_literal = sql_literal(config["schema"])

    sql = f"""
        SELECT json_build_object(
            'connected', true,
            'database', current_database(),
            'schema', {schema_literal},
            'table_count', (
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = {schema_literal}
                  AND table_type = 'BASE TABLE'
            ),
            'view_count', (
                SELECT COUNT(*)
                FROM information_schema.views
                WHERE table_schema = {schema_literal}
            ),
            'foreign_key_count', (
                SELECT COUNT(*)
                FROM information_schema.table_constraints
                WHERE table_schema = {schema_literal}
                  AND constraint_type = 'FOREIGN KEY'
            ),
            'existing_tables', (
                SELECT COALESCE(json_agg(table_name ORDER BY table_name), '[]'::json)
                FROM information_schema.tables
                WHERE table_schema = {schema_literal}
                  AND table_type = 'BASE TABLE'
            )
        )::text;
    """

    try:
        result = run_psql_query({**config, "psql_path": str(psql_path)}, sql)
    except subprocess.SubprocessError as exc:
        return {
            "configured": True,
            "connected": False,
            "database": config["database"],
            "schema": config["schema"],
            "message": str(exc),
            "tables": [],
        }

    if result.returncode != 0:
        return {
            "configured": True,
            "connected": False,
            "database": config["database"],
            "schema": config["schema"],
            "message": result.stderr.strip() or "Koneksi PostgreSQL gagal.",
            "tables": [],
        }

    try:
        payload = json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        return {
            "configured": True,
            "connected": False,
            "database": config["database"],
            "schema": config["schema"],
            "message": "Respons PostgreSQL tidak bisa dibaca sebagai JSON.",
            "tables": [],
        }

    existing_tables = set(payload.pop("existing_tables", []) or [])
    count_by_table: dict[str, int] = {}
    existing_key_tables = [table for table in KEY_TABLES if table["name"] in existing_tables]

    if existing_key_tables:
        schema_identifier = sql_identifier(config["schema"])
        count_sql = "\nUNION ALL\n".join(
            (
                f"SELECT {sql_literal(table['name'])} AS name, "
                f"COUNT(*)::bigint AS rows FROM {schema_identifier}.{sql_identifier(table['name'])}"
            )
            for table in existing_key_tables
        )
        count_wrapper_sql = f"""
            SELECT COALESCE(json_agg(row_to_json(table_counts)), '[]'::json)::text
            FROM (
                {count_sql}
            ) table_counts;
        """
        try:
            count_result = run_psql_query({**config, "psql_path": str(psql_path)}, count_wrapper_sql)
            if count_result.returncode == 0:
                for row in json.loads(count_result.stdout.strip() or "[]"):
                    count_by_table[row["name"]] = int(row["rows"] or 0)
        except (subprocess.SubprocessError, json.JSONDecodeError, TypeError, ValueError):
            count_by_table = {}

    tables = [
        {
            "name": table["label"],
            "table_name": table["name"],
            "rows": count_by_table.get(table["name"], 0),
            "exists": table["name"] in existing_tables,
        }
        for table in KEY_TABLES
    ]
    missing_count = sum(1 for table in tables if not table["exists"])

    return {
        "configured": True,
        "message": (
            "PostgreSQL schema DSS terhubung dan menjadi sumber data utama."
            if missing_count == 0
            else f"PostgreSQL terhubung, {missing_count} tabel sumber utama belum ditemukan."
        ),
        "data_source": "PostgreSQL",
        "dictionary_table_count": len(KEY_TABLES),
        "dictionary_missing_count": missing_count,
        "tables": tables,
        **payload,
    }
