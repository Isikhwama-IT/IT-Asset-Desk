"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Check, CheckCheck, Copy, Wifi, Printer, PenLine, Loader2 } from "lucide-react";
import type { OnboardingCase, OnboardingPrinterAssignment } from "@/types/database";
import { initializePrinterAssignments, updatePrinterChecklist, saveCaseDeviceChecklist } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

interface Props {
  c: OnboardingCase;
  printerAssignments: OnboardingPrinterAssignment[];
  onCaseUpdate: (updates: Partial<OnboardingCase>) => void;
  onAssignmentsChange: (assignments: OnboardingPrinterAssignment[]) => void;
}

type ChecklistField =
  | "profile_created" | "code_assigned" | "user_box_created"
  | "scanning_added" | "installed" | "test_print_done";

const PRINTER_CHECKLIST: { field: ChecklistField; label: string }[] = [
  { field: "profile_created",  label: "Profile created on portal" },
  { field: "code_assigned",    label: "Printer code assigned on portal" },
  { field: "user_box_created", label: "User box created" },
  { field: "scanning_added",   label: "Added to scanning" },
  { field: "installed",        label: "Printer installed on device" },
  { field: "test_print_done",  label: "Test print successful" },
];

function CopyRow({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // unavailable
    }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-stone-50 last:border-0">
      <span className="w-40 text-[11px] text-stone-400 uppercase tracking-wide flex-shrink-0">{label}</span>
      <span className="flex-1 text-[13px] text-stone-700 font-mono">{value ?? "—"}</span>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!value}
        className="flex-shrink-0 flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 disabled:opacity-30 transition-colors"
      >
        {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
      </button>
    </div>
  );
}

export default function Section8({ c, printerAssignments, onCaseUpdate, onAssignmentsChange }: Props) {
  const { error: toastError } = useToast();

  // ── 8a — Email signature ─────────────────────────────────────────────────
  // "Retrieved PNG" is a local pre-step reminder — not saved to DB
  const [pngRetrieved, setPngRetrieved] = useState(false);
  const [pendingSig, startSigTx] = useTransition();

  function toggleSignature(checked: boolean) {
    startSigTx(async () => {
      const { error } = await saveCaseDeviceChecklist(c.id, { email_signature_added: checked });
      if (error) { toastError(error); return; }
      onCaseUpdate({ email_signature_added: checked });
    });
  }

  // ── 8b — WiFi ─────────────────────────────────────────────────────────────
  const [pendingWifi, startWifiTx] = useTransition();

  function toggleWifi(checked: boolean) {
    startWifiTx(async () => {
      const { error } = await saveCaseDeviceChecklist(c.id, { wifi_connected: checked });
      if (error) { toastError(error); return; }
      onCaseUpdate({ wifi_connected: checked });
    });
  }

  // ── 8c — Printer setup ───────────────────────────────────────────────────
  const [printerNames, setPrinterNames] = useState<Record<string, string>>({});
  const [initializing, setInitializing] = useState(false);

  const initialize = useCallback(async () => {
    setInitializing(true);
    const result = await initializePrinterAssignments(c.id);
    setInitializing(false);
    if (result.error) { toastError(result.error); return; }
    onAssignmentsChange(result.assignments);
    setPrinterNames(result.printerNames);
  }, [c.id, onAssignmentsChange, toastError]);

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pendingChecklist, startChecklistTx] = useTransition();

  function togglePrinterField(pa: OnboardingPrinterAssignment, field: ChecklistField, value: boolean) {
    startChecklistTx(async () => {
      const { error } = await updatePrinterChecklist(pa.id, c.id, field, value);
      if (error) { toastError(error); return; }
      onAssignmentsChange(
        printerAssignments.map((a) => (a.id === pa.id ? { ...a, [field]: value } : a))
      );
    });
  }

  const employeeName = [c.first_name, c.last_name].filter(Boolean).join(" ") || null;

  return (
    <div className="space-y-6">
      {/* ── 8a — Email signature ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <PenLine size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            8a — Email signature
          </span>
          {c.email_signature_added && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Done
            </span>
          )}
        </div>

        <div className="space-y-2">
          {/* Step 1 — local only, no DB save */}
          <label
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-colors",
              pngRetrieved ? "border-green-200 bg-green-50/50" : "border-stone-200 hover:border-stone-300"
            )}
          >
            <input
              type="checkbox"
              checked={pngRetrieved}
              onChange={(e) => setPngRetrieved(e.target.checked)}
              className="accent-[#415445] w-4 h-4"
            />
            <span className={cn("text-[13px] font-medium", pngRetrieved ? "text-green-700" : "text-stone-700")}>
              Retrieved Ashton&apos;s PNG from SharePoint
            </span>
            {pngRetrieved && <Check size={12} className="ml-auto text-green-500 flex-shrink-0" />}
          </label>

          {/* Step 2 — saves to email_signature_added */}
          <label
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg border select-none transition-colors",
              pendingSig ? "opacity-60 cursor-default" : "cursor-pointer",
              c.email_signature_added ? "border-green-200 bg-green-50/50" : "border-stone-200 hover:border-stone-300"
            )}
          >
            <input
              type="checkbox"
              checked={!!c.email_signature_added}
              onChange={(e) => toggleSignature(e.target.checked)}
              disabled={pendingSig}
              className="accent-[#415445] w-4 h-4"
            />
            <span className={cn("text-[13px] font-medium", c.email_signature_added ? "text-green-700" : "text-stone-700")}>
              Email signature added to Outlook
            </span>
            {c.email_signature_added && <Check size={12} className="ml-auto text-green-500 flex-shrink-0" />}
          </label>
        </div>
      </div>

      {/* ── 8b — WiFi ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Wifi size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            8b — WiFi
          </span>
          {c.wifi_connected && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Done
            </span>
          )}
        </div>

        <label
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg border select-none transition-colors",
            pendingWifi ? "opacity-60 cursor-default" : "cursor-pointer",
            c.wifi_connected ? "border-green-200 bg-green-50/50" : "border-stone-200 hover:border-stone-300"
          )}
        >
          <input
            type="checkbox"
            checked={!!c.wifi_connected}
            onChange={(e) => toggleWifi(e.target.checked)}
            disabled={pendingWifi}
            className="accent-[#415445] w-4 h-4"
          />
          <span className={cn("text-[13px] font-medium", c.wifi_connected ? "text-green-700" : "text-stone-700")}>
            Laptop connected to WiFi
          </span>
          {c.wifi_connected && <Check size={12} className="ml-auto text-green-500 flex-shrink-0" />}
        </label>
      </div>

      {/* ── 8c — Printer setup ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Printer size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            8c — Printer setup
          </span>
          {initializing && <Loader2 size={12} className="ml-auto text-stone-400 animate-spin" />}
        </div>

        {!initializing && printerAssignments.length === 0 && (
          <p className="text-[12px] text-stone-400 italic">
            No printers found at {c.location ?? "this location"}.
          </p>
        )}

        <div className="space-y-4">
          {printerAssignments.map((pa) => {
            const printerName = printerNames[pa.printer_id] ?? `Printer ${pa.printer_id.slice(0, 6)}`;
            const allDone = PRINTER_CHECKLIST.every(({ field }) => pa[field]);

            return (
              <div
                key={pa.id}
                className={cn(
                  "border rounded-xl overflow-hidden",
                  allDone ? "border-green-200" : "border-stone-200"
                )}
              >
                {/* Printer header */}
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5",
                    allDone ? "bg-green-50" : "bg-stone-50"
                  )}
                >
                  <Printer size={13} className={allDone ? "text-green-500" : "text-stone-400"} />
                  <span className="text-[12px] font-semibold text-stone-700">{printerName}</span>
                  {allDone && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
                      <Check size={11} /> Complete
                    </span>
                  )}
                </div>

                {/* Copy block — Olivetti web portal values */}
                <div className="px-4 py-3 border-b border-stone-100">
                  <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wide mb-2">
                    Olivetti Portal Values
                  </p>
                  <CopyRow label="Employee name"   value={employeeName} />
                  <CopyRow label="Email address"   value={c.email_address} />
                  <CopyRow label="Printer code"    value={pa.printer_code} />
                  <CopyRow label="Account track"   value={pa.account_track_profile} />
                  <CopyRow label="User box name"   value={pa.user_box_name} />
                  <CopyRow label="Scan-to-email"   value={pa.scan_email} />
                </div>

                {/* Checklist */}
                <div className="px-4 py-3 space-y-1.5">
                  {PRINTER_CHECKLIST.map(({ field, label }) => (
                    <label
                      key={field}
                      className={cn(
                        "flex items-center gap-3 px-2 py-1.5 rounded-md select-none transition-colors",
                        pendingChecklist ? "opacity-60 cursor-default" : "cursor-pointer",
                        pa[field] ? "bg-green-50/60" : "hover:bg-stone-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={!!pa[field]}
                        onChange={(e) => togglePrinterField(pa, field, e.target.checked)}
                        disabled={pendingChecklist}
                        className="accent-[#415445] w-4 h-4"
                      />
                      <span
                        className={cn(
                          "text-[13px] font-medium",
                          pa[field] ? "text-green-700" : "text-stone-700"
                        )}
                      >
                        {label}
                      </span>
                      {pa[field] && <Check size={11} className="ml-auto text-green-500 flex-shrink-0" />}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
