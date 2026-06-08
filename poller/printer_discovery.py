from __future__ import annotations

import argparse

from config import SNMP_COMMUNITY
from printer_probe import format_discovery_report, poll_printer


DISCOVERY_IP = "192.168.20.250"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a verbose SNMP discovery against one printer.")
    parser.add_argument("--ip", default=DISCOVERY_IP, help="Printer IP address to discover.")
    parser.add_argument("--community", default=SNMP_COMMUNITY, help="SNMP community string.")
    args = parser.parse_args()

    result = poll_printer(args.ip, community=args.community, include_enterprise=True)
    print(format_discovery_report(result, community=args.community))


if __name__ == "__main__":
    main()
