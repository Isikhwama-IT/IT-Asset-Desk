"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useTransition, useState, useRef, useEffect } from "react";
import {
  Search,
  ArrowUpRight,
  SlidersHorizontal,
  X,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { getStatusConfig, getCategoryIcon } from "@/lib/utils";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { AddAssetModal } from "@/components/AssetModals";
import { useAuth } from "@/context/AuthContext";
import { bulkChangeAssetStatus, getAllAssetsForExport } from "@/lib/actions";
import type {
  AssetWithRelations,
  Status,
  Category,
  Department,
  Location,
  JobLevel,
  Contact,
} from "@/types/database";

interface Props {
  assets: AssetWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  statuses: Status[];
  categories: Category[];
  departments: Department[];
  locations: Location[];
  jobLevels: JobLevel[];
  contacts: Contact[];
}

export default function AssetsClientFilters({
  assets,
  total,
  page,
  pageSize,
  statuses,
  categories,
  departments,
  locations,
  jobLevels,
  contacts,
}: Props) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  // ── Bulk select ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const allSelected = assets.length > 0 && assets.every((a) => selectedIds.has(a.id));
  const someSelected = assets.some((a) => selectedIds.has(a.id));

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(assets.map((a) => a.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStatus(newStatusId: string) {
    setBulkLoading(true);
    setShowBulkStatus(false);
    await bulkChangeAssetStatus(Array.from(selectedIds), newStatusId);
    setBulkLoading(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  // ── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      startTransition(() => router.push(`/assets?${params.toString()}`));
    },
    [router, searchParams]
  );

  const q = searchParams.get("q") ?? "";
  const filterStatuses = new Set(searchParams.get("status")?.split(",").filter(Boolean) ?? []);
  const filterCategories = new Set(searchParams.get("cat")?.split(",").filter(Boolean) ?? []);
  const filterDepts = new Set(searchParams.get("dept")?.split(",").filter(Boolean) ?? []);
  const hasFilters = q || filterStatuses.size > 0 || filterCategories.size > 0 || filterDepts.size > 0;

  function toggleFilter(param: string, id: string, current: Set<string>) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateParams({ [param]: next.size > 0 ? [...next].join(",") : undefined, page: undefined });
  }

  // ── CSV export ───────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  function buildAndDownloadCSV(rows: { code: string; description: string; category: string; serial: string; status: string; department: string; assignedTo: string; location: string; purchaseDate: string }[]) {
    const headers = ["Code", "Description", "Category", "Serial", "Status", "Department", "Assigned To", "Location", "Purchase Date"];
    const data = rows.map((r) => [
      r.code,
      `"${r.description.replace(/"/g, '""')}"`,
      r.category,
      r.serial,
      r.status,
      r.department,
      r.assignedTo,
      r.location,
      r.purchaseDate,
    ]);
    const csv = [headers, ...data].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assets-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export current page selection (no server round-trip needed)
  function exportSelected(ids: Set<string>) {
    const rows = assets.filter((a) => ids.has(a.id)).map((a) => ({
      code: String(a.asset_code ?? ""),
      description: a.description ?? "",
      category: a.category?.name ?? "",
      serial: a.serial_number ?? "",
      status: a.status?.name ?? "",
      department: a.owning_department?.name ?? "",
      assignedTo: a.assigned_to_contact?.full_name ?? "",
      location: a.location?.name ?? "",
      purchaseDate: a.purchase_date ?? "",
    }));
    buildAndDownloadCSV(rows);
  }

  // Full export — fetches all matching assets from server
  async function exportAll() {
    setExporting(true);
    const res = await getAllAssetsForExport({
      q: q || undefined,
      status: filterStatuses.size > 0 ? [...filterStatuses].join(",") : undefined,
      cat: filterCategories.size > 0 ? [...filterCategories].join(",") : undefined,
      dept: filterDepts.size > 0 ? [...filterDepts].join(",") : undefined,
    });
    setExporting(false);
    if (res.error || !res.data) return;
    buildAndDownloadCSV(res.data);
  }

  const GRID = "grid-cols-[1.5rem_2.5rem_1fr_7rem_9rem_8rem_8rem_2rem]";

  function FilterDropdown({
    label,
    options,
    selectedIds,
    onToggle,
    renderOption,
  }: {
    label: string;
    options: { id: string; name: string }[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    renderOption?: (opt: { id: string; name: string }) => React.ReactNode;
  }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      function handler(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      }
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);
    const count = selectedIds.size;
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-[12.5px] border rounded-lg px-2.5 py-2 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-stone-300 ${
            count > 0
              ? "border-stone-400 text-stone-800"
              : "border-stone-200 text-stone-600 hover:border-stone-300"
          }`}
        >
          {label}
          {count > 0 && (
            <span className="bg-stone-900 text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {count}
            </span>
          )}
          <ChevronDown size={11} className={`text-stone-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 min-w-[190px]">
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(opt.id)}
                  onChange={() => onToggle(opt.id)}
                  className="w-3.5 h-3.5 rounded border-stone-300 accent-stone-800 flex-shrink-0"
                />
                {renderOption ? renderOption(opt) : (
                  <span className="text-[13px] text-stone-700">{opt.name}</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className={`flex items-center gap-3 mb-5 flex-wrap transition-opacity ${isPending ? "opacity-60" : ""}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search assets…"
            defaultValue={q}
            onChange={(e) => updateParams({ q: e.target.value || undefined, page: undefined })}
            className="w-full pl-8 pr-3 py-2 text-[13px] border border-stone-200 rounded-lg bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:border-stone-300"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal size={13} className="text-stone-400" />
          <FilterDropdown
            label="Status"
            options={statuses}
            selectedIds={filterStatuses}
            onToggle={(id) => toggleFilter("status", id, filterStatuses)}
            renderOption={(opt) => {
              const cfg = getStatusConfig(opt.name);
              return (
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-[13px] text-stone-700">{opt.name}</span>
                </span>
              );
            }}
          />
          <FilterDropdown
            label="Category"
            options={categories}
            selectedIds={filterCategories}
            onToggle={(id) => toggleFilter("cat", id, filterCategories)}
          />
          <FilterDropdown
            label="Department"
            options={departments}
            selectedIds={filterDepts}
            onToggle={(id) => toggleFilter("dept", id, filterDepts)}
          />
          {hasFilters && (
            <button
              onClick={() => updateParams({ q: undefined, status: undefined, cat: undefined, dept: undefined, page: undefined })}
              className="flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        <span className="text-[12px] text-stone-400">
          {total === 0 ? "0" : `${start}–${end} of ${total}`}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={exportAll}
            disabled={exporting}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-500 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            <Download size={13} /> {exporting ? "Exporting…" : `Export all ${total}`}
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-stone-900 px-3 py-2 rounded-lg hover:bg-stone-700 transition-colors"
            >
              <Plus size={13} /> Add Asset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className={`grid ${GRID} gap-3 px-4 py-2.5 bg-stone-50 border-b border-stone-100`}>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleAll}
              className="w-3.5 h-3.5 rounded border-stone-300 accent-stone-800 cursor-pointer"
            />
          </div>
          {["#", "Description", "Serial Number", "Department", "Assigned To", "Status", ""].map((h) => (
            <span key={h} className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <motion.div
          className="divide-y divide-stone-50"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          key={assets.map(a => a.id).join(",")}
        >
          {assets.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-[13px]">
              No assets match your filters
            </div>
          ) : (
            assets.map((asset) => {
              const cfg = getStatusConfig(asset.status?.name);
              const isSelected = selectedIds.has(asset.id);
              return (
                <motion.div
                  key={asset.id}
                  variants={staggerItem}
                  onClick={() => router.push(`/assets/${asset.id}`)}
                  className={`grid ${GRID} gap-3 px-4 py-3 items-center asset-row group cursor-pointer hover:bg-stone-50 transition-colors ${isSelected ? "bg-stone-50" : ""}`}
                >
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(asset.id)}
                      className="w-3.5 h-3.5 rounded border-stone-300 accent-stone-800 cursor-pointer"
                    />
                  </div>
                  <span className="text-[12px] font-mono text-stone-400 font-medium">
                    {asset.asset_code}
                  </span>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm flex-shrink-0">{getCategoryIcon(asset.category?.name)}</span>
                    <span className="text-[13px] text-stone-800 truncate leading-snug">{asset.description}</span>
                  </div>
                  <span className="text-[12px] text-stone-500 truncate">{asset.serial_number}</span>
                  <span className="text-[12px] text-stone-500 truncate">{asset.owning_department?.name ?? "—"}</span>
                  <span className="text-[12px] text-stone-600 truncate">{asset.assigned_to_contact?.full_name ?? "—"}</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${cfg.bg} ${cfg.color}`}>
                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    {asset.status?.name ?? "—"}
                  </span>
                  <ArrowUpRight size={13} className="text-stone-200 group-hover:text-stone-400 justify-self-end" />
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px] text-stone-400">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateParams({ page: String(page - 1) })}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-[12.5px] text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              onClick={() => updateParams({ page: String(page + 1) })}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-[12.5px] text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 z-50 flex items-center gap-3 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-2xl"
          style={{ left: "calc(50% + 110px)", transform: "translateX(-50%)" }}
        >
          <span className="text-[13px] font-medium tabular-nums">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-4 bg-stone-700" />

          {/* Change Status */}
          <div className="relative">
            <button
              onClick={() => setShowBulkStatus((v) => !v)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Change Status <ChevronDown size={12} />
            </button>
            {showBulkStatus && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-stone-200 rounded-xl shadow-xl p-1.5 min-w-[180px]">
                {statuses.map((s) => {
                  const cfg = getStatusConfig(s.name);
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleBulkStatus(s.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-stone-50 text-left transition-colors"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-[13px] text-stone-700">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export selected */}
          <button
            onClick={() => exportSelected(selectedIds)}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <Download size={13} /> Export selected
          </button>

          {/* Clear */}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-400 hover:text-white transition-colors"
          >
            <X size={13} /> Clear
          </button>

          {bulkLoading && (
            <svg className="animate-spin h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      )}

      {/* Add Asset Modal */}
      {showAdd && (
        <AddAssetModal
          onClose={() => setShowAdd(false)}
          lookups={{ categories, statuses, departments, locations, jobLevels, contacts }}
        />
      )}
    </>
  );
}
