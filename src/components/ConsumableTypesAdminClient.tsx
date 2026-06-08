"use client";

import { useState, useTransition } from "react";
import { Package2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Modal, FormField, Input, Select, Textarea, ModalFooter,
  BtnPrimary, BtnSecondary, ErrorBanner, FormStack, FormGrid,
} from "@/components/modal-ui";
import { upsertGlobalConsumableType } from "@/lib/actions";
import type { ConsumableType } from "@/types/database";

// ── Reference data ────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string }[] = [
  { value: "toner",           label: "Toner" },
  { value: "developer",       label: "Developer" },
  { value: "drum",            label: "Drum" },
  { value: "fuser",           label: "Fuser" },
  { value: "waste_box",       label: "Waste Box" },
  { value: "maintenance_kit", label: "Maintenance Kit" },
];

const ALL_COLOURS: { value: string; label: string }[] = [
  { value: "black",    label: "Black" },
  { value: "cyan",     label: "Cyan" },
  { value: "magenta",  label: "Magenta" },
  { value: "yellow",   label: "Yellow" },
  { value: "combined", label: "Combined (All-in-One)" },
  { value: "other",    label: "N/A" },
];

function coloursForKind(kind: string): { value: string; label: string }[] {
  if (kind === "toner")     return ALL_COLOURS;
  if (kind === "developer") return ALL_COLOURS.filter((c) => c.value !== "combined");
  return ALL_COLOURS.filter((c) => c.value === "other");
}

const KIND_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const COLOUR_LABEL: Record<string, string> = Object.fromEntries(ALL_COLOURS.map((c) => [c.value, c.label]));

// ── Form state ────────────────────────────────────────────────────────────────

// Maps directly to consumable_types DB columns (see database.ts).
// description = "Name", kind = "Category", compatible_models = comma-separated string.
type FormState = {
  part_number: string;
  description: string;   // "Name" in the UI
  manufacturer: string;
  kind: string;          // "Category" in the UI
  colour: string;
  compatible_models: string;
  rated_yield_pages: string;
  coverage_pct: string;
  unit_price: string;
  reorder_threshold_pct: string;
  reorder_stock_min: string;
  supplier_lead_days: string;
};

function emptyForm(): FormState {
  return {
    part_number: "", description: "", manufacturer: "",
    kind: "toner", colour: "black", compatible_models: "",
    rated_yield_pages: "", coverage_pct: "5", unit_price: "",
    reorder_threshold_pct: "25", reorder_stock_min: "1",
    supplier_lead_days: "1",
  };
}

function fromExisting(c: ConsumableType): FormState {
  return {
    part_number:          c.part_number          ?? "",
    description:          c.description          ?? "",
    manufacturer:         c.manufacturer         ?? "",
    kind:                 c.kind,
    colour:               c.colour,
    compatible_models:    c.compatible_models     ?? "",
    rated_yield_pages:    c.rated_yield_pages?.toString()    ?? "",
    coverage_pct:         c.coverage_pct?.toString()         ?? "5",
    unit_price:           c.unit_price?.toString()           ?? "",
    reorder_threshold_pct: c.reorder_threshold_pct?.toString() ?? "25",
    reorder_stock_min:    c.reorder_stock_min?.toString()    ?? "1",
    supplier_lead_days:   c.supplier_lead_days?.toString()   ?? "1",
  };
}

// ── Form modal ────────────────────────────────────────────────────────────────

function ConsumableTypeModal({
  existing,
  onClose,
}: {
  existing?: ConsumableType;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(existing ? fromExisting(existing) : emptyForm());

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // When category changes, reset colour to the first valid option for that category
      if (k === "kind") {
        const valid = coloursForKind(v);
        if (!valid.find((c) => c.value === f.colour)) {
          next.colour = valid[0].value;
        }
      }
      return next;
    });
  };

  function save() {
    if (!form.description.trim()) return setError("Name is required.");
    startTransition(async () => {
      setError("");
      const res = await upsertGlobalConsumableType({
        id:                    existing?.id,
        printer_id:            null,
        part_number:           form.part_number    || null,
        description:           form.description,
        manufacturer:          form.manufacturer   || null,
        kind:                  form.kind,
        colour:                form.colour,
        compatible_models:     form.compatible_models || null,
        rated_yield_pages:     form.rated_yield_pages  ? Number(form.rated_yield_pages)  : null,
        coverage_pct:          form.coverage_pct       ? Number(form.coverage_pct)       : 5,
        unit_price:            form.unit_price          ? Number(form.unit_price)          : null,
        reorder_threshold_pct: form.reorder_threshold_pct ? Number(form.reorder_threshold_pct) : 25,
        reorder_stock_min:     form.reorder_stock_min  ? Number(form.reorder_stock_min)  : 1,
        supplier_lead_days:    form.supplier_lead_days ? Number(form.supplier_lead_days) : 1,
      });
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  const validColours = coloursForKind(form.kind);
  const showColour = form.kind === "toner" || form.kind === "developer";

  return (
    <Modal
      title={existing ? "Edit Consumable Type" : "Add Consumable Type"}
      subtitle={existing
        ? (existing.part_number ?? existing.description ?? "")
        : "New reference catalogue entry"}
      onClose={onClose}
      width="max-w-2xl"
    >
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormGrid>
          <FormField label="Part Number">
            {existing ? (
              <p className="text-[13px] text-stone-700 py-2 font-mono">{existing.part_number ?? "—"}</p>
            ) : (
              <Input
                value={form.part_number}
                onChange={(e) => set("part_number", e.target.value)}
                placeholder="e.g. TN-321K"
              />
            )}
          </FormField>
          <FormField label="Manufacturer">
            <Input
              value={form.manufacturer}
              onChange={(e) => set("manufacturer", e.target.value)}
              placeholder="e.g. Brother"
            />
          </FormField>
        </FormGrid>

        <FormField label="Name" required>
          <Input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="e.g. TN-321K Black Toner Cartridge"
          />
        </FormField>

        <FormGrid>
          <FormField label="Category">
            <Select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Colour">
            {showColour ? (
              <Select value={form.colour} onChange={(e) => set("colour", e.target.value)}>
                {validColours.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            ) : (
              <p className="text-[12.5px] text-stone-400 py-2 px-1">N/A</p>
            )}
          </FormField>
        </FormGrid>

        <FormField label="Compatible Models">
          <Input
            value={form.compatible_models}
            onChange={(e) => set("compatible_models", e.target.value)}
            placeholder="e.g. MF459dw, MF559dw (comma-separated)"
          />
        </FormField>

        <FormGrid>
          <FormField label="Rated Yield (pages)">
            <Input
              type="number" min={0}
              value={form.rated_yield_pages}
              onChange={(e) => set("rated_yield_pages", e.target.value)}
              placeholder="e.g. 6000"
            />
          </FormField>
          <FormField label="Coverage % (default 5)">
            <Input
              type="number" min={0} max={100}
              value={form.coverage_pct}
              onChange={(e) => set("coverage_pct", e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Unit Price (R)">
            <Input
              type="number" min={0} step="0.01"
              value={form.unit_price}
              onChange={(e) => set("unit_price", e.target.value)}
              placeholder="e.g. 850.00"
            />
          </FormField>
          <FormField label="Reorder Threshold %">
            <Input
              type="number" min={0} max={100}
              value={form.reorder_threshold_pct}
              onChange={(e) => set("reorder_threshold_pct", e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Reorder Stock Min">
            <Input
              type="number" min={0}
              value={form.reorder_stock_min}
              onChange={(e) => set("reorder_stock_min", e.target.value)}
            />
          </FormField>
          <FormField label="Supplier Lead Days">
            <Input
              type="number" min={1}
              value={form.supplier_lead_days}
              onChange={(e) => set("supplier_lead_days", e.target.value)}
            />
          </FormField>
        </FormGrid>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save} disabled={pending}>
            {pending ? "Saving…" : existing ? "Save Changes" : "Add Consumable Type"}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export default function ConsumableTypesAdminClient({
  initialTypes,
}: {
  initialTypes: ConsumableType[];
}) {
  const [modal, setModal] = useState<"add" | string | null>(null);

  const editingItem = modal && modal !== "add"
    ? initialTypes.find((t) => t.id === modal) ?? null
    : null;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModal("add")}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press"
          style={{ background: "#C04F28" }}
        >
          <Plus size={14} /> Add New
        </button>
      </div>

      {initialTypes.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 flex flex-col items-center justify-center py-16 text-stone-300">
          <Package2 size={32} className="mb-3" />
          <p className="text-[13px]">No consumable types on record. Add one above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          {/* Table header */}
          <div className="min-w-[900px] grid grid-cols-[110px_1.6fr_100px_80px_160px_80px_90px_80px_60px_40px] gap-3 px-5 py-2.5 border-b border-stone-100 bg-stone-50 text-[10.5px] font-medium uppercase tracking-wider text-stone-400">
            <span>Part No.</span>
            <span>Name</span>
            <span>Category</span>
            <span>Colour</span>
            <span>Compatible</span>
            <span className="text-right">Yield</span>
            <span className="text-right">Price (R)</span>
            <span className="text-right">Reorder %</span>
            <span className="text-right">Lead</span>
            <span />
          </div>

          <div className="min-w-[900px] divide-y divide-stone-50">
            {initialTypes.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[110px_1.6fr_100px_80px_160px_80px_90px_80px_60px_40px] gap-3 px-5 py-3 items-center hover:bg-stone-50 transition-colors"
              >
                <p className="text-[11.5px] font-mono text-stone-600 truncate">
                  {item.part_number ?? <span className="text-stone-300">—</span>}
                </p>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-stone-800 truncate">
                    {item.description ?? "—"}
                  </p>
                  {item.manufacturer && (
                    <p className="text-[11px] text-stone-400 truncate">{item.manufacturer}</p>
                  )}
                </div>
                <span className="text-[11.5px] text-stone-600 truncate">
                  {KIND_LABEL[item.kind] ?? item.kind}
                </span>
                <span className="text-[11.5px] text-stone-600 truncate">
                  {COLOUR_LABEL[item.colour] ?? item.colour}
                </span>
                <span
                  className="text-[11px] text-stone-400 truncate"
                  title={item.compatible_models ?? ""}
                >
                  {item.compatible_models ?? "—"}
                </span>
                <span className="text-[12px] text-stone-700 text-right tabular-nums">
                  {item.rated_yield_pages ? item.rated_yield_pages.toLocaleString() : "—"}
                </span>
                <span className="text-[12px] text-stone-700 text-right tabular-nums">
                  {item.unit_price ? `R ${Number(item.unit_price).toFixed(2)}` : "—"}
                </span>
                <span className="text-[12px] text-stone-600 text-right tabular-nums">
                  {item.reorder_threshold_pct}%
                </span>
                <span className="text-[12px] text-stone-500 text-right tabular-nums">
                  {item.supplier_lead_days}d
                </span>
                <button
                  onClick={() => setModal(item.id)}
                  className="w-7 h-7 rounded flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  <Pencil size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === "add" && (
        <ConsumableTypeModal onClose={() => setModal(null)} />
      )}
      {editingItem && (
        <ConsumableTypeModal existing={editingItem} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
