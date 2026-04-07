"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity";
import { redirect } from "next/navigation";

export async function signIn(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await logActivity({ action: "login_failed", userEmail: email, details: { reason: error.message } });
    return { error: "Invalid email or password." };
  }

  const user = data.user;
  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "login",
  });

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await logActivity({
      userId: user.id,
      userName: user.user_metadata?.full_name ?? null,
      userEmail: user.email ?? null,
      action: "logout",
    });
  }

  await supabase.auth.signOut();
  redirect("/login");
}
