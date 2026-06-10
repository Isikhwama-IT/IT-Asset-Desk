import type {
  OnboardingCase,
  OnboardingPrinterAssignment,
  OnboardingSpendItem,
} from "@/types/database";

export type SectionState = "locked" | "awaiting" | "active" | "complete";

export interface SectionMeta {
  n: number;
  label: string;
  lockReason: string;
  awaitingLabel: string | null;
}

export const SECTIONS: SectionMeta[] = [
  { n: 1,  label: "Initiate",               lockReason: "",                                        awaitingLabel: null },
  { n: 2,  label: "Employee Details",       lockReason: "HR email must be sent first",             awaitingLabel: null },
  { n: 3,  label: "Licensing",              lockReason: "Employee details must be submitted first", awaitingLabel: "Upstream response" },
  { n: 4,  label: "Procurement & Sign-off", lockReason: "License decision must be recorded",       awaitingLabel: "Management approvals" },
  { n: 5,  label: "Order",                  lockReason: "All approvals must be granted",           awaitingLabel: "Hardware delivery" },
  { n: 6,  label: "Hardware Arrival",       lockReason: "All items must be ordered first",         awaitingLabel: null },
  { n: 7,  label: "Equipment Collection",   lockReason: "Assets must be logged and collection arranged", awaitingLabel: "Upstream confirmation" },
  { n: 8,  label: "Printer Setup",          lockReason: "Drop-off must be arranged",               awaitingLabel: null },
  { n: 9,  label: "Arrival & Onboarding",   lockReason: "Printer setup must be complete",          awaitingLabel: null },
  { n: 10, label: "Closure",                lockReason: "Arrival checklist must be complete",       awaitingLabel: null },
];

// NOTE: unlock logic scaffolded here — audited and hardened in Phase 10
export function deriveSectionStates(
  c: OnboardingCase,
  spendItems: OnboardingSpendItem[],
  printerAssignments: OnboardingPrinterAssignment[]
): SectionState[] {
  const s = Array(10).fill("locked") as SectionState[];

  // §1 — always at least active; complete when HR email sent
  s[0] = c.hr_email_sent_at ? "complete" : "active";

  // §2 — unlock: HR email sent; complete when employee form submitted (email_address set)
  if (!c.hr_email_sent_at) return s;
  s[1] = c.email_address ? "complete" : "active";

  // §3 — unlock: employee details submitted (email_address set)
  // §3 never completes here — account items are verified in §7; §4 unlocks on license_decision alone
  if (!c.email_address) return s;
  const acctsDone = c.acct_email_verified && c.acct_license_verified && c.acct_distro_verified
    && c.acct_teams_verified && c.acct_sharepoint_verified;
  s[2] = acctsDone
    ? "complete"
    : c.upstream_license_sent_at && !c.license_decision
    ? "awaiting"
    : "active";

  // §4 — Procurement & Sign-off; unlock: license decision recorded
  if (!c.license_decision) return s;
  const allApproved = !!(c.rudi_approved && c.uzair_approved && c.finance_approved);
  s[3] = allApproved
    ? "complete"
    : c.procurement_pdf_sent_at
    ? "awaiting"
    : "active";

  // §5 — Order; unlock: all approvals
  if (!allApproved) return s;
  const hardwareItems = spendItems.filter((i) => i.category !== "license");
  const allOrdered = hardwareItems.every((i) => i.ordered);
  s[4] = allOrdered
    ? "complete"
    : c.upstream_goahead_sent_at
    ? "awaiting"
    : "active";

  // §6 — Hardware Arrival; unlock: all hardware ordered
  if (!allOrdered) return s;
  const laptopItem = hardwareItems.find((i) => i.category === "laptop");
  // If no laptop was procured there is nothing to log — treat as already done
  const laptopLogged = laptopItem ? !!laptopItem.asset_id : true;
  const collectionArranged = !!c.collection_arranged_at;
  // When no hardware was procured, collection is N/A — don't block progress
  const noHardware = hardwareItems.length === 0;
  const sixDone = noHardware ? laptopLogged : (laptopLogged && collectionArranged);
  s[5] = sixDone ? "complete" : "active";

  // §7 — Equipment Collection; unlock: §6 complete
  if (!sixDone) return s;
  const dropoffArranged = noHardware || !!c.dropoff_arranged_at;
  s[6] = acctsDone && dropoffArranged
    ? "complete"
    : c.upstream_confirmed_at
    ? "active"
    : c.upstream_collected_at
    ? "awaiting"
    : "active";

  // §8 — Finalise device; unlock: accounts verified AND drop-off arranged (N/A when no hardware)
  if (!(acctsDone && dropoffArranged)) return s;
  const allPrintersDone = printerAssignments.every(
    (pa) =>
      pa.profile_created && pa.code_assigned && pa.user_box_created &&
      pa.scanning_added && pa.installed && pa.test_print_done
  );
  const sec8Done = !!(c.email_signature_added && c.wifi_connected && allPrintersDone);
  s[7] = sec8Done ? "complete" : "active";

  // §9 — Employee Arrival; unlock: §8 complete
  if (!sec8Done) return s;
  const sec9Done = !!(
    c.arr_policies && c.arr_assets_shown && c.arr_liability_signed &&
    c.arr_wifi_phone && c.arr_authenticator && c.arr_bitlocker && c.arr_pin &&
    c.arr_outlook && c.arr_teams && c.arr_onedrive &&
    c.arr_ticket_process && c.arr_printer_tutorial
  );
  s[8] = sec9Done ? "complete" : "active";

  // §10 — Close; unlock: all arrival checklist items true
  if (!sec9Done) return s;
  s[9] = c.closed_at ? "complete" : "active";

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
      return c.hr_email_sent_at
        ? `HR email sent ${new Date(c.hr_email_sent_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
        : "";
    case 2: {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      return [name, c.email_address].filter(Boolean).join(" · ");
    }
    case 3: {
      const dec = c.license_decision;
      if (!dec) return c.upstream_license_sent_at ? "Upstream email sent" : "";
      const label = dec === "purchase" ? "Needs purchase" : dec.charAt(0).toUpperCase() + dec.slice(1);
      return c.license_cost != null ? `${label} · R${Number(c.license_cost).toFixed(0)}` : label;
    }
    case 4: {
      const licCost = c.license_decision === "purchase" ? (c.license_cost ?? 0) : 0;
      const total = spendItems.reduce((sum, i) => sum + (i.unit_cost ?? 0) * (i.qty ?? 1), 0) + licCost;
      const allApproved = c.rudi_approved && c.uzair_approved && c.finance_approved;
      const parts: string[] = [];
      if (total > 0) parts.push(`R${Number(total).toFixed(0)} total`);
      if (allApproved) parts.push("Rudi ✓ · Uzair ✓ · Finance ✓");
      return parts.join(" · ") || (c.procurement_pdf_sent_at ? "PDF sent" : "");
    }
    case 5: {
      const hw = spendItems.filter((i) => i.category !== "license");
      const ordered = hw.filter((i) => i.ordered).length;
      const parts: string[] = [];
      if (hw.length > 0) parts.push(`${ordered}/${hw.length} ordered`);
      if (c.upstream_goahead_sent_at) parts.push("Go-ahead sent");
      return parts.join(" · ");
    }
    case 6: {
      const hw = spendItems.filter((i) => i.category !== "license");
      const received = hw.filter((i) => i.received).length;
      const logged = hw.filter((i) => i.asset_id).length;
      const parts: string[] = [];
      if (hw.length > 0) parts.push(`${received}/${hw.length} received`);
      if (logged > 0) parts.push(`${logged} asset${logged !== 1 ? "s" : ""} logged`);
      if (c.collection_arranged_at) parts.push("Collection arranged");
      return parts.join(" · ");
    }
    case 10:
      return c.closed_at
        ? `Closed ${new Date(c.closed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
        : c.completion_report_sent_at ? "Report sent" : "";
    case 9: {
      const done = [
        c.arr_policies, c.arr_assets_shown, c.arr_liability_signed,
        c.arr_wifi_phone, c.arr_authenticator, c.arr_bitlocker, c.arr_pin,
        c.arr_outlook, c.arr_teams, c.arr_onedrive,
        c.arr_ticket_process, c.arr_printer_tutorial,
      ].filter(Boolean).length;
      return `${done}/12 complete`;
    }
    case 8: {
      const parts: string[] = [];
      if (c.email_signature_added) parts.push("Sig ✓");
      if (c.wifi_connected) parts.push("WiFi ✓");
      if (printerAssignments.length > 0) {
        const done = printerAssignments.filter(
          (pa) => pa.profile_created && pa.code_assigned && pa.user_box_created &&
                  pa.scanning_added && pa.installed && pa.test_print_done
        ).length;
        parts.push(`${done}/${printerAssignments.length} printer${printerAssignments.length !== 1 ? "s" : ""}`);
      }
      return parts.join(" · ");
    }
    case 7: {
      const parts: string[] = [];
      if (c.upstream_collected_at) parts.push("Collected");
      if (c.upstream_confirmed_at) parts.push("Confirmed");
      const acctCount = [
        c.acct_email_verified, c.acct_license_verified, c.acct_distro_verified,
        c.acct_teams_verified, c.acct_sharepoint_verified,
      ].filter(Boolean).length;
      if (acctCount > 0) parts.push(`${acctCount}/5 accounts`);
      if (c.dropoff_arranged_at) parts.push("Drop-off arranged");
      return parts.join(" · ");
    }
    default:
      return "";
  }
}
