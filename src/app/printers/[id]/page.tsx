import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Gauge,
  Hash,
  MapPin,
  Network,
  Package,
  Printer,
  Tag,
  User,
  Wrench,
} from "lucide-react";
import PrinterDetailActions, {
  PaperOrderAction,
  PrinterTicketAction,
  TonerOrderAction,
} from "@/components/PrinterDetailActions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDate } from "@/lib/utils";
import {
  getConsumableStatusConfig,
  getOrderStatusConfig,
  getPrinterStatusConfig,
  getPriorityConfig,
  getTicketStatusConfig,
} from "@/lib/printers";
import type {
  Contact,
  Location,
  PrinterMeterReadingWithRelations,
  PrinterPaperOrderWithRelations,
  PrinterTicketWithRelations,
  PrinterTonerOrderWithRelations,
  PrinterWithRelations,
} from "@/types/database";

async function getPrinter(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: printer } = await supabase
    .from("printers")
    .select(`
      *,
      department:departments(*),
      location:locations(*),
      primary_contact:contacts!printers_primary_contact_id_fkey(*)
    `)
    .eq("id", id)
    .single();

  if (!printer) return null;

  const [
    { data: tonerOrders },
    { data: paperOrders },
    { data: tickets },
    { data: meterReadings },
    { data: departments },
    { data: locations },
    { data: contacts },
  ] = await Promise.all([
    supabase
      .from("printer_toner_orders")
      .select("*, requested_by_contact:contacts!printer_toner_orders_requested_by_contact_id_fkey(*)")
      .eq("printer_id", id)
      .order("requested_at", { ascending: false }),
    supabase
      .from("printer_paper_orders")
      .select("*, requested_by_contact:contacts!printer_paper_orders_requested_by_contact_id_fkey(*)")
      .eq("printer_id", id)
      .order("requested_at", { ascending: false }),
    supabase
      .from("printer_tickets")
      .select("*, logged_by_contact:contacts!printer_tickets_logged_by_contact_id_fkey(*)")
      .eq("printer_id", id)
      .order("opened_at", { ascending: false }),
    supabase
      .from("printer_meter_readings")
      .select("*, captured_by_contact:contacts!printer_meter_readings_captured_by_contact_id_fkey(*)")
      .eq("printer_id", id)
      .order("reading_at", { ascending: false }),
    supabase.from("departments").select("*").order("name"),
    supabase.from("locations").select("*").eq("is_active", true).order("name"),
    supabase.from("contacts").select("*").eq("is_active", true).order("full_name"),
  ]);

  return {
    printer: printer as PrinterWithRelations,
    tonerOrders: (tonerOrders ?? []) as PrinterTonerOrderWithRelations[],
    paperOrders: (paperOrders ?? []) as PrinterPaperOrderWithRelations[],
    tickets: (tickets ?? []) as PrinterTicketWithRelations[],
    meterReadings: (meterReadings ?? []) as PrinterMeterReadingWithRelations[],
    departments: departments ?? [],
    locations: locations ?? [],
    contacts: (contacts ?? []) as Contact[],
  };
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-stone-50 last:border-0">
      <div className="w-6 mt-0.5 flex-shrink-0">
        <Icon size={13} className="text-stone-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-[13.5px] text-stone-800 break-words">{value || "-"}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2" style={{ background: "#fafaf9" }}>
        <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>{title}</p>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

function Badge({ label, cfg }: { label: string | null | undefined; cfg: { color: string; dot: string; bg: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label ?? "-"}
    </span>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="px-5 py-6 text-[13px] text-stone-400 text-center">{label}</p>;
}

export default async function PrinterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPrinter(id);
  if (!result) notFound();

  const {
    printer,
    tonerOrders,
    paperOrders,
    tickets,
    meterReadings,
    departments,
    locations,
    contacts,
  } = result;

  const printerStatus = getPrinterStatusConfig(printer.status);
  const tonerStatus = getConsumableStatusConfig(printer.toner_status);
  const paperStatus = getConsumableStatusConfig(printer.paper_status);
  const openTickets = tickets.filter((ticket) => ["Open", "In Progress", "Waiting Supplier"].includes(ticket.status));
  const latestMeter = meterReadings[0];

  return (
    <div className="p-8 max-w-6xl">
      <Link href="/printers" className="inline-flex items-center gap-1.5 text-[12px] mb-6 transition-colors hover:opacity-70" style={{ color: "#859474" }}>
        <ArrowLeft size={13} />
        Back to Printers
      </Link>

      <div className="mb-6 fade-up">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#eef3e6" }}>
            <Printer size={24} style={{ color: "#415445" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="text-[12px] font-mono font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                #{printer.printer_code}
              </span>
              <Badge label={printer.status} cfg={printerStatus} />
              {printer.location?.name && (
                <span className="text-[12px] text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                  {printer.location.name}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-stone-900 leading-tight" style={{ letterSpacing: "-0.025em" }}>
              {printer.name}
            </h1>
            <p className="text-[12.5px] text-stone-500 mt-1">
              {[printer.manufacturer, printer.model].filter(Boolean).join(" ") || "Model not captured"}
            </p>
          </div>

          <PrinterDetailActions
            printer={printer}
            lookups={{ departments, locations: locations as Location[], contacts }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Open Tickets</p>
              <p className="text-xl font-semibold text-stone-900 mt-2 tabular-nums">{openTickets.length}</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Toner</p>
              <div className="mt-2"><Badge label={printer.toner_status} cfg={tonerStatus} /></div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Paper</p>
              <div className="mt-2"><Badge label={printer.paper_status} cfg={paperStatus} /></div>
            </div>
          </div>

          <Section title="Printer Details">
            <InfoRow icon={Tag} label="Serial Number" value={printer.serial_number} />
            <InfoRow icon={Network} label="IP Address" value={printer.ip_address} />
            <InfoRow icon={Hash} label="MAC Address" value={printer.mac_address} />
            <InfoRow icon={Package} label="Supplier" value={printer.supplier} />
            <InfoRow icon={Printer} label="Manufacturer / Model" value={[printer.manufacturer, printer.model].filter(Boolean).join(" ")} />
            <InfoRow icon={Calendar} label="Warranty End" value={formatDate(printer.warranty_end_date)} />
            {printer.notes && <InfoRow icon={FileText} label="Notes" value={printer.notes} />}
          </Section>

          <Section title="Consumables">
            <InfoRow icon={Package} label="Toner Model" value={printer.toner_model} />
            <InfoRow icon={FileText} label="Paper Size" value={printer.paper_size} />
            <InfoRow
              icon={Gauge}
              label="Latest Meter"
              value={
                latestMeter
                  ? `${latestMeter.reading.toLocaleString()} on ${formatDate(latestMeter.reading_at)}`
                  : printer.last_meter_reading
                    ? `${printer.last_meter_reading.toLocaleString()} on ${formatDate(printer.last_meter_reading_at)}`
                    : null
              }
            />
          </Section>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <Wrench size={12} className="text-stone-400" />
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Tickets - {tickets.length}</p>
            </div>
            {tickets.length === 0 ? (
              <EmptyRow label="No tickets logged" />
            ) : (
              <div className="divide-y divide-stone-50">
                {tickets.map((ticket) => {
                  const statusCfg = getTicketStatusConfig(ticket.status);
                  const priorityCfg = getPriorityConfig(ticket.priority);
                  return (
                    <div key={ticket.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-stone-800">{ticket.title}</p>
                          {ticket.description && <p className="text-[12px] text-stone-500 mt-1">{ticket.description}</p>}
                          <p className="text-[11px] text-stone-400 mt-1">
                            {formatDate(ticket.opened_at)}
                            {ticket.logged_by_contact && ` - ${ticket.logged_by_contact.full_name}`}
                            {ticket.supplier_ticket_ref && ` - ${ticket.supplier_ticket_ref}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge label={ticket.priority} cfg={priorityCfg} />
                          <Badge label={ticket.status} cfg={statusCfg} />
                          <PrinterTicketAction ticket={ticket} contacts={contacts} />
                        </div>
                      </div>
                      {ticket.resolution_notes && <p className="text-[12px] text-emerald-700 mt-2">{ticket.resolution_notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <OrderSection title="Toner Orders" count={tonerOrders.length}>
              {tonerOrders.length === 0 ? (
                <EmptyRow label="No toner orders" />
              ) : (
                tonerOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    title={order.toner_type}
                    quantity={`${order.quantity} item${order.quantity === 1 ? "" : "s"}`}
                    status={order.status}
                    requestedAt={order.requested_at}
                    expectedAt={order.expected_at}
                    receivedAt={order.received_at}
                    supplier={order.supplier}
                    requestedBy={order.requested_by_contact?.full_name}
                    action={<TonerOrderAction order={order} contacts={contacts} />}
                  />
                ))
              )}
            </OrderSection>

            <OrderSection title="Paper Orders" count={paperOrders.length}>
              {paperOrders.length === 0 ? (
                <EmptyRow label="No paper orders" />
              ) : (
                paperOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    title={order.paper_size}
                    quantity={`${order.reams} ream${order.reams === 1 ? "" : "s"}`}
                    status={order.status}
                    requestedAt={order.requested_at}
                    expectedAt={order.expected_at}
                    receivedAt={order.received_at}
                    supplier={order.supplier}
                    requestedBy={order.requested_by_contact?.full_name}
                    action={<PaperOrderAction order={order} contacts={contacts} />}
                  />
                ))
              )}
            </OrderSection>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <Gauge size={12} className="text-stone-400" />
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Meter Readings - {meterReadings.length}</p>
            </div>
            {meterReadings.length === 0 ? (
              <EmptyRow label="No meter readings" />
            ) : (
              <div className="divide-y divide-stone-50">
                {meterReadings.slice(0, 8).map((reading) => (
                  <div key={reading.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-[13px] font-mono font-medium text-stone-700 tabular-nums">{reading.reading.toLocaleString()}</span>
                    <span className="text-[12px] text-stone-400">{formatDate(reading.reading_at)}</span>
                    <span className="text-[12px] text-stone-500 truncate">{reading.captured_by_contact?.full_name ?? ""}</span>
                    {reading.notes && <span className="ml-auto text-[11px] text-stone-400 truncate">{reading.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <Section title="Ownership">
            <InfoRow icon={Building2} label="Department" value={printer.department?.name} />
            <InfoRow icon={MapPin} label="Site" value={printer.location?.name} />
            <InfoRow icon={User} label="Primary Contact" value={printer.primary_contact?.full_name} />
          </Section>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Consumable Status</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-stone-500">Toner</span>
                <Badge label={printer.toner_status} cfg={tonerStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-stone-500">Paper</span>
                <Badge label={printer.paper_status} cfg={paperStatus} />
              </div>
            </div>
          </div>

          {openTickets.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 px-5 py-4">
              <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wider mb-2">Attention</p>
              <p className="text-[12.5px] text-amber-800">
                {openTickets.length} open printer ticket{openTickets.length === 1 ? "" : "s"} need follow-up.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
        <Package size={12} className="text-stone-400" />
        <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">{title} - {count}</p>
      </div>
      <div className="divide-y divide-stone-50">{children}</div>
    </div>
  );
}

function OrderRow({
  title,
  quantity,
  status,
  requestedAt,
  expectedAt,
  receivedAt,
  supplier,
  requestedBy,
  action,
}: {
  title: string;
  quantity: string;
  status: string;
  requestedAt: string;
  expectedAt: string | null;
  receivedAt: string | null;
  supplier: string | null;
  requestedBy?: string | null;
  action: React.ReactNode;
}) {
  const statusCfg = getOrderStatusConfig(status);
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-stone-800 truncate">{title}</p>
          <p className="text-[11px] text-stone-400 mt-1">
            {quantity} - requested {formatDate(requestedAt)}
          </p>
          <p className="text-[11px] text-stone-400">
            {supplier || "No supplier"}
            {requestedBy && ` - ${requestedBy}`}
          </p>
          {(expectedAt || receivedAt) && (
            <p className="text-[11px] text-stone-400">
              {expectedAt && `Expected ${formatDate(expectedAt)}`}
              {expectedAt && receivedAt && " - "}
              {receivedAt && `Received ${formatDate(receivedAt)}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge label={status} cfg={statusCfg} />
          {action}
        </div>
      </div>
    </div>
  );
}
