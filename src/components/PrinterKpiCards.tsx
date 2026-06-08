import { AlertTriangle, CheckCircle2, FileText, Layers, Printer, TicketCheck, TrendingDown } from "lucide-react";
import { REAMS_PER_BOX_A4 } from "@/lib/printer-capabilities";

export type PrinterKpi = {
  total: number;
  online: number;
  needsAttention: number;
  reorderCount: number;
  openTickets: number;
  pagesThisMonth: number;
  fleetMonthlyCost: number | null;
  // Paper stock totals across all sites
  totalA4Boxes: number;
  totalA4LooseReams: number;
  totalA4Sheets: number;
  totalA3Reams: number;
  // Print metrics
  avgDailyPages: number | null;
  estDaysLeft: number | null;
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

// Wider card for the paper breakdown
function PaperCard({ kpi }: { kpi: PrinterKpi }) {
  const hasStock = kpi.totalA4Sheets > 0 || kpi.totalA3Reams > 0;

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
          {/* A4 */}
          <div className="mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular-nums" style={{ color: "#415445", letterSpacing: "-0.03em" }}>
                {kpi.totalA4Boxes}
              </span>
              <span className="text-[12px] text-stone-500">box{kpi.totalA4Boxes !== 1 ? "es" : ""}</span>
              {kpi.totalA4LooseReams > 0 && (
                <>
                  <span className="text-stone-300">+</span>
                  <span className="text-xl font-semibold tabular-nums" style={{ color: "#415445", letterSpacing: "-0.03em" }}>
                    {kpi.totalA4LooseReams}
                  </span>
                  <span className="text-[12px] text-stone-500">ream{kpi.totalA4LooseReams !== 1 ? "s" : ""}</span>
                </>
              )}
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full ml-1" style={{ background: "#eef3e6", color: "#415445" }}>A4</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {kpi.totalA4Sheets.toLocaleString()} sheets · {kpi.totalA4Boxes * REAMS_PER_BOX_A4 + kpi.totalA4LooseReams} reams total
            </p>
          </div>

          {/* A3 — only show if any */}
          {kpi.totalA3Reams > 0 && (
            <div className="pt-2 border-t border-stone-50">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums" style={{ color: "#415445", letterSpacing: "-0.03em" }}>
                  {kpi.totalA3Reams}
                </span>
                <span className="text-[12px] text-stone-500">ream{kpi.totalA3Reams !== 1 ? "s" : ""}</span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full ml-1" style={{ background: "#eef3e6", color: "#415445" }}>A3</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PrinterKpiCards({ kpi }: { kpi: PrinterKpi }) {
  const allOnline = kpi.online === kpi.total;

  const topCards = [
    {
      label: "Fleet Status",
      value: `${kpi.online} / ${kpi.total}`,
      sub: "printers online",
      accent: allOnline ? "#059669" : "#dc2626",
      iconBg: allOnline ? "#d1fae5" : "#fee2e2",
      icon: Printer,
    },
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
      sub: "active tickets",
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

  const daysAccent = kpi.estDaysLeft === null
    ? "#a8a29e"
    : kpi.estDaysLeft <= 7
    ? "#dc2626"
    : kpi.estDaysLeft <= 14
    ? "#d97706"
    : "#059669";

  return (
    <div className="space-y-4 mb-6">
      {/* Row 1: fleet status */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {topCards.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* Row 2: paper metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PaperCard kpi={kpi} />

        <KpiCard
          label="Avg Daily Print"
          value={kpi.avgDailyPages !== null ? kpi.avgDailyPages.toLocaleString() : "—"}
          sub={kpi.avgDailyPages !== null ? "pages/day (this month)" : "No meter data this month"}
          accent={kpi.avgDailyPages !== null ? "#415445" : "#a8a29e"}
          iconBg={kpi.avgDailyPages !== null ? "#eef3e6" : "#f5f5f4"}
          icon={TrendingDown}
        />

        <KpiCard
          label="Est. Days of Paper Left"
          value={kpi.estDaysLeft !== null ? `~${kpi.estDaysLeft}` : "—"}
          sub={
            kpi.estDaysLeft !== null
              ? `based on ${kpi.avgDailyPages?.toLocaleString()} pages/day avg`
              : kpi.avgDailyPages === null
              ? "Need meter data to estimate"
              : kpi.totalA4Sheets === 0
              ? "No A4 stock recorded"
              : "—"
          }
          accent={daysAccent}
          iconBg={kpi.estDaysLeft !== null && kpi.estDaysLeft <= 7 ? "#fee2e2" : kpi.estDaysLeft !== null && kpi.estDaysLeft <= 14 ? "#fef3c7" : "#eef3e6"}
          icon={TrendingDown}
        />
      </div>
    </div>
  );
}
