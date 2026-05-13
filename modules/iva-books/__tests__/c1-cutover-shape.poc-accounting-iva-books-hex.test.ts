import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const MODULE_ROOT = path.resolve(__dirname, "..");
const INFRA_EXPORTERS = path.resolve(MODULE_ROOT, "infrastructure/exporters");

const readConsumer = (rel: string) =>
  readFileSync(path.resolve(process.cwd(), rel), "utf-8");

// ── Block 1 — Exporter at infrastructure location (REQ-006) ──────────────────

describe("Block 1 — Exporter at infrastructure location (REQ-006)", () => {
  it("α19: infrastructure/exporters/iva-book-xlsx.exporter.ts exists", () => {
    // FAIL pre-GREEN — exporter not yet git mv'd
    expect(
      existsSync(path.join(INFRA_EXPORTERS, "iva-book-xlsx.exporter.ts"))
    ).toBe(true);
  });

  it("α20: infrastructure/exporters/iva-book-xlsx.sheet-builder.ts exists", () => {
    // FAIL pre-GREEN — sheet-builder not yet git mv'd + renamed
    expect(
      existsSync(path.join(INFRA_EXPORTERS, "iva-book-xlsx.sheet-builder.ts"))
    ).toBe(true);
  });

  it("α21: exportIvaBookExcel exported from infrastructure/exporters/iva-book-xlsx.exporter", () => {
    // ENOENT pre-GREEN — exporter file absent
    const content = readFileSync(
      path.join(INFRA_EXPORTERS, "iva-book-xlsx.exporter.ts"),
      "utf-8"
    );
    expect(content).toMatch(/export.*exportIvaBookExcel/m);
  });

  it("α22: presentation/server.ts contains real exportIvaBookExcel import (not placeholder)", () => {
    // ASSERTION MISMATCH pre-GREEN — server.ts has placeholder comment, not real import
    const content = readFileSync(
      path.join(MODULE_ROOT, "presentation/server.ts"),
      "utf-8"
    );
    expect(content).toMatch(/exportIvaBookExcel/m);
  });
});

// ── Block 2 — Export routes repointed (REQ-006, REQ-007) ─────────────────────

describe("Block 2 — Export routes repointed (REQ-006, REQ-007)", () => {
  it("α23: purchases export route does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — route still imports from features/
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/purchases/export/route.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α24: purchases export route imports from @/modules/iva-books/presentation/server", () => {
    // ASSERTION MISMATCH pre-GREEN — route not yet repointed
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/purchases/export/route.ts"
      )
    ).toContain("@/modules/iva-books/presentation/server");
  });

  it("α25: sales export route does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — route still imports from features/
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/sales/export/route.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });
});

// ── Block 3 — Entity-to-dto bridges repointed (REQ-005, REQ-007) ─────────────

describe("Block 3 — Entity-to-dto bridges repointed (REQ-005, REQ-007)", () => {
  it("α26: purchases entity-to-dto does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — bridge still imports TASA_IVA from features/
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/purchases/export/entity-to-dto.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α27: purchases entity-to-dto imports from @/modules/iva-books/presentation/server", () => {
    // ASSERTION MISMATCH pre-GREEN — bridge not yet repointed
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/purchases/export/entity-to-dto.ts"
      )
    ).toContain("@/modules/iva-books/presentation/server");
  });

  it("α28: sales entity-to-dto does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — bridge still imports from features/
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/sales/export/entity-to-dto.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });
});

// ── Block 4 — Cross-module type consumers (REQ-011, REQ-007) ─────────────────

describe("Block 4 — Cross-module type consumers repointed (REQ-011, REQ-007)", () => {
  it("α29: modules/purchase/presentation/dto/purchase-with-details.ts does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — still imports from features/
    expect(
      readConsumer(
        "modules/purchase/presentation/dto/purchase-with-details.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α30: modules/purchase/presentation/dto/purchase-with-details.ts imports from @/modules/iva-books/presentation/index", () => {
    // ASSERTION MISMATCH pre-GREEN — not yet repointed
    expect(
      readConsumer(
        "modules/purchase/presentation/dto/purchase-with-details.ts"
      )
    ).toContain("@/modules/iva-books/presentation/index");
  });

  it("α31: modules/sale/presentation/dto/sale-with-details.ts does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — still imports from features/
    expect(
      readConsumer("modules/sale/presentation/dto/sale-with-details.ts")
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α32: modules/sale/presentation/dto/sale-with-details.ts imports from @/modules/iva-books/presentation/index", () => {
    // ASSERTION MISMATCH pre-GREEN — not yet repointed
    expect(
      readConsumer("modules/sale/presentation/dto/sale-with-details.ts")
    ).toContain("@/modules/iva-books/presentation/index");
  });
});

// ── Block 5 — REQ-001 NEGATIVE global grep (production files) ────────────────

describe("Block 5 — REQ-001 NEGATIVE global grep (production files)", () => {
  it("α33: zero non-test files in app/, components/, modules/ import @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — consumers still on features/ path
    const raw = execSync(
      'git grep "@/features/accounting/iva-books" -- app/ components/ modules/ 2>/dev/null || true'
    ).toString();
    // Filter out test files and comment-only lines
    const nonTestLines = raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .filter((line) => !line.includes("__tests__") && !line.includes(".test."))
      .filter((line) => {
        // Exclude lines that are comments only (start with * or //)
        const content = line.split(":").slice(2).join(":").trim();
        return !content.startsWith("*") && !content.startsWith("//");
      });
    expect(nonTestLines.join("\n")).toHaveLength(0);
  });
});

// ── Block 6 — vi.mock rewrites (mock_hygiene_commit_scope) ───────────────────

describe("Block 6 — vi.mock rewrites repointed", () => {
  it("α34: purchases export route.test.ts does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — vi.mock still targets features/ path
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/purchases/export/__tests__/route.test.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α35: sales export route.test.ts does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — vi.mock still targets features/ path
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/sales/export/__tests__/route.test.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α36: purchases export route.test.ts vi.mock targets @/modules/iva-books/presentation/server", () => {
    // ASSERTION MISMATCH pre-GREEN — vi.mock not yet rewritten
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/purchases/export/__tests__/route.test.ts"
      )
    ).toContain("@/modules/iva-books/presentation/server");
  });
});

// ── Block 7 — Closed-POC sibling sentinel preservation ───────────────────────

describe("Block 7 — Closed-POC sibling sentinel preservation", () => {
  it("α37: IB c5-wholesale-delete sentinel still exists (sibling NOT regressed)", () => {
    // PASS pre-GREEN — IB sentinel unaffected by consumer cutover
    const IB_C5_SENTINEL_PATH = path.resolve(
      process.cwd(),
      "modules/accounting/initial-balance/__tests__/c5-wholesale-delete-shape.poc-accounting-initial-balance-hex.test.ts"
    );
    expect(existsSync(IB_C5_SENTINEL_PATH)).toBe(true);
  });
});

// ── Block 8 — CRUD routes repointed (REQ-007) ────────────────────────────────

describe("Block 8 — CRUD routes repointed", () => {
  it("α38: purchases CRUD route does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — route still imports from features/
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/purchases/route.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α39: sales CRUD route does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — route still imports from features/
    expect(
      readConsumer(
        "app/api/organizations/[orgSlug]/iva-books/sales/route.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });
});

// ── Block 9 — Pages + components repointed ───────────────────────────────────

describe("Block 9 — Pages + components repointed", () => {
  it("α40: dashboard purchases page does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — page still imports type from features/
    expect(
      readConsumer(
        "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α41: components/iva-books/iva-books-page-client.tsx does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — component still imports from features/
    expect(
      readConsumer("components/iva-books/iva-books-page-client.tsx")
    ).not.toContain("@/features/accounting/iva-books");
  });
});

// ── Block 10 — Cross-module mappers repointed ─────────────────────────────────

describe("Block 10 — Cross-module mappers repointed", () => {
  it("α42: modules/purchase/presentation/mappers/purchase-to-with-details.mapper.ts does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — mapper still imports from features/
    expect(
      readConsumer(
        "modules/purchase/presentation/mappers/purchase-to-with-details.mapper.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });

  it("α43: modules/sale/presentation/mappers/sale-to-with-details.mapper.ts does NOT contain @/features/accounting/iva-books", () => {
    // ASSERTION MISMATCH pre-GREEN — mapper still imports from features/
    expect(
      readConsumer(
        "modules/sale/presentation/mappers/sale-to-with-details.mapper.ts"
      )
    ).not.toContain("@/features/accounting/iva-books");
  });
});
