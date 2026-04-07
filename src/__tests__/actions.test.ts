import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock next/cache ─────────────────────────────────────────────────────────
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ─── Hoisted mock state ───────────────────────────────────────────────────────
// vi.mock factories are hoisted, so we use vi.hoisted for shared state
const { mockInsertAsset, mockInsertAudit, mockUpdateAsset, mockSingle, mockFrom } = vi.hoisted(() => {
  const mockInsertAsset = vi.fn().mockResolvedValue({ error: null });
  const mockInsertAudit = vi.fn().mockResolvedValue({ error: null });
  const mockUpdateAsset = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const mockSingle = vi.fn().mockResolvedValue({ data: { asset_code: 42 }, error: null });

  const mockFrom = vi.fn((table: string) => {
    if (table === "assets") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ single: mockSingle }),
          }),
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
        insert: mockInsertAsset,
        update: mockUpdateAsset,
      };
    }
    if (table === "asset_audit_log") {
      return { insert: mockInsertAudit };
    }
    if (table === "asset_status_history") {
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }
    // contacts and other tables
    return { insert: vi.fn().mockResolvedValue({ error: null }) };
  });

  return { mockInsertAsset, mockInsertAudit, mockUpdateAsset, mockSingle, mockFrom };
});

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "admin@test.com",
            user_metadata: { role: "admin", full_name: "Admin User" },
          },
        },
      }),
    },
    from: mockFrom,
  }),
}));

// ─── Import actions AFTER mocks ───────────────────────────────────────────────
import { createAsset, updateAsset, createContact } from "@/lib/actions";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createAsset", () => {
  beforeEach(() => {
    mockInsertAsset.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({ data: { asset_code: 42 }, error: null });
  });

  it("returns success when all required fields are provided", async () => {
    const result = await createAsset({
      description: "Dell XPS 15",
      category_id: "cat-1",
      status_id: "status-1",
    });
    expect(result).toEqual({ success: true });
  });

  it("returns error when Supabase insert fails", async () => {
    mockInsertAsset.mockResolvedValueOnce({ error: { message: "duplicate key value" } });
    const result = await createAsset({
      description: "Dell XPS 15",
      category_id: "cat-1",
      status_id: "status-1",
    });
    expect(result).toEqual({ error: "duplicate key value" });
  });
});

describe("updateAsset", () => {
  beforeEach(() => {
    mockSingle.mockResolvedValue({
      data: { id: "asset-1", description: "Old Description", category_id: "cat-1" },
      error: null,
    });
    mockUpdateAsset.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("returns success on a valid update", async () => {
    const result = await updateAsset("asset-1", { description: "New Description" });
    expect(result).toEqual({ success: true });
  });

  it("returns error when update fails", async () => {
    mockUpdateAsset.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({ error: { message: "update failed" } }),
    });
    const result = await updateAsset("asset-1", { description: "New Description" });
    expect(result).toEqual({ error: "update failed" });
  });
});

describe("createContact", () => {
  it("returns success for a valid contact", async () => {
    const result = await createContact({ full_name: "Jane Smith" });
    expect(result).toEqual({ success: true });
  });
});
