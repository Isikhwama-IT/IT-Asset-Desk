"""
SNMP polling daemon — one-shot or continuous.

Each site runs its own copy filtered by POLL_IP_PREFIX:
  Baker Street  →  POLL_IP_PREFIX=192.168.21.
  Rainbow Park  →  POLL_IP_PREFIX=192.168.20.
  (empty = poll all printers in DB)

Usage:
  python poll_daemon.py --once       poll once and exit  ← Windows Task Scheduler
  python poll_daemon.py --dry-run    poll without writing to DB
  python poll_daemon.py              run forever on POLL_INTERVAL_MINUTES
"""
from __future__ import annotations

import argparse
import logging
import math
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from config import LOG_LEVEL, POLL_INTERVAL_MINUTES, POLL_IP_PREFIX, TONER_FLAG_THRESHOLDS
from db_client import (
    fetch_active_printers,
    fetch_setting,
    insert_snmp_reading,
    update_printer,
    upsert_meter_reading,
)
from printer_probe import poll_printer


# ── Logging setup ──────────────────────────────────────────────────────────────

_LOG_FILE = os.path.join(os.path.dirname(__file__), "poller.log")
_FMT = "%(asctime)s [%(levelname)s] %(message)s"
_DATE_FMT = "%Y-%m-%dT%H:%M:%S"

logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format=_FMT, datefmt=_DATE_FMT)
_file_handler = logging.FileHandler(_LOG_FILE, encoding="utf-8")
_file_handler.setFormatter(logging.Formatter(_FMT, datefmt=_DATE_FMT))
logging.getLogger().addHandler(_file_handler)

log = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clamp_pct(value: Any) -> Optional[int]:
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return max(0, min(100, round(value)))


def _flag_label(pct: Optional[int]) -> Optional[str]:
    if pct is None:
        return None
    for threshold, label in sorted(TONER_FLAG_THRESHOLDS.items(), reverse=True):
        if pct >= threshold:
            return label
    return "Empty"


_FLAG_TO_STATUS = {
    "New": "OK",
    "In Use": "OK",
    "Half": "OK",
    "Order Now": "Low",
    "Empty": "Out",
}


def _paper_status_from_trays(paper_trays: list) -> Optional[str]:
    """Derive paper_status from SNMP tray data, ignoring bypass/MP trays."""
    bypass_keywords = ("bypass", "mp tray", "mp ")
    main_trays = [
        t for t in paper_trays
        if (t.get("max") or 0) >= 200
        and not any(kw in (t.get("name") or "").lower() for kw in bypass_keywords)
    ]
    if not main_trays:
        return None
    valid_pcts = [t["percent"] for t in main_trays if t.get("percent") is not None]
    if not valid_pcts:
        return None
    min_pct = min(valid_pcts)
    if min_pct <= 0:
        return "Out"
    if min_pct <= 25:
        return "Low"
    return "OK"


def _toner_status_from_levels(toner: Dict[str, Optional[int]]) -> Optional[str]:
    """Derive worst-case toner_status from TONER_FLAG_THRESHOLDS across all colours."""
    priority = ["Out", "Low", "OK"]
    worst: Optional[str] = None
    for pct in toner.values():
        flag = _flag_label(_clamp_pct(pct) if pct is not None else None)
        status = _FLAG_TO_STATUS.get(flag or "", None)
        if status is None:
            continue
        if worst is None or priority.index(status) < priority.index(worst):
            worst = status
    return worst


def _toner_summary(toner: Dict[str, Optional[int]]) -> str:
    parts = []
    for colour, pct in [("B", toner.get("black")), ("C", toner.get("cyan")),
                         ("M", toner.get("magenta")), ("Y", toner.get("yellow"))]:
        if pct is not None:
            flag = _flag_label(_clamp_pct(pct))
            parts.append(f"{colour}:{pct}%({flag})")
    return " ".join(parts) if parts else "n/a"


def _build_reading(printer_id: str, result: Dict[str, Any]) -> Dict[str, Any]:
    polled_at = result.get("polled_at") or datetime.now(timezone.utc).isoformat()
    toner = result.get("toner") or {"black": None, "cyan": None, "magenta": None, "yellow": None}
    developer = result.get("developer") or {"black": None, "cyan": None, "magenta": None, "yellow": None}
    raw = result.get("raw_data")

    return {
        "printer_id": printer_id,
        "polled_at": polled_at,
        "is_online": bool(result.get("is_online")),
        "printer_status": result.get("printer_status"),
        "error_description": result.get("error_description"),
        "total_pages": result.get("total_pages"),
        "colour_pages": result.get("colour_pages"),
        "mono_pages": result.get("mono_pages"),
        "black_toner_pct": _clamp_pct(toner.get("black")),
        "cyan_toner_pct": _clamp_pct(toner.get("cyan")),
        "magenta_toner_pct": _clamp_pct(toner.get("magenta")),
        "yellow_toner_pct": _clamp_pct(toner.get("yellow")),
        "black_developer_pct": _clamp_pct(developer.get("black")),
        "cyan_developer_pct": _clamp_pct(developer.get("cyan")),
        "magenta_developer_pct": _clamp_pct(developer.get("magenta")),
        "yellow_developer_pct": _clamp_pct(developer.get("yellow")),
        "fuser_pct": _clamp_pct(result.get("fuser_pct")),
        "waste_box_pct": _clamp_pct(result.get("waste_box_pct")),
        "drum_pct": _clamp_pct(result.get("drum_pct")),
        "raw_data": {
            **(raw if isinstance(raw, dict) else {}),
            "consumables": result.get("consumables") or [],
            "paper_trays": result.get("paper_trays") or [],
        },
    }


# ── Core poll + save ───────────────────────────────────────────────────────────

def poll_and_save(printer: Dict[str, Any], dry_run: bool = False) -> Tuple[bool, bool]:
    """
    Poll one printer and persist results.
    Returns (is_online, had_error) so the caller can tally counts.
    """
    printer_id = printer["id"]
    name = printer.get("name") or printer_id
    ip = printer.get("ip_address")

    if not ip:
        log.warning("[%s] Skipped — no IP address configured", name)
        return False, True

    try:
        result = poll_printer(ip, printer_id=printer_id, name=name, model=printer.get("model"))
    except Exception as exc:
        log.error("[%s] Poll exception: %s", name, exc)
        result = {
            "printer_id": printer_id,
            "ip_address": ip,
            "polled_at": datetime.now(timezone.utc).isoformat(),
            "is_online": False,
            "error_description": f"Poller exception: {exc}",
        }

    reading = _build_reading(printer_id, result)
    polled_at: str = reading["polled_at"]
    is_online: bool = reading["is_online"]
    toner = result.get("toner") or {"black": None, "cyan": None, "magenta": None, "yellow": None}
    alert_text = result.get("error_description") or ""

    # ── Structured log line ────────────────────────────────────────────────────
    status_word = "ONLINE" if is_online else "OFFLINE"
    pages_str = f"pages={reading['total_pages']}" if reading["total_pages"] is not None else "pages=n/a"
    toner_str = _toner_summary(toner)
    alert_str = f" | ALERT: {alert_text}" if alert_text else ""
    log.info("[%s] %s | %s | %s%s", name, status_word, pages_str, toner_str, alert_str)

    if dry_run:
        import json
        print(json.dumps(reading, indent=2, default=str))
        return is_online, False

    # ── Persist SNMP reading ───────────────────────────────────────────────────
    try:
        insert_snmp_reading(reading)
    except Exception as exc:
        log.error("[%s] Failed to save SNMP reading: %s", name, exc)
        return is_online, True

    # ── Derive printer update ──────────────────────────────────────────────────
    toner_status = _toner_status_from_levels(toner)
    paper_trays = result.get("paper_trays") or []
    paper_status = _paper_status_from_trays(paper_trays)
    update: Dict[str, Any] = {
        "last_snmp_polled_at": polled_at,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if toner_status:
        update["toner_status"] = toner_status
    if paper_status:
        update["paper_status"] = paper_status
    if printer.get("status") != "Retired":
        update["status"] = (
            ("Needs Attention" if alert_text else "Active") if is_online else "Offline"
        )

    # ── Meter reading upsert ───────────────────────────────────────────────────
    total_pages = result.get("total_pages")
    if isinstance(total_pages, (int, float)) and math.isfinite(total_pages):
        total_pages = int(total_pages)
        update["last_meter_reading"] = total_pages
        update["last_meter_reading_at"] = polled_at[:10]
        try:
            upsert_meter_reading({
                "printer_id": printer_id,
                "reading": total_pages,
                "reading_at": polled_at[:10],
                "notes": "Captured automatically by SNMP daemon",
            })
        except Exception as exc:
            log.warning("[%s] Meter reading upsert failed: %s", name, exc)

    # ── Update printer record ──────────────────────────────────────────────────
    try:
        update_printer(printer_id, update)
    except Exception as exc:
        log.error("[%s] Failed to update printer record: %s", name, exc)
        return is_online, True

    return is_online, False


# ── Cycle ──────────────────────────────────────────────────────────────────────

def run_cycle(dry_run: bool = False) -> None:
    cycle_start = time.monotonic()
    site_label = f" [{POLL_IP_PREFIX.rstrip('.')}]" if POLL_IP_PREFIX else ""

    # Check DB setting before doing any work
    if not dry_run:
        setting = fetch_setting("snmp_auto_poll_enabled")
        if setting is not None and setting.lower() == "false":
            log.info("═══ Auto-polling is DISABLED in settings — skipping cycle%s ═══", site_label)
            return

    log.info("═══ Poll cycle starting%s ═══════════════════════════════", site_label)

    try:
        all_printers: List[Dict[str, Any]] = fetch_active_printers()
    except Exception as exc:
        log.error("Could not fetch printers from Supabase: %s", exc)
        return

    printers = (
        [p for p in all_printers if (p.get("ip_address") or "").startswith(POLL_IP_PREFIX)]
        if POLL_IP_PREFIX
        else all_printers
    )

    if POLL_IP_PREFIX and len(printers) < len(all_printers):
        log.info(
            "Site filter %s* — polling %d of %d printer(s)",
            POLL_IP_PREFIX, len(printers), len(all_printers),
        )
    else:
        log.info("Polling %d SNMP-enabled printer(s)", len(printers))

    online_count = 0
    offline_count = 0
    error_count = 0

    for printer in printers:
        is_online, had_error = poll_and_save(printer, dry_run=dry_run)
        if had_error:
            error_count += 1
        elif is_online:
            online_count += 1
        else:
            offline_count += 1

    elapsed = round(time.monotonic() - cycle_start)
    log.info(
        "═══ Cycle complete in %ds — %d online, %d offline, %d error(s) ═══",
        elapsed, online_count, offline_count, error_count,
    )


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="SNMP printer polling daemon")
    parser.add_argument("--once", action="store_true", help="Poll once and exit.")
    parser.add_argument("--dry-run", action="store_true", help="Poll without writing to DB.")
    args = parser.parse_args()

    if args.dry_run or args.once:
        run_cycle(dry_run=args.dry_run)
        return 0

    log.info("Daemon started — interval=%d min", POLL_INTERVAL_MINUTES)
    while True:
        run_cycle()
        sleep_seconds = POLL_INTERVAL_MINUTES * 60
        log.info("Sleeping %ds until next cycle", sleep_seconds)
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    sys.exit(main())
