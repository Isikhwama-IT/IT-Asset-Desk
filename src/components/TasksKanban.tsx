"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import { updateTaskStatus } from "@/lib/actions";
import {
  TASK_STATUSES,
  daysSince,
  formatTaskCode,
  getTaskPriorityConfig,
  getTaskStatusConfig,
  lastActivityDate,
} from "@/lib/tasks";
import type { TaskStatus, TaskWithActivity } from "@/types/database";

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_REQUIRED = new Set(["Re-Routed", "Standby", "Neutralized", "Retired"]);

// Column background tints (very subtle, matches status pill bg)
const COLUMN_BG: Record<string, string> = {
  Intel:        "#f0f9ff",
  Briefed:      "#eef2ff",
  "Active Ops": "#ecfdf5",
  "Re-Routed":  "#fffbeb",
  Standby:      "#f5f5f4",
  Neutralized:  "#fef2f2",
  Retired:      "#fafaf9",
};

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingMove {
  task: TaskWithActivity;
  toStatus: string;
}

interface Props {
  tasks: TaskWithActivity[];
  showClosed: boolean;
  onTaskClick: (task: TaskWithActivity) => void;
  onQuickAddFocus: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TasksKanban({ tasks, showClosed, onTaskClick, onQuickAddFocus }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Local task state for optimistic updates
  const [localTasks, setLocalTasks] = useState<TaskWithActivity[]>(tasks);
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);
  useEffect(() => { setMounted(true); }, []);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const draggingTaskRef = useRef<TaskWithActivity | null>(null);

  // Reason prompt state
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  const visibleStatuses = showClosed
    ? [...TASK_STATUSES]
    : [...TASK_STATUSES].filter((s) => s !== "Neutralized" && s !== "Retired");

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(task: TaskWithActivity) {
    setDraggingId(task.id);
    draggingTaskRef.current = task;
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverStatus(null);
    draggingTaskRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }

  function handleDragLeave() {
    setDragOverStatus(null);
  }

  async function handleDrop(e: React.DragEvent, toStatus: string) {
    e.preventDefault();
    setDragOverStatus(null);

    const task = draggingTaskRef.current;
    setDraggingId(null);
    draggingTaskRef.current = null;

    if (!task || task.status === toStatus) return;

    if (REASON_REQUIRED.has(toStatus)) {
      setPendingMove({ task, toStatus });
      setReasonText("");
      setTimeout(() => reasonInputRef.current?.focus(), 50);
      return;
    }

    // Immediate move
    applyMove(task, toStatus, null);
  }

  async function applyMove(task: TaskWithActivity, toStatus: string, reason: string | null) {
    const now = new Date().toISOString();
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: toStatus as TaskStatus, status_reason: reason, status_changed_at: now }
          : t
      )
    );
    await updateTaskStatus(task.id, toStatus, reason);
    router.refresh();
  }

  async function confirmReason() {
    if (!pendingMove || !reasonText.trim()) return;
    setSaving(true);
    await applyMove(pendingMove.task, pendingMove.toStatus, reasonText.trim());
    setSaving(false);
    setPendingMove(null);
    setReasonText("");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-8 px-8">
        {visibleStatuses.map((status) => {
          const columnTasks = localTasks.filter((t) => t.status === status);
          const isDropTarget = dragOverStatus === status && draggingId !== null;
          const cfg = getTaskStatusConfig(status);

          return (
            <div
              key={status}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
              className="flex flex-col flex-shrink-0 w-[272px] rounded-xl border transition-all duration-150"
              style={{
                background: COLUMN_BG[status] ?? "#fafaf9",
                borderColor: isDropTarget ? "#a8a29e" : "#e7e5e4",
                boxShadow: isDropTarget ? "inset 0 0 0 2px #a8a29e" : undefined,
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    {status}
                  </span>
                  <span className="text-[11px] font-medium text-stone-400 tabular-nums">
                    {columnTasks.length}
                  </span>
                </div>
                {status === "Intel" && (
                  <button
                    onClick={onQuickAddFocus}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-white/60 transition-colors"
                    title="Add a task"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>

              {/* Card list */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[120px]">
                {columnTasks.length === 0 ? (
                  <div
                    className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-[12px] text-stone-400 transition-colors ${
                      isDropTarget ? "border-stone-400 bg-white/50" : "border-transparent"
                    }`}
                  >
                    {isDropTarget ? "Drop here" : "No tasks"}
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      today={today}
                      isDragging={draggingId === task.id}
                      isDropTarget={isDropTarget}
                      onDragStart={() => handleDragStart(task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onTaskClick(task)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reason prompt portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {pendingMove && (
            <>
              <motion.div
                className="fixed inset-0 z-[9998] bg-stone-900/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: EASE }}
                onClick={() => { setPendingMove(null); setReasonText(""); }}
              />
              <motion.div
                className="fixed z-[9999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] bg-white rounded-2xl shadow-2xl p-5"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.18, ease: EASE }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <p className="text-[13px] font-semibold text-stone-800">
                    Reason required
                  </p>
                </div>
                <p className="text-[12px] text-stone-500 mb-3">
                  Moving to <strong>{pendingMove.toStatus}</strong> requires a reason.
                </p>
                <textarea
                  ref={reasonInputRef}
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) confirmReason();
                    if (e.key === "Escape") { setPendingMove(null); setReasonText(""); }
                  }}
                  placeholder="Enter reason..."
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] text-stone-800 border border-stone-200 rounded-lg bg-white placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300 resize-none mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={confirmReason}
                    disabled={!reasonText.trim() || saving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12.5px] font-medium text-white rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: "#C04F28" }}
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                    Confirm move
                  </button>
                  <button
                    onClick={() => { setPendingMove(null); setReasonText(""); }}
                    className="flex-1 py-2 text-[12.5px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  today,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: TaskWithActivity;
  today: string;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const priorityCfg = getTaskPriorityConfig(task.priority);
  const isOverdue = task.due_date && task.due_date < today;
  const isToday = task.due_date === today;

  const updates = task.task_updates ?? [];
  const lastUpdate = updates.length > 0
    ? [...updates].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : null;

  const statusAge = daysSince(task.status_changed_at);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group bg-white border rounded-xl p-3 cursor-pointer select-none transition-all ${
        isDragging
          ? "opacity-40 scale-95 shadow-none"
          : "opacity-100 shadow-sm hover:shadow-md hover:border-stone-300 active:scale-[0.98]"
      } border-stone-200`}
    >
      {/* Code + priority row */}
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-[11px] font-mono text-stone-400">
          {task.task_code > 0 ? formatTaskCode(task.task_code) : "—"}
        </span>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${priorityCfg.dot}`} />
          {task.priority}
        </span>
      </div>

      {/* Title */}
      <p className="text-[13px] text-stone-800 font-medium leading-snug mb-2">{task.title}</p>

      {/* Due date */}
      {task.due_date && (
        <p className={`text-[11px] mb-1.5 font-medium ${
          isOverdue ? "text-red-500" : isToday ? "text-amber-500" : "text-stone-400"
        }`}>
          {isOverdue ? "Overdue · " : isToday ? "Due today · " : ""}
          {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
        </p>
      )}

      {/* Category */}
      {task.category && (
        <p className="text-[11px] text-stone-400 mb-1.5">{task.category}</p>
      )}

      {/* Last update */}
      {lastUpdate?.body && (
        <p className="text-[11px] text-stone-400 truncate mb-1.5">
          ↳ {lastUpdate.body}
        </p>
      )}

      {/* Status age */}
      <p className="text-[10.5px] text-stone-300 text-right tabular-nums">
        {statusAge}d in status
      </p>
    </div>
  );
}
