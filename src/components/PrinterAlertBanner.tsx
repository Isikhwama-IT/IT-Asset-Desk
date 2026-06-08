import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type PrinterAlert = {
  level: "critical" | "warning" | "info";
  type: string;
  message: string;
  printers: string[];
};

export default function PrinterAlertBanner({ alerts }: { alerts: PrinterAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50 mb-6 fade-up">
        <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
        <p className="text-[13px] font-medium text-emerald-700">All systems operational</p>
      </div>
    );
  }

  const critical = alerts.filter((a) => a.level === "critical");
  const warning = alerts.filter((a) => a.level === "warning");
  const info = alerts.filter((a) => a.level === "info");

  const Block = ({
    items,
    borderColor,
    bgColor,
    Icon,
    iconColor,
    labelColor,
  }: {
    items: PrinterAlert[];
    borderColor: string;
    bgColor: string;
    Icon: React.ElementType;
    iconColor: string;
    labelColor: string;
  }) => {
    if (items.length === 0) return null;
    return (
      <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden mb-3 fade-up`}>
        <div className="divide-y divide-white/40">
          {items.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Icon size={14} className={`${iconColor} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${labelColor} mr-2`}>{a.type}</span>
                <span className="text-[12.5px] text-stone-700">{a.message}</span>
                {a.printers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.printers.map((p) => (
                      <span key={p} className="text-[10.5px] bg-white/60 border border-white/80 px-2 py-0.5 rounded-full text-stone-600">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-6">
      <Block items={critical} borderColor="border-red-200" bgColor="bg-red-50" Icon={XCircle} iconColor="text-red-500" labelColor="text-red-700" />
      <Block items={warning} borderColor="border-amber-200" bgColor="bg-amber-50" Icon={AlertTriangle} iconColor="text-amber-500" labelColor="text-amber-700" />
      <Block items={info} borderColor="border-sky-200" bgColor="bg-sky-50" Icon={Info} iconColor="text-sky-500" labelColor="text-sky-700" />
    </div>
  );
}
