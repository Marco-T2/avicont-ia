/**
 * PR1 1.1 RED — RBAC authorization matrix (REQ-P.1 / REQ-P.2)
 *
 * Table-driven coverage:
 *   canAccess: 6 roles × 12 resources × 2 actions = 144 cases
 *   canPost:   6 roles × 3  resources            =  18 cases
 *
 * Matrix source of truth: openspec/changes/accounting-rbac/specs/rbac-permissions-matrix/spec.md
 * W-draft is encoded as write=true (status gate is enforced by canPost at service layer).
 */
import { describe, it, expect } from "vitest";
import {
  canAccess,
  canPost,
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  POST_ALLOWED_ROLES,
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

describe("REQ-P.2 — canAccess(role, resource, action) matrix (144 cases)", () => {
  for (const resource of ALL_RESOURCES) {
    for (const action of ALL_ACTIONS) {
      const allowed =
        action === "read" ? EXPECTED_READ[resource] : EXPECTED_WRITE[resource];
      for (const role of ALL_ROLES) {
        const expected = allowed.includes(role);
        it(`${role} × ${resource} × ${action} → ${expected}`, () => {
          expect(canAccess(role, resource, action)).toBe(expected);
        });
      }
    }
  }
});

describe("REQ-P.3-S3 — canPost(role, resource) — W-draft guard (18 cases)", () => {
  for (const resource of POST_RESOURCES) {
    const allowed = EXPECTED_POST[resource];
    for (const role of ALL_ROLES) {
      const expected = allowed.includes(role);
      it(`${role} × ${resource} → ${expected}`, () => {
        expect(canPost(role, resource)).toBe(expected);
      });
    }
  }
});

describe("POST_ALLOWED_ROLES map", () => {
  it("covers exactly the 3 postable resources", () => {
    expect(Object.keys(POST_ALLOWED_ROLES).sort()).toEqual(
      [...POST_RESOURCES].sort(),
    );
  });

  it("excludes auxiliar from every postable resource", () => {
    for (const r of POST_RESOURCES) {
      expect(POST_ALLOWED_ROLES[r]).not.toContain("auxiliar");
    }
  });
});

describe("Spec scenarios verbatim", () => {
  it("P.2-S1 — contador reads reports", () => {
    expect(canAccess("contador", "reports", "read")).toBe(true);
  });

  it("P.2-S2 — cobrador cannot touch journal (read or write)", () => {
    expect(canAccess("cobrador", "journal", "read")).toBe(false);
    expect(canAccess("cobrador", "journal", "write")).toBe(false);
  });

  it("P.2-S3 — auxiliar writes dispatches", () => {
    expect(canAccess("auxiliar", "dispatches", "write")).toBe(true);
  });

  it("P.3-S3 — auxiliar cannot post sales (W-draft)", () => {
    expect(canAccess("auxiliar", "sales", "write")).toBe(true);
    expect(canPost("auxiliar", "sales")).toBe(false);
  });
});
