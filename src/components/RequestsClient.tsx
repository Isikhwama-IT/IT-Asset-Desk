"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { AssetRequest } from "@/types/database";

type Status = "All" | "Pending" | "In Review" | "Approved" | "Declined" | "Closed";

const STATUS_TABS: Status[] = ["All", "Pending", "In Review", "Approved", "Declined", "Closed"];

function statusStyle(status: string) {
  switch (status) {
    case "Pending":   return "bg-amber-50 text-amber-700";
    case "In Review": return "bg-sky-50 text-sky-700";
    case "Approved":  return "bg-emerald-50 text-emerald-700";
    case "Declined":  return "bg-red-50 text-red-700";
    case "Closed":    return "bg-stone-100 text-stone-500";
    default:          return "bg-stone-50 text-stone-500";
  }
}

export default function RequestsClient({ requests }: { requests: AssetRequest[] }) {
  const [activeTab, setActiveTab] = useState<Status>("All");

  const filtered = activeTab === "All"
    ? requests
    : requests.filter((r) => r.status === activeTab);

  const countFor = (tab: Status) =>
    tab === "All" ? requests.length : requests.filter((r) => r.status === tab).length;

  return (
    <div className="fade-up">
      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-stone-200">
        {STATUS_TABS.map((tab) => {
          const count = countFor(tab);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium transition-colors border-b-2 -mb-px`}
              style={{
                borderBottomColor: activeTab === tab ? "#C04F28" : "transparent",
                color: activeTab === tab ? "#C04F28" : undefined,
              }}
            >
              {tab}
              {count > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums"
                  style={{ background: activeTab === tab ? "#C04F28" : "#f5f5f4", color: activeTab === tab ? "#fff" : "#78716c" }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-300">
            <Inbox size={28} className="mb-3" />
            <p className="text-[13px]">No {activeTab === "All" ? "" : activeTab.toLowerCase() + " "}requests</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-5 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Reason</th>
                <th className="px-5 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Status</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-stone-50 transition-colors group">
                  <td className="px-5 py-3 text-[12px] text-stone-500 whitespace-nowrap">
                    {formatDate(req.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-medium text-stone-800">{req.requester_name}</p>
                    <p className="text-[11px] text-stone-400">{req.requester_email}</p>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-stone-600">
                    {req.category_name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-stone-500 max-w-xs truncate">
                    {req.reason || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block text-[11.5px] font-medium px-2 py-0.5 rounded-full ${statusStyle(req.status)}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/requests/${req.id}`}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition-colors inline-flex"
                    >
                      <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
