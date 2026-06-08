// All prediction and cost calculations — server-side only, no client imports.

import { REAMS_PER_BOX_A4, SHEETS_PER_REAM_A4 } from "@/lib/printer-capabilities";

export type AvgDailyPages = { avgPerDay: number; daysOfData: number };

export type Prediction = {
  daysRemaining: number | null;
  runoutDateLabel: string | null;
  urgency: "ok" | "order-now" | "insufficient-data" | "no-data";
  label: string;
};

export type CostEstimate = {
  hasData: boolean;
  blackCpp: number | null;
  colourCpp: number | null;
  pagesThisMonth: number;
  estimatedMonthlyCost: number | null;
};

// ── Avg daily pages from meter reading rows (ordered by date asc) ─────────────

export function computeAvgDailyPages(
  meterRows: { reading: number; reading_at: string }[]
): AvgDailyPages | null {
  if (meterRows.length < 2) return null;

  const sorted = [...meterRows].sort((a, b) => a.reading_at.localeCompare(b.reading_at));
  const totalPrinted = sorted[sorted.length - 1].reading - sorted[0].reading;
  if (totalPrinted <= 0) return null;

  const msSpan =
    new Date(sorted[sorted.length - 1].reading_at + "T12:00:00Z").getTime() -
    new Date(sorted[0].reading_at + "T12:00:00Z").getTime();
  const daySpan = Math.max(1, Math.round(msSpan / 86_400_000));

  return { avgPerDay: totalPrinted / daySpan, daysOfData: daySpan };
}

// ── Toner / consumable run-out prediction ────────────────────────────────────

export function predictConsumableRunout(
  currentPct: number | null,
  ratedYieldPages: number | null,
  avgDaily: AvgDailyPages | null,
  supplierLeadDays: number
): Prediction {
  if (currentPct === null || ratedYieldPages === null)
    return { daysRemaining: null, runoutDateLabel: null, urgency: "no-data", label: "—" };

  if (!avgDaily || avgDaily.daysOfData < 3 || avgDaily.avgPerDay <= 0)
    return { daysRemaining: null, runoutDateLabel: null, urgency: "insufficient-data", label: "Insufficient print history for prediction" };

  const pagesRemaining = (currentPct / 100) * ratedYieldPages;
  const daysRemaining = Math.max(0, Math.round(pagesRemaining / avgDaily.avgPerDay));
  const runoutDate = new Date(Date.now() + daysRemaining * 86_400_000);
  const runoutDateLabel = runoutDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const urgency: Prediction["urgency"] = daysRemaining <= supplierLeadDays ? "order-now" : "ok";
  const label = `Est. ~${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining (approx. ${runoutDateLabel})`;
  return { daysRemaining, runoutDateLabel, urgency, label };
}

// ── Paper run-out prediction ──────────────────────────────────────────────────

export function predictPaperRunout(
  paperBoxes: number,
  avgDaily: AvgDailyPages | null
): Prediction {
  const sheets = paperBoxes * REAMS_PER_BOX_A4 * SHEETS_PER_REAM_A4;

  if (paperBoxes === 0)
    return { daysRemaining: 0, runoutDateLabel: null, urgency: "order-now", label: "Out of paper" };

  if (!avgDaily || avgDaily.avgPerDay <= 0)
    return {
      daysRemaining: null, runoutDateLabel: null, urgency: "insufficient-data",
      label: `${sheets.toLocaleString()} sheets on hand — no print history for prediction`,
    };

  const daysRemaining = Math.max(0, Math.round(sheets / avgDaily.avgPerDay));
  const runoutDate = new Date(Date.now() + daysRemaining * 86_400_000);
  const runoutDateLabel = runoutDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return {
    daysRemaining,
    runoutDateLabel,
    urgency: daysRemaining <= 3 ? "order-now" : "ok",
    label: `Est. ~${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} of paper remaining (approx. ${runoutDateLabel})`,
  };
}

// ── Monthly cost estimate ─────────────────────────────────────────────────────

export function computeCostEstimate(
  consumableTypes: {
    colour: string;
    kind: string;
    rated_yield_pages: number | null;
    unit_price: number | null;
  }[],
  pagesThisMonth: number
): CostEstimate {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const tonerTypes = consumableTypes.filter(
    (t) => normalise(t.kind) === "toner" && t.rated_yield_pages && t.unit_price
  );

  if (tonerTypes.length === 0)
    return { hasData: false, blackCpp: null, colourCpp: null, pagesThisMonth, estimatedMonthlyCost: null };

  const blackType = tonerTypes.find((t) => normalise(t.colour) === "black");
  const blackCpp =
    blackType?.unit_price && blackType?.rated_yield_pages
      ? blackType.unit_price / blackType.rated_yield_pages
      : null;

  const colourExtras = tonerTypes.filter((t) =>
    ["cyan", "magenta", "yellow"].includes(normalise(t.colour))
  );
  const colourExtraCpp = colourExtras.reduce((sum, t) => {
    if (!t.unit_price || !t.rated_yield_pages) return sum;
    return sum + t.unit_price / t.rated_yield_pages;
  }, 0);
  const colourCpp = blackCpp !== null && colourExtras.length > 0 ? blackCpp + colourExtraCpp : null;

  const estimatedMonthlyCost =
    blackCpp !== null ? Math.round(pagesThisMonth * blackCpp) : null;

  return { hasData: true, blackCpp, colourCpp, pagesThisMonth, estimatedMonthlyCost };
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCpp(cpp: number): string {
  return `R ${cpp.toFixed(4)}`;
}
