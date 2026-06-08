import { Activity } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { PrinterSnmpReading, PrinterTray, PrinterWithRelations } from "@/types/database";
import AutoRefresh from "@/components/AutoRefresh";
import PrinterAlertBanner, { type PrinterAlert } from "@/components/PrinterAlertBanner";
import PrinterKpiCards, { type PrinterKpi } from "@/components/PrinterKpiCards";
import PrinterStatusGrid from "@/components/PrinterStatusGrid";

export const dynamic = "force-dynamic";

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getMonitorData() {
  const supabase = await createSupabaseServerClient();

  const { data: printers } = await supabase
    .from("printers")
    .select(`*, department:departments(*), location:locations(*), primary_contact:contacts!printers_primary_contact_id_fkey(*)`)
    .is("archived_at", null)
    .order("printer_code");

  const typedPrinters = (printers ?? []) as PrinterWithRelations[];
  const printerIds = typedPrinters.map((p) => p.id);

  if (printerIds.length === 0) {
    return { printers: [], latestByPrinter: {}, traysByPrinter: {}, alerts: [], kpi: emptyKpi() };
  }

  const { data: printerTrays } = await supabase
    .from("printer_trays")
    .select("*")
    .in("printer_id", printerIds)
    .eq("is_active", true)
    .order("sort_order");

  const traysByPrinter: Record<string, PrinterTray[]> = {};
  for (const tray of (printerTrays ?? []) as PrinterTray[]) {
    if (!traysByPrinter[tray.printer_id]) traysByPrinter[tray.printer_id] = [];
    traysByPrinter[tray.printer_id].push(tray);
  }

  // Latest SNMP readings — bounded to last 7 days so no full table scan.
  // Uses index on (printer_id, polled_at). Deduplicated in JS below.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: snmpReadings } = await supabase
    .from("printer_snmp_readings")
    .select("*")
    .in("printer_id", printerIds)
    .gte("polled_at", sevenDaysAgo)
    .order("polled_at", { ascending: false });

  // Keep first (most recent) per printer_id
  const latestByPrinter: Record<string, PrinterSnmpReading> = {};
  for (const r of (snmpReadings ?? []) as PrinterSnmpReading[]) {
    if (!latestByPrinter[r.printer_id]) latestByPrinter[r.printer_id] = r;
  }

  // Open tickets count
  const { data: openTicketData, count: openTickets } = await supabase
    .from("printer_tickets")
    .select("id, printer_id", { count: "exact" })
    .in("status", ["Open", "In Progress"]);

  // This month's SNMP delta readings for page-count
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const { data: snmpDeltas } = await supabase
    .from("printer_snmp_readings")
    .select("printer_id, pages_since_last_poll")
    .in("printer_id", printerIds)
    .gte("polled_at", monthStart + "T00:00:00")
    .not("pages_since_last_poll", "is", null);

  // ── Compute KPIs ─────────────────────────────────────────────────────────

  const online = typedPrinters.filter((p) => p.status === "Active" || p.status === "Needs Attention").length;
  const nameById: Record<string, string> = {};
  for (const p of typedPrinters) nameById[p.id] = p.name;
  const openTicketPrinterNames = [
    ...new Set((openTicketData ?? []).map((t: { printer_id: string }) => t.printer_id)),
  ].map((id) => nameById[id]).filter((n): n is string => Boolean(n));

  // Pages this month: sum of pages_since_last_poll deltas (Option B)
  let pagesThisMonth = 0;
  for (const r of (snmpDeltas ?? []) as { printer_id: string; pages_since_last_poll: number }[]) {
    pagesThisMonth += r.pages_since_last_poll;
  }

  // ── Compute alerts ────────────────────────────────────────────────────────

  const alerts: PrinterAlert[] = [];
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const needsAttentionSet = new Set<string>();

  // OFFLINE
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

  // REORDER REQUIRED — shelf stock explicitly 0, or toner ≤ 25% with no/unknown stock
  const reorderNames: string[] = [];
  let reorderCount = 0;
  for (const printer of typedPrinters) {
    const r = latestByPrinter[printer.id];
    const blackPct = r?.black_toner_pct ?? null;
    const colourLowPct = r
      ? (r.cyan_toner_pct !== null && r.cyan_toner_pct <= 25) ||
        (r.magenta_toner_pct !== null && r.magenta_toner_pct <= 25) ||
        (r.yellow_toner_pct !== null && r.yellow_toner_pct <= 25)
      : false;
    const blackReorder =
      (printer.black_toner_stock !== null && printer.black_toner_stock < 1) ||
      (blackPct !== null && blackPct <= 25 && (printer.black_toner_stock ?? 0) < 1);
    const colourReorder =
      (printer.colour_toner_stock !== null && printer.colour_toner_stock < 1 &&
        r !== undefined && (r.cyan_toner_pct !== null || r.magenta_toner_pct !== null || r.yellow_toner_pct !== null)) ||
      (colourLowPct && (printer.colour_toner_stock ?? 0) < 1);
    if (blackReorder || colourReorder) {
      reorderNames.push(printer.name);
      reorderCount++;
      needsAttentionSet.add(printer.id);
    }
  }
  if (reorderNames.length > 0) {
    alerts.push({ level: "critical", type: "Reorder Required", message: "No stock on hand — order toner now", printers: reorderNames });
  }

  // TONER LOW (≤ 25% but stock ≥ 1)
  const tonerLowNames: string[] = [];
  for (const printer of typedPrinters) {
    const r = latestByPrinter[printer.id];
    if (!r) continue;
    const low =
      (r.black_toner_pct !== null && r.black_toner_pct <= 25 && (printer.black_toner_stock ?? 0) >= 1) ||
      (((r.cyan_toner_pct !== null && r.cyan_toner_pct <= 25) ||
        (r.magenta_toner_pct !== null && r.magenta_toner_pct <= 25) ||
        (r.yellow_toner_pct !== null && r.yellow_toner_pct <= 25)) &&
        (printer.colour_toner_stock ?? 0) >= 1);
    if (low && !reorderNames.includes(printer.name)) {
      tonerLowNames.push(printer.name);
      needsAttentionSet.add(printer.id);
    }
  }
  if (tonerLowNames.length > 0) {
    alerts.push({ level: "warning", type: "Toner Low", message: "Toner at or below 25% — stock available", printers: tonerLowNames });
  }

  // WASTE BOX ≥ 80%
  const wasteBoxNames = typedPrinters
    .filter((p) => { const r = latestByPrinter[p.id]; return r?.waste_box_pct !== null && (r?.waste_box_pct ?? 0) >= 80; })
    .map((p) => p.name);
  if (wasteBoxNames.length > 0) {
    alerts.push({ level: "warning", type: "Waste Box", message: "Waste toner box 80%+ full", printers: wasteBoxNames });
    wasteBoxNames.forEach((name) => { const p = typedPrinters.find((x) => x.name === name); if (p) needsAttentionSet.add(p.id); });
  }

  // FUSER LOW ≤ 20%
  const fuserLowNames = typedPrinters
    .filter((p) => { const r = latestByPrinter[p.id]; return r?.fuser_pct !== null && (r?.fuser_pct ?? 100) <= 20; })
    .map((p) => p.name);
  if (fuserLowNames.length > 0) {
    alerts.push({ level: "warning", type: "Fuser Low", message: "Fuser unit at or below 20%", printers: fuserLowNames });
    fuserLowNames.forEach((name) => { const p = typedPrinters.find((x) => x.name === name); if (p) needsAttentionSet.add(p.id); });
  }

  // POLL FAILURE (snmp_enabled but not polled in 2h)
  const pollFailNames = typedPrinters
    .filter((p) => p.snmp_enabled && (!p.last_snmp_polled_at || p.last_snmp_polled_at < twoHoursAgo))
    .map((p) => p.name);
  if (pollFailNames.length > 0) {
    alerts.push({ level: "warning", type: "Poll Stale", message: "No SNMP data in the last 2 hours", printers: pollFailNames });
  }

  // OPEN TICKETS
  if ((openTickets ?? 0) > 0) {
    alerts.push({
      level: "info",
      type: "Open Tickets",
      message: `${openTickets} open ticket${openTickets !== 1 ? "s" : ""} awaiting action`,
      printers: openTicketPrinterNames,
    });
  }

  const kpi: PrinterKpi = {
    total: typedPrinters.length,
    online,
    needsAttention: needsAttentionSet.size,
    reorderCount,
    openTickets: openTickets ?? 0,
    openTicketPrinters: openTicketPrinterNames,
    pagesThisMonth,
    fleetMonthlyCost: null,
    totalA4Boxes: 0,
    totalA4LooseReams: 0,
    totalA4Sheets: 0,
    totalA3Reams: 0,
    avgDailyPages: null,
    estDaysLeft: null,
    siteKpis: [],
  };

  return { printers: typedPrinters, latestByPrinter, traysByPrinter, alerts, kpi };
}

function emptyKpi(): PrinterKpi {
  return {
    total: 0, online: 0, needsAttention: 0, reorderCount: 0, openTickets: 0,
    openTicketPrinters: [], pagesThisMonth: 0, fleetMonthlyCost: null,
    totalA4Boxes: 0, totalA4LooseReams: 0, totalA4Sheets: 0, totalA3Reams: 0,
    avgDailyPages: null, estDaysLeft: null, siteKpis: [],
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PrinterMonitorPage() {
  const { printers, latestByPrinter, traysByPrinter, alerts, kpi } = await getMonitorData();
  const now = new Date();
  const lastRefreshed = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <AutoRefresh intervalMs={60_000} />

      {/* Header */}
      <div className="mb-6 fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Consumables & Support</p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
              <span className="inline-flex items-center gap-2">
                <Activity size={20} style={{ color: "#C04F28" }} />
                Print Monitor
              </span>
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <p className="text-[11px] text-stone-400 pb-1">Refreshed {lastRefreshed} · auto every 60s</p>
        </div>
      </div>

      {/* Alert banner */}
      <PrinterAlertBanner alerts={alerts} />

      {/* KPI cards */}
      <PrinterKpiCards kpi={kpi} />

      {/* Printer grid */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden fade-up">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100" style={{ background: "#fafaf9" }}>
          <div className="flex items-center gap-2">
            <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>
              Fleet · {printers.length} printer{printers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-[11px] text-stone-400">{kpi.online} online · {kpi.total - kpi.online} offline</p>
        </div>
        <div className="p-4">
          <PrinterStatusGrid printers={printers} latestByPrinter={latestByPrinter} traysByPrinter={traysByPrinter} />
        </div>
      </div>
    </div>
  );
}
