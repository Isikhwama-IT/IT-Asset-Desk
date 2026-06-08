"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronUp, Pencil, FileCheck } from "lucide-react";
import {
  Modal, FormField, Input, Textarea, Select, ModalFooter,
  BtnPrimary, BtnSecondary, ErrorBanner, FormStack, FormGrid,
} from "@/components/modal-ui";
import { createPrinterContract, updatePrinterContract } from "@/lib/actions";
import type { PrinterContract, PrinterWithRelations } from "@/types/database";

type ContractRow = PrinterContract & { printer_contract_assignments: { printer_id: string }[] };
type PrinterRef = Pick<PrinterWithRelations, "id" | "name" | "printer_code" | "status" | "model">;

const CONTRACT_TYPES = ["Full Maintenance", "Parts Only", "Labour Only", "Consumables Included", "Ad Hoc"] as const;

// ── Status badge ──────────────────────────────────────────────────────────────

function contractStatus(endDate: string | null): { label: string; color: string; dot: string; bg: string } {
  if (!endDate) return { label: "Open-Ended", color: "text-stone-500", dot: "bg-stone-400", bg: "bg-stone-100" };
  const now = new Date();
  const end = new Date(endDate);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return { label: "Expired", color: "text-red-700", dot: "bg-red-500", bg: "bg-red-50" };
  if (daysLeft <= 60) return { label: "Expiring Soon", color: "text-amber-700", dot: "bg-amber-400", bg: "bg-amber-50" };
  return { label: "Active", color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" };
}

function StatusBadge({ endDate }: { endDate: string | null }) {
  const s = contractStatus(endDate);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${s.bg} ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Contract form ─────────────────────────────────────────────────────────────

type ContractFormData = {
  contract_reference: string;
  provider_name: string;
  provider_contact_name: string;
  provider_contact_email: string;
  provider_contact_phone: string;
  contract_type: string;
  covers_consumables: boolean;
  covers_parts: boolean;
  covers_labour: boolean;
  sla_response_hours: string;
  monthly_cost: string;
  start_date: string;
  end_date: string;
  auto_renews: boolean;
  notes: string;
  selected_printer_ids: string[];
};

const emptyForm = (): ContractFormData => ({
  contract_reference: "", provider_name: "", provider_contact_name: "",
  provider_contact_email: "", provider_contact_phone: "",
  contract_type: "Full Maintenance",
  covers_consumables: false, covers_parts: false, covers_labour: false,
  sla_response_hours: "", monthly_cost: "", start_date: "", end_date: "",
  auto_renews: false, notes: "", selected_printer_ids: [],
});

function fromContract(c: ContractRow): ContractFormData {
  return {
    contract_reference: c.contract_reference,
    provider_name: c.provider_name,
    provider_contact_name: c.provider_contact_name ?? "",
    provider_contact_email: c.provider_contact_email ?? "",
    provider_contact_phone: c.provider_contact_phone ?? "",
    contract_type: c.contract_type,
    covers_consumables: c.covers_consumables,
    covers_parts: c.covers_parts,
    covers_labour: c.covers_labour,
    sla_response_hours: c.sla_response_hours?.toString() ?? "",
    monthly_cost: c.monthly_cost?.toString() ?? "",
    start_date: c.start_date ?? "",
    end_date: c.end_date ?? "",
    auto_renews: c.auto_renews,
    notes: c.notes ?? "",
    selected_printer_ids: c.printer_contract_assignments.map((a) => a.printer_id),
  };
}

function ContractFormModal({
  printers,
  initial,
  contractId,
  onClose,
}: {
  printers: PrinterRef[];
  initial?: ContractRow;
  contractId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState<ContractFormData>(initial ? fromContract(initial) : emptyForm());

  const set = (k: keyof ContractFormData, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const togglePrinter = (id: string) =>
    set("selected_printer_ids",
      form.selected_printer_ids.includes(id)
        ? form.selected_printer_ids.filter((p) => p !== id)
        : [...form.selected_printer_ids, id]
    );

  function save() {
    if (!form.contract_reference.trim()) return setError("Contract reference is required.");
    if (!form.provider_name.trim()) return setError("Provider name is required.");
    startTransition(async () => {
      setError("");
      const payload = {
        contract_reference: form.contract_reference,
        provider_name: form.provider_name,
        provider_contact_name: form.provider_contact_name || null,
        provider_contact_email: form.provider_contact_email || null,
        provider_contact_phone: form.provider_contact_phone || null,
        contract_type: form.contract_type,
        covers_consumables: form.covers_consumables,
        covers_parts: form.covers_parts,
        covers_labour: form.covers_labour,
        sla_response_hours: form.sla_response_hours ? Number(form.sla_response_hours) : null,
        monthly_cost: form.monthly_cost ? Number(form.monthly_cost) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        auto_renews: form.auto_renews,
        notes: form.notes || null,
        printer_ids: form.selected_printer_ids,
      };
      const res = contractId
        ? await updatePrinterContract(contractId, payload)
        : await createPrinterContract(payload);
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  const chk = "w-4 h-4 rounded accent-stone-700 cursor-pointer";

  return (
    <Modal
      title={contractId ? "Edit Contract" : "Add Service Contract"}
      subtitle={contractId ? form.contract_reference : "New maintenance or support agreement"}
      onClose={onClose}
      width="max-w-2xl"
    >
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormGrid>
          <FormField label="Contract Reference" required>
            <Input value={form.contract_reference} onChange={(e) => set("contract_reference", e.target.value)} placeholder="e.g. SVC-2025-001" />
          </FormField>
          <FormField label="Contract Type">
            <Select value={form.contract_type} onChange={(e) => set("contract_type", e.target.value)}>
              {CONTRACT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormField label="Provider Name" required>
          <Input value={form.provider_name} onChange={(e) => set("provider_name", e.target.value)} placeholder="e.g. Olivetti SA" />
        </FormField>

        <FormGrid>
          <FormField label="Provider Contact">
            <Input value={form.provider_contact_name} onChange={(e) => set("provider_contact_name", e.target.value)} placeholder="Contact name" />
          </FormField>
          <FormField label="Contact Email">
            <Input type="email" value={form.provider_contact_email} onChange={(e) => set("provider_contact_email", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Contact Phone">
            <Input value={form.provider_contact_phone} onChange={(e) => set("provider_contact_phone", e.target.value)} />
          </FormField>
          <FormField label="SLA Response (hours)">
            <Input type="number" min={0} value={form.sla_response_hours} onChange={(e) => set("sla_response_hours", e.target.value)} placeholder="e.g. 4" />
          </FormField>
        </FormGrid>

        <div className="border border-stone-100 rounded-xl px-4 py-3">
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400 mb-2">Covers</p>
          <div className="flex gap-6">
            {([["covers_consumables", "Consumables"], ["covers_parts", "Parts"], ["covers_labour", "Labour"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className={chk} checked={form[k]} onChange={(e) => set(k, e.target.checked)} />
                <span className="text-[12.5px] text-stone-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <FormGrid>
          <FormField label="Monthly Cost (R)">
            <Input type="number" min={0} step="0.01" value={form.monthly_cost} onChange={(e) => set("monthly_cost", e.target.value)} placeholder="0.00" />
          </FormField>
          <FormField label="Auto-renews">
            <div className="flex items-center gap-2 h-[38px]">
              <input type="checkbox" className={chk} checked={form.auto_renews} onChange={(e) => set("auto_renews", e.target.checked)} />
              <span className="text-[12.5px] text-stone-700">Contract auto-renews</span>
            </div>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Start Date">
            <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </FormField>
          <FormField label="End Date">
            <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </FormField>
        </FormGrid>

        <div className="border border-stone-100 rounded-xl px-4 py-3">
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400 mb-2">Assign Printers</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {printers.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-stone-50 rounded px-1 py-1">
                <input
                  type="checkbox"
                  className={chk}
                  checked={form.selected_printer_ids.includes(p.id)}
                  onChange={() => togglePrinter(p.id)}
                />
                <span className="text-[12.5px] text-stone-700">#{p.printer_code} · {p.name}</span>
              </label>
            ))}
          </div>
        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save} disabled={pending}>
            {pending ? "Saving…" : contractId ? "Save Changes" : "Add Contract"}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export default function PrinterContractsClient({
  contracts,
  printers,
}: {
  contracts: ContractRow[];
  printers: PrinterRef[];
}) {
  const [modal, setModal] = useState<"add" | string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const printerById = Object.fromEntries(printers.map((p) => [p.id, p]));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModal("add")}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press"
          style={{ background: "#C04F28" }}
        >
          <Plus size={14} /> Add Contract
        </button>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 flex flex-col items-center justify-center py-16 text-stone-300">
          <FileCheck size={32} className="mb-3" />
          <p className="text-[13px]">No service contracts on record. Add one above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[560px]">
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 border-b border-stone-100 bg-stone-50 text-[10.5px] font-medium uppercase tracking-wider text-stone-400">
            <span>Contract / Provider</span>
            <span>Type</span>
            <span className="text-center">SLA</span>
            <span className="text-right">Monthly</span>
            <span>Status</span>
            <span />
          </div>

          <div className="divide-y divide-stone-50">
            {contracts.map((c) => {
              const isExpanded = expanded === c.id;
              const assignedPrinters = c.printer_contract_assignments
                .map((a) => printerById[a.printer_id])
                .filter(Boolean);

              return (
                <div key={c.id}>
                  <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-stone-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-stone-800 truncate">{c.contract_reference}</p>
                      <p className="text-[11px] text-stone-400 truncate">{c.provider_name}</p>
                    </div>
                    <span className="text-[12px] text-stone-600">{c.contract_type}</span>
                    <span className="text-[12px] text-stone-500 text-center tabular-nums">
                      {c.sla_response_hours ? `${c.sla_response_hours}h` : "—"}
                    </span>
                    <span className="text-[12px] text-stone-700 text-right tabular-nums">
                      {c.monthly_cost ? `R ${Number(c.monthly_cost).toLocaleString()}` : "—"}
                    </span>
                    <StatusBadge endDate={c.end_date} />
                    <div className="flex gap-1">
                      <button
                        onClick={() => setModal(c.id)}
                        className="w-7 h-7 rounded flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : c.id)}
                        className="w-7 h-7 rounded flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 bg-stone-50/50 border-t border-stone-100">
                      <div className="grid grid-cols-2 gap-4 text-[12px] mb-3">
                        <div>
                          <p className="text-stone-400 mb-0.5">Covers</p>
                          <div className="flex gap-2">
                            {c.covers_consumables && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px]">Consumables</span>}
                            {c.covers_parts && <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[11px]">Parts</span>}
                            {c.covers_labour && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[11px]">Labour</span>}
                            {!c.covers_consumables && !c.covers_parts && !c.covers_labour && <span className="text-stone-400">—</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-stone-400 mb-0.5">Period</p>
                          <p className="text-stone-700">
                            {c.start_date ?? "—"} → {c.end_date ?? "Open"}{c.auto_renews ? " (auto-renews)" : ""}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10.5px] text-stone-400 mb-1.5">Assigned Printers ({assignedPrinters.length})</p>
                        {assignedPrinters.length === 0 ? (
                          <p className="text-[12px] text-stone-400">No printers assigned</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {assignedPrinters.map((p) => (
                              <span key={p!.id} className="text-[11px] px-2 py-0.5 bg-white border border-stone-200 rounded-full text-stone-600">
                                #{p!.printer_code} {p!.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {c.notes && <p className="text-[12px] text-stone-500 mt-2 italic">{c.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
          </div>
        </div>
      )}

      {modal === "add" && (
        <ContractFormModal printers={printers} onClose={() => setModal(null)} />
      )}
      {modal && modal !== "add" && (() => {
        const contract = contracts.find((c) => c.id === modal);
        if (!contract) return null;
        return (
          <ContractFormModal
            printers={printers}
            initial={contract}
            contractId={contract.id}
            onClose={() => setModal(null)}
          />
        );
      })()}
    </div>
  );
}
