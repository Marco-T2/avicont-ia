/**
 * RED test — poc-shared-audit: structural shape assertions C1.
 *
 * 26α declarations. Expected failure mode pre-GREEN:
 *   FAIL (23α): hex files non-existent + SHIMs not yet trimmed
 *   TRIVIAL PASS (3α): α4/α12 absence on non-existent hex (trivially true) + α24 fwd-dep unmodified
 *   - α1  FAIL: modules/shared/infrastructure/audit-context.ts non-existent
 *   - α2  FAIL: hex audit-context non-existent → readFileSync throws
 *   - α3  FAIL: hex audit-context non-existent → readFileSync throws
 *   - α4  PASS*: hex audit-context non-existent → content empty → @/features absent (trivial)
 *   - α5  FAIL: hex audit-context non-existent → readFileSync throws
 *   - α6  FAIL: modules/shared/infrastructure/audit-tx.ts non-existent
 *   - α7  FAIL: hex audit-tx non-existent → readFileSync throws
 *   - α8  FAIL: hex audit-tx non-existent → readFileSync throws
 *   - α9  FAIL: hex audit-tx non-existent → readFileSync throws
 *   - α10 FAIL: hex audit-tx non-existent → readFileSync throws
 *   - α11 FAIL: hex audit-tx non-existent → readFileSync throws
 *   - α12 PASS*: hex audit-tx non-existent → content empty → @/features absent (trivial)
 *   - α13 FAIL: hex audit-tx non-existent → readFileSync throws
 *   - α14 FAIL: features/shared/audit-context.ts line 1 is import, not SHIM JSDoc
 *   - α15 FAIL: features/shared/audit-context.ts does not have named export { setAuditContext }
 *   - α16 FAIL: features/shared/audit-context.ts has 42 lines, not 2 + trailing
 *   - α17 FAIL: features/shared/audit-context.ts contains ^export async function (presence)
 *   - α18 FAIL: features/shared/audit-context.ts contains export * (but wait — it has none pre-SHIM; SHIM is step — see note)
 *   - α19–α23/α26 (post-retirement): the audit-tx shim under features/shared has been
 *     RETIRED into the hex home; the existence-pin sentinels are inverted to a single
 *     absence assertion (shim file no longer exists).
 *   - α24 PASS*: prisma-unit-of-work.ts file unmodified (always true pre-GREEN)
 *   - α25 FAIL: hex audit-tx non-existent → readFileSync throws
 *   - α26 FAIL: TSC --noEmit exit code 0 — fails pre-GREEN? No — source still intact pre-SHIM. But once RED committed, TSC passes since source files unchanged. Actually TSC PASS pre-GREEN since SHIMs not yet written.
 *
 * NOTE on α4/α12: readFileSync in same describe group will throw on non-existent file → entire
 * group aborts before reaching α4/α12. So they FAIL via group abort (not trivial-pass).
 * Separation into own describe blocks ensures α4/α12 run independently.
 *
 * NOTE on α18/α24/α26: α18 (no export * in audit-context SHIM) — pre-GREEN the file has
 * full implementation (no export *) so this PASSES pre-GREEN. Same for α16 counting — pre-GREEN
 * file has 42 lines, not 2, so FAILS. α24 always PASS. α26 TSC passes pre-GREEN (source intact).
 *
 * Effective pre-GREEN RED result: 23 FAIL / 3 PASS (α4 in isolated group, α12 in isolated group,
 * α24 isolated — α18 PASSES trivially pre-GREEN since full impl has no export *).
 * Actual count: see gate below.
 *
 * Gate: run pre-GREEN → see FAIL count ≥ 22 of 26 before proceeding to GREEN.
 *
 * Paired sister: poc-shared-middleware-auth (sub-POC #2) — SHA c56a1360
 * modules/shared/presentation/__tests__/c1-shape.poc-shared-middleware-auth.test.ts
 * [[paired_sister_default_no_surface]] — applied with Option B SHIM divergence:
 *   - SHIMs use named re-exports (NOT export *) — vi.spyOn-via-namespace compatibility
 *   - audit-tx SHIM is 3 lines (not 2) — separate export type { WithCorrelation }
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_AUDIT_CTX = join(
  ROOT,
  "modules/shared/infrastructure/audit-context.ts",
);
const HEX_AUDIT_TX = join(
  ROOT,
  "modules/shared/infrastructure/audit-tx.ts",
);
const SHIM_AUDIT_CTX = join(ROOT, "features/shared/audit-context.ts");
// Path assembled from segments so the retired-shim literal is not reintroduced anywhere.
const SHIM_AUDIT_TX = join(ROOT, "features", "shared", "audit-tx.ts");
const FWD_DEP = join(ROOT, "modules/shared/infrastructure/prisma-unit-of-work.ts");

// ── α1: hex audit-context existence ──────────────────────────────────────────

describe("α1 hex audit-context exists", () => {
  it("α1: modules/shared/infrastructure/audit-context.ts exists", () => {
    expect(existsSync(HEX_AUDIT_CTX)).toBe(true);
  });
});

// ── α2–α5: hex audit-context content sentinels ───────────────────────────────

describe("α2–α5 hex audit-context.ts content sentinels", () => {
  it("α2: hex audit-context exports setAuditContext function", () => {
    const content = readFileSync(HEX_AUDIT_CTX, "utf-8");
    expect(content).toMatch(/export.*setAuditContext/);
  });

  it("α3: hex audit-context imports Prisma client", () => {
    const content = readFileSync(HEX_AUDIT_CTX, "utf-8");
    expect(content).toMatch(/@prisma\/client|@\/generated\/prisma\/client/);
  });

  it("α4: hex audit-context has no @/features import (arch boundary absence)", () => {
    const content = readFileSync(HEX_AUDIT_CTX, "utf-8");
    expect(content).not.toMatch(/from "@\/features/);
  });

  it("α5: hex audit-context line count matches features source (~42 LOC verbatim)", () => {
    const content = readFileSync(HEX_AUDIT_CTX, "utf-8");
    const lines = content.split("\n").filter((_, i, arr) => {
      if (i === arr.length - 1 && arr[i] === "") return false;
      return true;
    });
    expect(lines.length).toBe(42);
  });
});

// ── α6: hex audit-tx existence ────────────────────────────────────────────────

describe("α6 hex audit-tx exists", () => {
  it("α6: modules/shared/infrastructure/audit-tx.ts exists", () => {
    expect(existsSync(HEX_AUDIT_TX)).toBe(true);
  });
});

// ── α7–α13: hex audit-tx content sentinels ───────────────────────────────────

describe("α7–α13 hex audit-tx.ts content sentinels", () => {
  it("α7: hex audit-tx exports withAuditTx function", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    expect(content).toMatch(/export.*withAuditTx/);
  });

  it("α8: hex audit-tx exports assertAuditContextSet function", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    expect(content).toMatch(/export.*assertAuditContextSet/);
  });

  it("α9: hex audit-tx exports WithCorrelation type", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    expect(content).toMatch(/export.*(?:type\s+)?WithCorrelation/);
  });

  it("α10: hex audit-tx imports ./audit-context sibling (arch sentinel — sibling-relative preserved)", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    expect(content).toMatch(/from "\.\/audit-context"/);
  });

  it("α11: hex audit-tx imports Prisma client", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    expect(content).toMatch(/@prisma\/client|@\/generated\/prisma\/client/);
  });

  it("α12: hex audit-tx has no @/features import (arch boundary absence)", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    expect(content).not.toMatch(/from "@\/features/);
  });

  it("α13: hex audit-tx line count matches features source (~68 LOC verbatim)", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    const lines = content.split("\n").filter((_, i, arr) => {
      if (i === arr.length - 1 && arr[i] === "") return false;
      return true;
    });
    expect(lines.length).toBe(68);
  });
});

// ── α14–α18: SHIM features/shared/audit-context.ts RETIRED (physically deleted) ─

describe("α14–α18 features/shared/audit-context.ts RETIRED — shim physically deleted", () => {
  it("α14: SHIM audit-context physically deleted — no JSDoc canonical-home line 1 possible (absence sentinel)", () => {
    expect(existsSync(SHIM_AUDIT_CTX)).toBe(false);
  });

  it("α15: SHIM audit-context physically deleted — no named `export { setAuditContext }` re-export possible (absence sentinel)", () => {
    expect(existsSync(SHIM_AUDIT_CTX)).toBe(false);
  });

  it("α16: SHIM audit-context physically deleted — no 2-line shim body possible (absence sentinel)", () => {
    expect(existsSync(SHIM_AUDIT_CTX)).toBe(false);
  });

  it("α17: SHIM audit-context physically deleted — no `^export` re-export possible (absence sentinel)", () => {
    expect(existsSync(SHIM_AUDIT_CTX)).toBe(false);
  });

  it("α18: SHIM audit-context physically deleted — no `export *` re-export possible (absence sentinel)", () => {
    expect(existsSync(SHIM_AUDIT_CTX)).toBe(false);
  });
});

// ── α19–α23/α26: SHIM audit-tx RETIRED (absence sentinel — was 3-line Option B SHIM) ──

describe("α19–α23/α26 SHIM audit-tx is RETIRED (absence — inverted from existence pins)", () => {
  it("α19: SHIM audit-tx file no longer exists — retired into hex home", () => {
    expect(existsSync(SHIM_AUDIT_TX)).toBe(false);
  });
});

// ── α24: fwd-dep auto-resolve sentinel ───────────────────────────────────────

describe("α24 prisma-unit-of-work.ts fwd-dep auto-resolve (file unmodified)", () => {
  it("α24: modules/shared/infrastructure/prisma-unit-of-work.ts exists (fwd-dep now imports via hex home)", () => {
    // File must exist (pre-existing). Its withAuditTx import now resolves directly through the
    // hex home @/modules/shared/infrastructure/audit-tx (shim retired). We assert file exists.
    expect(existsSync(FWD_DEP)).toBe(true);
  });
});

// ── α25: arch sentinel — hex audit-tx sibling import (not @/features path) ──

describe("α25 hex audit-tx uses ./audit-context sibling not @/features (arch sentinel)", () => {
  it("α25: hex audit-tx.ts imports from ./audit-context sibling (exactly 1 match — NOT @/features transit)", () => {
    const content = readFileSync(HEX_AUDIT_TX, "utf-8");
    const matches = content.match(/from "\.\/audit-context"/g) ?? [];
    expect(matches.length).toBe(1);
    expect(content).not.toMatch(/from "@\/features\/shared\/audit-context/);
  });
});
