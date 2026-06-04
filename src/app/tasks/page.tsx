import TasksClient from "@/components/TasksClient";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { daysSince, lastActivityDate, sortTasks, TASK_STATUSES } from "@/lib/tasks";
import type {
  CalendarData,
  CalendarFollowUp,
  DashboardAlertTask,
  DashboardData,
  DashboardFollowUp,
  DashboardRecentUpdate,
  Task,
  TaskWithActivity,
} from "@/types/database";

interface SearchParams {
  view?: string;
  status?: string;
  priority?: string;
  category?: string;
  overdue?: string;
}

// ─── Dashboard data ───────────────────────────────────────────────────────────

async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const [
    { data: rawTasks },
    { data: rawFollowUps },
    { data: rawUpdates },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, task_code, title, status, priority, category, due_date, status_changed_at, created_at, task_updates(body, created_at)")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("task_follow_ups")
      .select("id, task_id, due_date, note, task:tasks(id, task_code, title), contact:contacts(id, full_name), external_contact:external_contacts(id, name)")
      .eq("is_done", false)
      .order("due_date"),

    supabase
      .from("task_updates")
      .select("id, body, created_at, task:tasks(id, task_code, title, status)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const allTasks = (rawTasks ?? []) as DashboardAlertTask[];
  const activeTasks = allTasks.filter((t) => !["Neutralized", "Retired"].includes(t.status));
  const followUps = (rawFollowUps ?? []) as DashboardFollowUp[];

  // ── Pulse ──────────────────────────────────────────────────────────────────
  const pulse = {
    active: activeTasks.length,
    overdue: activeTasks.filter((t) => t.due_date && t.due_date < today).length,
    dueToday: allTasks.filter((t) => t.due_date === today).length,
    dueThisWeek: allTasks.filter((t) => t.due_date && t.due_date >= today && t.due_date <= week).length,
    hot: activeTasks.filter((t) => t.priority === "Hot").length,
    followupsDue: followUps.filter((f) => f.due_date <= today).length,
  };

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const overdueTasksAlert = activeTasks.filter((t) => t.due_date && t.due_date < today);
  const hotNoDueDate = activeTasks.filter((t) => t.priority === "Hot" && !t.due_date);
  const goneQuiet = activeTasks.filter((t) => {
    const updates = t.task_updates ?? [];
    if (!updates.length) return daysSince(t.created_at) >= 7;
    return daysSince(lastActivityDate(updates)) >= 7;
  });
  const staleStatus = activeTasks.filter((t) => daysSince(t.status_changed_at) >= 14);
  const activeOpsCount = activeTasks.filter((t) => t.status === "Active Ops").length;
  const overdueFollowUps = followUps.filter((f) => f.due_date < today);

  // ── Focus ──────────────────────────────────────────────────────────────────
  const focus = sortTasks(activeTasks).slice(0, 7);

  // ── Status spread ──────────────────────────────────────────────────────────
  const statusCounts = activeTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusSpread = TASK_STATUSES.filter((s) => !["Neutralized", "Retired"].includes(s))
    .map((s) => ({ status: s, count: statusCounts[s] ?? 0 }))
    .filter((s) => s.count > 0);

  // ── By category ────────────────────────────────────────────────────────────
  const categoryCounts = activeTasks.reduce<Record<string, number>>((acc, t) => {
    if (t.category) acc[t.category] = (acc[t.category] ?? 0) + 1;
    return acc;
  }, {});
  const byCategory = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // ── Recently updated ───────────────────────────────────────────────────────
  const seen = new Set<string>();
  const recentlyUpdated = (rawUpdates ?? [])
    .filter((u) => {
      const t = u.task as { id: string } | null;
      if (!t || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    })
    .slice(0, 5) as DashboardRecentUpdate[];

  return {
    pulse,
    alerts: { overdueTasksAlert, hotNoDueDate, goneQuiet, staleStatus, activeOpsCount, overdueFollowUps },
    focus,
    statusSpread,
    byCategory,
    followUps: {
      overdue: overdueFollowUps,
      dueSoon: followUps.filter((f) => f.due_date >= today && f.due_date <= week),
    },
    recentlyUpdated,
  };
}

// ─── List data ────────────────────────────────────────────────────────────────

async function getListData(params: SearchParams) {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const hasStatusFilter = Boolean(params.status);

  let query = supabase
    .from("tasks")
    .select("*, task_updates(created_at)", { count: "exact" })
    .is("archived_at", null);

  if (hasStatusFilter) {
    const values = params.status!.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("status", values);
  } else {
    query = query.not("status", "in", '("Neutralized","Retired")');
  }

  if (params.priority) {
    const values = params.priority.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("priority", values);
  }
  if (params.category) {
    const values = params.category.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("category", values);
  }
  if (params.overdue === "1") {
    query = query.lt("due_date", today).not("due_date", "is", null);
  }

  const { data, count } = await query.order("created_at", { ascending: false });
  return { tasks: (data ?? []) as TaskWithActivity[], total: count ?? 0 };
}

// ─── Kanban data ─────────────────────────────────────────────────────────────

async function getKanbanData(params: SearchParams) {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  // Fetch ALL non-archived tasks (all 7 statuses) with last update body
  let query = supabase
    .from("tasks")
    .select("*, task_updates(body, created_at)", { count: "exact" })
    .is("archived_at", null);

  // Kanban ignores the status URL param — columns handle visibility
  if (params.priority) {
    const values = params.priority.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("priority", values);
  }
  if (params.category) {
    const values = params.category.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("category", values);
  }
  if (params.overdue === "1") {
    query = query.lt("due_date", today).not("due_date", "is", null);
  }

  const { data, count } = await query.order("created_at", { ascending: false });
  return { tasks: (data ?? []) as TaskWithActivity[], total: count ?? 0 };
}

// ─── Calendar data ────────────────────────────────────────────────────────────

async function getCalendarData(params: SearchParams): Promise<CalendarData> {
  const supabase = await createSupabaseServerClient();
  const hasStatusFilter = Boolean(params.status);

  let taskQuery = supabase
    .from("tasks")
    .select(
      "id, task_code, title, status, status_reason, status_changed_at, priority, category, source, due_date, created_at, updated_at, archived_at"
    )
    .is("archived_at", null);

  if (hasStatusFilter) {
    const values = params.status!.split(",").filter(Boolean);
    if (values.length > 0) taskQuery = taskQuery.in("status", values);
  } else {
    taskQuery = taskQuery.not("status", "in", '("Neutralized","Retired")');
  }
  if (params.priority) {
    const values = params.priority.split(",").filter(Boolean);
    if (values.length > 0) taskQuery = taskQuery.in("priority", values);
  }
  if (params.category) {
    const values = params.category.split(",").filter(Boolean);
    if (values.length > 0) taskQuery = taskQuery.in("category", values);
  }
  // No overdue filter — calendar shows all dates

  const [{ data: tasks }, { data: followUps }] = await Promise.all([
    taskQuery.order("priority").order("created_at", { ascending: false }),
    supabase
      .from("task_follow_ups")
      .select(
        "id, task_id, due_date, task:tasks(id, task_code, title, status), contact:contacts(id, full_name), external_contact:external_contacts(id, name)"
      )
      .eq("is_done", false)
      .not("due_date", "is", null),
  ]);

  return {
    tasks: (tasks ?? []) as Task[],
    followUps: (followUps ?? []) as CalendarFollowUp[],
  };
}

// ─── Active count (always needed for header) ──────────────────────────────────

async function getActiveCount() {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null)
    .not("status", "in", '("Neutralized","Retired")');
  return count ?? 0;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = params.view ?? "dashboard";

  const [activeCount, viewData] = await Promise.all([
    getActiveCount(),
    view === "list"     ? getListData(params)     :
    view === "kanban"   ? getKanbanData(params)   :
    view === "calendar" ? getCalendarData(params) :
    view === "gantt"    ? getListData(params)     :
    getDashboardData(),
  ]);

  const isListLike = view === "list" || view === "kanban" || view === "gantt";
  const isCalendar = view === "calendar";
  const isDashboard = !isListLike && !isCalendar;

  const dashboardData = isDashboard ? (viewData as DashboardData) : undefined;
  const listData = isListLike ? (viewData as { tasks: TaskWithActivity[]; total: number }) : undefined;
  const calendarData = isCalendar ? (viewData as CalendarData) : undefined;

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>
            Operations
          </p>
        </div>
        <h1
          className="text-2xl font-semibold"
          style={{ letterSpacing: "-0.03em", color: "#414042" }}
        >
          Tasks
          <span className="ml-2 text-lg text-stone-400 font-normal">{activeCount}</span>
        </h1>
      </div>

      <TasksClient
        view={view}
        tasks={listData?.tasks ?? []}
        total={listData?.total ?? 0}
        activeCount={activeCount}
        dashboardData={dashboardData}
        calendarData={calendarData}
      />
    </div>
  );
}
