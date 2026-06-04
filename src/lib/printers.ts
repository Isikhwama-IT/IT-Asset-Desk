export const PRINTER_STATUSES = ["Active", "Needs Attention", "Offline", "Retired"] as const;
export const CONSUMABLE_STATUSES = ["OK", "Low", "Critical", "Out", "Ordered"] as const;
export const ORDER_STATUSES = ["Requested", "Ordered", "Backordered", "Received", "Cancelled"] as const;
export const TICKET_STATUSES = ["Open", "In Progress", "Waiting Supplier", "Resolved", "Closed", "Cancelled"] as const;
export const TICKET_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

type BadgeConfig = {
  color: string;
  dot: string;
  bg: string;
};

export function getPrinterStatusConfig(status: string | null | undefined): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    Active: { color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" },
    "Needs Attention": { color: "text-amber-700", dot: "bg-amber-400", bg: "bg-amber-50" },
    Offline: { color: "text-red-700", dot: "bg-red-500", bg: "bg-red-50" },
    Retired: { color: "text-stone-500", dot: "bg-stone-400", bg: "bg-stone-100" },
  };
  return map[status ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}

export function getConsumableStatusConfig(status: string | null | undefined): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    OK: { color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" },
    Low: { color: "text-amber-700", dot: "bg-amber-400", bg: "bg-amber-50" },
    Critical: { color: "text-orange-700", dot: "bg-orange-500", bg: "bg-orange-50" },
    Out: { color: "text-red-700", dot: "bg-red-500", bg: "bg-red-50" },
    Ordered: { color: "text-sky-700", dot: "bg-sky-400", bg: "bg-sky-50" },
  };
  return map[status ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}

export function getOrderStatusConfig(status: string | null | undefined): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    Requested: { color: "text-sky-700", dot: "bg-sky-400", bg: "bg-sky-50" },
    Ordered: { color: "text-indigo-700", dot: "bg-indigo-400", bg: "bg-indigo-50" },
    Backordered: { color: "text-amber-700", dot: "bg-amber-400", bg: "bg-amber-50" },
    Received: { color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" },
    Cancelled: { color: "text-stone-500", dot: "bg-stone-400", bg: "bg-stone-100" },
  };
  return map[status ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}

export function getTicketStatusConfig(status: string | null | undefined): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    Open: { color: "text-amber-700", dot: "bg-amber-400", bg: "bg-amber-50" },
    "In Progress": { color: "text-sky-700", dot: "bg-sky-400", bg: "bg-sky-50" },
    "Waiting Supplier": { color: "text-indigo-700", dot: "bg-indigo-400", bg: "bg-indigo-50" },
    Resolved: { color: "text-emerald-700", dot: "bg-emerald-500", bg: "bg-emerald-50" },
    Closed: { color: "text-stone-500", dot: "bg-stone-400", bg: "bg-stone-100" },
    Cancelled: { color: "text-stone-500", dot: "bg-stone-400", bg: "bg-stone-100" },
  };
  return map[status ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}

export function getPriorityConfig(priority: string | null | undefined): BadgeConfig {
  const map: Record<string, BadgeConfig> = {
    Low: { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-100" },
    Normal: { color: "text-sky-700", dot: "bg-sky-400", bg: "bg-sky-50" },
    High: { color: "text-orange-700", dot: "bg-orange-500", bg: "bg-orange-50" },
    Urgent: { color: "text-red-700", dot: "bg-red-500", bg: "bg-red-50" },
  };
  return map[priority ?? ""] ?? { color: "text-stone-500", dot: "bg-stone-300", bg: "bg-stone-50" };
}
