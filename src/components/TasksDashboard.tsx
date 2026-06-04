"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Flame,
  ListTodo,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  daysSince,
  formatTaskCode,
  getTaskPriorityConfig,
  getTaskStatusConfig,
  lastActivityDate,
} from "@/lib/tasks";
import type {
  DashboardAlertTask,
  DashboardData,
  DashboardFollowUp,
  DashboardRecentUpdate,
} from "@/types/database";

// ── Status bar colours ────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Intel:        "#38bdf8",
  Briefed:      "#818cf8",
  "Active Ops": "#10b981",
  "Re-Routed":  "#fbbf24",
  Standby:      "#a8a29e",
};

interface Props {
  data: DashboardData;
  onTaskClick: (task: DashboardAlertTask) => void;
}

export default function TasksDashboard({ data, onTaskClick }: Props) {
  const router = useRouter();

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const today = new Date().toISOString().slice(0, 10);
  const { pulse, alerts, focus, statusSpread, byCategory, followUps, recentlyUpdated } = data;

  const hasAlerts =
    alerts.overdueTasksAlert.length > 0 ||
    alerts.hotNoDueDate.length > 0 ||
    alerts.goneQuiet.length > 0 ||
    alerts.staleStatus.length > 0 ||
    alerts.activeOpsCount > 5 ||
    alerts.overdueFollowUps.length > 0;

  const totalSpread = statusSpread.reduce((s, x) => s + x.count, 0);
  const maxCategory = byCategory[0]?.count ?? 1;

  return (
    <div className="space-y-8">
      {/* ── Section 1: Pulse ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-4">
        <PulseCard
          label="Active Tasks"
          value={pulse.active}
          icon={<ListTodo size={14} />}
          tone="calm"
        />
        <PulseCard
          label="Overdue"
          value={pulse.overdue}
          icon={<AlertTriangle size={14} />}
          tone={pulse.overdue > 0 ? "danger" : "neutral"}
        />
        <PulseCard
          label="Due Today"
          value={pulse.dueToday}
          icon={<Zap size={14} />}
          tone={pulse.dueToday > 0 ? "warn" : "neutral"}
        />
        <PulseCard
          label="Due This Week"
          value={pulse.dueThisWeek}
          icon={<Clock size={14} />}
          tone="neutral"
        />
        <PulseCard
          label="Hot Priority"
          value={pulse.hot}
          icon={<Flame size={14} />}
          tone={pulse.hot > 0 ? "danger" : "neutral"}
        />
        <PulseCard
          label="Follow-ups Due"
          value={pulse.followupsDue}
          icon={<Users size={14} />}
          tone={pulse.followupsDue > 0 ? "warn" : "neutral"}
        />
      </div>

      {/* ── Section 2: Alerts ─────────────────────────────────────────────── */}
      {hasAlerts && (
        <div>
          <SectionHeader icon={<Bell size={14} />} label="Alerts" />
          <div className="space-y-3">
            {alerts.overdueTasksAlert.length > 0 && (
              <AlertCard
                severity="red"
                title={`${alerts.overdueTasksAlert.length} overdue task${alerts.overdueTasksAlert.length !== 1 ? "s" : ""}`}
                tasks={alerts.overdueTasksAlert}
                onTaskClick={onTaskClick}
              />
            )}

            {alerts.hotNoDueDate.length > 0 && (
              <AlertCard
                severity="red"
                title={`${alerts.hotNoDueDate.length} Hot task${alerts.hotNoDueDate.length !== 1 ? "s" : ""} with no due date`}
                tasks={alerts.hotNoDueDate}
                onTaskClick={onTaskClick}
              />
            )}

            {alerts.activeOpsCount > 5 && (
              <AlertCard
                severity="yellow"
                title={`Active Ops overload — ${alerts.activeOpsCount} tasks in Active Ops (threshold: 5)`}
                tasks={[]}
                onTaskClick={onTaskClick}
              />
            )}

            {alerts.overdueFollowUps.length > 0 && (
              <FollowUpAlertCard
                severity="orange"
                title={`${alerts.overdueFollowUps.length} overdue follow-up${alerts.overdueFollowUps.length !== 1 ? "s" : ""}`}
                followUps={alerts.overdueFollowUps}
                onTaskClick={onTaskClick}
              />
            )}

            {alerts.goneQuiet.length > 0 && (
              <AlertCard
                severity="orange"
                title={`${alerts.goneQuiet.length} task${alerts.goneQuiet.length !== 1 ? "s" : ""} gone quiet — no update in 7+ days`}
                tasks={alerts.goneQuiet}
                onTaskClick={onTaskClick}
              />
            )}

            {alerts.staleStatus.length > 0 && (
              <AlertCard
                severity="yellow"
                title={`${alerts.staleStatus.length} task${alerts.staleStatus.length !== 1 ? "s" : ""} with stale status — unchanged for 14+ days`}
                tasks={alerts.staleStatus}
                onTaskClick={onTaskClick}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Focus ──────────────────────────────────────────────── */}
      {focus.length > 0 && (
        <div>
          <SectionHeader
            icon={<Target size={14} />}
            label="Focus"
            subtitle="Highest priority tasks requiring your attention"
          />
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="grid grid-cols-[5rem_1fr_7rem_7rem_6rem_10rem] gap-3 px-4 py-2.5 bg-stone-50 border-b border-stone-100">
              {["Code", "Task", "Priority", "Status", "Due", "Status Age"].map((h) => (
                <span key={h} className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                  {h}
                </span>
              ))}
            </div>
            <div className="divide-y divide-stone-50">
              {focus.map((task) => {
                const statusCfg = getTaskStatusConfig(task.status);
                const priorityCfg = getTaskPriorityConfig(task.priority);
                const isOverdue = task.due_date && task.due_date < today;
                const isToday = task.due_date === today;
                const lastNote = task.task_updates.length > 0
                  ? [...task.task_updates].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].body
                  : null;

                return (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="w-full grid grid-cols-[5rem_1fr_7rem_7rem_6rem_10rem] gap-3 px-4 py-3 items-start text-left hover:bg-stone-50 transition-colors"
                  >
                    <span className="text-[12px] font-mono text-stone-400 pt-0.5">
                      {formatTaskCode(task.task_code)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-stone-800 truncate">{task.title}</span>
                      {lastNote && (
                        <span className="block text-[11px] text-stone-400 truncate mt-0.5">
                          Last note: {lastNote}
                        </span>
                      )}
                    </span>
                    <Badge label={task.priority} cfg={priorityCfg} />
                    <Badge label={task.status} cfg={statusCfg} />
                    <span
                      className={`text-[12px] pt-0.5 ${
                        isOverdue ? "text-red-600 font-medium" : isToday ? "text-amber-600 font-medium" : "text-stone-400"
                      }`}
                    >
                      {task.due_date
                        ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
                        : "—"}
                    </span>
                    <span className="text-[12px] text-stone-400 pt-0.5">
                      In {task.status} for {daysSince(task.status_changed_at)}d
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 4: Metrics ────────────────────────────────────────────── */}
      {(statusSpread.length > 0 || byCategory.length > 0) && (
        <div>
          <SectionHeader icon={<TrendingUp size={14} />} label="Metrics" />
          <div className="grid grid-cols-2 gap-6">
            {/* Status Spread */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-4">Status Spread</p>
              {statusSpread.length === 0 ? (
                <p className="text-[13px] text-stone-400 italic">No active tasks</p>
              ) : (
                <>
                  {/* Segmented bar */}
                  <div className="flex rounded-lg overflow-hidden h-3 mb-3 gap-px">
                    {statusSpread.map((s) => (
                      <div
                        key={s.status}
                        style={{
                          width: `${(s.count / totalSpread) * 100}%`,
                          background: STATUS_COLORS[s.status] ?? "#a8a29e",
                        }}
                        title={`${s.status}: ${s.count}`}
                      />
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {statusSpread.map((s) => {
                      const cfg = getTaskStatusConfig(s.status);
                      return (
                        <div key={s.status} className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${cfg.dot.replace("bg-", "bg-")}`}
                            style={{ background: STATUS_COLORS[s.status] }} />
                          <span className="text-[11px] text-stone-500">{s.status}</span>
                          <span className="text-[11px] font-medium text-stone-700">{s.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* By Category */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-4">By Category</p>
              {byCategory.length === 0 ? (
                <p className="text-[13px] text-stone-400 italic">No categorised tasks</p>
              ) : (
                <div className="space-y-2.5">
                  {byCategory.map((c) => (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className="text-[12px] text-stone-600 w-28 flex-shrink-0">{c.category}</span>
                      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(c.count / maxCategory) * 100}%`, background: "#415445" }}
                        />
                      </div>
                      <span className="text-[12px] font-medium text-stone-700 w-4 text-right">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 5: Follow-ups ─────────────────────────────────────────── */}
      <div>
        <SectionHeader icon={<Users size={14} />} label="Follow-ups" />
        {followUps.overdue.length === 0 && followUps.dueSoon.length === 0 ? (
          <p className="text-[13px] text-stone-400 italic py-2">No follow-ups pending</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <FollowUpList
              title="Overdue"
              items={followUps.overdue}
              today={today}
              onTaskClick={onTaskClick}
              emptyMsg="No overdue follow-ups"
            />
            <FollowUpList
              title="Due This Week"
              items={followUps.dueSoon}
              today={today}
              onTaskClick={onTaskClick}
              emptyMsg="Nothing due this week"
            />
          </div>
        )}
      </div>

      {/* ── Section 6: Recently Updated ───────────────────────────────────── */}
      {recentlyUpdated.length > 0 && (
        <div>
          <SectionHeader icon={<CheckCircle2 size={14} />} label="Recently Updated" />
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="divide-y divide-stone-50">
              {recentlyUpdated.map((u) => {
                if (!u.task) return null;
                const cfg = getTaskStatusConfig(u.task.status);
                const ago = timeAgo(u.created_at);
                return (
                  <button
                    key={u.id}
                    onClick={() => u.task && onTaskClick(u.task as unknown as DashboardAlertTask)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                  >
                    <span className="text-[12px] font-mono text-stone-400 flex-shrink-0 w-16">
                      {formatTaskCode(u.task.task_code)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-stone-800 truncate">{u.task.title}</span>
                      <span className="block text-[11px] text-stone-400 truncate mt-0.5">"{u.body}"</span>
                    </span>
                    <span className="text-[11px] text-stone-400 flex-shrink-0">{ago}</span>
                    <Badge label={u.task.status} cfg={cfg} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <div className="flex items-center gap-2">
        <span className="text-stone-400">{icon}</span>
        <h2 className="text-[14px] font-semibold text-stone-700">{label}</h2>
      </div>
      {subtitle && <p className="text-[12px] text-stone-400">{subtitle}</p>}
    </div>
  );
}

const TONE_STYLES = {
  neutral: { bg: "#f5f5f4", icon: "#78716c", value: "#414042" },
  calm:    { bg: "#eef3e6", icon: "#415445", value: "#415445" },
  warn:    { bg: "#fef9c3", icon: "#b45309", value: "#92400e" },
  danger:  { bg: "#fee2e2", icon: "#dc2626", value: "#b91c1c" },
};

function PulseCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: keyof typeof TONE_STYLES;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
      <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: s.bg, color: s.icon }}
        >
          {icon}
        </span>
        <span className="text-xl font-semibold tabular-nums" style={{ color: s.value }}>
          {value}
        </span>
      </div>
    </div>
  );
}

const ALERT_STYLES = {
  red:    { border: "border-red-100",    bg: "bg-red-50",    dot: "bg-red-500",    label: "text-red-700"    },
  orange: { border: "border-orange-100", bg: "bg-orange-50", dot: "bg-orange-500", label: "text-orange-700" },
  yellow: { border: "border-amber-100",  bg: "bg-amber-50",  dot: "bg-amber-400",  label: "text-amber-700"  },
};

function AlertCard({
  severity,
  title,
  tasks,
  onTaskClick,
}: {
  severity: keyof typeof ALERT_STYLES;
  title: string;
  tasks: DashboardAlertTask[];
  onTaskClick: (t: DashboardAlertTask) => void;
}) {
  const s = ALERT_STYLES[severity];
  return (
    <div className={`border ${s.border} ${s.bg} rounded-xl px-4 py-3`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
        <p className={`text-[12.5px] font-medium ${s.label}`}>{title}</p>
      </div>
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onTaskClick(t)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-[12px] text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <span className="font-mono text-stone-400">{formatTaskCode(t.task_code)}</span>
              <span className="max-w-[180px] truncate">{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowUpAlertCard({
  severity,
  title,
  followUps,
  onTaskClick,
}: {
  severity: keyof typeof ALERT_STYLES;
  title: string;
  followUps: DashboardFollowUp[];
  onTaskClick: (t: DashboardAlertTask) => void;
}) {
  const s = ALERT_STYLES[severity];
  return (
    <div className={`border ${s.border} ${s.bg} rounded-xl px-4 py-3`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
        <p className={`text-[12.5px] font-medium ${s.label}`}>{title}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {followUps.map((f) => {
          const name = f.contact?.full_name ?? f.external_contact?.name ?? "Unknown";
          return (
            <button
              key={f.id}
              onClick={() => f.task && onTaskClick(f.task as unknown as DashboardAlertTask)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-[12px] text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <span className="font-mono text-stone-400">
                {f.task ? formatTaskCode(f.task.task_code) : "—"}
              </span>
              <span>{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FollowUpList({
  title,
  items,
  today,
  onTaskClick,
  emptyMsg,
}: {
  title: string;
  items: DashboardFollowUp[];
  today: string;
  onTaskClick: (t: DashboardAlertTask) => void;
  emptyMsg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
        <p className="text-[12px] font-medium text-stone-600">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] text-stone-400 italic">{emptyMsg}</p>
      ) : (
        <div className="divide-y divide-stone-50">
          {items.map((f) => {
            const name = f.contact?.full_name ?? f.external_contact?.name ?? "Unknown";
            const isOverdue = f.due_date < today;
            const isToday = f.due_date === today;
            return (
              <button
                key={f.id}
                onClick={() => f.task && onTaskClick(f.task as unknown as DashboardAlertTask)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-stone-700 truncate">{name}</p>
                  {f.task && (
                    <p className="text-[11px] text-stone-400 truncate mt-0.5">
                      {formatTaskCode(f.task.task_code)} · {f.task.title}
                    </p>
                  )}
                  {f.note && <p className="text-[11px] text-stone-400 truncate">{f.note}</p>}
                </div>
                <span
                  className={`text-[11px] flex-shrink-0 font-medium mt-0.5 ${
                    isOverdue ? "text-red-600" : isToday ? "text-amber-600" : "text-stone-400"
                  }`}
                >
                  {new Date(f.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ label, cfg }: { label: string; cfg: { color: string; dot: string; bg: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {label}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
