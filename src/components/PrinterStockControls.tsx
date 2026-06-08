"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { updatePrinterStock, type StockField } from "@/lib/actions";
import { PAPER_CONSTANTS } from "@/lib/printer-capabilities";

// ── Helpers ───────────────────────────────────────────────────────────────────

function flagLabel(pct: number | null): string {
  if (pct === null) return "—";
  if (pct >= 76) return "New";
  if (pct >= 51) return "In Use";
  if (pct >= 26) return "Half";
  if (pct >= 1) return "Order Now";
  return "Empty";
}

function barColor(pct: number | null): string {
  if (pct === null) return "bg-stone-200";
  if (pct >= 76) return "bg-emerald-500";
  if (pct >= 51) return "bg-sky-500";
  if (pct >= 26) return "bg-amber-400";
  if (pct >= 1) return "bg-red-400";
  return "bg-red-900";
}

function pctColor(pct: number | null): string {
  if (pct === null) return "text-stone-400";
  if (pct === 0) return "text-red-700";
  if (pct <= 25) return "text-red-500";
  if (pct <= 50) return "text-amber-600";
  return "text-stone-600";
}

// ── Toner row ─────────────────────────────────────────────────────────────────

export type TonerRow = {
  colour: "black" | "cyan" | "magenta" | "yellow";
  label: string;
  field: StockField;
  snmpPct: number | null;
  stock: number;
};

function TonerStockRow({
  printerId,
  row,
}: {
  printerId: string;
  row: TonerRow;
}) {
  const [stock, setStock] = useState(row.stock);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  function adjust(delta: 1 | -1) {
    if (stock + delta < 0) return;
    startTransition(async () => {
      setErr("");
      const res = await updatePrinterStock(printerId, row.field, delta);
      if (res?.error) setErr(res.error);
      else if (typeof res?.newValue === "number") setStock(res.newValue);
    });
  }

  const needsReorder = row.snmpPct !== null && row.snmpPct <= 25 && stock === 0;
  const isLow = row.snmpPct !== null && row.snmpPct <= 25 && stock > 0;
  const isEmpty = stock === 0;
  const pct = row.snmpPct;

  return (
    <div className="py-3 border-b border-stone-50 last:border-0">
      {/* Label + reorder flag */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-stone-700">{row.label}</span>
          {needsReorder && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle size={9} />
              Reorder
            </span>
          )}
          {isLow && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Low
            </span>
          )}
        </div>

        {/* +/- stock control */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10.5px] text-stone-400 mr-1">on shelf</span>
          <button
            onClick={() => adjust(-1)}
            disabled={pending || stock === 0}
            className="w-6 h-6 rounded border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minus size={10} />
          </button>
          <span
            className="w-6 text-center text-[13px] font-semibold tabular-nums"
            style={{ color: isEmpty ? "#dc2626" : "#415445" }}
          >
            {stock}
          </span>
          <button
            onClick={() => adjust(1)}
            disabled={pending}
            className="w-6 h-6 rounded border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={10} />
          </button>
        </div>
      </div>

      {/* Level bar from SNMP */}
      {pct !== null ? (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10.5px] text-stone-400">In printer</span>
            <span className={`text-[10.5px] font-medium ${pctColor(pct)}`}>
              {pct}% · {flagLabel(pct)}
            </span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[10.5px] text-stone-300">No SNMP data — run a poll to see levels</p>
      )}

      {err && <p className="text-[10px] text-red-500 mt-1">{err}</p>}
    </div>
  );
}

// ── Paper row ─────────────────────────────────────────────────────────────────

const REAMS_PER_BOX = PAPER_CONSTANTS.A4.reamsPerBox!;
const SHEETS_PER_REAM = PAPER_CONSTANTS.A4.sheetsPerReam;

function PaperStockRow({ printerId, initial }: { printerId: string; initial: number }) {
  const [boxes, setBoxes] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  function adjust(delta: 1 | -1) {
    if (boxes + delta < 0) return;
    startTransition(async () => {
      setErr("");
      const res = await updatePrinterStock(printerId, "paper_boxes_on_hand", delta);
      if (res?.error) setErr(res.error);
      else if (typeof res?.newValue === "number") setBoxes(res.newValue);
    });
  }

  const reams = boxes * REAMS_PER_BOX;
  const sheets = reams * SHEETS_PER_REAM;
  const outOfStock = boxes === 0;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-stone-700">Paper</span>
          {outOfStock && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle size={9} />
              Out of stock
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10.5px] text-stone-400 mr-1">boxes</span>
          <button
            onClick={() => adjust(-1)}
            disabled={pending || boxes === 0}
            className="w-6 h-6 rounded border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minus size={10} />
          </button>
          <span
            className="w-6 text-center text-[13px] font-semibold tabular-nums"
            style={{ color: outOfStock ? "#dc2626" : "#415445" }}
          >
            {boxes}
          </span>
          <button
            onClick={() => adjust(1)}
            disabled={pending}
            className="w-6 h-6 rounded border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-300 hover:text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={10} />
          </button>
        </div>
      </div>

      {/* Derived quantities */}
      <div className="flex gap-4 text-[11px] text-stone-500 bg-stone-50 rounded-lg px-3 py-2">
        <span><span className="font-medium text-stone-700">{reams}</span> reams</span>
        <span className="text-stone-300">·</span>
        <span><span className="font-medium text-stone-700">{sheets.toLocaleString()}</span> sheets</span>
        <span className="text-stone-300">·</span>
        <span className="text-stone-400">{REAMS_PER_BOX} reams/box · {SHEETS_PER_REAM} sheets/ream</span>
      </div>

      {err && <p className="text-[10px] text-red-500 mt-1">{err}</p>}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PrinterStockControls({
  printerId,
  tonerRows,
  paperBoxes,
}: {
  printerId: string;
  tonerRows: TonerRow[];
  paperBoxes: number;
}) {
  return (
    <div>
      {tonerRows.map((row) => (
        <TonerStockRow key={row.colour} printerId={printerId} row={row} />
      ))}
      <div className="border-t border-stone-100 mt-1 pt-1">
        <PaperStockRow printerId={printerId} initial={paperBoxes} />
      </div>
    </div>
  );
}
