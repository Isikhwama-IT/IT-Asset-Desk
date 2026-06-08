"use client";

import { useState, useTransition } from "react";
import { Activity, FileText, ChevronDown, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { SNMP_POLL_ENABLED } from "@/lib/features";
import {
  Modal, FormField, Input, Select, Textarea, ModalFooter,
  BtnPrimary, BtnSecondary, ErrorBanner, FormStack, FormGrid,
} from "@/components/modal-ui";
import { createPrinterPaperOrder, upsertLocationPaperStock } from "@/lib/actions";
import { REAMS_PER_BOX_A4, SHEETS_PER_BOX_A4, SHEETS_PER_REAM_A3, SHEETS_PER_REAM_A4 } from "@/lib/printer-capabilities";
import type { Contact, Location, LocationPaperStock } from "@/types/database";

// ── Paper order modal (company-level) ─────────────────────────────────────────

const ORDER_STATUSES = ["Requested", "Ordered", "Backordered", "Received", "Cancelled"] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function OrderPaperModal({
  contacts,
  onClose,
}: {
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    paper_size: "A4",
    qty: "",   // boxes for A4, reams for A3
    status: "Requested" as string,
    supplier: "",
    order_number: "",
    requested_by_contact_id: "",
    requested_at: today(),
    expected_at: "",
    notes: "",
  });

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(""); };

  const isA4 = form.paper_size === "A4";
  const qty = parseInt(form.qty) || 0;
  const totalReams = isA4 ? qty * REAMS_PER_BOX_A4 : qty;
  const totalSheets = isA4 ? qty * SHEETS_PER_BOX_A4 : qty * SHEETS_PER_REAM_A3;

  function save() {
    if (qty <= 0) return setError(isA4 ? "Boxes must be greater than 0." : "Reams must be greater than 0.");
    startTransition(async () => {
      setError("");
      const res = await createPrinterPaperOrder({
        printer_id: undefined,
        paper_size: form.paper_size,
        reams: totalReams,
        status: form.status,
        supplier: form.supplier || null,
        order_number: form.order_number || null,
        requested_by_contact_id: form.requested_by_contact_id || null,
        requested_at: form.requested_at || today(),
        expected_at: form.expected_at || null,
        notes: form.notes || null,
      });
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  const inp = "text-[12.5px] border border-stone-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <Modal title="Order Paper" subtitle="Company order" onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormGrid>
          <FormField label="Paper Size">
            <select className={`${inp} appearance-none`} value={form.paper_size} onChange={(e) => set("paper_size", e.target.value)}>
              <option>A4</option>
              <option>A3</option>
            </select>
          </FormField>
          <FormField label={isA4 ? "Boxes" : "Reams"} required>
            <Input
              type="number" min={1}
              value={form.qty}
              onChange={(e) => set("qty", e.target.value)}
              placeholder={isA4 ? "e.g. 10" : "e.g. 20"}
            />
          </FormField>
        </FormGrid>

        {qty > 0 && (
          <p className="text-[11px] text-stone-400 -mt-2">
            {isA4
              ? `${qty} box${qty !== 1 ? "es" : ""} = ${totalReams} reams = ${totalSheets.toLocaleString()} sheets`
              : `${qty} reams = ${totalSheets.toLocaleString()} sheets`}
          </p>
        )}

        <FormGrid>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="Ordered By">
            <Select value={form.requested_by_contact_id} onChange={(e) => set("requested_by_contact_id", e.target.value)}>
              <option value="">— Select —</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Supplier">
            <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="e.g. Officeworks" />
          </FormField>
          <FormField label="Order Number">
            <Input value={form.order_number} onChange={(e) => set("order_number", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Order Date">
            <Input type="date" value={form.requested_at} onChange={(e) => set("requested_at", e.target.value)} />
          </FormField>
          <FormField label="Expected Date">
            <Input type="date" value={form.expected_at} onChange={(e) => set("expected_at", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Place Order"}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ── Update paper stock modal ──────────────────────────────────────────────────

function UpdatePaperStockModal({
  locations,
  paperStockRows,
  onClose,
}: {
  locations: Location[];
  paperStockRows: LocationPaperStock[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");

  const existing = paperStockRows.filter((s) => s.location_id === locationId);
  const existingA4 = existing.find((s) => s.paper_size === "A4");
  const existingA3 = existing.find((s) => s.paper_size === "A3");

  const [a4Boxes, setA4Boxes] = useState(() => String(existingA4?.boxes_on_hand ?? 0));
  const [a4Reams, setA4Reams] = useState(() => String(existingA4?.reams_on_hand ?? 0));
  const [a3Reams, setA3Reams] = useState(() => String(existingA3?.reams_on_hand ?? 0));

  function handleLocationChange(id: string) {
    setLocationId(id);
    const rows = paperStockRows.filter((s) => s.location_id === id);
    const a4 = rows.find((s) => s.paper_size === "A4");
    const a3 = rows.find((s) => s.paper_size === "A3");
    setA4Boxes(String(a4?.boxes_on_hand ?? 0));
    setA4Reams(String(a4?.reams_on_hand ?? 0));
    setA3Reams(String(a3?.reams_on_hand ?? 0));
    setError("");
  }

  const a4BoxesNum = Math.max(0, parseInt(a4Boxes) || 0);
  const a4ReamsNum = Math.max(0, parseInt(a4Reams) || 0);
  const a3ReamsNum = Math.max(0, parseInt(a3Reams) || 0);
  const totalA4Reams  = a4BoxesNum * REAMS_PER_BOX_A4 + a4ReamsNum;
  const totalA4Sheets = a4BoxesNum * SHEETS_PER_BOX_A4 + a4ReamsNum * SHEETS_PER_REAM_A4;
  const totalA3Sheets = a3ReamsNum * SHEETS_PER_REAM_A3;

  function save() {
    if (!locationId) return setError("Please select a location.");
    startTransition(async () => {
      setError("");
      const stocks: { paper_size: "A4" | "A3"; boxes_on_hand: number; reams_on_hand: number }[] = [];
      stocks.push({ paper_size: "A4", boxes_on_hand: a4BoxesNum, reams_on_hand: a4ReamsNum });
      if (a3ReamsNum > 0 || existingA3) {
        stocks.push({ paper_size: "A3", boxes_on_hand: 0, reams_on_hand: a3ReamsNum });
      }
      const res = await upsertLocationPaperStock(locationId, stocks);
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title="Update Paper Stock" subtitle="Actual stock on hand at this site" onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Site / Location" required>
          <Select value={locationId} onChange={(e) => handleLocationChange(e.target.value)}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </FormField>

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 mb-3">A4 Paper</p>
          <FormGrid>
            <FormField label="Boxes (500 sheets/ream, 5 reams/box)">
              <Input
                type="number" min={0}
                value={a4Boxes}
                onChange={(e) => { setA4Boxes(e.target.value); setError(""); }}
              />
            </FormField>
            <FormField label="Loose Reams">
              <Input
                type="number" min={0}
                value={a4Reams}
                onChange={(e) => { setA4Reams(e.target.value); setError(""); }}
              />
            </FormField>
          </FormGrid>
          {(a4BoxesNum > 0 || a4ReamsNum > 0) && (
            <p className="text-[11px] text-stone-400 -mt-2">
              {totalA4Reams} reams · {totalA4Sheets.toLocaleString()} sheets
            </p>
          )}
        </div>

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 mb-3">A3 Paper</p>
          <FormField label="Reams">
            <Input
              type="number" min={0}
              value={a3Reams}
              onChange={(e) => { setA3Reams(e.target.value); setError(""); }}
            />
          </FormField>
          {a3ReamsNum > 0 && (
            <p className="text-[11px] text-stone-400 -mt-2">
              {totalA3Sheets.toLocaleString()} sheets
            </p>
          )}
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

// ── Shared poll types ─────────────────────────────────────────────────────────

type ColourLevels = { black: number | null; cyan: number | null; magenta: number | null; yellow: number | null };

type PreviewResult = {
  printer_id: string;
  name: string;
  ip_address: string;
  polled_at: string;
  is_online: boolean;
  printer_status?: string | null;
  error_description?: string | null;
  total_pages?: number | null;
  toner?: ColourLevels | null;
  fuser_pct?: number | null;
  waste_box_pct?: number | null;
  drum_pct?: number | null;
  consumables?: Array<{ description?: string | null; colour?: string | null; kind?: string | null; percent?: number | null; percent_label?: string | null }>;
  raw_data?: unknown;
  error: string | null;
};

// ── Poll preview modal ────────────────────────────────────────────────────────

function tonerSummary(toner: ColourLevels | null | undefined): string {
  if (!toner) return "—";
  const parts: string[] = [];
  if (toner.black !== null) parts.push(`K ${toner.black}%`);
  if (toner.cyan !== null) parts.push(`C ${toner.cyan}%`);
  if (toner.magenta !== null) parts.push(`M ${toner.magenta}%`);
  if (toner.yellow !== null) parts.push(`Y ${toner.yellow}%`);
  return parts.join(" · ") || "—";
}

function PollPreviewModal({
  results,
  disabled,
  onSave,
  onDiscard,
  saving,
}: {
  results: PreviewResult[];
  disabled: Array<{ printerId: string; name: string }>;
  onSave: (selected: PreviewResult[]) => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(results.filter((r) => !r.error).map((r) => r.printer_id))
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const eligible = results.filter((r) => !r.error).map((r) => r.printer_id);
    if (eligible.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible));
    }
  }

  const eligible = results.filter((r) => !r.error);
  const allSelected = eligible.length > 0 && eligible.every((r) => selected.has(r.printer_id));
  const selectedResults = results.filter((r) => selected.has(r.printer_id));

  return (
    <Modal
      title="Poll Results Preview"
      subtitle={`${results.length} printer${results.length !== 1 ? "s" : ""} polled — select which to save`}
      onClose={onDiscard}
    >
      <FormStack>
        {/* Select all toggle */}
        {eligible.length > 0 && (
          <div className="flex items-center justify-between">
            <button
              className="text-[12px] text-stone-500 hover:text-stone-800 underline underline-offset-2"
              onClick={toggleAll}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            <span className="text-[11px] text-stone-400">{selected.size} selected to save</span>
          </div>
        )}

        {/* Results table */}
        <div className="border border-stone-100 rounded-lg overflow-hidden divide-y divide-stone-50">
          {results.map((r) => {
            const isError = Boolean(r.error);
            const checked = selected.has(r.printer_id);
            return (
              <div
                key={r.printer_id}
                className={`flex items-start gap-3 px-4 py-3 ${isError ? "opacity-50" : "cursor-pointer hover:bg-stone-50"} transition-colors`}
                onClick={() => !isError && toggle(r.printer_id)}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isError}
                  onChange={() => toggle(r.printer_id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 rounded border-stone-300 accent-stone-700 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[13px] font-medium text-stone-800">{r.name}</span>
                    <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${r.is_online ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {r.is_online ? "Online" : "Offline"}
                    </span>
                    {r.error_description && (
                      <span className="text-[10.5px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        {r.error_description}
                      </span>
                    )}
                  </div>
                  {r.error ? (
                    <p className="text-[11px] text-red-600">{r.error}</p>
                  ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {r.total_pages !== null && r.total_pages !== undefined && (
                        <span className="text-[11px] text-stone-500">
                          Meter: <span className="font-medium text-stone-700">{r.total_pages.toLocaleString()}</span>
                        </span>
                      )}
                      {r.toner && (
                        <span className="text-[11px] text-stone-500">
                          Toner: <span className="font-medium text-stone-700">{tonerSummary(r.toner)}</span>
                        </span>
                      )}
                      {r.printer_status && (
                        <span className="text-[11px] text-stone-400">{r.printer_status}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {disabled.length > 0 && (
          <p className="text-[11px] text-stone-400 italic">
            {disabled.length} printer{disabled.length !== 1 ? "s" : ""} skipped (SNMP disabled in app):{" "}
            {disabled.map((d) => d.name).join(", ")}
          </p>
        )}

        <ModalFooter>
          <BtnSecondary onClick={onDiscard}>Discard</BtnSecondary>
          <BtnPrimary onClick={() => onSave(selectedResults)} disabled={saving || selected.size === 0}>
            {saving ? "Saving…" : `Save ${selected.size} Result${selected.size !== 1 ? "s" : ""}`}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ── Poll result summary (after commit) ───────────────────────────────────────

type PollSummary = {
  polled: number;
  online: number;
  offline: number;
  errors: number;
  skippedDisabled: number;
  disabled: Array<{ printerId: string; name: string }>;
  results: Array<{ name: string; error?: string | null }>;
};

type PollApiBody = Partial<PollSummary> & {
  error?: string;
  previewOnly?: boolean;
  results?: PreviewResult[];
  disabled?: Array<{ printerId: string; name: string }>;
};

function namesPreview(items: Array<{ name: string }>) {
  const names = items.map((item) => item.name).filter(Boolean);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

function pollSummaryFromBody(body: PollApiBody): PollSummary {
  return {
    polled: body.polled ?? 0,
    online: body.online ?? 0,
    offline: body.offline ?? 0,
    errors: body.errors ?? 0,
    skippedDisabled: body.skippedDisabled ?? 0,
    disabled: body.disabled ?? [],
    results: (body.results ?? []) as Array<{ name: string; error?: string | null }>,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FleetActions({
  contacts,
  locations,
  paperStockRows,
}: {
  contacts: Contact[];
  locations: Location[];
  paperStockRows: LocationPaperStock[];
}) {
  const [orderOpen, setOrderOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pollResult, setPollResult] = useState<PollSummary | null>(null);
  const [pollError, setPollError] = useState("");
  const [previewData, setPreviewData] = useState<{ results: PreviewResult[]; disabled: Array<{ printerId: string; name: string }> } | null>(null);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);

  async function poll(locationId?: string) {
    setPolling(true);
    setPollError("");
    setPollResult(null);
    setPreviewData(null);
    setSiteDropdownOpen(false);
    try {
      const res = await fetch("/api/printers/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(locationId ? { locationId } : {}), previewOnly: true }),
      });
      const body = (await res.json()) as PollApiBody;
      if (!res.ok || body.error) {
        setPollError(body.error ?? "Poll failed.");
      } else if (body.previewOnly && body.results) {
        setPreviewData({
          results: body.results as PreviewResult[],
          disabled: body.disabled ?? [],
        });
      }
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Poll failed.");
    } finally {
      setPolling(false);
    }
  }

  async function commitPoll(selected: PreviewResult[]) {
    if (selected.length === 0) { setPreviewData(null); return; }
    setSaving(true);
    setPollError("");
    try {
      const res = await fetch("/api/printers/poll/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: selected }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        setPollError(body.error ?? "Save failed.");
      } else {
        setPollResult({
          polled: selected.length,
          online: selected.filter((r) => r.is_online).length,
          offline: selected.filter((r) => !r.is_online && !r.error).length,
          errors: body.errors ?? 0,
          skippedDisabled: previewData?.disabled.length ?? 0,
          disabled: previewData?.disabled ?? [],
          results: selected,
        });
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
      setPreviewData(null);
    }
  }

  const btnBase = "flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Update paper stock */}
        <button
          className={btnBase}
          onClick={() => setStockOpen(true)}
          style={{ borderColor: "#415445", color: "#415445" }}
        >
          <Layers size={13} />
          Update Stock
        </button>

        {/* Paper order */}
        <button
          className={btnBase}
          onClick={() => setOrderOpen(true)}
        >
          <FileText size={13} />
          Order Paper
        </button>

        {/* Poll controls — localhost only */}
        {SNMP_POLL_ENABLED && (
          <>
            <button
              className={btnBase}
              onClick={() => poll()}
              disabled={polling}
            >
              <Activity size={13} className={polling ? "animate-pulse" : ""} />
              {polling ? "Polling…" : "Poll All"}
            </button>

            {locations.length > 0 && (
              <div className="relative">
                <button
                  className={`${btnBase} pr-2`}
                  onClick={() => setSiteDropdownOpen((v) => !v)}
                  disabled={polling}
                >
                  <Activity size={13} />
                  Poll Site
                  <ChevronDown size={11} />
                </button>
                {siteDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSiteDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-stone-200 shadow-lg py-1 min-w-[160px]">
                      {locations.map((loc) => (
                        <button
                          key={loc.id}
                          className="w-full text-left px-4 py-2 text-[12.5px] text-stone-700 hover:bg-stone-50 transition-colors"
                          onClick={() => poll(loc.id)}
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Poll feedback — localhost only */}
      {SNMP_POLL_ENABLED && pollError && (
        <div className="mt-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {pollError}
        </div>
      )}
      {SNMP_POLL_ENABLED && pollResult && (
        <div className="mt-2 text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <div>
            Polled {pollResult.polled} printer{pollResult.polled !== 1 ? "s" : ""} - {pollResult.online} online, {pollResult.offline} offline
            {pollResult.errors > 0 && <span className="text-amber-700"> - {pollResult.errors} error{pollResult.errors !== 1 ? "s" : ""}</span>}
            {pollResult.skippedDisabled > 0 && (
              <span className="text-amber-700"> - {pollResult.skippedDisabled} SNMP off</span>
            )}
          </div>
          {pollResult.disabled.length > 0 && (
            <div className="mt-1 text-[11.5px] text-amber-800">
              SNMP off in app: {namesPreview(pollResult.disabled)}
            </div>
          )}
          {pollResult.results.some((result) => result.error) && (
            <div className="mt-1 text-[11.5px] text-amber-800">
              Errors: {namesPreview(pollResult.results.filter((result) => result.error))}
            </div>
          )}
        </div>
      )}

      {orderOpen && (
        <OrderPaperModal contacts={contacts} onClose={() => setOrderOpen(false)} />
      )}
      {stockOpen && (
        <UpdatePaperStockModal
          locations={locations}
          paperStockRows={paperStockRows}
          onClose={() => setStockOpen(false)}
        />
      )}
      {previewData && (
        <PollPreviewModal
          results={previewData.results}
          disabled={previewData.disabled}
          onSave={commitPoll}
          onDiscard={() => setPreviewData(null)}
          saving={saving}
        />
      )}
    </>
  );
}
