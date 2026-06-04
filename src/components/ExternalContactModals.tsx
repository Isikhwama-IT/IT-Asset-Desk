"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, Input, ModalFooter, BtnSecondary, ConfirmInline, ErrorBanner, FormStack, FormGrid } from "@/components/modal-ui";
import { createExternalContact, updateExternalContact, deleteExternalContact } from "@/lib/actions";
import type { ExternalContact } from "@/types/database";

export function AddExternalContactModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "" });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (!form.name.trim()) return setError("Name is required.");
    setLoading(true);
    setError("");
    const res = await createExternalContact(form);
    setLoading(false);
    if ((res as any)?.error) return setError((res as any).error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Add External Contact" subtitle="Add a new external contact" onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}
        <FormField label="Name" required>
          <Input
            placeholder="e.g. John Smith"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={!!error && !form.name}
          />
        </FormField>
        <FormField label="Company">
          <Input
            placeholder="e.g. ABC Corporation"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </FormField>
        <FormGrid>
          <FormField label="Email">
            <Input
              type="email"
              placeholder="john@company.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </FormField>
        </FormGrid>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirming}
            onAsk={() => setConfirming(true)}
            onConfirm={handleSubmit}
            onCancel={() => setConfirming(false)}
            loading={loading}
            label="Add External"
            confirmLabel="Yes, add"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

export function EditExternalContactModal({ contact, onClose }: { contact: ExternalContact; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState({ name: contact.name, company: contact.company ?? "", email: contact.email ?? "", phone: contact.phone ?? "" });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (!form.name.trim()) return setError("Name is required.");
    setLoading(true);
    setError("");
    const res = await updateExternalContact(contact.id, form);
    setLoading(false);
    if ((res as any)?.error) return setError((res as any).error);
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    setDeleteLoading(true);
    const res = await deleteExternalContact(contact.id);
    setDeleteLoading(false);
    if ((res as any)?.error) return setError((res as any).error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Edit External Contact" subtitle={contact.name} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}
        <FormField label="Name" required>
          <Input
            placeholder="e.g. John Smith"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={!!error && !form.name}
          />
        </FormField>
        <FormField label="Company">
          <Input
            placeholder="e.g. ABC Corporation"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </FormField>
        <FormGrid>
          <FormField label="Email">
            <Input
              type="email"
              placeholder="john@company.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </FormField>
        </FormGrid>
        <ModalFooter>
          <div className="mr-auto">
            <ConfirmInline
              confirming={confirmingDelete}
              onAsk={() => setConfirmingDelete(true)}
              onConfirm={handleDelete}
              onCancel={() => setConfirmingDelete(false)}
              loading={deleteLoading}
              label="Delete"
              confirmLabel="Yes, delete"
              variant="danger"
              className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#dc2626" }}
            />
          </div>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <ConfirmInline
            confirming={confirmingSave}
            onAsk={() => setConfirmingSave(true)}
            onConfirm={handleSubmit}
            onCancel={() => setConfirmingSave(false)}
            loading={loading}
            label="Save"
            confirmLabel="Yes, save"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press" style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}
