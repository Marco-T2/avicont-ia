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
import { describe, it, expect, vi } from "vitest";

// Bucket B fix: el import-chain `permissions.server → composition-root → repos →
// lib/prisma` instancia `new PrismaPg + new PrismaClient` en module-eval, lo cual
// colgaba el `await import` bajo carga de workers (flaky 5s timeout en suite full).
// Mockeamos TODA la cadena pesada con stubs estáticos (sin importOriginal para
// no cargar los módulos reales):
//   - @/lib/prisma → vacío (no pool pg)
//   - permissions.cache → stubs estáticos (sin importOriginal que cargue el real)
//   - composition-root organizations → factories vacíos (no Prisma repos)
//   - @clerk/nextjs/server → auth stub (no clerk SDK init)
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));
vi.mock("@/modules/permissions/infrastructure/permissions.cache", () => ({
  getMatrix: vi.fn().mockRejectedValue(new Error("no-db-in-test")),
  ensureOrgSeeded: vi.fn().mockRejectedValue(new Error("no-db-in-test")),
  _setLoader: vi.fn(),
  _resetCache: vi.fn(),
  revalidateOrgMatrix: vi.fn(),
}));
vi.mock("@/modules/organizations/presentation/composition-root", () => ({
  makeOrganizationsService: () => ({}),
  makeMembersService: () => ({}),
  makeRolesService: () => ({}),
  makeReadOnlyRolesService: () => ({}),
  makeEnsureFromClerkService: () => ({ ensure: async () => undefined }),
  __resetEnsureFromClerkForTesting: () => undefined,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "test-user", orgId: "test-org" })),
}));

describe("permissions.ts — client-safe module (no server deps)", () => {
  it("canAccess is NOT exported from permissions.ts", async () => {
    const mod = await import("../permissions") as Record<string, unknown>;
    expect(mod["canAccess"]).toBeUndefined();
  });

  it("canPost is NOT exported from permissions.ts", async () => {
    const mod = await import("../permissions") as Record<string, unknown>;
    expect(mod["canPost"]).toBeUndefined();
  });

  it("POST_ALLOWED_ROLES is NOT exported (dead export removed in PR8.2)", async () => {
    const mod = await import("../permissions") as Record<string, unknown>;
    expect(mod["POST_ALLOWED_ROLES"]).toBeUndefined();
  });

  it("SYSTEM_ROLES is exported and is a non-empty array", async () => {
    const { SYSTEM_ROLES } = await import("../permissions");
    expect(Array.isArray(SYSTEM_ROLES)).toBe(true);
    expect(SYSTEM_ROLES.length).toBeGreaterThan(0);
  });
});

describe("permissions.server.ts — async facades now server-only", () => {
  it("canAccess is exported and callable", async () => {
    const mod = await import("@/features/permissions/permissions.server");
    expect(typeof mod.canAccess).toBe("function");
  });

  it("canPost is exported and callable", async () => {
    const mod = await import("@/features/permissions/permissions.server");
    expect(typeof mod.canPost).toBe("function");
  });

  it("canAccess returns a Promise (async 4-param signature)", async () => {
    // We cannot call canAccess for real without a DB, but we can assert it returns
    // a Promise (getMatrix will throw with no mock — we just care about the type contract).
    const { canAccess } = await import("@/features/permissions/permissions.server");
    // canAccess without a mocked getMatrix will reject, but the return IS a Promise.
    const result = canAccess("owner", "sales", "read", "any-org");
    expect(result).toBeInstanceOf(Promise);
    // Swallow the rejection so the test doesn't fail on missing DB.
    await result.catch(() => {});
  });

  it("canPost returns a Promise (async 3-param signature)", async () => {
    const { canPost } = await import("@/features/permissions/permissions.server");
    const result = canPost("owner", "sales", "any-org");
    expect(result).toBeInstanceOf(Promise);
    await result.catch(() => {});
  });
});
