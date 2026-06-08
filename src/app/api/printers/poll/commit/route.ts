// Commit selected SNMP poll preview results to the database.
// POST /api/printers/poll/commit
// Body: { results: PreviewResult[] }  — send only the results the user selected.

import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ColourLevels = { black: number | null; cyan: number | null; magenta: number | null; yellow: number | null };

export type PreviewResult = {
  printer_id: string;
  name: string;
  ip_address: string;
  polled_at: string;
  is_online: boolean;
  printer_status?: string | null;
  error_description?: string | null;
  total_pages?: number | null;
  toner?: ColourLevels | null;
  developer?: ColourLevels | null;
  fuser_pct?: number | null;
  waste_box_pct?: number | null;
  drum_pct?: number | null;
  consumables?: Array<{ description?: string | null; colour?: string | null; kind?: string | null; percent?: number | null; percent_label?: string | null }>;
  paper_trays?: Array<{ name?: string | null; media_size?: string | null; level?: number | null; max?: number | null; percent?: number | null; percent_label?: string | null }>;
  raw_data?: Json | null;
  error: string | null;
};

type ReadingInsert = Database["public"]["Tables"]["printer_snmp_readings"]["Insert"];
type PrinterUpdate = Database["public"]["Tables"]["printers"]["Update"];
type PrinterMeterReadingInsert = Database["public"]["Tables"]["printer_meter_readings"]["Insert"];

function clampPct(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tonerStatusFromLevels(toner?: ColourLevels | null): string | null {
  if (!toner) return null;
  const values = Object.values(toner).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  const lowest = Math.min(...values);
  if (lowest <= 0) return "Out";
  if (lowest <= 10) return "Critical";
  if (lowest <= 25) return "Low";
  return "OK";
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (user.app_metadata?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  let results: PreviewResult[] = [];
  try {
    const body = await request.json();
    results = body?.results ?? [];
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "No results to save." }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Fetch current printer statuses so we can preserve "Retired" status
  const printerIds = results.map((r) => r.printer_id);
  const { data: printerRows } = await supabase
    .from("printers")
    .select("id, status")
    .in("id", printerIds);
  const statusById: Record<string, string> = {};
  for (const p of printerRows ?? []) statusById[p.id] = p.status;

  const saved: string[] = [];
  const errors: { printer_id: string; name: string; error: string }[] = [];

  for (const r of results) {
    if (r.error) {
      errors.push({ printer_id: r.printer_id, name: r.name, error: r.error });
      continue;
    }

    try {
      const polledAt = r.polled_at ?? now;
      const toner = r.toner ?? { black: null, cyan: null, magenta: null, yellow: null };
      const developer = r.developer ?? { black: null, cyan: null, magenta: null, yellow: null };
      const rawDataRecord = r.raw_data && typeof r.raw_data === "object" && !Array.isArray(r.raw_data)
        ? (r.raw_data as Record<string, Json>)
        : {};

      const reading: ReadingInsert = {
        printer_id: r.printer_id,
        polled_at: polledAt,
        is_online: Boolean(r.is_online),
        printer_status: r.printer_status ?? null,
        error_description: r.error_description ?? null,
        total_pages: r.total_pages ?? null,
        colour_pages: null,
        mono_pages: null,
        black_toner_pct: clampPct(toner.black),
        cyan_toner_pct: clampPct(toner.cyan),
        magenta_toner_pct: clampPct(toner.magenta),
        yellow_toner_pct: clampPct(toner.yellow),
        black_developer_pct: clampPct(developer.black),
        cyan_developer_pct: clampPct(developer.cyan),
        magenta_developer_pct: clampPct(developer.magenta),
        yellow_developer_pct: clampPct(developer.yellow),
        fuser_pct: clampPct(r.fuser_pct),
        waste_box_pct: clampPct(r.waste_box_pct),
        drum_pct: clampPct(r.drum_pct),
        raw_data: {
          ...rawDataRecord,
          consumables: r.consumables ?? [],
          paper_trays: r.paper_trays ?? [],
          identity: rawDataRecord.identity ?? null,
        } as Json,
      };

      const { error: insertError } = await supabase.from("printer_snmp_readings").insert(reading);
      if (insertError) throw new Error(`SNMP reading: ${insertError.message}`);

      const update: PrinterUpdate = { last_snmp_polled_at: polledAt, updated_at: now };
      const tonerStatus = tonerStatusFromLevels(toner);
      if (tonerStatus) update.toner_status = tonerStatus;
      if (statusById[r.printer_id] !== "Retired") {
        update.status = r.is_online ? (r.error_description ? "Needs Attention" : "Active") : "Offline";
      }
      if (typeof r.total_pages === "number" && Number.isFinite(r.total_pages)) {
        update.last_meter_reading = r.total_pages;
        update.last_meter_reading_at = polledAt.slice(0, 10);
        const meterReading: PrinterMeterReadingInsert = {
          printer_id: r.printer_id,
          reading: r.total_pages,
          reading_at: polledAt.slice(0, 10),
          notes: "Captured automatically by SNMP poll",
        };
        const { error: meterError } = await supabase.from("printer_meter_readings").insert(meterReading);
        if (meterError) throw new Error(`Meter reading: ${meterError.message}`);
      }

      const { error: updateError } = await supabase.from("printers").update(update).eq("id", r.printer_id);
      if (updateError) throw new Error(`Printer update: ${updateError.message}`);

      saved.push(r.printer_id);
    } catch (err) {
      errors.push({
        printer_id: r.printer_id,
        name: r.name,
        error: err instanceof Error ? err.message : "Save failed",
      });
    }
  }

  revalidatePath("/printers");

  return NextResponse.json({
    success: true,
    saved: saved.length,
    errors: errors.length,
    errorDetails: errors,
  });
}
