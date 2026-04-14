import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDate, getStatusConfig, getCategoryIcon, getPerformanceConfig } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Calendar, Tag, MapPin, User, Building2,
  Cpu, FileText, Clock, Wrench, Package, Check, UserPlus, UserMinus,
} from "lucide-react";
import AssetDetailActions from "@/components/AssetDetailActions";
import type {
  AssetWithRelations, AssetAssignment, MaintenanceRecord, Contact, Location,
} from "@/types/database";

async function getAsset(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: asset } = await supabase
    .from("assets")
    .select(`
      *,
      category:categories(*),
      status:statuses(*),
      owning_department:departments(*),
      assigned_to_contact:contacts!assets_assigned_to_contact_id_fkey(*),
      location:locations(*),
      assigned_job_level:job_levels(*)
    `)
    .eq("id", id)
    .single();

  if (!asset) return null;

  const [
    { data: assignments },
    { data: maintenance },
    { data: statusHistory },
    { data: statuses },
    { data: categories },
    { data: departments },
    { data: locations },
    { data: jobLevels },
    { data: contacts },
  ] = await Promise.all([
    supabase
      .from("asset_assignments")
      .select("*, contact:contacts!asset_assignments_contact_id_fkey(*), location:locations(*)")
      .eq("asset_id", id)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("maintenance_records")
      .select("*")
      .eq("asset_id", id)
      .order("opened_at", { ascending: false }),
    supabase
      .from("asset_status_history")
      .select("*, new_status:statuses!asset_status_history_new_status_id_fkey(*), old_status:statuses!asset_status_history_old_status_id_fkey(*)")
      .eq("asset_id", id)
      .order("changed_at", { ascending: true }),
    supabase.from("statuses").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("locations").select("*").eq("is_active", true).order("name"),
    supabase.from("job_levels").select("*").order("name"),
    supabase.from("contacts").select("*").eq("is_active", true).order("full_name"),
  ]);

  const allStatuses = statuses ?? [];
  const inUseStatusId = allStatuses.find((s) => s.name === "In Use")?.id ?? "";
  const inStorageStatusId = allStatuses.find((s) => s.name === "In Storage")?.id ?? "";

  return {
    asset: asset as AssetWithRelations,
    assignments: (assignments ?? []) as (AssetAssignment & { contact: Contact; location: Location | null })[],
    maintenance: (maintenance ?? []) as MaintenanceRecord[],
    statusHistory: statusHistory ?? [],
    statuses: allStatuses,
    categories: categories ?? [],
    departments: departments ?? [],
    locations: locations ?? [],
    jobLevels: jobLevels ?? [],
    contacts: contacts ?? [],
    inUseStatusId,
    inStorageStatusId,
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
        <p className="text-[13.5px] text-stone-800">{value || "—"}</p>
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

type TimelineEvent = {
  id: string;
  date: string;
  label: string;
  sub?: string | null;
  dotColor: string;
  icon: React.ElementType;
  iconColor: string;
  priority: number; // tie-breaker: lower = earlier when timestamps are equal
};

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAsset(id);
  if (!result) notFound();

  const {
    asset, assignments, maintenance, statusHistory,
    statuses, categories, departments, locations, jobLevels, contacts,
    inUseStatusId, inStorageStatusId,
  } = result;
  const cfg = getStatusConfig(asset.status?.name);

  // Build unified timeline
  const timelineEvents: TimelineEvent[] = [];
  timelineEvents.push({
    id: "created",
    date: asset.created_at,
    label: "Asset registered",
    sub: asset.category?.name ?? null,
    dotColor: "bg-stone-400",
    icon: Package,
    iconColor: "text-stone-500",
    priority: 0,
  });
  for (const a of [...assignments].sort((x, y) => new Date(x.assigned_at).getTime() - new Date(y.assigned_at).getTime())) {
    timelineEvents.push({
      id: `assign-${a.id}`,
      date: a.assigned_at,
      label: `Assigned to ${a.contact?.full_name ?? "—"}`,
      sub: a.location?.name ?? a.notes ?? null,
      dotColor: "bg-sky-400",
      icon: UserPlus,
      iconColor: "text-sky-600",
      priority: 1,
    });
    if (a.returned_at) {
      timelineEvents.push({
        id: `return-${a.id}`,
        date: a.returned_at,
        label: `Returned from ${a.contact?.full_name ?? "—"}`,
        sub: null,
        dotColor: "bg-stone-300",
        icon: UserMinus,
        iconColor: "text-stone-500",
        priority: 2,
      });
    }
  }
  for (const h of (statusHistory as any[])) {
    const sCfg = getStatusConfig(h.new_status?.name);
    timelineEvents.push({
      id: `status-${h.id}`,
      date: h.changed_at,
      label: `Status → ${h.new_status?.name ?? "—"}`,
      sub: h.reason ?? null,
      dotColor: sCfg.dot,
      icon: Tag,
      iconColor: "text-stone-500",
      priority: 3,
    });
  }
  for (const m of [...maintenance].sort((x, y) => new Date(x.opened_at).getTime() - new Date(y.opened_at).getTime())) {
    timelineEvents.push({
      id: `maint-${m.id}`,
      date: m.opened_at,
      label: m.issue_description,
      sub: m.vendor_name ?? null,
      dotColor: "bg-amber-400",
      icon: Wrench,
      iconColor: "text-amber-600",
      priority: 4,
    });
    if (m.closed_at) {
      timelineEvents.push({
        id: `maint-close-${m.id}`,
        date: m.closed_at,
        label: `Resolved: ${m.issue_description}`,
        sub: m.resolution_notes ?? null,
        dotColor: "bg-emerald-400",
        icon: Check,
        iconColor: "text-emerald-600",
        priority: 5,
      });
    }
  }
  // Sort by date-only portion first (YYYY-MM-DD), then by priority.
  // assigned_at is stored as a date-only string which parses to midnight UTC,
  // causing it to sort before same-day timestamped events. Comparing only the
  // date portion avoids this and lets priority determine same-day order.
  timelineEvents.sort((a, b) => {
    const dateA = a.date.substring(0, 10);
    const dateB = b.date.substring(0, 10);
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return a.priority - b.priority;
  });

  const statusColors: Record<string, string> = {
    Open: "bg-amber-50 text-amber-700",
    Resolved: "bg-emerald-50 text-emerald-700",
    Closed: "bg-stone-100 text-stone-500",
    "In Progress": "bg-sky-50 text-sky-700",
    Cancelled: "bg-stone-100 text-stone-400",
    "Waiting Vendor": "bg-purple-50 text-purple-700",
  };

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link href="/assets" className="inline-flex items-center gap-1.5 text-[12px] mb-6 transition-colors hover:opacity-70" style={{ color: "#859474" }}>
        <ArrowLeft size={13} />
        Back to Assets
      </Link>

      {/* Header */}
      <div className="mb-6 fade-up">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "#eef3e6" }}>
            {getCategoryIcon(asset.category?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="text-[12px] font-mono font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                #{asset.asset_code}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium ${cfg.bg} ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {asset.status?.name}
              </span>
              <span className="text-[12px] text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-md">
                {asset.category?.name}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-stone-900 leading-tight" style={{ letterSpacing: "-0.025em" }}>
              {asset.description}
            </h1>
          </div>

          <AssetDetailActions
            asset={asset}
            statuses={statuses}
            categories={categories}
            departments={departments}
            locations={locations}
            jobLevels={jobLevels}
            contacts={contacts}
            inUseStatusId={inUseStatusId}
            inStorageStatusId={inStorageStatusId}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left column */}
        <div className="col-span-2 space-y-5">
          <Section title="Asset Details">
            <InfoRow icon={Tag} label="Serial Number" value={asset.serial_number} />
            <InfoRow icon={Calendar} label="Purchase Date" value={formatDate(asset.purchase_date)} />
            <InfoRow icon={FileText} label="Invoice Number" value={asset.invoice_number} />
            <InfoRow icon={Cpu} label="CPU Generation" value={asset.cpu_gen ? `Gen ${asset.cpu_gen}` : null} />
            <InfoRow icon={FileText} label="OS Type" value={asset.os_type} />
            <InfoRow icon={FileText} label="OS License" value={asset.os_license_type} />
            {asset.warranty_start_date && (
              <InfoRow icon={Calendar} label="Warranty" value={`${formatDate(asset.warranty_start_date)} → ${formatDate(asset.warranty_end_date)}`} />
            )}
            {asset.expected_end_of_life_date && (
              <InfoRow icon={Calendar} label="End of Life" value={formatDate(asset.expected_end_of_life_date)} />
            )}
            {asset.notes && <InfoRow icon={FileText} label="Notes" value={asset.notes} />}
          </Section>

          {/* Assignment history */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <Clock size={12} className="text-stone-400" />
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Assignment History · {assignments.length}
              </p>
            </div>
            <div className="divide-y divide-stone-50">
              {assignments.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-stone-400 text-center">No assignments recorded</p>
              ) : (
                assignments.map((a) => (
                  <div key={a.id} className="px-5 py-3.5 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={12} className="text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13.5px] font-medium text-stone-800">{a.contact?.full_name ?? "—"}</p>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${a.returned_at ? "bg-stone-100 text-stone-500" : "bg-emerald-50 text-emerald-700"}`}>
                          {a.returned_at ? "Returned" : "Active"}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-stone-400 mt-0.5">
                        {formatDate(a.assigned_at)}
                        {a.returned_at && ` → ${formatDate(a.returned_at)}`}
                        {a.location && ` · ${a.location.name}`}
                      </p>
                      {a.notes && <p className="text-[11.5px] text-stone-400 italic mt-0.5">{a.notes}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Maintenance */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <Wrench size={12} className="text-stone-400" />
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Maintenance · {maintenance.length}
              </p>
            </div>
            {maintenance.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-stone-400 text-center">No maintenance records</p>
            ) : (
              <div className="divide-y divide-stone-50">
                {maintenance.map((m) => (
                  <div key={m.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-stone-800">{m.issue_description}</p>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[m.status] ?? "bg-stone-100 text-stone-500"}`}>
                        {m.status}
                      </span>
                    </div>
                    {m.resolution_notes && <p className="text-[12px] text-stone-500 mt-1">{m.resolution_notes}</p>}
                    <p className="text-[11px] text-stone-400 mt-1">
                      {formatDate(m.opened_at)}
                      {m.vendor_name && ` · ${m.vendor_name}`}
                      {m.cost != null && ` · R${m.cost.toLocaleString()}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asset Timeline */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <Clock size={12} className="text-stone-400" />
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Timeline · {timelineEvents.length} events
              </p>
            </div>
            <div className="px-5 py-5">
              {timelineEvents.length === 0 ? (
                <p className="text-[13px] text-stone-400 text-center py-4">No history yet</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-stone-100" />
                  <div className="space-y-5">
                    {timelineEvents.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3.5 relative">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${ev.dotColor} relative z-10`} />
                        <div className="flex-1 min-w-0 -mt-0.5">
                          <div className="flex items-center gap-2">
                            <ev.icon size={11} className={ev.iconColor} />
                            <p className="text-[13px] text-stone-800 font-medium leading-snug">{ev.label}</p>
                          </div>
                          {ev.sub && <p className="text-[11.5px] text-stone-500 mt-0.5 ml-[19px]">{ev.sub}</p>}
                          <p className="text-[11px] text-stone-400 mt-0.5 ml-[19px]">{formatDate(ev.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Section title="Ownership">
            <InfoRow icon={Building2} label="Department" value={asset.owning_department?.name} />
            <InfoRow icon={User} label="Assigned To" value={
              asset.assigned_to_contact ? (
                <Link href={`/people?contact=${asset.assigned_to_contact.id}`}
                  className="text-stone-800 hover:text-stone-600 underline underline-offset-2">
                  {asset.assigned_to_contact.full_name}
                </Link>
              ) : "—"
            } />
            <InfoRow icon={User} label="Job Level" value={asset.assigned_job_level?.name} />
            <InfoRow icon={MapPin} label="Location" value={asset.location?.name} />
          </Section>

          {/* Performance Rating */}
          {asset.performance_rating && (() => {
            const pcfg = getPerformanceConfig(asset.performance_rating);
            if (!pcfg) return null;
            return (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Performance</p>
                </div>
                <div className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${pcfg.bg} ${pcfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pcfg.dot}`} />
                    {asset.performance_rating}
                  </span>
                  {asset.performance_notes && (
                    <p className="text-[12.5px] text-stone-500 mt-2.5">{asset.performance_notes}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {asset.legacy_previous_owner && (
            <div className="bg-stone-50 rounded-xl border border-stone-200 px-5 py-4">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">Legacy</p>
              <p className="text-[12.5px] text-stone-600">
                <span className="text-stone-400">Previous owner: </span>
                {asset.legacy_previous_owner}
              </p>
              {asset.legacy_previous_owners_text && (
                <p className="text-[11px] text-stone-400 mt-1">{asset.legacy_previous_owners_text}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
