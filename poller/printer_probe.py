from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from config import SNMP_COMMUNITY, TONER_FLAG_THRESHOLDS
from snmp_client import get, walk


OID = {
    "sys_descr": "1.3.6.1.2.1.1.1.0",
    "sys_name": "1.3.6.1.2.1.1.5.0",
    "sys_location": "1.3.6.1.2.1.1.6.0",
    "printer_status": "1.3.6.1.2.1.43.5.1.1.1.1",
    "printer_name": "1.3.6.1.2.1.43.5.1.1.16.1",
    "printer_serial": "1.3.6.1.2.1.43.5.1.1.17.1",
    "hr_printer_status": "1.3.6.1.2.1.25.3.5.1.1.1",
    "hr_error_state": "1.3.6.1.2.1.25.3.5.1.2.1",
}

WALK_PREFIXES = {
    "marker": "1.3.6.1.2.1.43.10",
    "supplies": "1.3.6.1.2.1.43.11",
    "input": "1.3.6.1.2.1.43.8",
    "alerts": "1.3.6.1.2.1.43.18",
}

SUPPLY_COLUMNS = {
    "1.3.6.1.2.1.43.11.1.1.3.1": "colour_index",
    "1.3.6.1.2.1.43.11.1.1.4.1": "class",
    "1.3.6.1.2.1.43.11.1.1.5.1": "type",
    "1.3.6.1.2.1.43.11.1.1.6.1": "description",
    "1.3.6.1.2.1.43.11.1.1.7.1": "unit",
    "1.3.6.1.2.1.43.11.1.1.8.1": "max",
    "1.3.6.1.2.1.43.11.1.1.9.1": "level",
}

INPUT_COLUMNS = {
    "1.3.6.1.2.1.43.8.2.1.9.1": "max",
    "1.3.6.1.2.1.43.8.2.1.10.1": "level",
    "1.3.6.1.2.1.43.8.2.1.12.1": "media_name",
    "1.3.6.1.2.1.43.8.2.1.13.1": "tray_name",
}

MARKER_COLUMNS = {
    "1.3.6.1.2.1.43.10.2.1.4.1": "life_count",
    "1.3.6.1.2.1.43.10.2.1.5.1": "power_on_count",
}

PRINTER_STATUS_MAP = {
    "1": "other",
    "2": "unknown",
    "3": "idle",
    "4": "printing",
    "5": "warmup",
}

HR_PRINTER_STATUS_MAP = PRINTER_STATUS_MAP.copy()

KONICA_MINOLTA_CANDIDATE_ROOTS = [
    ("Konica Minolta enterprise candidate", "1.3.6.1.4.1.18334"),
    ("Olivetti/Konica enterprise candidate", "1.3.6.1.4.1.2136"),
]


def _index_from_oid(oid: str, prefix: str) -> Optional[str]:
    if oid.startswith(prefix + "."):
        return oid[len(prefix) + 1 :]
    return None


def _bucket_table(rows: Iterable[Tuple[str, str]], columns: Dict[str, str]) -> Dict[str, Dict[str, str]]:
    table: Dict[str, Dict[str, str]] = defaultdict(dict)
    for oid, value in rows:
        for prefix, column in columns.items():
            index = _index_from_oid(oid, prefix)
            if index is not None:
                table[index][column] = value
                break
    return dict(table)


def _as_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _special_value(value: Optional[int]) -> Optional[str]:
    if value == -2:
        return "unknown (-2)"
    if value == -3:
        return "present, no numeric value (-3)"
    return None


def _pct_int(level: Optional[int], max_capacity: Optional[int]) -> Optional[int]:
    if level is None or max_capacity is None:
        return None
    if _special_value(level) or _special_value(max_capacity):
        return None
    if max_capacity <= 0:
        return None
    return max(0, min(100, round((level / max_capacity) * 100)))


def _flag_label(pct: Optional[int]) -> Optional[str]:
    if pct is None:
        return None
    for threshold, label in sorted(TONER_FLAG_THRESHOLDS.items(), reverse=True):
        if pct >= threshold:
            return label
    return "Empty"


def _pct_label(level_value: Optional[str], max_value: Optional[str]) -> str:
    level = _as_int(level_value)
    max_capacity = _as_int(max_value)
    special = _special_value(level) or _special_value(max_capacity)
    if special:
        return special
    pct = _pct_int(level, max_capacity)
    return f"{pct}%" if pct is not None else "n/a"


def _guess_colour(description: Optional[str]) -> str:
    text = f" {description or ''} ".lower()
    if "black" in text or " bk" in text or " k " in text:
        return "Black"
    if "cyan" in text or " c " in text:
        return "Cyan"
    if "magenta" in text or " m " in text:
        return "Magenta"
    if "yellow" in text or " y " in text:
        return "Yellow"
    return "N/A"


def _guess_kind(description: Optional[str]) -> str:
    text = (description or "").lower()
    if "developer" in text:
        return "developer"
    if "waste" in text:
        return "waste_box"
    if "fuser" in text or "fixing" in text:
        return "fuser"
    if "drum" in text or "imaging" in text:
        return "drum"
    if "maintenance" in text:
        return "maintenance_kit"
    if "toner" in text or "cartridge" in text:
        return "toner"
    return "other"


def _first_int(rows: Dict[str, Dict[str, str]], column: str) -> Optional[int]:
    for row in rows.values():
        value = _as_int(row.get(column))
        if value is not None and value >= 0:
            return value
    return None


def _set_colour_value(target: Dict[str, Optional[int]], colour: str, pct: Optional[int]) -> None:
    if pct is None:
        return
    key = colour.lower()
    if key in target and target[key] is None:
        target[key] = pct


def _summarise_alerts(alert_rows: List[Tuple[str, str]], hr_error_state: Optional[str]) -> Optional[str]:
    text_values = [
        value
        for _, value in alert_rows
        if any(char.isalpha() for char in value) and len(value) <= 180
    ]
    if text_values:
        return "; ".join(text_values[:5])
    if alert_rows:
        return f"{len(alert_rows)} Printer-MIB alert row(s) returned"
    if hr_error_state and hr_error_state not in ("0", "0x00", "00", "NoError"):
        return f"Host Resources error state: {hr_error_state}"
    return None


def _status_label(value: Optional[str], status_map: Dict[str, str]) -> Optional[str]:
    if not value:
        return None
    return status_map.get(value, f"unmapped:{value}")


def _normalise_consumables(supply_table: Dict[str, Dict[str, str]]) -> List[Dict[str, Any]]:
    consumables: List[Dict[str, Any]] = []
    for index, row in sorted(supply_table.items(), key=lambda item: item[0]):
        level = _as_int(row.get("level"))
        max_capacity = _as_int(row.get("max"))
        description = row.get("description")
        pct = _pct_int(level, max_capacity)
        consumables.append(
            {
                "index": index,
                "description": description,
                "colour": _guess_colour(description),
                "kind": _guess_kind(description),
                "level": level,
                "max": max_capacity,
                "percent": pct,
                "percent_label": _pct_label(row.get("level"), row.get("max")),
                "flag_label": _flag_label(pct),
                "type": row.get("type"),
                "class": row.get("class"),
                "unit": row.get("unit"),
            }
        )
    return consumables


def _normalise_paper_trays(input_table: Dict[str, Dict[str, str]]) -> List[Dict[str, Any]]:
    trays: List[Dict[str, Any]] = []
    for index, row in sorted(input_table.items(), key=lambda item: item[0]):
        level = _as_int(row.get("level"))
        max_capacity = _as_int(row.get("max"))
        trays.append(
            {
                "index": index,
                "name": row.get("tray_name"),
                "media_size": row.get("media_name"),
                "level": level,
                "max": max_capacity,
                "percent": _pct_int(level, max_capacity),
                "percent_label": _pct_label(row.get("level"), row.get("max")),
            }
        )
    return trays


def _build_consumable_summary(consumables: List[Dict[str, Any]]) -> Dict[str, Any]:
    toner = {"black": None, "cyan": None, "magenta": None, "yellow": None}
    developer = {"black": None, "cyan": None, "magenta": None, "yellow": None}
    fuser_pct = None
    waste_box_pct = None
    drum_pct = None

    for consumable in consumables:
        pct = consumable.get("percent")
        kind = consumable.get("kind")
        colour = consumable.get("colour", "N/A")

        if kind == "toner":
            _set_colour_value(toner, colour, pct)
        elif kind == "developer":
            _set_colour_value(developer, colour, pct)
        elif kind == "fuser" and fuser_pct is None:
            fuser_pct = pct
        elif kind == "waste_box" and waste_box_pct is None:
            waste_box_pct = pct
        elif kind == "drum" and drum_pct is None:
            drum_pct = pct

    return {
        "toner": toner,
        "developer": developer,
        "fuser_pct": fuser_pct,
        "waste_box_pct": waste_box_pct,
        "drum_pct": drum_pct,
    }


def poll_printer(
    ip_address: str,
    community: str = SNMP_COMMUNITY,
    printer_id: Optional[str] = None,
    name: Optional[str] = None,
    model: Optional[str] = None,
    include_enterprise: bool = False,
) -> Dict[str, Any]:
    polled_at = datetime.now(timezone.utc).isoformat()

    identity: Dict[str, Optional[str]] = {key: None for key in OID}
    identity["sys_descr"] = get(ip_address, community, OID["sys_descr"])
    if not identity["sys_descr"]:
        identity["sys_name"] = get(ip_address, community, OID["sys_name"])

    if not identity["sys_descr"] and not identity["sys_name"]:
        return {
            "printer_id": printer_id,
            "name": name,
            "model": model,
            "ip_address": ip_address,
            "polled_at": polled_at,
            "is_online": False,
            "printer_status": None,
            "error_description": "No SNMP response",
            "identity": identity,
            "total_pages": None,
            "colour_pages": None,
            "mono_pages": None,
            "consumables": [],
            "paper_trays": [],
            "toner": {"black": None, "cyan": None, "magenta": None, "yellow": None},
            "developer": {"black": None, "cyan": None, "magenta": None, "yellow": None},
            "fuser_pct": None,
            "waste_box_pct": None,
            "drum_pct": None,
            "raw_data": {
                "identity": identity,
                "marker_rows": [],
                "supply_rows": [],
                "input_rows": [],
                "alert_rows": [],
                "marker_table": {},
                "supply_table": {},
                "input_table": {},
                "enterprise_summaries": [],
            },
        }

    for key, oid in OID.items():
        if identity[key] is None:
            identity[key] = get(ip_address, community, oid)

    marker_rows = walk(ip_address, community, WALK_PREFIXES["marker"])
    supply_rows = walk(ip_address, community, WALK_PREFIXES["supplies"])
    input_rows = walk(ip_address, community, WALK_PREFIXES["input"])
    alert_rows = walk(ip_address, community, WALK_PREFIXES["alerts"])

    marker_table = _bucket_table(marker_rows, MARKER_COLUMNS)
    supply_table = _bucket_table(supply_rows, SUPPLY_COLUMNS)
    input_table = _bucket_table(input_rows, INPUT_COLUMNS)

    is_online = any(identity.values()) or bool(marker_rows or supply_rows or input_rows)
    total_pages = _first_int(marker_table, "life_count")
    consumables = _normalise_consumables(supply_table)
    paper_trays = _normalise_paper_trays(input_table)
    consumable_summary = _build_consumable_summary(consumables)

    enterprise_summaries = []
    if include_enterprise:
        for label, root in KONICA_MINOLTA_CANDIDATE_ROOTS:
            rows = walk(ip_address, community, root)
            enterprise_summaries.append(
                {
                    "label": label,
                    "root": root,
                    "row_count": len(rows),
                    "sample_rows": rows[:50],
                }
            )

    printer_status_label = _status_label(identity.get("printer_status"), PRINTER_STATUS_MAP)
    hr_status_label = _status_label(identity.get("hr_printer_status"), HR_PRINTER_STATUS_MAP)
    status_parts = [part for part in [printer_status_label, hr_status_label] if part]
    printer_status = " / ".join(status_parts) if status_parts else None
    error_description = None if is_online else "No SNMP response"
    if is_online:
        error_description = _summarise_alerts(alert_rows, identity.get("hr_error_state"))

    return {
        "printer_id": printer_id,
        "name": name,
        "model": model,
        "ip_address": ip_address,
        "polled_at": polled_at,
        "is_online": is_online,
        "printer_status": printer_status,
        "error_description": error_description,
        "identity": identity,
        "total_pages": total_pages,
        "colour_pages": None,
        "mono_pages": None,
        "consumables": consumables,
        "paper_trays": paper_trays,
        **consumable_summary,
        "raw_data": {
            "identity": identity,
            "marker_rows": marker_rows,
            "supply_rows": supply_rows,
            "input_rows": input_rows,
            "alert_rows": alert_rows,
            "marker_table": marker_table,
            "supply_table": supply_table,
            "input_table": input_table,
            "enterprise_summaries": enterprise_summaries,
        },
    }


def _format_value(value: Optional[Any]) -> str:
    if value in (None, ""):
        return "not found"
    return str(value)


def _section(lines: List[str], title: str) -> None:
    lines.append("")
    lines.append("=" * 80)
    lines.append(title)
    lines.append("=" * 80)


def _kv(lines: List[str], label: str, value: Optional[Any]) -> None:
    lines.append(f"{label:<28} {_format_value(value)}")


def _raw_walk(lines: List[str], title: str, rows: List[Tuple[str, str]], limit: int = 25) -> None:
    lines.append(f"{title}: {len(rows)} rows")
    for oid, value in rows[:limit]:
        lines.append(f"  {oid:<50} {value}")
    if len(rows) > limit:
        lines.append(f"  ... {len(rows) - limit} more rows")


def format_discovery_report(result: Dict[str, Any], community: str = SNMP_COMMUNITY) -> str:
    identity = result["identity"]
    raw_data = result["raw_data"]
    lines: List[str] = [
        f"SNMP discovery target: {result['ip_address']}",
        f"Community: {community}",
    ]

    _section(lines, "Device Identity")
    _kv(lines, "System name", identity.get("sys_name"))
    _kv(lines, "Printer name", identity.get("printer_name"))
    _kv(lines, "Description", identity.get("sys_descr"))
    _kv(lines, "Serial number", identity.get("printer_serial"))
    _kv(lines, "Location", identity.get("sys_location"))

    _section(lines, "Page Counters")
    _kv(lines, "Total pages", result.get("total_pages"))
    _kv(lines, "Colour pages", result.get("colour_pages"))
    _kv(lines, "Mono pages", result.get("mono_pages"))
    lines.append("Marker table rows:")
    marker_table = raw_data["marker_table"]
    if marker_table:
        for index, row in sorted(marker_table.items()):
            lines.append(
                f"  marker {index}: life_count={row.get('life_count', 'n/a')}, "
                f"power_on_count={row.get('power_on_count', 'n/a')}"
            )
    else:
        lines.append("  none found")

    _section(lines, "Consumables")
    if result["consumables"]:
        for consumable in result["consumables"]:
            lines.append(f"Consumable index {consumable['index']}")
            lines.append(f"  Description : {_format_value(consumable.get('description'))}")
            lines.append(f"  Category    : {consumable.get('kind', 'other')}")
            lines.append(f"  Colour      : {consumable.get('colour', 'N/A')}")
            lines.append(f"  Current     : {_format_value(consumable.get('level'))}")
            lines.append(f"  Max         : {_format_value(consumable.get('max'))}")
            lines.append(f"  Calculated %: {consumable.get('percent_label', 'n/a')}")
            lines.append(f"  Type/Class  : {consumable.get('type') or 'n/a'} / {consumable.get('class') or 'n/a'}")
    else:
        lines.append("No consumables found.")
    lines.append("")
    lines.append("SNMP special values: -2 = unknown, -3 = present but no numeric value")

    _section(lines, "Paper Trays")
    if result["paper_trays"]:
        for tray in result["paper_trays"]:
            lines.append(f"Tray index {tray['index']}")
            lines.append(f"  Name        : {_format_value(tray.get('name'))}")
            lines.append(f"  Media size  : {_format_value(tray.get('media_size'))}")
            lines.append(f"  Current     : {_format_value(tray.get('level'))}")
            lines.append(f"  Max         : {_format_value(tray.get('max'))}")
            lines.append(f"  Calculated %: {tray.get('percent_label', 'n/a')}")
    else:
        lines.append("No paper trays found.")

    _section(lines, "Printer Status and Error State")
    _kv(lines, "Online", result.get("is_online"))
    _kv(lines, "Status", result.get("printer_status"))
    _kv(lines, "Error description", result.get("error_description"))
    _raw_walk(lines, "Alert table", raw_data["alert_rows"], limit=20)

    _section(lines, "Konica Minolta Specific OIDs")
    enterprise_summaries = raw_data.get("enterprise_summaries") or []
    if enterprise_summaries:
        for summary in enterprise_summaries:
            _raw_walk(
                lines,
                f"{summary['label']} ({summary['root']})",
                summary["sample_rows"],
                limit=25,
            )
            if summary["row_count"] > len(summary["sample_rows"]):
                lines.append(f"  ... {summary['row_count'] - len(summary['sample_rows'])} more rows")
    else:
        lines.append("Enterprise OID walks were not requested.")

    _section(lines, "Raw Standard Printer MIB Walk Summary")
    _raw_walk(lines, "Marker table raw walk", raw_data["marker_rows"], limit=15)
    _raw_walk(lines, "Supplies table raw walk", raw_data["supply_rows"], limit=15)
    _raw_walk(lines, "Input table raw walk", raw_data["input_rows"], limit=15)

    return "\n".join(lines)
