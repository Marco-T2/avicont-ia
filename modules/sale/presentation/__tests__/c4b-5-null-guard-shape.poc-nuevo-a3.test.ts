/**
 * POC nuevo A3-C4b.5 — sale detail null guard paired follow-up shape (§13.AC-sale-paged).
 *
 * Axis: paired faithful follow-up A3-C4b sale detail cutover. §13.AC-sale-paged
 * latent bug surface (variante 3) — sale detail page DRAFT sales (sequenceNumber=null)
 * llegan al mapper desde `saleService.getById(orgId, saleId)`. Mapper post
 * A3-C4a.5 (b3) refactor consume `deps.displayCode` (NO compute internal) →
 * caller responsibility null guard ternary mirror A3-C4a.5 EXACT pattern.
 *
 * Resolution mirror A3-C4a.5 GREEN aplicado A3-C4b.5: page caller imports
 * SALE_PREFIX + computeDisplayCode + null guard ternary + ${SALE_PREFIX}-DRAFT
 * fallback. Mapper signature ya refactored A3-C4a.5 — A3-C4b.5 SOLO page
 * caller scope (no mapper changes). Compact RED scope vs A3-C4a.5 (3 positive
 * source-shape page-only).
 *
 * Sub-§13 in-flight surface absorbed inline GREEN (NO formal — engram-only):
 * `sales/[saleId]/__tests__/page-rbac.test.ts:48-50` mock mapper module solo
 * expone `toSaleWithDetails`. Post A3-C4a.5 GREEN page importa también
 * SALE_PREFIX + computeDisplayCode → mock debe exponer ambos o crash runtime
 * "computeDisplayCode is not a function". Resolution: expand mock factory
 * con SALE_PREFIX + computeDisplayCode stubs (mirror A3-C4a.5 page test
 * mock anomaly absorption pattern engram #1532).
 *
 * Cross-ref:
 * - A3-C4a.5 paired precedent: engram `poc-nuevo/a3/c4a-5/closed` (commit 5d9b240)
 * - A3-C4b sale detail cutover (latent bug introduction): engram `poc-nuevo/a3/c4b/closed` (#1532)
 * - A3-C5 §13.AC HubService precedent: engram `poc-nuevo/a3/c5/closed` (#1534)
 * - SubQ-d fail-fast lock cementación: engram `poc-nuevo/a3/c3/closed` (#1525)
 * - Mapper file (signature post-A3-C4a.5): modules/sale/presentation/mappers/sale-to-with-details.mapper.ts
 * - Page file: app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx
 *
 * Lección #11 6ta evidencia maturation refinement: page-rbac.test mock module
 * factory debe exponer ALL exports consumed por page post-mapper refactor —
 * pre-recon grep mocks-vs-imports cross-check NO solo source-shape page.
 *
 * Lección #12 candidate 2da evidencia formal: "Cutover RED scope debe incluir
 * runtime path coverage (status enums + null branches), NO solo __tests__
 * paths (lección #11) ni shape source (lección #10)" — sale detail share misma
 * masking pattern como sale list (page-rbac.test mocks mapper bypassing real
 * code path). Cementación post-A3-C4b.5 GREEN cumulative reinforcement.
 *
 * Expected RED failure mode (verify pre-GREEN):
 * - 3 positive FAIL: page imports SALE_PREFIX + computeDisplayCode from
 *   mapper + page contains null guard ternary sequenceNumber !==/=== null +
 *   page contains template literal `${SALE_PREFIX}-DRAFT`
 *
 * Total expected RED: 3/3 fail. Post-GREEN: 3/3 pass (+3 net suite delta).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../../../app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx",
);

const pageSource = readFileSync(PAGE_PATH, "utf-8");

describe("A3-C4b.5 RED null guard shape — sale detail paired §13.AC-sale-paged", () => {
  // ── Page caller changes (positive — 3 assertions) ──────────────────────────

  it("Test 1: page imports SALE_PREFIX + computeDisplayCode from mapper module", () => {
    expect(pageSource).toMatch(/SALE_PREFIX/);
    expect(pageSource).toMatch(/computeDisplayCode/);
    expect(pageSource).toMatch(
      /from\s+["']@\/modules\/sale\/presentation\/mappers\/sale-to-with-details\.mapper["']/,
    );
  });

  it("Test 2: page contains null guard ternary pattern sequenceNumber !== null o === null", () => {
    expect(pageSource).toMatch(/sequenceNumber\s*(!==|===)\s*null/);
  });

  it("Test 3: page contains template literal `${SALE_PREFIX}-DRAFT` fallback", () => {
    expect(pageSource).toMatch(/\$\{SALE_PREFIX\}-DRAFT/);
  });
});
