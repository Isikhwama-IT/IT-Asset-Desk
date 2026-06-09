"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { OnboardingCase, OnboardingSpendItem, OnboardingPrinterAssignment } from "@/types/database";
import { updateOnboardingCase } from "@/lib/actions";
import { SECTIONS, deriveSectionStates, getSectionSummary } from "@/lib/onboarding";
import SectionShell from "@/components/onboarding/SectionShell";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

interface Props {
  initialCase: OnboardingCase;
  initialSpendItems: OnboardingSpendItem[];
  initialPrinterAssignments: OnboardingPrinterAssignment[];
}

export default function OnboardingCaseView({
  initialCase,
  initialSpendItems,
  initialPrinterAssignments,
}: Props) {
  const [c, setC] = useState(initialCase);
  const router = useRouter();
  const { error: toastError } = useToast();

  // Which section (1-based) is open for editing; null = none
  const [editingSection, setEditingSection] = useState<number | null>(null);

  const sectionStates = useMemo(
    () => deriveSectionStates(c, initialPrinterAssignments),
    [c, initialPrinterAssignments]
  );

  // Spend-changed warning: any spend item added after PDF was sent
  const spendChangedAfterPdf = !!(
    c.procurement_pdf_sent_at &&
    initialSpendItems.some((i) => i.created_at > c.procurement_pdf_sent_at!)
  );

  async function handleSave(section: number) {
    // Advance current_section if needed
    const next = Math.max(c.current_section ?? 1, section);
    if (next !== c.current_section) {
      const { error } = await updateOnboardingCase(c.id, { current_section: next });
      if (error) { toastError(error); return; }
      setC((prev) => ({ ...prev, current_section: next }));
    }
    setEditingSection(null);
    router.refresh();
  }

  function handleCancel() {
    setEditingSection(null);
  }

  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "New Case";

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/onboarding" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-1 h-3.5 rounded-full inline-block flex-shrink-0" style={{ background: "#C04F28" }} />
            <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#859474" }}>
              IT Onboarding
            </p>
          </div>
          <h1 className="text-xl font-semibold truncate" style={{ letterSpacing: "-0.03em", color: "#414042" }}>
            {name}
          </h1>
          {(c.job_title || c.department) && (
            <p className="text-[12px] text-stone-400 mt-0.5">
              {[c.job_title, c.department].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span className={cn(
          "flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border",
          c.status === "active"    ? "bg-green-50 text-green-700 border-green-200"  :
          c.status === "complete"  ? "bg-blue-50  text-blue-700  border-blue-200"   :
          "bg-stone-100 text-stone-500 border-stone-200"
        )}>
          {c.status}
        </span>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map(({ n, label, lockReason, awaitingLabel }) => {
          const state = sectionStates[n - 1];
          const isEditing = editingSection === n;
          const summary = state === "complete"
            ? getSectionSummary(n, c, initialSpendItems, initialPrinterAssignments)
            : undefined;

          return (
            <SectionShell
              key={n}
              n={n}
              title={label}
              state={state}
              lockReason={lockReason}
              awaitingLabel={awaitingLabel}
              summary={summary}
              isEditing={isEditing}
              onEdit={() => setEditingSection(n)}
              onSave={() => handleSave(n)}
              onCancel={handleCancel}
              showSpendWarning={n === 5 && spendChangedAfterPdf}
            >
              {/* Section content — added in later phases */}
              <p className="text-[12px] text-stone-300 italic py-2">
                Section {n} content — Phase {n} prompt
              </p>
            </SectionShell>
          );
        })}
      </div>
    </div>
  );
}
