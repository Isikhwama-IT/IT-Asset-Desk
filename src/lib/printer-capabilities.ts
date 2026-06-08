// Single source of truth for printer capability logic and paper calculations.

export const SHEETS_PER_REAM_A4 = 500;
export const REAMS_PER_BOX_A4 = 5;
export const SHEETS_PER_BOX_A4 = SHEETS_PER_REAM_A4 * REAMS_PER_BOX_A4;
export const SHEETS_PER_REAM_A3 = 250;

export const PAPER_SIZES = ["A4", "A3"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export const PAPER_CONSTANTS: Record<
  PaperSize,
  {
    sheetsPerReam: number;
    reamsPerBox: number | null;
    sheetsPerBox: number | null;
  }
> = {
  A4: {
    sheetsPerReam: SHEETS_PER_REAM_A4,
    reamsPerBox: REAMS_PER_BOX_A4,
    sheetsPerBox: SHEETS_PER_BOX_A4,
  },
  A3: {
    sheetsPerReam: SHEETS_PER_REAM_A3,
    reamsPerBox: null,
    sheetsPerBox: null,
  },
};

export function sheetsFromBoxes(size: PaperSize, boxes: number): number {
  const sheetsPerBox = PAPER_CONSTANTS[size].sheetsPerBox;
  return sheetsPerBox ? boxes * sheetsPerBox : 0;
}

export function sheetsFromReams(size: PaperSize, reams: number): number {
  return reams * PAPER_CONSTANTS[size].sheetsPerReam;
}

export function reamsFromBoxes(size: PaperSize, boxes: number): number {
  const reamsPerBox = PAPER_CONSTANTS[size].reamsPerBox;
  return reamsPerBox ? boxes * reamsPerBox : 0;
}

export function sheetsFromPaperStock(size: PaperSize, boxes: number, reams: number): number {
  return sheetsFromBoxes(size, boxes) + sheetsFromReams(size, reams);
}

export type TonerSlot = "black" | "cyan" | "magenta" | "yellow" | "combined";
export type TonerConfig = "separate" | "all-in-one";

export type TrayConfig = {
  id: string;
  tray_name: string;
  paper_size: PaperSize;
  capacity_reams: number | null;
  sort_order: number;
  is_active: boolean;
};

export type PrinterCapabilities = {
  isColour: boolean;
  supportsA3: boolean;
  tonerConfig: TonerConfig;
  tonerSlots: TonerSlot[];
  hasDeveloperUnits: boolean;
  hasWasteBox: boolean;
  hasFuserTracking: boolean;
  hasDrumTracking: boolean;
  isDuplex: boolean;
  isScanCapable: boolean;
  isFaxCapable: boolean;
  trays: TrayConfig[];
};

export type CapabilitySource = {
  is_colour?: boolean | null;
  supports_a3?: boolean | null;
  toner_config?: string | null;
  has_developer_units?: boolean | null;
  has_waste_box?: boolean | null;
  has_fuser_tracking?: boolean | null;
  has_drum_tracking?: boolean | null;
  is_duplex?: boolean | null;
  is_scan_capable?: boolean | null;
  is_fax_capable?: boolean | null;
};

export function getPrinterCapabilities(
  printer: CapabilitySource,
  trays: TrayConfig[] = []
): PrinterCapabilities {
  const isColour = printer.is_colour ?? false;
  const tonerConfig: TonerConfig =
    isColour && printer.toner_config === "all-in-one" ? "all-in-one" : "separate";

  let tonerSlots: TonerSlot[];
  if (tonerConfig === "all-in-one") {
    tonerSlots = ["combined"];
  } else if (isColour) {
    tonerSlots = ["black", "cyan", "magenta", "yellow"];
  } else {
    tonerSlots = ["black"];
  }

  return {
    isColour,
    supportsA3: printer.supports_a3 ?? false,
    tonerConfig,
    tonerSlots,
    hasDeveloperUnits: printer.has_developer_units ?? false,
    hasWasteBox: printer.has_waste_box ?? false,
    hasFuserTracking: printer.has_fuser_tracking ?? false,
    hasDrumTracking: printer.has_drum_tracking ?? false,
    isDuplex: printer.is_duplex ?? false,
    isScanCapable: printer.is_scan_capable ?? false,
    isFaxCapable: printer.is_fax_capable ?? false,
    trays: [...trays]
      .filter((t) => t.is_active)
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}

export const SLOT_LABEL: Record<TonerSlot, string> = {
  black: "Black",
  cyan: "Cyan",
  magenta: "Magenta",
  yellow: "Yellow",
  combined: "Combined",
};

export const SLOT_DB_KEY: Record<TonerSlot, string> = {
  black: "black_toner_stock",
  cyan: "cyan_toner_stock",
  magenta: "magenta_toner_stock",
  yellow: "yellow_toner_stock",
  combined: "black_toner_stock",
};

// ── Consumable compatibility helper ──────────────────────────────────────────

// Returns true if the consumable's compatible_models list (comma-separated string)
// includes the printer's model/manufacturer, or if no list is specified (matches all).
export function isConsumableCompatibleWithPrinter(
  consumable: { compatible_models?: string | null },
  printer: { manufacturer?: string | null; model?: string | null; name?: string | null }
): boolean {
  if (!consumable.compatible_models) return true; // no restriction — matches all

  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const models = consumable.compatible_models
    .split(",")
    .map((m) => normalise(m.trim()))
    .filter(Boolean);

  const printerText = normalise(
    [printer.manufacturer, printer.model, printer.name].filter(Boolean).join(" ")
  );

  return models.some((m) => printerText.includes(m) || m.includes(printerText));
}

// ── Consumable lookup helpers ─────────────────────────────────────────────────

// Matches on `kind` and `colour` which are the actual DB column names.
// category / colour are compared case-insensitively and normalised.
// "n/a" and "other" are treated as equivalent for colour matching.
export function findConsumableType<
  T extends { kind: string; colour: string }
>(consumables: T[], kind: string, colour: string): T | undefined {
  const k = kind.toLowerCase().replace(/[\s-]/g, "_");
  const c = colour.toLowerCase();
  const normColour = (v: string) => {
    const lo = v.toLowerCase();
    return lo === "n/a" ? "other" : lo;
  };
  return consumables.find(
    (t) => t.kind === k && normColour(t.colour) === normColour(c)
  );
}
