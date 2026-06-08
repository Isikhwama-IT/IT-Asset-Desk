# Printer SNMP Poller

This folder contains the Windows-friendly Python structure for polling Olivetti/Konica Minolta printers over SNMP and writing the results to Supabase.

## 1. Create and activate a virtual environment

From the project root:

```powershell
cd ".\poller"
python -m venv venv
.\venv\Scripts\activate
```

## 2. Install dependencies

```powershell
pip install -r requirements.txt
```

## 3. Create `.env`

Copy the example:

```powershell
copy .env.example .env
```

Edit `.env` and fill in:

```text
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SNMP_COMMUNITY=public
SNMP_PORT=161
POLL_INTERVAL_MINUTES=60
LOG_LEVEL=INFO
```

Use the Supabase service role key only on this trusted Windows machine. Do not expose it in the web app or browser.

## 4. Add printer IDs and IPs

Open `config.py` and update `PRINTERS`.

Each printer entry has:

```python
{
    "id": "Supabase printer UUID",
    "name": "Printer display name",
    "ip_address": "Printer IP address",
    "model": "Printer model",
    "is_colour": True,
    "snmp_enabled": True,
}
```

Replace the placeholder UUIDs with the IDs from the `printers` table in Supabase.

## 5. Verify SNMP connectivity first

Before polling all printers, run discovery against one printer:

```powershell
python printer_discovery.py
```

The default target IP is set at the top of `printer_discovery.py`:

```python
DISCOVERY_IP = "192.168.20.250"
```

You can also pass any printer IP directly:

```powershell
python printer_discovery.py --ip 192.168.21.15
```

For the app-driven flow, the web app reads the selected printer from the `printers` table and passes that printer's `ip_address` into `printer_poller.py`. Open the printer detail page and click **Poll SNMP**.

If a printer is reachable by ping but returns `No SNMP response`, check the printer admin settings for:

- SNMP enabled
- community string set to `public` or the same value as `SNMP_COMMUNITY`
- SNMP v1/v2c allowed
- UDP port `161` allowed from this Windows machine

You can set `SNMP_VERSION=1`, `SNMP_VERSION=2c`, or `SNMP_VERSION=auto` in `.env`.

The discovery report prints:

- Device identity
- Page counters
- Consumables
- Paper trays
- Printer status and error state
- Konica Minolta candidate enterprise OIDs
- Raw Printer MIB walk summaries

SNMP special values are handled as:

- `-2` means unknown
- `-3` means present, but no numeric value

## 6. Run the poller manually

Phase 3 will implement the actual Supabase write logic in `printer_poller.py`.

For now, the batch file is ready:

```powershell
.\run_poller.bat
```

Output is appended to:

```text
poller.log
```

## 7. Schedule with Windows Task Scheduler

1. Open **Task Scheduler**.
2. Click **Create Task**.
3. On **General**:
   - Name: `ISIBAG Printer SNMP Poller`
   - Select **Run whether user is logged on or not**
   - Select **Run with highest privileges**
4. On **Triggers**:
   - Click **New**
   - Begin the task: **On a schedule**
   - Daily, repeat task every **1 hour**
   - For a duration of **Indefinitely**
5. On **Actions**:
   - Click **New**
   - Action: **Start a program**
   - Program/script:
     ```text
     C:\Users\IT\OneDrive - Isikhwama Manufacturing (Pty) Ltd\Development Hub\Projects\itasset\poller\run_poller.bat
     ```
   - Start in:
     ```text
     C:\Users\IT\OneDrive - Isikhwama Manufacturing (Pty) Ltd\Development Hub\Projects\itasset\poller
     ```
6. On **Conditions**:
   - Clear **Start the task only if the computer is on AC power** if this is a desktop/server.
7. On **Settings**:
   - Enable **Run task as soon as possible after a scheduled start is missed**
   - Enable **If the task fails, restart every 10 minutes**
8. Save the task and enter the Windows account password if prompted.

## 8. Updating printers later

To add a printer:

1. Add it to the Supabase `printers` table.
2. Copy its UUID.
3. Add a new entry to `PRINTERS` in `config.py`.
4. Set the correct IP address, model, and `is_colour`.
5. Run `python printer_discovery.py` against its IP to confirm SNMP output.
