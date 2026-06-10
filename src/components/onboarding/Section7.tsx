"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import {
  Check, ChevronDown, Truck, Clock, ShieldCheck, PackageCheck,
} from "lucide-react";
import type { OnboardingCase, OnboardingSpendItem } from "@/types/database";
import {
  saveUpstreamCollection,
  saveUpstreamConfirmed,
  saveAccountVerification,
  saveDropoffArranged,
} from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type ExternalContact = { id: string; name: string; company: string | null; email: string | null };

interface Props {
  c: OnboardingCase;
  spendItems: OnboardingSpendItem[];
  externalContacts: ExternalContact[];
  onUpdate: (updates: Partial<OnboardingCase>) => void;
}

const ACCT_ITEMS: { key: keyof OnboardingCase; label: string }[] = [
  { key: "acct_email_verified",      label: "Email address created" },
  { key: "acct_license_verified",    label: "License assigned" },
  { key: "acct_distro_verified",     label: "Distribution lists added" },
  { key: "acct_teams_verified",      label: "Teams channels added" },
  { key: "acct_sharepoint_verified", label: "SharePoint sites added" },
];

function ContactPicker({
  contacts,
  value,
  onChange,
  disabled,
}: {
  contacts: ExternalContact[];
  value: ExternalContact | null;
  onChange: (c: ExternalContact | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(
    () =>
      search.trim()
        ? contacts.filter(
            (ec) =>
              ec.name.toLowerCase().includes(search.toLowerCase()) ||
              (ec.company ?? "").toLowerCase().includes(search.toLowerCase())
          )
        : contacts,
    [search, contacts]
  );

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border rounded-lg select-none",
          disabled
            ? "bg-stone-50 border-stone-100 cursor-default"
            : "cursor-pointer border-stone-200 hover:border-stone-300"
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        {value ? (
          <>
            <span className="flex-1 text-[13px] text-stone-700">
              {value.name}
              {value.company && <span className="text-stone-400 ml-1.5">· {value.company}</span>}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); setSearch(""); }}
                className="text-stone-300 hover:text-stone-500 text-[11px] px-1"
              >
                ✕
              </button>
            )}
          </>
        ) : (
          <span className="flex-1 text-[13px] text-stone-400">
            {disabled ? "—" : "Search contacts…"}
          </span>
        )}
        {!disabled && <ChevronDown size={13} className="text-stone-400 flex-shrink-0" />}
      </div>

      {open && (
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
                  onClick={() => { onChange(ec); setOpen(false); setSearch(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-stone-50 transition-colors"
                >
                  <span className="block text-[13px] text-stone-700">{ec.name}</span>
                  {ec.company && <span className="block text-[11px] text-stone-400">{ec.company}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Section7({ c, spendItems, externalContacts, onUpdate }: Props) {
  const hardwareProcured = spendItems.some((i) => i.category !== "license");
  const { error: toastError, success } = useToast();

  // ── 7a — Collection ───────────────────────────────────────────────────────
  const [collectedAt, setCollectedAt] = useState(
    c.upstream_collected_at ? c.upstream_collected_at.slice(0, 10) : ""
  );
  const [collectionContact, setCollectionContact] = useState<ExternalContact | null>(
    externalContacts.find((ec) => ec.id === c.upstream_collection_contact_id) ?? null
  );
  const [pendingCollection, startCollectionTx] = useTransition();

  function handleSaveCollection() {
    if (!collectedAt) { toastError("Enter the collection date."); return; }
    startCollectionTx(async () => {
      const { error } = await saveUpstreamCollection(c.id, {
        collected_at: collectedAt,
        contact_id: collectionContact?.id ?? null,
      });
      if (error) { toastError(error); return; }
      success("Collection date saved");
      onUpdate({
        upstream_collected_at: collectedAt,
        upstream_collection_contact_id: collectionContact?.id ?? null,
      });
    });
  }

  // ── 7b — Confirmation ─────────────────────────────────────────────────────
  const [confirmedAt, setConfirmedAt] = useState(
    c.upstream_confirmed_at ? c.upstream_confirmed_at.slice(0, 10) : ""
  );
  const [confirmContact, setConfirmContact] = useState<ExternalContact | null>(
    externalContacts.find((ec) => ec.id === c.upstream_confirmed_contact_id) ?? null
  );
  const [pendingConfirm, startConfirmTx] = useTransition();

  function handleSaveConfirmed() {
    if (!confirmedAt) { toastError("Enter the confirmation date."); return; }
    startConfirmTx(async () => {
      const { error } = await saveUpstreamConfirmed(c.id, {
        confirmed_at: confirmedAt,
        contact_id: confirmContact?.id ?? null,
      });
      if (error) { toastError(error); return; }
      success("Upstream confirmation saved");
      onUpdate({
        upstream_confirmed_at: confirmedAt,
        upstream_confirmed_contact_id: confirmContact?.id ?? null,
      });
    });
  }

  // ── 7c — Account verification ─────────────────────────────────────────────
  const [accts, setAccts] = useState({
    acct_email_verified:      c.acct_email_verified,
    acct_license_verified:    c.acct_license_verified,
    acct_distro_verified:     c.acct_distro_verified,
    acct_teams_verified:      c.acct_teams_verified,
    acct_sharepoint_verified: c.acct_sharepoint_verified,
  });
  const [pendingAccts, startAcctsTx] = useTransition();
  const acctsDirty =
    accts.acct_email_verified      !== c.acct_email_verified ||
    accts.acct_license_verified    !== c.acct_license_verified ||
    accts.acct_distro_verified     !== c.acct_distro_verified ||
    accts.acct_teams_verified      !== c.acct_teams_verified ||
    accts.acct_sharepoint_verified !== c.acct_sharepoint_verified;
  const allAcctsDone = Object.values(accts).every(Boolean);

  function handleSaveAccts() {
    startAcctsTx(async () => {
      const { error } = await saveAccountVerification(c.id, accts);
      if (error) { toastError(error); return; }
      success(allAcctsDone ? "All accounts verified — Section 8 unlock pending drop-off" : "Account verification saved");
      onUpdate(accts);
    });
  }

  // ── 7d — Drop-off ─────────────────────────────────────────────────────────
  const [pendingDropoff, startDropoffTx] = useTransition();

  function handleDropoff() {
    startDropoffTx(async () => {
      const { error } = await saveDropoffArranged(c.id);
      if (error) { toastError(error); return; }
      success("Drop-off arranged — Section 8 is now unlocked");
      onUpdate({ dropoff_arranged_at: new Date().toISOString() });
    });
  }

  return (
    <div className="space-y-6">
      {/* ── 7a — Collection (only when hardware was procured) ────────────── */}
      {hardwareProcured && <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Truck size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            7a — Device collection
          </span>
          {c.upstream_collected_at && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Recorded
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1 uppercase tracking-wide">
              Collection Date
            </label>
            <input
              type="date"
              value={collectedAt}
              onChange={(e) => setCollectedAt(e.target.value)}
              disabled={!!c.upstream_collected_at}
              className="w-full px-3 py-2 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1 uppercase tracking-wide">
              Contact (optional)
            </label>
            <ContactPicker
              contacts={externalContacts}
              value={collectionContact}
              onChange={setCollectionContact}
              disabled={!!c.upstream_collected_at}
            />
          </div>
        </div>

        {!c.upstream_collected_at ? (
          <button
            type="button"
            onClick={handleSaveCollection}
            disabled={pendingCollection || !collectedAt}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "#C04F28" }}
          >
            <Check size={13} />
            {pendingCollection ? "Saving…" : "Save collection date"}
          </button>
        ) : (
          <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
            <Check size={12} className="text-green-500" />
            Collected {new Date(c.upstream_collected_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            {c.upstream_collection_contact_id &&
              (() => {
                const contact = externalContacts.find((ec) => ec.id === c.upstream_collection_contact_id);
                return contact ? ` · ${contact.name}` : "";
              })()}
          </p>
        )}
      </div>}

      {/* ── 7b — Confirmation (only when hardware was procured) ──────────── */}
      {hardwareProcured && <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Clock size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            7b — Upstream confirmation
          </span>
          {c.upstream_confirmed_at && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Confirmed
            </span>
          )}
        </div>

        {!c.upstream_confirmed_at && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Clock size={12} className="text-amber-500 flex-shrink-0" />
            <span className="text-[12px] text-amber-700">Awaiting Upstream confirmation.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1 uppercase tracking-wide">
              Confirmation Date
            </label>
            <input
              type="date"
              value={confirmedAt}
              onChange={(e) => setConfirmedAt(e.target.value)}
              disabled={!!c.upstream_confirmed_at}
              className="w-full px-3 py-2 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1 uppercase tracking-wide">
              Contact (optional)
            </label>
            <ContactPicker
              contacts={externalContacts}
              value={confirmContact}
              onChange={setConfirmContact}
              disabled={!!c.upstream_confirmed_at}
            />
          </div>
        </div>

        {!c.upstream_confirmed_at ? (
          <button
            type="button"
            onClick={handleSaveConfirmed}
            disabled={pendingConfirm || !confirmedAt}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "#C04F28" }}
          >
            <Check size={13} />
            {pendingConfirm ? "Saving…" : "Upstream confirmed done"}
          </button>
        ) : (
          <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
            <Check size={12} className="text-green-500" />
            Confirmed {new Date(c.upstream_confirmed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            {c.upstream_confirmed_contact_id &&
              (() => {
                const contact = externalContacts.find((ec) => ec.id === c.upstream_confirmed_contact_id);
                return contact ? ` · ${contact.name}` : "";
              })()}
          </p>
        )}
      </div>}

      {/* ── 7c — Account verification ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <ShieldCheck size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            7c — Account verification
          </span>
          {allAcctsDone && !acctsDirty && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> All verified
            </span>
          )}
        </div>

        <div className="space-y-2">
          {ACCT_ITEMS.map(({ key, label }) => (
            <label
              key={key}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors select-none",
                accts[key as keyof typeof accts]
                  ? "border-green-200 bg-green-50/50"
                  : "border-stone-200 hover:border-stone-300"
              )}
            >
              <input
                type="checkbox"
                checked={!!accts[key as keyof typeof accts]}
                onChange={(e) =>
                  setAccts((prev) => ({ ...prev, [key]: e.target.checked }))
                }
                className="accent-[#415445] w-4 h-4"
              />
              <span
                className={cn(
                  "text-[13px] font-medium",
                  accts[key as keyof typeof accts] ? "text-green-700" : "text-stone-700"
                )}
              >
                {label}
              </span>
              {accts[key as keyof typeof accts] && (
                <Check size={12} className="ml-auto text-green-500 flex-shrink-0" />
              )}
            </label>
          ))}
        </div>

        {acctsDirty && (
          <button
            type="button"
            onClick={handleSaveAccts}
            disabled={pendingAccts}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "#415445" }}
          >
            <Check size={13} />
            {pendingAccts ? "Saving…" : "Save verification"}
          </button>
        )}
      </div>

      {/* ── 7d — Drop-off (only when hardware was procured) ─────────────── */}
      {hardwareProcured && <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <PackageCheck size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            7d — Arrange drop-off
          </span>
          {c.dropoff_arranged_at && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Arranged
            </span>
          )}
        </div>

        <p className="text-[13px] text-stone-600">
          Once Upstream confirms and all accounts are verified, arrange drop-off of the new device to the employee.
          Marking this done will unlock Section 8.
        </p>

        {!allAcctsDone && !c.dropoff_arranged_at && (
          <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-stone-300" />
            Verify all accounts above before arranging drop-off.
          </p>
        )}

        {c.dropoff_arranged_at ? (
          <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
            <Check size={12} className="text-green-500" />
            Drop-off arranged {new Date(c.dropoff_arranged_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleDropoff}
            disabled={pendingDropoff || !allAcctsDone || acctsDirty}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: "#C04F28" }}
            title={
              !allAcctsDone
                ? "Verify all accounts first"
                : acctsDirty
                ? "Save account verification first"
                : undefined
            }
          >
            <PackageCheck size={13} />
            {pendingDropoff ? "Saving…" : "Mark drop-off as arranged"}
          </button>
        )}
      </div>}
    </div>
  );
}
