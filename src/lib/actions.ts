"use server";

import { revalidatePath } from "next/cache";
import type { Database, Json, TaskChecklistItem, TaskWithActivity } from "@/types/database";
import { createSupabaseServerClient } from "./supabase-server";
import { logActivity } from "./activity";
import { isStorageSafeContactName } from "./storage-safes";
import { getTaskTemplate } from "./task-templates";

type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
type AuditInsert = Database["public"]["Tables"]["asset_audit_log"]["Insert"];
type AssignmentInsert = Database["public"]["Tables"]["asset_assignments"]["Insert"];
type StatusHistoryInsert = Database["public"]["Tables"]["asset_status_history"]["Insert"];
type MaintenanceInsert = Database["public"]["Tables"]["maintenance_records"]["Insert"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ExternalContactInsert = Database["public"]["Tables"]["external_contacts"]["Insert"];
type PrinterInsert = Database["public"]["Tables"]["printers"]["Insert"];
type PrinterTonerOrderInsert = Database["public"]["Tables"]["printer_toner_orders"]["Insert"];
type PrinterPaperOrderInsert = Database["public"]["Tables"]["printer_paper_orders"]["Insert"];
type PrinterTicketInsert = Database["public"]["Tables"]["printer_tickets"]["Insert"];
type PrinterMeterReadingInsert = Database["public"]["Tables"]["printer_meter_readings"]["Insert"];

async function getAuthenticatedAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null, user: null };
  if (user.app_metadata?.role !== "admin")
    return { error: "Admin access required.", supabase: null, user: null };
  return { error: null, supabase, user };
}

function cleanEmptyStrings<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );
}

async function syncPrinterStatusFromTickets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  printerId: string
) {
  const { data: printer } = await supabase
    .from("printers")
    .select("status")
    .eq("id", printerId)
    .single();

  if (!printer || printer.status === "Retired") return;

  const { count } = await supabase
    .from("printer_tickets")
    .select("id", { count: "exact", head: true })
    .eq("printer_id", printerId)
    .in("status", ["Open", "In Progress", "Waiting Supplier"]);

  if ((count ?? 0) > 0 && printer.status !== "Offline") {
    await supabase
      .from("printers")
      .update({ status: "Needs Attention", updated_at: new Date().toISOString() })
      .eq("id", printerId);
  } else if (printer.status === "Needs Attention") {
    await supabase
      .from("printers")
      .update({ status: "Active", updated_at: new Date().toISOString() })
      .eq("id", printerId);
  }
}

// ─── ASSETS ────────────────────────────────────────────────────────────────

export async function createAsset(data: {
  id?: string;
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
  const assetId = data.id || crypto.randomUUID();
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
  return { success: true as const, assetId };
}

export async function assignAsset(data: {
  asset_id: string;
  contact_id: string;
  department_id?: string;
  job_level_id?: string;
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
      ...(data.department_id ? { owning_department_id: data.department_id } : {}),
      ...(data.job_level_id ? { assigned_job_level_id: data.job_level_id } : {}),
      ...(data.location_id ? { location_id: data.location_id } : {}),
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
  currentStatusId: string,
  storageContactId: string,
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  if (!storageContactId) return { error: "Please select a storage safe." };

  const { data: storageContact, error: storageContactError } = await supabase
    .from("contacts")
    .select("id, full_name, department_id, job_level_id, location_id")
    .eq("id", storageContactId)
    .eq("is_active", true)
    .single();

  if (storageContactError || !storageContact) {
    return { error: "Selected storage safe could not be found." };
  }

  if (!isStorageSafeContactName(storageContact.full_name)) {
    return { error: "Selected contact is not a storage safe." };
  }

  await supabase
    .from("asset_assignments")
    .update({ returned_at: new Date().toISOString() })
    .eq("asset_id", assetId)
    .is("returned_at", null);

  const storageLocationId = storageContact.location_id ?? null;

  await supabase.from("asset_assignments").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    contact_id: storageContact.id,
    location_id: storageLocationId,
    notes: "In storage",
    assigned_at: new Date().toISOString().split("T")[0],
  } as AssignmentInsert);

  await supabase
    .from("assets")
    .update({
      assigned_to_contact_id: storageContact.id,
      owning_department_id: storageContact.department_id ?? null,
      assigned_job_level_id: storageContact.job_level_id ?? null,
      status_id: inStorageStatusId,
      location_id: storageLocationId,
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
    changes: { assigned_to_contact_id: { old: "assigned", new: storageContact.id } } as Json,
  } as AuditInsert);

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "unassign_asset", entityType: "asset", entityId: assetId,
    details: { storage_contact_id: storageContact.id },
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

export async function bulkChangeStatusAllFiltered(
  filters: { q?: string; status?: string; cat?: string; dept?: string; site?: string; contact?: string; missing?: string },
  newStatusId: string,
): Promise<{ success?: boolean; error?: string; count?: number }> {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };

  let query = supabase.from("assets").select("id, status_id");
  if (filters.q) query = query.or(`description.ilike.%${filters.q}%,serial_number.ilike.%${filters.q}%`);
  if (filters.status) { const ids = filters.status.split(",").filter(Boolean); if (ids.length) query = query.in("status_id", ids); }
  if (filters.cat)    { const ids = filters.cat.split(",").filter(Boolean);    if (ids.length) query = query.in("category_id", ids); }
  if (filters.dept)   { const ids = filters.dept.split(",").filter(Boolean);   if (ids.length) query = query.in("owning_department_id", ids); }
  if (filters.site)   { const ids = filters.site.split(",").filter(Boolean);   if (ids.length) query = query.in("location_id", ids); }
  if (filters.contact){ const ids = filters.contact.split(",").filter(Boolean); if (ids.length) query = query.in("assigned_to_contact_id", ids); }
  if (filters.missing) {
    const fields = filters.missing.split(",").filter(Boolean);
    if (fields.includes("dept"))    query = query.is("owning_department_id", null);
    if (fields.includes("site"))    query = query.is("location_id", null);
    if (fields.includes("contact")) query = query.is("assigned_to_contact_id", null);
  }

  const { data: existing, error: fetchError } = await query;
  if (fetchError) return { error: fetchError.message };
  if (!existing || existing.length === 0) return { success: true, count: 0 };

  const assetIds = existing.map((e) => e.id);
  const now = new Date().toISOString();
  const changedByName = user.user_metadata?.full_name ?? user.email ?? "Unknown";

  const { error: updateError } = await supabase
    .from("assets")
    .update({ status_id: newStatusId, updated_at: now })
    .in("id", assetIds);
  if (updateError) return { error: updateError.message };

  for (const asset of existing) {
    if (asset.status_id === newStatusId) continue;
    await supabase.from("asset_status_history").insert({
      id: crypto.randomUUID(), asset_id: asset.id,
      old_status_id: asset.status_id, new_status_id: newStatusId,
      reason: "Bulk status change (all filtered)", changed_at: now,
    } as StatusHistoryInsert);
    await supabase.from("asset_audit_log").insert({
      id: crypto.randomUUID(), asset_id: asset.id,
      changed_by_user_id: user.id, changed_by_name: changedByName,
      action: "update",
      changes: { status_id: { old: asset.status_id, new: newStatusId, reason: "Bulk status change (all filtered)" } } as Json,
    } as AuditInsert);
  }

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "bulk_change_status", entityType: "asset",
    details: { asset_count: assetIds.length, scope: "all_filtered" },
  });

  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { success: true, count: assetIds.length };
}

export async function bulkAssignAssets(
  assetIds: string[],
  contactId: string,
): Promise<{ success?: boolean; error?: string }> {
  if (assetIds.length === 0) return { success: true };
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };

  const { data: inUseStatus } = await supabase.from("statuses").select("id").eq("name", "In Use").single();
  if (!inUseStatus) return { error: "Could not find 'In Use' status." };

  const now = new Date().toISOString();
  const changedByName = user.user_metadata?.full_name ?? user.email ?? "Unknown";

  await supabase.from("asset_assignments").update({ returned_at: now }).in("asset_id", assetIds).is("returned_at", null);

  const { error: assignError } = await supabase.from("asset_assignments").insert(
    assetIds.map((assetId) => ({ id: crypto.randomUUID(), asset_id: assetId, contact_id: contactId, assigned_at: now } as AssignmentInsert))
  );
  if (assignError) return { error: assignError.message };

  const { error: updateError } = await supabase
    .from("assets")
    .update({ assigned_to_contact_id: contactId, status_id: inUseStatus.id, updated_at: now })
    .in("id", assetIds);
  if (updateError) return { error: updateError.message };

  for (const assetId of assetIds) {
    await supabase.from("asset_audit_log").insert({
      id: crypto.randomUUID(), asset_id: assetId,
      changed_by_user_id: user.id, changed_by_name: changedByName,
      action: "update",
      changes: { assigned_to_contact_id: { new: contactId } } as Json,
    } as AuditInsert);
  }

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "assign_asset", entityType: "asset",
    details: { asset_count: assetIds.length, contact_id: contactId },
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

// --- PRINTERS --------------------------------------------------------------

type PrinterCapabilityFields = {
  is_colour?: boolean;
  supports_a3?: boolean;
  toner_config?: string;
  has_developer_units?: boolean;
  has_waste_box?: boolean;
  has_fuser_tracking?: boolean;
  has_drum_tracking?: boolean;
  is_duplex?: boolean;
  is_scan_capable?: boolean;
  is_fax_capable?: boolean;
  snmp_enabled?: boolean;
};

export type TrayInput = {
  id?: string;
  tray_name: string;
  paper_size: string;
  capacity_reams?: number | null;
  sort_order?: number;
};

export async function syncPrinterTrays(printerId: string, trays: TrayInput[]) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const incoming = trays.map((t, i) => ({
    ...t,
    printer_id: printerId,
    sort_order: t.sort_order ?? i + 1,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  // Upsert submitted trays
  if (incoming.length > 0) {
    const { error: upsertError } = await supabase
      .from("printer_trays")
      .upsert(incoming, { onConflict: "printer_id,tray_name" });
    if (upsertError) return { error: upsertError.message };
  }

  // Deactivate trays no longer in the submitted list
  const keptNames = new Set(trays.map((t) => t.tray_name));
  const { data: existing } = await supabase
    .from("printer_trays")
    .select("id, tray_name")
    .eq("printer_id", printerId)
    .eq("is_active", true);

  const toDeactivate = (existing ?? [])
    .filter((r) => !keptNames.has(r.tray_name))
    .map((r) => r.id);

  if (toDeactivate.length > 0) {
    await supabase
      .from("printer_trays")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", toDeactivate);
  }

  revalidatePath(`/printers`);
  return { success: true };
}

export async function createPrinter(data: {
  name: string;
  serial_number?: string;
  ip_address?: string;
  mac_address?: string;
  supplier?: string;
  manufacturer?: string;
  model?: string;
  department_id?: string;
  location_id?: string;
  primary_contact_id?: string;
  status?: string;
  toner_status?: string;
  paper_status?: string;
  toner_model?: string;
  paper_size?: string;
  last_meter_reading?: number | null;
  last_meter_reading_at?: string;
  warranty_end_date?: string;
  notes?: string;
} & PrinterCapabilityFields) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  if (!data.name.trim()) return { error: "Printer name is required." };

  const clean = cleanEmptyStrings({
    ...data,
    status: data.status || "Active",
    toner_status: data.toner_status || "OK",
    paper_status: data.paper_status || "OK",
  });

  const { data: printer, error } = await supabase
    .from("printers")
    .insert({
      id: crypto.randomUUID(),
      ...clean,
    } as PrinterInsert)
    .select("id, printer_code, name")
    .single();

  if (error) return { error: error.message };

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "create_printer",
    entityType: "printer",
    entityId: printer.id,
    entityLabel: `#${printer.printer_code} ${printer.name}`,
  });

  revalidatePath("/printers");
  revalidatePath("/dashboard");
  return { success: true, id: printer.id };
}

export async function updatePrinter(
  id: string,
  data: {
    name?: string;
    serial_number?: string;
    ip_address?: string;
    mac_address?: string;
    supplier?: string;
    manufacturer?: string;
    model?: string;
    department_id?: string;
    location_id?: string;
    primary_contact_id?: string;
    status?: string;
    toner_status?: string;
    paper_status?: string;
    toner_model?: string;
    paper_size?: string;
    last_meter_reading?: number | null;
    last_meter_reading_at?: string;
    warranty_end_date?: string;
    notes?: string;
  } & PrinterCapabilityFields
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Printer name is required." };
  }

  const clean = cleanEmptyStrings(data);
  const { data: existing } = await supabase
    .from("printers")
    .select("name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("printers")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "update_printer",
    entityType: "printer",
    entityId: id,
    entityLabel: data.name ?? existing?.name ?? id,
  });

  revalidatePath("/printers");
  revalidatePath(`/printers/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deletePrinter(id: string): Promise<{ success?: boolean; error?: string }> {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };

  const { data: printer } = await supabase
    .from("printers")
    .select("name")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("printers").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "delete_printer",
    entityType: "printer",
    entityId: id,
    entityLabel: printer?.name ?? id,
  });

  revalidatePath("/printers");
  revalidatePath("/dashboard");
  return { success: true };
}

export type StockField =
  | "black_toner_stock"
  | "cyan_toner_stock"
  | "magenta_toner_stock"
  | "yellow_toner_stock"
  | "paper_boxes_on_hand";

export async function updatePrinterStock(
  printerId: string,
  field: StockField,
  delta: 1 | -1
) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { data: row } = await supabase
    .from("printers")
    .select("black_toner_stock, cyan_toner_stock, magenta_toner_stock, yellow_toner_stock, paper_boxes_on_hand")
    .eq("id", printerId)
    .single();

  if (!row) return { error: "Printer not found." };

  const current = (row as Record<string, number>)[field] ?? 0;
  const newValue = Math.max(0, current + delta);

  const { error } = await supabase
    .from("printers")
    .update({ [field]: newValue, updated_at: new Date().toISOString() })
    .eq("id", printerId);

  if (error) return { error: error.message };

  revalidatePath(`/printers/${printerId}`);
  revalidatePath("/printers");
  return { success: true, newValue };
}

// ── Consumable Types ──────────────────────────────────────────────────────────

export async function upsertConsumableType(data: {
  id?: string;
  printer_id: string;
  colour: string;
  kind: string;
  description?: string | null;
  rated_yield_pages?: number | null;
  unit_price?: number | null;
  supplier_lead_days?: number;
}) {
  void data;
  return { error: "Consumable reference data is now managed in Settings > Consumable Types." };
}

export async function deleteConsumableType(id: string, printerId: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase.from("consumable_types").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/printers/${printerId}`);
  return { success: true };
}

// ── Paper Stock (site-level) ──────────────────────────────────────────────────
// Paper is allocated per site, not per printer.
// stocks: one entry per paper size (A4 and/or A3).

export async function upsertLocationPaperStock(
  locationId: string,
  stocks: {
    paper_size: "A4" | "A3";
    boxes_on_hand: number;
    reams_on_hand: number;
  }[]
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const now = new Date().toISOString();
  let contactId: string | null = null;
  if (user.email) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    contactId = contact?.id ?? null;
  }

  for (const s of stocks) {
    const { error } = await supabase.from("location_paper_stock").upsert(
      {
        location_id: locationId,
        paper_size: s.paper_size,
        boxes_on_hand: s.paper_size === "A3" ? 0 : s.boxes_on_hand,
        reams_on_hand: s.reams_on_hand,
        last_restocked_at: now,
        last_updated_by_contact_id: contactId,
        updated_at: now,
      },
      { onConflict: "location_id,paper_size" }
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/printers");
  return { success: true };
}

// ── Phase 7: Toner / Consumable Stock ────────────────────────────────────────

export async function updatePrinterConsumableStock(
  printerId: string,
  stock: {
    black_toner_stock?: number;
    cyan_toner_stock?: number;
    magenta_toner_stock?: number;
    yellow_toner_stock?: number;
    colour_toner_stock?: number;
    developer_unit_stock?: number;
    fuser_unit_stock?: number;
    waste_box_stock?: number;
    drum_unit_stock?: number;
  }
) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("printers")
    .update({ ...stock, updated_at: new Date().toISOString() })
    .eq("id", printerId);

  if (error) return { error: error.message };
  revalidatePath(`/printers/${printerId}`);
  revalidatePath("/printers");
  return { success: true };
}

// ── Phase 7: Consumable Types (global reference) ─────────────────────────────

export async function upsertGlobalConsumableType(data: {
  id?: string;
  printer_id?: string | null;
  colour: string;
  kind: string;
  description?: string | null;
  part_number?: string | null;
  manufacturer?: string | null;
  compatible_models?: string | null;
  rated_yield_pages?: number | null;
  unit_price?: number | null;
  coverage_pct?: number;
  reorder_threshold_pct?: number;
  reorder_stock_min?: number;
  supplier_lead_days?: number;
}) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const payload = {
    printer_id:            data.printer_id ?? null,
    colour:                data.colour.toLowerCase(),
    kind:                  data.kind.toLowerCase(),
    description:           data.description ?? null,
    part_number:           data.part_number ?? null,
    manufacturer:          data.manufacturer ?? null,
    compatible_models:     data.compatible_models ?? null,
    rated_yield_pages:     data.rated_yield_pages ?? null,
    unit_price:            data.unit_price ?? null,
    coverage_pct:          data.coverage_pct ?? 5,
    reorder_threshold_pct: data.reorder_threshold_pct ?? 25,
    reorder_stock_min:     data.reorder_stock_min ?? 1,
    supplier_lead_days:    data.supplier_lead_days ?? 1,
    updated_at:            new Date().toISOString(),
  };

  const { error } = data.id
    ? await supabase.from("consumable_types").update(payload).eq("id", data.id)
    : await supabase.from("consumable_types").insert({ id: crypto.randomUUID(), ...payload });

  if (error) return { error: error.message };
  revalidatePath("/settings/consumable-types");
  revalidatePath("/printers");
  return { success: true };
}

// ── Phase 7: Service Contracts ────────────────────────────────────────────────

export async function createPrinterContract(data: {
  contract_reference: string;
  provider_name: string;
  provider_contact_name?: string | null;
  provider_contact_email?: string | null;
  provider_contact_phone?: string | null;
  contract_type: string;
  covers_consumables?: boolean;
  covers_parts?: boolean;
  covers_labour?: boolean;
  sla_response_hours?: number | null;
  monthly_cost?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  auto_renews?: boolean;
  notes?: string | null;
  printer_ids?: string[];
}) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const id = crypto.randomUUID();
  const { error: insertError } = await supabase.from("printer_contracts").insert({
    id,
    contract_reference: data.contract_reference,
    provider_name: data.provider_name,
    provider_contact_name: data.provider_contact_name ?? null,
    provider_contact_email: data.provider_contact_email ?? null,
    provider_contact_phone: data.provider_contact_phone ?? null,
    contract_type: data.contract_type || "Full Maintenance",
    covers_consumables: data.covers_consumables ?? false,
    covers_parts: data.covers_parts ?? false,
    covers_labour: data.covers_labour ?? false,
    sla_response_hours: data.sla_response_hours ?? null,
    monthly_cost: data.monthly_cost ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    auto_renews: data.auto_renews ?? false,
    notes: data.notes ?? null,
  });
  if (insertError) return { error: insertError.message };

  if (data.printer_ids?.length) {
    const assignments = data.printer_ids.map((pid) => ({
      id: crypto.randomUUID(),
      contract_id: id,
      printer_id: pid,
    }));
    const { error: aErr } = await supabase.from("printer_contract_assignments").insert(assignments);
    if (aErr) return { error: aErr.message };
  }

  revalidatePath("/printers/contracts");
  return { success: true, id };
}

export async function updatePrinterContract(
  id: string,
  data: {
    contract_reference?: string;
    provider_name?: string;
    provider_contact_name?: string | null;
    provider_contact_email?: string | null;
    provider_contact_phone?: string | null;
    contract_type?: string;
    covers_consumables?: boolean;
    covers_parts?: boolean;
    covers_labour?: boolean;
    sla_response_hours?: number | null;
    monthly_cost?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    auto_renews?: boolean;
    notes?: string | null;
    printer_ids?: string[];
  }
) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { printer_ids, ...rest } = data;
  const { error } = await supabase
    .from("printer_contracts")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  if (printer_ids !== undefined) {
    await supabase.from("printer_contract_assignments").delete().eq("contract_id", id);
    if (printer_ids.length > 0) {
      await supabase.from("printer_contract_assignments").insert(
        printer_ids.map((pid) => ({ id: crypto.randomUUID(), contract_id: id, printer_id: pid }))
      );
    }
  }

  revalidatePath("/printers/contracts");
  return { success: true };
}

export async function createPrinterTonerOrder(data: {
  printer_id: string;
  requested_by_contact_id?: string;
  toner_type: string;
  quantity?: number;
  status?: string;
  supplier?: string;
  order_number?: string;
  requested_at?: string;
  expected_at?: string;
  received_at?: string;
  notes?: string;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  if (!data.toner_type.trim()) return { error: "Toner type is required." };

  const status = data.status || "Requested";
  const clean = cleanEmptyStrings({ ...data, status, quantity: data.quantity ?? 1 });

  const { error } = await supabase.from("printer_toner_orders").insert({
    id: crypto.randomUUID(),
    ...clean,
  } as PrinterTonerOrderInsert);
  if (error) return { error: error.message };

  if (["Requested", "Ordered", "Backordered"].includes(status)) {
    await supabase
      .from("printers")
      .update({ toner_status: "Ordered", updated_at: new Date().toISOString() })
      .eq("id", data.printer_id);
  } else if (status === "Received") {
    await supabase
      .from("printers")
      .update({ toner_status: "OK", updated_at: new Date().toISOString() })
      .eq("id", data.printer_id);
  }

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "create_printer_toner_order",
    entityType: "printer",
    entityId: data.printer_id,
    entityLabel: data.toner_type,
  });

  revalidatePath("/printers");
  revalidatePath(`/printers/${data.printer_id}`);
  return { success: true };
}

export async function updatePrinterTonerOrder(
  id: string,
  printerId: string,
  data: {
    toner_type?: string;
    quantity?: number;
    status?: string;
    supplier?: string;
    order_number?: string;
    requested_by_contact_id?: string;
    requested_at?: string;
    expected_at?: string;
    received_at?: string;
    notes?: string;
  }
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const clean = cleanEmptyStrings(data);
  const { error } = await supabase
    .from("printer_toner_orders")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  if (data.status === "Received") {
    await supabase
      .from("printers")
      .update({ toner_status: "OK", updated_at: new Date().toISOString() })
      .eq("id", printerId);
  } else if (data.status && ["Requested", "Ordered", "Backordered"].includes(data.status)) {
    await supabase
      .from("printers")
      .update({ toner_status: "Ordered", updated_at: new Date().toISOString() })
      .eq("id", printerId);
  }

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "update_printer_toner_order",
    entityType: "printer",
    entityId: printerId,
  });

  revalidatePath("/printers");
  revalidatePath(`/printers/${printerId}`);
  return { success: true };
}

export async function createPrinterPaperOrder(data: {
  printer_id?: string | null;
  requested_by_contact_id?: string | null;
  paper_size: string;
  reams?: number;
  status?: string;
  supplier?: string | null;
  order_number?: string | null;
  requested_at?: string;
  expected_at?: string | null;
  received_at?: string | null;
  notes?: string | null;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  if (!data.paper_size.trim()) return { error: "Paper size is required." };

  const status = data.status || "Requested";
  const clean = cleanEmptyStrings({ ...data, status, reams: data.reams ?? 1 });

  const { error } = await supabase.from("printer_paper_orders").insert({
    id: crypto.randomUUID(),
    ...clean,
  } as PrinterPaperOrderInsert);
  if (error) return { error: error.message };

  // Only update printer status when the order is linked to a specific printer
  if (data.printer_id) {
    if (["Requested", "Ordered", "Backordered"].includes(status)) {
      await supabase
        .from("printers")
        .update({ paper_status: "Ordered", updated_at: new Date().toISOString() })
        .eq("id", data.printer_id);
    } else if (status === "Received") {
      await supabase
        .from("printers")
        .update({ paper_status: "OK", updated_at: new Date().toISOString() })
        .eq("id", data.printer_id);
    }
  }

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "create_printer_paper_order",
    entityType: "printer",
    entityId: data.printer_id ?? undefined,
    entityLabel: data.paper_size,
  });

  revalidatePath("/printers");
  if (data.printer_id) revalidatePath(`/printers/${data.printer_id}`);
  return { success: true };
}

export async function updatePrinterPaperOrder(
  id: string,
  printerId: string,
  data: {
    paper_size?: string;
    reams?: number;
    status?: string;
    supplier?: string;
    order_number?: string;
    requested_by_contact_id?: string;
    requested_at?: string;
    expected_at?: string;
    received_at?: string;
    notes?: string;
  }
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const clean = cleanEmptyStrings(data);
  const { error } = await supabase
    .from("printer_paper_orders")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  if (data.status === "Received") {
    await supabase
      .from("printers")
      .update({ paper_status: "OK", updated_at: new Date().toISOString() })
      .eq("id", printerId);
  } else if (data.status && ["Requested", "Ordered", "Backordered"].includes(data.status)) {
    await supabase
      .from("printers")
      .update({ paper_status: "Ordered", updated_at: new Date().toISOString() })
      .eq("id", printerId);
  }

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "update_printer_paper_order",
    entityType: "printer",
    entityId: printerId,
  });

  revalidatePath("/printers");
  revalidatePath(`/printers/${printerId}`);
  return { success: true };
}

export async function createPrinterTicket(data: {
  printer_id: string;
  logged_by_contact_id?: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  supplier_ticket_ref?: string;
  opened_at?: string;
  due_at?: string;
  closed_at?: string;
  resolution_notes?: string;
  cost?: number | null;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  if (!data.title.trim()) return { error: "Ticket title is required." };

  const clean = cleanEmptyStrings({
    ...data,
    priority: data.priority || "Normal",
    status: data.status || "Open",
  });

  const { error } = await supabase.from("printer_tickets").insert({
    id: crypto.randomUUID(),
    ...clean,
  } as PrinterTicketInsert);
  if (error) return { error: error.message };

  await syncPrinterStatusFromTickets(supabase, data.printer_id);

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "create_printer_ticket",
    entityType: "printer",
    entityId: data.printer_id,
    entityLabel: data.title,
  });

  revalidatePath("/printers");
  revalidatePath(`/printers/${data.printer_id}`);
  return { success: true };
}

export async function updatePrinterTicket(
  id: string,
  printerId: string,
  data: {
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    logged_by_contact_id?: string;
    supplier_ticket_ref?: string;
    opened_at?: string;
    due_at?: string;
    closed_at?: string;
    resolution_notes?: string;
    cost?: number | null;
  }
) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const clean = cleanEmptyStrings(data);
  const { error } = await supabase
    .from("printer_tickets")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await syncPrinterStatusFromTickets(supabase, printerId);

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "update_printer_ticket",
    entityType: "printer",
    entityId: printerId,
    entityLabel: data.title ?? undefined,
  });

  revalidatePath("/printers");
  revalidatePath(`/printers/${printerId}`);
  return { success: true };
}

export async function createPrinterMeterReading(data: {
  printer_id: string;
  reading: number;
  reading_at?: string;
  captured_by_contact_id?: string;
  notes?: string;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  if (!Number.isFinite(data.reading) || data.reading < 0) {
    return { error: "Meter reading must be zero or higher." };
  }

  const readingAt = data.reading_at || new Date().toISOString().split("T")[0];
  const clean = cleanEmptyStrings({ ...data, reading_at: readingAt });

  const { error } = await supabase.from("printer_meter_readings").insert({
    id: crypto.randomUUID(),
    ...clean,
  } as PrinterMeterReadingInsert);
  if (error) return { error: error.message };

  const { data: printer } = await supabase
    .from("printers")
    .select("last_meter_reading_at")
    .eq("id", data.printer_id)
    .single();

  if (!printer?.last_meter_reading_at || readingAt >= printer.last_meter_reading_at) {
    await supabase
      .from("printers")
      .update({
        last_meter_reading: data.reading,
        last_meter_reading_at: readingAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.printer_id);
  }

  await logActivity({
    userId: user.id,
    userName: user.user_metadata?.full_name ?? null,
    userEmail: user.email ?? null,
    action: "create_printer_meter_reading",
    entityType: "printer",
    entityId: data.printer_id,
    details: { reading: data.reading, reading_at: readingAt },
  });

  revalidatePath("/printers");
  revalidatePath(`/printers/${data.printer_id}`);
  return { success: true };
}

// --- CONTACTS --------------------------------------------------------------

export async function createContact(data: {
  full_name: string;
  email?: string;
  department_id?: string;
  job_level_id?: string;
  location_id?: string;
}) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };

  // Auto-assign next printer_code = MAX(printer_code) + 1, fallback to 5919
  const { data: maxRow } = await supabase
    .from("contacts")
    .select("printer_code")
    .not("printer_code", "is", null)
    .order("printer_code", { ascending: false })
    .limit(1)
    .single();
  const nextCode = maxRow?.printer_code != null ? maxRow.printer_code + 1 : 5919;

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );
  const contactId = crypto.randomUUID();
  const { error } = await supabase
    .from("contacts")
    .insert({ id: contactId, ...clean, is_active: true, printer_code: nextCode } as ContactInsert);
  if (error) return { error: error.message };
  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "create_contact", entityType: "contact", entityId: contactId, entityLabel: data.full_name,
  });
  revalidatePath("/people");
  return { success: true, printer_code: nextCode };
}

export async function updateContact(
  id: string,
  data: {
    full_name?: string;
    email?: string;
    department_id?: string;
    job_level_id?: string;
    location_id?: string;
    printer_code?: number | null;
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

// ─── EXTERNAL CONTACTS ─────────────────────────────────────────────────────

export async function createExternalContact(data: { name: string; company?: string; email?: string; phone?: string }) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  if (!data.name || !data.name.trim()) return { error: "Name is required." };
  const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]));
  const id = crypto.randomUUID();
  const { error } = await supabase.from("external_contacts").insert({ id, ...clean } as ExternalContactInsert);
  if (error) return { error: error.message };
  await logActivity({ userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null, action: "create_external_contact", entityType: "external_contact", entityId: id, entityLabel: data.name });
  revalidatePath("/tasks");
  revalidatePath("/people");
  return { success: true };
}

export async function updateExternalContact(id: string, data: { name?: string; company?: string; email?: string; phone?: string }) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]));
  const { error } = await supabase.from("external_contacts").update({ ...clean, updated_at: new Date().toISOString() } as never).eq("id", id);
  if (error) return { error: error.message };
  await logActivity({ userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null, action: "update_external_contact", entityType: "external_contact", entityId: id, entityLabel: data.name ?? undefined });
  revalidatePath("/tasks");
  revalidatePath("/people");
  return { success: true };
}

export async function deleteExternalContact(id: string) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  // Safety: ensure no follow-ups reference this contact
  const { count } = await supabase.from("task_follow_ups").select("id", { head: true, count: "exact" }).eq("external_contact_id", id);
  if (count && count > 0) return { error: `Cannot delete — ${count} follow-up${count > 1 ? "s are" : " is"} linked to this contact.` };
  const { error } = await supabase.from("external_contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  await logActivity({ userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null, action: "delete_external_contact", entityType: "external_contact", entityId: id });
  revalidatePath("/tasks");
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

// ── Meter reading management ──────────────────────────────────────────────────

export async function deleteMeterReading(id: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  const { error } = await supabase.from("printer_meter_readings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/printers");
  return { success: true };
}

export async function updateMeterReading(id: string, reading: number, readingAt: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  const { error } = await supabase
    .from("printer_meter_readings")
    .update({ reading, reading_at: readingAt, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/printers");
  return { success: true };
}

export async function purgeSnmpReadings(beforeDate: string) {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };
  const { error, count } = await supabase
    .from("printer_snmp_readings")
    .delete({ count: "exact" })
    .lt("polled_at", beforeDate);
  if (error) return { error: error.message };
  revalidatePath("/printers");
  return { success: true, deleted: count ?? 0 };
}

export async function insertAppSetting(key: string, value: string) {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError };
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) return { error: error.message };
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
    }).catch((err) => console.error("[sendRequestStatusEmail]", err));
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


export async function deleteAsset(id: string): Promise<{ success?: boolean; error?: string }> {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };

  // Delete related records in dependency order before removing the asset
  await supabase.from("maintenance_records").delete().eq("asset_id", id);
  await supabase.from("asset_status_history").delete().eq("asset_id", id);
  await supabase.from("asset_assignments").delete().eq("asset_id", id);
  await supabase.from("asset_audit_log").delete().eq("asset_id", id);

  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "delete_asset", entityType: "asset", entityId: id,
  });
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteContact(id: string): Promise<{ success?: boolean; error?: string }> {
  const { error: authError, supabase, user } = await getAuthenticatedAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Auth error" };

  // Unassign any assets currently assigned to this contact
  await supabase.from("assets").update({ assigned_to_contact_id: null }).eq("assigned_to_contact_id", id);
  // Close out their assignment records
  await supabase.from("asset_assignments")
    .update({ returned_at: new Date().toISOString() })
    .eq("contact_id", id)
    .is("returned_at", null);

  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity({
    userId: user.id, userName: user.user_metadata?.full_name ?? null, userEmail: user.email ?? null,
    action: "delete_contact", entityType: "contact", entityId: id,
  });
  revalidatePath("/people");
  revalidatePath("/assets");
  revalidatePath("/dashboard");
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

export async function getAllAssetsForExport(filters: {
  q?: string;
  status?: string;
  cat?: string;
  dept?: string;
  site?: string;
  contact?: string;
  missing?: string;
}): Promise<{ data?: { code: string; description: string; category: string; serial: string; status: string; department: string; assignedTo: string; location: string; purchaseDate: string; }[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  let query = supabase.from("assets").select(`
    asset_code, description, serial_number, purchase_date,
    category:categories(name),
    status:statuses(name),
    owning_department:departments(name),
    assigned_to_contact:contacts!assets_assigned_to_contact_id_fkey(full_name),
    location:locations(name)
  `);

  if (filters.q) query = query.or(`description.ilike.%${filters.q}%,serial_number.ilike.%${filters.q}%`);
  if (filters.status) {
    const ids = filters.status.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("status_id", ids);
  }
  if (filters.cat) {
    const ids = filters.cat.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("category_id", ids);
  }
  if (filters.dept) {
    const ids = filters.dept.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("owning_department_id", ids);
  }
  if (filters.site) {
    const ids = filters.site.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("location_id", ids);
  }
  if (filters.contact) {
    const ids = filters.contact.split(",").filter(Boolean);
    if (ids.length > 0) query = query.in("assigned_to_contact_id", ids);
  }
  if (filters.missing) {
    const fields = filters.missing.split(",").filter(Boolean);
    if (fields.includes("dept")) query = query.is("owning_department_id", null);
    if (fields.includes("site")) query = query.is("location_id", null);
    if (fields.includes("contact")) query = query.is("assigned_to_contact_id", null);
  }

  const { data, error } = await query.order("asset_code");
  if (error) return { error: error.message };

  return {
    data: (data ?? []).map((a: any) => ({
      code: String(a.asset_code ?? ""),
      description: a.description ?? "",
      category: a.category?.name ?? "",
      serial: a.serial_number ?? "",
      status: a.status?.name ?? "",
      department: a.owning_department?.name ?? "",
      assignedTo: a.assigned_to_contact?.full_name ?? "",
      location: a.location?.name ?? "",
      purchaseDate: a.purchase_date ?? "",
    })),
  };
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

const TASK_WITH_ACTIVITY_SELECT =
  "id, task_code, title, status, status_reason, status_changed_at, priority, category, source, due_date, created_at, updated_at, archived_at";

type TaskDependencyWithTask = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
  depends_on_task: {
    id: string;
    task_code: number;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    archived_at: string | null;
  } | null;
};

export async function createTask(title: string): Promise<{ error: string | null; task: TaskWithActivity | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError, task: null };

  const cleanTitle = title.trim();
  if (!cleanTitle) return { error: "Task title is required.", task: null };

  const { data, error } = await supabase
    .from("tasks")
    .insert({ title: cleanTitle, status: "Intel", priority: "Standard" })
    .select(TASK_WITH_ACTIVITY_SELECT)
    .single();

  if (error) return { error: error.message, task: null };
  revalidatePath("/tasks");
  return { error: null, task: { ...data, location_id: null, task_updates: [] } as unknown as TaskWithActivity };
}

export async function createTaskFromTemplate(
  templateId: string
): Promise<{ error: string | null; task: TaskWithActivity | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError, task: null };

  const template = getTaskTemplate(templateId);
  if (!template) return { error: "Template not found.", task: null };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: template.title,
      status: "Intel",
      priority: template.priority,
      category: template.category,
      source: template.source,
    })
    .select(TASK_WITH_ACTIVITY_SELECT)
    .single();

  if (error) return { error: error.message, task: null };

  if (template.checklist.length > 0) {
    const { error: checklistError } = await supabase
      .from("task_checklist_items")
      .insert(
        template.checklist.map((body, index) => ({
          task_id: data.id,
          body,
          sort_order: index + 1,
        }))
      );

    if (checklistError) {
      revalidatePath("/tasks");
      return {
        error: `Task created, but checklist failed: ${checklistError.message}`,
        task: { ...data, location_id: null, task_updates: [] } as unknown as TaskWithActivity,
      };
    }
  }

  revalidatePath("/tasks");
  return { error: null, task: { ...data, location_id: null, task_updates: [] } as unknown as TaskWithActivity };
}

// Import Notion objectives and create tasks from them (idempotent)
import notionObjectives from "./notionObjectives";

export async function importNotionObjectives(): Promise<{ error: string | null; created: number }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError, created: 0 };

  let created = 0;

  for (const obj of notionObjectives) {
    const title = (obj.title || "").trim();
    if (!title) continue;

    // Skip if a task with the same title already exists
    const { data: existing, error: selectErr } = await supabase
      .from("tasks")
      .select("id")
      .eq("title", title)
      .limit(1);
    if (selectErr) return { error: selectErr.message, created };
    if ((existing ?? []).length > 0) continue;

    // Map fields conservatively to allowed enums
    const priority = (obj.priority as any) || "Standard";
    const status = (obj.status as any) || "Intel";
    const category = obj.category || null;
    const source = obj.source || null;
    const due_date = obj.dueDate || null;

    const insertObj: Record<string, any> = {
      title,
      priority,
      status,
      category,
      source,
      due_date,
    };

    const { error: insertErr } = await supabase.from("tasks").insert(cleanEmptyStrings(insertObj) as any);
    if (insertErr) return { error: insertErr.message, created };
    created++;
  }

  revalidatePath("/tasks");
  return { error: null, created };
}

export async function updateTaskField(
  id: string,
  field: "title" | "priority" | "category" | "source" | "due_date" | "location_id",
  value: string | null
): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("tasks")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function updateTaskStatus(
  id: string,
  status: string,
  reason?: string | null
): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ status, status_reason: reason ?? null, status_changed_at: now, updated_at: now })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function deleteTask(id: string): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: now, updated_at: now })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function addTaskChecklistItem(
  taskId: string,
  body: string
): Promise<{ error: string | null; item: TaskChecklistItem | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError, item: null };

  const cleanBody = body.trim();
  if (!cleanBody) return { error: "Checklist item is required.", item: null };

  const { count } = await supabase
    .from("task_checklist_items")
    .select("id", { head: true, count: "exact" })
    .eq("task_id", taskId);

  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({ task_id: taskId, body: cleanBody, sort_order: (count ?? 0) + 1 })
    .select()
    .single();

  if (error) return { error: error.message, item: null };
  revalidatePath("/tasks");
  return { error: null, item: data as TaskChecklistItem };
}

export async function toggleTaskChecklistItem(
  id: string,
  isDone: boolean
): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("task_checklist_items")
    .update({ is_done: isDone, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function deleteTaskChecklistItem(id: string): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase.from("task_checklist_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string
): Promise<{ error: string | null; dependency: TaskDependencyWithTask | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError, dependency: null };

  if (taskId === dependsOnTaskId) return { error: "A task cannot depend on itself.", dependency: null };

  const { data: existing } = await supabase
    .from("task_dependencies")
    .select("id")
    .eq("task_id", taskId)
    .eq("depends_on_task_id", dependsOnTaskId)
    .maybeSingle();

  if (existing) return { error: "This dependency is already linked.", dependency: null };

  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId })
    .select("id, task_id, depends_on_task_id, created_at, depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, task_code, title, status, priority, due_date, archived_at)")
    .single();

  if (error) return { error: error.message, dependency: null };
  revalidatePath("/tasks");
  return { error: null, dependency: data as unknown as TaskDependencyWithTask };
}

export async function deleteTaskDependency(id: string): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase.from("task_dependencies").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function addTaskUpdate(
  taskId: string,
  body: string
): Promise<{ error: string | null; update: { id: string; task_id: string; body: string; created_at: string } | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError, update: null };

  const { data, error } = await supabase
    .from("task_updates")
    .insert({ task_id: taskId, body: body.trim() })
    .select()
    .single();

  if (error) return { error: error.message, update: null };
  revalidatePath("/tasks");
  return { error: null, update: data };
}

export async function addTaskFollowUp(
  taskId: string,
  followUp: {
    contact_id?: string | null;
    external_contact_id?: string | null;
    due_date: string;
    note?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("task_follow_ups")
    .insert({ task_id: taskId, ...followUp });

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function toggleFollowUpDone(
  id: string,
  isDone: boolean
): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("task_follow_ups")
    .update({ is_done: isDone, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function snoozeTaskFollowUp(
  id: string,
  dueDate: string
): Promise<{ error: string | null }> {
  const { error: authError, supabase } = await getAuthenticatedAdmin();
  if (authError || !supabase) return { error: authError };

  if (!dueDate) return { error: "Snooze date is required." };

  const { error } = await supabase
    .from("task_follow_ups")
    .update({ due_date: dueDate, is_done: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}
