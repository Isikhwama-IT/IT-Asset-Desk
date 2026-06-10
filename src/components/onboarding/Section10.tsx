"use client";

import { useState, useTransition } from "react";
import { Check, FileText, Archive, X } from "lucide-react";
import type { OnboardingCase, OnboardingSpendItem, OnboardingPrinterAssignment } from "@/types/database";
import {
  saveOutstandingItems,
  markCompletionReportSent,
  savePaperworkFiled,
  closeCase,
  getCompletionReportData,
} from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type ExternalContact = { id: string; name: string; company: string | null; email: string | null };

interface Props {
  c: OnboardingCase;
  spendItems: OnboardingSpendItem[];
  printerAssignments: OnboardingPrinterAssignment[];
  externalContacts: ExternalContact[];
  onUpdate: (updates: Partial<OnboardingCase>) => void;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

function fmtShort(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function contactName(id: string | null | undefined, contacts: ExternalContact[]) {
  if (!id) return null;
  return contacts.find((c) => c.id === id)?.name ?? null;
}

async function buildAndPrintReport(
  c: OnboardingCase,
  spendItems: OnboardingSpendItem[],
  printerAssignments: OnboardingPrinterAssignment[],
  externalContacts: ExternalContact[]
) {
  const { error, assets, printerDetails } = await getCompletionReportData(c.id);
  if (error) throw new Error(error);

  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]));

  const employeeName = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
  const dateGenerated = fmt(new Date().toISOString());

  // ── Process log entries ────────────────────────────────────────────────────
  type LogEntry = { date: string; label: string; detail?: string };
  const log: LogEntry[] = [];

  const push = (iso: string | null | undefined, label: string, detail?: string) => {
    if (iso) log.push({ date: fmtShort(iso), label, detail });
  };

  push(c.created_at, "Case opened");
  push(c.hr_email_sent_at, "HR email sent");
  if (c.email_address) push(c.created_at, "Employee record created", c.email_address);
  push(c.ashton_email_sent_at, "Ashton notified of new employee");
  push(
    c.upstream_license_sent_at,
    "Upstream license check sent",
    contactName(c.upstream_license_contact_id, externalContacts) ?? undefined
  );
  if (c.license_decision) {
    const dec = c.license_decision === "purchase"
      ? `Needs purchase${c.license_cost ? ` — R${Number(c.license_cost).toFixed(2)}` : ""}`
      : c.license_decision === "repurpose" ? "Repurpose existing license" : "License available from stock";
    push(c.upstream_license_sent_at ?? c.created_at, "License decision recorded", dec);
  }
  push(c.rudi_approved_at, "Approved by Rudi");
  push(c.uzair_approved_at, "Approved by Uzair");
  push(c.finance_approved_at, "Finance sign-off");
  push(
    c.upstream_goahead_sent_at,
    "Go-ahead sent to Upstream",
    contactName(c.upstream_goahead_contact_id, externalContacts) ?? undefined
  );
  const ordered = spendItems.filter((i) => i.ordered && i.order_date);
  if (ordered.length > 0) {
    const earliest = ordered.sort((a, b) => (a.order_date! < b.order_date! ? -1 : 1))[0];
    push(earliest.order_date, "Hardware orders placed", `${ordered.length} item${ordered.length !== 1 ? "s" : ""}`);
  }
  const received = spendItems.filter((i) => i.received && i.received_date);
  if (received.length > 0) {
    const latest = received.sort((a, b) => (a.received_date! > b.received_date! ? -1 : 1))[0];
    push(latest.received_date, "Hardware received", `${received.length} item${received.length !== 1 ? "s" : ""}`);
  }
  push(
    c.upstream_collected_at,
    "Upstream collected device",
    contactName(c.upstream_collection_contact_id, externalContacts) ?? undefined
  );
  push(
    c.upstream_confirmed_at,
    "Upstream confirmed onboarding complete",
    contactName(c.upstream_confirmed_contact_id, externalContacts) ?? undefined
  );
  push(c.dropoff_arranged_at, "Device drop-off arranged");
  push(c.closed_at, "Case closed by IT");

  log.sort((a, b) => (a.date < b.date ? -1 : 1));

  // ── HTML sections ─────────────────────────────────────────────────────────
  const tdStyle = `border:1px solid #e7e5e4;padding:6px 10px;font-size:12px;vertical-align:top;`;
  const thStyle = `${tdStyle}background:#f5f5f4;font-weight:600;text-align:left;`;

  const assetsWithItems = spendItems.filter((i) => i.received && i.asset_id);
  const assetsHTML =
    assetsWithItems.length === 0
      ? "<p style='font-size:12px;color:#78716c;'>No assets logged.</p>"
      : `<table style='width:100%;border-collapse:collapse;margin-top:8px;'>
          <thead><tr>
            <th style='${thStyle}'>Category</th>
            <th style='${thStyle}'>Description</th>
            <th style='${thStyle}'>Brand / Model</th>
            <th style='${thStyle}'>Serial No.</th>
            <th style='${thStyle}'>Asset Code</th>
          </tr></thead>
          <tbody>${assetsWithItems.map((i) => {
            const a = i.asset_id ? assetMap[i.asset_id] : null;
            return `<tr>
              <td style='${tdStyle}'>${i.category}</td>
              <td style='${tdStyle}'>${i.description}</td>
              <td style='${tdStyle}'>${[i.brand, i.model].filter(Boolean).join(" ") || "—"}</td>
              <td style='${tdStyle}'>${i.serial_number || "—"}</td>
              <td style='${tdStyle}'>${a?.asset_code ?? "—"}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>`;

  const licCost = c.license_decision === "purchase" ? (c.license_cost ?? 0) : 0;
  const spendTotal = spendItems.reduce((s, i) => s + (i.unit_cost ?? 0) * (i.qty ?? 1), 0) + licCost;
  const licRow = c.license_decision
    ? `<tr>
        <td style='${tdStyle}'>license</td>
        <td style='${tdStyle}'>Microsoft 365 License</td>
        <td style='${tdStyle}' align='center'>1</td>
        <td style='${tdStyle}' align='right'>${licCost > 0 ? `R${licCost.toFixed(2)}` : "—"}</td>
        <td style='${tdStyle}' align='right'>${licCost > 0 ? `R${licCost.toFixed(2)}` : "—"}</td>
      </tr>`
    : "";

  const spendHTML = `<table style='width:100%;border-collapse:collapse;margin-top:8px;'>
    <thead><tr>
      <th style='${thStyle}'>Category</th>
      <th style='${thStyle}'>Description</th>
      <th style='${thStyle};text-align:center;'>Qty</th>
      <th style='${thStyle};text-align:right;'>Unit Cost</th>
      <th style='${thStyle};text-align:right;'>Total</th>
    </tr></thead>
    <tbody>
      ${spendItems.map((i) => `<tr>
        <td style='${tdStyle}'>${i.category}</td>
        <td style='${tdStyle}'>${i.description}</td>
        <td style='${tdStyle}' align='center'>${i.qty}</td>
        <td style='${tdStyle}' align='right'>${i.unit_cost != null ? `R${Number(i.unit_cost).toFixed(2)}` : "—"}</td>
        <td style='${tdStyle}' align='right'>${i.unit_cost != null ? `R${(Number(i.unit_cost) * i.qty).toFixed(2)}` : "—"}</td>
      </tr>`).join("")}
      ${licRow}
      <tr>
        <td colspan='4' style='${thStyle};text-align:right;'>Grand Total</td>
        <td style='${thStyle};text-align:right;'>R${spendTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <p style='font-size:11px;color:#78716c;margin-top:6px;'>
    Approvals: Rudi ${c.rudi_approved ? `✓ (${fmtShort(c.rudi_approved_at)})` : "—"}
    &nbsp;·&nbsp; Uzair ${c.uzair_approved ? `✓ (${fmtShort(c.uzair_approved_at)})` : "—"}
    &nbsp;·&nbsp; Finance ${c.finance_approved ? `✓ (${fmtShort(c.finance_approved_at)})` : "—"}
  </p>`;

  const sp = (c.sharepoint_sites as string[] | null) ?? [];
  const tc = (c.teams_channels as string[] | null) ?? [];
  const dl = (c.distribution_lists as string[] | null) ?? [];
  const upstreamContact = contactName(c.upstream_confirmed_contact_id ?? c.upstream_license_contact_id, externalContacts);

  const accountHTML = `
    ${sp.length > 0 ? `<p style='font-size:12px;margin:0 0 4px;'><strong>SharePoint sites:</strong> ${sp.join(", ")}</p>` : ""}
    ${tc.length > 0 ? `<p style='font-size:12px;margin:0 0 4px;'><strong>Teams channels:</strong> ${tc.join(", ")}</p>` : ""}
    ${dl.length > 0 ? `<p style='font-size:12px;margin:0 0 4px;'><strong>Distribution lists:</strong> ${dl.join(", ")}</p>` : ""}
    ${upstreamContact ? `<p style='font-size:12px;margin:0 0 4px;'><strong>Upstream contact:</strong> ${upstreamContact}</p>` : ""}
    ${c.upstream_confirmed_at ? `<p style='font-size:12px;margin:0;'><strong>Confirmed:</strong> ${fmt(c.upstream_confirmed_at)}</p>` : ""}`;

  const printersHTML =
    printerAssignments.length === 0
      ? "<p style='font-size:12px;color:#78716c;'>No printers configured.</p>"
      : `<table style='width:100%;border-collapse:collapse;margin-top:8px;'>
          <thead><tr>
            <th style='${thStyle}'>Printer</th>
            <th style='${thStyle}'>Location</th>
            <th style='${thStyle}'>Printer Code</th>
            <th style='${thStyle}'>Test Print</th>
          </tr></thead>
          <tbody>${printerAssignments.map((pa) => {
            const pd = printerDetails[pa.printer_id];
            return `<tr>
              <td style='${tdStyle}'>${pd?.name ?? pa.printer_id.slice(0, 8)}</td>
              <td style='${tdStyle}'>${pd?.location ?? "—"}</td>
              <td style='${tdStyle}'>${pa.printer_code ?? "—"}</td>
              <td style='${tdStyle}'>${pa.test_print_done ? "✓" : "—"}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>`;

  const logHTML =
    log.length === 0
      ? "<p style='font-size:12px;color:#78716c;'>No log entries.</p>"
      : `<table style='width:100%;border-collapse:collapse;margin-top:8px;'>
          <thead><tr>
            <th style='${thStyle}'>Date</th>
            <th style='${thStyle}'>Event</th>
            <th style='${thStyle}'>Detail</th>
          </tr></thead>
          <tbody>${log.map((e) => `<tr>
            <td style='${tdStyle};white-space:nowrap;'>${e.date}</td>
            <td style='${tdStyle}'>${e.label}</td>
            <td style='${tdStyle}'>${e.detail ?? "—"}</td>
          </tr>`).join("")}</tbody>
        </table>`;

  const section = (title: string, content: string) =>
    `<div style='margin-bottom:24px;page-break-inside:avoid;'>
      <h2 style='font-size:13px;font-weight:700;color:#1c1917;border-bottom:2px solid #e7e5e4;padding-bottom:4px;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em;'>
        ${title}
      </h2>
      ${content}
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset='utf-8'/>
  <title>IT Onboarding Completion Report — ${employeeName}</title>
  <style>
    @media print { body { margin: 0; } }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1c1917; padding: 32px; max-width: 820px; margin: 0 auto; }
  </style>
  </head><body>
  <div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:3px solid #C04F28;padding-bottom:16px;'>
    <div>
      <p style='font-size:11px;font-weight:700;color:#C04F28;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 4px;'>iSiBAG Manufacturing (Pty) Ltd</p>
      <h1 style='font-size:20px;font-weight:800;color:#1c1917;margin:0 0 4px;letter-spacing:-0.02em;'>IT Onboarding Completion Report</h1>
      <p style='font-size:12px;color:#78716c;margin:0;'>Prepared by: Adrian Lindeque &nbsp;·&nbsp; IT Department</p>
    </div>
    <div style='text-align:right;'>
      <p style='font-size:12px;color:#78716c;margin:0 0 2px;'>Date generated</p>
      <p style='font-size:13px;font-weight:600;margin:0;'>${dateGenerated}</p>
    </div>
  </div>

  ${section("Employee Details", `
    <table style='width:100%;border-collapse:collapse;'>
      <tr><td style='${tdStyle}width:160px;'><strong>Full name</strong></td><td style='${tdStyle}'>${employeeName}</td>
          <td style='${tdStyle}width:160px;'><strong>Job title</strong></td><td style='${tdStyle}'>${c.job_title ?? "—"}</td></tr>
      <tr><td style='${tdStyle}'><strong>Department</strong></td><td style='${tdStyle}'>${c.department ?? "—"}</td>
          <td style='${tdStyle}'><strong>Site</strong></td><td style='${tdStyle}'>${c.location ?? "—"}</td></tr>
      <tr><td style='${tdStyle}'><strong>Start date</strong></td><td style='${tdStyle}'>${fmt(c.start_date)}</td>
          <td style='${tdStyle}'><strong>Email address</strong></td><td style='${tdStyle}'>${c.email_address ?? "—"}</td></tr>
    </table>`)}

  ${section("Assets Assigned", assetsHTML)}
  ${section("Spend Summary", spendHTML)}
  ${section("Account Setup", accountHTML)}
  ${section("Printer Setup", printersHTML)}
  ${section("Process Log", logHTML)}
  ${c.outstanding_items ? section("Outstanding Items", `<p style='font-size:13px;white-space:pre-wrap;'>${c.outstanding_items}</p>`) : ""}

  <div style='margin-top:40px;padding-top:12px;border-top:1px solid #e7e5e4;text-align:center;'>
    <p style='font-size:11px;color:#a8a29e;margin:0;'>IT Department &nbsp;·&nbsp; iSiBAG Manufacturing (Pty) Ltd</p>
  </div>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function Section10({ c, spendItems, printerAssignments, externalContacts, onUpdate }: Props) {
  const { error: toastError, success } = useToast();

  // ── Outstanding items ──────────────────────────────────────────────────────
  const [items, setItems] = useState(c.outstanding_items ?? "");
  const [itemsDirty, setItemsDirty] = useState(false);
  const [pendingItems, startItemsTx] = useTransition();

  function handleSaveItems() {
    startItemsTx(async () => {
      const { error } = await saveOutstandingItems(c.id, items);
      if (error) { toastError(error); return; }
      setItemsDirty(false);
      onUpdate({ outstanding_items: items || null });
    });
  }

  // ── PDF generation ─────────────────────────────────────────────────────────
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pendingReportSent, startReportSentTx] = useTransition();

  async function handleGenerateReport() {
    setGeneratingPdf(true);
    try {
      await buildAndPrintReport(c, spendItems, printerAssignments, externalContacts);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setGeneratingPdf(false);
    }
  }

  function handleMarkReportSent() {
    startReportSentTx(async () => {
      const { error } = await markCompletionReportSent(c.id);
      if (error) { toastError(error); return; }
      success("Completion report marked as sent");
      onUpdate({ completion_report_sent_at: new Date().toISOString() });
    });
  }

  // ── Paperwork filed ─────────────────────────────────────────────────────────
  const [pendingPaperwork, startPaperworkTx] = useTransition();

  function togglePaperwork(checked: boolean) {
    startPaperworkTx(async () => {
      const { error } = await savePaperworkFiled(c.id, checked);
      if (error) { toastError(error); return; }
      onUpdate({ paperwork_filed: checked });
    });
  }

  // ── Close case ──────────────────────────────────────────────────────────────
  const [pendingClose, startCloseTx] = useTransition();

  function handleClose() {
    if (!window.confirm(`Close this case for ${[c.first_name, c.last_name].filter(Boolean).join(" ")}? This cannot be undone.`)) return;
    startCloseTx(async () => {
      const { error } = await closeCase(c.id);
      if (error) { toastError(error); return; }
      onUpdate({ status: "complete", closed_at: new Date().toISOString() });
    });
  }

  if (c.closed_at) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
          <Check size={14} className="text-green-500 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-green-800">Case closed</p>
            <p className="text-[12px] text-green-600">
              Closed on {fmt(c.closed_at)}
            </p>
          </div>
        </div>
        {c.outstanding_items && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Outstanding items</p>
            <p className="text-[13px] text-amber-800 whitespace-pre-wrap">{c.outstanding_items}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Outstanding items ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <FileText size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            Outstanding items
          </span>
          <span className="text-[11px] text-stone-400 ml-1">(optional)</span>
        </div>
        <textarea
          value={items}
          onChange={(e) => { setItems(e.target.value); setItemsDirty(true); }}
          placeholder="Note any outstanding items, follow-ups, or exceptions…"
          rows={3}
          className="w-full px-3 py-2.5 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 resize-none"
        />
        {itemsDirty && (
          <button
            type="button"
            onClick={handleSaveItems}
            disabled={pendingItems}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "#415445" }}
          >
            <Check size={13} />
            {pendingItems ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {/* ── Completion report ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <FileText size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            Completion report
          </span>
          {c.completion_report_sent_at && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Sent
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            <FileText size={13} />
            {generatingPdf ? "Generating…" : "Generate completion report"}
          </button>

          {!c.completion_report_sent_at ? (
            <button
              type="button"
              onClick={handleMarkReportSent}
              disabled={pendingReportSent}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "#C04F28" }}
            >
              <Check size={13} />
              {pendingReportSent ? "Saving…" : "Mark report as sent"}
            </button>
          ) : (
            <p className="self-center text-[12px] text-stone-400 flex items-center gap-1.5">
              <Check size={12} className="text-green-500" />
              Sent {fmtShort(c.completion_report_sent_at)}
            </p>
          )}
        </div>
      </div>

      {/* ── Paperwork filed ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <Archive size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            Physical paperwork
          </span>
        </div>
        <label
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg border select-none transition-colors",
            pendingPaperwork ? "opacity-60 cursor-default" : "cursor-pointer",
            c.paperwork_filed ? "border-green-200 bg-green-50/50" : "border-stone-200 hover:border-stone-300"
          )}
        >
          <input
            type="checkbox"
            checked={!!c.paperwork_filed}
            onChange={(e) => togglePaperwork(e.target.checked)}
            disabled={pendingPaperwork}
            className="accent-[#415445] w-4 h-4"
          />
          <span className={cn("text-[13px] font-medium", c.paperwork_filed ? "text-green-700" : "text-stone-700")}>
            Physical paperwork filed
          </span>
          {c.paperwork_filed && <Check size={12} className="ml-auto text-green-500 flex-shrink-0" />}
        </label>
      </div>

      {/* ── Close case ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <X size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">
            Close case
          </span>
        </div>
        <p className="text-[13px] text-stone-500">
          Mark this onboarding case as complete. This is permanent — the case becomes read-only.
        </p>
        <button
          type="button"
          onClick={handleClose}
          disabled={pendingClose}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: "#414042" }}
        >
          <Check size={13} />
          {pendingClose ? "Closing…" : "Close case"}
        </button>
      </div>
    </div>
  );
}
