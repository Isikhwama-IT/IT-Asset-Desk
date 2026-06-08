import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type ColourLevels = {
  black: number | null;
  cyan: number | null;
  magenta: number | null;
  yellow: number | null;
};

type PollerResult = {
  printer_id: string;
  name: string | null;
  model: string | null;
  ip_address: string;
  polled_at?: string;
  is_online?: boolean;
  printer_status?: string | null;
  error_description?: string | null;
  total_pages?: number | null;
  colour_pages?: number | null;
  mono_pages?: number | null;
  toner?: ColourLevels;
  developer?: ColourLevels;
  fuser_pct?: number | null;
  waste_box_pct?: number | null;
  drum_pct?: number | null;
  consumables?: Array<{
    description?: string | null;
    colour?: string | null;
    kind?: string | null;
    percent?: number | null;
    percent_label?: string | null;
  }>;
  paper_trays?: Array<{
    name?: string | null;
    media_size?: string | null;
    level?: number | null;
    max?: number | null;
    percent?: number | null;
    percent_label?: string | null;
  }>;
  raw_data?: Json;
};

type ReadingInsert = Database["public"]["Tables"]["printer_snmp_readings"]["Insert"];
type PrinterUpdate = Database["public"]["Tables"]["printers"]["Update"];
type PrinterMeterReadingInsert = Database["public"]["Tables"]["printer_meter_readings"]["Insert"];

function getPollerPythonPath() {
  const venvPython = path.join(process.cwd(), "poller", "venv", "Scripts", "python.exe");
  return existsSync(venvPython) ? venvPython : "python";
}

function getPollerScriptPath() {
  return path.join(process.cwd(), "poller", "printer_poller.py");
}

function clampPct(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tonerStatusFromLevels(toner?: ColourLevels): string | null {
  const values = Object.values(toner ?? {}).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;

  const lowest = Math.min(...values);
  if (lowest <= 0) return "Out";
  if (lowest <= 10) return "Critical";
  if (lowest <= 25) return "Low";
  return "OK";
}

function compactSummary(result: PollerResult) {
  return {
    polledAt: result.polled_at ?? new Date().toISOString(),
    isOnline: Boolean(result.is_online),
    printerStatus: result.printer_status ?? null,
    errorDescription: result.error_description ?? null,
    totalPages: result.total_pages ?? null,
    colourPages: result.colour_pages ?? null,
    monoPages: result.mono_pages ?? null,
    toner: result.toner ?? { black: null, cyan: null, magenta: null, yellow: null },
    developer: result.developer ?? { black: null, cyan: null, magenta: null, yellow: null },
    fuserPct: result.fuser_pct ?? null,
    wasteBoxPct: result.waste_box_pct ?? null,
    drumPct: result.drum_pct ?? null,
    consumables: result.consumables ?? [],
    paperTrays: result.paper_trays ?? [],
  };
}

async function runPoller(printer: { id: string; name: string; ip_address: string; model: string | null }) {
  const { stdout, stderr } = await execFileAsync(
    getPollerPythonPath(),
    [
      getPollerScriptPath(),
      "--printer-id",
      printer.id,
      "--ip",
      printer.ip_address,
      "--name",
      printer.name,
      "--model",
      printer.model ?? "",
    ],
    {
      cwd: path.join(process.cwd(), "poller"),
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: "1",
      },
      timeout: 90_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    }
  );

  if (stderr.trim()) {
    console.warn("[printer-poll] poller stderr:", stderr.trim());
  }

  return JSON.parse(stdout) as PollerResult;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data: printer, error: printerError } = await supabase
    .from("printers")
    .select("id, name, ip_address, model, status, snmp_enabled")
    .eq("id", id)
    .single();

  if (printerError || !printer) {
    return NextResponse.json({ error: "Printer not found." }, { status: 404 });
  }
  if (!printer.ip_address) {
    return NextResponse.json({ error: "This printer does not have an IP address captured." }, { status: 400 });
  }
  if (printer.snmp_enabled === false) {
    return NextResponse.json(
      { error: "SNMP monitoring is disabled for this printer in the app. Enable automated monitoring (SNMP) in Edit Printer before polling." },
      { status: 400 }
    );
  }

  let result: PollerResult;
  try {
    result = await runPoller({
      id: printer.id,
      name: printer.name,
      ip_address: printer.ip_address,
      model: printer.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown poller error.";
    return NextResponse.json({ error: `Poller failed: ${message}` }, { status: 500 });
  }

  const polledAt = result.polled_at ?? new Date().toISOString();
  const toner = result.toner ?? { black: null, cyan: null, magenta: null, yellow: null };
  const developer = result.developer ?? { black: null, cyan: null, magenta: null, yellow: null };
  const rawDataRecord =
    result.raw_data && typeof result.raw_data === "object" && !Array.isArray(result.raw_data)
      ? (result.raw_data as Record<string, Json>)
      : {};

  const reading: ReadingInsert = {
    printer_id: printer.id,
    polled_at: polledAt,
    is_online: Boolean(result.is_online),
    printer_status: result.printer_status ?? null,
    error_description: result.error_description ?? null,
    total_pages: result.total_pages ?? null,
    colour_pages: result.colour_pages ?? null,
    mono_pages: result.mono_pages ?? null,
    black_toner_pct: clampPct(toner.black),
    cyan_toner_pct: clampPct(toner.cyan),
    magenta_toner_pct: clampPct(toner.magenta),
    yellow_toner_pct: clampPct(toner.yellow),
    black_developer_pct: clampPct(developer.black),
    cyan_developer_pct: clampPct(developer.cyan),
    magenta_developer_pct: clampPct(developer.magenta),
    yellow_developer_pct: clampPct(developer.yellow),
    fuser_pct: clampPct(result.fuser_pct),
    waste_box_pct: clampPct(result.waste_box_pct),
    drum_pct: clampPct(result.drum_pct),
    raw_data: {
      ...rawDataRecord,
      consumables: result.consumables ?? [],
      paper_trays: result.paper_trays ?? [],
      identity: rawDataRecord.identity ?? null,
    } as Json,
  };

  const { error: insertError } = await supabase.from("printer_snmp_readings").insert(reading);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const update: PrinterUpdate = {
    last_snmp_polled_at: polledAt,
    updated_at: new Date().toISOString(),
  };

  const tonerStatus = tonerStatusFromLevels(toner);
  if (tonerStatus) update.toner_status = tonerStatus;

  if (printer.status !== "Retired") {
    update.status = result.is_online ? (result.error_description ? "Needs Attention" : "Active") : "Offline";
  }

  if (typeof result.total_pages === "number" && Number.isFinite(result.total_pages)) {
    update.last_meter_reading = result.total_pages;
    update.last_meter_reading_at = polledAt.slice(0, 10);

    const meterReading: PrinterMeterReadingInsert = {
      printer_id: printer.id,
      reading: result.total_pages,
      reading_at: polledAt.slice(0, 10),
      notes: "Captured automatically by SNMP poll",
    };
    const { error: meterError } = await supabase.from("printer_meter_readings").insert(meterReading);
    if (meterError) {
      return NextResponse.json({ error: meterError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase.from("printers").update(update).eq("id", printer.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath("/printers");
  revalidatePath(`/printers/${printer.id}`);

  return NextResponse.json({
    success: true,
    reading,
    poll: compactSummary(result),
  });
}
