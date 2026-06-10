"use client";

import { useState, useTransition } from "react";
import type { OnboardingCase } from "@/types/database";
import { submitOnboardingSection2 } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import TagInput from "./TagInput";
import { cn } from "@/lib/utils";

interface Props {
  c: OnboardingCase;
  onComplete: (updates: Partial<OnboardingCase>) => void;
  onCancel?: () => void;
}

const SITES = ["Baker Street", "Rainbow Park"];
const TIERS = [
  { value: "standard", label: "Standard", desc: "Core productivity" },
  { value: "mid",      label: "Mid",      desc: "Enhanced specs"    },
  { value: "high",     label: "High",     desc: "Power user / dev"  },
];

function fieldClass(extra = "") {
  return `w-full px-3 py-2 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 ${extra}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-stone-500 mb-1 uppercase tracking-wide">
      {children}
    </label>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
        on ? "bg-[#415445]" : "bg-stone-200"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
        on ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

export default function Section2({ c, onComplete, onCancel }: Props) {
  const { error: toastError } = useToast();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    first_name:            c.first_name ?? "",
    last_name:             c.last_name ?? "",
    job_title:             c.job_title ?? "",
    department:            c.department ?? "",
    manager_name:          c.manager_name ?? "",
    manager_email:         c.manager_email ?? "",
    phone:                 c.phone ?? "",
    location:              c.location ?? "",
    start_date:            c.start_date ?? "",
    laptop_tier:           c.laptop_tier ?? "",
    monitor_required:      c.monitor_required ?? false,
    monitor_qty:           c.monitor_qty ?? 1,
    colour_print_access:   c.colour_print_access ?? false,
    sharepoint_sites:      (c.sharepoint_sites as string[] | null) ?? [],
    teams_channels:        (c.teams_channels as string[] | null) ?? [],
    distribution_lists:    (c.distribution_lists as string[] | null) ?? [],
    role_specific_software:(c.role_specific_software as string[] | null) ?? [],
    email_address:         c.email_address ?? "",
    emailEdited:           !!c.email_address,
  });

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleNameChange(field: "first_name" | "last_name", val: string) {
    setForm((f) => {
      const fn = field === "first_name" ? val : f.first_name;
      const ln = field === "last_name"  ? val : f.last_name;
      const suggested = fn && ln
        ? `${fn[0].toLowerCase()}.${ln.toLowerCase().replace(/\s+/g, "")}@isibag.co.za`
        : f.email_address;
      return {
        ...f,
        [field]: val,
        email_address: f.emailEdited ? f.email_address : suggested,
      };
    });
  }

  function handleSubmit() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toastError("First and last name are required.");
      return;
    }
    if (!form.email_address.trim()) {
      toastError("Email address is required.");
      return;
    }
    startTransition(async () => {
      const { error, printer_code } = await submitOnboardingSection2(c.id, c.printer_code, {
        first_name:            form.first_name,
        last_name:             form.last_name,
        job_title:             form.job_title,
        department:            form.department,
        manager_name:          form.manager_name,
        manager_email:         form.manager_email,
        phone:                 form.phone,
        location:              form.location || null,
        start_date:            form.start_date,
        laptop_tier:           form.laptop_tier || null,
        monitor_required:      form.monitor_required,
        monitor_qty:           form.monitor_qty,
        colour_print_access:   form.colour_print_access,
        sharepoint_sites:      form.sharepoint_sites,
        teams_channels:        form.teams_channels,
        distribution_lists:    form.distribution_lists,
        role_specific_software:form.role_specific_software,
        email_address:         form.email_address,
      });
      if (error) { toastError(error); return; }
      onComplete({
        first_name:            form.first_name.trim(),
        last_name:             form.last_name.trim(),
        job_title:             form.job_title.trim() || null,
        department:            form.department.trim() || null,
        manager_name:          form.manager_name.trim() || null,
        manager_email:         form.manager_email.trim() || null,
        phone:                 form.phone.trim() || null,
        location:              form.location || null,
        start_date:            form.start_date || null,
        email_address:         form.email_address.trim(),
        laptop_tier:           form.laptop_tier || null,
        monitor_required:      form.monitor_required,
        monitor_qty:           form.monitor_qty,
        colour_print_access:   form.colour_print_access,
        sharepoint_sites:      form.sharepoint_sites.length > 0 ? form.sharepoint_sites : null,
        teams_channels:        form.teams_channels.length > 0 ? form.teams_channels : null,
        distribution_lists:    form.distribution_lists.length > 0 ? form.distribution_lists : null,
        role_specific_software:form.role_specific_software.length > 0 ? form.role_specific_software : null,
        printer_code:          printer_code ?? c.printer_code,
      });
    });
  }

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>First Name *</Label>
          <input value={form.first_name} onChange={(e) => handleNameChange("first_name", e.target.value)}
            placeholder="Jane" className={fieldClass()} />
        </div>
        <div>
          <Label>Last Name *</Label>
          <input value={form.last_name} onChange={(e) => handleNameChange("last_name", e.target.value)}
            placeholder="Mokoena" className={fieldClass()} />
        </div>
      </div>

      {/* Job title + Department */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Job Title</Label>
          <input value={form.job_title} onChange={(e) => set("job_title", e.target.value)}
            placeholder="Software Engineer" className={fieldClass()} />
        </div>
        <div>
          <Label>Department</Label>
          <input value={form.department} onChange={(e) => set("department", e.target.value)}
            placeholder="Engineering" className={fieldClass()} />
        </div>
      </div>

      {/* Manager */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Manager Name</Label>
          <input value={form.manager_name} onChange={(e) => set("manager_name", e.target.value)}
            placeholder="John Smith" className={fieldClass()} />
        </div>
        <div>
          <Label>Manager Email</Label>
          <input type="email" value={form.manager_email} onChange={(e) => set("manager_email", e.target.value)}
            placeholder="j.smith@isibag.co.za" className={fieldClass()} />
        </div>
      </div>

      {/* Phone + Site */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Phone</Label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
            placeholder="+27 82 000 0000" className={fieldClass()} />
        </div>
        <div>
          <Label>Site</Label>
          <select value={form.location} onChange={(e) => set("location", e.target.value)}
            className={fieldClass("bg-white")}>
            <option value="">Select site…</option>
            {SITES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Start date */}
      <div>
        <Label>Start Date</Label>
        <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)}
          className={fieldClass()} />
      </div>

      {/* Email address */}
      <div>
        <Label>Email Address *</Label>
        <input
          type="email"
          value={form.email_address}
          onChange={(e) => setForm((f) => ({ ...f, email_address: e.target.value, emailEdited: true }))}
          placeholder="j.mokoena@isibag.co.za"
          className={fieldClass("font-mono")}
        />
        {!form.emailEdited && form.email_address && (
          <p className="text-[11px] text-stone-400 mt-1">Auto-suggested from name — edit to override</p>
        )}
      </div>

      {/* Laptop tier */}
      <div>
        <Label>Laptop Tier</Label>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("laptop_tier", form.laptop_tier === value ? "" : value)}
              className={cn(
                "border rounded-xl p-3 text-left transition-colors",
                form.laptop_tier === value
                  ? "border-[#415445] bg-[#415445]/5"
                  : "border-stone-200 hover:border-stone-300"
              )}
            >
              <span className={cn(
                "block text-[13px] font-medium",
                form.laptop_tier === value ? "text-[#415445]" : "text-stone-700"
              )}>{label}</span>
              <span className="block text-[11px] text-stone-400 mt-0.5">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Monitor */}
      <div>
        <Label>Monitor</Label>
        <div className="flex items-center gap-3">
          <Toggle on={form.monitor_required} onClick={() => set("monitor_required", !form.monitor_required)} />
          <span className="text-[13px] text-stone-600">
            {form.monitor_required ? "Required" : "Not required"}
          </span>
          {form.monitor_required && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[12px] text-stone-500">Qty:</span>
              <input
                type="number"
                min={1}
                max={4}
                value={form.monitor_qty}
                onChange={(e) => set("monitor_qty", Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 text-center"
              />
            </div>
          )}
        </div>
      </div>

      {/* Colour print */}
      <div>
        <Label>Colour Print Access</Label>
        <div className="flex items-center gap-3">
          <Toggle on={form.colour_print_access} onClick={() => set("colour_print_access", !form.colour_print_access)} />
          <span className="text-[13px] text-stone-600">
            {form.colour_print_access ? "Enabled" : "Mono only"}
          </span>
        </div>
      </div>

      {/* Tag inputs */}
      <div className="space-y-4">
        <div>
          <Label>SharePoint Sites</Label>
          <TagInput tags={form.sharepoint_sites} onChange={(t) => set("sharepoint_sites", t)} placeholder="Add site name and press Enter…" />
        </div>
        <div>
          <Label>Teams Channels</Label>
          <TagInput tags={form.teams_channels} onChange={(t) => set("teams_channels", t)} placeholder="Add channel and press Enter…" />
        </div>
        <div>
          <Label>Distribution Lists</Label>
          <TagInput tags={form.distribution_lists} onChange={(t) => set("distribution_lists", t)} placeholder="Add list name and press Enter…" />
        </div>
        <div>
          <Label>Role-Specific Software</Label>
          <TagInput tags={form.role_specific_software} onChange={(t) => set("role_specific_software", t)} placeholder="Add software and press Enter…" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-[13px] rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-lg text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: "#C04F28" }}
        >
          {pending ? "Saving…" : c.email_address ? "Save Changes" : "Submit Details"}
        </button>
      </div>
    </div>
  );
}
