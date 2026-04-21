import { createSupabaseServerClient } from "@/lib/supabase-server";
import AssetsClientFilters from "@/components/AssetsClientFilters";
import type { AssetWithRelations } from "@/types/database";

const PAGE_SIZE = 50;

interface SearchParams {
  page?: string;
  q?: string;
  status?: string;
  cat?: string;
  dept?: string;
  site?: string;
  missing?: string;
}

async function getAssetsData(params: SearchParams) {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const [
    { data: statuses },
    { data: categories },
    { data: departments },
    { data: locations },
    { data: jobLevels },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("statuses").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("locations").select("*").eq("is_active", true).order("name"),
    supabase.from("job_levels").select("*").order("name"),
    supabase.from("contacts").select("*").eq("is_active", true).order("full_name"),
  ]);

  // Build filtered, paginated assets query
  let query = supabase.from("assets").select(
    `*,
    category:categories(*),
    status:statuses(*),
    owning_department:departments(*),
    assigned_to_contact:contacts!assets_assigned_to_contact_id_fkey(*),
    location:locations(*),
    assigned_job_level:job_levels(*)`,
    { count: "exact" }
  );

  if (params.q) {
    query = query.or(
      `description.ilike.%${params.q}%,serial_number.ilike.%${params.q}%`
    );
  }
  if (params.status) {
    const ids = params.status.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("status_id", ids);
  }
  if (params.cat) {
    const ids = params.cat.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("category_id", ids);
  }
  if (params.dept) {
    const ids = params.dept.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("owning_department_id", ids);
  }
  if (params.site) {
    const ids = params.site.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("location_id", ids);
  }
  if (params.missing) {
    const fields = params.missing.split(",").filter(Boolean);
    if (fields.includes("dept")) query = query.is("owning_department_id", null);
    if (fields.includes("site")) query = query.is("location_id", null);
    if (fields.includes("contact")) query = query.is("assigned_to_contact_id", null);
  }

  const { data: assets, count } = await query
    .range(offset, offset + PAGE_SIZE - 1)
    .order("asset_code");

  return {
    assets: (assets ?? []) as AssetWithRelations[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    statuses: statuses ?? [],
    categories: categories ?? [],
    departments: departments ?? [],
    locations: locations ?? [],
    jobLevels: jobLevels ?? [],
    contacts: contacts ?? [],
  };
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const {
    assets,
    total,
    page,
    pageSize,
    statuses,
    categories,
    departments,
    locations,
    jobLevels,
    contacts,
  } = await getAssetsData(params);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-3.5 rounded-full inline-block" style={{ background: "#C04F28" }} />
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>Inventory</p>
        </div>
        <h1
          className="text-2xl font-semibold"
          style={{ letterSpacing: "-0.03em", color: "#414042" }}
        >
          Assets
          <span className="ml-2 text-lg text-stone-400 font-normal">
            {total}
          </span>
        </h1>
      </div>

      <AssetsClientFilters
        assets={assets}
        total={total}
        page={page}
        pageSize={pageSize}
        statuses={statuses}
        categories={categories}
        departments={departments}
        locations={locations}
        jobLevels={jobLevels}
        contacts={contacts}
      />
    </div>
  );
}
