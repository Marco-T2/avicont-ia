/**
 * PR5.3 — End-to-end integration test for the self-lock bridge.
 *
 * Scope: verify that the WIRING between the route handler and the REAL
 * `RolesService` instance delivers the caller's role slug to the D.4 self-lock
 * check. PR5.2 case (d) only mocked the service layer — it proved the HTTP
 * taxonomy but NOT that the route-local closure actually populates the
 * per-request Map that the service reads via its `getCallerRoleSlug` DI slot.
 *
 * Design under test (route.ts):
 *   - Module-scope `callerRoleSlugByPair = new Map<"orgId::clerkUserId", slug>`.
 *   - PATCH handler sets `callerRoleSlugByPair.set(key, callerRole)` BEFORE
 *     calling `service.updateRole`, and deletes it in `finally`.
 *   - The singleton `RolesService` was constructed with a closure that reads
 *     from that Map: `getCallerRoleSlug: async (orgId, caller) =>
 *       callerRoleSlugByPair.get(pairKey(orgId, caller.clerkUserId)) ?? null`.
 *
 * Strategy:
 *   - Mock `@/features/organizations` ONLY for `RolesRepository` (NOT the
 *     service). This forces the REAL `RolesService` to be constructed with a
 *     fake repo AND the REAL route-local closure.
 *   - Mock `requirePermission` so auth passes and returns the caller context.
 *   - Mock `seedOrgSystemRoles` to no-op (defensive — in case permissions
 *     middleware is invoked elsewhere).
 *   - Trigger PATCH via the REAL handler. Assert:
 *       (1) 403 SELF_LOCK_GUARD when caller patches OWN role dropping
 *           "members" from permissionsWrite.
 *       (2) 200 when the same patch keeps "members" — proves the bridge does
 *           NOT falsely fire for legitimate edits.
 *   - Spy on the fake repo's `findBySlug` to prove the REAL service algorithm
 *     ran (the guard path reads the target role).
 *
 * If the bridge were broken (e.g. Map never populated, closure reads wrong
 * key), case (1) would return 200 and the test would fail — exposing a silent
 * lockout risk.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── Module mocks (hoisted) ─────────────────────────────────────────────────

// `handleError` passthrough (same behavior as PR5.2 test) so AppError → 403.
vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json(
        { error: "Datos inválidos", details: (err as { flatten: () => unknown }).flatten() },
        { status: 400 },
      );
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

// Shared mutable state for the fake repo — reassigned in beforeEach.
type FakeRoleRow = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
  createdAt: Date;
  updatedAt: Date;
};

const fakeRepoState: {
  rolesByOrg: FakeRoleRow[];
  findBySlug: Mock<(orgId: string, slug: string) => Promise<FakeRoleRow | null>>;
  update: Mock<(orgId: string, id: string, patch: Partial<FakeRoleRow>) => Promise<FakeRoleRow>>;
  findAllByOrg: Mock<(orgId: string) => Promise<FakeRoleRow[]>>;
  create: Mock<(data: Partial<FakeRoleRow>) => Promise<FakeRoleRow>>;
  delete: Mock<(orgId: string, id: string) => Promise<FakeRoleRow>>;
  countMembers: Mock<(slug: string, orgId: string) => Promise<number>>;
} = {
  rolesByOrg: [],
  findBySlug: vi.fn(),
  update: vi.fn(),
  findAllByOrg: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  countMembers: vi.fn(),
};

// CRITICAL: mock ONLY the repository. Leave `RolesService` as the REAL class so
// the route module constructs the REAL service with the REAL closure.
vi.mock("@/features/organizations/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/organizations/server")>();
  return {
    ...actual,
    // Keep RolesService = the REAL class
    RolesRepository: vi.fn().mockImplementation(function () {
      return {
        findAllByOrg: (orgId: string) => fakeRepoState.findAllByOrg(orgId),
        findBySlug: (orgId: string, slug: string) =>
          fakeRepoState.findBySlug(orgId, slug),
        create: (data: Partial<FakeRoleRow>) => fakeRepoState.create(data),
        update: (orgId: string, id: string, patch: Partial<FakeRoleRow>) =>
          fakeRepoState.update(orgId, id, patch),
        delete: (orgId: string, id: string) => fakeRepoState.delete(orgId, id),
        countMembers: (slug: string, orgId: string) =>
          fakeRepoState.countMembers(slug, orgId),
      };
    }),
  };
});

vi.mock("@/features/shared/permissions.cache", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/shared/permissions.cache")>();
  return {
    ...actual,
    revalidateOrgMatrix: vi.fn(),
    getMatrix: vi.fn(),
  };
});

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi.fn(),
}));

// ─── Imports (AFTER mocks) ──────────────────────────────────────────────────

import { requirePermission } from "@/features/shared/permissions.server";
import { SELF_LOCK_GUARD } from "@/features/shared/errors";

// ─── Constants ──────────────────────────────────────────────────────────────

const ORG_SLUG = "acme";
const ORG_ID = "org_1";
const CLERK_USER_ID = "clerk_u_1";
const CALLER_ROLE_SLUG = "org_admin";

function makeFakeRole(
  overrides: Partial<FakeRoleRow> & Pick<FakeRoleRow, "slug">,
): FakeRoleRow {
  return {
    id: `r-${overrides.slug}`,
    organizationId: ORG_ID,
    name: overrides.slug,
    description: null,
    isSystem: false,
    permissionsRead: [],
    permissionsWrite: [],
    canPost: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default callable org_admin custom role carrying members.write.
  fakeRepoState.rolesByOrg = [
    makeFakeRole({
      slug: CALLER_ROLE_SLUG,
      isSystem: false,
      permissionsWrite: ["members", "sales", "reports"],
    }),
  ];

  fakeRepoState.findBySlug.mockImplementation(
    async (_orgId: string, slug: string) =>
      fakeRepoState.rolesByOrg.find((r) => r.slug === slug) ?? null,
  );
  fakeRepoState.findAllByOrg.mockImplementation(async () =>
    fakeRepoState.rolesByOrg,
  );
  fakeRepoState.update.mockImplementation(
    async (_orgId: string, id: string, patch: Partial<FakeRoleRow>) => {
      const existing = fakeRepoState.rolesByOrg.find((r) => r.id === id);
      if (!existing) throw new Error("fake repo: role not found " + id);
      return { ...existing, ...patch };
    },
  );
  fakeRepoState.countMembers.mockResolvedValue(0);
  fakeRepoState.create.mockImplementation(async (data: Partial<FakeRoleRow>) =>
    makeFakeRole({ slug: data.slug ?? "new", ...data }),
  );
  fakeRepoState.delete.mockImplementation(async (_orgId: string, id: string) =>
    makeFakeRole({ id, slug: "deleted" }),
  );

  // Auth passes and returns the caller's current role slug — this is the VALUE
  // the route handler stashes into the Map BEFORE calling the service.
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: CALLER_ROLE_SLUG,
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PR5.3 — PATCH roles/[roleSlug] self-lock E2E (real service + route closure)", () => {
  it(
    "(α) fires SELF_LOCK_GUARD end-to-end when caller patches OWN role and strips members.write",
    async () => {
      const { PATCH } = await import("../route");

      const request = new Request(
        `http://localhost/api/organizations/${ORG_SLUG}/roles/${CALLER_ROLE_SLUG}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissionsWrite: ["sales", "reports"] }),
        },
      );

      const res = await PATCH(request, {
        params: Promise.resolve({
          orgSlug: ORG_SLUG,
          roleSlug: CALLER_ROLE_SLUG,
        }),
      });

      // PROOF of wiring: the REAL service algorithm ran — it must have loaded
      // the target role via the repo to evaluate the guard.
      expect(fakeRepoState.findBySlug).toHaveBeenCalledWith(
        ORG_ID,
        CALLER_ROLE_SLUG,
      );

      // The HTTP layer delivered the service's error to the client with the
      // correct taxonomy — proves the CLOSURE returned the caller's slug.
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe(SELF_LOCK_GUARD);

      // The update MUST NOT have been committed (guard fired before write).
      expect(fakeRepoState.update).not.toHaveBeenCalled();
    },
  );

  it(
    "(β) permits the PATCH (200) when caller patches OWN role but KEEPS members.write",
    async () => {
      const { PATCH } = await import("../route");

      const request = new Request(
        `http://localhost/api/organizations/${ORG_SLUG}/roles/${CALLER_ROLE_SLUG}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            permissionsWrite: ["members", "sales"],
          }),
        },
      );

      const res = await PATCH(request, {
        params: Promise.resolve({
          orgSlug: ORG_SLUG,
          roleSlug: CALLER_ROLE_SLUG,
        }),
      });

      // Guard did NOT fire — the update reached the repository.
      expect(res.status).toBe(200);
      expect(fakeRepoState.update).toHaveBeenCalledTimes(1);

      // And specifically with the post-normalized members-preserving payload.
      const [, , patch] = fakeRepoState.update.mock.calls[0] as [
        string,
        string,
        { permissionsWrite: string[] },
      ];
      expect(patch.permissionsWrite).toEqual(["members", "sales"]);
    },
  );
});
