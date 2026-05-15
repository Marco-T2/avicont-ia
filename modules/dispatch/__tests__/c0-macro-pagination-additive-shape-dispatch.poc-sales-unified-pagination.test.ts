/**
 * C0 RED MACRO — poc-sales-unified-pagination additive shape sentinels.
 *
 * 10α existence-only sentinels covering the 3-touchpoint dispatch
 * pagination cascade (port + adapter + service), RSC twin-call UNION
 * total math, and TransactionsList pagination UI primitives.
 *
 * Cumulative §13.7 pattern (drop T11 shadcn heredado): only POC-specific
 * deliverables are asserted. Regex line-bound `[^\n]*` per
 * [[sentinel_regex_line_bound]]; `^...$m` import-line anchors per
 * [[red_regex_discipline]].
 *
 * Expected failure mode (RED): ALL 10 FAIL — `findPaginated`/`listPaginated`
 * absent from dispatch hex; RSC still calls `dispatchService.list()` (no
 * sum math); TransactionsList still lacks Pagination block + buildHref.
 * GREEN cascade C1 → α01-α06; GREEN C2 → α07-α10.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("C0 MACRO — poc-sales-unified-pagination additive shape sentinels", () => {
  it("α01 — DispatchRepository port declares findPaginated signature", () => {
    const src = read("modules/dispatch/domain/ports/dispatch.repository.ts");
    expect(src).toMatch(/^\s*findPaginated\([^\n]*/m);
  });

  it("α02 — DispatchRepository port returns Promise<PaginatedResult<Dispatch>>", () => {
    const src = read("modules/dispatch/domain/ports/dispatch.repository.ts");
    expect(src).toMatch(/Promise<PaginatedResult<Dispatch>>/);
  });

  it("α03 — PrismaDispatchRepository implements async findPaginated", () => {
    const src = read(
      "modules/dispatch/infrastructure/prisma-dispatch.repository.ts",
    );
    expect(src).toMatch(/async findPaginated\([^\n]*/);
  });

  it("α04 — PrismaDispatchRepository adapter uses Promise.all([findMany, count])", () => {
    const src = read(
      "modules/dispatch/infrastructure/prisma-dispatch.repository.ts",
    );
    expect(src).toMatch(/Promise\.all\(\[[^\]]*findMany[^\]]*count[^\]]*\]\)/s);
  });

  it("α05 — DispatchService declares async listPaginated", () => {
    const src = read("modules/dispatch/application/dispatch.service.ts");
    expect(src).toMatch(/^\s*async listPaginated\([^\n]*/m);
  });

  it("α06 — DispatchService listPaginated returns Promise<PaginatedResult<Dispatch>>", () => {
    const src = read("modules/dispatch/application/dispatch.service.ts");
    expect(src).toMatch(/Promise<PaginatedResult<Dispatch>>/);
  });

  it("α07 — /sales RSC calls dispatchService.listPaginated (twin-call wired)", () => {
    const src = read("app/(dashboard)/[orgSlug]/sales/page.tsx");
    expect(src).toMatch(/dispatchService\.listPaginated\([^\n]*/);
  });

  it("α08 — /sales RSC computes UNION total = sale.total + dispatch.total", () => {
    const src = read("app/(dashboard)/[orgSlug]/sales/page.tsx");
    expect(src).toMatch(/[^\n]*\.total\s*\+\s*[^\n]*\.total/);
  });

  it("α09 — TransactionsList imports shadcn Pagination primitives", () => {
    const src = read("components/sales/transactions-list.tsx");
    expect(src).toMatch(
      /import\s*\{[^}]*Pagination[^}]*\}\s*from\s*"@\/components\/ui\/pagination"/,
    );
  });

  it("α10 — TransactionsList defines buildHref helper", () => {
    const src = read("components/sales/transactions-list.tsx");
    expect(src).toMatch(/function\s+buildHref\([^\n]*/);
  });
});
