import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — Repoint-shape tests for poc-accounting-exporters-cleanup
 * (OLEADA 6 sub-POC 6/8). NEW shape — no paired sister (shared-extraction).
 *
 * Strategy: readFileSync + toMatch / existsSync assertions on consumer and
 * money.utils files. C1 does an atomic `git mv` of pdf.fonts.ts + pdf.helpers.ts
 * from financial-statements/infrastructure/exporters/ → shared/infrastructure/
 * exporters/, repoints 7 import sites, and rewrites 4 module money.utils into
 * thin re-export shims (+ FS money.utils re-export). This sentinel asserts the
 * POST-GREEN state, so pre-GREEN it fails with assertion-mismatch (old FS-infra
 * substring still present / shared files absent).
 *
 * Blocks (22α — α11..α32):
 * - Block 1 (α11..α17, EX-D4): 7 consumers import pdf.fonts/pdf.helpers from
 *   @/modules/accounting/shared/infrastructure/exporters; old FS-infra path has
 *   zero importers.
 * - Block 2 (α18..α25, EX-D3): TB/ES/WS/IB domain/money.utils.ts are thin
 *   re-export shims from @/modules/accounting/shared/domain/money.utils with NO
 *   standalone sumDecimals implementation.
 * - Block 3 (α26..α27, EX-D3): FS domain/money.utils.ts re-exports sumDecimals+eq
 *   from shared yet KEEPS its richer fns (roundHalfUp).
 * - Block 4 (α28..α32, EX-D4): pdf.fonts.ts + pdf.helpers.ts exist at the shared
 *   canonical home with registerFonts/fmtDecimal exported; the old FS-infra
 *   pdf.fonts.ts no longer exists.
 *
 * Expected RED failure mode [[red_acceptance_failure_mode]]:
 * - α11..α16 (6 consumers on old path): ASSERTION-MISMATCH → 6 FAIL
 * - α17 (old FS-infra path still imported): ASSERTION-MISMATCH → 1 FAIL
 * - α18..α25 except α27 (8 money.utils shim asserts not yet written): 8 FAIL
 * - α26 (FS re-export not yet present): 1 FAIL
 * - α27 (FS still exports roundHalfUp — true pre AND post): 1 PASS
 * - α28..α32 (post-git-mv existence checks): 5 FAIL
 * - Pre-GREEN ledger: 21 FAIL + 1 PASS in this file (+ 6 inverted REQ-010
 *   sentinels FAIL elsewhere = 27 FAIL total at C1 RED).
 * - Post-C1-GREEN ledger: α11..α32 ALL PASS (22 PASS).
 *
 * Cross-refs: spec #2360, design #2358, proposal #2357, tasks #2361.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const readFile = (rel: string): string =>
  readFileSync(path.resolve(ROOT, rel), "utf-8");

const SHARED_EXPORTERS_RE =
  /from\s+["']@\/modules\/accounting\/shared\/infrastructure\/exporters/m;
const FS_INFRA_EXPORTERS_RE =
  /from\s+["']@\/modules\/accounting\/financial-statements\/infrastructure\/exporters/m;
const SHARED_MONEY_RE =
  /from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m;
const STANDALONE_SUMDECIMALS_RE = /export\s+function\s+sumDecimals/m;

const SHARED_INFRA_EXPORTERS = path.join(
  ROOT,
  "modules/accounting/shared/infrastructure/exporters",
);
const FS_INFRA_EXPORTERS = path.join(
  ROOT,
  "modules/accounting/financial-statements/infrastructure/exporters",
);

const PDF_CONSUMERS = [
  "modules/accounting/trial-balance/infrastructure/exporters/trial-balance-pdf.exporter.ts",
  "modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter.ts",
  "modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter.ts",
  "modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter.ts",
  "features/accounting/exporters/voucher-pdf.exporter.ts",
  "modules/accounting/financial-statements/infrastructure/exporters/pdf.exporter.ts",
];

describe("C1 — Block 1: 7 consumers import pdf helpers from shared (EX-D4)", () => {
  it("α11: TB trial-balance-pdf.exporter imports from shared/infrastructure/exporters", () => {
    expect(
      readFile(
        "modules/accounting/trial-balance/infrastructure/exporters/trial-balance-pdf.exporter.ts",
      ),
    ).toMatch(SHARED_EXPORTERS_RE);
  });

  it("α12: ES equity-statement-pdf.exporter imports from shared/infrastructure/exporters", () => {
    expect(
      readFile(
        "modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter.ts",
      ),
    ).toMatch(SHARED_EXPORTERS_RE);
  });

  it("α13: WS worksheet-pdf.exporter imports from shared/infrastructure/exporters", () => {
    expect(
      readFile(
        "modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter.ts",
      ),
    ).toMatch(SHARED_EXPORTERS_RE);
  });

  it("α14: IB initial-balance-pdf.exporter imports from shared/infrastructure/exporters", () => {
    expect(
      readFile(
        "modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter.ts",
      ),
    ).toMatch(SHARED_EXPORTERS_RE);
  });

  it("α15: voucher-pdf.exporter (features/accounting/exporters) imports from shared/infrastructure/exporters", () => {
    expect(
      readFile("features/accounting/exporters/voucher-pdf.exporter.ts"),
    ).toMatch(SHARED_EXPORTERS_RE);
  });

  it("α16: FS pdf.exporter imports pdf.fonts from shared/infrastructure/exporters (was ./pdf.fonts relative)", () => {
    expect(
      readFile(
        "modules/accounting/financial-statements/infrastructure/exporters/pdf.exporter.ts",
      ),
    ).toMatch(SHARED_EXPORTERS_RE);
  });

  it("α17: NEGATIVE — no consumer imports pdf.fonts/pdf.helpers from the old FS-infra exporters path", () => {
    for (const rel of PDF_CONSUMERS) {
      const content = readFile(rel);
      const pdfHelperImports = content
        .split("\n")
        .filter((line) => /pdf\.(fonts|helpers)/.test(line))
        .filter((line) => /from\s+["']/.test(line));
      for (const line of pdfHelperImports) {
        expect(line).not.toMatch(FS_INFRA_EXPORTERS_RE);
      }
    }
  });
});

describe("C1 — Block 2: TB/ES/WS/IB money.utils are re-export shims (EX-D3)", () => {
  it("α18: TB domain/money.utils.ts re-exports from shared/domain/money.utils", () => {
    expect(
      readFile("modules/accounting/trial-balance/domain/money.utils.ts"),
    ).toMatch(SHARED_MONEY_RE);
  });

  it("α19: ES domain/money.utils.ts re-exports from shared/domain/money.utils", () => {
    expect(
      readFile("modules/accounting/equity-statement/domain/money.utils.ts"),
    ).toMatch(SHARED_MONEY_RE);
  });

  it("α20: WS domain/money.utils.ts re-exports from shared/domain/money.utils", () => {
    expect(
      readFile("modules/accounting/worksheet/domain/money.utils.ts"),
    ).toMatch(SHARED_MONEY_RE);
  });

  it("α21: IB domain/money.utils.ts re-exports from shared/domain/money.utils", () => {
    expect(
      readFile("modules/accounting/initial-balance/domain/money.utils.ts"),
    ).toMatch(SHARED_MONEY_RE);
  });

  it("α22: TB money.utils has NO standalone sumDecimals implementation", () => {
    expect(
      readFile("modules/accounting/trial-balance/domain/money.utils.ts"),
    ).not.toMatch(STANDALONE_SUMDECIMALS_RE);
  });

  it("α23: ES money.utils has NO standalone sumDecimals implementation", () => {
    expect(
      readFile("modules/accounting/equity-statement/domain/money.utils.ts"),
    ).not.toMatch(STANDALONE_SUMDECIMALS_RE);
  });

  it("α24: WS money.utils has NO standalone sumDecimals implementation", () => {
    expect(
      readFile("modules/accounting/worksheet/domain/money.utils.ts"),
    ).not.toMatch(STANDALONE_SUMDECIMALS_RE);
  });

  it("α25: IB money.utils has NO standalone sumDecimals implementation", () => {
    expect(
      readFile("modules/accounting/initial-balance/domain/money.utils.ts"),
    ).not.toMatch(STANDALONE_SUMDECIMALS_RE);
  });
});

describe("C1 — Block 3: FS money.utils re-exports shared + keeps richer fns (EX-D3)", () => {
  it("α26: FS domain/money.utils.ts re-exports sumDecimals+eq from shared/domain/money.utils", () => {
    const content = readFile(
      "modules/accounting/financial-statements/domain/money.utils.ts",
    );
    expect(content).toMatch(SHARED_MONEY_RE);
    expect(content).toMatch(
      /export\s+\{[^}]*\bsumDecimals\b[^}]*\beq\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m,
    );
  });

  it("α27: FS money.utils still exports roundHalfUp (richer fns preserved)", () => {
    expect(
      readFile(
        "modules/accounting/financial-statements/domain/money.utils.ts",
      ),
    ).toMatch(/export\s+function\s+roundHalfUp/m);
  });
});

describe("C1 — Block 4: pdf helpers exist at shared canonical home (EX-D4)", () => {
  it("α28: shared/infrastructure/exporters/pdf.fonts.ts exists", () => {
    expect(existsSync(path.join(SHARED_INFRA_EXPORTERS, "pdf.fonts.ts"))).toBe(
      true,
    );
  });

  it("α29: shared/infrastructure/exporters/pdf.helpers.ts exists", () => {
    expect(
      existsSync(path.join(SHARED_INFRA_EXPORTERS, "pdf.helpers.ts")),
    ).toBe(true);
  });

  it("α30: registerFonts exported from shared pdf.fonts.ts", () => {
    expect(
      readFile("modules/accounting/shared/infrastructure/exporters/pdf.fonts.ts"),
    ).toMatch(/export\s+function\s+registerFonts/m);
  });

  it("α31: fmtDecimal exported from shared pdf.helpers.ts", () => {
    expect(
      readFile(
        "modules/accounting/shared/infrastructure/exporters/pdf.helpers.ts",
      ),
    ).toMatch(/export\s+function\s+fmtDecimal/m);
  });

  it("α32: old FS-infra pdf.fonts.ts no longer exists (git mv, not copy)", () => {
    expect(existsSync(path.join(FS_INFRA_EXPORTERS, "pdf.fonts.ts"))).toBe(
      false,
    );
  });
});
