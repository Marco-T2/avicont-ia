/**
 * RED test — POC #2b: poc-accounting-utils-pure-to-hex structural shape assertions.
 *
 * 21α declarations. Expected failure mode pre-GREEN:
 *   ~18 FAIL (domain files non-existent, SHIMs not written, barrel lines absent).
 *   ~3 PASS (α14 sub-checks may PASS on absent files — grep returns empty = no match;
 *            α21 PASS because no server-only found in non-existent files).
 *
 * Paired sister: POC #2a (poc-types-to-hex-shape.test.ts) — EXACT mirror structure.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PRESENTATION_ROOT = resolve(__dirname, "..");
const DOMAIN_DIR = resolve(__dirname, "../../../../modules/accounting/domain");
const FEATURES_DIR = resolve(__dirname, "../../../../features/accounting");
const BARREL = resolve(PRESENTATION_ROOT, "server.ts");

// ── α01–α04: Domain file existence ──────────────────────────────────────────

describe("α01–α04 domain files exist", () => {
  it("α01: modules/accounting/domain/account-code.utils.ts exists", () => {
    expect(
      existsSync(resolve(DOMAIN_DIR, "account-code.utils.ts")),
    ).toBe(true);
  });

  it("α02: modules/accounting/domain/correlative.utils.ts exists", () => {
    expect(
      existsSync(resolve(DOMAIN_DIR, "correlative.utils.ts")),
    ).toBe(true);
  });

  it("α03: modules/accounting/domain/accounting-helpers.ts exists", () => {
    expect(
      existsSync(resolve(DOMAIN_DIR, "accounting-helpers.ts")),
    ).toBe(true);
  });

  it("α04: modules/accounting/domain/journal.dates.ts exists", () => {
    expect(
      existsSync(resolve(DOMAIN_DIR, "journal.dates.ts")),
    ).toBe(true);
  });
});

// ── α05–α09: Domain file function content ───────────────────────────────────

describe("α05–α09 domain files contain expected function exports", () => {
  it("α05: account-code.utils.ts contains getNextCode", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-code.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(/getNextCode/);
  });

  it("α06: correlative.utils.ts contains formatCorrelativeNumber", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "correlative.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(/formatCorrelativeNumber/);
  });

  it("α07: accounting-helpers.ts contains computeReceivableStatus", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "accounting-helpers.ts"),
      "utf-8",
    );
    expect(content).toMatch(/computeReceivableStatus/);
  });

  it("α08: accounting-helpers.ts contains computePayableStatus", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "accounting-helpers.ts"),
      "utf-8",
    );
    expect(content).toMatch(/computePayableStatus/);
  });

  it("α09: journal.dates.ts contains parseEntryDate", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "journal.dates.ts"),
      "utf-8",
    );
    expect(content).toMatch(/parseEntryDate/);
  });
});

// ── α10–α13: Features SHIM exact shape ──────────────────────────────────────

describe("α10–α13 features files are export * SHIMs", () => {
  it("α10: features/accounting/account-code.utils.ts is SHIM re-export", () => {
    const content = readFileSync(
      resolve(FEATURES_DIR, "account-code.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /export \* from "@\/modules\/accounting\/domain\/account-code\.utils"/,
    );
  });

  it("α11: features/accounting/correlative.utils.ts is SHIM re-export", () => {
    const content = readFileSync(
      resolve(FEATURES_DIR, "correlative.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /export \* from "@\/modules\/accounting\/domain\/correlative\.utils"/,
    );
  });

  it("α12: features/accounting/accounting-helpers.ts is SHIM re-export", () => {
    const content = readFileSync(
      resolve(FEATURES_DIR, "accounting-helpers.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /export \* from "@\/modules\/accounting\/domain\/accounting-helpers"/,
    );
  });

  it("α13: features/accounting/journal.dates.ts is SHIM re-export", () => {
    const content = readFileSync(
      resolve(FEATURES_DIR, "journal.dates.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /export \* from "@\/modules\/accounting\/domain\/journal\.dates"/,
    );
  });
});

// ── α14: Features SHIMs contain no inline function definitions ───────────────

describe("α14 features SHIMs have no inline function definitions", () => {
  const shimFiles = [
    "account-code.utils.ts",
    "correlative.utils.ts",
    "accounting-helpers.ts",
    "journal.dates.ts",
  ];

  it.each(shimFiles)(
    "α14-%s: no export function/const arrow/class in SHIM",
    (filename) => {
      const content = readFileSync(
        resolve(FEATURES_DIR, filename),
        "utf-8",
      );
      expect(content).not.toMatch(
        /export function|export const\s+\w+\s*=\s*.*=>|export class/,
      );
    },
  );
});

// ── α15: Barrel grouping comment ─────────────────────────────────────────────

describe("α15 barrel contains Domain utils grouping comment", () => {
  it("α15: server.ts contains '// ── Domain utils ──' comment", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(/\/\/ ── Domain utils ──/);
  });
});

// ── α16–α19: Barrel export * lines ──────────────────────────────────────────

describe("α16–α19 barrel exports all 4 domain utils", () => {
  it("α16: barrel exports account-code.utils", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(
      /export \* from "\.\.\/domain\/account-code\.utils"/,
    );
  });

  it("α17: barrel exports correlative.utils", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(
      /export \* from "\.\.\/domain\/correlative\.utils"/,
    );
  });

  it("α18: barrel exports accounting-helpers", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(
      /export \* from "\.\.\/domain\/accounting-helpers"/,
    );
  });

  it("α19: barrel exports journal.dates", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(/export \* from "\.\.\/domain\/journal\.dates"/);
  });
});

// ── α20: journal.dates hex copy preserves cross-feature import ───────────────

describe("α20 journal.dates hex copy preserves ValidationError import", () => {
  it("α20: domain/journal.dates.ts imports ValidationError from @/features/shared/errors", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "journal.dates.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /import.*ValidationError.*from\s+["']@\/features\/shared\/errors["']/,
    );
  });
});

// ── α21: NO import "server-only" in any NEW domain file (CRITICAL gate) ──────

describe("α21 CRITICAL: no server-only in new domain files", () => {
  const domainFiles = [
    "account-code.utils.ts",
    "correlative.utils.ts",
    "accounting-helpers.ts",
    "journal.dates.ts",
  ];

  it.each(domainFiles)(
    "α21-%s: does NOT contain import server-only",
    (filename) => {
      const filePath = resolve(DOMAIN_DIR, filename);
      if (!existsSync(filePath)) {
        // File doesn't exist yet (pre-GREEN) — passes vacuously (no server-only possible)
        return;
      }
      const content = readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/import\s+["']server-only["']/);
    },
  );
});
