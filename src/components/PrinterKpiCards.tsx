import { AlertTriangle, CheckCircle2, FileText, Layers, Printer, TicketCheck, TrendingDown } from "lucide-react";
import { REAMS_PER_BOX_A4 } from "@/lib/printer-capabilities";

export type SiteKpi = {
  locationId: string;
  locationName: string;
  total: number;
  online: number;
  pagesThisMonth: number;
  totalA4Boxes: number;
  totalA4LooseReams: number;
  totalA4Sheets: number;
  totalA3Reams: number;
  avgDailyPages: number | null;
  estDaysLeft: number | null;
};

export type PrinterKpi = {
  total: number;
  online: number;
  needsAttention: number;
  reorderCount: number;
  openTickets: number;
  openTicketPrinters: string[];
  pagesThisMonth: number;
  fleetMonthlyCost: number | null;
  totalA4Boxes: number;
  totalA4LooseReams: number;
  totalA4Sheets: number;
  totalA3Reams: number;
  avgDailyPages: number | null;
  estDaysLeft: number | null;
  siteKpis: SiteKpi[];
};

function KpiCard({
  label,
  value,
  sub,
  accent,
  iconBg,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  iconBg: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 fade-up card-lift">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Icon size={13} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular-nums leading-none mb-1" style={{ color: accent, letterSpacing: "-0.03em" }}>{value}</p>
      <p className="text-[11px] text-stone-400">{sub}</p>
    </div>
  );
}

function SitePaperCard({ site }: { site: SiteKpi }) {
  const hasStock = site.totalA4Sheets > 0 || site.totalA3Reams > 0;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 fade-up card-lift">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>Paper on Hand</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#eef3e6" }}>
          <Layers size={13} style={{ color: "#415445" }} />
        </div>
      </div>

      {!hasStock ? (
        <>
          <p className="text-2xl font-semibold tabular-nums leading-none mb-1" style={{ color: "#a8a29e", letterSpacing: "-0.03em" }}>—</p>
          <p className="text-[11px] text-stone-400">No stock recorded yet</p>
        </>
      ) : (
        <>
          <div className="mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular-nums" style={{ color: "#415445", letterSpacing: "-0.03em" }}>
                {site.totalA4Boxes}
              </span>
              <span className="text-[12px] text-stone-500">box{site.totalA4Boxes !== 1 ? "es" : ""}</span>
              {site.totalA4LooseReams > 0 && (
                <>
                  <span className="text-stone-300">+</span>
                  <span className="text-xl font-semibold tabular-nums" style={{ color: "#415445", letterSpacing: "-0.03em" }}>
                    {site.totalA4LooseReams}
                  </span>
                  <span className="text-[12px] text-stone-500">ream{site.totalA4LooseReams !== 1 ? "s" : ""}</span>
                </>
              )}
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full ml-1" style={{ background: "#eef3e6", color: "#415445" }}>A4</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {site.totalA4Sheets.toLocaleString()} sheets · {site.totalA4Boxes * REAMS_PER_BOX_A4 + site.totalA4LooseReams} reams total
            </p>
          </div>
          {site.totalA3Reams > 0 && (
            <div className="pt-2 border-t border-stone-50">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums" style={{ color: "#415445", letterSpacing: "-0.03em" }}>
                  {site.totalA3Reams}
                </span>
                <span className="text-[12px] text-stone-500">ream{site.totalA3Reams !== 1 ? "s" : ""}</span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full ml-1" style={{ background: "#eef3e6", color: "#415445" }}>A3</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SiteSection({ site }: { site: SiteKpi }) {
  const allOnline = site.online === site.total;
  const daysAccent =
    site.estDaysLeft === null ? "#a8a29e"
    : site.estDaysLeft <= 7 ? "#dc2626"
    : site.estDaysLeft <= 14 ? "#d97706"
    : "#059669";
  const daysBg =
    site.estDaysLeft !== null && site.estDaysLeft <= 7 ? "#fee2e2"
    : site.estDaysLeft !== null && site.estDaysLeft <= 14 ? "#fef3c7"
    : "#eef3e6";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-0.5 h-3 rounded-full" style={{ background: "#C04F28" }} />
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#859474" }}>
          {site.locationName}
        </p>
        <div className="flex-1 h-px bg-stone-100" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Printers Online"
          value={`${site.online} / ${site.total}`}
          sub="at this site"
          accent={allOnline ? "#059669" : "#dc2626"}
          iconBg={allOnline ? "#d1fae5" : "#fee2e2"}
          icon={Printer}
        />
        <KpiCard
          label="Pages This Month"
          value={site.pagesThisMonth.toLocaleString()}
          sub="pages printed at this site"
          accent="#C04F28"
          iconBg="#f0d4c8"
          icon={FileText}
        />
        <SitePaperCard site={site} />
        <KpiCard
          label="Avg Daily Print"
          value={site.avgDailyPages !== null ? site.avgDailyPages.toLocaleString() : "—"}
          sub={site.avgDailyPages !== null ? "pages/day (this month)" : "No meter data this month"}
          accent={site.avgDailyPages !== null ? "#415445" : "#a8a29e"}
          iconBg={site.avgDailyPages !== null ? "#eef3e6" : "#f5f5f4"}
          icon={TrendingDown}
        />
        <KpiCard
          label="Est. Days of Paper"
          value={site.estDaysLeft !== null ? `~${site.estDaysLeft}` : "—"}
          sub={
            site.estDaysLeft !== null
              ? `based on ${site.avgDailyPages?.toLocaleString()} pages/day avg`
              : site.avgDailyPages === null
              ? "Need meter data to estimate"
              : site.totalA4Sheets === 0
              ? "No A4 stock recorded"
              : "—"
          }
          accent={daysAccent}
          iconBg={daysBg}
          icon={TrendingDown}
        />
      </div>
    </div>
  );
}

export default function PrinterKpiCards({ kpi }: { kpi: PrinterKpi }) {
  const fleetCards = [
    {
      label: "Needs Attention",
      value: kpi.needsAttention,
      sub: "printers with alerts",
      accent: kpi.needsAttention > 0 ? "#dc2626" : "#059669",
      iconBg: kpi.needsAttention > 0 ? "#fee2e2" : "#d1fae5",
      icon: AlertTriangle,
    },
    {
      label: "Reorder Required",
      value: kpi.reorderCount,
      sub: "consumables",
      accent: kpi.reorderCount > 0 ? "#dc2626" : "#059669",
      iconBg: kpi.reorderCount > 0 ? "#fee2e2" : "#d1fae5",
      icon: CheckCircle2,
    },
    {
      label: "Open Tickets",
      value: kpi.openTickets,
      sub: kpi.openTickets > 0 && kpi.openTicketPrinters.length > 0
        ? kpi.openTicketPrinters.join(", ")
        : "active tickets",
      accent: kpi.openTickets > 0 ? "#d97706" : "#059669",
      iconBg: kpi.openTickets > 0 ? "#fef3c7" : "#d1fae5",
      icon: TicketCheck,
    },
    {
      label: "Pages This Month",
      value: kpi.pagesThisMonth.toLocaleString(),
      sub: kpi.fleetMonthlyCost !== null
        ? `Est. R ${kpi.fleetMonthlyCost.toLocaleString()} this month`
        : "Add consumable prices to see cost",
      accent: "#C04F28",
      iconBg: "#f0d4c8",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6 mb-6">
      {/* Fleet-wide: alerts & activity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {fleetCards.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* Per-site: online status, paper, daily print, days remaining */}
      {kpi.siteKpis.length > 0 && (
        <div className="space-y-5">
          {kpi.siteKpis.map((site) => (
            <SiteSection key={site.locationId} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}
