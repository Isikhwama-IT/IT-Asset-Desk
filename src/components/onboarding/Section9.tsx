"use client";

import { useState, useTransition } from "react";
import { Check, Users } from "lucide-react";
import type { OnboardingCase } from "@/types/database";
import { saveArrivalChecklist } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

interface Props {
  c: OnboardingCase;
  onUpdate: (updates: Partial<OnboardingCase>) => void;
}

type ArrField =
  | "arr_policies" | "arr_assets_shown" | "arr_liability_signed"
  | "arr_wifi_phone" | "arr_authenticator" | "arr_bitlocker" | "arr_pin"
  | "arr_outlook" | "arr_teams" | "arr_onedrive"
  | "arr_ticket_process" | "arr_printer_tutorial";

const ITEMS: { field: ArrField; label: string }[] = [
  { field: "arr_policies",          label: "Walk through IT policies" },
  { field: "arr_assets_shown",      label: "Show employee their assigned assets" },
  { field: "arr_liability_signed",  label: "Employee signs asset liability form" },
  { field: "arr_wifi_phone",        label: "Set up WiFi on employee's phone" },
  { field: "arr_authenticator",     label: "Set up Microsoft Authenticator" },
  { field: "arr_bitlocker",         label: "Walk through BitLocker" },
  { field: "arr_pin",               label: "Set up login PIN" },
  { field: "arr_outlook",           label: "Walk through Outlook" },
  { field: "arr_teams",             label: "Walk through Teams" },
  { field: "arr_onedrive",          label: "Walk through OneDrive" },
  { field: "arr_ticket_process",    label: "Explain how to log a ticket (Adrian and Upstream)" },
  { field: "arr_printer_tutorial",  label: "Printer tutorial" },
];

export default function Section9({ c, onUpdate }: Props) {
  const { error: toastError } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const [, startTx] = useTransition();

  function toggle(field: ArrField, value: boolean) {
    setSaving(field);
    startTx(async () => {
      const { error } = await saveArrivalChecklist(c.id, field, value);
      setSaving(null);
      if (error) { toastError(error); return; }
      onUpdate({ [field]: value });
    });
  }

  const doneCount = ITEMS.filter(({ field }) => !!c[field]).length;
  const allDone = doneCount === ITEMS.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
        <Users size={13} className="text-stone-400" />
        <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
          Arrival session checklist
        </span>
        <span className="ml-auto text-[11px] text-stone-400 font-medium">
          {doneCount}/{ITEMS.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {ITEMS.map(({ field, label }) => {
          const checked = !!c[field];
          const pending = saving === field;
          return (
            <label
              key={field}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border select-none transition-colors",
                pending ? "opacity-60 cursor-default" : "cursor-pointer",
                checked
                  ? "border-green-200 bg-green-50/50"
                  : "border-stone-200 hover:border-stone-300"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggle(field, e.target.checked)}
                disabled={pending || saving !== null}
                className="accent-[#415445] w-4 h-4 flex-shrink-0"
              />
              <span className={cn("text-[13px] font-medium flex-1", checked ? "text-green-700" : "text-stone-700")}>
                {label}
              </span>
              {checked && <Check size={12} className="text-green-500 flex-shrink-0" />}
            </label>
          );
        })}
      </div>

      {allDone && (
        <p className="text-[12px] text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">
          All items complete — Section 10 is now unlocked.
        </p>
      )}
    </div>
  );
}
