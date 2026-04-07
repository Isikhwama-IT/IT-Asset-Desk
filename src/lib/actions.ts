"use server";

import { revalidatePath } from "next/cache";
import type { Database, Json } from "@/types/database";
import { createSupabaseServerClient } from "./supabase-server";
import { logActivity } from "./activity";

type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
type AuditInsert = Database["public"]["Tables"]["asset_audit_log"]["Insert"];
type AssignmentInsert = Database["public"]["Tables"]["asset_assignments"]["Insert"];
type StatusHistoryInsert = Database["public"]["Tables"]["asset_status_history"]["Insert"];
type MaintenanceInsert = Database["public"]["Tables"]["maintenance_records"]["Insert"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

async function getAuthenticatedAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null, user: null };
  if (user.user_metadata?.role !== "admin")
    return { error: "Admin access required.", supabase: null, user: null };
  return { error: null, supabase, user };
}

// ─── ASSETS ────────────────────────────────────────────────────────────────

export async function createAsset(data: {
  description: string;
  category_id: string;
  serial_number?: string;
  purchase_date?: string;
  invoice_number?: string;
  cpu_gen?: string;
  owning_department_id?: string;
  status_id: string;
  location_id?: string;
  os_type?: string;
  os_license_type?: string;
  warranty_start_date?: string;
  warranty_end_date?: string;
  expected_end_of_life_date?: string;
  notes?: string;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: maxRow } = await supabase
    .from("assets")
    .select("asset_code")
    .order("asset_code", { ascending: false })
    .limit(1)
    .single();
  const nextCode = (maxRow?.asset_code ?? 0) + 1;

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );
  const assetId = crypto.randomUUID();
  const { error } = await supabase.from("assets").insert({
    id: assetId,
    asset_code: nextCode,
    ...clean,
  } as AssetInsert);
  if (error) return { error: error.message };

  // Audit log
  await supabase.from("asset_audit_log").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    changed_by_user_id: user.id,
    changed_by_name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
    action: "create",
    changes: clean as Json,
  } as AuditInsert);

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "create_asset", entityType: "asset", entityId: assetId,
    entityLabel: `#${nextCode} ${data.description}`,
  });

  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateAsset(
  id: string,
  data: {
    description?: string;
    category_id?: string;
    serial_number?: string;
    purchase_date?: string;
    invoice_number?: string;
    cpu_gen?: string;
    owning_department_id?: string;
    location_id?: string;
    assigned_job_level_id?: string;
    os_type?: string;
    os_license_type?: string;
    warranty_start_date?: string;
    warranty_end_date?: string;
    expected_end_of_life_date?: string;
    notes?: string;
  }
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );

  // Fetch current values for diff
  const { data: existing } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("assets")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  // Build diff for audit log
  if (existing) {
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    for (const [k, newVal] of Object.entries(clean)) {
      const oldVal = (existing as Record<string, unknown>)[k];
      if (oldVal !== newVal) changes[k] = { old: oldVal, new: newVal };
    }
    if (Object.keys(changes).length > 0) {
      await supabase.from("asset_audit_log").insert({
        id: crypto.randomUUID(),
        asset_id: id,
        changed_by_user_id: user.id,
        changed_by_name:
          user.user_metadata?.full_name ?? user.email ?? "Unknown",
        action: "update",
        changes: changes as Json,
      } as AuditInsert);
    }
  }

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "update_asset", entityType: "asset", entityId: id,
    entityLabel: existing?.description ?? id,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function changeAssetStatus(
  assetId: string,
  newStatusId: string,
  oldStatusId: string | null,
  reason?: string
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error: assetError } = await supabase
    .from("assets")
    .update({ status_id: newStatusId, updated_at: new Date().toISOString() })
    .eq("id", assetId);
  if (assetError) return { error: assetError.message };

  await supabase.from("asset_status_history").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    old_status_id: oldStatusId,
    new_status_id: newStatusId,
    changed_by_contact_id: null,
    reason: reason || null,
    changed_at: new Date().toISOString(),
  } as StatusHistoryInsert);

  await supabase.from("asset_audit_log").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    changed_by_user_id: user.id,
    changed_by_name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
    action: "update",
    changes: {
      status_id: { old: oldStatusId, new: newStatusId, reason: reason || null },
    } as Json,
  } as AuditInsert);

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "change_asset_status", entityType: "asset", entityId: assetId,
    details: { reason: reason ?? null },
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function assignAsset(data: {
  asset_id: string;
  contact_id: string;
  location_id?: string;
  notes?: string;
  assigned_at?: string;
  in_use_status_id: string;
  current_status_id: string;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  await supabase
    .from("asset_assignments")
    .update({ returned_at: new Date().toISOString() })
    .eq("asset_id", data.asset_id)
    .is("returned_at", null);

  const { error: assignError } = await supabase
    .from("asset_assignments")
    .insert({
      id: crypto.randomUUID(),
      asset_id: data.asset_id,
      contact_id: data.contact_id,
      location_id: data.location_id || null,
      notes: data.notes || null,
      assigned_at: data.assigned_at || new Date().toISOString(),
    } as AssignmentInsert);
  if (assignError) return { error: assignError.message };

  await supabase
    .from("assets")
    .update({
      assigned_to_contact_id: data.contact_id,
      status_id: data.in_use_status_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.asset_id);

  if (data.current_status_id !== data.in_use_status_id) {
    await supabase.from("asset_status_history").insert({
      id: crypto.randomUUID(),
      asset_id: data.asset_id,
      old_status_id: data.current_status_id,
      new_status_id: data.in_use_status_id,
      reason: "Assigned to contact",
      changed_at: new Date().toISOString(),
    } as StatusHistoryInsert);
  }

  await supabase.from("asset_audit_log").insert({
    id: crypto.randomUUID(),
    asset_id: data.asset_id,
    changed_by_user_id: user.id,
    changed_by_name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
    action: "update",
    changes: { assigned_to_contact_id: { old: null, new: data.contact_id } } as Json,
  } as AuditInsert);

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "assign_asset", entityType: "asset", entityId: data.asset_id,
    details: { contact_id: data.contact_id },
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${data.asset_id}`);
  revalidatePath("/people");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function unassignAsset(
  assetId: string,
  inStorageStatusId: string,
  currentStatusId: string
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  await supabase
    .from("asset_assignments")
    .update({ returned_at: new Date().toISOString() })
    .eq("asset_id", assetId)
    .is("returned_at", null);

  await supabase
    .from("assets")
    .update({
      assigned_to_contact_id: null,
      status_id: inStorageStatusId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);

  if (currentStatusId !== inStorageStatusId) {
    await supabase.from("asset_status_history").insert({
      id: crypto.randomUUID(),
      asset_id: assetId,
      old_status_id: currentStatusId,
      new_status_id: inStorageStatusId,
      reason: "Unassigned",
      changed_at: new Date().toISOString(),
    } as StatusHistoryInsert);
  }

  await supabase.from("asset_audit_log").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    changed_by_user_id: user.id,
    changed_by_name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
    action: "update",
    changes: { assigned_to_contact_id: { old: "assigned", new: null } } as Json,
  } as AuditInsert);

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "unassign_asset", entityType: "asset", entityId: assetId,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/people");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkChangeAssetStatus(
  assetIds: string[],
  newStatusId: string,
  reason?: string
): Promise<{ success?: boolean; error?: string }> {
  if (assetIds.length === 0) return { success: true };
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };

  const { data: existing } = await supabase
    .from("assets")
    .select("id, status_id")
    .in("id", assetIds);

  const { error: updateError } = await supabase
    .from("assets")
    .update({ status_id: newStatusId, updated_at: new Date().toISOString() })
    .in("id", assetIds);
  if (updateError) return { error: updateError.message };

  const changedAt = new Date().toISOString();
  const changedByName = user.user_metadata?.full_name ?? user.email ?? "Unknown";

  for (const assetId of assetIds) {
    const oldStatusId = existing?.find((e) => e.id === assetId)?.status_id ?? null;
    if (oldStatusId === newStatusId) continue;
    await supabase.from("asset_status_history").insert({
      id: crypto.randomUUID(),
      asset_id: assetId,
      old_status_id: oldStatusId,
      new_status_id: newStatusId,
      reason: reason || "Bulk status change",
      changed_at: changedAt,
    } as StatusHistoryInsert);
    await supabase.from("asset_audit_log").insert({
      id: crypto.randomUUID(),
      asset_id: assetId,
      changed_by_user_id: user.id,
      changed_by_name: changedByName,
      action: "update",
      changes: {
        status_id: { old: oldStatusId, new: newStatusId, reason: reason || "Bulk status change" },
      } as Json,
    } as AuditInsert);
  }

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "bulk_change_status", entityType: "asset",
    details: { asset_count: assetIds.length, reason: reason ?? null },
  });

  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── MAINTENANCE ────────────────────────────────────────────────────────────

export async function createMaintenanceRecord(data: {
  asset_id: string;
  issue_description: string;
  vendor_name?: string;
  status: string;
  cost?: number;
  opened_at?: string;
  resolution_notes?: string;
}) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );
  const { error } = await supabase.from("maintenance_records").insert({
    id: crypto.randomUUID(),
    ...clean,
    opened_at: data.opened_at || new Date().toISOString(),
  } as MaintenanceInsert);
  if (error) return { error: error.message };
  revalidatePath(`/assets/${data.asset_id}`);
  return { success: true };
}

export async function updateMaintenanceRecord(
  id: string,
  assetId: string,
  data: {
    status?: string;
    resolution_notes?: string;
    vendor_name?: string;
    cost?: number;
    closed_at?: string;
  }
) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );
  const { error } = await supabase
    .from("maintenance_records")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}

// ─── CONTACTS ───────────────────────────────────────────────────────────────

export async function createContact(data: {
  full_name: string;
  email?: string;
  department_id?: string;
  job_level_id?: string;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );
  const contactId = crypto.randomUUID();
  const { error } = await supabase
    .from("contacts")
    .insert({ id: contactId, ...clean, is_active: true } as ContactInsert);
  if (error) return { error: error.message };
  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "create_contact", entityType: "contact", entityId: contactId, entityLabel: data.full_name,
  });
  revalidatePath("/people");
  return { success: true };
}

export async function updateContact(
  id: string,
  data: {
    full_name?: string;
    email?: string;
    department_id?: string;
    job_level_id?: string;
  }
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );
  const { error } = await supabase
    .from("contacts")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "update_contact", entityType: "contact", entityId: id,
    entityLabel: data.full_name ?? undefined,
  });
  revalidatePath("/people");
  return { success: true };
}

export async function setContactActive(id: string, isActive: boolean) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("contacts")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: isActive ? "activate_contact" : "deactivate_contact", entityType: "contact", entityId: id,
  });
  revalidatePath("/people");
  return { success: true };
}

// ─── SETTINGS ───────────────────────────────────────────────────────────────

type LookupTable = "categories" | "statuses" | "departments" | "job_levels";

export async function createLookupItem(table: LookupTable, name: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  if (!name.trim()) return { error: "Name is required." };
  const { error } = await supabase.from(table).insert({ id: crypto.randomUUID(), name: name.trim() } as never);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/assets");
  revalidatePath("/people");
  return { success: true };
}

export async function updateLookupItem(table: LookupTable, id: string, name: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  if (!name.trim()) return { error: "Name is required." };
  const { error } = await supabase.from(table).update({ name: name.trim(), updated_at: new Date().toISOString() } as never).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/assets");
  revalidatePath("/people");
  return { success: true };
}

export async function deleteLookupItem(table: LookupTable, id: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  // Safety check: is this item used by any assets?
  const col = table === "categories" ? "category_id"
    : table === "statuses" ? "status_id"
    : table === "departments" ? "owning_department_id"
    : "assigned_job_level_id";
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq(col, id);
  if (count && count > 0) return { error: `Cannot delete — ${count} asset${count > 1 ? "s are" : " is"} using this.` };

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/assets");
  return { success: true };
}

export async function createLocation(name: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  if (!name.trim()) return { error: "Name is required." };
  const { error } = await supabase.from("locations").insert({ id: crypto.randomUUID(), name: name.trim(), is_active: true } as never);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/assets");
  return { success: true };
}

export async function updateLocation(id: string, name: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  if (!name.trim()) return { error: "Name is required." };
  const { error } = await supabase.from("locations").update({ name: name.trim(), updated_at: new Date().toISOString() } as never).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/assets");
  return { success: true };
}

export async function deleteLocation(id: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("location_id", id);
  if (count && count > 0) return { error: `Cannot delete — ${count} asset${count > 1 ? "s are" : " is"} using this.` };
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/assets");
  return { success: true };
}

export async function updateAppSetting(key: string, value: string) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  const { error } = await supabase.from("app_settings").update({ value }).eq("key", key);
  if (error) return { error: error.message };
  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "update_setting", entityType: "setting", entityLabel: key,
    details: { value },
  });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { success: true };
}

// ─── ASSET REQUESTS ─────────────────────────────────────────────────────────

export async function updateAssetRequest(
  id: string,
  data: { status: string; admin_notes?: string }
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };

  // Fetch requester details before updating so we can email them
  const { data: request } = await supabase
    .from("asset_requests")
    .select("requester_name, requester_email, category_name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("asset_requests")
    .update({
      status: data.status,
      admin_notes: data.admin_notes ?? null,
      attended_by_user_id: user.id,
      attended_by_name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Email the requester about the status change (fire and forget — never blocks the save)
  if (request?.requester_email) {
    const { sendRequestStatusEmail } = await import("@/lib/email");
    sendRequestStatusEmail({
      requestId: id,
      requesterName: request.requester_name,
      requesterEmail: request.requester_email,
      categoryName: request.category_name ?? "Asset",
      status: data.status,
      adminNotes: data.admin_notes,
    }).catch(() => {});
  }

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "update_request", entityType: "request", entityId: id,
    details: { status: data.status },
  });
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  return { success: true };
}


export async function deleteAssetRequest(id: string): Promise<{ success?: boolean; error?: string }> {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };
  const { error } = await supabase.from("asset_requests").delete().eq("id", id);
  if (error) return { error: error.message };
  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "delete_request", entityType: "request", entityId: id,
  });
  revalidatePath("/requests");
  return { success: true };
}
