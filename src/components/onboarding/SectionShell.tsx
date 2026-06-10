"use client";

import { useState } from "react";
import { Lock, Check, Pencil, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionState } from "@/lib/onboarding";

interface Props {
  n: number;
  title: string;
  state: SectionState;
  lockReason?: string;
  awaitingLabel?: string | null;
  summary?: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  showSpendWarning?: boolean;
  hideShellSave?: boolean;
  readOnly?: boolean;
  children?: React.ReactNode;
}

export default function SectionShell({
  n, title, state, lockReason, awaitingLabel, summary,
  isEditing, onEdit, onSave, onCancel, showSpendWarning, hideShellSave, readOnly, children,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // ── Locked ───────────────────────────────────────────────────────────────────
  if (state === "locked") {
    return (
      <div className="opacity-50 bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[11px] font-bold text-stone-400">{n}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-stone-600">{title}</h3>
            <Lock size={11} className="text-stone-400 flex-shrink-0" />
          </div>
          {lockReason && (
            <p className="text-[12px] text-stone-400 mt-0.5">{lockReason}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Awaiting ─────────────────────────────────────────────────────────────────
  if (state === "awaiting") {
    return (
      <div className="bg-white rounded-xl border border-stone-100 border-l-4 border-l-amber-400 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-50">
          <span className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-amber-600">{n}</span>
          </span>
          <h3 className="text-[14px] font-semibold text-stone-800 flex-1">{title}</h3>
          {awaitingLabel && (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
              Awaiting {awaitingLabel}
            </span>
          )}
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────────────────
  if (state === "complete" && !isEditing) {
    return (
      <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-green-600" strokeWidth={2.5} />
          </span>
          <h3 className="text-[14px] font-semibold text-stone-600 flex-1">{title}</h3>
          {summary && !expanded && (
            <span className="text-[12px] text-stone-400 hidden sm:block truncate max-w-[260px]">
              {summary}
            </span>
          )}
          {!readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-300 hover:text-stone-600 transition-colors flex-shrink-0"
              title="Edit section"
            >
              <Pencil size={12} />
            </button>
          )}
          {expanded
            ? <ChevronUp size={13} className="text-stone-300 flex-shrink-0" />
            : <ChevronDown size={13} className="text-stone-300 flex-shrink-0" />}
        </div>
        {expanded && (
          <div className="border-t border-stone-50 px-4 py-4 bg-stone-50/30">
            {children}
          </div>
        )}
      </div>
    );
  }

  // ── Active / Edit mode ────────────────────────────────────────────────────────
  return (
    <div className={cn(
      "bg-white rounded-xl border overflow-hidden",
      isEditing ? "border-[#C04F28] shadow-sm" : "border-stone-200"
    )}>
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 border-b",
        isEditing ? "border-[#C04F28]/20 bg-[#C04F28]/5" : "border-stone-100"
      )}>
        <span className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
          isEditing ? "bg-[#C04F28]" : "bg-stone-100"
        )}>
          <span className={cn(
            "text-[11px] font-bold",
            isEditing ? "text-white" : "text-stone-500"
          )}>{n}</span>
        </span>
        <h3 className="text-[14px] font-semibold text-stone-800 flex-1">{title}</h3>
        {isEditing && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            {!hideShellSave && (
              <button
                onClick={onSave}
                className="flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: "#C04F28" }}
              >
                <Check size={11} strokeWidth={2.5} /> Save
              </button>
            )}
          </div>
        )}
      </div>

      {isEditing && showSpendWarning && (
        <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-800">
            Spend has changed — regenerate PDF before resending.
          </p>
        </div>
      )}

      <div className="px-4 py-4">{children}</div>
    </div>
  );
}
