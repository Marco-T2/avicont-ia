/**
 * RED test — poc-auth-hex: structural shape assertions C0.
 *
 * 14α declarations. Expected failure mode pre-GREEN:
 *   FAIL (13α): hex files non-existent OR SHIM pre-rewrite OR legacy paths still exist
 *   - α1  FAIL: modules/auth/application/sync-user.service.ts non-existent
 *   - α2  FAIL: modules/auth/application/__tests__/sync-user.service.test.ts non-existent
 *   - α3  FAIL: features/auth/server.ts content pre-rewrite (still `from "./sync-user.service"`)
 *   - α4  PASS (lock-only honest): features/auth/server.ts already has `import "server-only"` pre-GREEN
 *   - α5  FAIL: canonical service non-existent → readFileSync throws
 *   - α6  FAIL: canonical service non-existent → readFileSync throws
 *   - α7  FAIL: canonical service non-existent → readFileSync throws
 *   - α8  FAIL: features/auth/sync-user.service.ts still exists pre-GREEN
 *   - α9  FAIL: features/auth/__tests__/sync-user.service.test.ts still exists pre-GREEN
 *   - α10 FAIL: canonical service non-existent → readFileSync throws
 *   - α11 FAIL: relocated test non-existent pre-GREEN
 *   - α12 FAIL: relocated test non-existent pre-GREEN
 *   - α13 FAIL: relocated test non-existent pre-GREEN
 *   - α14 FAIL: SHIM content pre-rewrite (still `from "./sync-user.service"`)
 *
 * Gate: run pre-GREEN → 13/14α FAIL + 1/14α PASS (α4 lock-only) before C1 GREEN.
 *
 * Paired sister: poc-users-hex — SHA 6b41ce09
 *   modules/users/infrastructure/__tests__/c0-shape.poc-users-hex.test.ts
 * [[paired_sister_default_no_surface]] — applied EXACT mirror with declared divergences:
 *   - Module shape `application/` ONLY (no `infrastructure/` layer — auth has 0 Prisma repo, 0 ports)
 *   - 4-file C1 atomic (vs sister 3-file) — heredado test relocates alongside service
 *   - C0 test at `application/__tests__/` (not `infrastructure/__tests__/` like sister)
 * [[red_regex_discipline]] — `^...$m` anchors for import statements.
 * [[cross_module_boundary_mock_target_rewrite]] — vi.mock("@/features/users/server") preserved.
 * [[engram_textual_rule_verification]] — NotFoundError verified at modules/shared/domain/errors/index.ts:20.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ROOT: 4 levels deep — modules/auth/application/__tests__/
const ROOT = join(__dirname, "../../../..");

const HEX_AUTH_SERVICE = join(
  ROOT,
  "modules/auth/application/sync-user.service.ts",
);
const HEREDADO_TEST = join(
  ROOT,
  "modules/auth/application/__tests__/sync-user.service.test.ts",
);
const SHIM_AUTH_SERVER = join(ROOT, "features/auth/server.ts");
const LEGACY_AUTH_SERVICE = join(ROOT, "features/auth/sync-user.service.ts");
const LEGACY_AUTH_TEST = join(
  ROOT,
  "features/auth/__tests__/sync-user.service.test.ts",
);

// ── α1: canonical service existence ──────────────────────────────────────────

describe("α1 canonical auth service exists", () => {
  it("α1: modules/auth/application/sync-user.service.ts exists", () => {
    expect(existsSync(HEX_AUTH_SERVICE)).toBe(true);
  });
});

// ── α2: relocated heredado test existence ─────────────────────────────────────

describe("α2 relocated heredado test exists", () => {
  it("α2: modules/auth/application/__tests__/sync-user.service.test.ts exists", () => {
    expect(existsSync(HEREDADO_TEST)).toBe(true);
  });
});

// ── α3–α4: SHIM features/auth/server.ts content sentinels ────────────────────

describe("α3–α4 SHIM features/auth/server.ts content sentinels", () => {
  it("α3: SHIM is Option A static named re-export from canonical hex path", () => {
    const content = readFileSync(SHIM_AUTH_SERVER, "utf-8");
    expect(content).toMatch(
      /^export \{ syncUserToDatabase \} from "@\/modules\/auth\/application\/sync-user\.service";$/m,
    );
  });

  it("α4: SHIM preserves `import \"server-only\"` (lock-only — PASS pre-GREEN by design)", () => {
    const content = readFileSync(SHIM_AUTH_SERVER, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });
});

// ── α5: canonical service exports syncUserToDatabase ─────────────────────────

describe("α5 canonical service exports syncUserToDatabase", () => {
  it("α5: canonical sync-user.service.ts exports `syncUserToDatabase` function", () => {
    const content = readFileSync(HEX_AUTH_SERVICE, "utf-8");
    expect(content).toMatch(/^export (async )?function syncUserToDatabase\b/m);
  });
});

// ── α6–α7: canonical service imports — REQ-004 bypass (direct, NOT features SHIMs) ──

describe("α6–α7 canonical service imports canonical hex paths (REQ-004 bypass)", () => {
  it("α6: canonical service imports UsersService from @/modules/users/application/users.service DIRECT", () => {
    const content = readFileSync(HEX_AUTH_SERVICE, "utf-8");
    expect(content).toMatch(
      /^import \{ UsersService \} from "@\/modules\/users\/application\/users\.service";$/m,
    );
  });

  it("α7: canonical service imports NotFoundError from @/modules/shared/domain/errors DIRECT", () => {
    const content = readFileSync(HEX_AUTH_SERVICE, "utf-8");
    expect(content).toMatch(
      /^import \{ NotFoundError \} from "@\/modules\/shared\/domain\/errors";$/m,
    );
  });
});

// ── α8–α9: legacy paths must NOT exist post-relocation ───────────────────────

describe("α8–α9 legacy features/auth/ source files removed", () => {
  it("α8: features/auth/sync-user.service.ts does NOT exist", () => {
    expect(existsSync(LEGACY_AUTH_SERVICE)).toBe(false);
  });

  it("α9: features/auth/__tests__/sync-user.service.test.ts does NOT exist", () => {
    expect(existsSync(LEGACY_AUTH_TEST)).toBe(false);
  });
});

// ── α10: server-only directive on canonical service ───────────────────────────

describe("α10 canonical service preserves `import \"server-only\"`", () => {
  it("α10: canonical sync-user.service.ts has `import \"server-only\"`", () => {
    const content = readFileSync(HEX_AUTH_SERVICE, "utf-8");
    expect(content).toMatch(/^import ['"]server-only['"];?$/m);
  });
});

// ── α11–α13: relocated heredado test invariants ───────────────────────────────

describe("α11–α13 relocated heredado test import and mock shape", () => {
  it("α11: relocated test imports syncUserToDatabase via relative `../sync-user.service`", () => {
    const content = readFileSync(HEREDADO_TEST, "utf-8");
    expect(content).toMatch(
      /^import \{ syncUserToDatabase \} from "\.\.\/sync-user\.service";$/m,
    );
  });

  it("α12: relocated test preserves vi.mock(\"@/features/users/server\") declaration unchanged", () => {
    const content = readFileSync(HEREDADO_TEST, "utf-8");
    expect(content).toMatch(/vi\.mock\(["']@\/features\/users\/server["']/);
  });

  it("α13: relocated test preserves vi.mock(\"@clerk/nextjs/server\") declaration unchanged", () => {
    const content = readFileSync(HEREDADO_TEST, "utf-8");
    expect(content).toMatch(/vi\.mock\(["']@clerk\/nextjs\/server["']/);
  });
});

// ── α14: SHIM is exactly 3 LOC ───────────────────────────────────────────────

describe("α14 SHIM is exactly 3 LOC (import + blank + named re-export)", () => {
  it("α14: features/auth/server.ts stripped content equals 3-LOC canonical shape", () => {
    const content = readFileSync(SHIM_AUTH_SERVER, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    // Non-blank lines must be exactly 2: `import "server-only"` + named re-export
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^import ['"]server-only['"];?$/);
    expect(lines[1]).toMatch(
      /^export \{ syncUserToDatabase \} from "@\/modules\/auth\/application\/sync-user\.service";$/,
    );
  });
});
