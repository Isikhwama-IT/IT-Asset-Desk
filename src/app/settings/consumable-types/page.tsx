import Link from "next/link";
import { ArrowLeft, Package2 } from "lucide-react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getRole } from "@/lib/supabase-server";
import ConsumableTypesAdminClient from "@/components/ConsumableTypesAdminClient";
import type { ConsumableType } from "@/types/database";

export const dynamic = "force-dynamic";

async function getData() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("consumable_types")
    .select("*")
    .order("part_number");
  return (data ?? []) as ConsumableType[];
}

export default async function ConsumableTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const role = await getRole();
  if (role !== "admin") redirect("/dashboard");

  const consumableTypes = await getData();
  const { from } = await searchParams;

  const backHref = from?.startsWith("/printers/") ? from : "/settings";
  const backLabel = from?.startsWith("/printers/") ? "Back to Printer" : "Back to Settings";

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-[12px] mb-6 transition-colors hover:opacity-70"
        style={{ color: "#859474" }}
      >
        <ArrowLeft size={13} /> {backLabel}
      </Link>

      <div className="mb-6 fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Admin · Settings</p>
        </div>
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
          <span className="inline-flex items-center gap-2">
            <Package2 size={20} style={{ color: "#C04F28" }} />
            Consumable Types
          </span>
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Manage toner, developer, and other consumable reference data. Add unit prices here to enable cost estimates.
        </p>
      </div>

      <ConsumableTypesAdminClient initialTypes={consumableTypes} />
    </div>
  );
}
