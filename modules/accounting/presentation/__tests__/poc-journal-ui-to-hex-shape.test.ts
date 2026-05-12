/**
 * RED test — POC #2d: poc-accounting-ui-helpers-to-hex structural shape assertions.
 *
 * 13α declarations. Expected failure mode pre-GREEN:
 *   ~10 FAIL (domain file non-existent, SHIM not written, 3 barrel lines absent).
 *   ~3 PASS (α11 sentinels POC #1+#2a+#2b+#2c preserved; α12 PASS vacuously on absent file).
 *
 * Paired sister: POC #2c (poc-account-subtype-to-hex-shape.test.ts) — EXACT mirror structure.
 * Single-axis 1-atom (vs #2c's 2-atom): only journal.ui.ts migrated.
 * Client-bundle protection: α12 gates NO import "server-only" (2 client consumers verified).
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const SHIM_FEATURES = join(ROOT, "features/accounting/journal.ui.ts");
const HEX_DOMAIN = join(ROOT, "modules/accounting/domain/journal.ui.ts");
const BARREL = join(ROOT, "modules/accounting/presentation/server.ts");

// POC sentinel paths (α-11): all must remain present post-GREEN
const SENTINELS = [
  join(ROOT, "modules/accounting/presentation/server.ts"),           // POC #1 barrel
  join(ROOT, "modules/accounting/domain/account-code.utils.ts"),     // POC #2b
  join(ROOT, "modules/accounting/domain/journal.dates.ts"),          // POC #2b
  join(ROOT, "modules/accounting/domain/account-subtype.utils.ts"),  // POC #2c
];

// ── α01–α04: REQ-001 Domain file existence + content ────────────────────────

describe("α01–α04 REQ-001: hex domain file exists and contains expected exports", () => {
  it("α01: modules/accounting/domain/journal.ui.ts exists", () => {
    expect(existsSync(HEX_DOMAIN)).toBe(true);
  });

  it("α02: domain/journal.ui.ts exports sourceTypeLabel", () => {
    const content = readFileSync(HEX_DOMAIN, "utf-8");
    expect(content).toMatch(/export function sourceTypeLabel/);
  });

  it("α03: domain/journal.ui.ts exports sourceTypeBadgeClassName", () => {
    const content = readFileSync(HEX_DOMAIN, "utf-8");
    expect(content).toMatch(/export function sourceTypeBadgeClassName/);
  });

  it("α04: domain/journal.ui.ts contains SOURCE_TYPE_LABELS (body sentinel — verbatim copy gate)", () => {
    const content = readFileSync(HEX_DOMAIN, "utf-8");
    expect(content).toMatch(/SOURCE_TYPE_LABELS/);
  });
});

// ── α05–α07: REQ-002 SHIM re-export shape ────────────────────────────────────

describe("α05–α07 REQ-002: features/accounting/journal.ui.ts is a 2-line SHIM", () => {
  it("α05: SHIM opens with export * anchored at line start", () => {
    const content = readFileSync(SHIM_FEATURES, "utf-8");
    expect(content).toMatch(/^export \* from/m);
  });

  it("α06: SHIM cites §13 canonical home rule in JSDoc", () => {
    const content = readFileSync(SHIM_FEATURES, "utf-8");
    expect(content).toMatch(/§13/);
  });

  it("α07: SHIM contains zero inline function definitions (negative gate)", () => {
    const content = readFileSync(SHIM_FEATURES, "utf-8");
    expect(content).not.toMatch(/^export function/m);
  });
});

// ── α08–α10: REQ-003 Barrel NEW block ────────────────────────────────────────

describe("α08–α10 REQ-003: barrel gains NEW Domain UI helpers block after Domain utils", () => {
  it("α08: barrel contains NEW block header '// ── Domain UI helpers ──'", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(/\/\/ ── Domain UI helpers ──/);
  });

  it("α09: barrel contains export line for ../domain/journal.ui", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(/export \* from "\.\.\/domain\/journal\.ui"/);
  });

  it("α10: 'Domain UI helpers' block appears AFTER 'Domain utils' block (placement gate)", () => {
    const content = readFileSync(BARREL, "utf-8");
    const utilsIdx = content.indexOf("Domain utils");
    const uiIdx = content.indexOf("Domain UI helpers");
    expect(uiIdx).toBeGreaterThan(utilsIdx);
  });
});

// ── α11: REQ-004 POC sentinel preservation ───────────────────────────────────

describe("α11 REQ-004: POC #1 + #2a + #2b + #2c sentinel files still present", () => {
  // vacuous PASS pre-GREEN — these files exist before this POC; no change to them
  it.each(SENTINELS)(
    "α11: %s exists (sentinel preservation)",
    (sentinelPath) => {
      expect(existsSync(sentinelPath)).toBe(true);
    },
  );
});

// ── α12: REQ-005 server-only absent gate ─────────────────────────────────────

describe("α12 REQ-005: hex domain copy has no server-only import (2 client consumers)", () => {
  it("α12: domain/journal.ui.ts does NOT import server-only (vacuous PASS pre-GREEN — file absent)", () => {
    if (!existsSync(HEX_DOMAIN)) {
      // vacuous pre-GREEN: file absent → no server-only possible
      return;
    }
    const content = readFileSync(HEX_DOMAIN, "utf-8");
    expect(content).not.toMatch(/import\s+["']server-only["']/);
  });
});

// ── α13: REQ-006 SHIM path transparency ──────────────────────────────────────

describe("α13 REQ-006: SHIM re-exports via @/modules path (bundle transparency)", () => {
  it("α13: SHIM points to @/modules/accounting/domain/journal.ui", () => {
    const content = readFileSync(SHIM_FEATURES, "utf-8");
    expect(content).toMatch(/@\/modules\/accounting\/domain\/journal\.ui/);
  });
});
