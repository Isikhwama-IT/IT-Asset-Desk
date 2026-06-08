"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BtnPrimary,
  BtnSecondary,
  ErrorBanner,
  FormField,
  FormStack,
  Modal,
  ModalFooter,
} from "@/components/modal-ui";
import { useToast } from "@/components/Toast";
import { upsertLocationPaperStock } from "@/lib/actions";
import {
  REAMS_PER_BOX_A4,
  SHEETS_PER_BOX_A4,
  SHEETS_PER_REAM_A3,
  SHEETS_PER_REAM_A4,
  sheetsFromPaperStock,
  type PaperSize,
  type PrinterCapabilities,
  type TrayConfig,
} from "@/lib/printer-capabilities";
import type { LocationPaperStock, PrinterWithRelations } from "@/types/database";

type TrayState = {
  tray_id: string;
  tray_name: string;
  paper_size: PaperSize;
  boxes: number;
  reams: number;
};

function clampWhole(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function initTrayState(tray: TrayConfig, existingStock: LocationPaperStock[]): TrayState {
  const existing = existingStock.find((stock) => stock.paper_size === tray.paper_size);
  const paperSize = tray.paper_size;
  const reamsOnHand = existing?.reams_on_hand ?? 0;
  const isA4 = paperSize === "A4";

  return {
    tray_id: tray.id,
    tray_name: tray.tray_name,
    paper_size: paperSize,
    boxes: isA4 ? Math.floor(reamsOnHand / REAMS_PER_BOX_A4) : 0,
    reams: isA4 ? reamsOnHand % REAMS_PER_BOX_A4 : reamsOnHand,
  };
}

function totalReams(state: TrayState): number {
  return state.paper_size === "A4"
    ? state.boxes * REAMS_PER_BOX_A4 + state.reams
    : state.reams;
}

function totalSheets(state: TrayState): number {
  return sheetsFromPaperStock(state.paper_size, state.boxes, state.reams);
}

function daysLabel(sheets: number, avgDailyPages: number | null): string {
  if (!avgDailyPages || avgDailyPages <= 0) return "-";
  const days = Math.round(sheets / avgDailyPages);
  return `~${days} day${days === 1 ? "" : "s"}`;
}

function TraySection({
  state,
  avgDailyPages,
  onChange,
}: {
  state: TrayState;
  avgDailyPages: number | null;
  onChange: (next: TrayState) => void;
}) {
  const isA4 = state.paper_size === "A4";
  const sheets = totalSheets(state);
  const reams = totalReams(state);
  const inputClass =
    "text-[12.5px] border border-stone-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <div className="border border-stone-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-stone-700">{state.tray_name}</p>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
          {state.paper_size}
        </span>
      </div>

      <div className={`grid gap-3 mb-3 ${isA4 ? "grid-cols-2" : "grid-cols-1 max-w-[160px]"}`}>
        {isA4 && (
          <FormField label="Boxes">
            <input
              className={inputClass}
              type="number"
              min={0}
              max={20}
              value={state.boxes}
              onChange={(event) => onChange({ ...state, boxes: clampWhole(event.target.value, 0, 20) })}
            />
          </FormField>
        )}
        <FormField label="Reams">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={isA4 ? REAMS_PER_BOX_A4 - 1 : 20}
            value={state.reams}
            onChange={(event) =>
              onChange({ ...state, reams: clampWhole(event.target.value, 0, isA4 ? REAMS_PER_BOX_A4 - 1 : 20) })
            }
          />
        </FormField>
      </div>

      <p className="text-[10.5px] text-stone-400 mb-3">
        {isA4
          ? `1 box = ${REAMS_PER_BOX_A4} reams = ${SHEETS_PER_BOX_A4.toLocaleString()} sheets | 1 ream = ${SHEETS_PER_REAM_A4} sheets`
          : `1 ream = ${SHEETS_PER_REAM_A3} sheets`}
      </p>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-stone-50 rounded-lg py-2">
          <p className="text-[11px] text-stone-400 mb-0.5">Total reams</p>
          <p className="text-[13px] font-semibold text-stone-700">{reams}</p>
        </div>
        <div className="bg-stone-50 rounded-lg py-2">
          <p className="text-[11px] text-stone-400 mb-0.5">Total sheets</p>
          <p className="text-[13px] font-semibold text-stone-700">{sheets.toLocaleString()}</p>
        </div>
        <div className="bg-stone-50 rounded-lg py-2">
          <p className="text-[11px] text-stone-400 mb-0.5">Est. days</p>
          <p
            className="text-[13px] font-semibold"
            style={{ color: !avgDailyPages ? "#a8a29e" : sheets === 0 ? "#dc2626" : "#415445" }}
          >
            {daysLabel(sheets, avgDailyPages)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UpdatePaperStockModal({
  printer,
  capabilities,
  existingStock,
  avgDailyPages,
  onClose,
}: {
  printer: PrinterWithRelations;
  capabilities: PrinterCapabilities;
  existingStock: LocationPaperStock[];
  avgDailyPages: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [trayStates, setTrayStates] = useState<TrayState[]>(() =>
    capabilities.trays.map((tray) => initTrayState(tray, existingStock))
  );

  function updateTray(trayId: string, next: TrayState) {
    setTrayStates((prev) => prev.map((state) => (state.tray_id === trayId ? next : state)));
  }

  function save() {
    startTransition(async () => {
      setError("");
      const res = await upsertLocationPaperStock(
        printer.id,
        trayStates.map((state) => ({
          tray_id: state.tray_id,
          paper_size: state.paper_size,
          boxes_on_hand: state.paper_size === "A4" ? state.boxes : 0,
          reams_on_hand: totalReams(state),
        }))
      );

      if (res?.error) {
        setError(res.error);
        return;
      }

      success("Paper stock updated.");
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      title={`Update Paper Stock - ${printer.name}`}
      onClose={onClose}
      width="max-w-2xl"
    >
      <FormStack>
        {error && <ErrorBanner message={error} />}

        {capabilities.trays.length === 0 && (
          <p className="text-[12.5px] text-stone-400 text-center py-4">
            No trays configured. Add trays in the printer edit form.
          </p>
        )}

        {trayStates.map((state) => (
          <TraySection
            key={state.tray_id}
            state={state}
            avgDailyPages={avgDailyPages}
            onChange={(next) => updateTray(state.tray_id, next)}
          />
        ))}

        <p className="text-[10.5px] text-stone-400">
          A4 uses {REAMS_PER_BOX_A4} reams per box. A3 is tracked in reams only.
        </p>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save} disabled={pending || capabilities.trays.length === 0}>
            {pending ? "Saving..." : "Save Stock"}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}
