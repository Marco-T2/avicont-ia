/**
 * POC nuevo pagination-sale C0 RED — shared canonical home shape (3 source NEW
 * + 1 RED test NEW single batch atomic split RED-α + GREEN). Establishes shared
 * pagination primitives consumed downstream C1-C5 Sale pilot ~6 ciclos + D1.
 *
 * Marco lock pre-RED (Step 0 expand 1-9 verified este turno):
 *   L1 zod schema location = `modules/shared/presentation/pagination.schema.ts`
 *      NEW carve-out (HTTP boundary translation = presentation concern).
 *   L2 helper location = `modules/shared/presentation/parse-pagination-params.ts`
 *      co-located con schema (HTTP boundary URLSearchParams → PaginationOptions).
 *   L3 test location = `modules/shared/presentation/__tests__/c0-pagination-shape.poc-nuevo-pagination-sale.test.ts`.
 *   Granularity α = single cycle 4 archivos atomic split RED+GREEN (NO C0a/C0b).
 *
 * §13 NEW emergentes pre-RED (D1 cumulative cementación target):
 *   1. §13 NEW shared/presentation/ carve-out 1ra evidencia matures (paired
 *      sister shared/domain VO + shared/infrastructure adapters precedent).
 *   2. §13 NEW shared route helper canonical home 1ra evidencia (fresh terrain
 *      zero precedent — 38 routes parse inline searchParams pre-C0).
 *   3. §13 NEW VO interface plain pattern axis-distinct vs Money/MonetaryAmount
 *      class privada + static factory ≥2 evidencias 1ra evidencia (DTO-style
 *      types, NO behavioral methods — pagination es contrato shape, NO invariant).
 *   4. §13 NEW VO generic <T> pattern 1ra evidencia (vs Money/MonetaryAmount
 *      non-generic — `PaginatedResult<T>` parametriza payload items array).
 *   5. textual-rule-verification recursive structural conventions 7ma evidencia
 *      matures (4 conventions verified C0: VO file naming kebab-case 7+
 *      evidencias + zod location split A/B + route helper fresh terrain + VO
 *      shape pattern divergence).
 *
 * Cross-ref engrams cumulative:
 *   - `discovery/pagination-recon-fcdb399` #1782 (canonical home recon — 12
 *     listados + 7 axes Marco lock + VO shape canonical APROBADO + POC pilot
 *     scope ~6 ciclos + D1).
 *   - `baseline/fcdb399-enumerated-failure-ledger` #1780 (7f enumerated explicit
 *     pre-RED preserved {6,9} envelope membership).
 *   - `arch/lecciones/dispatches-hub-flake-recurrente` rev 8 (§13.A3-D4-α 31ª
 *     timeout pole stuck env-load contention paralelo).
 *   - `feedback_red_acceptance_failure_mode` (failure mode honest 4/4 enumerated
 *     ENOENT readFileSync forward-looking pre-GREEN).
 *   - `feedback_canonical_rule_application_commit_body` (cite + rationale +
 *     cross-ref applied RED body — §13 NEW emergentes 4 cementación targets D1).
 *   - `feedback_textual_rule_verification` (Step 0 expand 6 verified ≥3
 *     evidencias 2 conventions + 2 NEW canonical home Marco lock decisión).
 *
 * Cross-cycle RED test cementación gate forward-only C1-C5+D1:
 *   - C0 RED targets paths SHARED (modules/shared/{domain,presentation}/...).
 *   - C1-C5 future targets paths SALE-SPECIFIC (modules/sale/...).
 *   - ZERO path overlap + ZERO symbol collision + ZERO return-shape collision.
 *   - C0 establece símbolos consumidos (PaginationOptions + PaginatedResult<T> +
 *     paginationQuerySchema + parsePaginationParams) downstream NOT redefined.
 *
 * Granularity α RED scope (4α existence-only forward-looking):
 *   T1: pagination.ts contains `export interface PaginationOptions` (1-indexed
 *       page + pageSize default 25 max 100 + optional sortBy + optional sortOrder).
 *   T2: pagination.ts contains `export interface PaginatedResult` (generic <T>
 *       items array + total + page + pageSize + totalPages).
 *   T3: pagination.schema.ts contains `export const paginationQuerySchema` (zod
 *       object validating raw URLSearchParams → PaginationOptions shape).
 *   T4: parse-pagination-params.ts contains `export function parsePaginationParams`
 *       (HTTP boundary URLSearchParams → PaginationOptions VO conversion).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   T1-T4 FAIL: 4/4 ENOENT readFileSync (3 NEW source files NOT yet created
 *   pre-GREEN — VO + schema + helper). Test fails on file-system absence.
 *   Total expected FAIL pre-GREEN: 4/4 (Marco mandate failure mode honest
 *   enumerated existence-only red-regex-discipline).
 *
 * Source-string assertion pattern: mirror precedent payment C0-pre + paired-pr
 * C7-pre + cross-cycle C0/C1b/C3-C4/C5-C6 (`fs.readFileSync` regex match) — keep
 * pattern POC nuevo pagination-sale. Existence-only assertions verify shape
 * source post-GREEN; runtime behavior assertions defer downstream cycles when
 * VO consumed (C3 service signature + C4 route response wrap).
 *
 * Self-contained future-proof check (lección A6 #5): test asserta paths
 * `modules/shared/{domain,presentation}/...` que persisten post C5 UI wire-up
 * y post D1 cementación. Test vive en `modules/shared/presentation/__tests__/`
 * — NO toca `features/*` legacy ni `modules/sale/*` que cycles future tocarán.
 * Self-contained vs future cycles ✓.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C0 NEW canonical home targets (3 source files) ──────────────────────────

const VO_FILE = path.join(
  REPO_ROOT,
  "modules/shared/domain/value-objects/pagination.ts",
);
const SCHEMA_FILE = path.join(
  REPO_ROOT,
  "modules/shared/presentation/pagination.schema.ts",
);
const HELPER_FILE = path.join(
  REPO_ROOT,
  "modules/shared/presentation/parse-pagination-params.ts",
);

// ── Regex patterns existence-only (red-regex-discipline) ────────────────────

const VO_OPTIONS_RE = /export\s+interface\s+PaginationOptions\b/;
const VO_RESULT_RE = /export\s+interface\s+PaginatedResult\b/;
const SCHEMA_RE = /export\s+const\s+paginationQuerySchema\b/;
const HELPER_RE = /export\s+function\s+parsePaginationParams\b/;

describe("POC nuevo pagination-sale C0 — shared canonical home shape (pagination VO interfaces + presentation schema + presentation route helper, §13 NEW shared/presentation/ carve-out 1ra evidencia + §13 NEW VO interface plain axis-distinct + §13 NEW VO generic<T> + §13 NEW shared route helper canonical home 1ra evidencia, 4α existence-only forward-looking pre-GREEN 4/4 FAIL ENOENT readFileSync)", () => {
  // ── A: Shared domain VO interfaces (Tests 1-2) ────────────────────────────
  // §13 NEW VO interface plain pattern axis-distinct vs Money/MonetaryAmount
  // class privada + static factory ≥2 evidencias 1ra evidencia + §13 NEW VO
  // generic <T> pattern 1ra evidencia.

  it("Test 1: modules/shared/domain/value-objects/pagination.ts contains `export interface PaginationOptions` (1-indexed page + pageSize default 25 max 100 + optional sortBy + optional sortOrder — DTO-style contract NO class privada static factory pattern)", () => {
    const source = fs.readFileSync(VO_FILE, "utf8");
    expect(source).toMatch(VO_OPTIONS_RE);
  });

  it("Test 2: modules/shared/domain/value-objects/pagination.ts contains `export interface PaginatedResult` (generic <T> items array + total + page + pageSize + totalPages — §13 NEW VO generic pattern axis-distinct)", () => {
    const source = fs.readFileSync(VO_FILE, "utf8");
    expect(source).toMatch(VO_RESULT_RE);
  });

  // ── B: Shared presentation schema + helper (Tests 3-4) ───────────────────
  // §13 NEW shared/presentation/ carve-out 1ra evidencia matures (paired sister
  // shared/domain VO + shared/infrastructure adapters precedent existing) +
  // §13 NEW shared route helper canonical home 1ra evidencia (fresh terrain
  // zero precedent — 38 routes parse inline searchParams pre-C0).

  it("Test 3: modules/shared/presentation/pagination.schema.ts contains `export const paginationQuerySchema` (zod object validating raw URLSearchParams query string into PaginationOptions shape — HTTP boundary translation presentation concern)", () => {
    const source = fs.readFileSync(SCHEMA_FILE, "utf8");
    expect(source).toMatch(SCHEMA_RE);
  });

  it("Test 4: modules/shared/presentation/parse-pagination-params.ts contains `export function parsePaginationParams` (HTTP boundary helper converting URLSearchParams to PaginationOptions VO — §13 NEW shared route helper canonical home 1ra evidencia fresh terrain)", () => {
    const source = fs.readFileSync(HELPER_FILE, "utf8");
    expect(source).toMatch(HELPER_RE);
  });
});
