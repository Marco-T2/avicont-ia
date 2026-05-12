/**
 * RED test — POC #2c: poc-accounting-account-subtype-to-hex structural shape assertions.
 *
 * 22α declarations. Expected failure mode pre-GREEN:
 *   ~18 FAIL (domain files non-existent, SHIMs not written, 2 barrel lines absent).
 *   ~4 PASS (α16–α19 sentinels POC #1+#2a+#2b preserved; α20–α21 PASS vacuously on absent files).
 *
 * Paired sister: POC #2b (poc-utils-to-hex-shape.test.ts) — EXACT mirror structure.
 * Client-bundle protection: α20–α21 gate NO import "server-only" (3 client consumers verified).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PRESENTATION_ROOT = resolve(__dirname, "..");
const DOMAIN_DIR = resolve(__dirname, "../../../../modules/accounting/domain");
const FEATURES_DIR = resolve(__dirname, "../../../../features/accounting");
const BARREL = resolve(PRESENTATION_ROOT, "server.ts");

// ── α01–α02: Domain file existence ──────────────────────────────────────────

describe("α01–α02 domain files exist", () => {
  it("α01: modules/accounting/domain/account-subtype.utils.ts exists", () => {
    expect(
      existsSync(resolve(DOMAIN_DIR, "account-subtype.utils.ts")),
    ).toBe(true);
  });

  it("α02: modules/accounting/domain/account-subtype.resolve.ts exists", () => {
    expect(
      existsSync(resolve(DOMAIN_DIR, "account-subtype.resolve.ts")),
    ).toBe(true);
  });
});

// ── α03–α09: Domain file content assertions ──────────────────────────────────

describe("α03–α07 domain files contain expected exports", () => {
  it("α03: domain/account-subtype.utils.ts contains formatSubtypeLabel", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-subtype.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(/formatSubtypeLabel/);
  });

  it("α04: domain/account-subtype.utils.ts contains SUBTYPES_BY_TYPE", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-subtype.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(/SUBTYPES_BY_TYPE/);
  });

  it("α05: domain/account-subtype.utils.ts contains isValidSubtypeForType", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-subtype.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(/isValidSubtypeForType/);
  });

  it("α06: domain/account-subtype.utils.ts contains inferSubtype", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-subtype.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(/inferSubtype/);
  });

  it("α07: domain/account-subtype.resolve.ts contains resolveAccountSubtype", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-subtype.resolve.ts"),
      "utf-8",
    );
    expect(content).toMatch(/resolveAccountSubtype/);
  });
});

describe("α08–α09 domain resolve preserves critical imports", () => {
  it("α08: domain/account-subtype.resolve.ts preserves @/features/shared/errors import (D3 lock)", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-subtype.resolve.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /from\s+["']@\/features\/shared\/errors["']/,
    );
  });

  it("α09: domain/account-subtype.resolve.ts preserves ./account-subtype.utils sibling rel import", () => {
    const content = readFileSync(
      resolve(DOMAIN_DIR, "account-subtype.resolve.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /from\s+["']\.\/account-subtype\.utils["']/,
    );
  });
});

// ── α10–α13: Features SHIM exact shape ──────────────────────────────────────

describe("α10–α11 features files are export * SHIMs", () => {
  it("α10: features/accounting/account-subtype.utils.ts is SHIM re-export", () => {
    const content = readFileSync(
      resolve(FEATURES_DIR, "account-subtype.utils.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /export \* from "@\/modules\/accounting\/domain\/account-subtype\.utils"/,
    );
  });

  it("α11: features/accounting/account-subtype.resolve.ts is SHIM re-export", () => {
    const content = readFileSync(
      resolve(FEATURES_DIR, "account-subtype.resolve.ts"),
      "utf-8",
    );
    expect(content).toMatch(
      /export \* from "@\/modules\/accounting\/domain\/account-subtype\.resolve"/,
    );
  });
});

describe("α12–α13 features SHIMs contain no inline definitions", () => {
  const shimFiles = ["account-subtype.utils.ts", "account-subtype.resolve.ts"];

  it.each(shimFiles)(
    "α12-%s: no export function/const arrow/class in SHIM",
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

  it("α13: features SHIMs do NOT contain SUBTYPES_BY_TYPE matrix const definition", () => {
    const utils = readFileSync(
      resolve(FEATURES_DIR, "account-subtype.utils.ts"),
      "utf-8",
    );
    const resolve_ = readFileSync(
      resolve(FEATURES_DIR, "account-subtype.resolve.ts"),
      "utf-8",
    );
    expect(utils).not.toMatch(/SUBTYPES_BY_TYPE\s*=/);
    expect(resolve_).not.toMatch(/SUBTYPES_BY_TYPE\s*=/);
  });
});

// ── α14–α16: Barrel extension ─────────────────────────────────────────────────

describe("α14–α15 barrel exports new account-subtype domain files", () => {
  it("α14: barrel exports ../domain/account-subtype.utils", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(
      /export \* from "\.\.\/domain\/account-subtype\.utils"/,
    );
  });

  it("α15: barrel exports ../domain/account-subtype.resolve", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(
      /export \* from "\.\.\/domain\/account-subtype\.resolve"/,
    );
  });
});

describe("α16 barrel Domain utils block preserved", () => {
  it("α16: server.ts contains '// ── Domain utils ──' comment", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(/\/\/ ── Domain utils ──/);
  });
});

// ── α17–α19: POC sentinel preservation ───────────────────────────────────────

describe("α17–α19 POC #1 + #2a + #2b sentinel exports preserved", () => {
  it("α17: barrel still contains POC #1 sentinel — export { JournalsService }", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(/export\s+\{[^}]*JournalsService[^}]*\}/);
  });

  it("α18: barrel still contains POC #2a sentinel — export type * from ./dto/accounts.types", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(
      /export\s+type\s+\*\s+from\s+["']\.\/dto\/accounts\.types["']/,
    );
  });

  it("α19: barrel still contains POC #2b sentinel — export * from ../domain/journal.dates", () => {
    const content = readFileSync(BARREL, "utf-8");
    expect(content).toMatch(
      /export \* from "\.\.\/domain\/journal\.dates"/,
    );
  });
});

// ── α20–α21: CRITICAL client-bundle gate (NO server-only) ────────────────────

describe("α20–α21 CRITICAL: no server-only in new domain files (3 client consumers)", () => {
  it("α20: domain/account-subtype.utils.ts does NOT contain import 'server-only'", () => {
    const filePath = resolve(DOMAIN_DIR, "account-subtype.utils.ts");
    if (!existsSync(filePath)) {
      // Pre-GREEN: file absent → no server-only possible, PASS vacuously
      return;
    }
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toMatch(/import\s+["']server-only["']/);
  });

  it("α21: domain/account-subtype.resolve.ts does NOT contain import 'server-only'", () => {
    const filePath = resolve(DOMAIN_DIR, "account-subtype.resolve.ts");
    if (!existsSync(filePath)) {
      // Pre-GREEN: file absent → no server-only possible, PASS vacuously
      return;
    }
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toMatch(/import\s+["']server-only["']/);
  });
});

// ── α22: Internal helpers private (NOT in features SHIMs) ────────────────────

describe("α22 internal helpers not propagated via SHIM", () => {
  it("α22: CODE_LEVEL2_TO_SUBTYPE and extractLevel2Code NOT present in features SHIM files", () => {
    const utils = readFileSync(
      resolve(FEATURES_DIR, "account-subtype.utils.ts"),
      "utf-8",
    );
    const resolve_ = readFileSync(
      resolve(FEATURES_DIR, "account-subtype.resolve.ts"),
      "utf-8",
    );
    expect(utils).not.toMatch(/CODE_LEVEL2_TO_SUBTYPE/);
    expect(utils).not.toMatch(/extractLevel2Code/);
    expect(resolve_).not.toMatch(/CODE_LEVEL2_TO_SUBTYPE/);
    expect(resolve_).not.toMatch(/extractLevel2Code/);
  });
});
