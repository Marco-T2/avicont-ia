/**
 * RED test — poc-shared-base-repo: structural shape assertions C1.
 *
 * 17α declarations. Expected failure mode pre-GREEN:
 *   FAIL (17α): hex files non-existent
 *   - α1  FAIL: modules/shared/infrastructure/base.repository.ts non-existent
 *   - α2  FAIL: hex base.repository non-existent → import fails at module level
 *   - α3  FAIL: hex base.repository non-existent → import fails
 *   - α4  FAIL: hex base.repository non-existent → import fails
 *   - α5  FAIL: hex base.repository non-existent → import fails
 *   - α6  FAIL: hex base.repository non-existent → import fails
 *   - α7  FAIL: hex base.repository non-existent → readFileSync throws
 *   - α8  FAIL: modules/shared/infrastructure/prisma-errors.ts non-existent
 *   - α9  FAIL: hex prisma-errors non-existent → import fails
 *   - α10 FAIL: hex prisma-errors non-existent → import fails
 *   - α11 FAIL: hex prisma-errors non-existent → import fails
 *   - α12 FAIL: hex prisma-errors non-existent → import fails (runtime would throw)
 *   - α13 FAIL: hex prisma-errors non-existent → import fails (runtime would throw)
 *   - α14 FAIL: hex prisma-errors non-existent → import fails (runtime would throw)
 *   - α15 FAIL: hex prisma-errors non-existent → import fails (runtime would throw)
 *   - α16 FAIL: hex prisma-errors non-existent → import fails (runtime would throw)
 *   - α17 FAIL: hex base.repository non-existent → readFileSync throws
 *
 * Gate: run pre-GREEN → 17/17α FAIL before proceeding to GREEN.
 *
 * Paired sister: poc-shared-audit (sub-POC #3) — SHA 69178f3f
 * modules/shared/infrastructure/__tests__/c1-shape.poc-shared-audit.test.ts
 * [[paired_sister_default_no_surface]] — applied with Option A SHIM restoration:
 *   - SHIMs use export * (NOT named re-exports — 0 vi.spyOn spy consumers, spy gate PASS)
 *   - 17α (not 26α like #3 — no spy-consumer tests, no fwd-dep test)
 *   - server-only α7 uses fs.readFileSync content inspection (NOT runtime import side-effect)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../..");
const HEX_BASE_REPO = join(
  ROOT,
  "modules/shared/infrastructure/base.repository.ts",
);
const HEX_PRISMA_ERRORS = join(
  ROOT,
  "modules/shared/infrastructure/prisma-errors.ts",
);

// ── α1: hex base.repository existence ────────────────────────────────────────

describe("α1 hex base.repository exists", () => {
  it("α1: modules/shared/infrastructure/base.repository.ts exists", () => {
    expect(existsSync(HEX_BASE_REPO)).toBe(true);
  });
});

// ── α2–α7: hex base.repository content sentinels ─────────────────────────────

describe("α2–α7 hex base.repository.ts content sentinels", () => {
  it("α2: hex base.repository exports BaseRepository", () => {
    const content = readFileSync(HEX_BASE_REPO, "utf-8");
    expect(content).toMatch(/export.*BaseRepository/);
  });

  it("α3: BaseRepository is abstract class", () => {
    const content = readFileSync(HEX_BASE_REPO, "utf-8");
    expect(content).toMatch(/export abstract class BaseRepository/);
  });

  it("α4: constructor has protected readonly db: PrismaClient param", () => {
    const content = readFileSync(HEX_BASE_REPO, "utf-8");
    expect(content).toMatch(/protected readonly db: PrismaClient/);
  });

  it("α5: requireOrg protected method exists", () => {
    const content = readFileSync(HEX_BASE_REPO, "utf-8");
    expect(content).toMatch(/protected requireOrg/);
  });

  it("α6: transaction<T> method exists", () => {
    const content = readFileSync(HEX_BASE_REPO, "utf-8");
    expect(content).toMatch(/transaction<T>/);
  });

  it("α7: hex base.repository.ts has server-only import (content inspection)", () => {
    // NOTE: Cannot test via runtime import — vitest blocks server-only side-effect.
    // Content inspection is the correct approach per design (α07 spec note).
    const content = readFileSync(HEX_BASE_REPO, "utf-8");
    expect(content).toMatch(/import ['"]server-only['"]/);
  });
});

// ── α8: hex prisma-errors existence ──────────────────────────────────────────

describe("α8 hex prisma-errors exists", () => {
  it("α8: modules/shared/infrastructure/prisma-errors.ts exists", () => {
    expect(existsSync(HEX_PRISMA_ERRORS)).toBe(true);
  });
});

// ── α9–α16: hex prisma-errors content + behavior sentinels ───────────────────

describe("α9–α11 hex prisma-errors.ts static sentinels", () => {
  it("α9: hex prisma-errors exports isPrismaUniqueViolation", () => {
    const content = readFileSync(HEX_PRISMA_ERRORS, "utf-8");
    expect(content).toMatch(/export.*isPrismaUniqueViolation/);
  });

  it("α10: isPrismaUniqueViolation is a function", () => {
    const content = readFileSync(HEX_PRISMA_ERRORS, "utf-8");
    expect(content).toMatch(/export function isPrismaUniqueViolation/);
  });

  it("α11: isPrismaUniqueViolation accepts 2 params (err, targetIndex?)", () => {
    const content = readFileSync(HEX_PRISMA_ERRORS, "utf-8");
    expect(content).toMatch(/isPrismaUniqueViolation\(\s*err: unknown,\s*targetIndex\?:/);
  });
});

describe("α12–α16 hex prisma-errors.ts runtime behavior sentinels", () => {
  it("α12: returns false for non-Prisma errors", async () => {
    const { isPrismaUniqueViolation } = await import("../prisma-errors");
    expect(isPrismaUniqueViolation(new Error("plain error"))).toBe(false);
  });

  it("α13: returns false for non-P2002 Prisma errors", async () => {
    const { isPrismaUniqueViolation } = await import("../prisma-errors");
    const { Prisma } = await import("@/generated/prisma/client");
    const notFound = new Prisma.PrismaClientKnownRequestError("not found", {
      code: "P2025",
      clientVersion: "0.0.0",
    });
    expect(isPrismaUniqueViolation(notFound)).toBe(false);
  });

  it("α14: returns true for P2002 error without targetIndex", async () => {
    const { isPrismaUniqueViolation } = await import("../prisma-errors");
    const { Prisma } = await import("@/generated/prisma/client");
    const unique = new Prisma.PrismaClientKnownRequestError("unique violation", {
      code: "P2002",
      clientVersion: "0.0.0",
      meta: { target: "some_index" },
    });
    expect(isPrismaUniqueViolation(unique)).toBe(true);
  });

  it("α15: returns true for P2002 error with matching targetIndex (string)", async () => {
    const { isPrismaUniqueViolation } = await import("../prisma-errors");
    const { Prisma } = await import("@/generated/prisma/client");
    const unique = new Prisma.PrismaClientKnownRequestError("unique violation", {
      code: "P2002",
      clientVersion: "0.0.0",
      meta: { target: "org_journal_number_unique" },
    });
    expect(isPrismaUniqueViolation(unique, "org_journal_number_unique")).toBe(true);
  });

  it("α16: returns true for P2002 error with matching targetIndex (Array join)", async () => {
    const { isPrismaUniqueViolation } = await import("../prisma-errors");
    const { Prisma } = await import("@/generated/prisma/client");
    const unique = new Prisma.PrismaClientKnownRequestError("unique violation", {
      code: "P2002",
      clientVersion: "0.0.0",
      meta: { target: ["org", "journal", "number", "unique"] },
    });
    expect(isPrismaUniqueViolation(unique, "org_journal_number_unique")).toBe(true);
  });
});

// ── α17: arch sentinel — hex base.repository.ts has no @/features/shared import ─

describe("α17 arch sentinel — hex base.repository.ts has no @/features/shared import", () => {
  it("α17: hex base.repository.ts does NOT import from @/features/shared/", () => {
    const content = readFileSync(HEX_BASE_REPO, "utf-8");
    expect(content).not.toMatch(/from ['"]@\/features\/shared/);
  });
});
