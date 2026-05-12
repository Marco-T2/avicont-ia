/**
 * RED test — poc-shared-middleware-auth: structural shape assertions C1.
 *
 * 22α declarations. Expected failure mode pre-GREEN:
 *   ALL 22α FAIL:
 *   - α1  FAIL: modules/shared/presentation/middleware.ts non-existent
 *   - α2  FAIL: hex middleware non-existent → readFileSync throws
 *   - α3  FAIL: hex middleware non-existent → readFileSync throws
 *   - α4  FAIL: hex middleware non-existent → readFileSync throws
 *   - α5  FAIL: hex middleware non-existent → readFileSync throws
 *   - α6  FAIL: hex middleware non-existent → readFileSync throws
 *   - α7  FAIL: hex middleware non-existent → readFileSync throws
 *   - α8  FAIL: α1 gates α8 — non-existent file aborts group before absence check
 *   - α9  FAIL: modules/shared/presentation/http-error-serializer.ts non-existent
 *   - α10 FAIL: hex http-serializer non-existent → readFileSync throws
 *   - α11 FAIL: hex http-serializer non-existent → readFileSync throws
 *   - α12 FAIL: α9 gates α12 — non-existent file aborts group before absence check
 *   - α13 FAIL: features/shared/middleware.ts line 1 is import, not SHIM comment
 *   - α14 FAIL: features/shared/middleware.ts line 2 is import, not export *
 *   - α15 FAIL: features/shared/middleware.ts has 10 lines, not 2 + trailing
 *   - α16 FAIL: features/shared/middleware.ts contains ^export async function (presence)
 *   - α17 FAIL: features/shared/http-error-serializer.ts line 1 is import, not SHIM comment
 *   - α18 FAIL: features/shared/http-error-serializer.ts line 2 is import, not export *
 *   - α19 FAIL: features/shared/http-error-serializer.ts has 26 lines, not 2 + trailing
 *   - α20 FAIL: features/shared/http-error-serializer.ts contains ^export function (presence)
 *   - α21 FAIL: hex middleware non-existent → readFileSync throws
 *   - α22 FAIL: hex http-serializer non-existent → readFileSync throws
 *
 * Gate: α8 + α12 are NOT standalone trivial-passes — they run inside describe blocks
 * that first call readFileSync (α2-α7 for middleware, α10-α11 for http-serializer).
 * readFileSync on non-existent file throws → entire describe group fails, α8/α12
 * never execute as isolated pass. This mirrors sub-POC #1 α14 pattern.
 *
 * Paired sister: poc-shared-errors (poc-#1) — SHA dffaeb15
 * modules/shared/domain/errors/__tests__/c1-shape.poc-shared-errors.test.ts
 * [[paired_sister_default_no_surface]] applied directly — 22α adapted from 16α
 * (additive: +6 for 2nd file + re-export sentinels).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_MIDDLEWARE = join(
  ROOT,
  "modules/shared/presentation/middleware.ts",
);
const HEX_SERIALIZER = join(
  ROOT,
  "modules/shared/presentation/http-error-serializer.ts",
);
const SHIM_MIDDLEWARE = join(ROOT, "features/shared/middleware.ts");
const SHIM_SERIALIZER = join(ROOT, "features/shared/http-error-serializer.ts");

// ── α1: hex middleware existence ─────────────────────────────────────────────

describe("α1 hex middleware exists", () => {
  it("α1: modules/shared/presentation/middleware.ts exists", () => {
    expect(existsSync(HEX_MIDDLEWARE)).toBe(true);
  });
});

// ── α2–α8: hex middleware content sentinels ──────────────────────────────────

describe("α2–α8 hex middleware.ts content sentinels", () => {
  it("α2: hex middleware contains requireAuth function export", () => {
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/export async function requireAuth/);
  });

  it("α3: hex middleware contains REQ-003 internal re-export literal", () => {
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    expect(content).toContain(
      'export { handleError } from "./http-error-serializer";',
    );
  });

  it("α4: hex middleware imports @clerk/nextjs/server", () => {
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/@clerk\/nextjs\/server/);
  });

  it("α5: hex middleware imports from @/modules/shared/domain/errors (canonical)", () => {
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/@\/modules\/shared\/domain\/errors/);
  });

  it("α6: hex middleware contains UnauthorizedError throw path", () => {
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/UnauthorizedError/);
  });

  it("α7: hex middleware line count matches features source (10 LOC)", () => {
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    const lines = content.split("\n").filter((_, i, arr) => {
      // exclude trailing empty line from count
      if (i === arr.length - 1 && arr[i] === "") return false;
      return true;
    });
    expect(lines.length).toBe(10);
  });

  it("α8: hex middleware has no @/features import (arch boundary absence)", () => {
    // NOTE: readFileSync in α2-α7 already fails if file is absent.
    // This test runs in same describe group — file must exist for group to reach here.
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    expect(content).not.toMatch(/from "@\/features/);
  });
});

// ── α9: hex http-error-serializer existence ──────────────────────────────────

describe("α9 hex http-error-serializer exists", () => {
  it("α9: modules/shared/presentation/http-error-serializer.ts exists", () => {
    expect(existsSync(HEX_SERIALIZER)).toBe(true);
  });
});

// ── α10–α12: hex http-error-serializer content sentinels ────────────────────

describe("α10–α12 hex http-error-serializer.ts content sentinels", () => {
  it("α10: hex http-error-serializer contains handleError function export", () => {
    const content = readFileSync(HEX_SERIALIZER, "utf-8");
    expect(content).toMatch(/export function handleError/);
  });

  it("α11: hex http-error-serializer imports ZodError and AppError from canonical paths", () => {
    const content = readFileSync(HEX_SERIALIZER, "utf-8");
    expect(content).toMatch(/ZodError/);
    expect(content).toMatch(/@\/modules\/shared\/domain\/errors/);
  });

  it("α12: hex http-error-serializer has no @/features import (arch boundary absence)", () => {
    // NOTE: readFileSync in α10-α11 already fails if file is absent.
    // This test runs in same describe group — file must exist for group to reach here.
    const content = readFileSync(HEX_SERIALIZER, "utf-8");
    expect(content).not.toMatch(/from "@\/features/);
  });
});

// ── α13–α16: SHIM features/shared/middleware.ts sentinels ───────────────────

describe("α13–α16 features/shared/middleware.ts is 2-line SHIM", () => {
  it("α13: SHIM middleware line 1 exact literal — JSDoc canonical home comment", () => {
    const lines = readFileSync(SHIM_MIDDLEWARE, "utf-8").split("\n");
    expect(lines[0]).toBe(
      "/** Re-exports moved to hex (§13.X canonical home). */",
    );
  });

  it("α14: SHIM middleware line 2 exact literal — export * re-export", () => {
    const lines = readFileSync(SHIM_MIDDLEWARE, "utf-8").split("\n");
    expect(lines[1]).toBe(
      'export * from "@/modules/shared/presentation/middleware";',
    );
  });

  it("α15: SHIM middleware has exactly 2 lines + trailing newline (line[2] empty)", () => {
    const lines = readFileSync(SHIM_MIDDLEWARE, "utf-8").split("\n");
    // 2 lines + trailing newline → split produces ["line1", "line2", ""]
    expect(lines.length).toBe(3);
    expect(lines[2]).toBe("");
  });

  it("α16: SHIM middleware has no ^export (async function|function|class) (absence sentinel)", () => {
    const content = readFileSync(SHIM_MIDDLEWARE, "utf-8");
    expect(content).not.toMatch(/^export (async function|function|class)/m);
  });
});

// ── α17–α20: SHIM features/shared/http-error-serializer.ts sentinels ────────

describe("α17–α20 features/shared/http-error-serializer.ts is 2-line SHIM", () => {
  it("α17: SHIM http-serializer line 1 exact literal — JSDoc canonical home comment", () => {
    const lines = readFileSync(SHIM_SERIALIZER, "utf-8").split("\n");
    expect(lines[0]).toBe(
      "/** Re-exports moved to hex (§13.X canonical home). */",
    );
  });

  it("α18: SHIM http-serializer line 2 exact literal — export * re-export", () => {
    const lines = readFileSync(SHIM_SERIALIZER, "utf-8").split("\n");
    expect(lines[1]).toBe(
      'export * from "@/modules/shared/presentation/http-error-serializer";',
    );
  });

  it("α19: SHIM http-serializer has exactly 2 lines + trailing newline (line[2] empty)", () => {
    const lines = readFileSync(SHIM_SERIALIZER, "utf-8").split("\n");
    expect(lines.length).toBe(3);
    expect(lines[2]).toBe("");
  });

  it("α20: SHIM http-serializer has no ^export (function|const) (absence sentinel)", () => {
    const content = readFileSync(SHIM_SERIALIZER, "utf-8");
    expect(content).not.toMatch(/^export (function|const)/m);
  });
});

// ── α21: REQ-003 paired sentinel — hex middleware internal sibling import ────

describe("α21 hex middleware internal sibling import (REQ-003 paired with α3)", () => {
  it("α21: hex middleware.ts contains ./http-error-serializer sibling import", () => {
    const content = readFileSync(HEX_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/\.\/http-error-serializer/);
  });
});

// ── α22: hex http-serializer uses canonical @/modules path for errors ────────

describe("α22 hex http-serializer canonical errors import (absence of legacy ./errors)", () => {
  it("α22: hex http-error-serializer.ts uses @/modules/shared/domain/errors NOT ./errors", () => {
    const content = readFileSync(HEX_SERIALIZER, "utf-8");
    expect(content).not.toMatch(/from "\.\/errors"/);
    expect(content).toMatch(/@\/modules\/shared\/domain\/errors/);
  });
});
