import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
SNMP_COMMUNITY = os.getenv("SNMP_COMMUNITY", "public").strip()
SNMP_VERSION = os.getenv("SNMP_VERSION", "2c").strip().lower()
SNMP_PORT = int(os.getenv("SNMP_PORT", "161"))
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "60"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()
# Filter polls to printers whose IP starts with this prefix.
# Baker Street: 192.168.21.   Rainbow Park: 192.168.20.   (empty = poll all)
POLL_IP_PREFIX = os.getenv("POLL_IP_PREFIX", "").strip()

PRINTERS = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Olivetti d-Color MF257",
        "ip_address": "192.168.20.250",
        "model": "d-Color MF257",
        "is_colour": True,
        "snmp_enabled": True,
    },
    {
        "id": "00000000-0000-0000-0000-000000000002",
        "name": "Olivetti d-Color MF459",
        "ip_address": "192.168.20.xxx",
        "model": "d-Color MF459",
        "is_colour": True,
        "snmp_enabled": True,
    },
    {
        "id": "00000000-0000-0000-0000-000000000003",
        "name": "Olivetti d-Copia 4024MF Plus 1",
        "ip_address": "192.168.20.xxx",
        "model": "d-Copia 4024MF Plus",
        "is_colour": False,
        "snmp_enabled": True,
    },
    {
        "id": "00000000-0000-0000-0000-000000000004",
        "name": "Olivetti d-Copia 4024MF Plus 2",
        "ip_address": "192.168.20.xxx",
        "model": "d-Copia 4024MF Plus",
        "is_colour": False,
        "snmp_enabled": True,
    },
    {
        "id": "00000000-0000-0000-0000-000000000005",
        "name": "Olivetti d-Copia 4024MF Plus 3",
        "ip_address": "192.168.20.xxx",
        "model": "d-Copia 4024MF Plus",
        "is_colour": False,
        "snmp_enabled": True,
    },
]

TONER_FLAG_THRESHOLDS = {
    76: "New",
    51: "In Use",
    26: "Half",
    1: "Order Now",
    0: "Empty",
}

ALERT_THRESHOLDS = {
    "toner_order_pct": 25,
    "waste_box_warn_pct": 80,
    "fuser_warn_pct": 20,
    "paper_reams_warn": 2,
}
