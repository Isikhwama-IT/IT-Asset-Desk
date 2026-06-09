import type { OnboardingCase, OnboardingPrinterAssignment, OnboardingSpendItem } from "@/types/database";

export type SectionState = "locked" | "awaiting" | "active" | "complete";

export interface SectionMeta {
  n: number;
  label: string;
  lockReason: string;
  awaitingLabel: string | null;
}

export const SECTIONS: SectionMeta[] = [
  { n: 1,  label: "Initiation",           lockReason: "",                                   awaitingLabel: null },
  { n: 2,  label: "Role & System Setup",  lockReason: "HR email must be sent first",        awaitingLabel: "Ashton confirmation" },
  { n: 3,  label: "Licensing",            lockReason: "Ashton PNG must be received",         awaitingLabel: "Upstream license quote" },
  { n: 4,  label: "Account Setup",        lockReason: "License decision must be recorded",   awaitingLabel: null },
  { n: 5,  label: "Procurement",          lockReason: "All accounts must be verified",       awaitingLabel: null },
  { n: 6,  label: "Approvals",            lockReason: "Procurement PDF must be sent",        awaitingLabel: "Management approvals" },
  { n: 7,  label: "Equipment Collection", lockReason: "All approvals must be granted",       awaitingLabel: "Upstream confirmation" },
  { n: 8,  label: "Printer Setup",        lockReason: "Drop-off must be arranged",           awaitingLabel: null },
  { n: 9,  label: "Arrival & Onboarding", lockReason: "Printer setup must be complete",      awaitingLabel: null },
  { n: 10, label: "Closure",              lockReason: "Arrival checklist must be complete",  awaitingLabel: null },
];

// NOTE: unlock logic scaffolded here — audited and hardened in Phase 10
export function deriveSectionStates(
  c: OnboardingCase,
  printerAssignments: OnboardingPrinterAssignment[]
): SectionState[] {
  const s = Array(10).fill("locked") as SectionState[];

  // §1 — always at least active
  s[0] = c.first_name && c.last_name && c.start_date && c.hr_email_sent_at
    ? "complete" : "active";

  // §2 — unlock: HR email sent
  if (!c.hr_email_sent_at) return s;
  s[1] = c.email_address && c.ashton_png_received
    ? "complete"
    : c.ashton_email_sent_at && !c.ashton_png_received
    ? "awaiting"
    : "active";

  // §3 — unlock: Ashton PNG received
  if (!c.ashton_png_received) return s;
  s[2] = c.license_decision
    ? "complete"
    : c.upstream_license_sent_at
    ? "awaiting"
    : "active";

  // §4 — unlock: license decision recorded
  if (!c.license_decision) return s;
  s[3] = c.acct_email_verified && c.acct_license_verified && c.acct_distro_verified
    && c.acct_teams_verified && c.acct_sharepoint_verified
    ? "complete" : "active";

  // §5 — unlock: all accounts verified
  if (!(c.acct_email_verified && c.acct_license_verified && c.acct_distro_verified
    && c.acct_teams_verified && c.acct_sharepoint_verified)) return s;
  s[4] = c.procurement_pdf_sent_at ? "complete" : "active";

  // §6 — unlock: PDF sent; always awaiting until all 3 approve
  if (!c.procurement_pdf_sent_at) return s;
  s[5] = c.rudi_approved && c.uzair_approved && c.finance_approved
    ? "complete" : "awaiting";

  // §7 — unlock: all approvals granted
  if (!(c.rudi_approved && c.uzair_approved && c.finance_approved)) return s;
  s[6] = c.upstream_confirmed_at && c.dropoff_arranged_at
    ? "complete"
    : c.upstream_goahead_sent_at
    ? "awaiting"
    : "active";

  // §8 — unlock: drop-off arranged
  if (!c.dropoff_arranged_at) return s;
  s[7] = printerAssignments.length > 0 && printerAssignments.every(pa => pa.test_print_done)
    ? "complete" : "active";

  // §9 — unlock: printer setup done (or no printers assigned)
  const printersDone = printerAssignments.length === 0
    || printerAssignments.every(pa => pa.test_print_done);
  if (!printersDone) return s;
  const arrivalDone = c.email_signature_added && c.wifi_connected
    && c.arr_policies && c.arr_assets_shown && c.arr_liability_signed
    && c.arr_wifi_phone && c.arr_authenticator && c.arr_bitlocker && c.arr_pin
    && c.arr_outlook && c.arr_teams && c.arr_onedrive
    && c.arr_ticket_process && c.arr_printer_tutorial;
  s[8] = arrivalDone ? "complete" : "active";

  // §10 — unlock: arrival complete
  if (!arrivalDone) return s;
  s[9] = c.completion_report_sent_at && c.paperwork_filed && c.closed_at
    ? "complete" : "active";

  return s;
}

export function getSectionSummary(
  n: number,
  c: OnboardingCase,
  spendItems: OnboardingSpendItem[],
  printerAssignments: OnboardingPrinterAssignment[]
): string {
  switch (n) {
    case 1:
      return [[c.first_name, c.last_name].filter(Boolean).join(" "), c.department, c.location]
        .filter(Boolean).join(" · ");
    case 2:
      return [c.email_address, c.laptop_tier ? `${c.laptop_tier} laptop` : null]
        .filter(Boolean).join(" · ");
    case 3: {
      if (!c.license_decision) return "";
      const label = c.license_decision.charAt(0).toUpperCase() + c.license_decision.slice(1);
      return c.license_cost ? `${label} · R${Number(c.license_cost).toFixed(0)}` : label;
    }
    case 4:
      return "All 5 accounts verified";
    case 5: {
      const count = spendItems.length;
      const total = spendItems.reduce((sum, i) => sum + (i.unit_cost ?? 0) * (i.qty ?? 1), 0);
      return `${count} item${count !== 1 ? "s" : ""}${total > 0 ? ` · R${total.toFixed(0)}` : ""}`;
    }
    case 6:
      return "Rudi ✓ · Uzair ✓ · Finance ✓";
    case 7:
      return [
        c.upstream_confirmed_at ? "Collected & confirmed" : null,
        c.dropoff_arranged_at ? "Drop-off arranged" : null,
      ].filter(Boolean).join(" · ");
    case 8: {
      const count = printerAssignments.length;
      return `${count} printer${count !== 1 ? "s" : ""} configured`;
    }
    case 9:
      return "14 of 14 checklist items complete";
    case 10:
      return c.closed_at
        ? `Closed ${new Date(c.closed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
        : "Report sent";
    default:
      return "";
  }
}
