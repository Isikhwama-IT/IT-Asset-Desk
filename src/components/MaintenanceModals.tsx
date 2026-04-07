"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal, FormField, Input, Select, Textarea,
  ModalFooter, BtnPrimary, BtnSecondary, ErrorBanner, FormGrid, FormStack, ConfirmInline,
} from "@/components/modal-ui";
import { createMaintenanceRecord, updateMaintenanceRecord } from "@/lib/actions";
import type { MaintenanceRecord } from "@/types/database";

const MAINTENANCE_STATUSES = [
  "Open", "In Progress", "Waiting Vendor", "Resolved", "Closed", "Cancelled",
];

// ─── ADD MAINTENANCE RECORD ───────────────────────────────────────────────────

export function AddMaintenanceModal({
  assetId,
  assetLabel,
  onClose,
}: {
  assetId: string;
  assetLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [costError, setCostError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    issue_description: "",
    vendor_name: "",
    status: "Open",
    cost: "",
    opened_at: new Date().toISOString().split("T")[0],
    resolution_notes: "",
  });
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirming(false);
    if (k === "cost") setCostError("");
  };

  async function handleSubmit() {
    if (!form.issue_description.trim()) return setError("Issue description is required.");
    if (form.cost && isNaN(parseFloat(form.cost))) return setCostError("Must be a valid number.");
    setLoading(true);
    setError("");
    const res = await createMaintenanceRecord({
      asset_id: assetId,
      issue_description: form.issue_description,
      vendor_name: form.vendor_name || undefined,
      status: form.status,
      cost: form.cost ? Number(form.cost) : undefined,
      opened_at: form.opened_at,
      resolution_notes: form.resolution_notes || undefined,
    });
    setLoading(false);
    if (res?.error) { setConfirming(false); return setError(res.error); }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Log Maintenance" subtitle={assetLabel} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Issue Description" required>
          <Textarea
            placeholder="Describe the issue or maintenance task…"
            value={form.issue_description}
            onChange={(e) => set("issue_description", e.target.value)}
            error={!!error && !form.issue_description}
            rows={3}
          />
        </FormField>

        <FormGrid>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {MAINTENANCE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="Date Opened">
            <Input type="date" value={form.opened_at} onChange={(e) => set("opened_at", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Vendor / Technician">
            <Input placeholder="Optional" value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} />
          </FormField>
          <FormField label="Cost (R)" error={costError}>
            <Input type="number" placeholder="0.00" value={form.cost} onChange={(e) => set("cost", e.target.value)} error={!!costError} />
          </FormField>
        </FormGrid>

        <FormField label="Resolution Notes">
          <Textarea
            placeholder="Optional notes on resolution or outcome…"
            value={form.resolution_notes}
            onChange={(e) => set("resolution_notes", e.target.value)}
            rows={2}
          />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirming}
            onAsk={() => setConfirming(true)}
            onConfirm={handleSubmit}
            onCancel={() => setConfirming(false)}
            loading={loading}
            label="Log Record"
            confirmLabel="Yes, log it"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-700 transition-colors"
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ─── EDIT MAINTENANCE RECORD ──────────────────────────────────────────────────

export function EditMaintenanceModal({
  record,
  assetId,
  onClose,
}: {
  record: MaintenanceRecord;
  assetId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    status: record.status,
    vendor_name: record.vendor_name ?? "",
    cost: record.cost?.toString() ?? "",
    resolution_notes: record.resolution_notes ?? "",
    closed_at: record.closed_at?.split("T")[0] ?? "",
  });
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirming(false);
    setFieldErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (form.cost && isNaN(parseFloat(form.cost))) errs.cost = "Must be a valid number.";
    if (form.closed_at && form.closed_at < record.opened_at.split("T")[0]) errs.closed_at = "Close date must not be before open date.";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setLoading(true);
    setError("");
    const res = await updateMaintenanceRecord(record.id, assetId, {
      status: form.status,
      vendor_name: form.vendor_name || undefined,
      cost: form.cost ? Number(form.cost) : undefined,
      resolution_notes: form.resolution_notes || undefined,
      closed_at: form.closed_at || undefined,
    });
    setLoading(false);
    if (res?.error) { setConfirming(false); return setError(res.error); }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Update Maintenance" subtitle={record.issue_description} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {MAINTENANCE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FormField>

        <FormGrid>
          <FormField label="Vendor / Technician">
            <Input value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} />
          </FormField>
          <FormField label="Cost (R)" error={fieldErrors.cost}>
            <Input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} error={!!fieldErrors.cost} />
          </FormField>
        </FormGrid>

        <FormField label="Resolution Notes">
          <Textarea
            value={form.resolution_notes}
            onChange={(e) => set("resolution_notes", e.target.value)}
            rows={3}
          />
        </FormField>

        <FormField label="Date Closed" error={fieldErrors.closed_at}>
          <Input type="date" value={form.closed_at} onChange={(e) => set("closed_at", e.target.value)} error={!!fieldErrors.closed_at} />
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
            className="px-4 py-2 text-[13px] font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-700 transition-colors"
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}
