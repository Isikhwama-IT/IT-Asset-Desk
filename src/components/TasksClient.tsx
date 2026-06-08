"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
// useRef is used inside FilterDropdown
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlignLeft,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Kanban,
  LayoutDashboard,
  List,
  ListTodo,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import { createTask, createTaskFromTemplate } from "@/lib/actions";
import { TaskPanel } from "@/components/TaskPanel";
import TasksDashboard from "@/components/TasksDashboard";
import TasksKanban from "@/components/TasksKanban";
import TasksCalendar from "@/components/TasksCalendar";
import TasksGantt, { type GanttMode, type GanttGroupBy } from "@/components/TasksGantt";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  daysSince,
  formatTaskCode,
  getTaskPriorityConfig,
  getTaskStatusConfig,
  lastActivityDate,
  sortTasks,
} from "@/lib/tasks";
import { TASK_TEMPLATES } from "@/lib/task-templates";
import type { CalendarData, DashboardAlertTask, DashboardData, TaskWithActivity } from "@/types/database";

// ─── View definitions ─────────────────────────────────────────────────────────

const VIEWS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "list",      label: "List",      icon: List            },
  { id: "kanban",    label: "Kanban",    icon: Kanban          },
  { id: "calendar",  label: "Calendar",  icon: CalendarDays    },
  { id: "gantt",     label: "Gantt",     icon: AlignLeft       },
] as const;

interface Props {
  view: string;
  tasks: TaskWithActivity[];
  total: number;
  activeCount: number;
  dashboardData?: DashboardData;
  calendarData?: CalendarData;
}

export default function TasksClient({ view, tasks, total, dashboardData, calendarData }: Props) {
  const { isAdmin } = useAuth();
  const { success } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [quickAdd, setQuickAdd] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithActivity | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [ganttMode, setGanttMode] = useState<GanttMode>("Week");
  const [ganttGroupBy, setGanttGroupBy] = useState<GanttGroupBy>("none");
  const quickAddRef = useRef<HTMLInputElement>(null);

  // ── Filter state (list + kanban views) ────────────────────────────────────
  const selectedStatuses  = new Set(searchParams.get("status")?.split(",").filter(Boolean)   ?? []);
  const selectedPriorities = new Set(searchParams.get("priority")?.split(",").filter(Boolean) ?? []);
  const selectedCategories = new Set(searchParams.get("category")?.split(",").filter(Boolean) ?? []);
  const isOverdue = searchParams.get("overdue") === "1";
  const hasFilters =
    selectedStatuses.size > 0 || selectedPriorities.size > 0 || selectedCategories.size > 0 || isOverdue;

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) p.set(key, value);
        else p.delete(key);
      }
      startTransition(() => router.push(`/tasks?${p.toString()}`));
    },
    [router, searchParams]
  );

  function setView(v: string) {
    updateParams({ view: v, status: undefined, priority: undefined, category: undefined, overdue: undefined });
  }

  function toggleFilter(param: string, value: string, current: Set<string>) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    updateParams({ [param]: next.size > 0 ? [...next].join(",") : undefined });
  }

  // ── Optimistic task list ───────────────────────────────────────────────────
  const [optimisticTasks, addOptimisticTask] = useOptimistic(
    tasks,
    (state: TaskWithActivity[], newTask: TaskWithActivity) => [newTask, ...state]
  );
  const sorted = sortTasks(optimisticTasks);

  async function handleQuickAdd(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const title = quickAdd.trim();
    if (!title) return;

    setAddError("");
    setQuickAdd("");
    setIsAdding(true);

    const tempTask: TaskWithActivity = {
      id: `temp-${Date.now()}`,
      task_code: 0,
      title,
      status: "Intel",
      status_reason: null,
      status_changed_at: new Date().toISOString(),
      priority: "Standard",
      category: null,
      source: null,
      due_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
      task_updates: [],
    };

    startTransition(() => {
      addOptimisticTask(tempTask);
    });

    try {
      const res = await createTask(title);
      if (res.error || !res.task) {
        setQuickAdd(title);
        setAddError(res.error ?? "Could not create task.");
        router.refresh();
        return;
      }

      success(`Created ${formatTaskCode(res.task.task_code)}`);
      if (view === "dashboard" || view === "calendar") {
        setSelectedTask(res.task);
      }
      router.refresh();
    } catch (err) {
      setQuickAdd(title);
      setAddError(err instanceof Error ? err.message : "Could not create task.");
      router.refresh();
    } finally {
      setIsAdding(false);
    }
  }

  // Dashboard task click — need to convert DashboardAlertTask to TaskWithActivity
  function handleDashboardTaskClick(alertTask: DashboardAlertTask) {
    setSelectedTask({
      ...alertTask,
      status: alertTask.status as TaskWithActivity["status"],
      priority: alertTask.priority as TaskWithActivity["priority"],
      category: alertTask.category as TaskWithActivity["category"],
      status_reason: alertTask.status_reason ?? null,
      source: (alertTask.source ?? null) as TaskWithActivity["source"],
      updated_at: alertTask.updated_at ?? alertTask.status_changed_at,
      archived_at: alertTask.archived_at ?? null,
      task_updates: (alertTask.task_updates ?? []).map((u) => ({ body: u.body, created_at: u.created_at })),
    });
  }

  async function handleCreateFromTemplate() {
    if (!selectedTemplateId) return;
    setAddError("");
    setIsCreatingTemplate(true);

    try {
      const res = await createTaskFromTemplate(selectedTemplateId);
      if (res.error && !res.task) {
        setAddError(res.error);
        return;
      }
      if (res.task) {
        success(`Created ${formatTaskCode(res.task.task_code)}`);
        setSelectedTask(res.task);
        setSelectedTemplateId("");
        router.refresh();
      }
      if (res.error) setAddError(res.error);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not create task from template.");
    } finally {
      setIsCreatingTemplate(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {/* Quick-add bar */}
      {isAdmin && (
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={quickAddRef}
              type="text"
              placeholder="Add a task..."
              value={quickAdd}
              onChange={(e) => { setQuickAdd(e.target.value); if (addError) setAddError(""); }}
              onKeyDown={handleQuickAdd}
              disabled={isAdding}
              className="flex-1 min-w-0 px-4 py-2.5 text-[13.5px] border border-stone-200 rounded-xl bg-white text-stone-800 placeholder-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:border-stone-300 transition-colors disabled:opacity-60"
            />
            <div className="flex gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <ClipboardList size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
                <select
                  value={selectedTemplateId}
                  onChange={(e) => { setSelectedTemplateId(e.target.value); if (addError) setAddError(""); }}
                  disabled={isCreatingTemplate}
                  className="w-full pl-8 pr-8 py-2.5 text-[13px] border border-stone-200 rounded-xl bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:border-stone-300 transition-colors disabled:opacity-60 appearance-none"
                >
                  <option value="">Template</option>
                  {TASK_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>{template.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
              </div>
              <button
                onClick={handleCreateFromTemplate}
                disabled={!selectedTemplateId || isCreatingTemplate}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium text-white rounded-xl transition-colors disabled:opacity-40"
                style={{ background: "#415445" }}
              >
                {isCreatingTemplate ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Use
              </button>
            </div>
          </div>
          {addError && (
            <p className="mt-2 text-[12px] text-red-600">{addError}</p>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div
        className={`flex items-center gap-3 mb-5 flex-wrap transition-opacity ${isPending ? "opacity-60" : ""}`}
      >
        {/* View switcher */}
        <div className="flex items-center bg-stone-100 rounded-lg p-0.5 gap-px overflow-x-auto flex-shrink-0">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              title={label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${
                view === id
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* List-view filters */}
        {view === "list" && (
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal size={13} className="text-stone-400" />

            <FilterDropdown
              label="Status"
              options={[...TASK_STATUSES].map((s) => ({ id: s, name: s }))}
              selected={selectedStatuses}
              onToggle={(id) => toggleFilter("status", id, selectedStatuses)}
              renderOption={(opt) => {
                const cfg = getTaskStatusConfig(opt.name);
                return <StatusOption name={opt.name} dot={cfg.dot} />;
              }}
            />

            <FilterDropdown
              label="Priority"
              options={[...TASK_PRIORITIES].map((p) => ({ id: p, name: p }))}
              selected={selectedPriorities}
              onToggle={(id) => toggleFilter("priority", id, selectedPriorities)}
              renderOption={(opt) => {
                const cfg = getTaskPriorityConfig(opt.name);
                return <StatusOption name={opt.name} dot={cfg.dot} />;
              }}
            />

            <FilterDropdown
              label="Category"
              options={[...TASK_CATEGORIES].map((c) => ({ id: c, name: c }))}
              selected={selectedCategories}
              onToggle={(id) => toggleFilter("category", id, selectedCategories)}
            />

            <button
              onClick={() => updateParams({ overdue: isOverdue ? undefined : "1" })}
              className={`flex items-center gap-1.5 text-[12.5px] border rounded-lg px-2.5 py-2 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-stone-300 ${
                isOverdue
                  ? "border-stone-400 text-stone-800"
                  : "border-stone-200 text-stone-600 hover:border-stone-300"
              }`}
            >
              {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              Overdue
            </button>

            {hasFilters && (
              <button
                onClick={() =>
                  updateParams({ status: undefined, priority: undefined, category: undefined, overdue: undefined })
                }
                className="flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}

            <span className="ml-auto text-[12px] text-stone-400">
              {total} task{total !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Calendar-view filters */}
        {view === "calendar" && (
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal size={13} className="text-stone-400" />

            <FilterDropdown
              label="Status"
              options={[...TASK_STATUSES].map((s) => ({ id: s, name: s }))}
              selected={selectedStatuses}
              onToggle={(id) => toggleFilter("status", id, selectedStatuses)}
              renderOption={(opt) => {
                const cfg = getTaskStatusConfig(opt.name);
                return <StatusOption name={opt.name} dot={cfg.dot} />;
              }}
            />
            <FilterDropdown
              label="Priority"
              options={[...TASK_PRIORITIES].map((p) => ({ id: p, name: p }))}
              selected={selectedPriorities}
              onToggle={(id) => toggleFilter("priority", id, selectedPriorities)}
              renderOption={(opt) => {
                const cfg = getTaskPriorityConfig(opt.name);
                return <StatusOption name={opt.name} dot={cfg.dot} />;
              }}
            />
            <FilterDropdown
              label="Category"
              options={[...TASK_CATEGORIES].map((c) => ({ id: c, name: c }))}
              selected={selectedCategories}
              onToggle={(id) => toggleFilter("category", id, selectedCategories)}
            />
            {hasFilters && (
              <button
                onClick={() =>
                  updateParams({ status: undefined, priority: undefined, category: undefined, overdue: undefined })
                }
                className="flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}

        {/* Kanban-view filters */}
        {view === "kanban" && (
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal size={13} className="text-stone-400" />

            <FilterDropdown
              label="Priority"
              options={[...TASK_PRIORITIES].map((p) => ({ id: p, name: p }))}
              selected={selectedPriorities}
              onToggle={(id) => toggleFilter("priority", id, selectedPriorities)}
              renderOption={(opt) => {
                const cfg = getTaskPriorityConfig(opt.name);
                return <StatusOption name={opt.name} dot={cfg.dot} />;
              }}
            />

            <FilterDropdown
              label="Category"
              options={[...TASK_CATEGORIES].map((c) => ({ id: c, name: c }))}
              selected={selectedCategories}
              onToggle={(id) => toggleFilter("category", id, selectedCategories)}
            />

            <button
              onClick={() => updateParams({ overdue: isOverdue ? undefined : "1" })}
              className={`flex items-center gap-1.5 text-[12.5px] border rounded-lg px-2.5 py-2 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-stone-300 ${
                isOverdue
                  ? "border-stone-400 text-stone-800"
                  : "border-stone-200 text-stone-600 hover:border-stone-300"
              }`}
            >
              {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              Overdue
            </button>

            <button
              onClick={() => setShowClosed((v) => !v)}
              className={`flex items-center gap-1.5 text-[12.5px] border rounded-lg px-2.5 py-2 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-stone-300 ${
                showClosed
                  ? "border-stone-400 text-stone-800"
                  : "border-stone-200 text-stone-600 hover:border-stone-300"
              }`}
            >
              {showClosed && <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />}
              {showClosed ? "Hiding closed" : "Show Closed"}
            </button>

            {(hasFilters) && (
              <button
                onClick={() =>
                  updateParams({ priority: undefined, category: undefined, overdue: undefined })
                }
                className="flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}

        {/* Gantt-view controls */}
        {view === "gantt" && (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Timeline mode */}
            <div className="flex items-center bg-stone-100 rounded-lg p-0.5 gap-px">
              {(["Day", "Week", "Month"] as GanttMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setGanttMode(m)}
                  className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                    ganttMode === m ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Group by */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-stone-400">Group:</span>
              <div className="flex items-center bg-stone-100 rounded-lg p-0.5 gap-px">
                {([["none","None"],["status","Status"],["priority","Priority"]] as [GanttGroupBy, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setGanttGroupBy(val)}
                    className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                      ganttGroupBy === val ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <FilterDropdown
              label="Priority"
              options={[...TASK_PRIORITIES].map((p) => ({ id: p, name: p }))}
              selected={selectedPriorities}
              onToggle={(id) => toggleFilter("priority", id, selectedPriorities)}
              renderOption={(opt) => {
                const cfg = getTaskPriorityConfig(opt.name);
                return <StatusOption name={opt.name} dot={cfg.dot} />;
              }}
            />
            <FilterDropdown
              label="Category"
              options={[...TASK_CATEGORIES].map((c) => ({ id: c, name: c }))}
              selected={selectedCategories}
              onToggle={(id) => toggleFilter("category", id, selectedCategories)}
            />
            <FilterDropdown
              label="Status"
              options={[...TASK_STATUSES].map((s) => ({ id: s, name: s }))}
              selected={selectedStatuses}
              onToggle={(id) => toggleFilter("status", id, selectedStatuses)}
              renderOption={(opt) => {
                const cfg = getTaskStatusConfig(opt.name);
                return <StatusOption name={opt.name} dot={cfg.dot} />;
              }}
            />
            {hasFilters && (
              <button
                onClick={() => updateParams({ status: undefined, priority: undefined, category: undefined, overdue: undefined })}
                className="flex items-center gap-1 text-[12px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── View content ────────────────────────────────────────────────────── */}

      {view === "dashboard" && dashboardData && (
        <TasksDashboard data={dashboardData} onTaskClick={handleDashboardTaskClick} />
      )}

      {view === "list" && (
        <>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {sorted.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                  <ListTodo size={18} className="text-stone-400" />
                </div>
                <div>
                  <p className="text-[13px] text-stone-500 font-medium">No tasks found</p>
                  <p className="text-[12px] text-stone-400 mt-0.5">
                    {hasFilters
                      ? "Try adjusting your filters"
                      : isAdmin
                      ? "Type a task title above and press Enter to add one"
                      : "No active tasks at the moment"}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile: compact rows */}
                <div className="divide-y divide-stone-50 sm:hidden">
                  {sorted.map((task) => {
                    const statusCfg   = getTaskStatusConfig(task.status);
                    const priorityCfg = getTaskPriorityConfig(task.priority);
                    const isTemp = task.id.startsWith("temp-");
                    let dueCls = "text-stone-400";
                    if (task.due_date) {
                      if (task.due_date < today)        dueCls = "text-red-500";
                      else if (task.due_date === today) dueCls = "text-amber-500";
                    }
                    return (
                      <button
                        key={task.id}
                        onClick={() => !isTemp && setSelectedTask(task)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isTemp ? "opacity-50 cursor-default" : "hover:bg-stone-50 cursor-pointer"
                        } ${selectedTask?.id === task.id ? "bg-stone-50" : ""}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] text-stone-800 truncate">{task.title}</span>
                          <span className="block text-[11px] text-stone-400 mt-0.5">
                            {isTemp ? "—" : formatTaskCode(task.task_code)}
                            {task.due_date && (
                              <span className={`ml-2 ${dueCls}`}>
                                · {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </span>
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge label={task.priority} cfg={priorityCfg} />
                          <Badge label={task.status} cfg={statusCfg} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Desktop: full grid table */}
                <div className="hidden sm:block overflow-x-auto">
                  <div className="min-w-[860px]">
                    <div className="grid grid-cols-[5rem_1fr_8rem_7rem_7rem_6rem_4rem_8rem] gap-3 px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                      {["Code", "Task", "Status", "Priority", "Category", "Due", "Age", "Last Update"].map((h) => (
                        <span key={h} className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                          {h}
                        </span>
                      ))}
                    </div>
                    <div className="divide-y divide-stone-50">
                      {sorted.map((task) => {
                        const statusCfg   = getTaskStatusConfig(task.status);
                        const priorityCfg = getTaskPriorityConfig(task.priority);
                        const isTemp = task.id.startsWith("temp-");
                        const lastUpdate = lastActivityDate(task.task_updates);
                        let dueCls = "text-stone-500";
                        if (task.due_date) {
                          if (task.due_date < today)        dueCls = "text-red-600 font-medium";
                          else if (task.due_date === today) dueCls = "text-amber-600 font-medium";
                        }
                        return (
                          <button
                            key={task.id}
                            onClick={() => !isTemp && setSelectedTask(task)}
                            className={`w-full grid grid-cols-[5rem_1fr_8rem_7rem_7rem_6rem_4rem_8rem] gap-3 px-4 py-3 items-center text-left hover:bg-stone-50 transition-colors ${
                              isTemp ? "opacity-50 cursor-default" : "cursor-pointer"
                            } ${selectedTask?.id === task.id ? "bg-stone-50" : ""}`}
                          >
                            <span className="text-[12px] font-mono text-stone-400">
                              {isTemp ? "—" : formatTaskCode(task.task_code)}
                            </span>
                            <span className="text-[13px] text-stone-800 truncate">{task.title}</span>
                            <Badge label={task.status} cfg={statusCfg} />
                            <Badge label={task.priority} cfg={priorityCfg} />
                            <span className="text-[12px] text-stone-500 truncate">
                              {task.category ?? <span className="text-stone-300">—</span>}
                            </span>
                            <span className={`text-[12px] ${task.due_date ? dueCls : "text-stone-300"}`}>
                              {task.due_date
                                ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
                                : "—"}
                            </span>
                            <span className="text-[12px] text-stone-400 tabular-nums">
                              {daysSince(task.created_at)}d
                            </span>
                            <span className="text-[12px] text-stone-400 truncate">
                              {lastUpdate ? `${daysSince(lastUpdate)}d ago` : "No updates"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {view === "kanban" && (
        <TasksKanban
          tasks={optimisticTasks}
          showClosed={showClosed}
          onTaskClick={(t) => setSelectedTask(t)}
          onQuickAddFocus={() => quickAddRef.current?.focus()}
        />
      )}

      {view === "calendar" && calendarData && (
        <TasksCalendar
          data={calendarData}
          onTaskClick={(t) => setSelectedTask(t)}
        />
      )}

      {view === "gantt" && (
        <TasksGantt
          tasks={optimisticTasks}
          ganttMode={ganttMode}
          groupBy={ganttGroupBy}
          onTaskClick={(t) => setSelectedTask(t)}
        />
      )}

      <TaskPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => { router.refresh(); }}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, cfg }: { label: string | null | undefined; cfg: { color: string; dot: string; bg: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {label ?? "—"}
    </span>
  );
}

function StatusOption({ name, dot }: { name: string; dot: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-[13px] text-stone-700">{name}</span>
    </span>
  );
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  renderOption,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: Set<string>;
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

  const count = selected.size;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-[12.5px] border rounded-lg px-2.5 py-2 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-stone-300 ${
          count > 0 ? "border-stone-400 text-stone-800" : "border-stone-200 text-stone-600 hover:border-stone-300"
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
            <label key={opt.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(opt.id)}
                onChange={() => onToggle(opt.id)}
                className="w-3.5 h-3.5 rounded border-stone-300 accent-stone-800 flex-shrink-0"
              />
              {renderOption ? renderOption(opt) : <span className="text-[13px] text-stone-700">{opt.name}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
