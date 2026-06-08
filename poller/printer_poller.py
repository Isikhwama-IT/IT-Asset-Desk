from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from config import SNMP_COMMUNITY
from printer_probe import poll_printer


def _json_default(value: Any) -> str:
    return str(value)


def main() -> int:
    parser = argparse.ArgumentParser(description="Poll one printer over SNMP and output structured JSON.")
    parser.add_argument("--printer-id", required=True, help="Supabase printer UUID.")
    parser.add_argument("--ip", required=True, help="Printer IP address.")
    parser.add_argument("--name", default="", help="Printer display name.")
    parser.add_argument("--model", default="", help="Printer model.")
    parser.add_argument("--community", default=SNMP_COMMUNITY, help="SNMP community string.")
    parser.add_argument("--include-enterprise", action="store_true", help="Also walk Konica/Olivetti enterprise roots.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    args = parser.parse_args()

    try:
        result = poll_printer(
            args.ip,
            community=args.community,
            printer_id=args.printer_id,
            name=args.name or None,
            model=args.model or None,
            include_enterprise=args.include_enterprise,
        )
    except Exception as exc:
        result = {
            "printer_id": args.printer_id,
            "ip_address": args.ip,
            "name": args.name or None,
            "model": args.model or None,
            "is_online": False,
            "error_description": f"Poller error: {exc}",
        }

    print(
        json.dumps(
            result,
            default=_json_default,
            indent=2 if args.pretty else None,
            separators=None if args.pretty else (",", ":"),
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
