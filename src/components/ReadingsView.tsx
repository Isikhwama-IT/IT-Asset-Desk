"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { List, Pencil, Trash2, ChevronLeft, ChevronRight, AlertTriangle, DatabaseZap } from "lucide-react";
import {
  Modal, FormField, Input, ModalFooter, BtnPrimary, BtnSecondary,
  ErrorBanner, FormStack,
} from "@/components/modal-ui";
import { deleteMeterReading, updateMeterReading, purgeSnmpReadings } from "@/lib/actions";

export type ReadingRow = {
  id: string;
  printer_id: string;
  printer_name: string;
  reading: number;
  reading_at: string;
  notes: string | null;
  delta: number | null;
};

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditReadingModal({
  row,
  onClose,
}: {
  row: ReadingRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [reading, setReading] = useState(String(row.reading));
  const [date, setDate] = useState(row.reading_at);

  function save() {
    const val = parseInt(reading);
    if (isNaN(val) || val < 0) return setError("Reading must be a positive number.");
    if (!date) return setError("Date is required.");
    startTransition(async () => {
      setError("");
      const res = await updateMeterReading(row.id, val, date);
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title="Edit Meter Reading" subtitle={`${row.printer_name} — ${row.reading_at}`} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}
        <FormField label="Page Count" required>
          <Input
            type="number" min={0}
            value={reading}
            onChange={(e) => { setReading(e.target.value); setError(""); }}
          />
        </FormField>
        <FormField label="Date" required>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(""); }} />
        </FormField>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ── Purge modal ───────────────────────────────────────────────────────────────

function PurgeSnmpModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [beforeDate, setBeforeDate] = useState(today);

  function purge() {
    if (!beforeDate) return setError("Please select a date.");
    startTransition(async () => {
      setError("");
      const res = await purgeSnmpReadings(beforeDate + "T00:00:00.000Z");
      if (res?.error) return setError(res.error);
      setResult(`Deleted ${res.deleted ?? 0} SNMP reading${res.deleted !== 1 ? "s" : ""}.`);
      router.refresh();
    });
  }

  return (
    <Modal title="Purge SNMP Readings" subtitle="Permanently deletes raw SNMP poll records" onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}
        {result ? (
          <div className="text-center py-4">
            <p className="text-[13px] text-emerald-700 font-medium">{result}</p>
            <p className="text-[11.5px] text-stone-400 mt-1">Meter readings and printer status are unaffected.</p>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-[12px] text-amber-800">
              <p className="font-medium mb-1">This permanently deletes raw SNMP poll records.</p>
              <p>Meter readings (page counts) and toner status are stored separately and will not be affected.</p>
            </div>
            <FormField label="Delete all SNMP readings before this date">
              <Input type="date" value={beforeDate} onChange={(e) => { setBeforeDate(e.target.value); setError(""); }} />
            </FormField>
            <ModalFooter>
              <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
              <BtnPrimary onClick={purge} disabled={pending}>
                {pending ? "Deleting…" : "Purge"}
              </BtnPrimary>
            </ModalFooter>
          </>
        )}
        {result && (
          <ModalFooter>
            <BtnSecondary onClick={onClose}>Close</BtnSecondary>
          </ModalFooter>
        )}
      </FormStack>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReadingsView({
  rows,
  totalReadings,
  currentPage,
  perPage,
}: {
  rows: ReadingRow[];
  totalReadings: number;
  currentPage: number;
  perPage: number;
}) {
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const [editRow, setEditRow] = useState<ReadingRow | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalReadings / perPage));

  function pageHref(page: number) {
    return `/printers?view=readings&rpage=${page}`;
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      setDeleteError("");
      const res = await deleteMeterReading(id);
      if (res?.error) setDeleteError(res.error);
      else {
        setConfirmDeleteId(null);
        router.refresh();
      }
    });
  }

  if (rows.length === 0 && currentPage === 1) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 flex flex-col items-center justify-center py-16 text-stone-300">
        <List size={28} className="mb-3" />
        <p className="text-[13px]">No meter readings yet — run a poll to start collecting data</p>
      </div>
    );
  }

  let currentDate = "";

  return (
    <>
      <div className="space-y-3">
        {/* Purge tool */}
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-stone-400">
            {totalReadings.toLocaleString()} reading{totalReadings !== 1 ? "s" : ""} total
            {totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}
          </p>
          <button
            className="flex items-center gap-1.5 text-[11.5px] font-medium text-stone-500 border border-stone-200 px-2.5 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
            onClick={() => setPurgeOpen(true)}
          >
            <DatabaseZap size={11} />
            Purge SNMP Data
          </button>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden fade-up">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between" style={{ background: "#fafaf9" }}>
            <div className="flex items-center gap-2">
              <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>
                Meter Reading Log — All Time
              </p>
            </div>
            <p className="text-[11px] text-stone-400">{rows.length} on this page</p>
          </div>

          <div className="overflow-x-auto">
          <div className="min-w-[560px]">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-5 py-2.5 border-b border-stone-100 bg-stone-50">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400">Date</span>
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400">Printer</span>
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400 text-right">Total Pages</span>
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400 text-right">Printed That Day</span>
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-stone-400 text-right pr-1">Actions</span>
          </div>

          {deleteError && (
            <div className="px-5 py-2 text-[11.5px] text-red-600 bg-red-50 border-b border-red-100">
              {deleteError}
            </div>
          )}

          <div className="divide-y divide-stone-50">
            {rows.map((row, i) => {
              const showDate = row.reading_at !== currentDate;
              if (showDate) currentDate = row.reading_at;
              const date = new Date(row.reading_at + "T00:00:00");
              const formattedDate = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
              const isConfirming = confirmDeleteId === row.id;

              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-5 py-3 items-center ${showDate && i > 0 ? "border-t border-stone-200" : ""}`}
                >
                  <div>
                    {showDate ? (
                      <span className="text-[12.5px] font-medium text-stone-700">{formattedDate}</span>
                    ) : (
                      <span className="text-[11px] text-stone-300">↑ same day</span>
                    )}
                  </div>
                  <span className="text-[12.5px] text-stone-600">{row.printer_name}</span>
                  <span className="text-[12.5px] font-mono text-stone-700 text-right tabular-nums">
                    {row.reading.toLocaleString()}
                  </span>
                  <div className="text-right min-w-[100px]">
                    {row.delta === null ? (
                      <span className="text-[11px] text-stone-300">—</span>
                    ) : row.delta === 0 ? (
                      <span className="text-[11.5px] text-stone-400">—</span>
                    ) : (
                      <span
                        className="text-[12.5px] font-semibold tabular-nums"
                        style={{ color: row.delta > 500 ? "#C04F28" : row.delta > 100 ? "#d97706" : "#415445" }}
                      >
                        +{row.delta.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 pr-1">
                    {isConfirming ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10.5px] text-red-600 mr-1">Delete?</span>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={deleting}
                          className="text-[10.5px] font-medium text-red-600 hover:text-red-800 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10.5px] text-stone-500 hover:text-stone-700 px-1.5 py-0.5 rounded border border-stone-200 hover:bg-stone-50 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditRow(row)}
                          className="p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                          title="Edit reading"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(row.id); setDeleteError(""); }}
                          className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete reading"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 border-t border-stone-100 flex items-center justify-between bg-stone-50">
              <Link
                href={pageHref(currentPage - 1)}
                className={`flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-stone-200 transition-colors ${currentPage <= 1 ? "pointer-events-none opacity-30" : "hover:bg-white text-stone-600"}`}
              >
                <ChevronLeft size={13} /> Previous
              </Link>
              <span className="text-[11.5px] text-stone-400">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={pageHref(currentPage + 1)}
                className={`flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-stone-200 transition-colors ${currentPage >= totalPages ? "pointer-events-none opacity-30" : "hover:bg-white text-stone-600"}`}
              >
                Next <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {editRow && (
        <EditReadingModal row={editRow} onClose={() => setEditRow(null)} />
      )}
      {purgeOpen && (
        <PurgeSnmpModal onClose={() => setPurgeOpen(false)} />
      )}
    </>
  );
}
