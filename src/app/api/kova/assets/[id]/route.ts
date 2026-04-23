import { createClient } from "@supabase/supabase-js";
import { verifyKovaApiKey } from "@/lib/kova-auth";
import type { Database } from "@/types/database";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyKovaApiKey(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const supabase = serviceClient();

    const { data: asset, error } = await supabase
      .from("assets")
      .select(`
        id, asset_code, description, serial_number, purchase_date,
        warranty_start_date, warranty_end_date, expected_end_of_life_date,
        notes, performance_rating,
        category:categories(name),
        status:statuses(name),
        owning_department:departments(name),
        location:locations(name),
        assigned_to_contact:contacts!assets_assigned_to_contact_id_fkey(id, full_name, email),
        assigned_job_level:job_levels(name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return Response.json({ error: "Asset not found" }, { status: 404 });
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ asset });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
