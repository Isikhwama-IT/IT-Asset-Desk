"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { Check, Package, Truck } from "lucide-react";
import type { OnboardingCase, OnboardingSpendItem } from "@/types/database";
import { saveSpendItemReceival, logOnboardingAssets, arrangeUpstreamCollection } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

interface Props {
  c: OnboardingCase;
  spendItems: OnboardingSpendItem[];
  onCaseUpdate: (updates: Partial<OnboardingCase>) => void;
  onSpendChange: (items: OnboardingSpendItem[]) => void;
}

type RowEdit = {
  brand: string;
  model: string;
  received: boolean;
  condition: string;
  condition_notes: string;
  serial_number: string;
  asset_tag: string;
  saving: boolean;
  dirty: boolean;
};

const CONDITIONS = ["Good", "Damaged"] as const;

export default function Section6({ c, spendItems, onCaseUpdate, onSpendChange }: Props) {
  const { error: toastError, success } = useToast();
  const [pendingLog, startLogTx] = useTransition();
  const [pendingCollection, startCollectionTx] = useTransition();

  const hardwareItems = useMemo(
    () => spendItems.filter((i) => i.category !== "license"),
    [spendItems]
  );

  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>(() =>
    Object.fromEntries(
      hardwareItems.map((i) => [
        i.id,
        {
          brand: i.brand ?? "",
          model: i.model ?? "",
          received: i.received,
          condition: i.condition ?? "Good",
          condition_notes: i.condition_notes ?? "",
          serial_number: i.serial_number ?? "",
          asset_tag: i.asset_tag ?? "",
          saving: false,
          dirty: false,
        },
      ])
    )
  );

  useEffect(() => {
    setRowEdits((prev) => {
      const next = { ...prev };
      hardwareItems.forEach((i) => {
        if (!next[i.id]) {
          next[i.id] = {
            brand: i.brand ?? "",
            model: i.model ?? "",
            received: i.received,
            condition: i.condition ?? "Good",
            condition_notes: i.condition_notes ?? "",
            serial_number: i.serial_number ?? "",
            asset_tag: i.asset_tag ?? "",
            saving: false,
            dirty: false,
          };
        }
      });
      return next;
    });
  }, [hardwareItems]);

  function setRowField(id: string, field: keyof RowEdit, value: string | boolean) {
    setRowEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  }

  async function saveRow(item: OnboardingSpendItem) {
    const edit = rowEdits[item.id];
    if (!edit) return;

    setRowEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], saving: true } }));
    const { error } = await saveSpendItemReceival(item.id, c.id, {
      brand: edit.brand || null,
      model: edit.model || null,
      received: edit.received,
      condition: edit.condition || null,
      condition_notes: edit.condition === "Damaged" ? edit.condition_notes || null : null,
      serial_number: edit.serial_number || null,
      asset_tag: edit.asset_tag || null,
    });
    setRowEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], saving: false, dirty: false } }));

    if (error) { toastError(error); return; }

    onSpendChange(
      spendItems.map((i) =>
        i.id === item.id
          ? {
              ...i,
              brand: edit.brand || null,
              model: edit.model || null,
              received: edit.received,
              condition: edit.condition || null,
              condition_notes: edit.condition === "Damaged" ? edit.condition_notes || null : null,
              serial_number: edit.serial_number || null,
              asset_tag: edit.asset_tag || null,
            }
          : i
      )
    );
  }

  // Vacuously true when no hardware items — nothing to receive/log
  const allReceived =
    hardwareItems.length === 0 ||
    hardwareItems.every((i) => rowEdits[i.id]?.received ?? i.received);

  const allLogged =
    hardwareItems.length === 0 ||
    hardwareItems.every((i) => i.asset_id != null);

  const hasDirtyRows = Object.values(rowEdits).some((r) => r.dirty);

  function handleLogAssets() {
    if (hasDirtyRows) {
      toastError("Save all rows before logging assets.");
      return;
    }
    startLogTx(async () => {
      const result = await logOnboardingAssets(c.id);
      if (result.error) { toastError(result.error); return; }

      if (result.assetMap && Object.keys(result.assetMap).length > 0) {
        onSpendChange(
          spendItems.map((i) =>
            result.assetMap![i.id] ? { ...i, asset_id: result.assetMap![i.id] } : i
          )
        );
      }

      success("Assets logged and assigned to employee");
    });
  }

  function handleArrangeCollection() {
    startCollectionTx(async () => {
      const { error } = await arrangeUpstreamCollection(c.id);
      if (error) { toastError(error); return; }
      success("Upstream collection arranged — Section 7 is now unlocked");
      onCaseUpdate({ collection_arranged_at: new Date().toISOString() });
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Items ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Package size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            6a — Record received items
          </span>
          {allReceived && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> All received
            </span>
          )}
        </div>

        {hardwareItems.length === 0 ? (
          <p className="text-[12px] text-stone-400 italic">No hardware items to receive.</p>
        ) : (
          <div className="space-y-3">
            {hardwareItems.map((item) => {
              const edit = rowEdits[item.id] ?? {
                brand: item.brand ?? "",
                model: item.model ?? "",
                received: item.received,
                condition: item.condition ?? "Good",
                condition_notes: item.condition_notes ?? "",
                serial_number: item.serial_number ?? "",
                asset_tag: item.asset_tag ?? "",
                saving: false,
                dirty: false,
              };

              return (
                <div
                  key={item.id}
                  className={cn(
                    "border rounded-lg px-4 py-3.5 space-y-3",
                    item.asset_id
                      ? "border-blue-200 bg-blue-50/30"
                      : edit.received
                      ? "border-green-200 bg-green-50/30"
                      : "border-stone-200 bg-white"
                  )}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[13px] font-medium text-stone-700 capitalize">
                        {item.description}
                      </span>
                      <span className="ml-2 text-[11px] text-stone-400 capitalize">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.asset_id && (
                        <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                          <Check size={10} /> Asset logged
                        </span>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-[12px] text-stone-500">Received</span>
                        <input
                          type="checkbox"
                          checked={edit.received}
                          onChange={(e) => setRowField(item.id, "received", e.target.checked)}
                          disabled={!!item.asset_id}
                          className="accent-[#415445] w-4 h-4"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Detail fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1 uppercase tracking-wide">Brand</label>
                      <input
                        type="text"
                        value={edit.brand}
                        onChange={(e) => setRowField(item.id, "brand", e.target.value)}
                        placeholder="e.g. Dell"
                        disabled={!!item.asset_id}
                        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1 uppercase tracking-wide">Model</label>
                      <input
                        type="text"
                        value={edit.model}
                        onChange={(e) => setRowField(item.id, "model", e.target.value)}
                        placeholder="e.g. Latitude 5540"
                        disabled={!!item.asset_id}
                        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1 uppercase tracking-wide">Serial Number</label>
                      <input
                        type="text"
                        value={edit.serial_number}
                        onChange={(e) => setRowField(item.id, "serial_number", e.target.value)}
                        placeholder="S/N"
                        disabled={!!item.asset_id}
                        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1 uppercase tracking-wide">Asset Tag</label>
                      <input
                        type="text"
                        value={edit.asset_tag}
                        onChange={(e) => setRowField(item.id, "asset_tag", e.target.value)}
                        placeholder="Tag #"
                        disabled={!!item.asset_id}
                        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-stone-400 uppercase tracking-wide">Condition</label>
                    <div className="flex gap-2">
                      {CONDITIONS.map((cond) => (
                        <label
                          key={cond}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer text-[12px] font-medium transition-colors",
                            edit.condition === cond
                              ? cond === "Good"
                                ? "border-green-400 bg-green-50 text-green-700"
                                : "border-red-400 bg-red-50 text-red-700"
                              : "border-stone-200 text-stone-500 hover:border-stone-300",
                            !!item.asset_id && "pointer-events-none opacity-60"
                          )}
                        >
                          <input
                            type="radio"
                            name={`condition-${item.id}`}
                            value={cond}
                            checked={edit.condition === cond}
                            onChange={() => setRowField(item.id, "condition", cond)}
                            disabled={!!item.asset_id}
                            className="hidden"
                          />
                          {cond}
                        </label>
                      ))}
                    </div>
                    {edit.condition === "Damaged" && (
                      <textarea
                        value={edit.condition_notes}
                        onChange={(e) => setRowField(item.id, "condition_notes", e.target.value)}
                        placeholder="Describe the damage…"
                        disabled={!!item.asset_id}
                        rows={2}
                        className="w-full px-2.5 py-1.5 text-[13px] border border-red-200 rounded-md focus:outline-none focus:border-red-400 resize-none disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    )}
                  </div>

                  {/* Save button */}
                  {edit.dirty && !item.asset_id && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => saveRow(item)}
                        disabled={edit.saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ background: "#415445" }}
                      >
                        <Check size={11} />
                        {edit.saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Log all assets ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Check size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            6b — Log assets in system
          </span>
        </div>

        {hardwareItems.length === 0 ? (
          <p className="text-[12px] text-stone-400 italic">No hardware procured — nothing to log.</p>
        ) : !allLogged ? (
          <>
            {hasDirtyRows && (
              <p className="text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Save all unsaved rows before logging assets.
              </p>
            )}
            <button
              type="button"
              onClick={handleLogAssets}
              disabled={!allReceived || pendingLog}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: "#C04F28" }}
              title={!allReceived ? "All items must be marked received first" : undefined}
            >
              <Check size={13} />
              {pendingLog ? "Logging…" : "Log all assets"}
            </button>
            {!allReceived && (
              <p className="text-[12px] text-stone-400">
                Mark all items as received to enable asset logging.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-blue-700 flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Check size={12} />
            All assets have been logged and assigned to the employee.
          </p>
        )}
      </div>

      {/* ── Arrange Upstream collection — only when hardware was procured ─────── */}
      {allLogged && hardwareItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
            <Truck size={13} className="text-stone-400" />
            <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
              6c — Arrange Upstream collection
            </span>
            {c.collection_arranged_at && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
                <Check size={11} /> Arranged
              </span>
            )}
          </div>

          <p className="text-[13px] text-stone-600">
            Contact Upstream to arrange collection of the old device.
            Once arranged, mark it here to unlock Section 7.
          </p>

          {c.collection_arranged_at ? (
            <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
              <Check size={12} className="text-green-500" />
              Arranged {new Date(c.collection_arranged_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          ) : (
            <button
              type="button"
              onClick={handleArrangeCollection}
              disabled={pendingCollection}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "#C04F28" }}
            >
              <Truck size={13} />
              {pendingCollection ? "Saving…" : "Mark collection as arranged"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
