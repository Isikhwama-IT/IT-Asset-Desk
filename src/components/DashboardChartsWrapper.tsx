"use client";

import { useState, useEffect } from "react";
import DashboardCharts from "@/components/DashboardCharts";

type Props = Parameters<typeof DashboardCharts>[0];

export default function DashboardChartsWrapper(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="mb-8" style={{ height: 200 }} />;
  return <DashboardCharts {...props} />;
}
