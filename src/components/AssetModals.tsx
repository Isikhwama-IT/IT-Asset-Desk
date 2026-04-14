"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import {
  Modal, FormField, Input, Select, Textarea,
  ModalFooter, BtnPrimary, BtnSecondary, BtnDanger, ErrorBanner, FormGrid, FormStack, ConfirmInline,
} from "@/components/modal-ui";
import {
  createAsset, updateAsset, changeAssetStatus,
  assignAsset, unassignAsset,
} from "@/lib/actions";
import { getStatusConfig } from "@/lib/utils";
import type {
  AssetWithRelations, Category, Status, Department,
  Location, Contact, JobLevel,
} from "@/types/database";

// ─── Shared lookup props ──────────────────────────────────────────────────────

interface LookupProps {
  categories: Category[];
  statuses: Status[];
  departments: Department[];
  locations: Location[];
  jobLevels: JobLevel[];
  contacts: Contact[];
}

// ─── ADD ASSET ────────────────────────────────────────────────────────────────

export function AddAssetModal({
  onClose,
  lookups,
}: {
  onClose: () => void;
  lookups: LookupProps;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "assign">("details");
  const [newAssetId, setNewAssetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Assign step state
  const [contactId, setContactId] = useState("");
  const [assignLocationId, setAssignLocationId] = useState("");
  const [assignedAt, setAssignedAt] = useState(new Date().toISOString().split("T")[0]);
  const [assignNotes, setAssignNotes] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  const inStorageStatusId = lookups.statuses.find((s) => s.name === "In Storage")?.id ?? "";
  const inUseStatusId = lookups.statuses.find((s) => s.name === "In Use")?.id ?? "";

  const [form, setForm] = useState({
    description: "",
    category_id: "",
    serial_number: "",
    purchase_date: "",
    invoice_number: "",
    cpu_gen: "",
    os_type: "",
    os_license_type: "",
    warranty_start_date: "",
    warranty_end_date: "",
    expected_end_of_life_date: "",
    notes: "",
  });

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirming(false);
    setFieldErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  function validateDates(): boolean {
    const errs: Record<string, string> = {};
    if (form.warranty_start_date && form.warranty_end_date && form.warranty_end_date < form.warranty_start_date)
      errs.warranty_end_date = "End date must be after start date";
    if (form.purchase_date && form.expected_end_of_life_date && form.expected_end_of_life_date < form.purchase_date)
      errs.expected_end_of_life_date = "Must be after purchase date";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!form.description.trim()) return setError("Description is required.");
    if (!form.category_id) return setError("Category is required.");
    if (!inStorageStatusId) return setError("No 'In Storage' status found. Please check your status settings.");
    if (!validateDates()) return;
    const generatedId = crypto.randomUUID();
    setLoading(true);
    setError("");
    const res = await createAsset({ ...form, id: generatedId, status_id: inStorageStatusId });
    setLoading(false);
    if (res?.error) { setConfirming(false); return setError(res.error); }
    setNewAssetId(generatedId);
    router.refresh();
    setStep("assign");
  }

  async function handleAssign() {
    if (!contactId) return setAssignError("Please select a person to assign to.");
    const contact = lookups.contacts.find((c) => c.id === contactId);
    setAssignLoading(true);
    setAssignError("");
    const res = await assignAsset({
      asset_id: newAssetId,
      contact_id: contactId,
      location_id: assignLocationId || undefined,
      job_level_id: contact?.job_level_id || undefined,
      notes: assignNotes || undefined,
      assigned_at: assignedAt,
      in_use_status_id: inUseStatusId,
      current_status_id: inStorageStatusId,
    });
    setAssignLoading(false);
    if (res?.error) return setAssignError(res.error);
    router.refresh();
    onClose();
  }

  if (step === "assign") {
    return (
      <Modal title="Assign Asset" subtitle="Asset created — assign it to someone or skip for now" onClose={onClose}>
        <FormStack>
          {assignError && <ErrorBanner message={assignError} />}

          <FormField label="Assign To" required>
            <Select value={contactId} onChange={(e) => { setContactId(e.target.value); setAssignError(""); }} error={!!assignError && !contactId}>
              <option value="">Select person…</option>
              {lookups.contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </FormField>

          <FormField label="Location">
            <Select value={assignLocationId} onChange={(e) => setAssignLocationId(e.target.value)}>
              <option value="">No location</option>
              {lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </FormField>

          <FormField label="Assigned Date">
            <Input type="date" value={assignedAt} onChange={(e) => setAssignedAt(e.target.value)} />
          </FormField>

          <FormField label="Notes">
            <Textarea placeholder="Optional handover notes…" value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} rows={2} />
          </FormField>

          <ModalFooter>
            <BtnSecondary onClick={onClose}>Skip</BtnSecondary>
            <BtnPrimary onClick={handleAssign} loading={assignLoading}>Assign Asset</BtnPrimary>
          </ModalFooter>
        </FormStack>
      </Modal>
    );
  }

  return (
    <Modal title="Add Asset" subtitle="Register a new asset in the inventory" onClose={onClose} width="max-w-2xl">
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Description" required>
          <Input placeholder="e.g. Dell XPS 15 9530" value={form.description} onChange={(e) => set("description", e.target.value)} error={!!error && !form.description} />
        </FormField>

        <FormGrid>
          <FormField label="Category" required>
            <Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)} error={!!error && !form.category_id}>
              <option value="">Select category</option>
              {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Serial Number">
            <Input placeholder="SN-XXXXX" value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Purchase Date">
            <Input type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} />
          </FormField>
          <FormField label="Invoice Number">
            <Input value={form.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="CPU Generation">
          <Input placeholder="e.g. 13" value={form.cpu_gen} onChange={(e) => set("cpu_gen", e.target.value)} />
        </FormField>

        <FormGrid>
          <FormField label="OS Type">
            <Input placeholder="e.g. Windows 11" value={form.os_type} onChange={(e) => set("os_type", e.target.value)} />
          </FormField>
          <FormField label="OS License Type">
            <Input placeholder="e.g. OEM / Retail" value={form.os_license_type} onChange={(e) => set("os_license_type", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Warranty Start">
            <Input type="date" value={form.warranty_start_date} onChange={(e) => set("warranty_start_date", e.target.value)} />
          </FormField>
          <FormField label="Warranty End" error={fieldErrors.warranty_end_date}>
            <Input type="date" value={form.warranty_end_date} onChange={(e) => set("warranty_end_date", e.target.value)} error={!!fieldErrors.warranty_end_date} />
          </FormField>
        </FormGrid>

        <FormField label="Expected End of Life" error={fieldErrors.expected_end_of_life_date}>
          <Input type="date" value={form.expected_end_of_life_date} onChange={(e) => set("expected_end_of_life_date", e.target.value)} error={!!fieldErrors.expected_end_of_life_date} />
        </FormField>

        <FormField label="Notes">
          <Textarea placeholder="Any additional notes…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirming}
            onAsk={() => setConfirming(true)}
            onConfirm={handleSubmit}
            onCancel={() => setConfirming(false)}
            loading={loading}
            label="Add Asset"
            confirmLabel="Yes, add asset"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ─── EDIT ASSET ───────────────────────────────────────────────────────────────

export function EditAssetModal({
  asset,
  onClose,
  lookups,
}: {
  asset: AssetWithRelations;
  onClose: () => void;
  lookups: Omit<LookupProps, "statuses" | "contacts">;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    description: asset.description ?? "",
    category_id: asset.category_id ?? "",
    serial_number: asset.serial_number ?? "",
    purchase_date: asset.purchase_date ?? "",
    invoice_number: asset.invoice_number ?? "",
    cpu_gen: asset.cpu_gen ?? "",
    owning_department_id: asset.owning_department_id ?? "",
    location_id: asset.location_id ?? "",
    assigned_job_level_id: asset.assigned_job_level_id ?? "",
    os_type: asset.os_type ?? "",
    os_license_type: asset.os_license_type ?? "",
    warranty_start_date: asset.warranty_start_date ?? "",
    warranty_end_date: asset.warranty_end_date ?? "",
    expected_end_of_life_date: asset.expected_end_of_life_date ?? "",
    performance_rating: asset.performance_rating ?? "",
    performance_notes: asset.performance_notes ?? "",
    notes: asset.notes ?? "",
  });

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirming(false);
    setFieldErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  function validateDates(): boolean {
    const errs: Record<string, string> = {};
    if (form.warranty_start_date && form.warranty_end_date && form.warranty_end_date < form.warranty_start_date)
      errs.warranty_end_date = "End date must be after start date";
    if (form.purchase_date && form.expected_end_of_life_date && form.expected_end_of_life_date < form.purchase_date)
      errs.expected_end_of_life_date = "Must be after purchase date";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!form.description.trim()) return setError("Description is required.");
    if (!validateDates()) return;
    setLoading(true);
    setError("");
    const res = await updateAsset(asset.id, form);
    setLoading(false);
    if (res?.error) { setConfirming(false); return setError(res.error); }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Edit Asset" subtitle={`#${asset.asset_code} · ${asset.description}`} onClose={onClose} width="max-w-2xl">
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Description" required>
          <Input value={form.description} onChange={(e) => set("description", e.target.value)} error={!!error && !form.description} />
        </FormField>

        <FormGrid>
          <FormField label="Category">
            <Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              {lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Department">
            <Select value={form.owning_department_id} onChange={(e) => set("owning_department_id", e.target.value)}>
              <option value="">No department</option>
              {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Serial Number">
            <Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
          </FormField>
          <FormField label="Invoice Number">
            <Input value={form.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Purchase Date">
            <Input type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} />
          </FormField>
          <FormField label="Location">
            <Select value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
              <option value="">No location</option>
              {lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="OS Type">
            <Input value={form.os_type} onChange={(e) => set("os_type", e.target.value)} />
          </FormField>
          <FormField label="OS License Type">
            <Input value={form.os_license_type} onChange={(e) => set("os_license_type", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="CPU Generation">
            <Input value={form.cpu_gen} onChange={(e) => set("cpu_gen", e.target.value)} />
          </FormField>
          <FormField label="Job Level">
            <Select value={form.assigned_job_level_id} onChange={(e) => set("assigned_job_level_id", e.target.value)}>
              <option value="">None</option>
              {lookups.jobLevels.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Warranty Start">
            <Input type="date" value={form.warranty_start_date} onChange={(e) => set("warranty_start_date", e.target.value)} />
          </FormField>
          <FormField label="Warranty End" error={fieldErrors.warranty_end_date}>
            <Input type="date" value={form.warranty_end_date} onChange={(e) => set("warranty_end_date", e.target.value)} error={!!fieldErrors.warranty_end_date} />
          </FormField>
        </FormGrid>

        <FormField label="Expected End of Life" error={fieldErrors.expected_end_of_life_date}>
          <Input type="date" value={form.expected_end_of_life_date} onChange={(e) => set("expected_end_of_life_date", e.target.value)} error={!!fieldErrors.expected_end_of_life_date} />
        </FormField>

        <FormGrid>
          <FormField label="Performance Rating">
            <Select value={form.performance_rating} onChange={(e) => set("performance_rating", e.target.value)}>
              <option value="">Not rated</option>
              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </Select>
          </FormField>
          <FormField label="Performance Notes">
            <Input placeholder="Optional notes on performance…" value={form.performance_notes} onChange={(e) => set("performance_notes", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirming}
            onAsk={() => setConfirming(true)}
            onConfirm={handleSubmit}
            onCancel={() => setConfirming(false)}
            loading={loading}
            label="Save Changes"
            confirmLabel="Yes, save"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ─── CHANGE STATUS ────────────────────────────────────────────────────────────

export function ChangeStatusModal({
  asset,
  statuses,
  onClose,
}: {
  asset: AssetWithRelations;
  statuses: Status[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(asset.status_id);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Reset confirm whenever selection changes
  function handleSelect(id: string) {
    setSelectedId(id);
    setConfirming(false);
  }

  async function handleSubmit() {
    if (selectedId === asset.status_id) return onClose();
    setLoading(true);
    setError("");
    const res = await changeAssetStatus(asset.id, selectedId, asset.status_id, reason);
    setLoading(false);
    if (res?.error) { setConfirming(false); return setError(res.error); }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Change Status" subtitle={`#${asset.asset_code} · ${asset.description}`} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-2 gap-2">
          {statuses.map((s) => {
            const cfg = getStatusConfig(s.name);
            const active = selectedId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all"
                style={active
                  ? { borderColor: "#C04F28", background: "#C04F28", color: "#fff" }
                  : { borderColor: "#e7e5e4" }}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "bg-white" : cfg.dot}`} />
                <span className={`text-[13px] font-medium ${active ? "text-white" : "text-stone-700"}`}>
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>

        <FormField label="Reason (optional)">
          <Textarea
            placeholder="Why is this status changing?"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setConfirming(false); }}
            rows={2}
          />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          {selectedId === asset.status_id ? (
            <BtnSecondary onClick={onClose}>No change</BtnSecondary>
          ) : (
            <ConfirmInline
              confirming={confirming}
              onAsk={() => setConfirming(true)}
              onConfirm={handleSubmit}
              onCancel={() => setConfirming(false)}
              loading={loading}
              label="Apply Status"
              confirmLabel="Yes, change"
              variant="warning"
              className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#C04F28" }}
            />
          )}
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ─── ASSIGN ASSET ─────────────────────────────────────────────────────────────

export function AssignAssetModal({
  asset,
  contacts,
  locations,
  inUseStatusId,
  inStorageStatusId,
  onClose,
}: {
  asset: AssetWithRelations;
  contacts: Contact[];
  locations: Location[];
  inUseStatusId: string;
  inStorageStatusId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactId, setContactId] = useState(asset.assigned_to_contact_id ?? "");
  const [locationId, setLocationId] = useState(asset.location_id ?? "");
  const [notes, setNotes] = useState("");
  const [assignedAt, setAssignedAt] = useState(new Date().toISOString().split("T")[0]);
  const [storageStep, setStorageStep] = useState(false);
  const [storageLocationId, setStorageLocationId] = useState("");
  const [confirmingAssign, setConfirmingAssign] = useState(false);

  const isCurrentlyAssigned = !!asset.assigned_to_contact_id;

  async function handleAssign() {
    if (!contactId) return setError("Please select a person to assign to.");
    setLoading(true);
    setError("");
    const res = await assignAsset({
      asset_id: asset.id,
      contact_id: contactId,
      location_id: locationId || undefined,
      notes: notes || undefined,
      assigned_at: assignedAt,
      in_use_status_id: inUseStatusId,
      current_status_id: asset.status_id,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  async function handleSendToStorage() {
    setLoading(true);
    setError("");
    const res = await unassignAsset(asset.id, inStorageStatusId, asset.status_id, storageLocationId || undefined);
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Assign Asset" subtitle={`#${asset.asset_code} · ${asset.description}`} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        {isCurrentlyAssigned && (
          <div className="px-3 py-2.5 bg-sky-50 border border-sky-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-sky-800">Currently assigned to</p>
                <p className="text-[13px] text-sky-900 font-semibold">{asset.assigned_to_contact?.full_name}</p>
              </div>
              {!storageStep && (
                <button
                  onClick={() => setStorageStep(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white rounded-lg transition-colors"
                  style={{ background: "#415445" }}
                >
                  <Archive size={13} /> Send to Storage
                </button>
              )}
            </div>
            {storageStep && (
              <div className="space-y-2 pt-1 border-t border-sky-200">
                <p className="text-[12px] font-medium text-sky-800">Select storage location</p>
                <Select value={storageLocationId} onChange={(e) => setStorageLocationId(e.target.value)}>
                  <option value="">No specific location</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
                <div className="flex gap-2 pt-1">
                  <BtnSecondary onClick={() => setStorageStep(false)}>Cancel</BtnSecondary>
                  <BtnPrimary onClick={handleSendToStorage} loading={loading}>Confirm</BtnPrimary>
                </div>
              </div>
            )}
          </div>
        )}

        <FormField label="Assign To" required>
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)} error={!!error && !contactId}>
            <option value="">Select person…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </Select>
        </FormField>

        <FormGrid>
          <FormField label="Location">
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">No location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Assigned Date">
            <Input type="date" value={assignedAt} onChange={(e) => setAssignedAt(e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Notes">
          <Textarea placeholder="Optional handover notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirmingAssign}
            onAsk={() => {
              if (!contactId) return setError("Please select a person to assign to.");
              setError("");
              setConfirmingAssign(true);
            }}
            onConfirm={handleAssign}
            onCancel={() => setConfirmingAssign(false)}
            loading={loading}
            label="Assign Asset"
            confirmLabel="Yes, assign"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}
