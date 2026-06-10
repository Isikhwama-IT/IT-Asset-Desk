"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { Check, CheckCheck, Copy, ChevronDown, Mail, Package } from "lucide-react";
import type { OnboardingCase, OnboardingSpendItem } from "@/types/database";
import { markUpstreamGoAheadSent, saveSpendItemOrder } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type ExternalContact = { id: string; name: string; company: string | null; email: string | null };

interface Props {
  c: OnboardingCase;
  spendItems: OnboardingSpendItem[];
  externalContacts: ExternalContact[];
  onCaseUpdate: (updates: Partial<OnboardingCase>) => void;
  onSpendChange: (items: OnboardingSpendItem[]) => void;
}

function buildGoAheadTemplate(c: OnboardingCase, contactName: string): string {
  const employee = [c.first_name, c.last_name].filter(Boolean).join(" ") || "[Employee]";
  const lines: string[] = [
    `Hi ${contactName},`,
    "",
    `Management has approved the procurement for our new employee, ${employee}. Please go ahead with the following:`,
    "",
  ];

  if (c.license_decision === "purchase") {
    lines.push(
      `  Microsoft 365 License — please proceed with purchase${c.license_cost ? ` (budgeted at R${Number(c.license_cost).toFixed(0)})` : ""}.`
    );
  } else if (c.license_decision === "available") {
    lines.push("  Microsoft 365 License — available from existing stock, please assign.");
  } else if (c.license_decision === "repurpose") {
    lines.push("  Microsoft 365 License — repurpose from existing device.");
  }

  lines.push(
    "",
    "Please confirm receipt of this instruction and advise on expected delivery timelines.",
    "",
    "Kind regards,",
    "IT Department"
  );
  return lines.join("\n");
}

type RowEdit = { supplier: string; order_date: string; ordered: boolean; saving: boolean; dirty: boolean };

export default function Section5({ c, spendItems, externalContacts, onCaseUpdate, onSpendChange }: Props) {
  const { error: toastError, success } = useToast();

  // ── 5a state ──────────────────────────────────────────────────────────────
  const initialContact = externalContacts.find((ec) => ec.id === c.upstream_goahead_contact_id) ?? null;
  const [selectedContact, setSelectedContact] = useState<ExternalContact | null>(initialContact);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingSent, startSentTx] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const emailTemplate = buildGoAheadTemplate(c, selectedContact?.name ?? "[Contact Name]");

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(emailTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }

  function handleMarkGoAheadSent() {
    startSentTx(async () => {
      const { error } = await markUpstreamGoAheadSent(c.id, selectedContact?.id ?? null);
      if (error) { toastError(error); return; }
      success("Go-ahead email marked as sent");
      onCaseUpdate({
        upstream_goahead_sent_at: new Date().toISOString(),
        upstream_goahead_contact_id: selectedContact?.id ?? null,
      });
    });
  }

  // ── 5b state ──────────────────────────────────────────────────────────────
  const hardwareItems = useMemo(
    () => spendItems.filter((i) => i.category !== "license"),
    [spendItems]
  );

  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>(() =>
    Object.fromEntries(
      hardwareItems.map((i) => [
        i.id,
        {
          supplier: i.supplier ?? "",
          order_date: i.order_date ?? "",
          ordered: i.ordered,
          saving: false,
          dirty: false,
        },
      ])
    )
  );

  // Sync new items added (e.g., parent refreshes after spend change)
  useEffect(() => {
    setRowEdits((prev) => {
      const next = { ...prev };
      hardwareItems.forEach((i) => {
        if (!next[i.id]) {
          next[i.id] = {
            supplier: i.supplier ?? "",
            order_date: i.order_date ?? "",
            ordered: i.ordered,
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
    const { error } = await saveSpendItemOrder(item.id, c.id, {
      supplier: edit.supplier || null,
      order_date: edit.order_date || null,
      ordered: edit.ordered,
    });
    setRowEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], saving: false, dirty: false } }));

    if (error) { toastError(error); return; }

    onSpendChange(
      spendItems.map((i) =>
        i.id === item.id
          ? { ...i, supplier: edit.supplier || null, order_date: edit.order_date || null, ordered: edit.ordered }
          : i
      )
    );
  }

  const allOrdered = hardwareItems.length > 0 && hardwareItems.every((i) => rowEdits[i.id]?.ordered ?? i.ordered);

  return (
    <div className="space-y-6">
      {/* ── 5a — Go-ahead email ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Mail size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            5a — Send go-ahead to Upstream
          </span>
          {c.upstream_goahead_sent_at && (
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
              {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-stone-50 border border-stone-100 rounded-lg px-4 py-3.5 text-[12px] text-stone-600 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
            {emailTemplate}
          </pre>
        </div>

        {c.upstream_goahead_sent_at ? (
          <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
            <Check size={12} className="text-green-500" />
            Sent {new Date(c.upstream_goahead_sent_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            {initialContact && ` · ${initialContact.name}`}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleMarkGoAheadSent}
            disabled={pendingSent || !selectedContact}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "#C04F28" }}
            title={!selectedContact ? "Select a contact first" : undefined}
          >
            <Check size={13} />
            {pendingSent ? "Saving…" : "Mark go-ahead as sent"}
          </button>
        )}
      </div>

      {/* ── 5b — Hardware orders ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Package size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            5b — Track hardware orders
          </span>
          {allOrdered && hardwareItems.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> All ordered
            </span>
          )}
        </div>

        {hardwareItems.length === 0 ? (
          <p className="text-[12px] text-stone-400 italic">No hardware items — add items in Section 4.</p>
        ) : (
          <div className="space-y-2">
            {hardwareItems.map((item) => {
              const edit = rowEdits[item.id] ?? {
                supplier: item.supplier ?? "",
                order_date: item.order_date ?? "",
                ordered: item.ordered,
                saving: false,
                dirty: false,
              };
              return (
                <div
                  key={item.id}
                  className={cn(
                    "border rounded-lg px-4 py-3 space-y-2.5",
                    edit.ordered ? "border-green-200 bg-green-50/40" : "border-stone-200 bg-white"
                  )}
                >
                  {/* Item header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-stone-700 capitalize">
                      {item.description}
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[12px] text-stone-500">Ordered</span>
                      <input
                        type="checkbox"
                        checked={edit.ordered}
                        onChange={(e) => setRowField(item.id, "ordered", e.target.checked)}
                        className="accent-[#415445] w-4 h-4"
                      />
                    </label>
                  </div>

                  {/* Supplier + date */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1 uppercase tracking-wide">Supplier</label>
                      <input
                        type="text"
                        value={edit.supplier}
                        onChange={(e) => setRowField(item.id, "supplier", e.target.value)}
                        placeholder="e.g. Eskom Supplies"
                        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:border-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-400 mb-1 uppercase tracking-wide">Order Date</label>
                      <input
                        type="date"
                        value={edit.order_date}
                        onChange={(e) => setRowField(item.id, "order_date", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:border-stone-400"
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  {edit.dirty && (
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

                  {/* Saved state */}
                  {!edit.dirty && edit.ordered && (
                    <p className="text-[11px] text-green-700 flex items-center gap-1">
                      <Check size={10} />
                      Ordered
                      {item.order_date && ` · ${new Date(item.order_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}
                      {item.supplier && ` · ${item.supplier}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {allOrdered && hardwareItems.length > 0 && (
          <p className="text-[12px] text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">
            All hardware ordered — Section 6 will unlock once items arrive.
          </p>
        )}
      </div>
    </div>
  );
}
