import Link from "next/link";
import { ArrowUpRight, Clock, Network, Printer } from "lucide-react";
import type { PrinterSnmpReading, PrinterTray, PrinterWithRelations } from "@/types/database";
import { getPrinterStatusConfig } from "@/lib/printers";
import {
  getPrinterCapabilities,
  SLOT_LABEL,
  type PaperSize,
  type TonerSlot,
} from "@/lib/printer-capabilities";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never polled";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function pctBarColor(pct: number | null): string {
  if (pct === null) return "bg-stone-200";
  if (pct >= 76) return "bg-emerald-500";
  if (pct >= 51) return "bg-sky-400";
  if (pct >= 26) return "bg-amber-400";
  if (pct >= 1)  return "bg-red-400";
  return "bg-red-800";
}

function pctTextColor(pct: number | null): string {
  if (pct === null) return "text-stone-300";
  if (pct <= 0)  return "text-red-700";
  if (pct <= 25) return "text-red-500";
  if (pct <= 50) return "text-amber-600";
  return "text-stone-500";
}

function snmpPctForSlot(slot: TonerSlot, r: PrinterSnmpReading): number | null {
  if (slot === "combined") return r.black_toner_pct;
  const key = `${slot}_toner_pct` as keyof PrinterSnmpReading;
  const v = r[key];
  return typeof v === "number" ? v : null;
}

function stockForSlot(printer: PrinterWithRelations, slot: TonerSlot): number {
  if (slot === "combined") return printer.black_toner_stock ?? 0;
  const key = `${slot}_toner_stock` as keyof PrinterWithRelations;
  return (printer[key] as number | undefined) ?? 0;
}

function worstAlert(
  printer: PrinterWithRelations,
  reading: PrinterSnmpReading | undefined,
  slots: TonerSlot[]
): { label: string; cls: string } | null {
  if (printer.status === "Offline") return { label: "Offline", cls: "text-red-700 bg-red-50 border-red-200" };

  if (reading) {
    for (const slot of slots) {
      const pct   = snmpPctForSlot(slot, reading);
      const stock = stockForSlot(printer, slot);
      if (pct !== null && pct <= 25 && stock < 1) {
        const name  = slot === "combined" ? "Toner" : SLOT_LABEL[slot];
        const detail = pct === 0 ? "empty" : `${pct}%`;
        return { label: `${name} ${detail} — Reorder`, cls: "text-red-700 bg-red-50 border-red-200" };
      }
    }
    for (const slot of slots) {
      const pct = snmpPctForSlot(slot, reading);
      if (pct !== null && pct <= 25) {
        const name = slot === "combined" ? "Toner" : SLOT_LABEL[slot];
        return { label: `${name} Low (${pct}%)`, cls: "text-amber-700 bg-amber-50 border-amber-200" };
      }
    }
    if (reading.waste_box_pct !== null && reading.waste_box_pct >= 80)
      return { label: "Waste Box 80%+", cls: "text-amber-700 bg-amber-50 border-amber-200" };
    if (reading.fuser_pct !== null && reading.fuser_pct <= 20)
      return { label: "Fuser Low", cls: "text-amber-700 bg-amber-50 border-amber-200" };
  }

  if (printer.status === "Needs Attention")
    return { label: "Needs Attention", cls: "text-amber-700 bg-amber-50 border-amber-200" };

  return null;
}

// ── Toner row ─────────────────────────────────────────────────────────────────

function TonerRow({
  label,
  pct,
  stock,
  isAllInOne,
}: {
  label: string;
  pct: number | null;
  stock: number;
  isAllInOne?: boolean;
}) {
  const hasSnmp = pct !== null;

  return (
    <div className="flex items-center gap-2.5">
      {/* Colour label */}
      <span className="text-[10.5px] font-medium text-stone-500 w-[42px] flex-shrink-0 truncate">
        {isAllInOne ? "All-in-1" : label}
      </span>

      {/* Bar */}
      <div className="flex-1 min-w-0">
        {hasSnmp ? (
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pctBarColor(pct)}`}
              style={{ width: `${Math.max(0, pct!)}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 bg-stone-100 rounded-full">
            <span className="sr-only">No data</span>
          </div>
        )}
      </div>

      {/* Pct */}
      <span className={`text-[10.5px] font-medium tabular-nums w-[28px] text-right flex-shrink-0 ${pctTextColor(pct)}`}>
        {hasSnmp ? `${pct}%` : "—"}
      </span>

      {/* On-shelf stock */}
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-semibold tabular-nums"
        style={{
          background: stock === 0 ? "#fee2e2" : "#eef3e6",
          color:      stock === 0 ? "#dc2626" : "#415445",
        }}
        title="On shelf"
      >
        {stock}
      </div>
    </div>
  );
}

// ── Capability chip ───────────────────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
      {label}
    </span>
  );
}

// ── Printer card ──────────────────────────────────────────────────────────────

type PageStats = { today: number | null; month: number | null };

function fmt(n: number | null): string {
  return n !== null ? n.toLocaleString() : "—";
}

function PrinterCard({
  printer,
  reading,
  trays,
  pageStats,
}: {
  printer: PrinterWithRelations;
  reading: PrinterSnmpReading | undefined;
  trays: PrinterTray[];
  pageStats: PageStats | undefined;
}) {
  const statusCfg = getPrinterStatusConfig(printer.status);
  const capabilities = getPrinterCapabilities(
    printer,
    trays.map((t) => ({ ...t, paper_size: t.paper_size as PaperSize }))
  );
  const alert = worstAlert(printer, reading, capabilities.tonerSlots);

  const chips: string[] = [];
  if (capabilities.supportsA3)    chips.push("A3");
  if (capabilities.isDuplex)      chips.push("Duplex");
  if (capabilities.isScanCapable) chips.push("Scan");
  if (capabilities.isFaxCapable)  chips.push("Fax");

  return (
    <Link
      href={`/printers/${printer.id}`}
      className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col gap-3 hover:border-stone-300 hover:shadow-sm transition-all group card-lift"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10.5px] font-mono font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
              #{printer.printer_code}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {printer.status}
            </span>
            {!printer.snmp_enabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-400">SNMP off</span>
            )}
          </div>
          <p className="text-[13.5px] font-semibold text-stone-800 leading-snug" style={{ letterSpacing: "-0.02em" }}>
            {printer.name}
          </p>
          <p className="text-[11px] text-stone-400 mt-0.5 truncate">
            {[printer.manufacturer, printer.model].filter(Boolean).join(" ")}
            {printer.location?.name && <span className="text-stone-300"> · {printer.location.name}</span>}
          </p>
        </div>
        <ArrowUpRight size={13} className="text-stone-200 group-hover:text-stone-400 flex-shrink-0 mt-0.5 transition-colors" />
      </div>

      {/* ── Alert banner ── */}
      {alert && (
        <div className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border ${alert.cls}`}>
          {alert.label}
        </div>
      )}

      {/* ── Toner section ── */}
      <div className="border-t border-stone-50 pt-2.5 space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9.5px] font-medium uppercase tracking-wider text-stone-400">Toner · In Printer</span>
          <span className="text-[9.5px] font-medium uppercase tracking-wider text-stone-400">Shelf</span>
        </div>

        {reading || capabilities.tonerSlots.length > 0 ? (
          capabilities.tonerSlots.map((slot) => (
            <TonerRow
              key={slot}
              label={SLOT_LABEL[slot]}
              pct={reading ? snmpPctForSlot(slot, reading) : null}
              stock={stockForSlot(printer, slot)}
              isAllInOne={slot === "combined"}
            />
          ))
        ) : (
          <p className="text-[11px] text-stone-300">No SNMP data — run a poll</p>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-stone-50 pt-2 space-y-1.5">
        {/* D / M / T meter + IP */}
        <div className="flex items-center justify-between text-[10.5px] text-stone-400">
          <div className="flex items-center gap-1">
            <Printer size={10} className="flex-shrink-0" />
            <span className="font-medium text-stone-500">D</span>
            <span>{fmt(pageStats?.today ?? null)}</span>
            <span className="text-stone-200">·</span>
            <span className="font-medium text-stone-500">M</span>
            <span>{fmt(pageStats?.month ?? null)}</span>
            <span className="text-stone-200">·</span>
            <span className="font-medium text-stone-500">T</span>
            <span>
              {reading?.total_pages != null
                ? reading.total_pages.toLocaleString()
                : printer.last_meter_reading != null
                ? printer.last_meter_reading.toLocaleString()
                : "—"}
            </span>
          </div>
          {printer.ip_address && (
            <div className="flex items-center gap-1">
              <Network size={10} className="flex-shrink-0" />
              <span className="font-mono">{printer.ip_address}</span>
            </div>
          )}
        </div>

        {/* Poll age + capability chips */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10.5px] text-stone-400">
            <Clock size={10} className="flex-shrink-0" />
            <span>{relativeTime(reading?.polled_at ?? printer.last_snmp_polled_at)}</span>
          </div>
          {chips.length > 0 && (
            <div className="flex items-center gap-1">
              {chips.map((c) => <Chip key={c} label={c} />)}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export default function PrinterStatusGrid({
  printers,
  latestByPrinter,
  traysByPrinter,
  pageStatsByPrinter = {},
}: {
  printers: PrinterWithRelations[];
  latestByPrinter: Record<string, PrinterSnmpReading>;
  traysByPrinter: Record<string, PrinterTray[]>;
  pageStatsByPrinter?: Record<string, PageStats>;
}) {
  if (printers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-stone-300">
        <Printer size={32} className="mb-3" />
        <p className="text-[13px]">No printers configured</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {printers.map((p) => (
        <PrinterCard
          key={p.id}
          printer={p}
          reading={latestByPrinter[p.id]}
          trays={traysByPrinter[p.id] ?? []}
          pageStats={pageStatsByPrinter[p.id]}
        />
      ))}
    </div>
  );
}
