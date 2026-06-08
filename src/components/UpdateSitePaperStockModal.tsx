"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Modal, FormField, ModalFooter, BtnPrimary, BtnSecondary, ErrorBanner, FormStack,
} from "@/components/modal-ui";
import { upsertLocationPaperStock } from "@/lib/actions";
import {
  REAMS_PER_BOX_A4, SHEETS_PER_BOX_A4, SHEETS_PER_REAM_A4, SHEETS_PER_REAM_A3,
} from "@/lib/printer-capabilities";
import type { Location, LocationPaperStock } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalReamsA4(boxes: number, reams: number): number {
  return boxes * REAMS_PER_BOX_A4 + reams;
}

function totalSheetsA4(boxes: number, reams: number): number {
  return boxes * SHEETS_PER_BOX_A4 + reams * SHEETS_PER_REAM_A4;
}

function totalSheetsA3(reams: number): number {
  return reams * SHEETS_PER_REAM_A3;
}

function daysLabel(sheets: number, avgDailyPages: number | null): string {
  if (!avgDailyPages || avgDailyPages <= 0 || sheets <= 0) return "—";
  const days = Math.round(sheets / avgDailyPages);
  return `~${days} day${days !== 1 ? "s" : ""}`;
}

// ── Input style ───────────────────────────────────────────────────────────────

const inp =
  "text-[12.5px] border border-stone-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-stone-300";

// ── Live calc strip ───────────────────────────────────────────────────────────

function CalcStrip({
  reams,
  sheets,
  avgDailyPages,
}: {
  reams: number;
  sheets: number;
  avgDailyPages: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 text-center mt-3">
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
          style={{
            color: !avgDailyPages ? "#a8a29e" : sheets === 0 ? "#dc2626" : "#415445",
          }}
        >
          {daysLabel(sheets, avgDailyPages)}
        </p>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function UpdateSitePaperStockModal({
  location,
  existingStock,
  avgDailyPages,
  onClose,
}: {
  location: Location;
  existingStock: LocationPaperStock[];
  avgDailyPages: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const a4 = existingStock.find((s) => s.paper_size === "A4");
  const a3 = existingStock.find((s) => s.paper_size === "A3");

  const [a4Boxes, setA4Boxes] = useState(a4?.boxes_on_hand ?? 0);
  const [a4Reams, setA4Reams] = useState(a4?.reams_on_hand ?? 0);
  const [a3Reams, setA3Reams] = useState(a3?.reams_on_hand ?? 0);

  function clamp(v: string, max: number): number {
    const n = parseInt(v) || 0;
    return Math.max(0, Math.min(max, n));
  }

  function save() {
    startTransition(async () => {
      setError("");
      const res = await upsertLocationPaperStock(location.id, [
        { paper_size: "A4", boxes_on_hand: a4Boxes, reams_on_hand: a4Reams },
        { paper_size: "A3", boxes_on_hand: 0,        reams_on_hand: a3Reams },
      ]);
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  const a4TotalReams  = totalReamsA4(a4Boxes, a4Reams);
  const a4TotalSheets = totalSheetsA4(a4Boxes, a4Reams);
  const a3TotalSheets = totalSheetsA3(a3Reams);

  return (
    <Modal
      title="Update Paper Stock"
      subtitle={location.name}
      onClose={onClose}
      width="max-w-lg"
    >
      <FormStack>
        {error && <ErrorBanner message={error} />}

        {/* A4 section */}
        <div className="border border-stone-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-stone-700">A4 Paper</p>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">A4</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <FormField label="Boxes">
              <input
                className={inp}
                type="number"
                min={0}
                max={100}
                value={a4Boxes}
                onChange={(e) => setA4Boxes(clamp(e.target.value, 100))}
              />
            </FormField>
            <FormField label="Reams">
              <input
                className={inp}
                type="number"
                min={0}
                max={REAMS_PER_BOX_A4 - 1}
                value={a4Reams}
                onChange={(e) => setA4Reams(clamp(e.target.value, REAMS_PER_BOX_A4 - 1))}
              />
            </FormField>
          </div>

          <p className="text-[10.5px] text-stone-400">
            1 box = {REAMS_PER_BOX_A4} reams = {SHEETS_PER_BOX_A4.toLocaleString()} sheets
            &nbsp;|&nbsp;1 ream = {SHEETS_PER_REAM_A4} sheets
          </p>

          <CalcStrip
            reams={a4TotalReams}
            sheets={a4TotalSheets}
            avgDailyPages={avgDailyPages}
          />
        </div>

        {/* A3 section */}
        <div className="border border-stone-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-stone-700">A3 Paper</p>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">A3</span>
          </div>

          <div className="max-w-[160px] mb-3">
            <FormField label="Reams">
              <input
                className={inp}
                type="number"
                min={0}
                max={100}
                value={a3Reams}
                onChange={(e) => setA3Reams(clamp(e.target.value, 100))}
              />
            </FormField>
          </div>

          <p className="text-[10.5px] text-stone-400">
            1 ream = {SHEETS_PER_REAM_A3} sheets — A3 is sold in reams only
          </p>

          <CalcStrip
            reams={a3Reams}
            sheets={a3TotalSheets}
            avgDailyPages={null}
          />
        </div>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save Stock"}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}
