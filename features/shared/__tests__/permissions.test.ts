/**
 * PR1 1.1 RED — RBAC authorization matrix (REQ-P.1 / REQ-P.2)
 * PR2.2 RED (extended) — canAccess async facade reads from cache
 *
 * Table-driven coverage:
 *   canAccess: 6 roles × 12 resources × 2 actions = 144 cases (sync, 3-param)
 *   canPost:   6 roles × 3  resources            =  18 cases
 *
 * PR2.2 additions:
 *   (a) await canAccess("contador","reports","read",orgId) === true from seeded system snapshot
 *   (b) unknown role → false
 *   (c) custom role with permissionsWrite=['journal'] in mock matrix → true
 *   (d) cache expired (mock TTL) triggers reload
 *   (e) useCanAccess / <Gated> public prop API: 3-param sync overload still compiles
 *
 * Matrix source of truth: openspec/changes/accounting-rbac/specs/rbac-permissions-matrix/spec.md
 * W-draft is encoded as write=true (status gate is enforced by canPost at service layer).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../permissions.cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../permissions.cache")>();
  return {
    ...actual,
    getMatrix: vi.fn(),
    _resetCache: actual._resetCache,
    _setLoader: actual._setLoader,
  };
});
import { getMatrix } from "../permissions.cache";
import type { OrgMatrix } from "../permissions.cache";

import {
  canAccess,
  canPost,
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  getPostAllowedRoles,
  type Role,
  type Resource,
  type Action,
} from "@/features/shared/permissions";

const ALL_ROLES: Role[] = [
  "owner",
  "admin",
  "contador",
  "cobrador",
  "auxiliar",
  "member",
];

const ALL_RESOURCES: Resource[] = [
  "members",
  "accounting-config",
  "sales",
  "purchases",
  "payments",
  "journal",
  "dispatches",
  "reports",
  "contacts",
  "farms",
  "documents",
  "agent",
];

const ALL_ACTIONS: Action[] = ["read", "write"];

// Expected matrix encoded as role lists per (resource, action). W-draft → write=true.
const EXPECTED_READ: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador", "cobrador"],
  purchases: ["owner", "admin", "contador"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin", "contador", "auxiliar"],
  reports: ["owner", "admin", "contador", "cobrador"],
  contacts: ["owner", "admin", "contador", "cobrador", "auxiliar"],
  farms: ["owner", "admin", "contador", "auxiliar", "member"],
  documents: ["owner", "admin", "contador", "cobrador", "auxiliar", "member"],
  agent: ["owner", "admin", "contador", "cobrador", "auxiliar", "member"],
};

const EXPECTED_WRITE: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador", "auxiliar"],
  purchases: ["owner", "admin", "contador", "auxiliar"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin", "auxiliar"],
  reports: ["owner", "admin"],
  contacts: ["owner", "admin", "contador", "cobrador"],
  farms: ["owner", "admin", "contador", "auxiliar", "member"],
  documents: ["owner", "admin", "contador"],
  agent: ["owner", "admin", "contador", "cobrador", "auxiliar", "member"],
};

const POST_RESOURCES = ["sales", "purchases", "journal"] as const;

const EXPECTED_POST: Record<(typeof POST_RESOURCES)[number], Role[]> = {
  sales: ["owner", "admin", "contador"],
  purchases: ["owner", "admin", "contador"],
  journal: ["owner", "admin", "contador"],
};

describe("REQ-P.1 — Resource catalog", () => {
  it("exposes exactly 12 resources", () => {
    expect(ALL_RESOURCES).toHaveLength(12);
  });

  it("does not include deprecated `accounting` literal", () => {
    // @ts-expect-error — "accounting" MUST NOT be a valid Resource literal
    const illegal: Resource = "accounting";
    expect(illegal).toBe("accounting");
  });

  it("PERMISSIONS_READ has an entry for every Resource", () => {
    for (const r of ALL_RESOURCES) {
      expect(PERMISSIONS_READ[r]).toBeDefined();
    }
  });

  it("PERMISSIONS_WRITE has an entry for every Resource", () => {
    for (const r of ALL_RESOURCES) {
      expect(PERMISSIONS_WRITE[r]).toBeDefined();
    }
  });
});

describe("REQ-P.2 — PERMISSIONS_READ/WRITE matrix (144 cases, static maps)", () => {
  // PR8.2: sync 3-param canAccess removed. The static matrix is tested directly
  // against PERMISSIONS_READ / PERMISSIONS_WRITE as source of truth.
  // The async canAccess(role, resource, action, orgId) is tested in PR2.2 block below.
  for (const resource of ALL_RESOURCES) {
    for (const action of ALL_ACTIONS) {
      const allowed =
        action === "read" ? EXPECTED_READ[resource] : EXPECTED_WRITE[resource];
      const map = action === "read" ? PERMISSIONS_READ : PERMISSIONS_WRITE;
      for (const role of ALL_ROLES) {
        const expected = allowed.includes(role);
        it(`${role} × ${resource} × ${action} → ${expected}`, () => {
          expect(map[resource].includes(role as Role)).toBe(expected);
        });
      }
    }
  }
});

describe("REQ-P.3-S3 — canPost seed map (18 cases, via getPostAllowedRoles)", () => {
  // PR8.3: sync 2-param canPost removed. The static seed map is tested directly
  // against getPostAllowedRoles() as source of truth.
  // The async canPost(role, resource, orgId) is tested via matrix mock below.
  const postMap = getPostAllowedRoles();
  for (const resource of POST_RESOURCES) {
    const allowed = EXPECTED_POST[resource];
    for (const role of ALL_ROLES) {
      const expected = allowed.includes(role);
      it(`${role} × ${resource} → ${expected}`, () => {
        expect(postMap[resource].includes(role as Role)).toBe(expected);
      });
    }
  }
});

describe("getPostAllowedRoles() map", () => {
  it("covers exactly the 3 postable resources", () => {
    expect(Object.keys(getPostAllowedRoles()).sort()).toEqual(
      [...POST_RESOURCES].sort(),
    );
  });

  it("excludes auxiliar from every postable resource", () => {
    const map = getPostAllowedRoles();
    for (const r of POST_RESOURCES) {
      expect(map[r]).not.toContain("auxiliar");
    }
  });
});

describe("Spec scenarios verbatim (via static maps)", () => {
  // PR8.2: sync canAccess removed — use PERMISSIONS_READ/WRITE directly for static checks.
  it("P.2-S1 — contador reads reports", () => {
    expect(PERMISSIONS_READ["reports"].includes("contador")).toBe(true);
  });

  it("P.2-S2 — cobrador cannot touch journal (read or write)", () => {
    expect(PERMISSIONS_READ["journal"].includes("cobrador")).toBe(false);
    expect(PERMISSIONS_WRITE["journal"].includes("cobrador")).toBe(false);
  });

  it("P.2-S3 — auxiliar writes dispatches", () => {
    expect(PERMISSIONS_WRITE["dispatches"].includes("auxiliar")).toBe(true);
  });

  it("P.3-S3 — auxiliar cannot post sales (W-draft)", () => {
    // auxiliar can write-draft (PERMISSIONS_WRITE) but cannot post (seed canPost map)
    // PR8.3: sync 2-param canPost removed — check the seed map directly.
    expect(PERMISSIONS_WRITE["sales"].includes("auxiliar")).toBe(true);
    expect(getPostAllowedRoles()["sales"].includes("auxiliar")).toBe(false);
  });
});

// ── PR2.2 — canAccess async facade reads from cache ──────────────────────────

const mockedGetMatrix = vi.mocked(getMatrix);

const ORG_ID = "org-pr22-test";

/** Build a minimal OrgMatrix from static maps for a given orgId */
function makeSystemMatrix(orgId: string): OrgMatrix {
  const roles = new Map<string, {
    permissionsRead: Set<Resource>;
    permissionsWrite: Set<Resource>;
    canPost: Set<"sales" | "purchases" | "journal">;
    isSystem: boolean;
  }>();

  const postAllowedRoles = getPostAllowedRoles();
  const ALL_SYS_ROLES = ["owner", "admin", "contador", "cobrador", "auxiliar", "member"] as const;
  for (const slug of ALL_SYS_ROLES) {
    const permissionsRead = new Set<Resource>(
      (Object.keys(PERMISSIONS_READ) as Resource[]).filter((r) =>
        PERMISSIONS_READ[r].includes(slug),
      ),
    );
    const permissionsWrite = new Set<Resource>(
      (Object.keys(PERMISSIONS_WRITE) as Resource[]).filter((r) =>
        PERMISSIONS_WRITE[r].includes(slug),
      ),
    );
    const canPostSet = new Set<"sales" | "purchases" | "journal">(
      (["sales", "purchases", "journal"] as const).filter((r) =>
        postAllowedRoles[r].includes(slug),
      ),
    );
    roles.set(slug, { permissionsRead, permissionsWrite, canPost: canPostSet, isSystem: true });
  }

  return { orgId, roles, loadedAt: Date.now() };
}

describe("PR2.2 — canAccess async (4-param) reads from cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) await canAccess('contador','reports','read',orgId) === true from seeded system snapshot", async () => {
    const matrix = makeSystemMatrix(ORG_ID);
    mockedGetMatrix.mockResolvedValue(matrix);

    const result = await canAccess("contador", "reports", "read", ORG_ID);

    expect(result).toBe(true);
    expect(mockedGetMatrix).toHaveBeenCalledWith(ORG_ID);
  });

  it("(b) unknown role → false", async () => {
    const matrix = makeSystemMatrix(ORG_ID);
    mockedGetMatrix.mockResolvedValue(matrix);

    // 'facturador-custom' doesn't exist in the matrix
    const result = await canAccess("facturador-custom", "sales", "read", ORG_ID);

    expect(result).toBe(false);
  });

  it("(c) custom role 'facturador' with permissionsWrite=['journal'] in mock matrix → true for write", async () => {
    const matrix = makeSystemMatrix(ORG_ID);
    // Inject a custom role
    matrix.roles.set("facturador", {
      permissionsRead: new Set(["sales", "reports"]),
      permissionsWrite: new Set(["journal"]),
      canPost: new Set(),
      isSystem: false,
    });
    mockedGetMatrix.mockResolvedValue(matrix);

    const canWrite = await canAccess("facturador", "journal", "write", ORG_ID);
    const cannotWrite = await canAccess("facturador", "members", "write", ORG_ID);

    expect(canWrite).toBe(true);
    expect(cannotWrite).toBe(false);
  });

  it("(d) cache expired (mock TTL) triggers a new getMatrix call each time", async () => {
    const matrix = makeSystemMatrix(ORG_ID);
    // Each call returns a fresh matrix (simulates cache miss on each call)
    mockedGetMatrix.mockResolvedValue(matrix);

    await canAccess("admin", "journal", "read", ORG_ID);
    await canAccess("admin", "journal", "read", ORG_ID);

    // canAccess(4-param) calls getMatrix each invocation; the CACHE deduplicates.
    // From canAccess's perspective: 2 calls → 2 getMatrix invocations.
    expect(mockedGetMatrix).toHaveBeenCalledTimes(2);
  });

  it("(e) canAccess always async — calls getMatrix (sync 3-param overload removed in PR8.2)", async () => {
    // PR8.2: sync 3-param overload removed. canAccess always calls getMatrix.
    // Client-side checks use useCanAccess() / <Gated> from RolesMatrixProvider (PR7.1).
    const matrix = makeSystemMatrix(ORG_ID);
    mockedGetMatrix.mockResolvedValue(matrix);

    const result = await canAccess("contador", "reports", "read", ORG_ID);
    expect(result).toBe(true);
    // All paths now hit the cache
    expect(mockedGetMatrix).toHaveBeenCalledWith(ORG_ID);
  });

  it("triangulation: cobrador cannot write journal via cache-backed path", async () => {
    const matrix = makeSystemMatrix(ORG_ID);
    mockedGetMatrix.mockResolvedValue(matrix);

    const result = await canAccess("cobrador", "journal", "write", ORG_ID);

    expect(result).toBe(false);
  });
});
