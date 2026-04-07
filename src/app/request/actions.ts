"use server";

import { createClient } from "@supabase/supabase-js";
import { sendAssetRequestEmail } from "@/lib/email";

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getPublicCategories() {
  const supabase = getAnonClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");
  if (error) return [];
  return data ?? [];
}

export async function submitAssetRequest(form: {
  requesterName: string;
  requesterEmail: string;
  categoryId: string;
  categoryName: string;
  reason: string;
}): Promise<{ success?: true; error?: string }> {
  if (!form.requesterName.trim()) return { error: "Name is required." };
  if (!form.requesterEmail.trim() || !form.requesterEmail.includes("@"))
    return { error: "A valid email is required." };
  if (!form.categoryId) return { error: "Please select a category." };

  const id = crypto.randomUUID();
  const supabase = getAnonClient();
  const { error } = await supabase
    .from("asset_requests")
    .insert({
      id,
      requester_name: form.requesterName.trim(),
      requester_email: form.requesterEmail.trim(),
      category_id: form.categoryId,
      category_name: form.categoryName,
      reason: form.reason.trim() || null,
    });

  if (error) return { error: error.message };

  try {
    await sendAssetRequestEmail({
      requestId: id,
      requesterName: form.requesterName.trim(),
      requesterEmail: form.requesterEmail.trim(),
      categoryName: form.categoryName,
      reason: form.reason.trim(),
    });
  } catch (e) {
    console.error("Email send failed:", e);
  }

  return { success: true };
}
