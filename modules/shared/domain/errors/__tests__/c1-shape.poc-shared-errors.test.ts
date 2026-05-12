/**
 * RED test — poc-shared-errors: structural shape assertions C1.
 *
 * 16α declarations. Expected failure mode pre-GREEN:
 *   ALL 16α FAIL:
 *   - α1 FAIL: modules/shared/domain/errors/index.ts non-existent
 *   - α2–α8 FAIL: hex file non-existent → readFileSync throws
 *   - α9 FAIL: hex file non-existent → grep-count cannot run
 *   - α10–α11 FAIL: hex file non-existent → readFileSync throws
 *   - α12 FAIL: features/shared/errors.ts line 1 is class def, not SHIM comment
 *   - α13 FAIL: features/shared/errors.ts line 2 is class body, not export *
 *   - α14 FAIL: features/shared/errors.ts still has ^export class (7 definitions)
 *   - α15 FAIL: monetary-errors.ts still imports from @/features/shared/errors
 *   - α16 FAIL: hex file non-existent → readFileSync throws
 *
 * Paired sister: poc-accounting-account-subtype-to-hex (poc-#2c) —
 * modules/accounting/presentation/__tests__/poc-account-subtype-to-hex-shape.test.ts
 * [[paired_sister_default_no_surface]] applied directly.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../../..");
const HEX_FILE = join(ROOT, "modules/shared/domain/errors/index.ts");
const SHIM_FILE = join(ROOT, "features/shared/errors.ts");
const MONETARY_FILE = join(ROOT, "modules/shared/domain/errors/monetary-errors.ts");

// ── α1: Hex file existence ───────────────────────────────────────────────────

describe("α1 hex file exists", () => {
  it("α1: modules/shared/domain/errors/index.ts exists", () => {
    expect(existsSync(HEX_FILE)).toBe(true);
  });
});

// ── α2–α8: 7 class presence sentinels in hex file ───────────────────────────

describe("α2–α8 hex file contains 7 error classes", () => {
  it("α2: hex file contains AppError", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/AppError/);
  });

  it("α3: hex file contains NotFoundError", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/NotFoundError/);
  });

  it("α4: hex file contains ForbiddenError", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/ForbiddenError/);
  });

  it("α5: hex file contains ValidationError", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/ValidationError/);
  });

  it("α6: hex file contains ConflictError", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/ConflictError/);
  });

  it("α7: hex file contains UnauthorizedError", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/UnauthorizedError/);
  });

  it("α8: hex file contains ExternalSyncError", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/ExternalSyncError/);
  });
});

// ── α9: grep-count 78 const codes ────────────────────────────────────────────

describe("α9 hex file contains 78 const error codes", () => {
  it("α9: grep-count of ^export const [A-Z_]+ = \" in hex file === 78", () => {
    const result = execSync(
      `grep -cE '^export const [A-Z_]+ = "' "${HEX_FILE}"`,
      { encoding: "utf-8" },
    ).trim();
    expect(Number(result)).toBe(78);
  });
});

// ── α10–α11: 2 type presence sentinels ───────────────────────────────────────

describe("α10–α11 hex file contains 2 exported types", () => {
  it("α10: hex file contains DivergentState type", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/DivergentState/);
  });

  it("α11: hex file contains ExternalSyncErrorDetails type", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).toMatch(/ExternalSyncErrorDetails/);
  });
});

// ── α12–α13: SHIM literal exact match ────────────────────────────────────────

describe("α12–α13 features/shared/errors.ts is 2-line SHIM", () => {
  it("α12: SHIM line 1 exact literal — JSDoc canonical home comment", () => {
    const lines = readFileSync(SHIM_FILE, "utf-8").split("\n");
    expect(lines[0]).toBe(
      "/** Re-exports moved to hex (§13.X canonical home). */",
    );
  });

  it("α13: SHIM line 2 exact literal — export * re-export", () => {
    const lines = readFileSync(SHIM_FILE, "utf-8").split("\n");
    expect(lines[1]).toBe(
      'export * from "@/modules/shared/domain/errors";',
    );
  });
});

// ── α14: SHIM absence — no ^export class in SHIM ─────────────────────────────

describe("α14 SHIM has no class definitions (absence)", () => {
  it("α14: features/shared/errors.ts has no ^export class match", () => {
    const content = readFileSync(SHIM_FILE, "utf-8");
    expect(content).not.toMatch(/^export class/m);
  });
});

// ── α15: fwd-dep absence — monetary-errors.ts no longer imports features/shared ─

describe("α15 monetary-errors.ts resolved fwd-dep (absence)", () => {
  it("α15: modules/shared/domain/errors/monetary-errors.ts has no features/shared/errors import", () => {
    const content = readFileSync(MONETARY_FILE, "utf-8");
    expect(content).not.toMatch(/features\/shared\/errors/);
  });
});

// ── α16: arch boundary — hex file has no @/features import ──────────────────

describe("α16 hex file has no @/features import (arch boundary)", () => {
  it("α16: modules/shared/domain/errors/index.ts has no from \"@/features import", () => {
    const content = readFileSync(HEX_FILE, "utf-8");
    expect(content).not.toMatch(/from "@\/features/);
  });
});
