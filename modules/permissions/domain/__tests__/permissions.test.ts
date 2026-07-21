/**
 * PR1 1.1 RED — RBAC authorization matrix (REQ-P.1 / REQ-P.2)
 *
 * Table-driven coverage over the STATIC permission maps (pure domain — no
 * mocks, no cache, no application imports).
 *
 * The PR2.2 cache-backed canAccess blocks (mocking
 * infrastructure/permissions.cache) were RELOCATED to
 * modules/permissions/application/__tests__/require-permission.test.ts
 * (hex R1 paydown) — that file already mocks the same cache deps.
 *
 * Matrix source of truth: openspec/changes/accounting-rbac/specs/rbac-permissions-matrix/spec.md
 * W-draft is encoded as write=true (status gate is enforced by canPost at service layer).
 */
import { describe, it, expect } from "vitest";

import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  PERMISSIONS_CLOSE,
  PERMISSIONS_REOPEN,
  getPostAllowedRoles,
  type Role,
  type Resource,
  type Action,
} from "../permissions";

const ALL_ROLES: Role[] = [
  "owner",
  "admin",
  "contador",
  "cobrador",
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
  "period",
  "audit",
  "financial-statements",
];

const ALL_ACTIONS: Action[] = ["read", "write", "close", "reopen"];

// Expected matrix encoded as role lists per (resource, action). W-draft → write=true.
const EXPECTED_READ: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador", "cobrador"],
  purchases: ["owner", "admin", "contador"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin", "contador"],
  reports: ["owner", "admin", "contador", "cobrador"],
  contacts: ["owner", "admin", "contador", "cobrador"],
  farms: ["owner", "admin", "contador", "member"],
  documents: ["owner", "admin", "contador", "cobrador", "member"],
  agent: ["owner", "admin", "contador", "cobrador", "member"],
  period: ["owner", "admin"],
  audit: ["owner", "admin"],
  "financial-statements": ["owner", "admin", "contador"],
};

const EXPECTED_WRITE: Record<Resource, Role[]> = {
  members: ["owner", "admin"],
  "accounting-config": ["owner", "admin"],
  sales: ["owner", "admin", "contador"],
  purchases: ["owner", "admin", "contador"],
  payments: ["owner", "admin", "contador", "cobrador"],
  journal: ["owner", "admin", "contador"],
  dispatches: ["owner", "admin"],
  reports: ["owner", "admin"],
  contacts: ["owner", "admin", "contador", "cobrador"],
  farms: ["owner", "admin", "contador", "member"],
  documents: ["owner", "admin", "contador"],
  agent: ["owner", "admin", "contador", "cobrador", "member"],
  period: ["owner", "admin"],
  audit: [],
  "financial-statements": [],
};

const POST_RESOURCES = ["sales", "purchases", "journal"] as const;

const EXPECTED_POST: Record<(typeof POST_RESOURCES)[number], Role[]> = {
  sales: ["owner", "admin", "contador"],
  purchases: ["owner", "admin", "contador"],
  journal: ["owner", "admin", "contador"],
};

describe("REQ-P.1 — Resource catalog", () => {
  it("exposes exactly 15 resources (12 original + period + audit + financial-statements)", () => {
    expect(ALL_RESOURCES).toHaveLength(15);
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

  it("PERMISSIONS_CLOSE has an entry for every Resource", () => {
    for (const r of ALL_RESOURCES) {
      expect(PERMISSIONS_CLOSE[r]).toBeDefined();
    }
  });

  it("PERMISSIONS_REOPEN has an entry for every Resource", () => {
    for (const r of ALL_RESOURCES) {
      expect(PERMISSIONS_REOPEN[r]).toBeDefined();
    }
  });
});

const EXPECTED_CLOSE: Record<Resource, Role[]> = {
  members: [],
  "accounting-config": [],
  sales: [],
  purchases: [],
  payments: [],
  journal: [],
  dispatches: [],
  reports: [],
  contacts: [],
  farms: [],
  documents: [],
  agent: [],
  period: ["owner", "admin"],
  audit: [],
  "financial-statements": [],
};

const EXPECTED_REOPEN: Record<Resource, Role[]> = {
  members: [],
  "accounting-config": [],
  sales: [],
  purchases: [],
  payments: [],
  journal: [],
  dispatches: [],
  reports: [],
  contacts: [],
  farms: [],
  documents: [],
  agent: [],
  period: ["owner", "admin"],
  audit: [],
  "financial-statements": [],
};

describe("REQ-P.2 — PERMISSIONS_READ/WRITE/CLOSE/REOPEN matrix (static maps)", () => {
  // PR8.2: sync 3-param canAccess removed. The static matrix is tested directly
  // against the permission maps as source of truth.
  // The async canAccess(role, resource, action, orgId) is tested in PR2.2 block below.
  for (const resource of ALL_RESOURCES) {
    for (const action of ALL_ACTIONS) {
      const { allowed, map } = (() => {
        switch (action) {
          case "read":   return { allowed: EXPECTED_READ[resource],   map: PERMISSIONS_READ };
          case "write":  return { allowed: EXPECTED_WRITE[resource],  map: PERMISSIONS_WRITE };
          case "close":  return { allowed: EXPECTED_CLOSE[resource],  map: PERMISSIONS_CLOSE };
          case "reopen": return { allowed: EXPECTED_REOPEN[resource], map: PERMISSIONS_REOPEN };
        }
      })();
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
});
