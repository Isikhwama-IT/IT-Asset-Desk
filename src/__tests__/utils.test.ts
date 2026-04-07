import { describe, it, expect } from "vitest";
import { formatDate, getStatusConfig, getCategoryIcon } from "@/lib/utils";

describe("formatDate", () => {
  it("returns em-dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns a formatted string for a valid ISO date", () => {
    const result = formatDate("2024-01-15");
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it("returns a formatted string for a date at end of year", () => {
    const result = formatDate("2023-12-31");
    expect(result).toMatch(/2023/);
    expect(result).toMatch(/Dec/);
  });
});

describe("getStatusConfig", () => {
  it("returns correct config for 'In Use'", () => {
    const cfg = getStatusConfig("In Use");
    expect(cfg.color).toBe("text-emerald-700");
    expect(cfg.dot).toBe("bg-emerald-500");
    expect(cfg.bg).toBe("bg-emerald-50");
  });

  it("returns correct config for 'In Storage'", () => {
    const cfg = getStatusConfig("In Storage");
    expect(cfg.color).toBe("text-sky-700");
  });

  it("returns correct config for 'Lost'", () => {
    const cfg = getStatusConfig("Lost");
    expect(cfg.color).toBe("text-red-700");
    expect(cfg.dot).toBe("bg-red-400");
  });

  it("returns default fallback config for unknown status", () => {
    const cfg = getStatusConfig("Unknown Status");
    expect(cfg.color).toBe("text-stone-500");
    expect(cfg.dot).toBe("bg-stone-300");
    expect(cfg.bg).toBe("bg-stone-50");
  });

  it("returns default config for undefined", () => {
    const cfg = getStatusConfig(undefined);
    expect(cfg.color).toBe("text-stone-500");
  });

  it("returns objects with required keys for all known statuses", () => {
    const statuses = ["In Use", "In Storage", "Under Repair", "Damaged", "Retired", "Scrapped", "Lost", "Stolen"];
    for (const s of statuses) {
      const cfg = getStatusConfig(s);
      expect(cfg).toHaveProperty("color");
      expect(cfg).toHaveProperty("dot");
      expect(cfg).toHaveProperty("bg");
    }
  });
});

describe("getCategoryIcon", () => {
  it("returns laptop emoji for 'Laptop'", () => {
    expect(getCategoryIcon("Laptop")).toBe("💻");
  });

  it("returns box emoji for unknown category", () => {
    expect(getCategoryIcon("Unknown Category")).toBe("📦");
  });

  it("returns box emoji for undefined", () => {
    expect(getCategoryIcon(undefined)).toBe("📦");
  });

  it("returns printer emoji for 'Printer'", () => {
    expect(getCategoryIcon("Printer")).toBe("🖨️");
  });
});
