import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  Inbox,
  ListTodo,
  Monitor,
  Printer,
  Users,
} from "lucide-react";
import { createSupabaseServerClient, getRole } from "@/lib/supabase-server";

type HomeData = {
  assets: number;
  printers: number;
  contacts: number;
  activeTasks: number;
  overdueTasks: number;
  followUpsDue: number;
  openPrinterTickets: number;
  pendingRequests: number;
};

const EMPTY_DATA: HomeData = {
  assets: 0,
  printers: 0,
  contacts: 0,
  activeTasks: 0,
  overdueTasks: 0,
  followUpsDue: 0,
  openPrinterTickets: 0,
  pendingRequests: 0,
};

async function getHomeData(): Promise<HomeData> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [
      assets,
      printers,
      contacts,
      activeTasks,
      overdueTasks,
      followUpsDue,
      openPrinterTickets,
      pendingRequests,
    ] = await Promise.all([
      supabase.from("assets").select("id", { count: "exact", head: true }),
      supabase.from("printers").select("id", { count: "exact", head: true }),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .not("status", "in", '("Neutralized","Retired")'),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .not("status", "in", '("Neutralized","Retired")')
        .not("due_date", "is", null)
        .lt("due_date", today),
      supabase
        .from("task_follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("is_done", false)
        .lte("due_date", today),
      supabase
        .from("printer_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["Open", "In Progress", "Waiting Supplier"]),
      supabase
        .from("asset_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["Pending", "In Review"]),
    ]);

    return {
      assets: assets.count ?? 0,
      printers: printers.count ?? 0,
      contacts: contacts.count ?? 0,
      activeTasks: activeTasks.count ?? 0,
      overdueTasks: overdueTasks.count ?? 0,
      followUpsDue: followUpsDue.count ?? 0,
      openPrinterTickets: openPrinterTickets.count ?? 0,
      pendingRequests: pendingRequests.count ?? 0,
    };
  } catch (err) {
    console.error("[Home] getHomeData failed:", err);
    return EMPTY_DATA;
  }
}

export default async function Home() {
  const [role, data] = await Promise.all([getRole(), getHomeData()]);
  const isAdmin = role === "admin";

  const modules = [
    {
      href: "/assets?view=dashboard",
      label: "Assets",
      value: data.assets,
      sub: "Inventory dashboard",
      icon: Monitor,
      accent: "#C04F28",
    },
    {
      href: "/printers",
      label: "Printers",
      value: data.printers,
      sub: `${data.openPrinterTickets} open ticket${data.openPrinterTickets === 1 ? "" : "s"}`,
      icon: Printer,
      accent: "#415445",
    },
    {
      href: "/tasks",
      label: "Tasks",
      value: data.activeTasks,
      sub: `${data.overdueTasks} overdue - ${data.followUpsDue} follow-up${data.followUpsDue === 1 ? "" : "s"} due`,
      icon: ListTodo,
      accent: "#859474",
    },
    {
      href: "/people",
      label: "Contacts",
      value: data.contacts,
      sub: "Active people",
      icon: Users,
      accent: "#7c8f5a",
    },
    {
      href: "/requests",
      label: "Requests",
      value: data.pendingRequests,
      sub: "Pending review",
      icon: Inbox,
      accent: "#d97706",
      adminOnly: true,
    },
  ].filter((item) => !item.adminOnly || isAdmin);

  const attentionItems = [
    {
      label: "Overdue tasks",
      value: data.overdueTasks,
      href: "/tasks?view=list&overdue=1",
    },
    {
      label: "Follow-ups due",
      value: data.followUpsDue,
      href: "/tasks",
    },
    {
      label: "Printer tickets",
      value: data.openPrinterTickets,
      href: "/printers",
    },
    ...(isAdmin
      ? [{
          label: "Asset requests",
          value: data.pendingRequests,
          href: "/requests",
        }]
      : []),
  ];

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>
            Operations
          </p>
        </div>
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
          Home
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {modules.map(({ href, label, value, sub, icon: Icon, accent }) => (
          <Link
            key={href}
            href={href}
            className="group bg-white border border-stone-200 rounded-xl px-4 py-4 hover:bg-stone-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${accent}18`, color: accent }}
              >
                <Icon size={15} />
              </span>
              <ArrowUpRight size={13} className="text-stone-300 group-hover:text-stone-500" />
            </div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-stone-400 mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums" style={{ color: "#414042" }}>
                {value}
              </span>
            </div>
            <p className="text-[12px] text-stone-400 mt-1">{sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              <p className="text-[12px] font-medium text-stone-500 uppercase tracking-wider">Needs Attention</p>
            </div>
          </div>
          <div className="divide-y divide-stone-50">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-stone-50 transition-colors"
              >
                <span className="text-[13px] text-stone-700">{item.label}</span>
                <span className={`text-[12px] font-medium tabular-nums ${item.value > 0 ? "text-amber-700" : "text-stone-400"}`}>
                  {item.value}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={14} className="text-stone-400" />
            <p className="text-[12px] font-medium text-stone-500 uppercase tracking-wider">Quick Links</p>
          </div>
          <div className="space-y-2">
            <QuickLink href="/assets?view=list" label="Asset list" />
            <QuickLink href="/assets?view=dashboard" label="Asset dashboard" />
            <QuickLink href="/printers/monitor" label="Printer monitor" />
            <QuickLink href="/tasks?view=kanban" label="Task kanban" />
            {isAdmin && <QuickLink href="/audit" label="Audit log" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-stone-100 hover:bg-stone-50 transition-colors"
    >
      <span className="text-[13px] text-stone-700">{label}</span>
      <ArrowUpRight size={12} className="text-stone-300" />
    </Link>
  );
}
