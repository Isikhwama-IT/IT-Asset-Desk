import { createSupabaseServerClient, getRole } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AuditClient from "@/components/AuditClient";
import type { ActivityLog } from "@/types/database";

export default async function AuditPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8 fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Admin</p>
        </div>
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
          Audit Log
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Track all user activity — logins, changes, and deletions.
        </p>
      </div>
      <AuditClient logs={(data ?? []) as ActivityLog[]} />
    </div>
  );
}
