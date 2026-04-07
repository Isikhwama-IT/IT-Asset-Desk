"use client";

import { useState, useMemo } from "react";
import { ClipboardList, Search } from "lucide-react";
import type { ActivityLog } from "@/types/database";

const ACTION_LABELS: Record<string, string> = {
  login:               "Login",
  login_failed:        "Login Failed",
  logout:              "Logout",
  create_asset:        "Asset Created",
  update_asset:        "Asset Updated",
  change_asset_status: "Status Changed",
  assign_asset:        "Asset Assigned",
  unassign_asset:      "Asset Unassigned",
  bulk_change_status:  "Bulk Status Change",
  create_contact:      "Contact Created",
  update_contact:      "Contact Updated",
  activate_contact:    "Contact Activated",
  deactivate_contact:  "Contact Deactivated",
  update_setting:      "Setting Updated",
  update_request:      "Request Updated",
  delete_request:      "Request Deleted",
};

const ACTION_COLORS: Record<string, string> = {
  login:               "bg-emerald-50 text-emerald-700",
  login_failed:        "bg-red-50 text-red-700",
  logout:              "bg-stone-100 text-stone-500",
  create_asset:        "bg-sky-50 text-sky-700",
  update_asset:        "bg-blue-50 text-blue-700",
  change_asset_status: "bg-indigo-50 text-indigo-700",
  assign_asset:        "bg-violet-50 text-violet-700",
  unassign_asset:      "bg-purple-50 text-purple-700",
  bulk_change_status:  "bg-indigo-50 text-indigo-700",
  create_contact:      "bg-teal-50 text-teal-700",
  update_contact:      "bg-cyan-50 text-cyan-700",
  activate_contact:    "bg-emerald-50 text-emerald-700",
  deactivate_contact:  "bg-stone-100 text-stone-500",
  update_setting:      "bg-amber-50 text-amber-700",
  update_request:      "bg-orange-50 text-orange-700",
  delete_request:      "bg-red-50 text-red-700",
};

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function parseUA(ua: string | null) {
  if (!ua) return "—";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return ua.slice(0, 30);
}

type FilterType = "all" | "auth" | "assets" | "contacts" | "settings" | "requests";

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "auth",     label: "Auth" },
  { key: "assets",   label: "Assets" },
  { key: "contacts", label: "Contacts" },
  { key: "settings", label: "Settings" },
  { key: "requests", label: "Requests" },
];

const FILTER_ACTIONS: Record<FilterType, string[]> = {
  all:      [],
  auth:     ["login", "login_failed", "logout"],
  assets:   ["create_asset", "update_asset", "change_asset_status", "assign_asset", "unassign_asset", "bulk_change_status"],
  contacts: ["create_contact", "update_contact", "activate_contact", "deactivate_contact"],
  settings: ["update_setting"],
  requests: ["update_request", "delete_request"],
};

export default function AuditClient({ logs }: { logs: ActivityLog[] }) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = logs;
    if (filter !== "all") {
      result = result.filter((l) => FILTER_ACTIONS[filter].includes(l.action));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.user_name?.toLowerCase().includes(q) ||
          l.user_email?.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entity_label?.toLowerCase().includes(q) ||
          l.ip_address?.includes(q)
      );
    }
    return result;
  }, [logs, filter, search]);

  return (
    <div className="fade-up">
      {/* Controls */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 border-b border-stone-200 flex-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-4 py-2 text-[13px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap"
              style={{
                borderBottomColor: filter === f.key ? "#C04F28" : "transparent",
                color: filter === f.key ? "#C04F28" : undefined,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-3 py-2 bg-white">
          <Search size={13} className="text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, action, IP…"
            className="text-[13px] text-stone-800 placeholder:text-stone-300 focus:outline-none w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-300">
            <ClipboardList size={28} className="mb-3" />
            <p className="text-[13px]">No activity found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="px-4 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Target</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">IP Address</th>
                  <th className="px-4 py-3 text-[11px] font-medium text-stone-400 uppercase tracking-wider">Browser</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 text-[11.5px] text-stone-500 font-mono whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {log.user_name || log.user_email ? (
                        <>
                          <p className="text-[13px] font-medium text-stone-800">{log.user_name ?? "—"}</p>
                          <p className="text-[11px] text-stone-400">{log.user_email ?? ""}</p>
                        </>
                      ) : (
                        <span className="text-[12px] text-stone-400 italic">Anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ACTION_COLORS[log.action] ?? "bg-stone-100 text-stone-600"}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.entity_label ? (
                        <p className="text-[12.5px] text-stone-700">{log.entity_label}</p>
                      ) : log.entity_type ? (
                        <p className="text-[12px] text-stone-400 capitalize">{log.entity_type}</p>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-stone-500 font-mono">
                      {log.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-stone-500">
                      {parseUA(log.user_agent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {filtered.length > 0 && (
        <p className="text-[11px] text-stone-400 mt-3 text-right">{filtered.length} entries (last 500)</p>
      )}
    </div>
  );
}
