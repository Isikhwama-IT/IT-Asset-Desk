import Link from "next/link";
import { Package2, FileCheck } from "lucide-react";
import { createSupabaseServerClient, getRole } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const [
    { data: categories },
    { data: statuses },
    { data: departments },
    { data: locations },
    { data: jobLevels },
    { data: settings },
  ] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase.from("statuses").select("*").order("name"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("locations").select("*").order("name"),
    supabase.from("job_levels").select("*").order("name"),
    supabase.from("app_settings").select("*"),
  ]);

  const warrantyAlertDays = parseInt(
    settings?.find((s) => s.key === "warranty_alert_days")?.value ?? "60",
    10
  );
  const snmpAutoPollEnabled = (settings?.find((s) => s.key === "snmp_auto_poll_enabled")?.value ?? "true") === "true";

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-8 fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Admin</p>
        </div>
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>Settings</h1>
        <p className="text-sm text-stone-500 mt-0.5">Manage lookup tables and system configuration.</p>
      </div>

      <SettingsClient
        categories={categories ?? []}
        statuses={statuses ?? []}
        departments={departments ?? []}
        locations={locations ?? []}
        jobLevels={jobLevels ?? []}
        warrantyAlertDays={warrantyAlertDays}
        snmpAutoPollEnabled={snmpAutoPollEnabled}
      />

      {/* ── Printer configuration ─────────────────────────────────────── */}
      <div className="mt-10 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Printer Configuration</p>
        </div>
        <p className="text-[12.5px] text-stone-500">Reference data used by the printers module.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/settings/consumable-types"
          className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-5 py-4 hover:border-stone-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f0d4c8" }}>
            <Package2 size={16} style={{ color: "#C04F28" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-stone-800 group-hover:text-stone-900">Consumable Types</p>
            <p className="text-[11.5px] text-stone-400">Toner, developer, drum — part numbers, yields, unit prices</p>
          </div>
          <span className="text-stone-300 group-hover:text-stone-500 text-lg">›</span>
        </Link>

        <Link
          href="/printers/contracts"
          className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl px-5 py-4 hover:border-stone-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#eef3e6" }}>
            <FileCheck size={16} style={{ color: "#415445" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-stone-800 group-hover:text-stone-900">Service Contracts</p>
            <p className="text-[11.5px] text-stone-400">Maintenance and support agreements per printer</p>
          </div>
          <span className="text-stone-300 group-hover:text-stone-500 text-lg">›</span>
        </Link>
      </div>
    </div>
  );
}
