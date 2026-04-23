import { createSupabaseServerClient } from "@/lib/supabase-server";
import PeopleClientView from "@/components/PeopleClientView";
import type { Contact, Department, JobLevel, Location, AssetWithRelations } from "@/types/database";

async function getPeopleData() {
  const supabase = await createSupabaseServerClient();
  const [
    { data: contacts },
    { data: assets },
    { data: departments },
    { data: jobLevels },
    { data: locations },
  ] = await Promise.all([
    supabase.from("contacts").select("*, department:departments(*), job_level:job_levels(*), location:locations(*)").order("full_name"),
    supabase.from("assets").select(`
      *,
      category:categories(*),
      status:statuses(*),
      owning_department:departments(*),
      assigned_to_contact:contacts!assets_assigned_to_contact_id_fkey(*),
      location:locations(*),
      assigned_job_level:job_levels(*)
    `).eq("status_id", "18edf5ed-5824-4a8f-8f06-213211a1143d"), // In Use
    supabase.from("departments").select("*").order("name"),
    supabase.from("job_levels").select("*").order("name"),
    supabase.from("locations").select("*").eq("is_active", true).order("name"),
  ]);

  const assetsByContact: Record<string, AssetWithRelations[]> = {};
  for (const a of (assets ?? []) as AssetWithRelations[]) {
    if (a.assigned_to_contact_id) {
      if (!assetsByContact[a.assigned_to_contact_id]) {
        assetsByContact[a.assigned_to_contact_id] = [];
      }
      assetsByContact[a.assigned_to_contact_id].push(a);
    }
  }

  return {
    contacts: (contacts ?? []) as (Contact & { department: Department | null; job_level: JobLevel | null; location: Location | null })[],
    assetsByContact,
    departments: departments ?? [],
    jobLevels: jobLevels ?? [],
    locations: (locations ?? []) as Location[],
  };
}

export default async function PeoplePage() {
  const { contacts, assetsByContact, departments, jobLevels, locations } = await getPeopleData();

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Directory</p>
        </div>
        <h1 className="text-2xl font-semibold" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
          Users
          <span className="ml-2 text-lg font-normal" style={{ color: "#a8a29e" }}>{contacts.length}</span>
        </h1>
      </div>

      <PeopleClientView
        contacts={contacts}
        assetsByContact={assetsByContact}
        departments={departments}
        jobLevels={jobLevels}
        locations={locations}
      />
    </div>
  );
}
