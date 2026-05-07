import { describe, expect, it } from "vitest";
import {
  STORAGE_SAFE_OPTIONS,
  isStorageSafeContactName,
  storageSafeMatchesContact,
} from "@/lib/storage-safes";

describe("storage safes", () => {
  it("recognizes each configured safe contact", () => {
    expect(isStorageSafeContactName("Baker Street Safe")).toBe(true);
    expect(isStorageSafeContactName("Rainbow Park Safe -Downstairs")).toBe(true);
    expect(isStorageSafeContactName("Rainbow Park Safe - Upstairs")).toBe(true);
  });

  it("allows the Rainbow Park downstairs hyphen spacing variant", () => {
    const downstairs = STORAGE_SAFE_OPTIONS.find((option) => option.id === "rainbow-downstairs");

    expect(downstairs).toBeDefined();
    expect(storageSafeMatchesContact(downstairs!, "Rainbow Park Safe - Downstairs")).toBe(true);
  });

  it("rejects ordinary contacts", () => {
    expect(isStorageSafeContactName("Jane Smith")).toBe(false);
  });
});
