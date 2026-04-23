"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal, FormField, Input, Select, Textarea,
  ModalFooter, BtnPrimary, BtnSecondary, BtnDanger, ErrorBanner, FormGrid, FormStack, ConfirmInline,
} from "@/components/modal-ui";
import { createContact, updateContact, setContactActive, deleteContact } from "@/lib/actions";
import type { Contact, Department, JobLevel, Location } from "@/types/database";

type ContactWithRelations = Contact & {
  department: Department | null;
  job_level: JobLevel | null;
};

interface LookupProps {
  departments: Department[];
  jobLevels: JobLevel[];
  locations: Location[];
}

// ─── ADD CONTACT ──────────────────────────────────────────────────────────────

export function AddContactModal({
  onClose,
  lookups,
}: {
  onClose: () => void;
  lookups: LookupProps;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    department_id: "",
    job_level_id: "",
    location_id: "",
  });
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirming(false);
    if (k === "email") setEmailError("");
  };

  async function handleSubmit() {
    if (!form.full_name.trim()) return setError("Full name is required.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setEmailError("Please enter a valid email address.");
    setLoading(true);
    setError("");
    const res = await createContact(form);
    setLoading(false);
    if (res?.error) { setConfirming(false); return setError(res.error); }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Add Person" subtitle="Add a new contact to the directory" onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Full Name" required>
          <Input
            placeholder="e.g. Sarah Chen"
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            error={!!error && !form.full_name}
          />
        </FormField>

        <FormField label="Email Address" error={emailError}>
          <Input
            type="email"
            placeholder="sarah@company.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={!!emailError}
          />
        </FormField>

        <FormGrid>
          <FormField label="Department">
            <Select value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">No department</option>
              {lookups.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Job Level">
            <Select value={form.job_level_id} onChange={(e) => set("job_level_id", e.target.value)}>
              <option value="">No level</option>
              {lookups.jobLevels.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </Select>
          </FormField>
        </FormGrid>

        <FormField label="Site">
          <Select value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
            <option value="">No site</option>
            {lookups.locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirming}
            onAsk={() => setConfirming(true)}
            onConfirm={handleSubmit}
            onCancel={() => setConfirming(false)}
            loading={loading}
            label="Add Person"
            confirmLabel="Yes, add"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

// ─── EDIT CONTACT ─────────────────────────────────────────────────────────────

export function EditContactModal({
  contact,
  onClose,
  lookups,
}: {
  contact: ContactWithRelations;
  onClose: () => void;
  lookups: LookupProps;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [confirmingToggle, setConfirmingToggle] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [form, setForm] = useState({
    full_name: contact.full_name,
    email: contact.email ?? "",
    department_id: contact.department_id ?? "",
    job_level_id: contact.job_level_id ?? "",
    location_id: contact.location_id ?? "",
  });
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirmingSave(false);
    if (k === "email") setEmailError("");
  };

  async function handleSubmit() {
    if (!form.full_name.trim()) return setError("Full name is required.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setEmailError("Please enter a valid email address.");
    setLoading(true);
    setError("");
    const res = await updateContact(contact.id, form);
    setLoading(false);
    if (res?.error) { setConfirmingSave(false); return setError(res.error); }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    setDeleteLoading(true);
    const res = await deleteContact(contact.id);
    setDeleteLoading(false);
    if (res?.error) return setDeleteError(res.error);
    router.refresh();
    onClose();
  }

  async function handleToggleActive() {
    setToggleLoading(true);
    await setContactActive(contact.id, !contact.is_active);
    setToggleLoading(false);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Edit Person" subtitle={contact.full_name} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Full Name" required>
          <Input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            error={!!error && !form.full_name}
          />
        </FormField>

        <FormField label="Email Address" error={emailError}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={!!emailError}
          />
        </FormField>

        <FormGrid>
          <FormField label="Department">
            <Select value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">No department</option>
              {lookups.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Job Level">
            <Select value={form.job_level_id} onChange={(e) => set("job_level_id", e.target.value)}>
              <option value="">No level</option>
              {lookups.jobLevels.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </Select>
          </FormField>
        </FormGrid>

        <FormField label="Site">
          <Select value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
            <option value="">No site</option>
            {lookups.locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </FormField>

        <ModalFooter>
          {/* Left side: Deactivate + Delete */}
          <div className="flex items-center gap-2 mr-auto">
            <ConfirmInline
              confirming={confirmingToggle}
              onAsk={() => setConfirmingToggle(true)}
              onConfirm={handleToggleActive}
              onCancel={() => setConfirmingToggle(false)}
              loading={toggleLoading}
              label={contact.is_active ? "Deactivate" : "Reactivate"}
              confirmLabel={contact.is_active ? "Yes, deactivate" : "Yes, reactivate"}
              variant={contact.is_active ? "danger" : "warning"}
              className={
                contact.is_active
                  ? "px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  : "px-4 py-2 text-[13px] font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
              }
            />
            <ConfirmInline
              confirming={confirmingDelete}
              onAsk={() => setConfirmingDelete(true)}
              onConfirm={handleDelete}
              onCancel={() => { setConfirmingDelete(false); setDeleteError(""); }}
              loading={deleteLoading}
              label="Delete"
              confirmLabel="Yes, delete permanently"
              variant="danger"
              className="px-4 py-2 text-[13px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            />
            {deleteError && <span className="text-[12px] text-red-500">{deleteError}</span>}
          </div>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirmingSave}
            onAsk={() => setConfirmingSave(true)}
            onConfirm={handleSubmit}
            onCancel={() => setConfirmingSave(false)}
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
