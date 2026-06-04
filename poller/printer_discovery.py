from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Optional, Tuple

from config import SNMP_COMMUNITY
from snmp_client import get, walk


DISCOVERY_IP = "192.168.20.250"

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

HR_PRINTER_STATUS_MAP = {
    "1": "other",
    "2": "unknown",
    "3": "idle",
    "4": "printing",
    "5": "warmup",
}

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


def _pct(level_value: Optional[str], max_value: Optional[str]) -> str:
    level = _as_int(level_value)
    max_capacity = _as_int(max_value)
    special = _special_value(level) or _special_value(max_capacity)
    if special:
        return special
    if level is None or max_capacity is None or max_capacity <= 0:
        return "n/a"
    return f"{round((level / max_capacity) * 100)}%"


def _guess_colour(description: Optional[str]) -> str:
    text = (description or "").lower()
    if "black" in text or "k " in text:
        return "Black"
    if "cyan" in text:
        return "Cyan"
    if "magenta" in text:
        return "Magenta"
    if "yellow" in text:
        return "Yellow"
    return "N/A"


def _format_value(value: Optional[str]) -> str:
    if value in (None, ""):
        return "not found"
    return value


def _print_section(title: str) -> None:
    print()
    print("=" * 80)
    print(title)
    print("=" * 80)


def _print_kv(label: str, value: Optional[str]) -> None:
    print(f"{label:<28} {_format_value(value)}")


def _print_raw_walk(title: str, rows: List[Tuple[str, str]], limit: int = 25) -> None:
    print(f"{title}: {len(rows)} rows")
    for oid, value in rows[:limit]:
        print(f"  {oid:<50} {value}")
    if len(rows) > limit:
        print(f"  ... {len(rows) - limit} more rows")


def main() -> None:
    print(f"SNMP discovery target: {DISCOVERY_IP}")
    print(f"Community: {SNMP_COMMUNITY}")

    identity = {name: get(DISCOVERY_IP, SNMP_COMMUNITY, oid) for name, oid in OID.items()}

    marker_rows = walk(DISCOVERY_IP, SNMP_COMMUNITY, WALK_PREFIXES["marker"])
    supply_rows = walk(DISCOVERY_IP, SNMP_COMMUNITY, WALK_PREFIXES["supplies"])
    input_rows = walk(DISCOVERY_IP, SNMP_COMMUNITY, WALK_PREFIXES["input"])
    alert_rows = walk(DISCOVERY_IP, SNMP_COMMUNITY, WALK_PREFIXES["alerts"])

    marker_table = _bucket_table(marker_rows, MARKER_COLUMNS)
    supply_table = _bucket_table(supply_rows, SUPPLY_COLUMNS)
    input_table = _bucket_table(input_rows, INPUT_COLUMNS)

    _print_section("Device Identity")
    _print_kv("System name", identity["sys_name"])
    _print_kv("Printer name", identity["printer_name"])
    _print_kv("Description", identity["sys_descr"])
    _print_kv("Serial number", identity["printer_serial"])
    _print_kv("Location", identity["sys_location"])

    _print_section("Page Counters")
    total_pages = None
    for row in marker_table.values():
        if row.get("life_count"):
            total_pages = row["life_count"]
            break
    _print_kv("Total pages", total_pages)
    _print_kv("Colour pages", None)
    _print_kv("Mono pages", None)
    print("Marker table rows:")
    if marker_table:
        for index, row in sorted(marker_table.items()):
            print(f"  marker {index}: life_count={row.get('life_count', 'n/a')}, power_on_count={row.get('power_on_count', 'n/a')}")
    else:
        print("  none found")

    _print_section("Consumables")
    if supply_table:
        for index, row in sorted(supply_table.items(), key=lambda item: item[0]):
            description = row.get("description")
            print(f"Consumable index {index}")
            print(f"  Description : {_format_value(description)}")
            print(f"  Colour      : {_guess_colour(description)}")
            print(f"  Current     : {_format_value(row.get('level'))}")
            print(f"  Max         : {_format_value(row.get('max'))}")
            print(f"  Calculated %: {_pct(row.get('level'), row.get('max'))}")
            print(f"  Type/Class  : {row.get('type', 'n/a')} / {row.get('class', 'n/a')}")
    else:
        print("No consumables found.")
    print()
    print("SNMP special values: -2 = unknown, -3 = present but no numeric value")

    _print_section("Paper Trays")
    if input_table:
        for index, row in sorted(input_table.items(), key=lambda item: item[0]):
            print(f"Tray index {index}")
            print(f"  Name        : {_format_value(row.get('tray_name'))}")
            print(f"  Media size  : {_format_value(row.get('media_name'))}")
            print(f"  Current     : {_format_value(row.get('level'))}")
            print(f"  Max         : {_format_value(row.get('max'))}")
    else:
        print("No paper trays found.")

    _print_section("Printer Status and Error State")
    printer_status = identity["printer_status"]
    hr_status = identity["hr_printer_status"]
    _print_kv("Printer-MIB status", f"{printer_status} ({PRINTER_STATUS_MAP.get(printer_status or '', 'unmapped')})" if printer_status else None)
    _print_kv("Host Resources status", f"{hr_status} ({HR_PRINTER_STATUS_MAP.get(hr_status or '', 'unmapped')})" if hr_status else None)
    _print_kv("Detected error state", identity["hr_error_state"])
    _print_raw_walk("Alert table", alert_rows, limit=20)

    _print_section("Konica Minolta Specific OIDs")
    for label, root in KONICA_MINOLTA_CANDIDATE_ROOTS:
        rows = walk(DISCOVERY_IP, SNMP_COMMUNITY, root)
        _print_raw_walk(f"{label} ({root})", rows, limit=25)

    _print_section("Raw Standard Printer MIB Walk Summary")
    _print_raw_walk("Marker table raw walk", marker_rows, limit=15)
    _print_raw_walk("Supplies table raw walk", supply_rows, limit=15)
    _print_raw_walk("Input table raw walk", input_rows, limit=15)


if __name__ == "__main__":
    main()
