"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import {
  Check, Copy, CheckCheck, ChevronDown, Lock,
  Mail, CircleDollarSign,
} from "lucide-react";
import type { OnboardingCase } from "@/types/database";
import { markUpstreamLicenseSent, saveLicenseDecision } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type ExternalContact = { id: string; name: string; company: string | null; email: string | null };

interface Props {
  c: OnboardingCase;
  externalContacts: ExternalContact[];
  onUpdate: (updates: Partial<OnboardingCase>) => void;
}

type Decision = "available" | "purchase" | "repurpose" | "";

function buildEmailTemplate(c: OnboardingCase, contactName: string): string {
  const lines: string[] = [
    `Hi ${contactName},`,
    "",
    "We have a new employee starting at Isikhwama and require a Microsoft 365 license to be arranged. Please advise whether a license is available from existing stock or whether one needs to be purchased.",
    "",
    "Employee details:",
    `  Full name:     ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "[Name]"}`,
    `  Email address: ${c.email_address || "[TBC]"}`,
    `  Manager:       ${[c.manager_name, c.manager_email ? `(${c.manager_email})` : null].filter(Boolean).join(" ") || "—"}`,
    `  Site:          ${c.location || "—"}`,
    `  Phone:         ${c.phone || "—"}`,
  ];

  const sp = (c.sharepoint_sites as string[] | null) ?? [];
  const tc = (c.teams_channels as string[] | null) ?? [];
  const dl = (c.distribution_lists as string[] | null) ?? [];

  if (sp.length) lines.push(`  SharePoint:    ${sp.join(", ")}`);
  if (tc.length) lines.push(`  Teams:         ${tc.join(", ")}`);
  if (dl.length) lines.push(`  Distros:       ${dl.join(", ")}`);

  lines.push("", "Please confirm availability and advise on next steps.", "", "Kind regards,", "IT Department");
  return lines.join("\n");
}

const ACCT_ITEMS = [
  "Email address created",
  "License assigned",
  "Distribution lists added",
  "Teams channels added",
  "SharePoint sites added",
];

export default function Section3({ c, externalContacts, onUpdate }: Props) {
  const { error: toastError, success } = useToast();
  const [pendingSent, startSentTx] = useTransition();
  const [pendingDecision, startDecisionTx] = useTransition();

  // ── 3a state ──────────────────────────────────────────────────────────────
  const initialContact = externalContacts.find((ec) => ec.id === c.upstream_license_contact_id) ?? null;
  const [selectedContact, setSelectedContact] = useState<ExternalContact | null>(initialContact);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      search.trim()
        ? externalContacts.filter(
            (ec) =>
              ec.name.toLowerCase().includes(search.toLowerCase()) ||
              (ec.company ?? "").toLowerCase().includes(search.toLowerCase())
          )
        : externalContacts,
    [search, externalContacts]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const emailTemplate = buildEmailTemplate(c, selectedContact?.name ?? "[Contact Name]");

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(emailTemplate);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2000);
    } catch {
      // Clipboard API unavailable in some contexts
    }
  }

  function handleMarkSent() {
    startSentTx(async () => {
      const { error } = await markUpstreamLicenseSent(c.id, selectedContact?.id ?? null);
      if (error) { toastError(error); return; }
      success("Upstream email marked as sent");
      onUpdate({ upstream_license_sent_at: new Date().toISOString(), upstream_license_contact_id: selectedContact?.id ?? null });
    });
  }

  // ── 3b state ──────────────────────────────────────────────────────────────
  const [decision, setDecision] = useState<Decision>(
    (c.license_decision as Decision) ?? ""
  );
  const [cost, setCost] = useState(
    c.license_cost != null ? String(c.license_cost) : ""
  );

  function handleSaveDecision() {
    if (!decision) { toastError("Please select a license decision."); return; }
    const costNum = decision === "purchase" && cost ? parseFloat(cost) : null;
    if (decision === "purchase" && cost && isNaN(costNum!)) {
      toastError("Enter a valid cost.");
      return;
    }
    startDecisionTx(async () => {
      const { error } = await saveLicenseDecision(c.id, decision, costNum);
      if (error) { toastError(error); return; }
      success("License decision saved — Section 4 is now unlocked");
      onUpdate({ license_decision: decision, license_cost: costNum });
    });
  }

  return (
    <div className="space-y-6">
      {/* ── 3a — Upstream email ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Mail size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            3a — Send license check email
          </span>
          {c.upstream_license_sent_at && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Sent
            </span>
          )}
        </div>

        {/* Contact picker */}
        <div>
          <label className="block text-[11px] font-medium text-stone-500 mb-1 uppercase tracking-wide">
            Upstream Contact
          </label>
          <div ref={dropdownRef} className="relative">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer select-none",
                dropdownOpen ? "border-stone-400" : "border-stone-200 hover:border-stone-300"
              )}
              onClick={() => setDropdownOpen((o) => !o)}
            >
              {selectedContact ? (
                <>
                  <span className="flex-1 text-[13px] text-stone-700">
                    {selectedContact.name}
                    {selectedContact.company && (
                      <span className="text-stone-400 ml-1.5">· {selectedContact.company}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedContact(null); setSearch(""); }}
                    className="text-stone-300 hover:text-stone-500 text-[11px] px-1"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="flex-1 text-[13px] text-stone-400">Search contacts…</span>
              )}
              <ChevronDown size={13} className="text-stone-400 flex-shrink-0" />
            </div>

            {dropdownOpen && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-md overflow-hidden">
                <div className="px-3 py-2 border-b border-stone-100">
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by name or company…"
                    className="w-full text-[13px] text-stone-700 placeholder-stone-300 focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-3 text-[12px] text-stone-400">No contacts found</p>
                  ) : (
                    filtered.map((ec) => (
                      <button
                        key={ec.id}
                        type="button"
                        onClick={() => { setSelectedContact(ec); setDropdownOpen(false); setSearch(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-stone-50 transition-colors"
                      >
                        <span className="block text-[13px] text-stone-700">{ec.name}</span>
                        {ec.company && (
                          <span className="block text-[11px] text-stone-400">{ec.company}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Email template */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Email Template</span>
            <button
              type="button"
              onClick={copyTemplate}
              className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
            >
              {copiedTemplate ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
              {copiedTemplate ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-stone-50 border border-stone-100 rounded-lg px-4 py-3.5 text-[12px] text-stone-600 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
            {emailTemplate}
          </pre>
        </div>

        {c.upstream_license_sent_at ? (
          <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
            <Check size={12} className="text-green-500" />
            Sent {new Date(c.upstream_license_sent_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            {initialContact && ` · ${initialContact.name}`}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleMarkSent}
            disabled={pendingSent || !selectedContact}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "#C04F28" }}
            title={!selectedContact ? "Select a contact first" : undefined}
          >
            <Check size={13} />
            {pendingSent ? "Saving…" : "Mark as sent"}
          </button>
        )}
      </div>

      {/* ── 3b — Record decision ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <CircleDollarSign size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            3b — Record license decision
          </span>
          {c.license_decision && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Saved
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {(["available", "purchase", "repurpose"] as const).map((opt) => (
            <label
              key={opt}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                decision === opt
                  ? "border-[#415445] bg-[#415445]/5"
                  : "border-stone-200 hover:border-stone-300"
              )}
            >
              <input
                type="radio"
                name="license_decision"
                value={opt}
                checked={decision === opt}
                onChange={() => setDecision(opt)}
                className="accent-[#415445]"
              />
              <span className={cn(
                "text-[13px] font-medium",
                decision === opt ? "text-[#415445]" : "text-stone-700"
              )}>
                {opt === "available" && "Available — existing license"}
                {opt === "purchase" && "Needs purchase"}
                {opt === "repurpose" && "Repurpose existing device"}
              </span>
            </label>
          ))}
        </div>

        {decision === "purchase" && (
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1 uppercase tracking-wide">
              Estimated Cost (R)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="w-40 px-3 py-2 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveDecision}
          disabled={pendingDecision || !decision}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: "#C04F28" }}
        >
          <Check size={13} />
          {pendingDecision ? "Saving…" : c.license_decision ? "Update decision" : "Save decision"}
        </button>

        {c.license_decision && (
          <p className="text-[12px] text-stone-400">
            Decision saved — Section 4 is unlocked.
          </p>
        )}
      </div>

      {/* ── 3c — Account verification checklist (preview only) ───────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Lock size={12} className="text-stone-300" />
          <span className="text-[12px] font-semibold text-stone-400 uppercase tracking-wide">
            3c — Account verification
          </span>
        </div>

        <div className="space-y-1.5 opacity-50">
          {ACCT_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-2.5 px-1">
              <span className="w-4 h-4 rounded border border-stone-300 flex-shrink-0" />
              <span className="text-[13px] text-stone-500">{item}</span>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-stone-400 flex items-start gap-1.5">
          <Lock size={11} className="text-stone-300 flex-shrink-0 mt-0.5" />
          You&apos;ll verify these in Section 7 after Upstream returns the device.
        </p>
      </div>
    </div>
  );
}
