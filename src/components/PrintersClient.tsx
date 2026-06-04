"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AddPrinterModal } from "@/components/PrinterModals";
import { useAuth } from "@/context/AuthContext";
import {
  CONSUMABLE_STATUSES,
  PRINTER_STATUSES,
  getConsumableStatusConfig,
  getPrinterStatusConfig,
} from "@/lib/printers";
import type {
  Contact,
  Department,
  Location,
  PrinterWithRelations,
} from "@/types/database";

interface Props {
  printers: PrinterWithRelations[];
  total: number;
  departments: Department[];
  locations: Location[];
  contacts: Contact[];
}

export default function PrintersClient({
  printers,
  total,
  departments,
  locations,
  contacts,
}: Props) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  const q = searchParams.get("q") ?? "";
  const selectedStatuses = new Set(searchParams.get("status")?.split(",").filter(Boolean) ?? []);
  const selectedToner = new Set(searchParams.get("toner")?.split(",").filter(Boolean) ?? []);
  const selectedPaper = new Set(searchParams.get("paper")?.split(",").filter(Boolean) ?? []);
  const selectedSites = new Set(searchParams.get("site")?.split(",").filter(Boolean) ?? []);
  const hasFilters = q || selectedStatuses.size > 0 || selectedToner.size > 0 || selectedPaper.size > 0 || selectedSites.size > 0;

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => router.push(`/printers?${params.toString()}`));
    },
    [router, searchParams]
  );

  function toggleFilter(param: string, value: string, current: Set<string>) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    updateParams({ [param]: next.size > 0 ? [...next].join(",") : undefined });
  }

  const needsConsumables = printers.filter((printer) =>
    ["Low", "Critical", "Out", "Ordered"].includes(printer.toner_status) ||
    ["Low", "Critical", "Out", "Ordered"].includes(printer.paper_status)
  ).length;
  const needsAttention = printers.filter((printer) => printer.status === "Needs Attention" || printer.status === "Offline").length;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Stat label="Visible Printers" value={total} />
        <Stat label="Needs Attention" value={needsAttention} tone={needsAttention > 0 ? "warn" : "calm"} />
        <Stat label="Consumables Watch" value={needsConsumables} tone={needsConsumables > 0 ? "warn" : "calm"} />
      </div>

      <div className={`flex items-center gap-3 mb-5 flex-wrap transition-opacity ${isPending ? "opacity-60" : ""}`}>
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search printers"
            defaultValue={q}
            onChange={(e) => updateParams({ q: e.target.value || undefined })}
            className="w-full pl-8 pr-3 py-2 text-[13px] border border-stone-200 rounded-lg bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:border-stone-300"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal size={13} className="text-stone-400" />
          <FilterDropdown
            label="Status"
            options={PRINTER_STATUSES.map((status) => ({ id: status, name: status }))}
            selected={selectedStatuses}
            onToggle={(id) => toggleFilter("status", id, selectedStatuses)}
            renderOption={(option) => {
              const cfg = getPrinterStatusConfig(option.name);
              return <StatusOption name={option.name} dot={cfg.dot} />;
            }}
          />
          <FilterDropdown
            label="Toner"
            options={CONSUMABLE_STATUSES.map((status) => ({ id: status, name: status }))}
            selected={selectedToner}
            onToggle={(id) => toggleFilter("toner", id, selectedToner)}
            renderOption={(option) => {
              const cfg = getConsumableStatusConfig(option.name);
              return <StatusOption name={option.name} dot={cfg.dot} />;
            }}
          />
          <FilterDropdown
            label="Paper"
            options={CONSUMABLE_STATUSES.map((status) => ({ id: status, name: status }))}
            selected={selectedPaper}
            onToggle={(id) => toggleFilter("paper", id, selectedPaper)}
            renderOption={(option) => {
              const cfg = getConsumableStatusConfig(option.name);
              return <StatusOption name={option.name} dot={cfg.dot} />;
            }}
          />
          <FilterDropdown
            label="Site"
            options={locations}
            selected={selectedSites}
            onToggle={(id) => toggleFilter("site", id, selectedSites)}
          />
          {hasFilters && (
            <button
              onClick={() => updateParams({ q: undefined, status: undefined, toner: undefined, paper: undefined, site: undefined })}
              className="flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-stone-900 px-3 py-2 rounded-lg hover:bg-stone-700 transition-colors"
          >
            <Plus size={13} /> Add Printer
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-[3rem_1.2fr_7rem_7rem_7rem_8rem_8rem_2rem] gap-3 px-4 py-2.5 bg-stone-50 border-b border-stone-100">
          {["#", "Printer", "Status", "Toner", "Paper", "IP Address", "Site", ""].map((heading) => (
            <span key={heading} className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">{heading}</span>
          ))}
        </div>

        <div className="divide-y divide-stone-50">
          {printers.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-[13px]">No printers match your filters</div>
          ) : (
            printers.map((printer) => {
              const statusCfg = getPrinterStatusConfig(printer.status);
              const tonerCfg = getConsumableStatusConfig(printer.toner_status);
              const paperCfg = getConsumableStatusConfig(printer.paper_status);
              return (
                <button
                  key={printer.id}
                  onClick={() => router.push(`/printers/${printer.id}`)}
                  className="w-full grid grid-cols-[3rem_1.2fr_7rem_7rem_7rem_8rem_8rem_2rem] gap-3 px-4 py-3 items-center text-left hover:bg-stone-50 transition-colors group"
                >
                  <span className="text-[12px] font-mono text-stone-400 font-medium">{printer.printer_code}</span>
                  <span className="min-w-0 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <Printer size={14} className="text-stone-500" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-stone-800 truncate">{printer.name}</span>
                      <span className="block text-[11px] text-stone-400 truncate">
                        {[printer.manufacturer, printer.model].filter(Boolean).join(" ") || printer.serial_number || "No model captured"}
                      </span>
                    </span>
                  </span>
                  <Badge label={printer.status} cfg={statusCfg} />
                  <Badge label={printer.toner_status} cfg={tonerCfg} />
                  <Badge label={printer.paper_status} cfg={paperCfg} />
                  <span className="text-[12px] text-stone-500 truncate">{printer.ip_address ?? "-"}</span>
                  <span className="text-[12px] text-stone-500 truncate">{printer.location?.name ?? "-"}</span>
                  <ArrowUpRight size={13} className="text-stone-200 group-hover:text-stone-400 justify-self-end" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {showAdd && (
        <AddPrinterModal
          onClose={() => setShowAdd(false)}
          lookups={{ departments, locations, contacts }}
        />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "calm";
}) {
  const color = tone === "warn" ? "#C04F28" : tone === "calm" ? "#415445" : "#414042";
  const bg = tone === "warn" ? "#f8e4db" : tone === "calm" ? "#eef3e6" : "#f5f5f4";
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
      <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Printer size={14} style={{ color }} />
        </span>
        <span className="text-xl font-semibold tabular-nums" style={{ color }}>{value}</span>
      </div>
    </div>
  );
}

function Badge({ label, cfg }: { label: string | null | undefined; cfg: { color: string; dot: string; bg: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {label ?? "-"}
    </span>
  );
}

function StatusOption({ name, dot }: { name: string; dot: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-[13px] text-stone-700">{name}</span>
    </span>
  );
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  renderOption,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  renderOption?: (option: { id: string; name: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const count = selected.size;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center gap-1.5 text-[12.5px] border rounded-lg px-2.5 py-2 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-stone-300 ${
          count > 0 ? "border-stone-400 text-stone-800" : "border-stone-200 text-stone-600 hover:border-stone-300"
        }`}
      >
        {label}
        {count > 0 && (
          <span className="bg-stone-900 text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {count}
          </span>
        )}
        <ChevronDown size={11} className={`text-stone-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 min-w-[190px]">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(option.id)}
                onChange={() => onToggle(option.id)}
                className="w-3.5 h-3.5 rounded border-stone-300 accent-stone-800 flex-shrink-0"
              />
              {renderOption ? renderOption(option) : <span className="text-[13px] text-stone-700">{option.name}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
