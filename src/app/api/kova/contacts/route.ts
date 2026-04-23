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
      .from("contacts")
      .select("id, full_name, email, department:departments(name), job_level:job_levels(name), location:locations(name)")
      .ilike("full_name", `%${q}%`)
      .eq("is_active", true)
      .limit(20);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ contacts: data ?? [] });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
