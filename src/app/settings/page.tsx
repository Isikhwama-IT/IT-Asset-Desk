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

  return (
    <div className="p-8 max-w-3xl">
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
      />
    </div>
  );
}
