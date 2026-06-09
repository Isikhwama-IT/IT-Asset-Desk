"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, ChevronRight, Plus, MapPin, Calendar } from "lucide-react";
import type { OnboardingCase } from "@/types/database";
import { createOnboardingCase } from "@/lib/actions";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface Props {
  cases: OnboardingCase[];
}

type FilterTab = "active" | "complete" | "all";

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">Active</span>;
  if (status === "complete")
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">Complete</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-500 border border-stone-200">Cancelled</span>;
}

function SiteBadge({ location }: { location: string | null }) {
  if (!location) return null;
  const isBaker = location === "Baker Street";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
      isBaker ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-violet-50 text-violet-700 border border-violet-200"
    )}>
      <MapPin size={9} />
      {location}
    </span>
  );
}

function ProgressPip({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: i < current ? "#415445" : "#e7e5e4" }}
          />
        ))}
      </div>
      <span className="text-[11px] text-stone-400">§{current}/10</span>
    </div>
  );
}

export default function OnboardingList({ cases }: Props) {
  const { isAdmin } = useAuth();
  const { success, error: toastError } = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("active");
  const [pending, startTransition] = useTransition();

  const filtered = cases.filter((c) =>
    filter === "all" ? true : c.status === filter
  );

  const counts = {
    active: cases.filter((c) => c.status === "active").length,
    complete: cases.filter((c) => c.status === "complete").length,
    all: cases.length,
  };

  function handleNewCase() {
    startTransition(async () => {
      const { id, error } = await createOnboardingCase();
      if (error || !id) { toastError(error ?? "Failed to create case"); return; }
      success("New onboarding case created");
      router.push(`/onboarding/${id}`);
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          {(["active", "complete", "all"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors capitalize",
                filter === tab ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
              )}
            >
              {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-1.5 text-[11px] text-stone-400">{counts[tab]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {isAdmin && (
          <button
            onClick={handleNewCase}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-60"
            style={{ background: "#C04F28" }}
          >
            <Plus size={13} />
            {pending ? "Creating…" : "New Case"}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-stone-400">
            <UserPlus size={32} className="opacity-30" />
            <p className="text-[13px]">
              {filter === "active" ? "No active onboarding cases." : "No cases yet."}
            </p>
            {isAdmin && filter === "active" && (
              <button
                onClick={handleNewCase}
                disabled={pending}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg text-white"
                style={{ background: "#C04F28" }}
              >
                Start first case
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 text-[11px] uppercase tracking-wide">
                  Employee
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 text-[11px] uppercase tracking-wide hidden sm:table-cell">
                  Site
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 text-[11px] uppercase tracking-wide hidden md:table-cell">
                  Start Date
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 text-[11px] uppercase tracking-wide hidden lg:table-cell">
                  Progress
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 text-[11px] uppercase tracking-wide">
                  Status
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={c.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/onboarding/${c.id}`} className="block">
                        <span className="font-medium text-stone-800 hover:underline">{name}</span>
                        {c.job_title && (
                          <span className="block text-[11px] text-stone-400 mt-0.5">{c.job_title}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <SiteBadge location={c.location} />
                    </td>
                    <td className="px-4 py-3 text-stone-500 hidden md:table-cell">
                      {c.start_date ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={11} className="text-stone-300" />
                          {new Date(c.start_date).toLocaleDateString("en-ZA", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <ProgressPip current={c.current_section ?? 1} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/onboarding/${c.id}`} className="text-stone-300 hover:text-stone-500">
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
