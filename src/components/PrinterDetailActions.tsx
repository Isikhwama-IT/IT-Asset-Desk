"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Gauge,
  Package,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  AddMeterReadingModal,
  AddPaperOrderModal,
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
  PrinterWithRelations,
} from "@/types/database";

type Lookups = {
  departments: Department[];
  locations: Location[];
  contacts: Contact[];
};

export default function PrinterDetailActions({
  printer,
  lookups,
}: {
  printer: PrinterWithRelations;
  lookups: Lookups;
}) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [modal, setModal] = useState<"edit" | "toner" | "paper" | "ticket" | "meter" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!isAdmin) return null;

  const label = `#${printer.printer_code} - ${printer.name}`;

  async function handleDelete() {
    setDeleting(true);
    const res = await deletePrinter(printer.id);
    setDeleting(false);
    if (res?.error) return setDeleteError(res.error);
    router.push("/printers");
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <ActionButton icon={Package} label="Toner" onClick={() => setModal("toner")} />
        <ActionButton icon={FileText} label="Paper" onClick={() => setModal("paper")} />
        <ActionButton icon={Wrench} label="Ticket" onClick={() => setModal("ticket")} />
        <ActionButton icon={Gauge} label="Meter" onClick={() => setModal("meter")} />
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
          <div className="flex items-center gap-1.5">
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

      {modal === "edit" && (
        <EditPrinterModal
          printer={printer}
          lookups={lookups}
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
      {modal === "paper" && (
        <AddPaperOrderModal
          printerId={printer.id}
          printerLabel={label}
          defaultPaperSize={printer.paper_size}
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
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[12.5px] font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
    >
      <Icon size={13} /> {label}
    </button>
  );
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
