"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
  syncPrinterTrays,
  createPrinterTonerOrder,
  updatePrinterTonerOrder,
  createPrinterPaperOrder,
  updatePrinterPaperOrder,
  createPrinterTicket,
  updatePrinterTicket,
  createPrinterMeterReading,
  type TrayInput,
} from "@/lib/actions";
import {
  CONSUMABLE_STATUSES,
  ORDER_STATUSES,
  PRINTER_STATUSES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/lib/printers";
import { PAPER_SIZES } from "@/lib/printer-capabilities";
import type {
  Contact,
  Department,
  Location,
  PrinterPaperOrder,
  PrinterTray,
  PrinterTicket,
  PrinterTonerOrder,
  PrinterWithRelations,
} from "@/types/database";

type LookupProps = {
  departments: Department[];
  locations: Location[];
  contacts: Contact[];
};

// ── Capability helpers ────────────────────────────────────────────────────────

type CapForm = {
  is_colour: boolean;
  supports_a3: boolean;
  toner_config: "separate" | "all-in-one";
  has_developer_units: boolean;
  has_waste_box: boolean;
  has_fuser_tracking: boolean;
  has_drum_tracking: boolean;
  is_duplex: boolean;
  is_scan_capable: boolean;
  is_fax_capable: boolean;
};

const defaultCap = (): CapForm => ({
  is_colour: false, supports_a3: false, toner_config: "separate",
  has_developer_units: false, has_waste_box: false,
  has_fuser_tracking: false, has_drum_tracking: false,
  is_duplex: false, is_scan_capable: false, is_fax_capable: false,
});

type TrayFormItem = {
  key: string;
  id?: string;
  tray_name: string;
  paper_size: string;
  capacity_reams: string;
  sort_order: number;
};

function Toggle({
  label, checked, onChange, description,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <div
        className="relative w-9 h-5 rounded-full flex-shrink-0 mt-0.5 transition-colors"
        style={{ background: checked ? "#415445" : "#e7e5e4" }}
        onClick={() => onChange(!checked)}
      >
        <span
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(2px)" }}
        />
      </div>
      <div>
        <p className="text-[12.5px] text-stone-700 leading-snug">{label}</p>
        {description && <p className="text-[11px] text-stone-400">{description}</p>}
      </div>
    </label>
  );
}

function TrayList({
  trays, onChange,
}: {
  trays: TrayFormItem[];
  onChange: (trays: TrayFormItem[]) => void;
}) {
  function add() {
    onChange([
      ...trays,
      {
        key: crypto.randomUUID(),
        tray_name: `Tray ${trays.length + 1}`,
        paper_size: "A4",
        capacity_reams: "",
        sort_order: trays.length + 1,
      },
    ]);
  }

  function remove(key: string) {
    onChange(trays.filter((t) => t.key !== key));
  }

  function update(key: string, field: keyof TrayFormItem, value: string | number) {
    onChange(trays.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  }

  const inp = "text-[12px] border border-stone-200 rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-stone-300";
  const sel = inp + " appearance-none bg-white";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Trays</p>
        <button type="button" onClick={add} className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-700 border border-stone-200 px-2 py-1 rounded-lg hover:bg-stone-50 transition-colors">
          <Plus size={11} /> Add tray
        </button>
      </div>

      {trays.length === 0 && (
        <p className="text-[11.5px] text-stone-400 py-2 text-center border border-dashed border-stone-200 rounded-lg">No trays — add at least one</p>
      )}

      <div className="space-y-2">
        {trays.map((tray, i) => (
          <div key={tray.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <div>
              {i === 0 && <p className="text-[10px] text-stone-400 mb-1">Name</p>}
              <input className={inp} value={tray.tray_name} onChange={(e) => update(tray.key, "tray_name", e.target.value)} placeholder="e.g. Tray 1" />
            </div>
            <div className="w-24">
              {i === 0 && <p className="text-[10px] text-stone-400 mb-1">Size</p>}
              <select className={sel} value={tray.paper_size} onChange={(e) => update(tray.key, "paper_size", e.target.value)}>
                {PAPER_SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="w-20">
              {i === 0 && <p className="text-[10px] text-stone-400 mb-1">Reams cap.</p>}
              <input className={inp} type="number" min={0} value={tray.capacity_reams} onChange={(e) => update(tray.key, "capacity_reams", e.target.value)} placeholder="—" />
            </div>
            <div className="pb-0.5">
              {i === 0 && <div className="mb-1 h-4" />}
              <button type="button" onClick={() => remove(tray.key)} className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapabilitiesSection({
  cap, setCap, trays, setTrays,
}: {
  cap: CapForm;
  setCap: (c: CapForm) => void;
  trays: TrayFormItem[];
  setTrays: (t: TrayFormItem[]) => void;
}) {
  const toggle = (k: keyof CapForm, v: boolean) => setCap({ ...cap, [k]: v });

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Capabilities</p>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Toggle label="Colour printing" checked={cap.is_colour} onChange={(v) => toggle("is_colour", v)} />
          <Toggle label="Supports A3" checked={cap.supports_a3} onChange={(v) => toggle("supports_a3", v)} />
          <Toggle label="Duplex (double-sided)" checked={cap.is_duplex} onChange={(v) => toggle("is_duplex", v)} />
          <Toggle label="Scan capable" checked={cap.is_scan_capable} onChange={(v) => toggle("is_scan_capable", v)} />
          <Toggle label="Fax capable" checked={cap.is_fax_capable} onChange={(v) => toggle("is_fax_capable", v)} />
        </div>

        {cap.is_colour && (
          <div>
            <p className="text-[10.5px] text-stone-400 mb-1.5 uppercase tracking-wider">Toner configuration</p>
            <div className="flex gap-3">
              {(["separate", "all-in-one"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={cap.toner_config === opt}
                    onChange={() => setCap({ ...cap, toner_config: opt })}
                    className="accent-stone-700"
                  />
                  <span className="text-[12.5px] text-stone-700">
                    {opt === "separate" ? "Separate B/C/M/Y" : "All-in-one cartridge"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-stone-100 pt-3">
          <p className="text-[10.5px] text-stone-400 mb-2 uppercase tracking-wider">Consumable tracking</p>
          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Developer units" checked={cap.has_developer_units} onChange={(v) => toggle("has_developer_units", v)} />
            <Toggle label="Waste toner box" checked={cap.has_waste_box} onChange={(v) => toggle("has_waste_box", v)} />
            <Toggle label="Fuser unit tracking" checked={cap.has_fuser_tracking} onChange={(v) => toggle("has_fuser_tracking", v)} />
            <Toggle label="Drum unit tracking" checked={cap.has_drum_tracking} onChange={(v) => toggle("has_drum_tracking", v)} />
          </div>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <TrayList trays={trays} onChange={setTrays} />
        </div>
      </div>
    </div>
  );
}

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
  const [cap, setCap] = useState<CapForm>(defaultCap());
  const [snmpEnabled, setSnmpEnabled] = useState(true);
  const [trays, setTrays] = useState<TrayFormItem[]>([
    { key: "default-1", tray_name: "Tray 1", paper_size: "A4", capacity_reams: "", sort_order: 1 },
  ]);
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
    if (trays.length === 0) return setError("At least one tray is required.");
    const meterReading = form.last_meter_reading
      ? asNonNegativeInteger(form.last_meter_reading, "Meter reading")
      : null;
    if (typeof meterReading === "string") return setError(meterReading);

    setLoading(true);
    const res = await createPrinter({
      ...form,
      ...cap,
      snmp_enabled: snmpEnabled,
      last_meter_reading: meterReading,
      last_meter_reading_at: form.last_meter_reading_at || undefined,
    });
    if (res?.error) {
      setLoading(false);
      setConfirming(false);
      return setError(res.error);
    }
    // Sync trays after printer created
    if (res?.id) {
      const trayRes = await syncPrinterTrays(
        res.id,
        trays.map((t, i) => ({
          tray_name: t.tray_name,
          paper_size: t.paper_size,
          capacity_reams: t.capacity_reams ? Number(t.capacity_reams) : null,
          sort_order: i + 1,
        }))
      );
      if (trayRes?.error) {
        setLoading(false);
        return setError(trayRes.error);
      }
    }
    setLoading(false);
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Add Printer" subtitle="Register printer details, consumables, supplier and network info" onClose={onClose} width="max-w-3xl">
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

        <CapabilitiesSection cap={cap} setCap={setCap} trays={trays} setTrays={setTrays} />

        <div className="border border-stone-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
            <p className="text-[10.5px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Monitoring</p>
          </div>
          <Toggle
            label="Enable automated monitoring (SNMP)"
            description="When enabled this printer is included in the hourly poll."
            checked={snmpEnabled}
            onChange={setSnmpEnabled}
          />
        </div>

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
  initialTrays = [],
  onClose,
}: {
  printer: PrinterWithRelations;
  lookups: LookupProps;
  initialTrays?: PrinterTray[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [cap, setCap] = useState<CapForm>({
    is_colour: printer.is_colour ?? false,
    supports_a3: printer.supports_a3 ?? false,
    toner_config: (printer.toner_config as "separate" | "all-in-one") ?? "separate",
    has_developer_units: printer.has_developer_units ?? false,
    has_waste_box: printer.has_waste_box ?? false,
    has_fuser_tracking: printer.has_fuser_tracking ?? false,
    has_drum_tracking: printer.has_drum_tracking ?? false,
    is_duplex: printer.is_duplex ?? false,
    is_scan_capable: printer.is_scan_capable ?? false,
    is_fax_capable: printer.is_fax_capable ?? false,
  });
  const [snmpEnabled, setSnmpEnabled] = useState(printer.snmp_enabled ?? true);
  const [trays, setTrays] = useState<TrayFormItem[]>(
    initialTrays.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order).map((t) => ({
      key: t.id,
      id: t.id,
      tray_name: t.tray_name,
      paper_size: t.paper_size,
      capacity_reams: t.capacity_reams?.toString() ?? "",
      sort_order: t.sort_order,
    }))
  );
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
    if (trays.length === 0) return setError("At least one tray is required.");
    const meterReading = form.last_meter_reading
      ? asNonNegativeInteger(form.last_meter_reading, "Meter reading")
      : null;
    if (typeof meterReading === "string") return setError(meterReading);

    setLoading(true);
    const res = await updatePrinter(printer.id, {
      ...form,
      ...cap,
      snmp_enabled: snmpEnabled,
      last_meter_reading: meterReading,
      last_meter_reading_at: form.last_meter_reading_at || undefined,
    });
    if (!res?.error) {
      const trayRes = await syncPrinterTrays(
        printer.id,
        trays.map((t, i) => ({
          id: t.id,
          tray_name: t.tray_name,
          paper_size: t.paper_size,
          capacity_reams: t.capacity_reams ? Number(t.capacity_reams) : null,
          sort_order: i + 1,
        }))
      );
      if (trayRes?.error) {
        setLoading(false);
        return setError(trayRes.error);
      }
    }
    setLoading(false);
    if (res?.error) {
      setConfirming(false);
      return setError(res.error);
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Edit Printer" subtitle={`#${printer.printer_code} - ${printer.name}`} onClose={onClose} width="max-w-3xl">
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

        <CapabilitiesSection cap={cap} setCap={setCap} trays={trays} setTrays={setTrays} />

        <div className="border border-stone-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
            <p className="text-[10.5px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Monitoring</p>
          </div>
          <Toggle
            label="Enable automated monitoring (SNMP)"
            description="When enabled this printer is included in the hourly poll."
            checked={snmpEnabled}
            onChange={setSnmpEnabled}
          />
        </div>

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
