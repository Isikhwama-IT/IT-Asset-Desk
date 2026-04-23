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

    const [{ data: contact, error: contactError }, { data: assets, error: assetsError }] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, full_name, email, department:departments(name), job_level:job_levels(name), location:locations(name)")
        .eq("id", id)
        .single(),
      supabase
        .from("assets")
        .select("id, asset_code, description, serial_number, category:categories(name), status:statuses(name), location:locations(name)")
        .eq("assigned_to_contact_id", id)
        .is("archived_at", null),
    ]);

    if (contactError) {
      if (contactError.code === "PGRST116") return Response.json({ error: "Contact not found" }, { status: 404 });
      return Response.json({ error: contactError.message }, { status: 500 });
    }

    return Response.json({ contact, assets: assets ?? [] });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
