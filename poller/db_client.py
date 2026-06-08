from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL


def _base_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Accept": "application/json",
    }


def _get(path: str) -> Any:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers=_base_headers(), method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"GET {path} → {exc.code}: {exc.read().decode()}") from exc


def _mutate(method: str, path: str, body: Dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        **_base_headers(),
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    data = json.dumps(body, default=str).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req):
            pass
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{method} {path} → {exc.code}: {exc.read().decode()}") from exc


def fetch_active_printers() -> List[Dict[str, Any]]:
    """Return all SNMP-enabled, non-archived printers."""
    return _get(
        "printers"
        "?snmp_enabled=eq.true"
        "&archived_at=is.null"
        "&select=id,name,ip_address,model,status,snmp_enabled"
    )


def insert_snmp_reading(reading: Dict[str, Any]) -> None:
    _mutate("POST", "printer_snmp_readings", reading)


def update_printer(printer_id: str, fields: Dict[str, Any]) -> None:
    _mutate("PATCH", f"printers?id=eq.{printer_id}", fields)


def fetch_setting(key: str) -> Optional[str]:
    """Return the value of an app_settings row, or None if not found."""
    try:
        rows = _get(f"app_settings?key=eq.{key}&select=value&limit=1")
        return rows[0]["value"] if rows else None
    except Exception:
        return None


def upsert_meter_reading(reading: Dict[str, Any]) -> None:
    """Insert today's meter reading, or update only if the new value is higher."""
    printer_id = reading["printer_id"]
    date = reading["reading_at"]
    new_value = int(reading["reading"])

    existing = _get(
        f"printer_meter_readings"
        f"?printer_id=eq.{printer_id}"
        f"&reading_at=eq.{date}"
        f"&select=id,reading"
        f"&limit=1"
    )
    if not existing:
        _mutate("POST", "printer_meter_readings", reading)
    elif new_value > int(existing[0]["reading"]):
        _mutate("PATCH", f"printer_meter_readings?id=eq.{existing[0]['id']}", {"reading": new_value})
