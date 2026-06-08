"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { upsertConsumableType, deleteConsumableType } from "@/lib/actions";

type LegacyConsumableType = {
  id: string;
  colour: string;
  kind: string;
  description: string | null;
  rated_yield_pages: number | null;
  unit_price: number | null;
  supplier_lead_days: number;
};

const COLOURS = ["black", "cyan", "magenta", "yellow", "other"] as const;
const KINDS = ["toner", "developer", "drum", "fuser", "waste_box", "maintenance_kit", "other"] as const;

const COLOUR_LABELS: Record<string, string> = {
  black: "Black", cyan: "Cyan", magenta: "Magenta", yellow: "Yellow", other: "Other / N/A",
};
const KIND_LABELS: Record<string, string> = {
  toner: "Toner", developer: "Developer", drum: "Drum", fuser: "Fuser",
  waste_box: "Waste Box", maintenance_kit: "Maintenance Kit", other: "Other",
};

type FormState = {
  colour: string;
  kind: string;
  description: string;
  rated_yield_pages: string;
  unit_price: string;
  supplier_lead_days: string;
};

const emptyForm = (): FormState => ({
  colour: "black", kind: "toner", description: "",
  rated_yield_pages: "", unit_price: "", supplier_lead_days: "5",
});

function InlineForm({
  printerId,
  initial,
  onDone,
}: {
  printerId: string;
  initial?: LegacyConsumableType;
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          colour: initial.colour,
          kind: initial.kind,
          description: initial.description ?? "",
          rated_yield_pages: initial.rated_yield_pages?.toString() ?? "",
          unit_price: initial.unit_price?.toString() ?? "",
          supplier_lead_days: initial.supplier_lead_days.toString(),
        }
      : emptyForm()
  );
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    startTransition(async () => {
      setErr("");
      const res = await upsertConsumableType({
        id: initial?.id,
        printer_id: printerId,
        colour: form.colour,
        kind: form.kind,
        description: form.description || null,
        rated_yield_pages: form.rated_yield_pages ? Number(form.rated_yield_pages) : null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        supplier_lead_days: form.supplier_lead_days ? Number(form.supplier_lead_days) : 5,
      });
      if (res?.error) setErr(res.error);
      else onDone();
    });
  }

  const inp = "text-[12px] border border-stone-200 rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-stone-300 bg-white";
  const sel = inp + " appearance-none";

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 mb-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Colour</p>
          <select className={sel} value={form.colour} onChange={(e) => set("colour", e.target.value)}>
            {COLOURS.map((c) => <option key={c} value={c}>{COLOUR_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Kind</p>
          <select className={sel} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-2">
        <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Description (optional)</p>
        <input className={inp} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. TN-321K Black" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Rated Yield (pages)</p>
          <input className={inp} type="number" min={0} value={form.rated_yield_pages} onChange={(e) => set("rated_yield_pages", e.target.value)} placeholder="e.g. 6000" />
        </div>
        <div>
          <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Unit Price (R)</p>
          <input className={inp} type="number" min={0} step="0.01" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} placeholder="e.g. 850.00" />
        </div>
        <div>
          <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Lead Days</p>
          <input className={inp} type="number" min={1} value={form.supplier_lead_days} onChange={(e) => set("supplier_lead_days", e.target.value)} placeholder="5" />
        </div>
      </div>
      {err && <p className="text-[11px] text-red-500 mb-2">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50 transition-colors"
          style={{ background: "#415445" }}
        >
          <Check size={12} /> Save
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-stone-500 border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          <X size={12} /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function ConsumableTypesManager({
  printerId,
  initial,
}: {
  printerId: string;
  initial: LegacyConsumableType[];
}) {
  const [items, setItems] = useState<LegacyConsumableType[]>(initial);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteConsumableType(id, printerId);
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  return (
    <div>
      {items.length === 0 && !adding && (
        <p className="text-[12px] text-stone-400 py-3 text-center">
          No consumable types configured — add entries to enable cost and run-out predictions.
        </p>
      )}

      {items.length > 0 && (
        <div className="divide-y divide-stone-50 mb-3">
          {items.map((item) =>
            editingId === item.id ? (
              <div key={item.id} className="py-2">
                <InlineForm
                  printerId={printerId}
                  initial={item}
                  onDone={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div key={item.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-medium text-stone-700">
                      {COLOUR_LABELS[item.colour] ?? item.colour} · {KIND_LABELS[item.kind] ?? item.kind}
                    </span>
                    {item.description && <span className="text-[11px] text-stone-400">{item.description}</span>}
                  </div>
                  <div className="flex gap-3 text-[11px] text-stone-500 mt-0.5">
                    {item.rated_yield_pages && <span>{item.rated_yield_pages.toLocaleString()} pages</span>}
                    {item.unit_price && <span>R {Number(item.unit_price).toFixed(2)}</span>}
                    {item.rated_yield_pages && item.unit_price && (
                      <span className="text-stone-400">
                        R {(Number(item.unit_price) / item.rated_yield_pages).toFixed(4)}/page
                      </span>
                    )}
                    <span className="text-stone-400">{item.supplier_lead_days}d lead</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditingId(item.id)}
                    className="text-[11px] text-stone-400 hover:text-stone-600 px-2 py-1 rounded hover:bg-stone-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={pending}
                    className="w-6 h-6 rounded flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {adding ? (
        <InlineForm printerId={printerId} onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 hover:border-stone-300 transition-colors"
        >
          <Plus size={12} /> Add consumable type
        </button>
      )}
    </div>
  );
}
