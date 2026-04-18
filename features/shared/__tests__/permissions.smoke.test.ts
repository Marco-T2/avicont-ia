/**
 * PR8.2 RED → GREEN — Smoke test for export contract cleanup
 *
 * (1) canAccess, requirePermission, canPost are still exported
 * (2) POST_ALLOWED_ROLES is NOT exported (dead export removed)
 * (3) The only exported canAccess is the async 4-param overload + the
 *     sync 3-param overload — but after PR8.2 the sync 3-param overload
 *     MUST be removed. We assert it by calling canAccess with 3 args
 *     and expecting the result to NOT be a boolean (since after removal
 *     the sync overload is gone). However, because TypeScript overloads
 *     share a runtime implementation, we instead check the module export
 *     via a dynamic import and confirm only the async signature is present.
 *
 * Note on POST_ALLOWED_ROLES assertion:
 *   We use a dynamic import to read the real module exports at runtime.
 *   TypeScript typing does NOT constrain dynamic import results fully,
 *   so this is a runtime check — if the key exists on the module object,
 *   the export is still present (FAIL). If undefined, it's gone (PASS).
 */
import { describe, it, expect } from "vitest";

describe("PR8.2 — permissions.ts export contract", () => {
  it("canAccess is exported and callable", async () => {
    const mod = await import("@/features/shared/permissions");
    expect(typeof mod.canAccess).toBe("function");
  });

  it("canPost is exported and callable", async () => {
    const mod = await import("@/features/shared/permissions");
    expect(typeof mod.canPost).toBe("function");
  });

  it("POST_ALLOWED_ROLES is NOT exported (dead export removed)", async () => {
    const mod = await import("@/features/shared/permissions") as Record<string, unknown>;
    expect(mod["POST_ALLOWED_ROLES"]).toBeUndefined();
  });

  it("sync 3-param canAccess does NOT return a plain boolean", async () => {
    // After PR8.2, calling canAccess with 3 args should return a Promise
    // (only the async 4-param overload remains — the sync path is removed).
    const { canAccess } = await import("@/features/shared/permissions");
    // @ts-expect-error — 3-param call is removed; TS overload is gone
    const result = canAccess("owner", "sales", "read");
    // After sync overload removal, the implementation always takes the async path
    // (orgId is undefined → the sync path no longer compiles, but at runtime
    // we want to assert the behavior changed — no more boolean, just Promise).
    // Since we cannot easily test arity at runtime, we assert result is a Promise.
    expect(result).toBeInstanceOf(Promise);
  });
});
