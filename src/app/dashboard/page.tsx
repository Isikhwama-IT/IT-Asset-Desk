import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDate, getStatusConfig, getCategoryIcon } from "@/lib/utils";
import Link from "next/link";
import { Monitor, Users, Package, AlertTriangle, ArrowUpRight, Clock, ShieldAlert } from "lucide-react";
import type { AssetWithRelations } from "@/types/database";
import AnimatedStatCards from "@/components/AnimatedStatCards";
import DashboardCharts from "@/components/DashboardChartsWrapper";

type ExpiryAlert = { asset: AssetWithRelations; type: "Warranty" | "EOL"; date: string; daysRemaining: number };

const EMPTY_DATA = {
  totalAssets: 0, totalContacts: 0, statusCounts: {} as Record<string, number>,
  topCategories: [] as [string, number][], topDepartments: [] as { name: string; count: number }[],
  assetsByMonth: [] as { month: string; count: number }[], recentAssets: [] as AssetWithRelations[],
  alertAssets: [] as AssetWithRelations[], expiryAlerts: [] as ExpiryAlert[],
  warrantyAlertDays: 60, inUse: 0, inStorage: 0,
};

async function getDashboardData() {
  try {
  const supabase = await createSupabaseServerClient();
  const [
    { data: assets },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("assets").select(`
      *,
      category:categories(*),
      status:statuses(*),
      owning_department:departments(*),
      assigned_to_contact:contacts!assets_assigned_to_contact_id_fkey(*),
      location:locations(*),
      assigned_job_level:job_levels(*)
    `).order("asset_code"),
    supabase.from("contacts").select("*").eq("is_active", true),
  ]);

  // app_settings table may not exist yet — fetch separately with fallback
  let warrantyAlertDays = 60;
  try {
    const { data: appSettings } = await supabase.from("app_settings").select("key, value");
    warrantyAlertDays = parseInt(
      (appSettings ?? []).find((s: { key: string; value: string }) => s.key === "warranty_alert_days")?.value ?? "60",
      10
    );
  } catch {
    // table not yet created, use default
  }

  const typedAssets = (assets ?? []) as AssetWithRelations[];

  const statusCounts: Record<string, number> = {};
  for (const a of typedAssets) {
    const name = a.status?.name ?? "Unknown";
    statusCounts[name] = (statusCounts[name] ?? 0) + 1;
  }

  const categoryCounts: Record<string, number> = {};
  for (const a of typedAssets) {
    const name = a.category?.name ?? "Unknown";
    categoryCounts[name] = (categoryCounts[name] ?? 0) + 1;
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Department breakdown
  const deptCounts: Record<string, number> = {};
  for (const a of typedAssets) {
    const name = a.owning_department?.name ?? "Unassigned";
    deptCounts[name] = (deptCounts[name] ?? 0) + 1;
  }
  const topDepartments = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Monthly asset additions by purchase date
  const monthCounts: Record<string, number> = {};
  for (const a of typedAssets) {
    if (!a.purchase_date) continue;
    const d = new Date(a.purchase_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const assetsByMonth = Object.entries(monthCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      const [y, m] = key.split("-");
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      return { month: label, count };
    });

  const recentAssets = [...typedAssets]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const alertAssets = typedAssets.filter(
    (a) => ["Damaged", "Under Repair", "Lost", "Stolen"].includes(a.status?.name ?? "")
  );

  const now = new Date();
  const threshold = new Date(now.getTime() + warrantyAlertDays * 24 * 60 * 60 * 1000);

  const expiryAlerts: ExpiryAlert[] = [];
  for (const asset of typedAssets) {
    if (asset.warranty_end_date) {
      const d = new Date(asset.warranty_end_date);
      if (d <= threshold) {
        const daysRemaining = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        expiryAlerts.push({ asset, type: "Warranty", date: asset.warranty_end_date, daysRemaining });
      }
    }
    if (asset.expected_end_of_life_date) {
      const d = new Date(asset.expected_end_of_life_date);
      if (d <= threshold) {
        const daysRemaining = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        expiryAlerts.push({ asset, type: "EOL", date: asset.expected_end_of_life_date, daysRemaining });
      }
    }
  }
  expiryAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    totalAssets: typedAssets.length,
    totalContacts: (contacts ?? []).length,
    statusCounts,
    topCategories,
    topDepartments,
    assetsByMonth,
    recentAssets,
    alertAssets,
    expiryAlerts,
    warrantyAlertDays,
    inUse: statusCounts["In Use"] ?? 0,
    inStorage: statusCounts["In Storage"] ?? 0,
  };
  } catch (err) {
    console.error("[Dashboard] getDashboardData failed:", err);
    return EMPTY_DATA;
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const statCards = [
    {
      label: "Total Assets",
      value: data.totalAssets,
      icon: Package,
      sub: `${data.inUse} in use · ${data.inStorage} in storage`,
      accent: "#C04F28",
      iconBg: "#f0d4c8",
      iconColor: "#C04F28",
    },
    {
      label: "Active Users",
      value: data.totalContacts,
      icon: Users,
      sub: "Contacts & teams",
      accent: "#415445",
      iconBg: "#eef3e6",
      iconColor: "#415445",
    },
    {
      label: "In Use",
      value: data.inUse,
      icon: Monitor,
      sub: `${data.totalAssets > 0 ? Math.round((data.inUse / data.totalAssets) * 100) : 0}% of inventory`,
      accent: "#859474",
      iconBg: "#f0f2ec",
      iconColor: "#859474",
    },
    {
      label: "Needs Attention",
      value: data.alertAssets.length,
      icon: AlertTriangle,
      sub: "Damaged · Repair · Lost · Stolen",
      accent: data.alertAssets.length > 0 ? "#dc2626" : "#859474",
      iconBg: data.alertAssets.length > 0 ? "#fef2f2" : "#f0f2ec",
      iconColor: data.alertAssets.length > 0 ? "#dc2626" : "#859474",
    },
  ];

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8 fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Overview</p>
        </div>
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
          Dashboard
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <AnimatedStatCards cards={statCards} />

      {/* Charts */}
      <DashboardCharts
        statusData={Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }))}
        departmentData={data.topDepartments}
        monthlyData={data.assetsByMonth}
      />

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Top categories */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 fade-up fade-up-2 card-lift">
          <p className="text-[12px] font-medium uppercase tracking-wider mb-4" style={{ color: "#859474" }}>Top Categories</p>
          <div className="space-y-2">
            {data.topCategories.map(([name, count]) => (
              <div key={name} className="flex items-center gap-3 py-1">
                <span className="text-base w-6 text-center">{getCategoryIcon(name)}</span>
                <span className="flex-1 text-[13px] text-stone-700">{name}</span>
                <span className="text-[12px] font-medium text-stone-500 font-mono bg-stone-50 px-2 py-0.5 rounded-md">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 fade-up fade-up-3 card-lift">
          <p className="text-[12px] font-medium uppercase tracking-wider mb-4" style={{ color: "#859474" }}>
            Needs Attention
          </p>
          {data.alertAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-stone-300">
              <Package size={24} className="mb-2" />
              <p className="text-[12px]">All clear</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.alertAssets.slice(0, 6).map((asset) => {
                const cfg = getStatusConfig(asset.status?.name);
                return (
                  <Link
                    key={asset.id}
                    href={`/assets/${asset.id}`}
                    className="flex items-center gap-2.5 py-1.5 group"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-stone-700 truncate group-hover:text-stone-900">
                        #{asset.asset_code} · {asset.category?.name}
                      </p>
                      <p className={`text-[11px] ${cfg.color}`}>{asset.status?.name}</p>
                    </div>
                    <ArrowUpRight size={11} className="text-stone-300 group-hover:text-stone-500 flex-shrink-0" />
                  </Link>
                );
              })}
              {data.alertAssets.length > 6 && (
                <Link href="/assets" className="text-[11px] text-stone-400 hover:text-stone-600">
                  +{data.alertAssets.length - 6} more →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expiring Soon */}
      {data.expiryAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden mb-8 fade-up">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-100 bg-amber-50">
            <div className="flex items-center gap-2">
              <ShieldAlert size={13} className="text-amber-600" />
              <p className="text-[12px] font-medium text-amber-700 uppercase tracking-wider">Expiring Soon</p>
            </div>
            <span className="text-[11px] text-amber-500">
              {data.warrantyAlertDays}-day window · {data.expiryAlerts.length} item{data.expiryAlerts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-stone-50">
            {data.expiryAlerts.slice(0, 8).map((alert, i) => {
              const past = alert.daysRemaining < 0;
              const soon = !past && alert.daysRemaining <= 7;
              return (
                <Link
                  key={`${alert.asset.id}-${alert.type}-${i}`}
                  href={`/assets/${alert.asset.id}`}
                  className="grid grid-cols-[2rem_1fr_6rem_8rem_4rem] gap-3 px-5 py-3 items-center hover:bg-stone-50 transition-colors group"
                >
                  <span className="text-base text-center">{getCategoryIcon(alert.asset.category?.name)}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-stone-800 truncate">{alert.asset.description}</p>
                    <p className="text-[11px] text-stone-400">#{alert.asset.asset_code}</p>
                  </div>
                  <span className={`text-[11.5px] font-medium px-2 py-0.5 rounded-full w-fit ${
                    alert.type === "Warranty" ? "bg-sky-50 text-sky-700" : "bg-purple-50 text-purple-700"
                  }`}>
                    {alert.type}
                  </span>
                  <span className="text-[12px] text-stone-500">{formatDate(alert.date)}</span>
                  <span className={`text-[12px] font-medium text-right tabular-nums ${
                    past ? "text-red-600" : soon ? "text-amber-600" : "text-stone-500"
                  }`}>
                    {past ? "PAST" : `${alert.daysRemaining}d`}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent assets */}
      <div className="bg-white rounded-xl border border-stone-200 fade-up fade-up-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-stone-400" />
            <p className="text-[12px] font-medium text-stone-500 uppercase tracking-wider">Recent Assets</p>
          </div>
          <Link href="/assets" className="text-[12px] flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: "#C04F28" }}>
            View all <ArrowUpRight size={11} />
          </Link>
        </div>
        <div className="divide-y divide-stone-50">
          {data.recentAssets.map((asset) => {
            const cfg = getStatusConfig(asset.status?.name);
            return (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-stone-50 transition-colors group"
              >
                <span className="text-lg w-7 text-center">{getCategoryIcon(asset.category?.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-stone-800 truncate">
                    {asset.description}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    #{asset.asset_code} · {asset.owning_department?.name ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
                    <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                    {asset.status?.name}
                  </span>
                  <p className="text-[11px] text-stone-400 mt-0.5">{formatDate(asset.purchase_date)}</p>
                </div>
                <ArrowUpRight size={13} className="text-stone-200 group-hover:text-stone-400 ml-1" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
