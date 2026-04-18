/**
 * Smoke test for permissions module export contract.
 *
 * (1) canAccess and canPost are NOT exported from permissions.ts (client-safe module)
 * (2) canAccess and canPost ARE exported from permissions.server.ts (server-only)
 * (3) POST_ALLOWED_ROLES is NOT exported from permissions.ts (dead export removed in PR8.2)
 * (4) Async signature assertions for canAccess and canPost from permissions.server
 *
 * PR8.2 / PR8.3 history preserved in comment:
 *   - sync 3-param canAccess removed (PR8.2)
 *   - sync 2-param canPost removed (PR8.3)
 *   - async facades moved to permissions.server.ts to fix client-bundle dns/pg leak
 */
import { describe, it, expect } from "vitest";

describe("permissions.ts — client-safe module (no server deps)", () => {
  it("canAccess is NOT exported from permissions.ts", async () => {
    const mod = await import("@/features/shared/permissions") as Record<string, unknown>;
    expect(mod["canAccess"]).toBeUndefined();
  });

  it("canPost is NOT exported from permissions.ts", async () => {
    const mod = await import("@/features/shared/permissions") as Record<string, unknown>;
    expect(mod["canPost"]).toBeUndefined();
  });

  it("POST_ALLOWED_ROLES is NOT exported (dead export removed in PR8.2)", async () => {
    const mod = await import("@/features/shared/permissions") as Record<string, unknown>;
    expect(mod["POST_ALLOWED_ROLES"]).toBeUndefined();
  });

  it("SYSTEM_ROLES is exported and is a non-empty array", async () => {
    const { SYSTEM_ROLES } = await import("@/features/shared/permissions");
    expect(Array.isArray(SYSTEM_ROLES)).toBe(true);
    expect(SYSTEM_ROLES.length).toBeGreaterThan(0);
  });
});

describe("permissions.server.ts — async facades now server-only", () => {
  it("canAccess is exported and callable", async () => {
    const mod = await import("@/features/shared/permissions.server");
    expect(typeof mod.canAccess).toBe("function");
  });

  it("canPost is exported and callable", async () => {
    const mod = await import("@/features/shared/permissions.server");
    expect(typeof mod.canPost).toBe("function");
  });

  it("canAccess returns a Promise (async 4-param signature)", async () => {
    // We cannot call canAccess for real without a DB, but we can assert it returns
    // a Promise (getMatrix will throw with no mock — we just care about the type contract).
    const { canAccess } = await import("@/features/shared/permissions.server");
    // canAccess without a mocked getMatrix will reject, but the return IS a Promise.
    const result = canAccess("owner", "sales", "read", "any-org");
    expect(result).toBeInstanceOf(Promise);
    // Swallow the rejection so the test doesn't fail on missing DB.
    await result.catch(() => {});
  });

  it("canPost returns a Promise (async 3-param signature)", async () => {
    const { canPost } = await import("@/features/shared/permissions.server");
    const result = canPost("owner", "sales", "any-org");
    expect(result).toBeInstanceOf(Promise);
    await result.catch(() => {});
  });
});
