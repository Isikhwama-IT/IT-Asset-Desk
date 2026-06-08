"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  FileText,
  Gauge,
  Package,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  AddMeterReadingModal,
  AddPrinterTicketModal,
  AddTonerOrderModal,
  EditPaperOrderModal,
  EditPrinterModal,
  EditPrinterTicketModal,
  EditTonerOrderModal,
} from "@/components/PrinterModals";
import { useAuth } from "@/context/AuthContext";
import { deletePrinter } from "@/lib/actions";
import type {
  Contact,
  Department,
  Location,
  PrinterPaperOrder,
  PrinterTicket,
  PrinterTonerOrder,
  PrinterTray,
  PrinterWithRelations,
} from "@/types/database";

// Paper ordering moved to fleet page (company-level orders).
// PaperOrderAction is kept here so existing paper orders on the detail page can still be edited.

type Lookups = {
  departments: Department[];
  locations: Location[];
  contacts: Contact[];
};

type PollSummary = {
  polledAt: string;
  isOnline: boolean;
  printerStatus: string | null;
  errorDescription: string | null;
  totalPages: number | null;
  toner: {
    black: number | null;
    cyan: number | null;
    magenta: number | null;
    yellow: number | null;
  };
  fuserPct: number | null;
  wasteBoxPct: number | null;
  drumPct: number | null;
  consumables: Array<{
    description?: string | null;
    colour?: string | null;
    kind?: string | null;
    percent?: number | null;
    percent_label?: string | null;
  }>;
  paperTrays: Array<{
    name?: string | null;
    media_size?: string | null;
    level?: number | null;
    max?: number | null;
    percent?: number | null;
    percent_label?: string | null;
  }>;
};

export default function PrinterDetailActions({
  printer,
  lookups,
  trays = [],
}: {
  printer: PrinterWithRelations;
  lookups: Lookups;
  trays?: PrinterTray[];
}) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [modal, setModal] = useState<"edit" | "toner" | "ticket" | "meter" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState("");
  const [pollResult, setPollResult] = useState<PollSummary | null>(null);

  if (!isAdmin) return null;

  const label = `#${printer.printer_code} - ${printer.name}`;

  async function handleDelete() {
    setDeleting(true);
    const res = await deletePrinter(printer.id);
    setDeleting(false);
    if (res?.error) return setDeleteError(res.error);
    router.push("/printers");
  }

  async function handleSnmpPoll() {
    setPolling(true);
    setPollError("");
    setPollResult(null);

    try {
      const response = await fetch(`/api/printers/${printer.id}/poll`, {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok || body.error) {
        setPollError(body.error ?? "SNMP poll failed.");
        return;
      }

      setPollResult(body.poll as PollSummary);
      router.refresh();
    } catch (error) {
      setPollError(error instanceof Error ? error.message : "SNMP poll failed.");
    } finally {
      setPolling(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Package} label="Toner" onClick={() => setModal("toner")} />
          <ActionButton icon={Wrench} label="Ticket" onClick={() => setModal("ticket")} />
          <ActionButton icon={Gauge} label="Meter" onClick={() => setModal("meter")} />
          <ActionButton
            icon={Activity}
            label={polling ? "Polling..." : "Poll SNMP"}
            onClick={handleSnmpPoll}
            disabled={polling || !printer.ip_address}
          />
          <button
            onClick={() => setModal("edit")}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-white px-3 py-2 rounded-lg transition-colors btn-press"
            style={{ background: "#C04F28" }}
          >
            <Pencil size={13} /> Edit
          </button>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-red-600 font-medium">Delete this printer?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-3 py-2 text-[12.5px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                className="px-3 py-2 text-[12.5px] font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {deleteError && <span className="text-[12px] text-red-500">{deleteError}</span>}
        </div>

        {pollError && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {pollError}
          </div>
        )}
        {pollResult && <PollResultCard result={pollResult} />}
      </div>

      {modal === "edit" && (
        <EditPrinterModal
          printer={printer}
          lookups={lookups}
          initialTrays={trays}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "toner" && (
        <AddTonerOrderModal
          printerId={printer.id}
          printerLabel={label}
          defaultTonerType={printer.toner_model}
          contacts={lookups.contacts}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "ticket" && (
        <AddPrinterTicketModal
          printerId={printer.id}
          printerLabel={label}
          contacts={lookups.contacts}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "meter" && (
        <AddMeterReadingModal
          printerId={printer.id}
          printerLabel={label}
          contacts={lookups.contacts}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

export function TonerOrderAction({
  order,
  contacts,
}: {
  order: PrinterTonerOrder;
  contacts: Contact[];
}) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <RowEditButton onClick={() => setOpen(true)} />
      {open && <EditTonerOrderModal order={order} contacts={contacts} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PaperOrderAction({
  order,
  contacts,
}: {
  order: PrinterPaperOrder;
  contacts: Contact[];
}) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <RowEditButton onClick={() => setOpen(true)} />
      {open && <EditPaperOrderModal order={order} contacts={contacts} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PrinterTicketAction({
  ticket,
  contacts,
}: {
  ticket: PrinterTicket;
  contacts: Contact[];
}) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <RowEditButton onClick={() => setOpen(true)} label="Update" />
      {open && <EditPrinterTicketModal ticket={ticket} contacts={contacts} onClose={() => setOpen(false)} />}
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
    >
      <Icon size={13} /> {label}
    </button>
  );
}

function PollResultCard({ result }: { result: PollSummary }) {
  return (
    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-semibold">{result.isOnline ? "SNMP poll complete" : "SNMP poll saved"}</span>
        <span className="text-[11px] text-emerald-700">{formatDateTime(result.polledAt)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <PollField label="Online" value={result.isOnline ? "Yes" : "No"} />
        <PollField label="Status" value={result.printerStatus ?? "-"} />
        <PollField label="Meter" value={result.totalPages?.toLocaleString() ?? "-"} />
        <PollField label="Toner" value={formatToner(result.toner)} />
        <PollField label="Fuser" value={formatPct(result.fuserPct)} />
        <PollField label="Waste" value={formatPct(result.wasteBoxPct)} />
      </div>
      {result.errorDescription && (
        <p className="mt-2 text-[11.5px] text-amber-800">{result.errorDescription}</p>
      )}
    </div>
  );
}

function PollField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-emerald-700">{label}: </span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

function formatPct(value: number | null) {
  return typeof value === "number" ? `${value}%` : "-";
}

function formatToner(toner: PollSummary["toner"]) {
  const parts = [
    `K ${formatPct(toner.black)}`,
    `C ${formatPct(toner.cyan)}`,
    `M ${formatPct(toner.magenta)}`,
    `Y ${formatPct(toner.yellow)}`,
  ];
  return parts.join(" ");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RowEditButton({
  onClick,
  label = "Edit",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[11.5px] font-medium text-stone-500 border border-stone-200 px-2 py-1 rounded-lg hover:bg-stone-50 transition-colors"
    >
      {label}
    </button>
  );
}
