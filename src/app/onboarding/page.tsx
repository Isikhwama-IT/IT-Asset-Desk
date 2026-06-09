import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { OnboardingCase } from "@/types/database";
import OnboardingList from "@/components/OnboardingList";

export const dynamic = "force-dynamic";

async function getCases(): Promise<OnboardingCase[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("onboarding_cases")
    .select("id, status, current_section, first_name, last_name, job_title, location, start_date, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as OnboardingCase[];
}

export default async function OnboardingPage() {
  const cases = await getCases();
  const activeCount = cases.filter((c) => c.status === "active").length;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>
            IT Operations
          </p>
        </div>
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
          Onboarding
          <span className="ml-2 text-lg text-stone-400 font-normal">{activeCount}</span>
        </h1>
      </div>
      <OnboardingList cases={cases} />
    </div>
  );
}
