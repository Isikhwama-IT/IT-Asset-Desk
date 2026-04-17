"use client";

import dynamic from "next/dynamic";

const DashboardCharts = dynamic(() => import("@/components/DashboardCharts"), { ssr: false });

export default DashboardCharts;
