import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const MODULE_ROOT = path.resolve(__dirname, "..");
const DOMAIN_ROOT = path.resolve(MODULE_ROOT, "domain");
const PRES_ROOT = path.resolve(MODULE_ROOT, "presentation");

const readDomainFile = (rel: string) =>
  readFileSync(path.join(DOMAIN_ROOT, rel), "utf-8");
const readPresFile = (rel: string) =>
  readFileSync(path.join(PRES_ROOT, rel), "utf-8");

// ── Block 1 — DTO types in domain (REQ-003) ───────────────────────────────────

describe("Block 1 — DTO types in domain (REQ-003)", () => {
  it("α1: IvaPurchaseBookDTO exported from domain/iva-books.types", () => {
    // ENOENT pre-GREEN — file absent
    expect(readDomainFile("iva-books.types.ts")).toMatch(
      /export\s+(?:interface|type)\s+IvaPurchaseBookDTO\b/m
    );
  });

  it("α2: IvaSalesBookDTO exported from domain/iva-books.types", () => {
    // ENOENT pre-GREEN — file absent
    expect(readDomainFile("iva-books.types.ts")).toMatch(
      /export\s+(?:interface|type)\s+IvaSalesBookDTO\b/m
    );
  });
});

// ── Block 2 — Validation schemas in domain (REQ-004) ─────────────────────────

describe("Block 2 — Validation schemas in domain (REQ-004)", () => {
  it("α3: createPurchaseInputSchema exported from domain/iva-books.validation", () => {
    // ENOENT pre-GREEN — file absent
    expect(readDomainFile("iva-books.validation.ts")).toMatch(
      /export\s+const\s+createPurchaseInputSchema\b/m
    );
  });

  it("α4: createSaleInputSchema exported from domain/iva-books.validation", () => {
    // ENOENT pre-GREEN — file absent
    expect(readDomainFile("iva-books.validation.ts")).toMatch(
      /export\s+const\s+createSaleInputSchema\b/m
    );
  });

  it("α5: listQuerySchema exported from domain/iva-books.validation", () => {
    // ENOENT pre-GREEN — file absent
    expect(readDomainFile("iva-books.validation.ts")).toMatch(
      /export\s+const\s+listQuerySchema\b/m
    );
  });
});

// ── Block 3 — P3.4 textual lock (REQ-005, IVA-D2) ────────────────────────────

describe("Block 3 — P3.4 textual lock at new location (REQ-005, IVA-D2)", () => {
  it("α6: TASA_IVA as Prisma.Decimal('0.1300') in presentation/legacy-bridge-constants.ts", () => {
    // ENOENT pre-GREEN — file absent
    expect(readPresFile("legacy-bridge-constants.ts")).toMatch(
      /export\s+const\s+TASA_IVA\s*=\s*new\s+Prisma\.Decimal\("0\.1300"\)/m
    );
  });
});

// ── Block 4 — presentation/server.ts re-exports (REQ-003, REQ-004, REQ-005) ──

describe("Block 4 — presentation/server.ts re-exports", () => {
  it("α7: IvaPurchaseBookDTO referenced in presentation/server.ts", () => {
    // ASSERTION MISMATCH pre-GREEN — file exists but symbol absent
    expect(readPresFile("server.ts")).toMatch(/IvaPurchaseBookDTO/m);
  });

  it("α8: IvaSalesBookDTO referenced in presentation/server.ts", () => {
    // ASSERTION MISMATCH pre-GREEN — file exists but symbol absent
    expect(readPresFile("server.ts")).toMatch(/IvaSalesBookDTO/m);
  });

  it("α9: TASA_IVA referenced in presentation/server.ts", () => {
    // ASSERTION MISMATCH pre-GREEN — file exists but symbol absent
    expect(readPresFile("server.ts")).toMatch(/TASA_IVA/m);
  });

  it("α10: createPurchaseInputSchema referenced in presentation/server.ts", () => {
    // ASSERTION MISMATCH pre-GREEN — file exists but symbol absent
    expect(readPresFile("server.ts")).toMatch(/createPurchaseInputSchema/m);
  });
});

// ── Block 5 — presentation/index.ts client-safe barrel (REQ-002, REQ-003, IVA-D1) ──

describe("Block 5 — presentation/index.ts client-safe barrel (IVA-D1)", () => {
  it("α11: presentation/index.ts exists", () => {
    // FAIL pre-GREEN — file absent (IVA-D1: created this POC)
    expect(existsSync(path.join(PRES_ROOT, "index.ts"))).toBe(true);
  });

  it("α12: index.ts re-exports IvaPurchaseBookDTO", () => {
    // ENOENT pre-GREEN — file absent
    expect(readPresFile("index.ts")).toMatch(/IvaPurchaseBookDTO/m);
  });

  it("α13: index.ts re-exports IvaSalesBookDTO", () => {
    // ENOENT pre-GREEN — file absent
    expect(readPresFile("index.ts")).toMatch(/IvaSalesBookDTO/m);
  });

  it("α14: index.ts does NOT contain import 'server-only' (client-safe)", () => {
    // ENOENT pre-GREEN — file absent
    expect(readPresFile("index.ts")).not.toMatch(
      /import\s+["']server-only["']/m
    );
  });
});

// ── Block 6 — D5 INVERSE gate (REQ-002) ──────────────────────────────────────

describe("Block 6 — D5 INVERSE gate (REQ-002)", () => {
  it("α15: presentation/server.ts line 1 is import 'server-only' (positional)", () => {
    // PASS pre-GREEN — already present
    const lines = readPresFile("server.ts").split("\n");
    expect(lines[0]?.trim()).toMatch(/^import\s+["']server-only["'];?$/);
  });

  it("α16: NO presentation/client.ts exists", () => {
    // PASS pre-GREEN — never existed
    expect(existsSync(path.join(PRES_ROOT, "client.ts"))).toBe(false);
  });
});

// ── Block 7 — REQ-012 NEGATIVE: no legacy class names ────────────────────────

describe("Block 7 — REQ-012 NEGATIVE: no legacy class names in presentation barrels", () => {
  it("α17: presentation/server.ts does NOT match IvaBooksService", () => {
    // PASS pre-GREEN — symbol absent (A2 already deleted)
    expect(readPresFile("server.ts")).not.toMatch(/IvaBooksService\b/m);
  });

  it("α18: presentation/server.ts does NOT match IvaBooksRepository", () => {
    // PASS pre-GREEN — symbol absent (A2 already deleted)
    expect(readPresFile("server.ts")).not.toMatch(/IvaBooksRepository\b/m);
  });
});
