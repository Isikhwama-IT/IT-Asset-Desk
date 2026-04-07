"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";

interface Props {
  statusData: { name: string; value: number }[];
  departmentData: { name: string; count: number }[];
  monthlyData: { month: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  "In Use":             "#415445",
  "In Storage":         "#859474",
  "Under Maintenance":  "#C04F28",
  "Damaged":            "#dc2626",
  "Lost":               "#7c3aed",
  "Stolen":             "#9f1239",
  "Retired":            "#78716c",
  "Unknown":            "#a8a29e",
};
const FALLBACKS = ["#C04F28", "#415445", "#859474", "#C9D9A0", "#414042", "#a8a29e", "#d97706", "#0369a1"];

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-md text-[12px]">
      <p className="text-stone-500">{payload[0].name}</p>
      <p className="font-semibold text-stone-800">{payload[0].value}</p>
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-md text-[12px]">
      <p className="text-stone-500 mb-1">{label}</p>
      <p className="font-medium" style={{ color: payload[0].fill }}>{payload[0].value} assets</p>
    </div>
  );
}

function AreaTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-md text-[12px]">
      <p className="text-stone-500 mb-1">{label}</p>
      <p className="font-medium" style={{ color: "#C04F28" }}>{payload[0].value} purchased</p>
    </div>
  );
}

export default function DashboardCharts({ statusData, departmentData, monthlyData }: Props) {
  return (
    <div className="space-y-6 mb-8">
      {/* Row 1: Donut + Area */}
      <div className="grid grid-cols-3 gap-6">
        {/* Donut — by Status */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 card-lift fade-up fade-up-1">
          <p className="text-[12px] font-medium uppercase tracking-wider mb-4" style={{ color: "#859474" }}>
            Assets by Status
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {statusData.map((entry, i) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? FALLBACKS[i % FALLBACKS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {statusData.map((entry, i) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: STATUS_COLORS[entry.name] ?? FALLBACKS[i % FALLBACKS.length] }}
                  />
                  <span className="text-[11.5px] text-stone-600">{entry.name}</span>
                </div>
                <span className="text-[11.5px] font-medium text-stone-800 tabular-nums">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Area — asset growth over time */}
        <div className="col-span-2 bg-white rounded-xl border border-stone-200 p-5 card-lift fade-up fade-up-2">
          <p className="text-[12px] font-medium uppercase tracking-wider mb-4" style={{ color: "#859474" }}>
            Purchases over Time
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#C04F28" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#C04F28" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#a8a29e" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a8a29e" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<AreaTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#C04F28"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={{ r: 3, fill: "#C04F28", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#C04F28", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Department bar — full width */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 card-lift fade-up fade-up-3">
        <p className="text-[12px] font-medium uppercase tracking-wider mb-4" style={{ color: "#859474" }}>
          Assets by Department
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={departmentData} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#a8a29e" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: "#f9f9f8" }} />
            <Bar dataKey="count" fill="#C04F28" radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
