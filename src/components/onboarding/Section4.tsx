"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Check, FileText, AlertTriangle, X } from "lucide-react";
import type { OnboardingCase, OnboardingSpendItem } from "@/types/database";
import {
  addSpendItem, updateSpendItem, deleteSpendItem,
  markProcurementPdfSent, saveApprovals,
} from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

interface Props {
  c: OnboardingCase;
  spendItems: OnboardingSpendItem[];
  onCaseUpdate: (updates: Partial<OnboardingCase>) => void;
  onSpendChange: (items: OnboardingSpendItem[]) => void;
}

const CATEGORIES = ["laptop", "monitor", "peripheral", "license", "other"] as const;
type Category = (typeof CATEGORIES)[number];

type RowDraft = {
  category: Category;
  description: string;
  brand: string;
  model: string;
  qty: number;
  unit_cost: string;
};

const BLANK: RowDraft = { category: "laptop", description: "", brand: "", model: "", qty: 1, unit_cost: "" };

type LicenseRow = {
  id: "__license__";
  category: "license";
  description: string;
  qty: 1;
  unit_cost: number;
  readOnly: true;
};

function getLicenseRow(c: OnboardingCase): LicenseRow {
  const isNeeds = c.license_decision === "purchase";
  return {
    id: "__license__",
    category: "license",
    description: isNeeds
      ? "Microsoft 365 License"
      : `License — ${c.license_decision === "repurpose" ? "Repurposed" : "Available"}`,
    qty: 1,
    unit_cost: isNeeds ? (c.license_cost ?? 0) : 0,
    readOnly: true,
  };
}

function rowTotal(qty: number, cost: number | null) {
  return (cost ?? 0) * qty;
}

// ── PDF generation (browser print popup) ──────────────────────────────────────
function generatePDF(c: OnboardingCase, items: OnboardingSpendItem[], licRow: LicenseRow) {
  const allRows = [...items.map(i => ({
    category: i.category,
    description: i.description,
    brand: i.brand ?? "",
    model: i.model ?? "",
    qty: i.qty,
    unit_cost: i.unit_cost ?? 0,
    total: rowTotal(i.qty, i.unit_cost),
  })), {
    category: licRow.category,
    description: licRow.description,
    brand: "",
    model: "",
    qty: 1,
    unit_cost: licRow.unit_cost,
    total: licRow.unit_cost,
  }];

  const grouped = CATEGORIES.reduce<Record<string, typeof allRows>>((acc, cat) => {
    const rows = allRows.filter(r => r.category === cat);
    if (rows.length) acc[cat] = rows;
    return acc;
  }, {});

  const grandTotal = allRows.reduce((sum, r) => sum + r.total, 0);
  const dateGenerated = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  const startDate = c.start_date
    ? new Date(c.start_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const licDecision = c.license_decision === "purchase"
    ? `Needs purchase — R${(c.license_cost ?? 0).toFixed(2)}`
    : c.license_decision === "repurpose"
    ? "Repurposed existing license"
    : "License available from stock";

  const itemRows = Object.entries(grouped).map(([cat, rows]) => {
    const subTotal = rows.reduce((s, r) => s + r.total, 0);
    const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
    const rowHtml = rows.map(r => `
      <tr>
        <td>${r.description}</td>
        <td>${r.brand}</td>
        <td>${r.model}</td>
        <td class="num">${r.qty}</td>
        <td class="num">R ${r.unit_cost.toFixed(2)}</td>
        <td class="num">R ${r.total.toFixed(2)}</td>
      </tr>`).join("");
    return `
      <tr class="cat-header"><td colspan="6">${catLabel}</td></tr>
      ${rowHtml}
      <tr class="subtotal"><td colspan="5">Subtotal — ${catLabel}</td><td class="num">R ${subTotal.toFixed(2)}</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Cost Summary — ${[c.first_name, c.last_name].filter(Boolean).join(" ")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #415445; padding-bottom: 12px; }
  .brand { font-size: 20pt; font-weight: 900; letter-spacing: -0.03em; color: #415445; }
  .brand span { color: #C04F28; }
  .doc-title { font-size: 13pt; font-weight: bold; color: #444; margin-top: 4px; }
  .meta { text-align: right; font-size: 9pt; color: #666; }
  .employee-box { background: #f7f6f4; border: 1px solid #ddd; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .employee-box .row { display: flex; gap: 8px; font-size: 10pt; }
  .employee-box .label { font-weight: 600; color: #555; min-width: 80px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #415445; color: white; font-size: 9pt; text-align: left; padding: 7px 10px; }
  th.num, td.num { text-align: right; }
  td { padding: 6px 10px; font-size: 10pt; border-bottom: 1px solid #eee; }
  tr.cat-header td { background: #f0f0ee; font-weight: 700; font-size: 9.5pt; color: #415445; border-bottom: none; }
  tr.subtotal td { font-weight: 600; background: #fafaf8; border-top: 1px solid #ddd; font-size: 9.5pt; }
  .grand-total { font-size: 13pt; font-weight: 800; text-align: right; color: #C04F28; padding: 10px 0; border-top: 2px solid #415445; }
  .license-note { margin-top: 16px; font-size: 9.5pt; color: #555; background: #fffbf5; border: 1px solid #f0d08a; border-radius: 4px; padding: 10px 14px; }
  .license-note strong { color: #333; }
  @media print {
    body { padding: 20px; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">i<span>S</span>iBAG</div>
    <div class="doc-title">IT Procurement Cost Summary</div>
  </div>
  <div class="meta">Generated: ${dateGenerated}</div>
</div>
<div class="employee-box">
  <div class="row"><span class="label">Employee:</span> <span>${[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</span></div>
  <div class="row"><span class="label">Job Title:</span> <span>${c.job_title || "—"}</span></div>
  <div class="row"><span class="label">Site:</span> <span>${c.location || "—"}</span></div>
  <div class="row"><span class="label">Start Date:</span> <span>${startDate}</span></div>
</div>
<table>
  <thead>
    <tr>
      <th>Description</th><th>Brand</th><th>Model</th>
      <th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>
<div class="grand-total">Grand Total: R ${grandTotal.toFixed(2)}</div>
<div class="license-note"><strong>License decision:</strong> ${licDecision}</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function Section4({ c, spendItems, onCaseUpdate, onSpendChange }: Props) {
  const { error: toastError, success } = useToast();
  const [pendingPdf, startPdfTx] = useTransition();
  const [pendingApprovals, startApprovalsTx] = useTransition();

  const licRow = getLicenseRow(c);

  // ── Spend items state ───────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<RowDraft>(BLANK);
  const [savingRow, setSavingRow] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startEdit(item: OnboardingSpendItem) {
    setDraft({
      category: item.category as Category,
      description: item.description,
      brand: item.brand ?? "",
      model: item.model ?? "",
      qty: item.qty,
      unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
    });
    setEditingId(item.id);
  }

  function startNew() {
    setDraft(BLANK);
    setEditingId("new");
  }

  async function saveRow() {
    if (!draft.description.trim()) { toastError("Description is required."); return; }
    const costNum = draft.unit_cost !== "" ? parseFloat(draft.unit_cost) : null;
    if (draft.unit_cost !== "" && isNaN(costNum!)) { toastError("Enter a valid cost."); return; }
    setSavingRow(true);
    try {
      if (editingId === "new") {
        const { error, id } = await addSpendItem(c.id, {
          category: draft.category,
          description: draft.description.trim(),
          brand: draft.brand.trim() || null,
          model: draft.model.trim() || null,
          qty: draft.qty,
          unit_cost: costNum,
        });
        if (error) { toastError(error); return; }
        const newItem: OnboardingSpendItem = {
          id: id!,
          case_id: c.id,
          category: draft.category,
          description: draft.description.trim(),
          brand: draft.brand.trim() || null,
          model: draft.model.trim() || null,
          qty: draft.qty,
          unit_cost: costNum,
          ordered: false,
          order_date: null,
          supplier: null,
          received: false,
          received_date: null,
          condition: null,
          condition_notes: null,
          serial_number: null,
          asset_tag: null,
          asset_id: null,
          created_at: new Date().toISOString(),
        };
        onSpendChange([...spendItems, newItem]);
      } else {
        const { error } = await updateSpendItem(editingId!, c.id, {
          category: draft.category,
          description: draft.description.trim(),
          brand: draft.brand.trim() || null,
          model: draft.model.trim() || null,
          qty: draft.qty,
          unit_cost: costNum,
        });
        if (error) { toastError(error); return; }
        onSpendChange(spendItems.map(i =>
          i.id === editingId
            ? { ...i, category: draft.category, description: draft.description.trim(), brand: draft.brand.trim() || null, model: draft.model.trim() || null, qty: draft.qty, unit_cost: costNum }
            : i
        ));
      }
      setEditingId(null);
    } finally {
      setSavingRow(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await deleteSpendItem(id, c.id);
    setDeletingId(null);
    if (error) { toastError(error); return; }
    onSpendChange(spendItems.filter(i => i.id !== id));
  }

  const grandTotal = spendItems.reduce((s, i) => s + rowTotal(i.qty, i.unit_cost), 0) + licRow.unit_cost;

  const spendChangedAfterPdf = !!(
    c.procurement_pdf_sent_at &&
    spendItems.some((i) => i.created_at > c.procurement_pdf_sent_at!)
  );

  // ── PDF state ───────────────────────────────────────────────────────────────
  function handleGeneratePDF() {
    generatePDF(c, spendItems, licRow);
  }

  function handleMarkPdfSent() {
    startPdfTx(async () => {
      const { error } = await markProcurementPdfSent(c.id);
      if (error) { toastError(error); return; }
      success("PDF sent — approvals panel now active");
      onCaseUpdate({ procurement_pdf_sent_at: new Date().toISOString() });
    });
  }

  // ── Approvals state ─────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [approvals, setApprovals] = useState({
    rudi:    { approved: c.rudi_approved,    at: c.rudi_approved_at?.slice(0, 10) ?? "" },
    uzair:   { approved: c.uzair_approved,   at: c.uzair_approved_at?.slice(0, 10) ?? "" },
    finance: { approved: c.finance_approved, at: c.finance_approved_at?.slice(0, 10) ?? "" },
  });

  function toggleApproval(key: "rudi" | "uzair" | "finance", checked: boolean) {
    setApprovals(prev => ({
      ...prev,
      [key]: { approved: checked, at: checked && !prev[key].at ? today : checked ? prev[key].at : "" },
    }));
  }

  function handleSaveApprovals() {
    startApprovalsTx(async () => {
      const { error } = await saveApprovals(c.id, {
        rudi_approved:    approvals.rudi.approved,
        rudi_approved_at: approvals.rudi.at || null,
        uzair_approved:   approvals.uzair.approved,
        uzair_approved_at: approvals.uzair.at || null,
        finance_approved: approvals.finance.approved,
        finance_approved_at: approvals.finance.at || null,
      });
      if (error) { toastError(error); return; }
      const allApproved = approvals.rudi.approved && approvals.uzair.approved && approvals.finance.approved;
      success(allApproved ? "All approved — Section 5 unlocked" : "Approvals saved");
      onCaseUpdate({
        rudi_approved:    approvals.rudi.approved,
        rudi_approved_at: approvals.rudi.at || null,
        uzair_approved:   approvals.uzair.approved,
        uzair_approved_at: approvals.uzair.at || null,
        finance_approved: approvals.finance.approved,
        finance_approved_at: approvals.finance.at || null,
      });
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-7">
      {/* Spend-changed banner */}
      {spendChangedAfterPdf && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-800">Spend has changed — regenerate PDF before resending.</p>
        </div>
      )}

      {/* ── 4a Spend items ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">4a — Spend Items</span>
        </div>

        {/* Table */}
        <div className="border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-3 py-2 font-medium text-stone-500">Category</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Description</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500 hidden sm:table-cell">Brand / Model</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Qty</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Unit cost</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Total</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {/* DB spend rows */}
              {spendItems.map((item) =>
                editingId === item.id ? (
                  <EditRow
                    key={item.id}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={saveRow}
                    onCancel={() => setEditingId(null)}
                    saving={savingRow}
                  />
                ) : (
                  <tr key={item.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                    <td className="px-3 py-2 capitalize text-stone-500">{item.category}</td>
                    <td className="px-3 py-2 text-stone-700">{item.description}</td>
                    <td className="px-3 py-2 text-stone-400 hidden sm:table-cell">
                      {[item.brand, item.model].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-600">{item.qty}</td>
                    <td className="px-3 py-2 text-right text-stone-600">
                      {item.unit_cost != null ? `R ${item.unit_cost.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-stone-700">
                      R {rowTotal(item.qty, item.unit_cost).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => startEdit(item)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-stone-100 text-stone-300 hover:text-stone-600">
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-stone-300 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {/* New row editor */}
              {editingId === "new" && (
                <EditRow
                  draft={draft}
                  setDraft={setDraft}
                  onSave={saveRow}
                  onCancel={() => setEditingId(null)}
                  saving={savingRow}
                />
              )}

              {/* License row (always last, read-only) */}
              <tr className="bg-stone-50/60 border-t border-stone-100">
                <td className="px-3 py-2 text-stone-400 italic text-[11px]">license</td>
                <td className="px-3 py-2 text-stone-500 italic">{licRow.description}</td>
                <td className="px-3 py-2 hidden sm:table-cell" />
                <td className="px-3 py-2 text-right text-stone-400">1</td>
                <td className="px-3 py-2 text-right text-stone-400">
                  {licRow.unit_cost > 0 ? `R ${licRow.unit_cost.toFixed(2)}` : "R 0.00"}
                </td>
                <td className="px-3 py-2 text-right text-stone-500">
                  {licRow.unit_cost > 0 ? `R ${licRow.unit_cost.toFixed(2)}` : "R 0.00"}
                </td>
                <td />
              </tr>

              {/* Grand total */}
              <tr className="border-t-2 border-stone-300 bg-stone-100/50">
                <td colSpan={5} className="px-3 py-2.5 text-right text-[12px] font-semibold text-stone-600">
                  Grand Total
                </td>
                <td className="px-3 py-2.5 text-right text-[13px] font-bold text-stone-800">
                  R {grandTotal.toFixed(2)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add item button */}
        {editingId === null && (
          <button
            type="button"
            onClick={startNew}
            className="flex items-center gap-1.5 text-[12px] text-stone-500 hover:text-stone-700 transition-colors"
          >
            <Plus size={13} /> Add item
          </button>
        )}
      </div>

      {/* ── 4b PDF generation ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <FileText size={13} className="text-stone-400" />
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">4b — Cost Summary PDF</span>
          {c.procurement_pdf_sent_at && !spendChangedAfterPdf && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> Sent
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGeneratePDF}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <FileText size={13} />
            Generate cost summary PDF
          </button>
          {!c.procurement_pdf_sent_at ? (
            <button
              type="button"
              onClick={handleMarkPdfSent}
              disabled={pendingPdf}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: "#C04F28" }}
            >
              <Check size={13} />
              {pendingPdf ? "Saving…" : "Mark PDF sent to Rudi, Uzair & Finance"}
            </button>
          ) : (
            <p className="text-[12px] text-stone-400 flex items-center gap-1.5">
              <Check size={11} className="text-green-500" />
              Sent {new Date(c.procurement_pdf_sent_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* ── 4c Approvals ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
          <span className="text-[12px] font-semibold text-stone-700 uppercase tracking-wide">4c — Sign-off</span>
          {c.rudi_approved && c.uzair_approved && c.finance_approved && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-green-700 font-medium">
              <Check size={11} /> All approved
            </span>
          )}
        </div>

        <div className="space-y-2">
          {(["rudi", "uzair", "finance"] as const).map((key) => {
            const label = key === "rudi" ? "Rudi" : key === "uzair" ? "Uzair" : "Finance";
            const state = approvals[key];
            return (
              <div key={key} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                state.approved ? "border-green-200 bg-green-50/50" : "border-stone-200"
              )}>
                <input
                  type="checkbox"
                  checked={state.approved}
                  onChange={(e) => toggleApproval(key, e.target.checked)}
                  className="w-4 h-4 accent-[#415445] flex-shrink-0"
                />
                <span className="text-[13px] text-stone-700 font-medium w-24 flex-shrink-0">{label}</span>
                <input
                  type="date"
                  value={state.at}
                  onChange={(e) => setApprovals(prev => ({ ...prev, [key]: { ...prev[key], at: e.target.value } }))}
                  disabled={!state.approved}
                  className="text-[12px] border border-stone-200 rounded-lg px-2 py-1 text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-stone-400"
                />
                {state.approved && state.at && (
                  <span className="text-[11px] text-green-700 flex items-center gap-1">
                    <Check size={11} /> Approved
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSaveApprovals}
          disabled={pendingApprovals}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: "#C04F28" }}
        >
          <Check size={13} />
          {pendingApprovals ? "Saving…" : "Save approvals"}
        </button>
      </div>
    </div>
  );
}

// ── Inline row editor ──────────────────────────────────────────────────────────
function EditRow({
  draft, setDraft, onSave, onCancel, saving,
}: {
  draft: RowDraft;
  setDraft: React.Dispatch<React.SetStateAction<RowDraft>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const cell = "px-2 py-1.5";
  const inp = "w-full px-2 py-1 text-[12px] border border-stone-200 rounded focus:outline-none focus:border-stone-400 bg-white";

  return (
    <tr className="border-b border-stone-200 bg-stone-50/80">
      <td className={cell}>
        <select
          value={draft.category}
          onChange={(e) => setDraft(d => ({ ...d, category: e.target.value as Category }))}
          className={inp}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className={cell}>
        <input
          autoFocus
          value={draft.description}
          onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
          placeholder="Description *"
          className={inp}
        />
      </td>
      <td className={cn(cell, "hidden sm:table-cell")}>
        <div className="flex gap-1">
          <input value={draft.brand} onChange={(e) => setDraft(d => ({ ...d, brand: e.target.value }))} placeholder="Brand" className={inp} />
          <input value={draft.model} onChange={(e) => setDraft(d => ({ ...d, model: e.target.value }))} placeholder="Model" className={inp} />
        </div>
      </td>
      <td className={cell}>
        <input
          type="number"
          min={1}
          value={draft.qty}
          onChange={(e) => setDraft(d => ({ ...d, qty: Math.max(1, parseInt(e.target.value) || 1) }))}
          className={cn(inp, "w-14 text-right")}
        />
      </td>
      <td className={cell}>
        <input
          type="number"
          min={0}
          step={0.01}
          value={draft.unit_cost}
          onChange={(e) => setDraft(d => ({ ...d, unit_cost: e.target.value }))}
          placeholder="0.00"
          className={cn(inp, "w-24 text-right")}
        />
      </td>
      <td className={cn(cell, "text-right text-[12px] text-stone-400")}>
        {draft.unit_cost && !isNaN(parseFloat(draft.unit_cost))
          ? `R ${(parseFloat(draft.unit_cost) * draft.qty).toFixed(2)}`
          : "—"}
      </td>
      <td className={cell}>
        <div className="flex items-center gap-1 justify-end">
          <button onClick={onCancel} className="w-6 h-6 flex items-center justify-center rounded hover:bg-stone-200 text-stone-400">
            <X size={11} />
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="w-6 h-6 flex items-center justify-center rounded text-white disabled:opacity-60"
            style={{ background: "#415445" }}
          >
            <Check size={11} />
          </button>
        </div>
      </td>
    </tr>
  );
}
