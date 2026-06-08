"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
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
  const [assignedCode, setAssignedCode] = useState<number | null>(null);
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
    if (res?.printer_code) setAssignedCode(res.printer_code);
    router.refresh();
    if (!res?.printer_code) onClose();
  }

  // After success: show the assigned code before closing
  if (assignedCode !== null) {
    return (
      <Modal title="Person Added" subtitle={form.full_name} onClose={onClose}>
        <div className="px-6 py-6 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#eef3e6" }}>
            <Printer size={24} style={{ color: "#415445" }} />
          </div>
          <div className="text-center">
            <p className="text-[13px] text-stone-500 mb-1">Printer code assigned</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: "#C04F28", letterSpacing: "-0.03em" }}>
              {assignedCode}
            </p>
            <p className="text-[12px] text-stone-400 mt-2">
              Give this code to {form.full_name} — they use it on the Rainbow Park, Baker Street, and Loan printers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-[13px] font-medium text-white rounded-lg transition-colors"
            style={{ background: "#C04F28" }}
          >
            Done
          </button>
        </div>
      </Modal>
    );
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

        <div className="px-4 py-3 rounded-lg border border-stone-100 bg-stone-50 flex items-center gap-2.5">
          <Printer size={13} className="text-stone-400 flex-shrink-0" />
          <p className="text-[12px] text-stone-500">
            A printer code will be auto-assigned when you save.
          </p>
        </div>

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
  const [codeError, setCodeError] = useState("");
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
    printer_code: contact.printer_code != null ? String(contact.printer_code) : "",
  });
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirmingSave(false);
    if (k === "email") setEmailError("");
    if (k === "printer_code") setCodeError("");
  };

  async function handleSubmit() {
    if (!form.full_name.trim()) return setError("Full name is required.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setEmailError("Please enter a valid email address.");

    let printerCode: number | null = null;
    if (form.printer_code.trim() !== "") {
      const parsed = parseInt(form.printer_code.trim(), 10);
      if (isNaN(parsed) || parsed < 1) return setCodeError("Enter a valid positive number.");
      printerCode = parsed;
    }

    setLoading(true);
    setError("");
    const res = await updateContact(contact.id, {
      full_name: form.full_name,
      email: form.email,
      department_id: form.department_id,
      job_level_id: form.job_level_id,
      location_id: form.location_id,
      printer_code: printerCode,
    });
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

        {/* Printer code display / override */}
        <div className="px-4 py-3 rounded-lg border border-stone-200 bg-stone-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#eef3e6" }}>
            <Printer size={14} style={{ color: "#415445" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Printer Code</p>
            <input
              type="number"
              className={`w-full text-[14px] font-semibold bg-transparent border-none outline-none p-0 tabular-nums ${codeError ? "text-red-500" : "text-stone-800"}`}
              style={{ letterSpacing: "-0.02em" }}
              value={form.printer_code}
              onChange={(e) => set("printer_code", e.target.value)}
              placeholder="Not yet assigned"
              min={1}
            />
            {codeError && <p className="text-[11px] text-red-500 mt-0.5">{codeError}</p>}
          </div>
        </div>

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
