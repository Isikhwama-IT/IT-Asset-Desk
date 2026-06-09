import Link from "next/link";
import { Activity, List, LayoutGrid } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  ConsumableType,
  LocationPaperStock,
  PrinterSnmpReading,
  PrinterTray,
  PrinterWithRelations,
} from "@/types/database";
import { computeCostEstimate } from "@/lib/predictions";
import {
  REAMS_PER_BOX_A4,
  SHEETS_PER_REAM_A4,
  SHEETS_PER_BOX_A4,
  SLOT_LABEL,
  getPrinterCapabilities,
  isConsumableCompatibleWithPrinter,
  type PaperSize,
  type TonerSlot,
} from "@/lib/printer-capabilities";
import AutoRefresh from "@/components/AutoRefresh";
import PrinterAlertBanner, { type PrinterAlert } from "@/components/PrinterAlertBanner";
import PrinterKpiCards, { type PrinterKpi, type SiteKpi } from "@/components/PrinterKpiCards";
import PrinterStatusGrid from "@/components/PrinterStatusGrid";
import PrintersClient from "@/components/PrintersClient";
import FleetActions from "@/components/FleetActions";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchParams {
  view?: string;
  q?: string;
  status?: string;
  toner?: string;
  paper?: string;
  site?: string;
  rpage?: string;
}

const READINGS_PER_PAGE = 60;

type MeterRow = {
  id: string;
  printer_id: string;
  reading: number;
  reading_at: string;
  notes: string | null;
};

type ReadingWithDelta = MeterRow & {
  printer_name: string;
  delta: number | null;
};

const PAPER_REAMS_WARN = 2;

function tonerPctForSlot(slot: TonerSlot, reading: PrinterSnmpReading | undefined): number | null {
  if (!reading) return null;
  if (slot === "combined") return reading.black_toner_pct;
  const key = `${slot}_toner_pct` as keyof PrinterSnmpReading;
  const value = reading[key];
  return typeof value === "number" ? value : null;
}

function tonerStockForSlot(printer: PrinterWithRelations, slot: TonerSlot): number {
  if (slot === "combined") return printer.black_toner_stock ?? 0;
  if (slot === "black") return printer.black_toner_stock ?? 0;
  return ((printer as Record<string, unknown>)[`${slot}_toner_stock`] as number | undefined) ?? 0;
}

// Returns null when the field was never recorded (null in DB), vs 0 when explicitly set to zero.
function tonerStockRawForSlot(printer: PrinterWithRelations, slot: TonerSlot): number | null {
  if (slot === "combined" || slot === "black") return printer.black_toner_stock;
  const raw = (printer as Record<string, unknown>)[`${slot}_toner_stock`];
  return typeof raw === "number" ? raw : null;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getAllData(params: SearchParams, readingsPage = 1) {
  const supabase = await createSupabaseServerClient();

  // All active printers (with relations for both monitor + fleet)
  let printerQuery = supabase
    .from("printers")
    .select(
      `*, department:departments(*), location:locations(*), primary_contact:contacts!printers_primary_contact_id_fkey(*)`,
      { count: "exact" }
    )
    .is("archived_at", null);

  if (params.q) {
    printerQuery = printerQuery.or(
      `name.ilike.%${params.q}%,serial_number.ilike.%${params.q}%,ip_address.ilike.%${params.q}%,manufacturer.ilike.%${params.q}%,model.ilike.%${params.q}%`
    );
  }
  if (params.status) {
    const v = params.status.split(",").filter(Boolean);
    if (v.length) printerQuery = printerQuery.in("status", v);
  }
  if (params.toner) {
    const v = params.toner.split(",").filter(Boolean);
    if (v.length) printerQuery = printerQuery.in("toner_status", v);
  }
  if (params.site) {
    const v = params.site.split(",").filter(Boolean);
    if (v.length) printerQuery = printerQuery.in("location_id", v);
  }

  const [
    { data: printers, count: total },
    { data: departments },
    { data: locations },
    { data: contacts },
  ] = await Promise.all([
    printerQuery.order("printer_code"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("locations").select("*").eq("is_active", true).order("name"),
    supabase.from("contacts").select("*").eq("is_active", true).order("full_name"),
  ]);

  const typedPrinters = (printers ?? []) as PrinterWithRelations[];
  const printerIds = typedPrinters.map((p) => p.id);

  if (printerIds.length === 0) {
    return {
      printers: typedPrinters,
      total: 0,
      departments: departments ?? [],
      locations: locations ?? [],
      contacts: contacts ?? [],
      latestByPrinter: {},
      meterRows: [],
      alerts: [],
      kpi: emptyKpi(),
      paperStockRows: [] as LocationPaperStock[],
      totalReadings: 0,
      readingsPage: 1,
    };
  }

  // Latest SNMP readings — last 7 days, bounded (uses printer_id+polled_at index)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // Readings log: all-time, paginated
  const readingsOffset = (readingsPage - 1) * READINGS_PER_PAGE;

  const [
    { data: snmpReadings },
    { data: meterReadings, count: totalReadings },
    { data: snmpDeltas },
    { data: monthMeters },
    { data: openTicketData, count: openTickets },
    { data: allConsumableTypes },
    { data: printerTrays },
    { data: paperStockRows },
  ] = await Promise.all([
    supabase.from("printer_snmp_readings").select("*").in("printer_id", printerIds).gte("polled_at", sevenDaysAgo).order("polled_at", { ascending: false }),
    supabase.from("printer_meter_readings").select("id, printer_id, reading, reading_at, notes", { count: "exact" }).in("printer_id", printerIds).order("reading_at", { ascending: false }).range(readingsOffset, readingsOffset + READINGS_PER_PAGE - 1),
    supabase.from("printer_snmp_readings").select("printer_id, pages_since_last_poll, polled_at").in("printer_id", printerIds).gte("polled_at", monthStart + "T00:00:00").not("pages_since_last_poll", "is", null),
    supabase.from("printer_meter_readings").select("printer_id, reading, reading_at").in("printer_id", printerIds).gte("reading_at", monthStart).order("reading_at"),
    supabase.from("printer_tickets").select("id, printer_id", { count: "exact" }).in("status", ["Open", "In Progress", "Waiting Supplier"]),
    supabase.from("consumable_types").select("*").order("part_number"),
    supabase.from("printer_trays").select("*").in("printer_id", printerIds).eq("is_active", true).order("sort_order"),
    supabase.from("location_paper_stock").select("*").in("location_id",
      [...new Set(typedPrinters.map((p) => p.location_id).filter(Boolean) as string[])]
    ),
  ]);

  // Latest SNMP reading per printer (dedup in JS)
  const latestByPrinter: Record<string, PrinterSnmpReading> = {};
  for (const r of (snmpReadings ?? []) as PrinterSnmpReading[]) {
    if (!latestByPrinter[r.printer_id]) latestByPrinter[r.printer_id] = r;
  }

  const traysByPrinter: Record<string, PrinterTray[]> = {};
  for (const tray of (printerTrays ?? []) as PrinterTray[]) {
    if (!traysByPrinter[tray.printer_id]) traysByPrinter[tray.printer_id] = [];
    traysByPrinter[tray.printer_id].push(tray);
  }

  const paperStockByLocation: Record<string, LocationPaperStock[]> = {};
  for (const stock of (paperStockRows ?? []) as LocationPaperStock[]) {
    if (!paperStockByLocation[stock.location_id]) paperStockByLocation[stock.location_id] = [];
    paperStockByLocation[stock.location_id].push(stock);
  }

  const consumableTypes = (allConsumableTypes ?? []) as ConsumableType[];

  // ── Compute per-day deltas ─────────────────────────────────────────────────
  // Readings arrive descending. Sort each printer's page-rows ascending to compute
  // delta = current - previous. First reading on the page has no delta (boundary).
  const byPrinter: Record<string, MeterRow[]> = {};
  for (const r of (meterReadings ?? []) as MeterRow[]) {
    if (!byPrinter[r.printer_id]) byPrinter[r.printer_id] = [];
    byPrinter[r.printer_id].push(r);
  }
  const nameById: Record<string, string> = {};
  for (const p of typedPrinters) nameById[p.id] = p.name;

  const openTicketPrinterNames = [
    ...new Set((openTicketData ?? []).map((t: { printer_id: string }) => t.printer_id)),
  ].map((id) => nameById[id]).filter((n): n is string => Boolean(n));

  const readingRows: ReadingWithDelta[] = [];
  for (const [pid, rows] of Object.entries(byPrinter)) {
    const asc = [...rows].sort((a, b) => a.reading_at.localeCompare(b.reading_at));
    for (let i = 0; i < asc.length; i++) {
      readingRows.push({
        ...asc[i],
        printer_name: nameById[pid] ?? pid,
        delta: i === 0 ? null : asc[i].reading - asc[i - 1].reading,
      });
    }
  }
  // Sort for display: most recent first
  readingRows.sort((a, b) =>
    b.reading_at.localeCompare(a.reading_at) || a.printer_name.localeCompare(b.printer_name)
  );

  // ── KPI computation ────────────────────────────────────────────────────────
  const online = typedPrinters.filter(
    (p) => p.status === "Active" || p.status === "Needs Attention"
  ).length;

  const today = now.toISOString().slice(0, 10);

  // Option B: delta sums from SNMP readings (available after migration + first poll)
  const deltaMonthByPrinter: Record<string, number> = {};
  const deltaTodayByPrinter: Record<string, number> = {};
  const hasSnmpMonthData = new Set<string>();
  const hasSnmpTodayData = new Set<string>();
  for (const r of (snmpDeltas ?? []) as { printer_id: string; pages_since_last_poll: number; polled_at: string }[]) {
    const pid = r.printer_id;
    const delta = r.pages_since_last_poll;
    deltaMonthByPrinter[pid] = (deltaMonthByPrinter[pid] ?? 0) + delta;
    hasSnmpMonthData.add(pid);
    if (r.polled_at.startsWith(today)) {
      deltaTodayByPrinter[pid] = (deltaTodayByPrinter[pid] ?? 0) + delta;
      hasSnmpTodayData.add(pid);
    }
  }

  // Fallback: meter readings max-min (used when no delta data exists yet)
  const meterByPrinter: Record<string, number[]> = {};
  const todayMeterByPrinter: Record<string, number[]> = {};
  for (const r of (monthMeters ?? []) as { printer_id: string; reading: number; reading_at: string }[]) {
    if (!meterByPrinter[r.printer_id]) meterByPrinter[r.printer_id] = [];
    meterByPrinter[r.printer_id].push(r.reading);
    if (r.reading_at === today) {
      if (!todayMeterByPrinter[r.printer_id]) todayMeterByPrinter[r.printer_id] = [];
      todayMeterByPrinter[r.printer_id].push(r.reading);
    }
  }

  // Hybrid page count: prefer delta if available, fall back to meter max-min
  function pageMonthForPrinter(pid: string): number {
    if (hasSnmpMonthData.has(pid)) return deltaMonthByPrinter[pid] ?? 0;
    const vals = meterByPrinter[pid];
    return vals && vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0;
  }
  function pageTodayForPrinter(pid: string): number | null {
    if (hasSnmpTodayData.has(pid)) return deltaTodayByPrinter[pid] ?? 0;
    const vals = todayMeterByPrinter[pid];
    return vals && vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : null;
  }
  // Whether a printer has any page-count data this month (for showing "—" vs "0")
  function hasMonthData(pid: string): boolean {
    return hasSnmpMonthData.has(pid) || (meterByPrinter[pid]?.length ?? 0) >= 2;
  }

  let pagesThisMonth = 0;
  for (const p of typedPrinters) pagesThisMonth += pageMonthForPrinter(p.id);

  // Fleet monthly cost estimate
  let fleetMonthlyCost: number | null = null;
  for (const printer of typedPrinters) {
    const types = consumableTypes.filter((consumable) =>
      isConsumableCompatibleWithPrinter(consumable, printer)
    );
    if (types.length === 0) continue;
    const printerMonthPages = pageMonthForPrinter(printer.id);
    if (!hasMonthData(printer.id)) continue;
    const est = computeCostEstimate(types, printerMonthPages);
    if (est.estimatedMonthlyCost !== null) {
      fleetMonthlyCost = (fleetMonthlyCost ?? 0) + est.estimatedMonthlyCost;
    }
  }

  // ── Alert computation ──────────────────────────────────────────────────────
  const alerts: PrinterAlert[] = [];
  const needsAttentionSet = new Set<string>();

  const offlinePrinters = typedPrinters.filter((p) => p.status === "Offline");
  if (offlinePrinters.length > 0) {
    alerts.push({
      level: "critical",
      type: "Offline",
      message: `${offlinePrinters.length} printer${offlinePrinters.length > 1 ? "s are" : " is"} unreachable`,
      printers: offlinePrinters.map((p) => p.name),
    });
    offlinePrinters.forEach((p) => needsAttentionSet.add(p.id));
  }

  let reorderCount = 0;
  const wasteBoxNames: string[] = [];
  const fuserLowNames: string[] = [];
  const pollFailNames: string[] = [];

  // Per-colour, per-printer specifics
  type SpecificAlert = { printer: string; colours: string[] };
  const reorderItems: SpecificAlert[] = [];
  const tonerLowItems: SpecificAlert[] = [];
  const paperLowItems: string[] = [];

  for (const printer of typedPrinters) {
    const capabilities = getPrinterCapabilities(
      printer,
      (traysByPrinter[printer.id] ?? []).map((tray) => ({ ...tray, paper_size: tray.paper_size as PaperSize }))
    );
    const r = latestByPrinter[printer.id];

    // Toner checks run for ALL printers — SNMP data not required.
    // Reorder fires when shelf stock is explicitly 0, regardless of toner level.
    // Low-toner fires when SNMP shows ≤ 25% but a spare is available.
    {
      const reorderColours: string[] = [];
      const lowColours: string[] = [];

      for (const slot of capabilities.tonerSlots) {
        const label = slot === "combined" ? "All-in-one" : SLOT_LABEL[slot];
        const pct = tonerPctForSlot(slot, r);
        const stockRaw = tonerStockRawForSlot(printer, slot);
        const stock = stockRaw ?? 0;

        if (stockRaw !== null && stock < 1) {
          // Spare explicitly set to 0 — needs ordering regardless of toner level
          reorderColours.push(`${label}${pct !== null ? ` (${pct === 0 ? "empty" : `${pct}%`})` : ""}`);
          reorderCount++;
        } else if (pct !== null && pct <= 25 && stock < 1) {
          // SNMP shows low + no/unknown stock
          reorderColours.push(`${label} ${pct === 0 ? "(empty)" : `(${pct}%)`}`);
          reorderCount++;
        } else if (pct !== null && pct <= 25) {
          lowColours.push(`${label} ${pct}%`);
        }
      }

      if (reorderColours.length > 0) {
        reorderItems.push({ printer: printer.name, colours: reorderColours });
        needsAttentionSet.add(printer.id);
      }
      if (lowColours.length > 0) {
        tonerLowItems.push({ printer: printer.name, colours: lowColours });
        needsAttentionSet.add(printer.id);
      }
    }

    if (r) {
      if (capabilities.hasWasteBox && r.waste_box_pct !== null && r.waste_box_pct >= 80) {
        wasteBoxNames.push(printer.name);
        needsAttentionSet.add(printer.id);
      }
      if (capabilities.hasFuserTracking && r.fuser_pct !== null && r.fuser_pct <= 20) {
        fuserLowNames.push(printer.name);
        needsAttentionSet.add(printer.id);
      }
    }

    const siteStocks = printer.location_id ? (paperStockByLocation[printer.location_id] ?? []) : [];
    const a4SiteStock = siteStocks.find((s) => s.paper_size === "A4");
    const a4TotalReams = a4SiteStock
      ? a4SiteStock.boxes_on_hand * REAMS_PER_BOX_A4 + a4SiteStock.reams_on_hand
      : null;
    if (a4TotalReams !== null && a4TotalReams <= PAPER_REAMS_WARN) {
      paperLowItems.push(printer.name);
      needsAttentionSet.add(printer.id);
    }
    if (printer.snmp_enabled && (!printer.last_snmp_polled_at || printer.last_snmp_polled_at < twoHoursAgo)) {
      pollFailNames.push(printer.name);
    }
  }

  // Build alerts with specific colour detail in printers list
  for (const { printer, colours } of reorderItems)
    alerts.push({ level: "critical", type: "Reorder Required", message: `${colours.join(", ")} — no stock on shelf`, printers: [printer] });
  for (const { printer, colours } of tonerLowItems)
    alerts.push({ level: "warning", type: "Toner Low", message: `${colours.join(", ")} — stock available`, printers: [printer] });
  if (wasteBoxNames.length > 0)
    alerts.push({ level: "warning", type: "Waste Box", message: "Waste toner box 80%+ full", printers: wasteBoxNames });
  if (fuserLowNames.length > 0)
    alerts.push({ level: "warning", type: "Fuser Low", message: "Fuser unit at or below 20%", printers: fuserLowNames });
  if (paperLowItems.length > 0)
    alerts.push({ level: "warning", type: "Paper Stock", message: `One or more trays are at or below ${PAPER_REAMS_WARN} reams`, printers: paperLowItems });
  if (pollFailNames.length > 0)
    alerts.push({ level: "warning", type: "Poll Stale", message: "No SNMP data in the last 2 hours", printers: pollFailNames });
  if ((openTickets ?? 0) > 0)
    alerts.push({ level: "info", type: "Open Tickets", message: `${openTickets} open ticket${openTickets !== 1 ? "s" : ""} awaiting action`, printers: openTicketPrinterNames });

  // ── Paper stock totals across all sites ───────────────────────────────────
  let totalA4Boxes = 0;
  let totalA4LooseReams = 0;
  let totalA3Reams = 0;
  for (const stocks of Object.values(paperStockByLocation)) {
    const a4 = stocks.find((s) => s.paper_size === "A4");
    if (a4) { totalA4Boxes += a4.boxes_on_hand; totalA4LooseReams += a4.reams_on_hand; }
    const a3 = stocks.find((s) => s.paper_size === "A3");
    if (a3) totalA3Reams += a3.reams_on_hand;
  }
  const totalA4Reams  = totalA4Boxes * REAMS_PER_BOX_A4 + totalA4LooseReams;
  const totalA4Sheets = totalA4Boxes * SHEETS_PER_BOX_A4 + totalA4LooseReams * SHEETS_PER_REAM_A4;
  const daysElapsed   = now.getDate();
  const avgDailyPages = daysElapsed > 0 && pagesThisMonth > 0
    ? Math.round(pagesThisMonth / daysElapsed)
    : null;
  const estDaysLeft = avgDailyPages && avgDailyPages > 0 && totalA4Sheets > 0
    ? Math.round(totalA4Sheets / avgDailyPages)
    : null;

  // ── Per-site KPI (online, paper, daily print, days remaining) ─────────────
  const siteKpis: SiteKpi[] = [];
  for (const location of (locations ?? [])) {
    const sitePrinters = typedPrinters.filter((p) => p.location_id === location.id);
    if (sitePrinters.length === 0) continue;

    const siteOnline = sitePrinters.filter(
      (p) => p.status === "Active" || p.status === "Needs Attention"
    ).length;

    let sitePagesThisMonth = 0;
    for (const printer of sitePrinters) {
      sitePagesThisMonth += pageMonthForPrinter(printer.id);
    }

    const siteStocks = paperStockByLocation[location.id] ?? [];
    const a4Stock = siteStocks.find((s) => s.paper_size === "A4");
    const a3Stock = siteStocks.find((s) => s.paper_size === "A3");
    const siteA4Boxes = a4Stock?.boxes_on_hand ?? 0;
    const siteA4LooseReams = a4Stock?.reams_on_hand ?? 0;
    const siteA4Sheets = siteA4Boxes * SHEETS_PER_BOX_A4 + siteA4LooseReams * SHEETS_PER_REAM_A4;
    const siteA3Reams = a3Stock?.reams_on_hand ?? 0;

    const siteAvgDailyPages = daysElapsed > 0 && sitePagesThisMonth > 0
      ? Math.round(sitePagesThisMonth / daysElapsed)
      : null;
    const siteEstDaysLeft = siteAvgDailyPages !== null && siteAvgDailyPages > 0 && siteA4Sheets > 0
      ? Math.round(siteA4Sheets / siteAvgDailyPages)
      : null;

    siteKpis.push({
      locationId: location.id,
      locationName: location.name,
      total: sitePrinters.length,
      online: siteOnline,
      pagesThisMonth: sitePagesThisMonth,
      totalA4Boxes: siteA4Boxes,
      totalA4LooseReams: siteA4LooseReams,
      totalA4Sheets: siteA4Sheets,
      totalA3Reams: siteA3Reams,
      avgDailyPages: siteAvgDailyPages,
      estDaysLeft: siteEstDaysLeft,
    });
  }

  // ── Per-printer D/M/T page stats ─────────────────────────────────────────────
  const pageStatsByPrinter: Record<string, { today: number | null; month: number | null }> = {};
  for (const p of typedPrinters) {
    pageStatsByPrinter[p.id] = {
      today: pageTodayForPrinter(p.id),
      month: hasMonthData(p.id) ? pageMonthForPrinter(p.id) : null,
    };
  }

  const kpi: PrinterKpi = {
    total: typedPrinters.length,
    online,
    needsAttention: needsAttentionSet.size,
    reorderCount,
    openTickets: openTickets ?? 0,
    openTicketPrinters: openTicketPrinterNames,
    pagesThisMonth,
    fleetMonthlyCost,
    totalA4Boxes,
    totalA4LooseReams,
    totalA4Sheets,
    totalA3Reams,
    avgDailyPages,
    estDaysLeft,
    siteKpis,
  };

  return {
    printers: typedPrinters,
    total: total ?? 0,
    departments: departments ?? [],
    locations: locations ?? [],
    contacts: contacts ?? [],
    latestByPrinter,
    traysByPrinter,
    pageStatsByPrinter,
    meterRows: readingRows,
    totalReadings: totalReadings ?? 0,
    readingsPage,
    alerts,
    kpi,
    paperStockRows: (paperStockRows ?? []) as LocationPaperStock[],
  };
}

function emptyKpi(): PrinterKpi {
  return {
    total: 0, online: 0, needsAttention: 0, reorderCount: 0, openTickets: 0,
    openTicketPrinters: [], pagesThisMonth: 0, fleetMonthlyCost: null,
    totalA4Boxes: 0, totalA4LooseReams: 0, totalA4Sheets: 0, totalA3Reams: 0,
    avgDailyPages: null, estDaysLeft: null, siteKpis: [],
  };
}

// ReadingsView is a client component — import from its own file
import ReadingsView from "@/components/ReadingsView";

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { value: "monitor", label: "Monitor", icon: Activity },
  { value: "fleet",   label: "Fleet",   icon: LayoutGrid },
  { value: "readings",label: "Readings",icon: List },
] as const;

export default async function PrintersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = (params.view ?? "monitor") as "monitor" | "fleet" | "readings";
  const readingsPage = Math.max(1, parseInt(params.rpage ?? "1") || 1);

  const {
    printers,
    total,
    departments,
    locations,
    contacts,
    latestByPrinter,
    traysByPrinter,
    pageStatsByPrinter,
    meterRows,
    totalReadings,
    alerts,
    kpi,
    paperStockRows,
  } = await getAllData(params, readingsPage);

  const now = new Date();

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {view === "monitor" && <AutoRefresh intervalMs={60_000} />}

      {/* Page header */}
      <div className="mb-6 fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>
            Consumables & Support
          </p>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
            Printers
            <span className="ml-2 text-lg text-stone-400 font-normal">{total}</span>
          </h1>
          <div className="flex flex-col items-end gap-1">
            <FleetActions contacts={contacts} locations={locations} paperStockRows={paperStockRows} />
            {view === "monitor" && (
              <p className="text-[11px] text-stone-400">
                {now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 mb-6 bg-stone-100 rounded-lg p-1 w-fit">
        {TABS.map(({ value, label, icon: Icon }) => {
          const active = view === value;
          const href = value === "monitor" ? "/printers" : `/printers?view=${value}`;
          return (
            <Link
              key={value}
              href={href}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-colors"
              style={{
                background: active ? "#fff" : "transparent",
                color: active ? "#414042" : "#859474",
                boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <Icon size={12} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Monitor view */}
      {view === "monitor" && (
        <>
          <PrinterAlertBanner alerts={alerts} />
          <PrinterKpiCards kpi={kpi} />
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden fade-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100" style={{ background: "#fafaf9" }}>
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>
                  Fleet · {printers.length} printer{printers.length !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-[11px] text-stone-400">{printers.length} printer{printers.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="p-4">
              <PrinterStatusGrid printers={printers} latestByPrinter={latestByPrinter} traysByPrinter={traysByPrinter ?? {}} pageStatsByPrinter={pageStatsByPrinter} />
            </div>
          </div>
        </>
      )}

      {/* Fleet list view */}
      {view === "fleet" && (
        <PrintersClient
          printers={printers}
          total={total}
          departments={departments}
          locations={locations}
          contacts={contacts}
        />
      )}

      {/* Readings log view */}
      {view === "readings" && (
        <ReadingsView
          rows={meterRows}
          totalReadings={totalReadings}
          currentPage={readingsPage}
          perPage={READINGS_PER_PAGE}
        />
      )}
    </div>
  );
}
