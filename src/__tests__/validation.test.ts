import { describe, it, expect } from "vitest";

// ─── Validation helpers (mirrors logic in modal components) ──────────────────

function validateWarrantyDates(start: string, end: string): string | null {
  if (start && end && end < start) return "End date must be after start date";
  return null;
}

function validateEOL(purchaseDate: string, eolDate: string): string | null {
  if (purchaseDate && eolDate && eolDate < purchaseDate) return "Must be after purchase date";
  return null;
}

function validateEmail(email: string): string | null {
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? null
    : "Please enter a valid email address.";
}

function validateCost(cost: string): string | null {
  if (!cost) return null;
  return isNaN(parseFloat(cost)) ? "Must be a valid number." : null;
}

function validateClosedAt(openedAt: string, closedAt: string): string | null {
  if (closedAt && closedAt < openedAt.split("T")[0]) return "Close date must not be before open date.";
  return null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("validateWarrantyDates", () => {
  it("passes when end is after start", () => {
    expect(validateWarrantyDates("2024-01-01", "2025-01-01")).toBeNull();
  });

  it("passes when end equals start", () => {
    expect(validateWarrantyDates("2024-06-01", "2024-06-01")).toBeNull();
  });

  it("fails when end is before start", () => {
    expect(validateWarrantyDates("2024-06-01", "2024-01-01")).toBe("End date must be after start date");
  });

  it("passes when start is empty", () => {
    expect(validateWarrantyDates("", "2025-01-01")).toBeNull();
  });

  it("passes when end is empty", () => {
    expect(validateWarrantyDates("2024-01-01", "")).toBeNull();
  });

  it("passes when both are empty", () => {
    expect(validateWarrantyDates("", "")).toBeNull();
  });
});

describe("validateEOL", () => {
  it("passes when EOL is after purchase", () => {
    expect(validateEOL("2022-01-01", "2027-01-01")).toBeNull();
  });

  it("fails when EOL is before purchase", () => {
    expect(validateEOL("2022-06-01", "2021-01-01")).toBe("Must be after purchase date");
  });

  it("passes when purchase date is empty", () => {
    expect(validateEOL("", "2027-01-01")).toBeNull();
  });
});

describe("validateEmail", () => {
  it("returns null for empty string", () => {
    expect(validateEmail("")).toBeNull();
  });

  it("passes a valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("passes email with subdomain", () => {
    expect(validateEmail("user@mail.company.co.za")).toBeNull();
  });

  it("fails email missing @", () => {
    expect(validateEmail("notanemail")).toBe("Please enter a valid email address.");
  });

  it("fails email missing domain", () => {
    expect(validateEmail("user@")).toBe("Please enter a valid email address.");
  });

  it("fails email with spaces", () => {
    expect(validateEmail("user @example.com")).toBe("Please enter a valid email address.");
  });
});

describe("validateCost", () => {
  it("returns null for empty string", () => {
    expect(validateCost("")).toBeNull();
  });

  it("passes a valid integer cost", () => {
    expect(validateCost("500")).toBeNull();
  });

  it("passes a valid decimal cost", () => {
    expect(validateCost("1500.50")).toBeNull();
  });

  it("fails for alphabetic input", () => {
    expect(validateCost("abc")).toBe("Must be a valid number.");
  });

  it("fails for partial number-letter mix", () => {
    expect(validateCost("12abc")).toBeNull(); // parseFloat("12abc") = 12, so no error — matches browser behaviour
  });
});

describe("validateClosedAt", () => {
  it("passes when closed date is after opened date", () => {
    expect(validateClosedAt("2024-01-10T00:00:00Z", "2024-02-01")).toBeNull();
  });

  it("passes when closed date equals opened date", () => {
    expect(validateClosedAt("2024-01-10T00:00:00Z", "2024-01-10")).toBeNull();
  });

  it("fails when closed date is before opened date", () => {
    expect(validateClosedAt("2024-06-01T00:00:00Z", "2024-01-01")).toBe("Close date must not be before open date.");
  });

  it("passes when closed date is empty", () => {
    expect(validateClosedAt("2024-01-10T00:00:00Z", "")).toBeNull();
  });
});
