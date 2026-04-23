import { createClient } from "@supabase/supabase-js";
import { verifyKovaApiKey } from "@/lib/kova-auth";
import type { Database } from "@/types/database";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  if (!verifyKovaApiKey(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.length < 2) {
    return Response.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  try {
    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("assets")
      .select("id, asset_code, description, serial_number, category:categories(name), status:statuses(name), location:locations(name), assigned_to_contact:contacts!assets_assigned_to_contact_id_fkey(full_name)")
      .or(`description.ilike.%${q}%,serial_number.ilike.%${q}%`)
      .is("archived_at", null)
      .limit(20);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ assets: data ?? [] });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
