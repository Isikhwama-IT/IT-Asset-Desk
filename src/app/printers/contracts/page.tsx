import Link from "next/link";
import { ArrowLeft, FileCheck, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import PrinterContractsClient from "@/components/PrinterContractsClient";
import type { PrinterContract, PrinterWithRelations } from "@/types/database";

export const dynamic = "force-dynamic";

async function getData() {
  const supabase = await createSupabaseServerClient();

  const [{ data: contracts }, { data: printers }] = await Promise.all([
    supabase
      .from("printer_contracts")
      .select("*, printer_contract_assignments(printer_id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("printers")
      .select("id, name, printer_code, status, model")
      .is("archived_at", null)
      .order("printer_code"),
  ]);

  return {
    contracts: (contracts ?? []) as (PrinterContract & { printer_contract_assignments: { printer_id: string }[] })[],
    printers: (printers ?? []) as Pick<PrinterWithRelations, "id" | "name" | "printer_code" | "status" | "model">[],
  };
}

export default async function PrinterContractsPage() {
  const { contracts, printers } = await getData();

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <Link
        href="/printers"
        className="inline-flex items-center gap-1.5 text-[12px] mb-6 transition-colors hover:opacity-70"
        style={{ color: "#859474" }}
      >
        <ArrowLeft size={13} /> Back to Printers
      </Link>

      <div className="mb-6 fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>
            Consumables & Support
          </p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
              <span className="inline-flex items-center gap-2">
                <FileCheck size={20} style={{ color: "#C04F28" }} />
                Service Contracts
              </span>
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">Maintenance, support and service agreements</p>
          </div>
        </div>
      </div>

      <PrinterContractsClient contracts={contracts} printers={printers} />
    </div>
  );
}
