// Fleet-level SNMP poll.
// POST /api/printers/poll — polls all SNMP-enabled printers (or all at a site).
// Body (optional): { locationId?: string, previewOnly?: boolean }
// When previewOnly=true: polls and returns results but does NOT save to DB.
// Printers are polled in parallel; failures are captured per-printer, not fatal.

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

type ColourLevels = { black: number | null; cyan: number | null; magenta: number | null; yellow: number | null };
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
  consumables?: Array<{ description?: string | null; colour?: string | null; kind?: string | null; percent?: number | null; percent_label?: string | null }>;
  paper_trays?: Array<{ name?: string | null; media_size?: string | null; level?: number | null; max?: number | null; percent?: number | null; percent_label?: string | null }>;
  raw_data?: Json;
};
type ReadingInsert = Database["public"]["Tables"]["printer_snmp_readings"]["Insert"];
type PrinterUpdate = Database["public"]["Tables"]["printers"]["Update"];
type PrinterMeterReadingInsert = Database["public"]["Tables"]["printer_meter_readings"]["Insert"];

type FleetPrinter = {
  id: string;
  name: string;
  ip_address: string | null;
  model: string | null;
  status: string;
  location_id: string | null;
  snmp_enabled: boolean;
  locations?: { name: string | null } | null;
};

function getPollerPythonPath() {
  const venvPython = path.join(process.cwd(), "poller", "venv", "Scripts", "python.exe");
  return existsSync(venvPython) ? venvPython : "python";
}

function clampPct(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tonerStatusFromLevels(toner?: ColourLevels): string | null {
  const values = Object.values(toner ?? {}).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  const lowest = Math.min(...values);
  if (lowest <= 0) return "Out";
  if (lowest <= 10) return "Critical";
  if (lowest <= 25) return "Low";
  return "OK";
}

async function pollOnePrinter(printer: { id: string; name: string; ip_address: string; model: string | null }): Promise<PollerResult> {
  const { stdout, stderr } = await execFileAsync(
    getPollerPythonPath(),
    [
      path.join(process.cwd(), "poller", "printer_poller.py"),
      "--printer-id", printer.id,
      "--ip",         printer.ip_address,
      "--name",       printer.name,
      "--model",      printer.model ?? "",
    ],
    {
      cwd: path.join(process.cwd(), "poller"),
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      timeout: 90_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    }
  );
  if (stderr.trim()) console.warn(`[fleet-poll] ${printer.name} stderr:`, stderr.trim());
  return JSON.parse(stdout) as PollerResult;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (user.app_metadata?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  let locationId: string | undefined;
  let previewOnly = false;
  try {
    const body = await request.json().catch(() => ({}));
    locationId = body?.locationId ?? undefined;
    previewOnly = Boolean(body?.previewOnly);
  } catch { /* no body */ }

  // Fetch candidates first so disabled SNMP records can be reported instead of silently skipped.
  let query = supabase
    .from("printers")
    .select("id, name, ip_address, model, status, location_id, snmp_enabled, locations(name)")
    .not("ip_address", "is", null)
    .is("archived_at", null);

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data: candidateRows, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  const candidates = (candidateRows ?? []) as unknown as FleetPrinter[];
  if (candidates.length === 0) {
    return NextResponse.json({ success: true, polled: 0, skippedDisabled: 0, results: [] });
  }

  const printers = candidates.filter((printer) => printer.snmp_enabled);
  const disabledPrinters = candidates.filter((printer) => !printer.snmp_enabled);
  const disabled = disabledPrinters.map((printer) => ({ printerId: printer.id, name: printer.name }));

  if (printers.length === 0) {
    const locationName = candidates[0]?.locations?.name;
    const scope = locationName ? ` at ${locationName}` : "";
    const disabledNames = disabledPrinters.map((printer) => printer.name).join(", ");
    const disabledMessage = disabledPrinters.length > 0
      ? `${disabledPrinters.length} printer${disabledPrinters.length !== 1 ? "s are" : " is"} disabled in the app: ${disabledNames}.`
      : "No matching printers have app-side SNMP monitoring enabled.";

    return NextResponse.json(
      {
        error: `No SNMP-enabled printers found${scope}. ${disabledMessage}`,
        success: false,
        polled: 0,
        skippedDisabled: disabledPrinters.length,
        disabled,
        results: [],
      },
      { status: 400 }
    );
  }

  // Poll all in parallel — failures are captured per-printer
  const now = new Date().toISOString();
  const polledSettled = await Promise.allSettled(
    printers.map(async (printer) => {
      if (!printer.ip_address) throw new Error("No IP");
      const result = await pollOnePrinter({
        id: printer.id,
        name: printer.name,
        ip_address: printer.ip_address,
        model: printer.model,
      });
      return { printer, result, polledAt: result.polled_at ?? now };
    })
  );

  // When previewOnly: return raw data without saving anything
  if (previewOnly) {
    const previewResults = polledSettled.map((r, i) => {
      if (r.status === "rejected") {
        return {
          printer_id: printers[i].id,
          name: printers[i].name,
          ip_address: printers[i].ip_address ?? "",
          polled_at: now,
          is_online: false,
          error: r.reason instanceof Error ? r.reason.message : "Poll failed",
        };
      }
      const { printer, result, polledAt } = r.value;
      return {
        printer_id: printer.id,
        name: printer.name,
        ip_address: printer.ip_address ?? "",
        polled_at: polledAt,
        is_online: Boolean(result.is_online),
        printer_status: result.printer_status ?? null,
        error_description: result.error_description ?? null,
        total_pages: result.total_pages ?? null,
        toner: result.toner ?? null,
        developer: result.developer ?? null,
        fuser_pct: result.fuser_pct ?? null,
        waste_box_pct: result.waste_box_pct ?? null,
        drum_pct: result.drum_pct ?? null,
        consumables: result.consumables ?? [],
        paper_trays: result.paper_trays ?? [],
        raw_data: result.raw_data ?? null,
        error: null,
      };
    });

    return NextResponse.json({
      previewOnly: true,
      polled: printers.length,
      skippedDisabled: disabledPrinters.length,
      disabled,
      results: previewResults,
    });
  }

  // Save mode: write all results to DB
  const results = await Promise.allSettled(
    polledSettled.map(async (settled) => {
      if (settled.status === "rejected") throw settled.reason;

      const { printer, result, polledAt } = settled.value;
      const toner = result.toner ?? { black: null, cyan: null, magenta: null, yellow: null };
      const developer = result.developer ?? { black: null, cyan: null, magenta: null, yellow: null };
      const rawDataRecord = result.raw_data && typeof result.raw_data === "object" && !Array.isArray(result.raw_data)
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
      if (insertError) throw new Error(`Could not save SNMP reading: ${insertError.message}`);

      const update: PrinterUpdate = { last_snmp_polled_at: polledAt, updated_at: now };
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
        if (meterError) throw new Error(`Could not save meter reading: ${meterError.message}`);
      }
      const { error: updateError } = await supabase.from("printers").update(update).eq("id", printer.id);
      if (updateError) throw new Error(`Could not update printer after poll: ${updateError.message}`);

      return {
        printerId: printer.id,
        name: printer.name,
        isOnline: Boolean(result.is_online),
        status: result.printer_status ?? null,
        totalPages: result.total_pages ?? null,
        toner,
      };
    })
  );

  revalidatePath("/printers");

  const summary = results.map((r, i) => {
    if (r.status === "fulfilled") return { ...r.value, error: null };
    return {
      printerId: printers[i].id,
      name: printers[i].name,
      isOnline: false,
      status: null,
      totalPages: null,
      toner: null,
      error: r.reason instanceof Error ? r.reason.message : "Poll failed",
    };
  });

  const online  = summary.filter((s) => s.isOnline).length;
  const offline = summary.filter((s) => !s.isOnline && !s.error).length;
  const errors  = summary.filter((s) => !!s.error).length;

  return NextResponse.json({
    success: true,
    polled: printers.length,
    online,
    offline,
    errors,
    skippedDisabled: disabledPrinters.length,
    disabled,
    results: summary,
  });
}
