"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, GitBranch, Loader2, MapPin, Plus, Search, Trash2, UserCheck, UserX, X } from "lucide-react";
import {
  addTaskChecklistItem,
  addTaskDependency,
  addTaskFollowUp,
  addTaskUpdate,
  deleteTaskChecklistItem,
  deleteTaskDependency,
  deleteTask,
  snoozeTaskFollowUp,
  toggleFollowUpDone,
  toggleTaskChecklistItem,
  updateTaskField,
  updateTaskStatus,
} from "@/lib/actions";
import { useToast } from "@/components/Toast";
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
import type { TaskChecklistItem, TaskDependency, TaskFollowUp, TaskUpdate, TaskWithActivity } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FollowUpWithPerson extends TaskFollowUp {
  contact: { id: string; full_name: string } | null;
  external_contact: { id: string; name: string; company: string | null } | null;
}

interface DependencyTask {
  id: string;
  task_code: number;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  archived_at?: string | null;
}

interface DependencyWithTask extends TaskDependency {
  depends_on_task: DependencyTask | null;
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
const CLOSED_TASK_STATUSES = new Set(["Neutralized", "Retired"]);

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

function datePlusDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function TaskPanel({ task, onClose, onUpdated }: Props) {
  const { success } = useToast();
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
  const [locationId, setLocationId] = useState(task?.location_id ?? "");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

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

  // Checklist state
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState("");

  // Dependency / blocker state
  const [dependencies, setDependencies] = useState<DependencyWithTask[]>([]);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [dependencyQuery, setDependencyQuery] = useState("");
  const [dependencyResults, setDependencyResults] = useState<DependencyTask[]>([]);
  const [dependencySearchOpen, setDependencySearchOpen] = useState(false);
  const [addingDependencyId, setAddingDependencyId] = useState<string | null>(null);
  const [removingDependencyId, setRemovingDependencyId] = useState<string | null>(null);
  const [dependencyError, setDependencyError] = useState("");
  const dependencyDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [snoozingFollowUpId, setSnoozingFollowUpId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const supabase = createSupabaseBrowserClient();
    supabase.from("locations").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => { if (data) setLocations(data as { id: string; name: string }[]); });
  }, []);

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
    setLocationId(task.location_id ?? "");
    setPendingStatus(null);
    setStatusReason("");
    setEditingTitle(false);
    setUpdateBody("");
    setUpdates([]);
    setFollowUps([]);
    setChecklist([]);
    setDependencies([]);
    setNewChecklistItem("");
    setChecklistError("");
    setDependencyQuery("");
    setDependencyResults([]);
    setDependencySearchOpen(false);
    setDependencyError("");
    setSnoozingFollowUpId(null);
    setConfirmingDelete(false);
    setDeletingTask(false);
    setDeleteError("");
    fetchThread(task.id);
    fetchFollowUps(task.id);
    fetchChecklist(task.id);
    fetchDependencies(task.id);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [updates]);

  useEffect(() => {
    return () => clearTimeout(dependencyDebounceRef.current);
  }, []);

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

  async function fetchChecklist(taskId: string) {
    setChecklistLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("task_checklist_items")
      .select("*")
      .eq("task_id", taskId)
      .order("sort_order")
      .order("created_at");
    setChecklist((data ?? []) as TaskChecklistItem[]);
    setChecklistLoading(false);
  }

  async function fetchDependencies(taskId: string) {
    setDependenciesLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("task_dependencies")
      .select("id, task_id, depends_on_task_id, created_at, depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, task_code, title, status, priority, due_date, archived_at)")
      .eq("task_id", taskId)
      .order("created_at");
    setDependencies((data ?? []) as unknown as DependencyWithTask[]);
    setDependenciesLoading(false);
  }

  async function searchDependencies(q: string) {
    if (!task) return;
    const clean = q.trim();
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("tasks")
      .select("id, task_code, title, status, priority, due_date, archived_at")
      .is("archived_at", null)
      .neq("id", task.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (clean) query = query.ilike("title", `%${clean}%`);

    const { data } = await query;
    const linkedIds = new Set(dependencies.map((d) => d.depends_on_task_id));
    setDependencyResults(((data ?? []) as DependencyTask[]).filter((t) => !linkedIds.has(t.id)));
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

  async function saveField(field: "priority" | "category" | "source" | "due_date" | "location_id", value: string | null) {
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

  async function handleSnoozeFollowUp(id: string, days: number) {
    const dueDate = datePlusDays(days);
    setSnoozingFollowUpId(id);
    const res = await snoozeTaskFollowUp(id, dueDate);
    if (!res.error) {
      setFollowUps((prev) =>
        prev.map((f) => (f.id === id ? { ...f, due_date: dueDate, is_done: false } : f))
      );
      onUpdated();
    }
    setSnoozingFollowUpId(null);
  }

  async function submitChecklistItem() {
    if (!task || !newChecklistItem.trim()) return;
    setAddingChecklistItem(true);
    setChecklistError("");
    const res = await addTaskChecklistItem(task.id, newChecklistItem);
    if (res.error || !res.item) {
      setChecklistError(res.error ?? "Could not add checklist item.");
    } else {
      setChecklist((prev) => [...prev, res.item!]);
      setNewChecklistItem("");
      onUpdated();
    }
    setAddingChecklistItem(false);
  }

  async function handleToggleChecklistItem(item: TaskChecklistItem) {
    setSavingChecklistId(item.id);
    await toggleTaskChecklistItem(item.id, !item.is_done);
    setChecklist((prev) =>
      prev.map((current) => current.id === item.id ? { ...current, is_done: !item.is_done } : current)
    );
    setSavingChecklistId(null);
    onUpdated();
  }

  async function handleDeleteChecklistItem(id: string) {
    setSavingChecklistId(id);
    const res = await deleteTaskChecklistItem(id);
    if (!res.error) {
      setChecklist((prev) => prev.filter((item) => item.id !== id));
      onUpdated();
    }
    setSavingChecklistId(null);
  }

  function handleDependencyQueryChange(value: string) {
    setDependencyQuery(value);
    setDependencySearchOpen(true);
    setDependencyError("");
    clearTimeout(dependencyDebounceRef.current);
    dependencyDebounceRef.current = setTimeout(() => searchDependencies(value), 250);
  }

  async function handleAddDependency(dependsOnTaskId: string) {
    if (!task) return;
    setAddingDependencyId(dependsOnTaskId);
    setDependencyError("");
    const res = await addTaskDependency(task.id, dependsOnTaskId);
    if (res.error || !res.dependency) {
      setDependencyError(res.error ?? "Could not add dependency.");
    } else {
      setDependencies((prev) => [...prev, res.dependency!]);
      setDependencyQuery("");
      setDependencyResults([]);
      setDependencySearchOpen(false);
      onUpdated();
    }
    setAddingDependencyId(null);
  }

  async function handleDeleteDependency(id: string) {
    setRemovingDependencyId(id);
    const res = await deleteTaskDependency(id);
    if (!res.error) {
      setDependencies((prev) => prev.filter((dependency) => dependency.id !== id));
      onUpdated();
    }
    setRemovingDependencyId(null);
  }

  async function handleDeleteTask() {
    if (!task) return;
    setDeletingTask(true);
    setDeleteError("");

    const res = await deleteTask(task.id);
    if (res.error) {
      setDeleteError(res.error);
      setDeletingTask(false);
      return;
    }

    success(`Deleted ${formatTaskCode(task.task_code)}`);
    setDeletingTask(false);
    onClose();
    onUpdated();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!mounted) return null;

  const today = new Date().toISOString().slice(0, 10);
  const completedChecklistCount = checklist.filter((item) => item.is_done).length;
  const openDependencies = dependencies.filter((dependency) =>
    dependency.depends_on_task && !CLOSED_TASK_STATUSES.has(dependency.depends_on_task.status)
  );

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

                  {/* Checklist */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                        Checklist
                      </p>
                      {checklist.length > 0 && (
                        <span className="text-[11px] text-stone-400">
                          {completedChecklistCount}/{checklist.length}
                        </span>
                      )}
                    </div>

                    {checklistError && (
                      <p className="mb-2 text-[12px] text-red-600">{checklistError}</p>
                    )}

                    {checklistLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={16} className="text-stone-300 animate-spin" />
                      </div>
                    ) : checklist.length === 0 ? (
                      <p className="text-[12.5px] text-stone-400 italic mb-3">No checklist items yet</p>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {checklist.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 group">
                            <button
                              onClick={() => handleToggleChecklistItem(item)}
                              disabled={savingChecklistId === item.id}
                              className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                item.is_done
                                  ? "bg-stone-800 border-stone-800"
                                  : "border-stone-300 hover:border-stone-500"
                              }`}
                            >
                              {savingChecklistId === item.id ? (
                                <Loader2 size={10} className="animate-spin text-stone-400" />
                              ) : item.is_done ? (
                                <Check size={10} className="text-white" />
                              ) : null}
                            </button>
                            <span className={`flex-1 text-[13px] leading-snug ${item.is_done ? "text-stone-400 line-through" : "text-stone-700"}`}>
                              {item.body}
                            </span>
                            <button
                              onClick={() => handleDeleteChecklistItem(item.id)}
                              disabled={savingChecklistId === item.id}
                              className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        value={newChecklistItem}
                        onChange={(e) => { setNewChecklistItem(e.target.value); if (checklistError) setChecklistError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") submitChecklistItem(); }}
                        placeholder="Add checklist item..."
                        className="flex-1 px-3 py-2 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
                      />
                      <button
                        onClick={submitChecklistItem}
                        disabled={!newChecklistItem.trim() || addingChecklistItem}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white rounded-lg transition-colors disabled:opacity-40"
                        style={{ background: "#415445" }}
                      >
                        {addingChecklistItem ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Add
                      </button>
                    </div>
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

                  {/* Dependencies / blockers */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                        Dependencies
                      </p>
                      {openDependencies.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                          <GitBranch size={11} />
                          {openDependencies.length} blocker{openDependencies.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    {dependencyError && (
                      <p className="mb-2 text-[12px] text-red-600">{dependencyError}</p>
                    )}

                    {dependenciesLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={16} className="text-stone-300 animate-spin" />
                      </div>
                    ) : dependencies.length === 0 ? (
                      <p className="text-[12.5px] text-stone-400 italic mb-3">No dependencies linked</p>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {dependencies.map((dependency) => {
                          const linkedTask = dependency.depends_on_task;
                          if (!linkedTask) return null;
                          const cfg = getTaskStatusConfig(linkedTask.status);
                          const isBlocking = !CLOSED_TASK_STATUSES.has(linkedTask.status);
                          return (
                            <div
                              key={dependency.id}
                              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                                isBlocking ? "border-amber-100 bg-amber-50" : "border-stone-100 bg-white"
                              }`}
                            >
                              <GitBranch size={13} className={isBlocking ? "text-amber-500 mt-0.5" : "text-stone-300 mt-0.5"} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-stone-400">{formatTaskCode(linkedTask.task_code)}</span>
                                  <span className="text-[13px] font-medium text-stone-700 truncate">{linkedTask.title}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-medium ${cfg.bg} ${cfg.color}`}>
                                    <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                                    {linkedTask.status}
                                  </span>
                                  {linkedTask.due_date && (
                                    <span className="text-[11px] text-stone-400">
                                      Due {new Date(linkedTask.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteDependency(dependency.id)}
                                disabled={removingDependencyId === dependency.id}
                                className="text-stone-300 hover:text-red-500 transition-colors"
                              >
                                {removingDependencyId === dependency.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                          <input
                            value={dependencyQuery}
                            onChange={(e) => handleDependencyQueryChange(e.target.value)}
                            onFocus={() => { setDependencySearchOpen(true); searchDependencies(dependencyQuery); }}
                            placeholder="Search task to block on..."
                            className="w-full pl-8 pr-3 py-2 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
                          />
                        </div>
                      </div>
                      {dependencySearchOpen && dependencyResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 max-h-56 overflow-y-auto">
                          {dependencyResults.map((result) => {
                            const cfg = getTaskStatusConfig(result.status);
                            return (
                              <button
                                key={result.id}
                                onClick={() => handleAddDependency(result.id)}
                                disabled={addingDependencyId === result.id}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 text-left transition-colors disabled:opacity-60"
                              >
                                <span className="text-[11px] font-mono text-stone-400 w-16 flex-shrink-0">{formatTaskCode(result.task_code)}</span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-[13px] text-stone-800 truncate">{result.title}</span>
                                  <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-medium ${cfg.bg} ${cfg.color}`}>
                                    <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                                    {result.status}
                                  </span>
                                </span>
                                {addingDependencyId === result.id && <Loader2 size={13} className="animate-spin text-stone-400" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
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
                                {!f.is_done && (
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <span className="text-[10.5px] text-stone-400">Snooze</span>
                                    {([["1d", 1], ["3d", 3], ["1w", 7]] as const).map(([label, days]) => (
                                      <button
                                        key={`${f.id}-${label}`}
                                        onClick={() => handleSnoozeFollowUp(f.id, days)}
                                        disabled={snoozingFollowUpId === f.id}
                                        className="px-1.5 py-0.5 text-[10.5px] font-medium text-stone-500 border border-stone-200 rounded-md hover:bg-white hover:text-stone-700 transition-colors disabled:opacity-50"
                                      >
                                        {snoozingFollowUpId === f.id ? "..." : `+${label}`}
                                      </button>
                                    ))}
                                  </div>
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

                  {/* Site */}
                  <FieldRow label="Site">
                    <select
                      value={locationId}
                      onChange={(e) => { setLocationId(e.target.value); saveField("location_id", e.target.value || null); }}
                      className="w-full px-3 py-1.5 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
                    >
                      <option value="">— None —</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    {locationId && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-stone-500">
                        <MapPin size={10} className="text-stone-400" />
                        {locations.find((l) => l.id === locationId)?.name}
                      </div>
                    )}
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

                  <div className="border-t border-stone-100 pt-4">
                    <p className="text-[10.5px] font-medium text-stone-400 uppercase tracking-wider mb-2">Actions</p>
                    {deleteError && (
                      <p className="mb-2 text-[11.5px] text-red-600 leading-snug">{deleteError}</p>
                    )}
                    {confirmingDelete ? (
                      <div className="space-y-2">
                        <p className="text-[12px] text-stone-500">Delete this task?</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={handleDeleteTask}
                            disabled={deletingTask}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {deletingTask && <Loader2 size={12} className="animate-spin" />}
                            Delete
                          </button>
                          <button
                            onClick={() => { setConfirmingDelete(false); setDeleteError(""); }}
                            disabled={deletingTask}
                            className="flex-1 px-2.5 py-1.5 text-[11.5px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                        Delete task
                      </button>
                    )}
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
