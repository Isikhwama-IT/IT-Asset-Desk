import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { OnboardingCase, OnboardingSpendItem, OnboardingPrinterAssignment } from "@/types/database";
import OnboardingCaseView from "@/components/OnboardingCaseView";

export const dynamic = "force-dynamic";

export default async function OnboardingCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [
    { data: caseRow },
    { data: spendItems },
    { data: printerAssignments },
    { data: externalContacts },
  ] = await Promise.all([
    supabase.from("onboarding_cases").select("*").eq("id", id).single(),
    supabase.from("onboarding_spend_items").select("*").eq("case_id", id).order("created_at"),
    supabase.from("onboarding_printer_assignments").select("*").eq("case_id", id).order("created_at"),
    supabase.from("external_contacts").select("id, name, company, email").order("name"),
  ]);

  if (!caseRow) notFound();

  return (
    <OnboardingCaseView
      initialCase={caseRow as OnboardingCase}
      initialSpendItems={(spendItems ?? []) as OnboardingSpendItem[]}
      initialPrinterAssignments={(printerAssignments ?? []) as OnboardingPrinterAssignment[]}
      initialExternalContacts={(externalContacts ?? []) as Array<{ id: string; name: string; company: string | null; email: string | null }>}
    />
  );
}
