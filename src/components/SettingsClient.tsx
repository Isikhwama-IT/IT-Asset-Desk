"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Save } from "lucide-react";
import { SNMP_POLL_ENABLED } from "@/lib/features";
import {
  createLookupItem, updateLookupItem, deleteLookupItem,
  createLocation, updateLocation, deleteLocation,
  updateAppSetting, insertAppSetting,
} from "@/lib/actions";
import type { Category, Status, Department, Location, JobLevel } from "@/types/database";

type LookupTable = "categories" | "statuses" | "departments" | "job_levels";

interface Props {
  categories: Category[];
  statuses: Status[];
  departments: Department[];
  locations: Location[];
  jobLevels: JobLevel[];
  warrantyAlertDays: number;
  snmpAutoPollEnabled: boolean;
}

const TABS = [
  { key: "general",     label: "General" },
  { key: "categories",  label: "Categories" },
  { key: "statuses",    label: "Statuses" },
  { key: "departments", label: "Departments" },
  { key: "locations",   label: "Sites" },
  { key: "job_levels",  label: "Job Levels" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Generic Lookup Tab ───────────────────────────────────────────────────────

function LookupTab({
  items,
  table,
  isLocation = false,
}: {
  items: { id: string; name: string }[];
  table: LookupTable;
  isLocation?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState("");

  async function handleAdd() {
    if (!addName.trim()) { setAddError("Name is required."); return; }
    setAddError("");
    const res = isLocation
      ? await createLocation(addName)
      : await createLookupItem(table, addName);
    if (res?.error) { setAddError(res.error); return; }
    setAddName("");
    setAdding(false);
    startTransition(() => router.refresh());
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) { setRowError({ [id]: "Name is required." }); return; }
    setRowError({});
    const res = isLocation
      ? await updateLocation(id, editName)
      : await updateLookupItem(table, id, editName);
    if (res?.error) { setRowError({ [id]: res.error }); return; }
    setEditId(null);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    const res = isLocation
      ? await deleteLocation(id)
      : await deleteLookupItem(table, id);
    if (res?.error) { setRowError({ [id]: res.error }); setDeleteConfirmId(null); return; }
    setDeleteConfirmId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
      {/* Add row */}
      {adding ? (
        <div className="flex items-center gap-2 mb-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
          <input
            autoFocus
            type="text"
            value={addName}
            onChange={(e) => { setAddName(e.target.value); setAddError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setAddError(""); } }}
            placeholder="Enter name…"
            className="flex-1 px-3 py-1.5 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          <button onClick={handleAdd} className="p-1.5 rounded-lg text-white transition-colors btn-press" style={{ background: "#C04F28" }}>
            <Check size={13} />
          </button>
          <button onClick={() => { setAdding(false); setAddName(""); setAddError(""); }} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors">
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors mb-3 btn-press"
          style={{ background: "#eef3e6", color: "#415445", border: "1px solid #C9D9A0" }}
        >
          <Plus size={13} /> Add item
        </button>
      )}
      {addError && <p className="text-[11.5px] text-red-500 mb-2 -mt-1">{addError}</p>}

      {/* List */}
      <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-50">
        {items.length === 0 && (
          <p className="px-4 py-6 text-[13px] text-stone-400 text-center">No items yet</p>
        )}
        {items.map((item) => (
          <div key={item.id}>
            <div className="flex items-center gap-3 px-4 py-2.5">
              {editId === item.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setRowError({}); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEdit(item.id); if (e.key === "Escape") setEditId(null); }}
                    className="flex-1 px-3 py-1.5 text-[13px] border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <button onClick={() => handleEdit(item.id)} className="p-1.5 rounded-lg text-white transition-colors btn-press" style={{ background: "#C04F28" }}>
                    <Check size={13} />
                  </button>
                  <button onClick={() => { setEditId(null); setRowError({}); }} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13.5px] text-stone-800">{item.name}</span>
                  <button
                    onClick={() => { setEditId(item.id); setEditName(item.name); setDeleteConfirmId(null); setRowError({}); }}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  {deleteConfirmId === item.id ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-150">
                      <span className="text-[11.5px] text-stone-500">Delete?</span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-[11px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setDeleteConfirmId(item.id); setEditId(null); }}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
            {rowError[item.id] && (
              <p className="px-4 pb-2 text-[11.5px] text-red-500">{rowError[item.id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ warrantyAlertDays, snmpAutoPollEnabled }: { warrantyAlertDays: number; snmpAutoPollEnabled: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState(String(warrantyAlertDays));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [snmpEnabled, setSnmpEnabled] = useState(snmpAutoPollEnabled);
  const [snmpSaving, startSnmpSave] = useTransition();

  async function handleSave() {
    const num = parseInt(days, 10);
    if (isNaN(num) || num < 1) { setError("Must be a number greater than 0."); return; }
    setError("");
    setSaving(true);
    const res = await updateAppSetting("warranty_alert_days", String(num));
    setSaving(false);
    if (res?.error) { setError(res.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  function toggleSnmpPoll() {
    const next = !snmpEnabled;
    setSnmpEnabled(next);
    startSnmpSave(async () => {
      await insertAppSetting("snmp_auto_poll_enabled", String(next));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <p className="text-[13px] font-medium text-stone-800 mb-1">Warranty & EOL Alert Threshold</p>
        <p className="text-[12px] text-stone-500 mb-4">
          Show a warning on the dashboard for assets whose warranty or end-of-life date falls within this many days.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-3 py-2 bg-white">
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => { setDays(e.target.value); setError(""); setSaved(false); }}
              className="w-16 text-[13.5px] text-stone-800 focus:outline-none"
            />
            <span className="text-[12px] text-stone-400">days</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-medium text-white rounded-lg transition-colors disabled:opacity-50 btn-press"
            style={{ background: "#C04F28" }}
          >
            {saving ? (
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : saved ? (
              <Check size={13} />
            ) : (
              <Save size={13} />
            )}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        {error && <p className="text-[11.5px] text-red-500 mt-2">{error}</p>}
      </div>

      {SNMP_POLL_ENABLED && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-stone-800 mb-0.5">Automatic SNMP Polling</p>
              <p className="text-[12px] text-stone-500">
                Controls whether the background poll daemon runs automatically on its schedule.
                Manual polling via the &ldquo;Poll All&rdquo; button is always available.
              </p>
            </div>
            <button
              onClick={toggleSnmpPoll}
              disabled={snmpSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-4 disabled:opacity-50 ${snmpEnabled ? "bg-emerald-500" : "bg-stone-200"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${snmpEnabled ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
          {!snmpEnabled && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
              Auto-polling is off. The daemon checks this setting each cycle — if you run it via Windows Task Scheduler, it will also respect this toggle. Manual polling still works.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsClient({
  categories, statuses, departments, locations, jobLevels, warrantyAlertDays, snmpAutoPollEnabled,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  return (
    <div className="fade-up">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-stone-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-[13px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
            style={{
              borderBottomColor: activeTab === tab.key ? "#C04F28" : "transparent",
              color: activeTab === tab.key ? "#C04F28" : undefined,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "general" && <GeneralTab warrantyAlertDays={warrantyAlertDays} snmpAutoPollEnabled={snmpAutoPollEnabled} />}
      {activeTab === "categories" && <LookupTab items={categories} table="categories" />}
      {activeTab === "statuses" && <LookupTab items={statuses} table="statuses" />}
      {activeTab === "departments" && <LookupTab items={departments} table="departments" />}
      {activeTab === "locations" && <LookupTab items={locations} table="categories" isLocation />}
      {activeTab === "job_levels" && <LookupTab items={jobLevels} table="job_levels" />}
    </div>
  );
}
