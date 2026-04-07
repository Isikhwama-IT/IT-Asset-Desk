import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

type LogParams = {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, unknown>;
};

export async function logActivity(params: LogParams): Promise<void> {
  try {
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip") ??
      null;
    const userAgent = headersList.get("user-agent") ?? null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.from("activity_log").insert({
      user_id: params.userId ?? null,
      user_name: params.userName ?? null,
      user_email: params.userEmail ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      entity_label: params.entityLabel ?? null,
      details: params.details ?? null,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch {
    // Never let logging break the main operation
  }
}
