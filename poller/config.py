import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
SNMP_COMMUNITY = os.getenv("SNMP_COMMUNITY", "public").strip()
SNMP_PORT = int(os.getenv("SNMP_PORT", "161"))
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "60"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()

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
    100: "New",
    75: "In Use",
    50: "Half",
    25: "Order Now",
    0: "Empty",
}

ALERT_THRESHOLDS = {
    "toner_order_pct": 25,
    "waste_box_warn_pct": 80,
    "fuser_warn_pct": 20,
    "paper_reams_warn": 2,
}
