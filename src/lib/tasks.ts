export const TASK_STATUSES = ["Intel", "Briefed", "Active Ops", "Re-Routed", "Standby", "Neutralized", "Retired"] as const;
export const TASK_PRIORITIES = ["Cold", "Standard", "Priority", "Hot"] as const;
export const TASK_CATEGORIES = ["IT", "Development", "Data", "Automation", "Presentation", "Admin", "General"] as const;
export const TASK_SOURCES = ["Walk-in", "Email", "Meeting", "WhatsApp", "Call"] as const;

export const ACTIVE_STATUSES: readonly string[] = ["Intel", "Briefed", "Active Ops", "Re-Routed", "Standby"];

type BadgeConfig = { color: string; dot: string; bg: string };

export function getTaskStatusConfig(status: string | null | undefined): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    Intel:        { color: "text-sky-700",     dot: "bg-sky-400",     bg: "bg-sky-50"     },
    Briefed:      { color: "text-indigo-700",  dot: "bg-indigo-400",  bg: "bg-indigo-50"  },
    "Active Ops": { color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" },
    "Re-Routed":  { color: "text-amber-700",   dot: "bg-amber-400",   bg: "bg-amber-50"   },
    Standby:      { color: "text-stone-600",   dot: "bg-stone-400",   bg: "bg-stone-100"  },
    Neutralized:  { color: "text-red-700",     dot: "bg-red-500",     bg: "bg-red-50"     },
    Retired:      { color: "text-stone-500",   dot: "bg-stone-300",   bg: "bg-stone-100"  },
  };
  return map[status ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}

export function getTaskPriorityConfig(priority: string | null | undefined): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    Cold:     { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-100" },
    Standard: { color: "text-sky-700",   dot: "bg-sky-400",   bg: "bg-sky-50"    },
    Priority: { color: "text-amber-700", dot: "bg-amber-400", bg: "bg-amber-50"  },
    Hot:      { color: "text-red-700",   dot: "bg-red-500",   bg: "bg-red-50"    },
  };
  return map[priority ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}

const PRIORITY_ORDER: Record<string, number> = { Hot: 4, Priority: 3, Standard: 2, Cold: 1 };

export function sortTasks<T extends { priority: string; due_date: string | null; created_at: string }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 0;
    const pb = PRIORITY_ORDER[b.priority] ?? 0;
    if (pb !== pa) return pb - pa;

    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;

    return b.created_at.localeCompare(a.created_at);
  });
}

export function formatTaskCode(code: number): string {
  return `TSK-${String(code).padStart(3, "0")}`;
}

export function daysSince(date: string | null | undefined): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

export function lastActivityDate(updates: { created_at: string }[]): string | null {
  if (!updates.length) return null;
  return updates.reduce((max, u) => (u.created_at > max ? u.created_at : max), updates[0].created_at);
}
