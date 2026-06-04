"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import {
  formatTaskCode,
  getTaskPriorityConfig,
  getTaskStatusConfig,
  sortTasks,
} from "@/lib/tasks";
import type { CalendarData, CalendarFollowUp, Task, TaskWithActivity } from "@/types/database";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_LEFT_COLOR: Record<string, string> = {
  Hot:      "#ef4444",
  Priority: "#f59e0b",
  Standard: "#38bdf8",
  Cold:     "#a8a29e",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sunday
  const days: Date[] = [];
  for (let i = -startOffset; i < 42 - startOffset; i++) {
    days.push(new Date(year, month, i + 1));
  }
  return days;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function taskToActivity(task: Task): TaskWithActivity {
  return { ...task, task_updates: [] };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: CalendarData;
  onTaskClick: (task: TaskWithActivity) => void;
}

export default function TasksCalendar({ data, onTaskClick }: Props) {
  const { tasks, followUps } = data;

  const now = new Date();
  const todayStr = toDateStr(now);

  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showUnscheduled, setShowUnscheduled] = useState(true);

  // ── Month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11); }
    else setCurrentMonth((m) => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0); }
    else setCurrentMonth((m) => m + 1);
  }
  function goToday() {
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  }

  // ── Data grouping ──────────────────────────────────────────────────────────
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.due_date) {
        if (!map.has(t.due_date)) map.set(t.due_date, []);
        map.get(t.due_date)!.push(t);
      }
    }
    return map;
  }, [tasks]);

  const followUpsByDate = useMemo(() => {
    const map = new Map<string, CalendarFollowUp[]>();
    for (const f of followUps) {
      if (f.due_date) {
        if (!map.has(f.due_date)) map.set(f.due_date, []);
        map.get(f.due_date)!.push(f);
      }
    }
    return map;
  }, [followUps]);

  const unscheduled = useMemo(
    () => sortTasks(tasks.filter((t) => !t.due_date)),
    [tasks]
  );

  const calendarDays = getCalendarDays(currentYear, currentMonth);
  const isCurrentMonthToday = now.getFullYear() === currentYear && now.getMonth() === currentMonth;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 items-start">
      {/* Calendar */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-stone-700">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!isCurrentMonthToday && (
              <button
                onClick={goToday}
                className="px-2.5 py-1.5 text-[12px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors mr-1"
              >
                Today
              </button>
            )}
            <button
              onClick={prevMonth}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-stone-100 transition-colors"
            >
              <ChevronLeft size={15} className="text-stone-500" />
            </button>
            <button
              onClick={nextMonth}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-stone-100 transition-colors"
            >
              <ChevronRight size={15} className="text-stone-500" />
            </button>
            <button
              onClick={() => setShowUnscheduled((v) => !v)}
              className={`ml-2 px-2.5 py-1.5 text-[12px] font-medium border rounded-lg transition-colors ${
                showUnscheduled
                  ? "border-stone-400 text-stone-800 bg-white"
                  : "border-stone-200 text-stone-500 bg-white hover:border-stone-300"
              }`}
            >
              Unscheduled
              {unscheduled.length > 0 && (
                <span className="ml-1.5 bg-stone-200 text-stone-600 text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                  {unscheduled.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {/* Day name headers */}
          <div className="grid grid-cols-7 border-b border-stone-100">
            {DAY_LABELS.map((d) => (
              <div key={d} className="py-2 text-center">
                <span className="text-[11px] font-medium text-stone-400">{d}</span>
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-stone-100">
            {calendarDays.map((day) => {
              const dateStr = toDateStr(day);
              const isThisMonth = day.getMonth() === currentMonth;
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              const dayTasks = tasksByDate.get(dateStr) ?? [];
              const dayFollowUps = followUpsByDate.get(dateStr) ?? [];
              const isExpanded = expandedDays.has(dateStr);
              const hasOverdue =
                isPast &&
                dayTasks.some((t) => !["Neutralized", "Retired"].includes(t.status));

              const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, 3);
              const hiddenCount = dayTasks.length - 3;

              return (
                <div
                  key={dateStr}
                  className={`min-h-[110px] p-1.5 ${isThisMonth ? "bg-white" : "bg-stone-50"} ${
                    isToday ? "ring-2 ring-inset ring-[#C04F28]/30" : ""
                  }`}
                >
                  {/* Date number row */}
                  <div className="flex items-center gap-1 mb-1">
                    <span
                      className={`text-[12px] w-6 h-6 flex items-center justify-center rounded-full font-medium flex-shrink-0 ${
                        isToday
                          ? "text-white font-semibold"
                          : isThisMonth
                          ? "text-stone-600"
                          : "text-stone-300"
                      }`}
                      style={isToday ? { background: "#C04F28" } : undefined}
                    >
                      {day.getDate()}
                    </span>
                    {hasOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* Task chips */}
                  <div className="space-y-0.5">
                    {visibleTasks.map((task) => (
                      <TaskChip
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick(taskToActivity(task))}
                      />
                    ))}

                    {!isExpanded && hiddenCount > 0 && (
                      <button
                        onClick={() =>
                          setExpandedDays((prev) => {
                            const next = new Set(prev);
                            next.add(dateStr);
                            return next;
                          })
                        }
                        className="w-full text-left text-[10px] text-stone-400 hover:text-stone-600 px-1 py-0.5 rounded hover:bg-stone-50 transition-colors"
                      >
                        +{hiddenCount} more
                      </button>
                    )}

                    {/* Follow-up chips */}
                    {dayFollowUps.map((fu) => (
                      <FollowUpChip
                        key={fu.id}
                        followUp={fu}
                        onClick={() => {
                          if (fu.task) {
                            onTaskClick({
                              id: fu.task.id,
                              task_code: fu.task.task_code,
                              title: fu.task.title,
                              status: fu.task.status as TaskWithActivity["status"],
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
                            });
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unscheduled panel */}
      {showUnscheduled && (
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-stone-100 bg-stone-50">
              <p className="text-[12px] font-semibold text-stone-600">
                Unscheduled
                {unscheduled.length > 0 && (
                  <span className="ml-1.5 text-stone-400 font-normal">{unscheduled.length}</span>
                )}
              </p>
            </div>
            {unscheduled.length === 0 ? (
              <p className="px-3 py-5 text-[12px] text-stone-400 italic text-center">
                All tasks have a due date
              </p>
            ) : (
              <div className="divide-y divide-stone-50 max-h-[calc(100vh-280px)] overflow-y-auto">
                {unscheduled.map((task) => {
                  const cfg = getTaskPriorityConfig(task.priority);
                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(taskToActivity(task))}
                      className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-stone-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-mono text-stone-400 leading-tight">
                          {formatTaskCode(task.task_code)}
                        </p>
                        <p className="text-[12.5px] text-stone-700 leading-snug truncate">
                          {task.title}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${cfg.bg} ${cfg.color}`}
                      >
                        <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                        {task.priority}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Task chip ────────────────────────────────────────────────────────────────

function TaskChip({ task, onClick }: { task: Task; onClick: () => void }) {
  const cfg = getTaskStatusConfig(task.status);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-colors text-left overflow-hidden"
      style={{
        borderLeftWidth: 2,
        borderLeftColor: PRIORITY_LEFT_COLOR[task.priority] ?? "#a8a29e",
      }}
    >
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className="text-[11px] text-stone-700 truncate flex-1 leading-tight">{task.title}</span>
    </button>
  );
}

// ─── Follow-up chip ───────────────────────────────────────────────────────────

function FollowUpChip({
  followUp,
  onClick,
}: {
  followUp: CalendarFollowUp;
  onClick: () => void;
}) {
  const name = followUp.contact?.full_name ?? followUp.external_contact?.name ?? "Unknown";
  const taskTitle = followUp.task?.title ?? "";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 border-dashed hover:bg-sky-100 transition-colors text-left overflow-hidden"
    >
      <Users size={9} className="text-sky-400 flex-shrink-0" />
      <span className="text-[11px] text-sky-700 truncate leading-tight">
        {name}
        {taskTitle ? ` · ${taskTitle}` : ""}
      </span>
    </button>
  );
}
