"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Plus, UserCheck, UserX, X } from "lucide-react";
import {
  addTaskFollowUp,
  addTaskUpdate,
  toggleFollowUpDone,
  updateTaskField,
  updateTaskStatus,
} from "@/lib/actions";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_SOURCES,
  TASK_STATUSES,
  formatTaskCode,
  getTaskPriorityConfig,
  getTaskStatusConfig,
} from "@/lib/tasks";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { TaskFollowUp, TaskUpdate, TaskWithActivity } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FollowUpWithPerson extends TaskFollowUp {
  contact: { id: string; full_name: string } | null;
  external_contact: { id: string; name: string; company: string | null } | null;
}

interface PersonResult {
  type: "internal" | "external";
  id: string;
  name: string;
  sub: string | null;
}

interface Props {
  task: TaskWithActivity | null;
  onClose: () => void;
  onUpdated: () => void;
}

const REASON_REQUIRED = new Set(["Re-Routed", "Standby", "Neutralized", "Retired"]);

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── Panel ────────────────────────────────────────────────────────────────────

export function TaskPanel({ task, onClose, onUpdated }: Props) {
  const [mounted, setMounted] = useState(false);
  const open = task !== null;

  // ── Field state ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(task?.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string>(task?.status ?? "Intel");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [priority, setPriority] = useState<string>(task?.priority ?? "Standard");
  const [category, setCategory] = useState(task?.category ?? "");
  const [source, setSource] = useState(task?.source ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");

  // ── Thread state ───────────────────────────────────────────────────────────
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateBody, setUpdateBody] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // ── Follow-up state ────────────────────────────────────────────────────────
  const [followUps, setFollowUps] = useState<FollowUpWithPerson[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [addingFollowUp, setAddingFollowUp] = useState(false);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Reset + fetch when task changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatus(task.status);
    setPriority(task.priority);
    setCategory(task.category ?? "");
    setSource(task.source ?? "");
    setDueDate(task.due_date ?? "");
    setPendingStatus(null);
    setStatusReason("");
    setEditingTitle(false);
    setUpdateBody("");
    setUpdates([]);
    setFollowUps([]);
    fetchThread(task.id);
    fetchFollowUps(task.id);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [updates]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  async function fetchThread(taskId: string) {
    setUpdatesLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("task_updates")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at");
    setUpdates((data ?? []) as TaskUpdate[]);
    setUpdatesLoading(false);
  }

  async function fetchFollowUps(taskId: string) {
    setFollowUpsLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("task_follow_ups")
      .select("*, contact:contacts(id, full_name), external_contact:external_contacts(id, name, company)")
      .eq("task_id", taskId)
      .order("due_date");
    setFollowUps((data ?? []) as FollowUpWithPerson[]);
    setFollowUpsLoading(false);
  }

  // ── Save handlers ──────────────────────────────────────────────────────────
  async function saveTitle() {
    if (!task || title.trim() === task.title) return;
    await updateTaskField(task.id, "title", title.trim() || task.title);
    onUpdated();
  }

  async function handleStatusChange(newStatus: string) {
    if (!task || newStatus === status) return;
    if (REASON_REQUIRED.has(newStatus)) {
      setPendingStatus(newStatus);
      setStatusReason("");
      return;
    }
    setSavingStatus(true);
    setStatus(newStatus);
    await updateTaskStatus(task.id, newStatus, null);
    setSavingStatus(false);
    onUpdated();
  }

  async function confirmStatusWithReason() {
    if (!task || !pendingStatus || !statusReason.trim()) return;
    setSavingStatus(true);
    setStatus(pendingStatus);
    await updateTaskStatus(task.id, pendingStatus, statusReason.trim());
    setPendingStatus(null);
    setStatusReason("");
    setSavingStatus(false);
    onUpdated();
  }

  async function saveField(field: "priority" | "category" | "source" | "due_date", value: string) {
    if (!task) return;
    await updateTaskField(task.id, field, value || null);
    onUpdated();
  }

  // ── Update thread ──────────────────────────────────────────────────────────
  async function postUpdate() {
    if (!task || !updateBody.trim()) return;
    setPostingUpdate(true);
    const { update } = await addTaskUpdate(task.id, updateBody);
    if (update) {
      setUpdates((prev) => [...prev, update as TaskUpdate]);
      setUpdateBody("");
    }
    setPostingUpdate(false);
    onUpdated();
  }

  // ── Follow-ups ─────────────────────────────────────────────────────────────
  async function submitFollowUp() {
    if (!task || !followUpDate) return;
    setAddingFollowUp(true);
    await addTaskFollowUp(task.id, {
      contact_id: selectedPerson?.type === "internal" ? selectedPerson.id : null,
      external_contact_id: selectedPerson?.type === "external" ? selectedPerson.id : null,
      due_date: followUpDate,
      note: followUpNote.trim() || null,
    });
    setSelectedPerson(null);
    setFollowUpDate("");
    setFollowUpNote("");
    setAddingFollowUp(false);
    fetchFollowUps(task.id);
    onUpdated();
  }

  async function handleToggleDone(id: string, current: boolean) {
    await toggleFollowUpDone(id, !current);
    setFollowUps((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_done: !current } : f))
    );
    onUpdated();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!mounted) return null;

  const today = new Date().toISOString().slice(0, 10);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[9998] bg-stone-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 h-screen z-[9999] w-[760px] max-w-[calc(100vw-4rem)] bg-white shadow-2xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-3.5 border-b border-stone-100 flex-shrink-0"
            >
              <span className="text-[11px] font-mono text-stone-400 tracking-wider">
                {task ? formatTaskCode(task.task_code) : ""}
              </span>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-stone-100 transition-colors"
              >
                <X size={14} className="text-stone-500" />
              </button>
            </div>

            {/* Body */}
            {task && (
              <div className="flex flex-1 min-h-0">
                {/* ── Left column ─────────────────────────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col overflow-y-auto px-6 py-5 gap-6">
                  {/* Title */}
                  <div>
                    {editingTitle ? (
                      <input
                        ref={titleRef}
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => { setEditingTitle(false); saveTitle(); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { setEditingTitle(false); saveTitle(); } if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false); } }}
                        className="w-full text-[18px] font-semibold text-stone-800 border-b-2 border-stone-300 focus:border-stone-500 outline-none pb-1 bg-transparent"
                        style={{ letterSpacing: "-0.02em" }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingTitle(true)}
                        className="w-full text-left text-[18px] font-semibold text-stone-800 hover:text-stone-600 transition-colors cursor-text"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        {title}
                      </button>
                    )}
                  </div>

                  {/* Updates thread */}
                  <div>
                    <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-3">
                      Updates
                    </p>

                    {updatesLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 size={16} className="text-stone-300 animate-spin" />
                      </div>
                    ) : updates.length === 0 ? (
                      <p className="text-[12.5px] text-stone-400 italic py-4">No updates yet</p>
                    ) : (
                      <div className="space-y-3 mb-4">
                        {updates.map((u) => (
                          <div key={u.id} className="bg-stone-50 rounded-xl px-4 py-3">
                            <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap">{u.body}</p>
                            <p className="text-[11px] text-stone-400 mt-1.5">
                              {new Date(u.created_at).toLocaleDateString("en-ZA", {
                                day: "numeric", month: "short", year: "numeric",
                              })}{" "}
                              at{" "}
                              {new Date(u.created_at).toLocaleTimeString("en-ZA", {
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>
                        ))}
                        <div ref={threadEndRef} />
                      </div>
                    )}

                    {/* Post input */}
                    <div className="flex gap-2">
                      <textarea
                        value={updateBody}
                        onChange={(e) => setUpdateBody(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postUpdate(); }}
                        placeholder="Add an update..."
                        rows={2}
                        className="flex-1 px-3 py-2 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300 resize-none"
                      />
                      <button
                        onClick={postUpdate}
                        disabled={!updateBody.trim() || postingUpdate}
                        className="flex-shrink-0 px-3 py-2 text-[12.5px] font-medium text-white rounded-lg transition-colors disabled:opacity-40 self-end"
                        style={{ background: "#C04F28" }}
                      >
                        {postingUpdate ? <Loader2 size={14} className="animate-spin" /> : "Post"}
                      </button>
                    </div>
                  </div>

                  {/* Follow-ups */}
                  <div>
                    <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-3">
                      Follow-ups
                    </p>

                    {/* Add form */}
                    <div className="bg-stone-50 rounded-xl p-4 mb-4 space-y-3">
                      <PersonSearch
                        selected={selectedPerson}
                        onSelect={setSelectedPerson}
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="date"
                            value={followUpDate}
                            onChange={(e) => setFollowUpDate(e.target.value)}
                            className="w-full px-3 py-2 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Note (optional)"
                            value={followUpNote}
                            onChange={(e) => setFollowUpNote(e.target.value)}
                            className="w-full px-3 py-2 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
                          />
                        </div>
                        <button
                          onClick={submitFollowUp}
                          disabled={!followUpDate || addingFollowUp}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white rounded-lg transition-colors disabled:opacity-40"
                          style={{ background: "#415445" }}
                        >
                          {addingFollowUp ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Follow-up list */}
                    {followUpsLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={16} className="text-stone-300 animate-spin" />
                      </div>
                    ) : followUps.length === 0 ? (
                      <p className="text-[12.5px] text-stone-400 italic">No follow-ups yet</p>
                    ) : (
                      <div className="space-y-2">
                        {followUps.map((f) => {
                          const personName = f.contact?.full_name ?? f.external_contact?.name ?? "Unknown";
                          const isOverdue = !f.is_done && f.due_date < today;
                          const isToday = f.due_date === today;
                          return (
                            <div
                              key={f.id}
                              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                                f.is_done
                                  ? "border-stone-100 bg-white opacity-50"
                                  : isOverdue
                                  ? "border-red-100 bg-red-50"
                                  : isToday
                                  ? "border-amber-100 bg-amber-50"
                                  : "border-stone-100 bg-white"
                              }`}
                            >
                              <button
                                onClick={() => handleToggleDone(f.id, f.is_done)}
                                className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                  f.is_done
                                    ? "bg-stone-800 border-stone-800"
                                    : "border-stone-300 hover:border-stone-500"
                                }`}
                              >
                                {f.is_done && <Check size={10} className="text-white" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[13px] font-medium ${f.is_done ? "line-through text-stone-400" : isOverdue ? "text-red-700" : "text-stone-700"}`}>
                                    {personName}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    f.contact
                                      ? "bg-stone-100 text-stone-500"
                                      : "bg-sky-50 text-sky-600"
                                  }`}>
                                    {f.contact ? "Internal" : "External"}
                                  </span>
                                  <span className={`text-[11px] ml-auto ${isOverdue ? "text-red-500" : isToday ? "text-amber-600" : "text-stone-400"}`}>
                                    {new Date(f.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                                  </span>
                                </div>
                                {f.note && (
                                  <p className={`text-[12px] mt-0.5 ${f.is_done ? "text-stone-400" : "text-stone-500"}`}>{f.note}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Right column ─────────────────────────────────────── */}
                <div className="w-56 flex-shrink-0 border-l border-stone-100 px-4 py-5 space-y-5 overflow-y-auto">
                  {/* Status */}
                  <FieldRow label="Status">
                    <div className="relative">
                      <select
                        value={pendingStatus ?? status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={savingStatus}
                        className="w-full px-3 py-1.5 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-300 disabled:opacity-60 appearance-none pr-7"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {savingStatus && (
                        <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-stone-400" />
                      )}
                    </div>
                    {/* Status dot preview */}
                    {(() => {
                      const cfg = getTaskStatusConfig(pendingStatus ?? status);
                      return (
                        <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
                          <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                          {pendingStatus ?? status}
                        </div>
                      );
                    })()}

                    {/* Inline reason prompt */}
                    {pendingStatus && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-lg space-y-2">
                        <p className="text-[11px] text-amber-700 font-medium">
                          Reason required for "{pendingStatus}"
                        </p>
                        <textarea
                          autoFocus
                          value={statusReason}
                          onChange={(e) => setStatusReason(e.target.value)}
                          placeholder="Enter reason..."
                          rows={2}
                          className="w-full px-2 py-1.5 text-[12px] text-stone-800 border border-amber-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={confirmStatusWithReason}
                            disabled={!statusReason.trim()}
                            className="flex-1 py-1 text-[11.5px] font-medium text-white rounded-md transition-colors disabled:opacity-40"
                            style={{ background: "#C04F28" }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setPendingStatus(null); setStatusReason(""); }}
                            className="flex-1 py-1 text-[11.5px] font-medium text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </FieldRow>

                  {/* Priority */}
                  <FieldRow label="Priority">
                    <select
                      value={priority}
                      onChange={(e) => { setPriority(e.target.value); saveField("priority", e.target.value); }}
                      className="w-full px-3 py-1.5 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
                    >
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {(() => {
                      const cfg = getTaskPriorityConfig(priority);
                      return (
                        <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
                          <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                          {priority}
                        </div>
                      );
                    })()}
                  </FieldRow>

                  {/* Category */}
                  <FieldRow label="Category">
                    <select
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); saveField("category", e.target.value); }}
                      className="w-full px-3 py-1.5 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
                    >
                      <option value="">— None —</option>
                      {TASK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </FieldRow>

                  {/* Source */}
                  <FieldRow label="Source">
                    <select
                      value={source}
                      onChange={(e) => { setSource(e.target.value); saveField("source", e.target.value); }}
                      className="w-full px-3 py-1.5 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
                    >
                      <option value="">— None —</option>
                      {TASK_SOURCES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </FieldRow>

                  {/* Due date */}
                  <FieldRow label="Due Date">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => { setDueDate(e.target.value); saveField("due_date", e.target.value); }}
                      className="w-full px-3 py-1.5 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
                    />
                  </FieldRow>

                  <div className="border-t border-stone-100 pt-4 space-y-3">
                    {/* Created at */}
                    <FieldRow label="Created">
                      <p className="text-[12px] text-stone-500">
                        {new Date(task.created_at).toLocaleDateString("en-ZA", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </FieldRow>

                    {/* In current status since */}
                    <FieldRow label="In current status since">
                      <p className="text-[12px] text-stone-500">
                        {new Date(task.status_changed_at).toLocaleDateString("en-ZA", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                      {task.status_reason && (
                        <p className="text-[11px] text-stone-400 mt-1 italic">"{task.status_reason}"</p>
                      )}
                    </FieldRow>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function PersonSearch({
  selected,
  onSelect,
}: {
  selected: PersonResult | null;
  onSelect: (p: PersonResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function search(q: string) {
    if (!q.trim()) { setResults([]); return; }
    const supabase = createSupabaseBrowserClient();
    const [{ data: contacts }, { data: external }] = await Promise.all([
      supabase.from("contacts").select("id, full_name, department_id").ilike("full_name", `%${q}%`).eq("is_active", true).limit(8),
      supabase.from("external_contacts").select("id, name, company").ilike("name", `%${q}%`).limit(8),
    ]);
    setResults([
      ...(contacts ?? []).map((c) => ({ type: "internal" as const, id: c.id, name: c.full_name, sub: null })),
      ...(external ?? []).map((e) => ({ type: "external" as const, id: e.id, name: e.name, sub: e.company })),
    ]);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 250);
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-lg bg-white">
        {selected.type === "internal"
          ? <UserCheck size={13} className="text-stone-400 flex-shrink-0" />
          : <UserX size={13} className="text-sky-400 flex-shrink-0" />
        }
        <span className="text-[13px] text-stone-800 flex-1 truncate">{selected.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
          selected.type === "internal" ? "bg-stone-100 text-stone-500" : "bg-sky-50 text-sky-600"
        }`}>
          {selected.type === "internal" ? "Internal" : "External"}
        </span>
        <button onClick={() => onSelect(null)} className="flex-shrink-0 hover:text-stone-700 text-stone-400 transition-colors">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Search contacts..."
        value={query}
        onChange={handleChange}
        onFocus={() => query && setOpen(true)}
        className="w-full px-3 py-2 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-30 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 max-h-52 overflow-y-auto">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => { onSelect(r); setQuery(""); setOpen(false); setResults([]); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 text-left transition-colors"
            >
              {r.type === "internal"
                ? <UserCheck size={13} className="text-stone-400 flex-shrink-0" />
                : <UserX size={13} className="text-sky-400 flex-shrink-0" />
              }
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-stone-800 truncate">{r.name}</span>
                {r.sub && <span className="block text-[11px] text-stone-400 truncate">{r.sub}</span>}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                r.type === "internal" ? "bg-stone-100 text-stone-500" : "bg-sky-50 text-sky-600"
              }`}>
                {r.type === "internal" ? "Internal" : "External"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
