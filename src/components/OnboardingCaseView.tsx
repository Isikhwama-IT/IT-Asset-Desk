"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import type { OnboardingCase, OnboardingSpendItem, OnboardingPrinterAssignment } from "@/types/database";
import { updateOnboardingCase } from "@/lib/actions";
import { SECTIONS, deriveSectionStates, getSectionSummary } from "@/lib/onboarding";
import SectionShell from "@/components/onboarding/SectionShell";
import Section1 from "@/components/onboarding/Section1";
import Section2 from "@/components/onboarding/Section2";
import Section3 from "@/components/onboarding/Section3";
import Section4 from "@/components/onboarding/Section4";
import Section5 from "@/components/onboarding/Section5";
import Section6 from "@/components/onboarding/Section6";
import Section7 from "@/components/onboarding/Section7";
import Section8 from "@/components/onboarding/Section8";
import Section9 from "@/components/onboarding/Section9";
import Section10 from "@/components/onboarding/Section10";
import AshtonPanel from "@/components/onboarding/AshtonPanel";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type ExternalContact = { id: string; name: string; company: string | null; email: string | null };

interface Props {
  initialCase: OnboardingCase;
  initialSpendItems: OnboardingSpendItem[];
  initialPrinterAssignments: OnboardingPrinterAssignment[];
  initialExternalContacts: ExternalContact[];
}

export default function OnboardingCaseView({
  initialCase,
  initialSpendItems,
  initialPrinterAssignments,
  initialExternalContacts,
}: Props) {
  const [c, setC] = useState(initialCase);
  const [spendItems, setSpendItems] = useState(initialSpendItems);
  const [printerAssignments, setPrinterAssignments] = useState(initialPrinterAssignments);
  const router = useRouter();
  const { error: toastError } = useToast();

  const [editingSection, setEditingSection] = useState<number | null>(null);

  const sectionStates = useMemo(
    () => deriveSectionStates(c, spendItems, printerAssignments),
    [c, spendItems, printerAssignments]
  );

  // Called by section components when they complete or save changes.
  async function handleSectionComplete(section: number, updates: Partial<OnboardingCase>) {
    const next = Math.max(c.current_section ?? 1, section);
    setC((prev) => ({ ...prev, ...updates }));
    setEditingSection(null);
    if (next !== (c.current_section ?? 1)) {
      const { error } = await updateOnboardingCase(c.id, { current_section: next });
      if (error) toastError(error);
      else setC((prev) => ({ ...prev, current_section: next }));
    }
    router.refresh();
  }

  // Used by placeholder sections whose SectionShell Save button has no form to submit.
  async function handleSave(section: number) {
    const next = Math.max(c.current_section ?? 1, section);
    if (next !== (c.current_section ?? 1)) {
      const { error } = await updateOnboardingCase(c.id, { current_section: next });
      if (error) { toastError(error); return; }
      setC((prev) => ({ ...prev, current_section: next }));
    }
    setEditingSection(null);
    router.refresh();
  }

  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "New Case";

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Closed banner */}
      {c.closed_at && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <Check size={12} className="text-green-600" strokeWidth={2.5} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-green-800">Case closed</p>
            <p className="text-[12px] text-green-600">
              This onboarding case was closed on{" "}
              {new Date(c.closed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}.
              All sections are read-only.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/onboarding"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-1 h-3.5 rounded-full inline-block flex-shrink-0" style={{ background: "#C04F28" }} />
            <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>
              IT Onboarding
            </p>
          </div>
          <h1
            className="text-xl font-semibold truncate"
            style={{ letterSpacing: "-0.03em", color: "#414042" }}
          >
            {name}
          </h1>
          {(c.job_title || c.department) && (
            <p className="text-[12px] text-stone-400 mt-0.5">
              {[c.job_title, c.department].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span
          className={cn(
            "flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border",
            c.status === "active"
              ? "bg-green-50 text-green-700 border-green-200"
              : c.status === "complete"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-stone-100 text-stone-500 border-stone-200"
          )}
        >
          {c.status}
        </span>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map(({ n, label, lockReason, awaitingLabel }) => {
          const state     = sectionStates[n - 1];
          const isEditing = editingSection === n;
          const summary   = state === "complete"
            ? getSectionSummary(n, c, spendItems, printerAssignments)
            : undefined;

          const content =
            n === 1 ? (
              <Section1
                c={c}
                onComplete={(updates) => handleSectionComplete(1, updates)}
              />
            ) : n === 2 ? (
              <Section2
                c={c}
                onComplete={(updates) => handleSectionComplete(2, updates)}
                onCancel={isEditing ? () => setEditingSection(null) : undefined}
              />
            ) : n === 3 ? (
              <Section3
                c={c}
                externalContacts={initialExternalContacts}
                onUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
              />
            ) : n === 4 ? (
              <Section4
                c={c}
                spendItems={spendItems}
                onCaseUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
                onSpendChange={setSpendItems}
              />
            ) : n === 5 ? (
              <Section5
                c={c}
                spendItems={spendItems}
                externalContacts={initialExternalContacts}
                onCaseUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
                onSpendChange={setSpendItems}
              />
            ) : n === 6 ? (
              <Section6
                c={c}
                spendItems={spendItems}
                onCaseUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
                onSpendChange={setSpendItems}
              />
            ) : n === 7 ? (
              <Section7
                c={c}
                spendItems={spendItems}
                externalContacts={initialExternalContacts}
                onUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
              />
            ) : n === 8 ? (
              <Section8
                c={c}
                printerAssignments={printerAssignments}
                onCaseUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
                onAssignmentsChange={setPrinterAssignments}
              />
            ) : n === 9 ? (
              <Section9
                c={c}
                onUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
              />
            ) : n === 10 ? (
              <Section10
                c={c}
                spendItems={spendItems}
                printerAssignments={printerAssignments}
                externalContacts={initialExternalContacts}
                onUpdate={(updates) => setC((prev) => ({ ...prev, ...updates }))}
              />
            ) : (
              <p className="text-[12px] text-stone-300 italic py-2">
                Section {n} content — Phase {n} prompt
              </p>
            );

          return (
            <div key={n}>
              <SectionShell
                n={n}
                title={label}
                state={state}
                lockReason={lockReason}
                awaitingLabel={awaitingLabel}
                summary={summary}
                isEditing={isEditing}
                onEdit={() => setEditingSection(n)}
                onSave={() => handleSave(n)}
                onCancel={() => setEditingSection(null)}
                hideShellSave={n !== 0}
                readOnly={!!c.closed_at}
              >
                {content}
              </SectionShell>

              {/* Ashton panel: appears below §2 once employee form is submitted */}
              {n === 2 && c.email_address && (
                <div className="mt-3">
                  <AshtonPanel
                    c={c}
                    onSent={(updates) => setC((prev) => ({ ...prev, ...updates }))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
