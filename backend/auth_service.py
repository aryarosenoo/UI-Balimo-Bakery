from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import subprocess
from threading import Lock
from pathlib import Path
from typing import Any

from .database_service import get_database_config, run_psql_query, run_psql_script, sql_identifier, sql_literal


DEFAULT_AUTH_USERS = [
    {
        "id": "OWN-001",
        "username": "owner",
        "password": "owner123",
        "name": "Owner Balimo",
        "role": "owner",
        "department": "Owner",
        "phone": "081200000000",
    },
    {
        "id": "KP-001",
        "username": "produksi",
        "password": "produksi123",
        "name": "Karyawan Produksi",
        "role": "production",
        "department": "Produksi",
        "phone": "081200000001",
    },
    {
        "id": "KM-001",
        "username": "pemasaran",
        "password": "pemasaran123",
        "name": "Karyawan Pemasaran",
        "role": "marketing",
        "department": "Pemasaran",
        "phone": "081200000002",
    },
]

AUTH_ITERATIONS = 200_000
MIN_PASSWORD_LENGTH = 6
_AUTH_TABLE_LOCK = Lock()
_AUTH_TABLE_READY = False


class AuthServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def hash_password(password: str, *, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        AUTH_ITERATIONS,
    )
    return "$".join(
        [
            "pbkdf2_sha256",
            str(AUTH_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(digest).decode("ascii"),
        ]
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = base64.b64decode(salt_text.encode("ascii"))
        expected = base64.b64decode(digest_text.encode("ascii"))
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual, expected)


def safe_user(user: dict[str, Any] | None) -> dict[str, Any] | None:
    if not user:
        return None
    return {
        "id": user["id"],
        "username": user["username"],
        "name": user["name"],
        "role": user["role"],
        "department": user["department"],
        "phone": user["phone"],
    }


def get_auth_table_name() -> str:
    config = get_database_config()
    return f"{sql_identifier(config['schema'])}.app_users"


def ensure_auth_table() -> None:
    global _AUTH_TABLE_READY

    if _AUTH_TABLE_READY:
        return

    with _AUTH_TABLE_LOCK:
        if _AUTH_TABLE_READY:
            return

        ensure_auth_table_unlocked()
        _AUTH_TABLE_READY = True


def ensure_auth_table_unlocked() -> None:
    config = get_database_config()
    psql_path = Path(config["psql_path"])
    if not psql_path.exists():
        raise AuthServiceError(f"psql tidak ditemukan di {psql_path}.", status_code=503)
    if not config["password"]:
        raise AuthServiceError("Password database belum dikonfigurasi.", status_code=503)

    table = get_auth_table_name()
    seed_values = []
    for user in DEFAULT_AUTH_USERS:
        seed_values.append(
            "("
            f"{sql_literal(user['id'])}, "
            f"{sql_literal(user['username'])}, "
            f"{sql_literal(hash_password(user['password']))}, "
            f"{sql_literal(user['name'])}, "
            f"{sql_literal(user['role'])}, "
            f"{sql_literal(user['department'])}, "
            f"{sql_literal(user['phone'])}"
            ")"
        )

    sql = f"""
        CREATE TABLE IF NOT EXISTS {table} (
            user_id varchar(20) PRIMARY KEY,
            username varchar(80) NOT NULL UNIQUE,
            password_hash text NOT NULL,
            display_name varchar(120) NOT NULL,
            role_key varchar(30) NOT NULL,
            department varchar(80) NOT NULL,
            phone varchar(40) NOT NULL,
            password_changed_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_idx
            ON {table} (lower(username));

        INSERT INTO {table}
            (user_id, username, password_hash, display_name, role_key, department, phone)
        VALUES {",".join(seed_values)}
        ON CONFLICT (user_id) DO NOTHING;
    """

    try:
        result = run_psql_script(config, sql, timeout=30)
    except subprocess.SubprocessError as exc:
        raise AuthServiceError(str(exc), status_code=503) from exc

    if result.returncode != 0:
        if "pg_type_typname_nsp_index" in result.stderr:
            return
        raise AuthServiceError(result.stderr.strip() or "Tabel auth belum bisa disiapkan.", status_code=503)


def row_to_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["user_id"],
        "username": row["username"],
        "password_hash": row["password_hash"],
        "name": row["display_name"],
        "role": row["role_key"],
        "department": row["department"],
        "phone": row["phone"],
    }


def fetch_auth_rows(where_sql: str = "", timeout: int = 15) -> list[dict[str, Any]]:
    ensure_auth_table()
    table = get_auth_table_name()
    sql = f"""
        SELECT COALESCE(json_agg(row_to_json(auth_rows)), '[]'::json)::text
        FROM (
            SELECT
                user_id,
                username,
                password_hash,
                display_name,
                role_key,
                department,
                phone
            FROM {table}
            {where_sql}
            ORDER BY role_key, username
        ) auth_rows;
    """
    config = get_database_config()
    result = run_psql_query(config, sql, timeout=timeout)
    if result.returncode != 0:
        raise AuthServiceError(result.stderr.strip() or "Data pengguna belum bisa dibaca.", status_code=503)
    try:
        return json.loads(result.stdout.strip() or "[]")
    except json.JSONDecodeError as exc:
        raise AuthServiceError("Respons pengguna tidak bisa dibaca.", status_code=503) from exc


def get_public_users() -> list[dict[str, Any]]:
    return [safe_user(row_to_user(row)) for row in fetch_auth_rows()]


def get_user_by_username(username: str) -> dict[str, Any] | None:
    normalized = str(username or "").strip().lower()
    if not normalized:
        return None
    rows = fetch_auth_rows(f"WHERE lower(username) = {sql_literal(normalized)}", timeout=10)
    if not rows:
        return None
    return row_to_user(rows[0])


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    normalized = str(user_id or "").strip()
    if not normalized:
        return None
    rows = fetch_auth_rows(f"WHERE user_id = {sql_literal(normalized)}", timeout=10)
    if not rows:
        return None
    return row_to_user(rows[0])


def authenticate_user(username: str, password: str) -> dict[str, Any]:
    user = get_user_by_username(username)
    if not user or not verify_password(str(password or ""), user["password_hash"]):
        raise AuthServiceError("Username atau password tidak sesuai dengan data login.", status_code=401)
    public_user = safe_user(user)
    if public_user is None:
        raise AuthServiceError("Data pengguna belum lengkap.", status_code=500)
    return public_user


def change_user_password(
    *,
    current_password: str,
    new_password: str,
    user_id: str | None = None,
    username: str | None = None,
) -> dict[str, Any]:
    user = get_user_by_id(user_id or "") if user_id else get_user_by_username(username or "")
    if not user:
        raise AuthServiceError("Pengguna tidak ditemukan.", status_code=404)
    if not verify_password(str(current_password or ""), user["password_hash"]):
        raise AuthServiceError("Password lama tidak sesuai.", status_code=401)
    if len(str(new_password or "")) < MIN_PASSWORD_LENGTH:
        raise AuthServiceError(f"Password baru minimal {MIN_PASSWORD_LENGTH} karakter.", status_code=400)

    table = get_auth_table_name()
    sql = f"""
        UPDATE {table}
        SET
            password_hash = {sql_literal(hash_password(new_password))},
            password_changed_at = now(),
            updated_at = now()
        WHERE user_id = {sql_literal(user["id"])};
    """
    config = get_database_config()
    result = run_psql_query(config, sql, timeout=10)
    if result.returncode != 0:
        raise AuthServiceError(result.stderr.strip() or "Password belum bisa diperbarui.", status_code=503)

    updated_user = get_user_by_id(user["id"])
    public_user = safe_user(updated_user)
    if public_user is None:
        raise AuthServiceError("Data pengguna belum lengkap setelah update.", status_code=500)
    return public_user
