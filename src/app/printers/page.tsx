import PrintersClient from "@/components/PrintersClient";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { PrinterWithRelations } from "@/types/database";

interface SearchParams {
  q?: string;
  status?: string;
  toner?: string;
  paper?: string;
  site?: string;
}

async function getPrintersData(params: SearchParams) {
  const supabase = await createSupabaseServerClient();

  const [
    { data: departments },
    { data: locations },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("departments").select("*").order("name"),
    supabase.from("locations").select("*").eq("is_active", true).order("name"),
    supabase.from("contacts").select("*").eq("is_active", true).order("full_name"),
  ]);

  let query = supabase
    .from("printers")
    .select(
      `*,
      department:departments(*),
      location:locations(*),
      primary_contact:contacts!printers_primary_contact_id_fkey(*)`,
      { count: "exact" }
    )
    .is("archived_at", null);

  if (params.q) {
    query = query.or(
      `name.ilike.%${params.q}%,serial_number.ilike.%${params.q}%,ip_address.ilike.%${params.q}%,manufacturer.ilike.%${params.q}%,model.ilike.%${params.q}%,supplier.ilike.%${params.q}%`
    );
  }
  if (params.status) {
    const values = params.status.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("status", values);
  }
  if (params.toner) {
    const values = params.toner.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("toner_status", values);
  }
  if (params.paper) {
    const values = params.paper.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("paper_status", values);
  }
  if (params.site) {
    const values = params.site.split(",").filter(Boolean);
    if (values.length > 0) query = query.in("location_id", values);
  }

  const { data: printers, count } = await query.order("printer_code");

  return {
    printers: (printers ?? []) as PrinterWithRelations[],
    total: count ?? 0,
    departments: departments ?? [],
    locations: locations ?? [],
    contacts: contacts ?? [],
  };
}

export default async function PrintersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { printers, total, departments, locations, contacts } = await getPrintersData(params);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Consumables & Support</p>
        </div>
        <h1
          className="text-2xl font-semibold"
          style={{ letterSpacing: "-0.03em", color: "#414042" }}
        >
          Printers
          <span className="ml-2 text-lg text-stone-400 font-normal">{total}</span>
        </h1>
      </div>

      <PrintersClient
        printers={printers}
        total={total}
        departments={departments}
        locations={locations}
        contacts={contacts}
      />
    </div>
  );
}
