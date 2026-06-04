"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo } from "lucide-react";
import { updateTaskField } from "@/lib/actions";
import {
  formatTaskCode,
  getTaskPriorityConfig,
  getTaskStatusConfig,
  TASK_STATUSES,
  TASK_PRIORITIES,
  sortTasks,
} from "@/lib/tasks";
import type { TaskWithActivity } from "@/types/database";

// ─── Constants ────────────────────────────────────────────────────────────────

const BAR_H = 28;
const ROW_PAD = 14;
export const ROW_H = BAR_H + ROW_PAD; // 42px — must match frappe-gantt options

// frappe-gantt header = upper_header_height(30) + lower_header_height(30) + 10
const GANTT_HEADER_H = 70;

const MAX_CHART_H = 560;

const PRIORITY_COLOR: Record<string, string> = {
  Hot:      "#ef4444",
  Priority: "#f59e0b",
  Standard: "#38bdf8",
  Cold:     "#a8a29e",
};

export type GanttMode    = "Day" | "Week" | "Month";
export type GanttGroupBy = "none" | "status" | "priority";

// ─── Ordering / grouping ──────────────────────────────────────────────────────

type Row = TaskWithActivity & { __group?: string };

function buildRows(tasks: TaskWithActivity[], groupBy: GanttGroupBy): Row[] {
  if (groupBy === "none") {
    // due_date asc, nulls last, then priority desc
    return [...tasks].sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      const pa = ["Hot","Priority","Standard","Cold"].indexOf(a.priority);
      const pb = ["Hot","Priority","Standard","Cold"].indexOf(b.priority);
      return pa - pb;
    });
  }

  if (groupBy === "status") {
    const order = [...TASK_STATUSES];
    const groups = new Map<string, TaskWithActivity[]>();
    for (const s of order) groups.set(s, []);
    for (const t of tasks) {
      const g = groups.get(t.status) ?? [];
      g.push(t);
      groups.set(t.status, g);
    }
    const rows: Row[] = [];
    for (const [status, group] of groups) {
      if (!group.length) continue;
      rows.push({ ...group[0], __group: status, id: `__grp_${status}`, title: status, task_code: 0 } as Row);
      rows.push(...sortTasks(group));
    }
    return rows;
  }

  // groupBy === "priority"
  const order = ["Hot", "Priority", "Standard", "Cold"] as const;
  const rows: Row[] = [];
  for (const pri of order) {
    const group = tasks.filter(t => t.priority === pri);
    if (!group.length) continue;
    rows.push({ ...group[0], __group: pri, id: `__grp_${pri}`, title: pri, task_code: 0 } as Row);
    rows.push(...group.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    }));
  }
  return rows;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  tasks: TaskWithActivity[];
  ganttMode: GanttMode;
  groupBy: GanttGroupBy;
  onTaskClick: (task: TaskWithActivity) => void;
}

export default function TasksGantt({ tasks, ganttMode, groupBy, onTaskClick }: Props) {
  const router = useRouter();
  const ganttWrapRef = useRef<HTMLDivElement>(null);
  const leftBodyRef  = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const rows = buildRows(tasks, groupBy);
  const realTasks = rows.filter(r => !r.__group);

  const chartH = Math.min(MAX_CHART_H, rows.length * ROW_H + GANTT_HEADER_H + 24);
  const bodyH  = chartH - GANTT_HEADER_H;

  // Rebuild frappe-gantt whenever rows or mode changes
  const rowKey = rows.map(r => `${r.id}:${r.due_date}`).join("|");

  useEffect(() => {
    if (!mounted || !ganttWrapRef.current || !rows.length) return;

    const wrap = ganttWrapRef.current;

    import("frappe-gantt").then(mod => {
      const Gantt = (mod as any).default ?? mod;
      wrap.innerHTML = ""; // clear previous instance

      // Separator rows need a visible but non-interactive bar
      // We give them a 1-day span at an arbitrary start so the SVG grid aligns
      const ganttTasks = rows.map(r => {
        if (r.__group) {
          return {
            id: r.id,
            name: "",
            start: today,
            end: tomorrow,
            progress: 0,
            color: "transparent",
            custom_class: "bar-group-header",
          };
        }

        const isCompleted = ["Neutralized", "Retired"].includes(r.status);
        const isOverdue   = !isCompleted && r.due_date && r.due_date < today;
        const isMilestone = !r.due_date;

        const start = r.created_at.slice(0, 10);
        const end   = r.due_date ?? tomorrow;
        let color   = PRIORITY_COLOR[r.priority] ?? "#a8a29e";
        if (isCompleted) color = "#d6d3d1";

        return {
          id: r.id,
          name: "",
          start,
          end,
          progress: isCompleted ? 100 : 0,
          color,
          color_progress: isCompleted ? "#a8a29e" : color,
          custom_class: [
            isOverdue   ? "bar-overdue"   : "",
            isCompleted ? "bar-completed" : "",
            isMilestone ? "bar-milestone" : "",
          ].filter(Boolean).join(" "),
        };
      });

      const instance = new Gantt(wrap, ganttTasks, {
        view_mode:         ganttMode,
        bar_height:        BAR_H,
        padding:           ROW_PAD,
        container_height:  chartH,
        view_mode_select:  false,
        today_button:      false,
        popup:             false,
        scroll_to:         "today",
        on_click: (task: any) => {
          const original = realTasks.find(t => t.id === task.id);
          if (original) onTaskClick(original);
        },
        on_date_change: async (task: any, _start: Date, end: Date) => {
          if (task.id.startsWith("__grp_")) return;
          const newDue = end.toISOString().slice(0, 10);
          await updateTaskField(task.id, "due_date", newDue);
          router.refresh();
        },
      });

      void instance; // suppress unused warning

      // Vertical scroll sync: frappe-gantt scrolls → mirror left body
      const gc = wrap.querySelector(".gantt-container") as HTMLElement | null;
      if (gc && leftBodyRef.current) {
        const lb = leftBodyRef.current;
        gc.addEventListener("scroll", () => { lb.scrollTop = gc.scrollTop; });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, rowKey, ganttMode, chartH]);

  // ── Empty states ────────────────────────────────────────────────────────────
  if (!tasks.length) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 py-16 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
          <ListTodo size={18} className="text-stone-400" />
        </div>
        <p className="text-[13px] text-stone-500 font-medium">No tasks match your filters</p>
      </div>
    );
  }

  const hasDates = realTasks.some(t => t.due_date);
  if (!hasDates) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 py-16 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
          <ListTodo size={18} className="text-stone-400" />
        </div>
        <p className="text-[13px] text-stone-500 font-medium">No due dates set</p>
        <p className="text-[12px] text-stone-400">
          Assign due dates via the detail panel or List view to see tasks on the Gantt chart.
          <br />Tasks without dates appear as milestone markers at their creation date.
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const leftW = 420;

  return (
    <div className="gantt-theme rounded-xl border border-stone-200 overflow-hidden">
      <style>{`
        .gantt-theme .gantt-container {
          --g-bar-color: #fff;
          --g-row-color: #fff;
          --g-border-color: #e7e5e4;
          --g-row-border-color: #e7e5e4;
          --g-header-background: #fafaf9;
          --g-tick-color: #f5f5f4;
          --g-tick-color-thick: #e7e5e4;
          --g-text-dark: #44403c;
          --g-text-muted: #a8a29e;
          --g-today-highlight: #C04F28;
          --g-actions-background: #f5f5f4;
          --g-progress-color: #e7e5e4;
          --g-weekend-highlight-color: #fafaf9;
          border-radius: 0;
          border: none;
          font-family: inherit;
        }
        /* Group header rows — hide the bar */
        .gantt-theme .bar-group-header .bar,
        .gantt-theme .bar-group-header .bar-progress,
        .gantt-theme .bar-group-header .handle,
        .gantt-theme .bar-group-header .bar-label { display: none !important; }

        /* Overdue bars — red dashed outline */
        .gantt-theme .bar-overdue .bar {
          stroke: #ef4444 !important;
          stroke-width: 1.5 !important;
          stroke-dasharray: 4 2 !important;
        }
        /* Completed bars — muted */
        .gantt-theme .bar-completed .bar { opacity: 0.45; }
        .gantt-theme .bar-completed .handle { display: none; }

        /* Milestone bars — diamond shape via border-radius trick */
        .gantt-theme .bar-milestone .bar {
          stroke: #a8a29e !important;
          stroke-width: 1.5 !important;
          stroke-dasharray: 2 2 !important;
        }

        /* Today line colour already driven by CSS variable */
      `}</style>

      <div className="flex bg-white" style={{ height: chartH }}>
        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex flex-col border-r border-stone-200" style={{ width: leftW }}>
          {/* Header */}
          <div
            className="flex items-end gap-3 px-4 pb-2.5 bg-stone-50 border-b border-stone-200 flex-shrink-0"
            style={{ height: GANTT_HEADER_H }}
          >
            <span className="text-[10.5px] font-medium text-stone-400 uppercase tracking-wider" style={{ width: 60 }}>Code</span>
            <span className="text-[10.5px] font-medium text-stone-400 uppercase tracking-wider flex-1">Task</span>
            <span className="text-[10.5px] font-medium text-stone-400 uppercase tracking-wider" style={{ width: 62 }}>Priority</span>
            <span className="text-[10.5px] font-medium text-stone-400 uppercase tracking-wider" style={{ width: 76 }}>Status</span>
          </div>

          {/* Body — scrollTop driven by frappe-gantt scroll */}
          <div
            ref={leftBodyRef}
            className="flex-1 overflow-hidden"
            style={{ height: bodyH }}
          >
            {rows.map((row, i) => {
              if (row.__group) {
                return (
                  <div
                    key={`grp-${i}`}
                    className="flex items-center px-4 bg-stone-50 border-b border-stone-100"
                    style={{ height: ROW_H }}
                  >
                    <span className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
                      {row.title}
                    </span>
                  </div>
                );
              }

              const pcfg = getTaskPriorityConfig(row.priority);
              const scfg = getTaskStatusConfig(row.status);
              const isCompleted = ["Neutralized", "Retired"].includes(row.status);
              const isOverdue   = !isCompleted && row.due_date && row.due_date < today;

              return (
                <button
                  key={row.id}
                  onClick={() => onTaskClick(row)}
                  className={`w-full flex items-center gap-3 px-4 border-b border-stone-100 hover:bg-stone-50 transition-colors text-left ${isCompleted ? "opacity-50" : ""}`}
                  style={{ height: ROW_H }}
                >
                  <span className="text-[11px] font-mono text-stone-400 flex-shrink-0" style={{ width: 60 }}>
                    {row.task_code > 0 ? formatTaskCode(row.task_code) : "—"}
                  </span>
                  <span
                    className={`text-[12.5px] flex-1 truncate ${isOverdue ? "text-red-600" : "text-stone-700"}`}
                    title={row.title}
                  >
                    {row.title}
                  </span>
                  <span
                    className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${pcfg.bg} ${pcfg.color}`}
                    style={{ width: 62 }}
                  >
                    <span className={`w-1 h-1 rounded-full ${pcfg.dot}`} />
                    {row.priority}
                  </span>
                  <span
                    className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${scfg.bg} ${scfg.color}`}
                    style={{ width: 76 }}
                  >
                    <span className={`w-1 h-1 rounded-full ${scfg.dot}`} />
                    <span className="truncate">{row.status}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Gantt timeline ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div ref={ganttWrapRef} className="h-full" />
        </div>
      </div>
    </div>
  );
}
