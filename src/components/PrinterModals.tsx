"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
  ModalFooter,
  BtnPrimary,
  BtnSecondary,
  ErrorBanner,
  FormGrid,
  FormStack,
  ConfirmInline,
} from "@/components/modal-ui";
import {
  createPrinter,
  updatePrinter,
  createPrinterTonerOrder,
  updatePrinterTonerOrder,
  createPrinterPaperOrder,
  updatePrinterPaperOrder,
  createPrinterTicket,
  updatePrinterTicket,
  createPrinterMeterReading,
} from "@/lib/actions";
import {
  CONSUMABLE_STATUSES,
  ORDER_STATUSES,
  PRINTER_STATUSES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/lib/printers";
import type {
  Contact,
  Department,
  Location,
  PrinterPaperOrder,
  PrinterTicket,
  PrinterTonerOrder,
  PrinterWithRelations,
} from "@/types/database";

type LookupProps = {
  departments: Department[];
  locations: Location[];
  contacts: Contact[];
};

const today = () => new Date().toISOString().split("T")[0];

function asPositiveInteger(value: string, label: string): number | string {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return `${label} must be a positive whole number.`;
  return parsed;
}

function asNonNegativeInteger(value: string, label: string): number | string {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return `${label} must be zero or higher.`;
  return parsed;
}

function asOptionalMoney(value: string): number | null | string {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "Cost must be zero or higher.";
  return parsed;
}

export function AddPrinterModal({
  onClose,
  lookups,
}: {
  onClose: () => void;
  lookups: LookupProps;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    name: "",
    serial_number: "",
    ip_address: "",
    mac_address: "",
    supplier: "",
    manufacturer: "",
    model: "",
    department_id: "",
    location_id: "",
    primary_contact_id: "",
    status: "Active",
    toner_status: "OK",
    paper_status: "OK",
    toner_model: "",
    paper_size: "A4",
    last_meter_reading: "",
    last_meter_reading_at: "",
    warranty_end_date: "",
    notes: "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setConfirming(false);
    setError("");
  };

  async function handleSubmit() {
    if (!form.name.trim()) return setError("Printer name is required.");
    const meterReading = form.last_meter_reading
      ? asNonNegativeInteger(form.last_meter_reading, "Meter reading")
      : null;
    if (typeof meterReading === "string") return setError(meterReading);

    setLoading(true);
    const res = await createPrinter({
      ...form,
      last_meter_reading: meterReading,
      last_meter_reading_at: form.last_meter_reading_at || undefined,
    });
    setLoading(false);
    if (res?.error) {
      setConfirming(false);
      return setError(res.error);
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Add Printer" subtitle="Register printer details, consumables, supplier and network info" onClose={onClose} width="max-w-2xl">
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Printer Name" required>
          <Input placeholder="e.g. Finance Canon iR-ADV" value={form.name} onChange={(e) => set("name", e.target.value)} error={!!error && !form.name} />
        </FormField>

        <FormGrid>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {PRINTER_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
          </FormField>
          <FormField label="Site">
            <Select value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
              <option value="">Select site</option>
              {lookups.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Manufacturer">
            <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          </FormField>
          <FormField label="Model">
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Serial Number">
            <Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
          </FormField>
          <FormField label="Supplier">
            <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="IP Address">
            <Input placeholder="192.168.0.10" value={form.ip_address} onChange={(e) => set("ip_address", e.target.value)} />
          </FormField>
          <FormField label="MAC Address">
            <Input value={form.mac_address} onChange={(e) => set("mac_address", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Department">
            <Select value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">No department</option>
              {lookups.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Primary Contact">
            <Select value={form.primary_contact_id} onChange={(e) => set("primary_contact_id", e.target.value)}>
              <option value="">No contact</option>
              {lookups.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Toner Model">
            <Input placeholder="e.g. TN-3480" value={form.toner_model} onChange={(e) => set("toner_model", e.target.value)} />
          </FormField>
          <FormField label="Paper Size">
            <Input value={form.paper_size} onChange={(e) => set("paper_size", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Toner Status">
            <Select value={form.toner_status} onChange={(e) => set("toner_status", e.target.value)}>
              {CONSUMABLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
          </FormField>
          <FormField label="Paper Status">
            <Select value={form.paper_status} onChange={(e) => set("paper_status", e.target.value)}>
              {CONSUMABLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Meter Reading">
            <Input type="number" min={0} value={form.last_meter_reading} onChange={(e) => set("last_meter_reading", e.target.value)} />
          </FormField>
          <FormField label="Meter Date">
            <Input type="date" value={form.last_meter_reading_at} onChange={(e) => set("last_meter_reading_at", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Warranty End">
          <Input type="date" value={form.warranty_end_date} onChange={(e) => set("warranty_end_date", e.target.value)} />
        </FormField>

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
            label="Add Printer"
            confirmLabel="Yes, add printer"
            variant="warning"
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press"
            style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

export function EditPrinterModal({
  printer,
  lookups,
  onClose,
}: {
  printer: PrinterWithRelations;
  lookups: LookupProps;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    name: printer.name ?? "",
    serial_number: printer.serial_number ?? "",
    ip_address: printer.ip_address ?? "",
    mac_address: printer.mac_address ?? "",
    supplier: printer.supplier ?? "",
    manufacturer: printer.manufacturer ?? "",
    model: printer.model ?? "",
    department_id: printer.department_id ?? "",
    location_id: printer.location_id ?? "",
    primary_contact_id: printer.primary_contact_id ?? "",
    status: printer.status ?? "Active",
    toner_status: printer.toner_status ?? "OK",
    paper_status: printer.paper_status ?? "OK",
    toner_model: printer.toner_model ?? "",
    paper_size: printer.paper_size ?? "",
    last_meter_reading: printer.last_meter_reading?.toString() ?? "",
    last_meter_reading_at: printer.last_meter_reading_at ?? "",
    warranty_end_date: printer.warranty_end_date ?? "",
    notes: printer.notes ?? "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setConfirming(false);
    setError("");
  };

  async function handleSubmit() {
    if (!form.name.trim()) return setError("Printer name is required.");
    const meterReading = form.last_meter_reading
      ? asNonNegativeInteger(form.last_meter_reading, "Meter reading")
      : null;
    if (typeof meterReading === "string") return setError(meterReading);

    setLoading(true);
    const res = await updatePrinter(printer.id, {
      ...form,
      last_meter_reading: meterReading,
      last_meter_reading_at: form.last_meter_reading_at || undefined,
    });
    setLoading(false);
    if (res?.error) {
      setConfirming(false);
      return setError(res.error);
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Edit Printer" subtitle={`#${printer.printer_code} - ${printer.name}`} onClose={onClose} width="max-w-2xl">
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormField label="Printer Name" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} error={!!error && !form.name} />
        </FormField>

        <FormGrid>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {PRINTER_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
          </FormField>
          <FormField label="Site">
            <Select value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
              <option value="">Select site</option>
              {lookups.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Manufacturer">
            <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          </FormField>
          <FormField label="Model">
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Serial Number">
            <Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
          </FormField>
          <FormField label="Supplier">
            <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="IP Address">
            <Input value={form.ip_address} onChange={(e) => set("ip_address", e.target.value)} />
          </FormField>
          <FormField label="MAC Address">
            <Input value={form.mac_address} onChange={(e) => set("mac_address", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Department">
            <Select value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">No department</option>
              {lookups.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Primary Contact">
            <Select value={form.primary_contact_id} onChange={(e) => set("primary_contact_id", e.target.value)}>
              <option value="">No contact</option>
              {lookups.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Toner Model">
            <Input value={form.toner_model} onChange={(e) => set("toner_model", e.target.value)} />
          </FormField>
          <FormField label="Paper Size">
            <Input value={form.paper_size} onChange={(e) => set("paper_size", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Toner Status">
            <Select value={form.toner_status} onChange={(e) => set("toner_status", e.target.value)}>
              {CONSUMABLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
          </FormField>
          <FormField label="Paper Status">
            <Select value={form.paper_status} onChange={(e) => set("paper_status", e.target.value)}>
              {CONSUMABLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField label="Meter Reading">
            <Input type="number" min={0} value={form.last_meter_reading} onChange={(e) => set("last_meter_reading", e.target.value)} />
          </FormField>
          <FormField label="Meter Date">
            <Input type="date" value={form.last_meter_reading_at} onChange={(e) => set("last_meter_reading_at", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Warranty End">
          <Input type="date" value={form.warranty_end_date} onChange={(e) => set("warranty_end_date", e.target.value)} />
        </FormField>

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
            className="px-4 py-2 text-[13px] font-medium text-white rounded-lg transition-colors btn-press"
            style={{ background: "#C04F28" }}
          />
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}

export function AddTonerOrderModal({
  printerId,
  printerLabel,
  defaultTonerType,
  contacts,
  onClose,
}: {
  printerId: string;
  printerLabel: string;
  defaultTonerType?: string | null;
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    toner_type: defaultTonerType ?? "",
    quantity: "1",
    status: "Requested",
    supplier: "",
    order_number: "",
    requested_by_contact_id: "",
    requested_at: today(),
    expected_at: "",
    received_at: "",
    notes: "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit() {
    if (!form.toner_type.trim()) return setError("Toner type is required.");
    const quantity = asPositiveInteger(form.quantity, "Quantity");
    if (typeof quantity === "string") return setError(quantity);

    setLoading(true);
    const res = await createPrinterTonerOrder({
      printer_id: printerId,
      ...form,
      quantity,
      received_at: form.status === "Received" && !form.received_at ? today() : form.received_at,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Order Toner" subtitle={printerLabel} onClose={onClose}>
      <OrderForm
        kind="toner"
        form={form}
        contacts={contacts}
        set={set}
        error={error}
        loading={loading}
        onClose={onClose}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

export function EditTonerOrderModal({
  order,
  contacts,
  onClose,
}: {
  order: PrinterTonerOrder;
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    toner_type: order.toner_type,
    quantity: order.quantity.toString(),
    status: order.status,
    supplier: order.supplier ?? "",
    order_number: order.order_number ?? "",
    requested_by_contact_id: order.requested_by_contact_id ?? "",
    requested_at: order.requested_at ?? today(),
    expected_at: order.expected_at ?? "",
    received_at: order.received_at ?? "",
    notes: order.notes ?? "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit() {
    if (!form.toner_type.trim()) return setError("Toner type is required.");
    const quantity = asPositiveInteger(form.quantity, "Quantity");
    if (typeof quantity === "string") return setError(quantity);

    setLoading(true);
    const res = await updatePrinterTonerOrder(order.id, order.printer_id, {
      ...form,
      quantity,
      received_at: form.status === "Received" && !form.received_at ? today() : form.received_at,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Update Toner Order" subtitle={order.toner_type} onClose={onClose}>
      <OrderForm
        kind="toner"
        form={form}
        contacts={contacts}
        set={set}
        error={error}
        loading={loading}
        onClose={onClose}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

export function AddPaperOrderModal({
  printerId,
  printerLabel,
  defaultPaperSize,
  contacts,
  onClose,
}: {
  printerId: string;
  printerLabel: string;
  defaultPaperSize?: string | null;
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    paper_size: defaultPaperSize || "A4",
    reams: "1",
    status: "Requested",
    supplier: "",
    order_number: "",
    requested_by_contact_id: "",
    requested_at: today(),
    expected_at: "",
    received_at: "",
    notes: "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit() {
    if (!form.paper_size.trim()) return setError("Paper size is required.");
    const reams = asPositiveInteger(form.reams, "Reams");
    if (typeof reams === "string") return setError(reams);

    setLoading(true);
    const res = await createPrinterPaperOrder({
      printer_id: printerId,
      ...form,
      reams,
      received_at: form.status === "Received" && !form.received_at ? today() : form.received_at,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Order Paper" subtitle={printerLabel} onClose={onClose}>
      <OrderForm
        kind="paper"
        form={form}
        contacts={contacts}
        set={set}
        error={error}
        loading={loading}
        onClose={onClose}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

export function EditPaperOrderModal({
  order,
  contacts,
  onClose,
}: {
  order: PrinterPaperOrder;
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    paper_size: order.paper_size,
    reams: order.reams.toString(),
    status: order.status,
    supplier: order.supplier ?? "",
    order_number: order.order_number ?? "",
    requested_by_contact_id: order.requested_by_contact_id ?? "",
    requested_at: order.requested_at ?? today(),
    expected_at: order.expected_at ?? "",
    received_at: order.received_at ?? "",
    notes: order.notes ?? "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit() {
    if (!form.paper_size.trim()) return setError("Paper size is required.");
    const reams = asPositiveInteger(form.reams, "Reams");
    if (typeof reams === "string") return setError(reams);

    setLoading(true);
    const res = await updatePrinterPaperOrder(order.id, order.printer_id, {
      ...form,
      reams,
      received_at: form.status === "Received" && !form.received_at ? today() : form.received_at,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Update Paper Order" subtitle={order.paper_size} onClose={onClose}>
      <OrderForm
        kind="paper"
        form={form}
        contacts={contacts}
        set={set}
        error={error}
        loading={loading}
        onClose={onClose}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

function OrderForm({
  kind,
  form,
  contacts,
  set,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  kind: "toner" | "paper";
  form: Record<string, string>;
  contacts: Contact[];
  set: (key: string, value: string) => void;
  error: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const itemLabel = kind === "toner" ? "Toner Type" : "Paper Size";
  const quantityLabel = kind === "toner" ? "Quantity" : "Reams";
  const itemKey = kind === "toner" ? "toner_type" : "paper_size";
  const quantityKey = kind === "toner" ? "quantity" : "reams";

  return (
    <FormStack>
      {error && <ErrorBanner message={error} />}

      <FormGrid>
        <FormField label={itemLabel} required>
          <Input value={form[itemKey]} onChange={(e) => set(itemKey, e.target.value)} error={!!error && !form[itemKey]} />
        </FormField>
        <FormField label={quantityLabel}>
          <Input type="number" min={1} value={form[quantityKey]} onChange={(e) => set(quantityKey, e.target.value)} />
        </FormField>
      </FormGrid>

      <FormGrid>
        <FormField label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </Select>
        </FormField>
        <FormField label="Requested By">
          <Select value={form.requested_by_contact_id} onChange={(e) => set("requested_by_contact_id", e.target.value)}>
            <option value="">No contact</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
          </Select>
        </FormField>
      </FormGrid>

      <FormGrid>
        <FormField label="Supplier">
          <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
        </FormField>
        <FormField label="Order Number">
          <Input value={form.order_number} onChange={(e) => set("order_number", e.target.value)} />
        </FormField>
      </FormGrid>

      <FormGrid>
        <FormField label="Requested Date">
          <Input type="date" value={form.requested_at} onChange={(e) => set("requested_at", e.target.value)} />
        </FormField>
        <FormField label="Expected Date">
          <Input type="date" value={form.expected_at} onChange={(e) => set("expected_at", e.target.value)} />
        </FormField>
      </FormGrid>

      <FormField label="Received Date">
        <Input type="date" value={form.received_at} onChange={(e) => set("received_at", e.target.value)} />
      </FormField>

      <FormField label="Notes">
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
      </FormField>

      <ModalFooter>
        <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
        <BtnPrimary onClick={onSubmit} loading={loading}>Save</BtnPrimary>
      </ModalFooter>
    </FormStack>
  );
}

export function AddPrinterTicketModal({
  printerId,
  printerLabel,
  contacts,
  onClose,
}: {
  printerId: string;
  printerLabel: string;
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Normal",
    status: "Open",
    logged_by_contact_id: "",
    supplier_ticket_ref: "",
    opened_at: today(),
    due_at: "",
    closed_at: "",
    resolution_notes: "",
    cost: "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit() {
    if (!form.title.trim()) return setError("Ticket title is required.");
    const cost = asOptionalMoney(form.cost);
    if (typeof cost === "string") return setError(cost);

    setLoading(true);
    const res = await createPrinterTicket({
      printer_id: printerId,
      ...form,
      cost,
      closed_at: ["Resolved", "Closed", "Cancelled"].includes(form.status) && !form.closed_at ? today() : form.closed_at,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Log Ticket" subtitle={printerLabel} onClose={onClose} width="max-w-xl">
      <TicketForm
        form={form}
        contacts={contacts}
        set={set}
        error={error}
        loading={loading}
        onClose={onClose}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

export function EditPrinterTicketModal({
  ticket,
  contacts,
  onClose,
}: {
  ticket: PrinterTicket;
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: ticket.title,
    description: ticket.description ?? "",
    priority: ticket.priority,
    status: ticket.status,
    logged_by_contact_id: ticket.logged_by_contact_id ?? "",
    supplier_ticket_ref: ticket.supplier_ticket_ref ?? "",
    opened_at: ticket.opened_at ?? today(),
    due_at: ticket.due_at ?? "",
    closed_at: ticket.closed_at ?? "",
    resolution_notes: ticket.resolution_notes ?? "",
    cost: ticket.cost?.toString() ?? "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit() {
    if (!form.title.trim()) return setError("Ticket title is required.");
    const cost = asOptionalMoney(form.cost);
    if (typeof cost === "string") return setError(cost);

    setLoading(true);
    const res = await updatePrinterTicket(ticket.id, ticket.printer_id, {
      ...form,
      cost,
      closed_at: ["Resolved", "Closed", "Cancelled"].includes(form.status) && !form.closed_at ? today() : form.closed_at,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Update Ticket" subtitle={ticket.title} onClose={onClose} width="max-w-xl">
      <TicketForm
        form={form}
        contacts={contacts}
        set={set}
        error={error}
        loading={loading}
        onClose={onClose}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

function TicketForm({
  form,
  contacts,
  set,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  form: Record<string, string>;
  contacts: Contact[];
  set: (key: string, value: string) => void;
  error: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormStack>
      {error && <ErrorBanner message={error} />}

      <FormField label="Title" required>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} error={!!error && !form.title} />
      </FormField>

      <FormField label="Description">
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
      </FormField>

      <FormGrid>
        <FormField label="Priority">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {TICKET_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {TICKET_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </Select>
        </FormField>
      </FormGrid>

      <FormGrid>
        <FormField label="Logged By">
          <Select value={form.logged_by_contact_id} onChange={(e) => set("logged_by_contact_id", e.target.value)}>
            <option value="">No contact</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
          </Select>
        </FormField>
        <FormField label="Supplier Ref">
          <Input value={form.supplier_ticket_ref} onChange={(e) => set("supplier_ticket_ref", e.target.value)} />
        </FormField>
      </FormGrid>

      <FormGrid>
        <FormField label="Opened Date">
          <Input type="date" value={form.opened_at} onChange={(e) => set("opened_at", e.target.value)} />
        </FormField>
        <FormField label="Due Date">
          <Input type="date" value={form.due_at} onChange={(e) => set("due_at", e.target.value)} />
        </FormField>
      </FormGrid>

      <FormGrid>
        <FormField label="Closed Date">
          <Input type="date" value={form.closed_at} onChange={(e) => set("closed_at", e.target.value)} />
        </FormField>
        <FormField label="Cost (R)">
          <Input type="number" min={0} step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
        </FormField>
      </FormGrid>

      <FormField label="Resolution Notes">
        <Textarea value={form.resolution_notes} onChange={(e) => set("resolution_notes", e.target.value)} rows={2} />
      </FormField>

      <ModalFooter>
        <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
        <BtnPrimary onClick={onSubmit} loading={loading}>Save</BtnPrimary>
      </ModalFooter>
    </FormStack>
  );
}

export function AddMeterReadingModal({
  printerId,
  printerLabel,
  contacts,
  onClose,
}: {
  printerId: string;
  printerLabel: string;
  contacts: Contact[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    reading: "",
    reading_at: today(),
    captured_by_contact_id: "",
    notes: "",
  });

  const set = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit() {
    const reading = asNonNegativeInteger(form.reading, "Reading");
    if (typeof reading === "string") return setError(reading);

    setLoading(true);
    const res = await createPrinterMeterReading({
      printer_id: printerId,
      ...form,
      reading,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Meter Reading" subtitle={printerLabel} onClose={onClose}>
      <FormStack>
        {error && <ErrorBanner message={error} />}

        <FormGrid>
          <FormField label="Reading" required>
            <Input type="number" min={0} value={form.reading} onChange={(e) => set("reading", e.target.value)} error={!!error && !form.reading} />
          </FormField>
          <FormField label="Reading Date">
            <Input type="date" value={form.reading_at} onChange={(e) => set("reading_at", e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Captured By">
          <Select value={form.captured_by_contact_id} onChange={(e) => set("captured_by_contact_id", e.target.value)}>
            <option value="">No contact</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}
          </Select>
        </FormField>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </FormField>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={handleSubmit} loading={loading}>Save Reading</BtnPrimary>
        </ModalFooter>
      </FormStack>
    </Modal>
  );
}
