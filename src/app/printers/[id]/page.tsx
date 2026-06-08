import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Gauge,
  Hash,
  MapPin,
  Network,
  Package,
  Printer,
  Tag,
  User,
  Wrench,
} from "lucide-react";
import PrinterDetailActions, {
  PrinterTicketAction,
  TonerOrderAction,
} from "@/components/PrinterDetailActions";
import PrinterStockModalTrigger from "@/components/PrinterStockModalTrigger";
import {
  computeAvgDailyPages,
  computeCostEstimate,
  predictConsumableRunout,
  formatZAR,
  formatCpp,
  type Prediction,
} from "@/lib/predictions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  REAMS_PER_BOX_A4,
  SHEETS_PER_BOX_A4,
  SHEETS_PER_REAM_A3,
  SHEETS_PER_REAM_A4,
  SLOT_LABEL,
  findConsumableType,
  getPrinterCapabilities,
  isConsumableCompatibleWithPrinter,
  type PaperSize,
  type PrinterCapabilities,
  type TonerSlot,
} from "@/lib/printer-capabilities";
import { formatDate } from "@/lib/utils";
import {
  getConsumableStatusConfig,
  getOrderStatusConfig,
  getPrinterStatusConfig,
  getPriorityConfig,
  getTicketStatusConfig,
} from "@/lib/printers";
import type {
  Contact,
  ConsumableType,
  Location,
  LocationPaperStock,
  PrinterMeterReadingWithRelations,
  PrinterSnmpReading,
  PrinterTicketWithRelations,
  PrinterTonerOrderWithRelations,
  PrinterTray,
  PrinterWithRelations,
} from "@/types/database";

async function getPrinter(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: printer } = await supabase
    .from("printers")
    .select(`
      *,
      department:departments(*),
      location:locations(*),
      primary_contact:contacts!printers_primary_contact_id_fkey(*)
    `)
    .eq("id", id)
    .single();

  if (!printer) return null;

  const locationId = (printer as { location_id: string | null }).location_id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [
    { data: tonerOrders },
    { data: tickets },
    { data: meterReadings },
    { data: snmpReadings },
    { data: departments },
    { data: locations },
    { data: contacts },
    { data: consumableTypes },
    { data: recentMeters },
    { data: monthMeters },
    { data: printerTrays },
    { data: paperStockRows },
  ] = await Promise.all([
    supabase.from("printer_toner_orders").select("*, requested_by_contact:contacts!printer_toner_orders_requested_by_contact_id_fkey(*)").eq("printer_id", id).order("requested_at", { ascending: false }),
    supabase.from("printer_tickets").select("*, logged_by_contact:contacts!printer_tickets_logged_by_contact_id_fkey(*)").eq("printer_id", id).order("opened_at", { ascending: false }),
    supabase.from("printer_meter_readings").select("*, captured_by_contact:contacts!printer_meter_readings_captured_by_contact_id_fkey(*)").eq("printer_id", id).order("reading_at", { ascending: false }),
    supabase.from("printer_snmp_readings").select("*").eq("printer_id", id).order("polled_at", { ascending: false }).limit(1),
    supabase.from("departments").select("*").order("name"),
    supabase.from("locations").select("*").eq("is_active", true).order("name"),
    supabase.from("contacts").select("*").eq("is_active", true).order("full_name"),
    supabase.from("consumable_types").select("*").order("part_number"),
    supabase.from("printer_meter_readings").select("reading, reading_at").eq("printer_id", id).gte("reading_at", thirtyDaysAgo).order("reading_at"),
    supabase.from("printer_meter_readings").select("reading").eq("printer_id", id).gte("reading_at", monthStart).order("reading_at"),
    supabase.from("printer_trays").select("*").eq("printer_id", id).eq("is_active", true).order("sort_order"),
    locationId
      ? supabase.from("location_paper_stock").select("*").eq("location_id", locationId)
      : Promise.resolve({ data: [] as LocationPaperStock[] }),
  ]);

  // ── Server-side computations ─────────────────────────────────────────────
  const avgDaily = computeAvgDailyPages(
    (recentMeters ?? []) as { reading: number; reading_at: string }[]
  );

  const monthReadings = (monthMeters ?? []) as { reading: number }[];
  const pagesThisMonth =
    monthReadings.length >= 2
      ? Math.max(...monthReadings.map((r) => r.reading)) - Math.min(...monthReadings.map((r) => r.reading))
      : 0;

  const compatibleConsumableTypes = ((consumableTypes ?? []) as ConsumableType[]).filter((consumable) =>
    isConsumableCompatibleWithPrinter(consumable, printer)
  );

  const costEstimate = computeCostEstimate(compatibleConsumableTypes, pagesThisMonth);

  return {
    printer: printer as PrinterWithRelations,
    tonerOrders: (tonerOrders ?? []) as PrinterTonerOrderWithRelations[],
    tickets: (tickets ?? []) as PrinterTicketWithRelations[],
    meterReadings: (meterReadings ?? []) as PrinterMeterReadingWithRelations[],
    latestSnmpReading: (snmpReadings?.[0] ?? null) as PrinterSnmpReading | null,
    departments: departments ?? [],
    locations: locations ?? [],
    contacts: (contacts ?? []) as Contact[],
    consumableTypes: compatibleConsumableTypes,
    avgDaily,
    costEstimate,
    pagesThisMonth,
    printerTrays: (printerTrays ?? []) as PrinterTray[],
    sitePaperStock: (paperStockRows ?? []) as LocationPaperStock[],
  };
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-stone-50 last:border-0">
      <div className="w-6 mt-0.5 flex-shrink-0">
        <Icon size={13} className="text-stone-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-[13.5px] text-stone-800 break-words">{value || "-"}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2" style={{ background: "#fafaf9" }}>
        <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>{title}</p>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

function Badge({ label, cfg }: { label: string | null | undefined; cfg: { color: string; dot: string; bg: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label ?? "-"}
    </span>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="px-5 py-6 text-[13px] text-stone-400 text-center">{label}</p>;
}

function formatDateTime(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPct(value: number | null): string {
  return typeof value === "number" ? `${value}%` : "-";
}

function tonerPctForSlot(slot: TonerSlot, reading: PrinterSnmpReading | null): number | null {
  if (!reading) return null;
  if (slot === "combined") return reading.black_toner_pct;
  const key = `${slot}_toner_pct` as keyof PrinterSnmpReading;
  const value = reading[key];
  return typeof value === "number" ? value : null;
}

function formatTonerSummary(reading: PrinterSnmpReading | null, capabilities: PrinterCapabilities): string {
  if (!reading) return "-";
  return capabilities.tonerSlots
    .map((slot) => {
      const label = slot === "combined" ? "All-in-one" : SLOT_LABEL[slot];
      return `${label} ${formatPct(tonerPctForSlot(slot, reading))}`;
    })
    .join(" ");
}

function formatTrackedServiceLevels(reading: PrinterSnmpReading | null, capabilities: PrinterCapabilities): string | null {
  if (!reading) return null;
  const levels: string[] = [];
  if (capabilities.hasFuserTracking) levels.push(`Fuser ${formatPct(reading.fuser_pct)}`);
  if (capabilities.hasDrumTracking) levels.push(`Drum ${formatPct(reading.drum_pct)}`);
  if (capabilities.hasWasteBox) levels.push(`Waste ${formatPct(reading.waste_box_pct)}`);
  return levels.length > 0 ? levels.join(" - ") : null;
}

function normaliseConsumableKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stockLabel(stock: number, pct: number | null): string {
  if (pct !== null && pct <= 25) {
    return stock >= 1 ? "Stock Available - Monitor" : "Reorder Required";
  }
  return stock >= 1 ? "In stock" : "No shelf stock";
}

function tonerStockForSlot(printer: PrinterWithRelations, slot: TonerSlot): number {
  if (slot === "combined") return printer.black_toner_stock ?? 0;
  if (slot === "black") return printer.black_toner_stock ?? 0;
  return ((printer as Record<string, unknown>)[`${slot}_toner_stock`] as number | undefined) ?? 0;
}

function StockSummary({
  printer,
  capabilities,
  latestReading,
  sitePaperStock,
  siteName,
  consumableTypes,
  avgDailyPages,
}: {
  printer: PrinterWithRelations;
  capabilities: PrinterCapabilities;
  latestReading: PrinterSnmpReading | null;
  sitePaperStock: LocationPaperStock[];
  siteName: string | null;
  consumableTypes: ConsumableType[];
  avgDailyPages: number | null;
}) {
  const tonerRows = capabilities.tonerSlots.map((slot) => {
    const colour = slot === "combined" ? "Combined" : SLOT_LABEL[slot];
    const consumable = findConsumableType(consumableTypes, "toner", colour);
    const stock = tonerStockForSlot(printer, slot);
    const pct = tonerPctForSlot(slot, latestReading);
    return { slot, colour, consumable, stock, pct };
  });

  const a4Stock = sitePaperStock.find((s) => s.paper_size === "A4");
  const a3Stock = sitePaperStock.find((s) => s.paper_size === "A3");

  const a4Reams  = a4Stock ? a4Stock.boxes_on_hand * REAMS_PER_BOX_A4 + a4Stock.reams_on_hand : 0;
  const a4Sheets = a4Stock ? a4Stock.boxes_on_hand * SHEETS_PER_BOX_A4 + a4Stock.reams_on_hand * SHEETS_PER_REAM_A4 : 0;
  const a3Reams  = a3Stock?.reams_on_hand ?? 0;
  const a3Sheets = a3Reams * SHEETS_PER_REAM_A3;
  const a4Days   = avgDailyPages && avgDailyPages > 0 ? Math.round(a4Sheets / avgDailyPages) : null;

  return (
    <div className="space-y-4 py-3">
      {/* Toner */}
      <div>
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400 mb-2">Consumables on shelf</p>
        <div className="divide-y divide-stone-50">
          {tonerRows.map((row) => (
            <div key={row.slot} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-stone-700">
                  {row.slot === "combined" ? "Combined Toner Cartridge" : `${row.colour} Toner`}
                </p>
                <p className="text-[11px] text-stone-400 truncate">
                  {[row.consumable?.part_number, row.consumable?.description].filter(Boolean).join(" — ") || "No part linked"}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-semibold tabular-nums text-stone-800">{row.stock}</p>
                <p className="text-[10.5px] text-stone-400">
                  {formatPct(row.pct)} in printer · {stockLabel(row.stock, row.pct)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Paper — site pool */}
      <div>
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400 mb-2">
          Paper stock{siteName ? ` — ${siteName}` : ""}
        </p>
        {sitePaperStock.length === 0 ? (
          <p className="text-[12.5px] text-stone-400 italic py-1">
            No stock recorded for this site yet.
          </p>
        ) : (
          <div className="divide-y divide-stone-50">
            {/* A4 */}
            {a4Stock && (
              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-[12.5px] font-medium text-stone-700">A4</p>
                  <p className="text-[11px] text-stone-400">
                    {a4Stock.boxes_on_hand} box{a4Stock.boxes_on_hand !== 1 ? "es" : ""} + {a4Stock.reams_on_hand} ream{a4Stock.reams_on_hand !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold tabular-nums text-stone-800">
                    {a4Reams} reams
                  </p>
                  <p className="text-[10.5px] text-stone-400">
                    {a4Sheets.toLocaleString()} sheets{a4Days !== null ? ` · ~${a4Days} days` : ""}
                  </p>
                </div>
              </div>
            )}
            {/* A3 */}
            {a3Stock && a3Reams > 0 && (
              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-[12.5px] font-medium text-stone-700">A3</p>
                  <p className="text-[11px] text-stone-400">{a3Reams} ream{a3Reams !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold tabular-nums text-stone-800">{a3Reams} reams</p>
                  <p className="text-[10.5px] text-stone-400">{a3Sheets.toLocaleString()} sheets</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function PrinterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPrinter(id);
  if (!result) notFound();

  const {
    printer,
    tonerOrders,
    tickets,
    meterReadings,
    latestSnmpReading,
    departments,
    locations,
    contacts,
    consumableTypes,
    avgDaily,
    costEstimate,
    pagesThisMonth,
    printerTrays,
    sitePaperStock,
  } = result;

  const capabilities = getPrinterCapabilities(
    printer,
    printerTrays.map((t) => ({ ...t, paper_size: t.paper_size as PaperSize }))
  );

  const printerStatus = getPrinterStatusConfig(printer.status);
  const tonerStatus = getConsumableStatusConfig(printer.toner_status);
  const paperStatus = getConsumableStatusConfig(printer.paper_status);
  const snmpStatus = latestSnmpReading
    ? getPrinterStatusConfig(latestSnmpReading.is_online ? "Active" : "Offline")
    : getPrinterStatusConfig(null);
  const openTickets = tickets.filter((ticket) => ["Open", "In Progress", "Waiting Supplier"].includes(ticket.status));
  const latestMeter = meterReadings[0];

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <Link href="/printers" className="inline-flex items-center gap-1.5 text-[12px] mb-6 transition-colors hover:opacity-70" style={{ color: "#859474" }}>
        <ArrowLeft size={13} />
        Back to Printers
      </Link>

      <div className="mb-6 fade-up">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#eef3e6" }}>
            <Printer size={24} style={{ color: "#415445" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="text-[12px] font-mono font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                #{printer.printer_code}
              </span>
              <Badge label={printer.status} cfg={printerStatus} />
              {printer.location?.name && (
                <span className="text-[12px] text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                  {printer.location.name}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-stone-900 leading-tight" style={{ letterSpacing: "-0.025em" }}>
              {printer.name}
            </h1>
            <p className="text-[12.5px] text-stone-500 mt-1">
              {[printer.manufacturer, printer.model].filter(Boolean).join(" ") || "Model not captured"}
            </p>
          </div>

          <PrinterDetailActions
            printer={printer}
            lookups={{ departments, locations: locations as Location[], contacts }}
            trays={printerTrays}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="col-span-1 lg:col-span-2 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Open Tickets</p>
              <p className="text-xl font-semibold text-stone-900 mt-2 tabular-nums">{openTickets.length}</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Toner</p>
              <div className="mt-2"><Badge label={printer.toner_status} cfg={tonerStatus} /></div>
              <p className="text-[10px] text-stone-300 mt-1">auto from SNMP</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Paper</p>
              <div className="mt-2"><Badge label={printer.paper_status} cfg={paperStatus} /></div>
              <p className="text-[10px] text-stone-300 mt-1">auto from SNMP</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">SNMP</p>
              <div className="mt-2">
                <Badge label={latestSnmpReading ? (latestSnmpReading.is_online ? "Online" : "Offline") : "Not Polled"} cfg={snmpStatus} />
              </div>
            </div>
          </div>

          <Section title="Printer Details">
            <InfoRow icon={Tag} label="Serial Number" value={printer.serial_number} />
            <InfoRow icon={Network} label="IP Address" value={printer.ip_address} />
            <InfoRow icon={Hash} label="MAC Address" value={printer.mac_address} />
            <InfoRow icon={Package} label="Supplier" value={printer.supplier} />
            <InfoRow icon={Printer} label="Manufacturer / Model" value={[printer.manufacturer, printer.model].filter(Boolean).join(" ")} />
            <InfoRow icon={Calendar} label="Warranty End" value={formatDate(printer.warranty_end_date)} />
            {printer.notes && <InfoRow icon={FileText} label="Notes" value={printer.notes} />}
          </Section>

          <Section title="Consumables">
            <InfoRow icon={Package} label="Toner Model" value={printer.toner_model} />
            <InfoRow icon={FileText} label="Paper Size" value={printer.paper_size} />
            <InfoRow
              icon={Gauge}
              label="Latest Meter"
              value={
                latestMeter
                  ? `${latestMeter.reading.toLocaleString()} on ${formatDate(latestMeter.reading_at)}`
                  : printer.last_meter_reading
                    ? `${printer.last_meter_reading.toLocaleString()} on ${formatDate(printer.last_meter_reading_at)}`
                    : null
              }
            />
          </Section>

          {/* Stock on hand */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between" style={{ background: "#fafaf9" }}>
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Stock on Hand</p>
              </div>
              <PrinterStockModalTrigger
                printer={printer}
                location={printer.location ?? null}
                capabilities={capabilities}
                sitePaperStock={sitePaperStock}
                avgDailyPages={avgDaily?.avgPerDay ?? null}
                latestReading={latestSnmpReading}
                consumableTypes={consumableTypes}
              />
            </div>
            <div className="px-5 py-1">
              <StockSummary
                printer={printer}
                capabilities={capabilities}
                latestReading={latestSnmpReading}
                sitePaperStock={sitePaperStock}
                siteName={printer.location?.name ?? null}
                consumableTypes={consumableTypes}
                avgDailyPages={avgDaily?.avgPerDay ?? null}
              />
            </div>
          </div>

          {/* ── Consumable Levels (Section 2) ───────────────────────────── */}
          {latestSnmpReading && (() => {
            type ConsumableData = {
              index: string; description: string | null; colour: string; kind: string;
              percent: number | null; flag_label: string | null; percent_label: string;
            };
            const raw = latestSnmpReading.raw_data as { consumables?: ConsumableData[] } | null;
            const consumables: ConsumableData[] = raw?.consumables ?? [];
            if (consumables.length === 0) return null;

            return (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2" style={{ background: "#fafaf9" }}>
                  <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
                  <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Consumable Levels</p>
                </div>
                <div className="divide-y divide-stone-50">
                  {consumables.map((c) => {
                    const matchType = consumableTypes.find(
                      (t) =>
                        normaliseConsumableKey(t.colour) === normaliseConsumableKey(c.colour) &&
                        normaliseConsumableKey(t.kind) === normaliseConsumableKey(c.kind)
                    );
                    const prediction: Prediction | null = matchType?.rated_yield_pages
                      ? predictConsumableRunout(c.percent, matchType.rated_yield_pages, avgDaily, matchType.supplier_lead_days)
                      : null;
                    const pct = c.percent;
                    const barColor = pct === null ? "bg-stone-200" : pct >= 76 ? "bg-emerald-500" : pct >= 51 ? "bg-sky-500" : pct >= 26 ? "bg-amber-400" : pct >= 1 ? "bg-red-400" : "bg-red-900";

                    return (
                      <div key={c.index} className="px-5 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12.5px] font-medium text-stone-700">{c.description ?? `${c.colour} ${c.kind}`}</span>
                          <span className="text-[12px] font-medium text-stone-500 tabular-nums">{c.percent_label}</span>
                        </div>
                        {pct !== null && (
                          <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-1.5">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(0, pct)}%` }} />
                          </div>
                        )}
                        {c.flag_label && (
                          <p className="text-[11px] text-stone-400 mb-1">{c.flag_label}</p>
                        )}
                        {prediction && (
                          <div className={`flex items-center gap-1.5 text-[11px] mt-1 ${prediction.urgency === "order-now" ? "text-red-600 font-medium" : prediction.urgency === "insufficient-data" ? "text-stone-400 italic" : "text-stone-500"}`}>
                            {prediction.urgency === "order-now" && <span>⚠</span>}
                            <span>{prediction.urgency === "order-now" ? `Order now — may run out before delivery (${prediction.label.split("(")[0].trim()})` : prediction.label}</span>
                          </div>
                        )}
                        {!prediction && !matchType && (
                          <p className="text-[10.5px] text-stone-300 mt-0.5 italic">No yield data - configure it in Consumable Types settings</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Cost Estimate (between page counters and stock) ─────────── */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2" style={{ background: "#fafaf9" }}>
              <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Cost Estimate</p>
            </div>
            <div className="px-5 py-4">
              {!costEstimate.hasData ? (
                <div className="text-center py-2">
                  <p className="text-[12.5px] text-stone-400">Cost estimates will appear here once consumable prices are entered.</p>
                  <p className="text-[11px] text-stone-300 mt-1">Add entries in Settings - Consumable Types.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {costEstimate.blackCpp !== null && (
                      <div className="bg-stone-50 rounded-lg px-4 py-3">
                        <p className="text-[10.5px] text-stone-400 uppercase tracking-wider mb-1">Mono Cost / Page</p>
                        <p className="text-[15px] font-semibold text-stone-800">{formatCpp(costEstimate.blackCpp)}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">black toner only</p>
                      </div>
                    )}
                    {costEstimate.colourCpp !== null && (
                      <div className="bg-stone-50 rounded-lg px-4 py-3">
                        <p className="text-[10.5px] text-stone-400 uppercase tracking-wider mb-1">Colour Cost / Page</p>
                        <p className="text-[15px] font-semibold text-stone-800">{formatCpp(costEstimate.colourCpp)}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">all 4 toner colours</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-stone-100 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-stone-500">This month estimate</p>
                        <p className="text-[10.5px] text-stone-400">{pagesThisMonth.toLocaleString()} pages × {costEstimate.blackCpp ? formatCpp(costEstimate.blackCpp) : "—"}</p>
                      </div>
                      <p className="text-[18px] font-semibold" style={{ color: "#C04F28" }}>
                        {costEstimate.estimatedMonthlyCost !== null ? formatZAR(costEstimate.estimatedMonthlyCost) : "—"}
                      </p>
                    </div>
                    <p className="text-[10.5px] text-stone-300 mt-2">Based on manufacturer rated yield at 5% page coverage. Actual costs may vary.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Section title="SNMP Monitoring">
            <InfoRow icon={Network} label="Last Poll" value={formatDateTime(latestSnmpReading?.polled_at ?? printer.last_snmp_polled_at)} />
            <InfoRow icon={Printer} label="SNMP Status" value={latestSnmpReading?.printer_status ?? (latestSnmpReading ? "No status returned" : null)} />
            <InfoRow icon={Gauge} label="Meter From SNMP" value={latestSnmpReading?.total_pages?.toLocaleString()} />
            <InfoRow icon={Package} label="Toner Levels" value={formatTonerSummary(latestSnmpReading, capabilities)} />
            <InfoRow icon={Wrench} label="Tracked Service Levels" value={formatTrackedServiceLevels(latestSnmpReading, capabilities)} />
            {latestSnmpReading?.error_description && (
              <InfoRow icon={FileText} label="Errors" value={latestSnmpReading.error_description} />
            )}
          </Section>

          {/* Consumable reference link */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between" style={{ background: "#fafaf9" }}>
              <div className="flex items-center gap-2">
                <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Consumable Reference</p>
              </div>
              <p className="text-[10.5px] text-stone-400">rated yields and prices for predictions</p>
            </div>
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <p className="text-[12.5px] text-stone-500">
                {consumableTypes.length} compatible reference entr{consumableTypes.length === 1 ? "y" : "ies"} linked by model.
              </p>
              <Link
                href={`/settings/consumable-types?from=/printers/${id}`}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
              >
                Manage Types
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <Wrench size={12} className="text-stone-400" />
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Tickets - {tickets.length}</p>
            </div>
            {tickets.length === 0 ? (
              <EmptyRow label="No tickets logged" />
            ) : (
              <div className="divide-y divide-stone-50">
                {tickets.map((ticket) => {
                  const statusCfg = getTicketStatusConfig(ticket.status);
                  const priorityCfg = getPriorityConfig(ticket.priority);
                  return (
                    <div key={ticket.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-stone-800">{ticket.title}</p>
                          {ticket.description && <p className="text-[12px] text-stone-500 mt-1">{ticket.description}</p>}
                          <p className="text-[11px] text-stone-400 mt-1">
                            {formatDate(ticket.opened_at)}
                            {ticket.logged_by_contact && ` - ${ticket.logged_by_contact.full_name}`}
                            {ticket.supplier_ticket_ref && ` - ${ticket.supplier_ticket_ref}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge label={ticket.priority} cfg={priorityCfg} />
                          <Badge label={ticket.status} cfg={statusCfg} />
                          <PrinterTicketAction ticket={ticket} contacts={contacts} />
                        </div>
                      </div>
                      {ticket.resolution_notes && <p className="text-[12px] text-emerald-700 mt-2">{ticket.resolution_notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <OrderSection title="Toner Orders" count={tonerOrders.length}>
            {tonerOrders.length === 0 ? (
              <EmptyRow label="No toner orders" />
            ) : (
              tonerOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  title={order.toner_type}
                  quantity={`${order.quantity} item${order.quantity === 1 ? "" : "s"}`}
                  status={order.status}
                  requestedAt={order.requested_at}
                  expectedAt={order.expected_at}
                  receivedAt={order.received_at}
                  supplier={order.supplier}
                  requestedBy={order.requested_by_contact?.full_name}
                  action={<TonerOrderAction order={order} contacts={contacts} />}
                />
              ))
            )}
          </OrderSection>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <Gauge size={12} className="text-stone-400" />
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Meter Readings - {meterReadings.length}</p>
            </div>
            {meterReadings.length === 0 ? (
              <EmptyRow label="No meter readings" />
            ) : (
              <div className="divide-y divide-stone-50">
                {meterReadings.slice(0, 8).map((reading) => (
                  <div key={reading.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-[13px] font-mono font-medium text-stone-700 tabular-nums">{reading.reading.toLocaleString()}</span>
                    <span className="text-[12px] text-stone-400">{formatDate(reading.reading_at)}</span>
                    <span className="text-[12px] text-stone-500 truncate">{reading.captured_by_contact?.full_name ?? ""}</span>
                    {reading.notes && <span className="ml-auto text-[11px] text-stone-400 truncate">{reading.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <Section title="Ownership">
            <InfoRow icon={Building2} label="Department" value={printer.department?.name} />
            <InfoRow icon={MapPin} label="Site" value={printer.location?.name} />
            <InfoRow icon={User} label="Primary Contact" value={printer.primary_contact?.full_name} />
          </Section>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Consumable Status</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-stone-500">Toner</span>
                <Badge label={printer.toner_status} cfg={tonerStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-stone-500">Paper</span>
                <Badge label={printer.paper_status} cfg={paperStatus} />
              </div>
            </div>
          </div>

          {openTickets.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 px-5 py-4">
              <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wider mb-2">Attention</p>
              <p className="text-[12.5px] text-amber-800">
                {openTickets.length} open printer ticket{openTickets.length === 1 ? "" : "s"} need follow-up.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
        <Package size={12} className="text-stone-400" />
        <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">{title} - {count}</p>
      </div>
      <div className="divide-y divide-stone-50">{children}</div>
    </div>
  );
}

function OrderRow({
  title,
  quantity,
  status,
  requestedAt,
  expectedAt,
  receivedAt,
  supplier,
  requestedBy,
  action,
}: {
  title: string;
  quantity: string;
  status: string;
  requestedAt: string;
  expectedAt: string | null;
  receivedAt: string | null;
  supplier: string | null;
  requestedBy?: string | null;
  action: React.ReactNode;
}) {
  const statusCfg = getOrderStatusConfig(status);
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-stone-800 truncate">{title}</p>
          <p className="text-[11px] text-stone-400 mt-1">
            {quantity} - requested {formatDate(requestedAt)}
          </p>
          <p className="text-[11px] text-stone-400">
            {supplier || "No supplier"}
            {requestedBy && ` - ${requestedBy}`}
          </p>
          {(expectedAt || receivedAt) && (
            <p className="text-[11px] text-stone-400">
              {expectedAt && `Expected ${formatDate(expectedAt)}`}
              {expectedAt && receivedAt && " - "}
              {receivedAt && `Received ${formatDate(receivedAt)}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge label={status} cfg={statusCfg} />
          {action}
        </div>
      </div>
    </div>
  );
}
