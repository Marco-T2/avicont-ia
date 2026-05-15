/**
 * POC pagination-ledger C1-MACRO Ledger — cross-layer additive shape
 * (port + adapter + repo + service + HTTP route + UI page/client). 1 RED test
 * file 5 describes layered atomic single batch RED+GREEN macro-cycle (mirror
 * precedent EXACT Journal C1-MACRO `fe63d671`/`45135b82` — POC pagination-
 * journal CLOSED, cumulative cross-POC).
 *
 * Ledger-specific asymmetries vs Journal precedent:
 *   - Cumulative-state paginated DTO: NEW `LedgerPageResult` extends
 *     `PaginatedResult<T>` shape with `openingBalanceDelta: unknown` field
 *     (port DTO, monetary `unknown` mirrors `LedgerLineRow.debit/credit:
 *     unknown` precedent). Service coerces to `Prisma.Decimal`; DTO
 *     boundary serializes to `string`. §13 NEW emergente 1ra evidencia
 *     `cumulative-state-paginated-dto-pattern`.
 *   - Repo 3-query Promise.all layout (vs Journal 2-query): rows window
 *     `findMany(skip, take)` + count + prior-rows `findMany(skip:0,take:skip,
 *     select:{debit,credit})` for openingBalanceDelta JS reduce. α5 asymmetry:
 *     asserts the 3rd findMany prior-rows shape specifically (NOT .count()).
 *   - Service `getAccountLedgerPaginated` running-balance accumulator seeds
 *     FROM `opening` (NOT from `Decimal(0)`) — correctness invariant across
 *     page boundaries. Legacy `getAccountLedger` preserved untouched.
 *   - DTO `LedgerPaginatedDto` (presentation) extends with `openingBalance:
 *     string` field (presentation-side, serialized via roundHalfUp+toFixed(2));
 *     UI banner row "Saldo de Apertura: Bs. {openingBalance}" renders iff
 *     `page > 1 AND openingBalance !== "0.00"` (D5 visibility).
 *   - Client component split: `ledger-page-client.tsx` refactored — prop-
 *     driven (removes useState/fetch/Loader2) + URL searchParams via
 *     useRouter + buildHref 6-param multi-filter shape (mirror journal-
 *     entry-list.tsx L104-120 sister-2 precedent — closer paridad with
 *     ledger's 5-filter shape than sale-list.tsx sister-1).
 *
 * Marco lock pre-RED (heredados Journal EXACT):
 *   L1 Estrategia signature change = Opción C ADDITIVE NEW método paralelo.
 *      Port añade `findLinesByAccountPaginated(orgId, accountId, filters?,
 *      pagination?): Promise<LedgerPageResult>` paralelo a
 *      `findLinesByAccount(orgId, accountId, filters?): Promise<
 *      LedgerLineRow[]>` legacy preservado. Adapter + Repo añaden
 *      `findLinesByAccountPaginated` paralelo a `findLinesByAccount` legacy
 *      preservados. Service añade `getAccountLedgerPaginated(orgId,
 *      accountId, dateRange?, periodId?, pagination?): Promise<
 *      LedgerPaginatedDto>` paralelo a `getAccountLedger` legacy preservado.
 *      Dual-method transitional axis-distinct heredado.
 *   L2 Granularity α = 10 tests existence-only red-regex-discipline (drop
 *      T11 shadcn `components/ui/pagination.tsx` — heredado Sale pilot
 *      install ya pre-existe, redundant PASS pollutes ledger semantic
 *      precision). 5 layered describes cross-layer cohesion:
 *      D1 Port (α1+α2) + D2 Repo (α3+α4+α5) + D3 Service (α6+α7)
 *      + D4 HTTP Route (α8) + D5 UI page+client (α9+α10).
 *   L3 Filename convention = module-prefix in basename
 *      `c1-macro-pagination-additive-shape-ledger.poc-pagination-ledger
 *      .test.ts`. Paired sister Journal precedent EXACT.
 *   L4 shadcn Pagination heredado Sale pilot — `components/ui/pagination.tsx`
 *      existing pre-RED. POC pagination-ledger NO re-installs.
 *   L5 Server-side filters PRE-pagination canonical heredado Sale pilot
 *      precedent (URL searchParams sync RSC).
 *
 * Source-string assertion pattern: mirror Journal precedent EXACT
 * (`fs.readFileSync` regex match — keep red-regex-discipline matures
 * existence-only assertions verify shape source post-GREEN; runtime
 * behavior assertions defer post-cementación D1).
 *
 * REPO_ROOT: `path.resolve(__dirname, "../../..")` — test lives in
 * `modules/accounting/__tests__/`, 3 levels up to repo root (mirrors
 * Journal precedent EXACT).
 *
 * Expected RED failure mode pre-GREEN (per [[red_acceptance_failure_mode]])
 * 10/10 FAIL enumerated explicit:
 *   α1-α2 FAIL: regex MISMATCH — `findLinesByAccountPaginated` NOT YET in
 *   port (legacy `findLinesByAccount` preserved retorna Promise<
 *   LedgerLineRow[]> intacto).
 *   α3-α4-α5 FAIL: regex MISMATCH — repo sin findLinesByAccountPaginated
 *   3-query Promise.all (legacy findLinesByAccount findMany unbounded
 *   preserved intacto). α5 ledger-specific: asserts 3rd findMany(skip:0,
 *   take:skip) prior-rows query NOT .count() (Journal asymmetry).
 *   α6-α7 FAIL: regex MISMATCH — `getAccountLedgerPaginated` NOT YET in
 *   service (legacy `getAccountLedger` preserved retorna Promise<
 *   LedgerEntry[]> intacto).
 *   α8 FAIL: regex MISMATCH — no `parsePaginationParams` import in route.
 *   α9 FAIL: regex MISMATCH — no `getAccountLedgerPaginated(` call in
 *   page.tsx (currently THIN RSC sin twin-call).
 *   α10 FAIL: regex MISMATCH — no `buildHref` helper in ledger-page-client
 *   (currently client-fetch sin URL-driven pagination).
 *
 *   Total expected FAIL pre-GREEN: 10/10 enumerated explicit (10 regex
 *   mismatch + 0 ENOENT — all target files exist pre-RED).
 *
 * Cross-ref engrams:
 *   - spec #2553 · design #2554 · proposal #2552 · exploration #2551
 *   - Journal POC closed precedent `fe63d671` RED + `45135b82` GREEN +
 *     `3dc4ef27` D1 cementación
 *   - Sales-unified POC closed precedent (RSC twin-call + URL searchParams +
 *     buildHref)
 *   - [[red_regex_discipline]] (mirror precedent EXACT)
 *   - [[mock_hygiene_commit_scope]] (fake atomic same C1 GREEN)
 *   - [[sentinel_regex_line_bound]] ([^\n]* line-bound, NOT [^)]* paren-class)
 *   - [[paired_sister_default_no_surface]] (apply Journal directly)
 *
 * §13 emergentes pre-RED ledger D1 cementación target (1 NEW + heredados):
 *   1. NEW arch/§13/cumulative-state-paginated-dto-pattern — paginated
 *      views requiring cumulative state across pages (running balance,
 *      opening delta) get a dedicated port DTO `LedgerPageResult` that
 *      EXTENDS `PaginatedResult<T>` shape with `openingBalanceDelta:
 *      unknown` field WITHOUT polluting the shared VO. 1ra evidencia.
 *      Genealogy: child of `vo-generic-paginated-result-shape` (shared
 *      minimal shape extended by domain-specific stateful DTO).
 *   Heredados matures (cumulative cross-POC):
 *   - §13 split-port-three-touchpoint-find-paginated 2da evidencia
 *     (Journal 1ra → Ledger 2da: same JournalLedgerQueryPort now carries
 *     BOTH `findPaginated` AND `findLinesByAccountPaginated`)
 *   - §13 dual-method ADDITIVE transitional cross-POC reusable 5ta matures
 *   - §13 vo-generic-paginated-result-shape extended-by clause matures
 *   - §13 twin-call-rsc-canonical 3ra matures
 *   - §13 shared-presentation-carve-out 5ta/6ta matures
 *
 * Self-contained future-proof: test asserta paths bajo
 * `modules/accounting/{domain,infrastructure,application}` + `app/api/.../
 * ledger/route.ts` + `app/(dashboard)/.../accounting/ledger/page.tsx` +
 * `components/accounting/ledger-page-client.tsx` que persisten post D1
 * cementación. Test vive en `modules/accounting/__tests__/` — NO toca paths
 * futuros fuera scope. Self-contained vs D1 (doc-only) ✓.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C1-MACRO Ledger target file paths (5 layers — drop shadcn heredado) ──

const PORT_FILE = path.join(
  REPO_ROOT,
  "modules/accounting/domain/ports/journal-ledger-query.port.ts",
);
const REPO_FILE = path.join(
  REPO_ROOT,
  "modules/accounting/infrastructure/prisma-journal-entries.repo.ts",
);
const SERVICE_FILE = path.join(
  REPO_ROOT,
  "modules/accounting/application/ledger.service.ts",
);
const ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/ledger/route.ts",
);
const PAGE_FILE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/ledger/page.tsx",
);
const CLIENT_FILE = path.join(
  REPO_ROOT,
  "components/accounting/ledger-page-client.tsx",
);

// ── Regex patterns existence-only (red-regex-discipline matures) ───────────
// Opción C ADDITIVE: regex target NEW métodos `findLinesByAccountPaginated`
// (port + repo) + `getAccountLedgerPaginated` (service) — paralelos a
// `findLinesByAccount` / `getAccountLedger` legacy preservados sin tocar.
// Mirror Journal precedent EXACT.

const PORT_FINDPAGINATED_PAGINATION_RE =
  /findLinesByAccountPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const PORT_FINDPAGINATED_RETURN_RE =
  /findLinesByAccountPaginated\s*\([\s\S]*?\)\s*:\s*Promise<\s*LedgerPageResult\s*>/;

const REPO_FINDPAGINATED_RE = /findLinesByAccountPaginated\s*\(/;
const REPO_PROMISE_ALL_RE =
  /findLinesByAccountPaginated[\s\S]*?Promise\.all\(\[/;
// α5 ledger-specific asymmetry: asserts the 3rd findMany (prior-rows
// query for openingBalanceDelta) with `skip:0, take:skip` shape — NOT
// `.count()`. Line-bound `[^\n]*` per [[sentinel_regex_line_bound]]
// (paren-class `[^)]*` fails on nested-paren expressions). Pre-RED grep
// confirmed zero collisions in repo file (`findLinesByAccount` legacy has
// no `skip:0` shape — count was 0).
const REPO_PRIOR_ROWS_RE =
  /findLinesByAccountPaginated[\s\S]*?findMany\(\{[\s\S]*?skip:\s*0[^\n]*take:\s*skip/;

const SERVICE_GETPAGINATED_PAGINATION_RE =
  /getAccountLedgerPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
// α7 line-bound per [[sentinel_regex_line_bound]] — asserts return type
// `openingBalance` serialized as string at DTO boundary.
const SERVICE_OPENINGBALANCE_RE = /openingBalance[^\n]*string/;

// α8 anchor `^...m` for import statement per [[red_regex_discipline]]
// precedent (Journal α7).
const ROUTE_IMPORT_PARSE_RE =
  /^import[^\n]*parsePaginationParams[^\n]*parse-pagination-params/m;

const PAGE_GETPAGINATED_CALL_RE = /getAccountLedgerPaginated\(/;
const CLIENT_BUILDHREF_RE = /function\s+buildHref\s*\(/;

describe("POC pagination-ledger C1-MACRO Ledger — cross-layer additive shape (port findLinesByAccountPaginated NEW método paralelo legacy findLinesByAccount preservado + LedgerPageResult cumulative-state DTO openingBalanceDelta:unknown + Prisma 3-query Promise.all repo prior-rows findMany skip:0,take:skip openingBalanceDelta JS reduce + service getAccountLedgerPaginated NEW método paralelo legacy getAccountLedger preservado + running-balance accumulator seeded FROM opening NOT Decimal(0) + LedgerPaginatedDto openingBalance:string serialization at DTO boundary + HTTP route parsePaginationParams wire + UI page.tsx RSC twin-call getAccountLedgerPaginated + ledger-page-client.tsx buildHref 6-param URL searchParams + opening banner page>1 AND !==0.00 + shadcn Pagination block, §13 NEW cumulative-state-paginated-dto-pattern 1ra evidencia + §13 heredados split-port-three-touchpoint-find-paginated 2da Journal→Ledger matures + dual-method ADDITIVE 5ta + vo-generic-paginated-result-shape extended-by clause matures + twin-call-rsc-canonical 3ra + shared-presentation-carve-out 5ta/6ta matures cumulative cross-POC, 10α existence-only forward-looking pre-GREEN 10/10 FAIL: 10 regex mismatch + 0 ENOENT files exist)", () => {
  // ── D1: Port — modules/accounting/domain/ports/journal-ledger-query.port.ts ──
  // §13 C1-MACRO ADDITIVE dual-method paralelo pattern 5ta evidencia matures
  // cumulative cross-POC (heredado Sale/Purchase/Payment/Journal 1ra-4ta) +
  // §13 split-port 3-touchpoint cascade 2da evidencia (Journal 1ra → Ledger
  // 2da — same port now carries findPaginated AND findLinesByAccountPaginated).

  describe("Port — journal-ledger-query.port.ts (ADDITIVE findLinesByAccountPaginated NEW método paralelo, legacy findLinesByAccount preservado)", () => {
    it("α1: port findLinesByAccountPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (consume shared VO from C0 canonical home modules/shared/domain/value-objects/pagination heredado Sale pilot — paralelo a findLinesByAccount legacy unchanged)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_PAGINATION_RE);
    });

    it("α2: port findLinesByAccountPaginated NEW return type `Promise<LedgerPageResult>` (cumulative-state DTO extends PaginatedResult shape with openingBalanceDelta:unknown — ADDITIVE NEW método paralelo a findLinesByAccount legacy retorna Promise<LedgerLineRow[]> intacto)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_RETURN_RE);
    });
  });

  // ── D2: Repo — prisma-journal-entries.repo.ts (α3-α4-α5) ──────────────────
  // §13 Prisma `skip/take` + `count` + prior-rows findMany Promise.all 3-query
  // parallel pattern repo findLinesByAccountPaginated impl PaginationOptions —
  // Ledger asymmetry vs Journal 2-query (rows+count): adds 3rd findMany for
  // openingBalanceDelta. §13 NEW cumulative-state-paginated-dto-pattern 1ra
  // evidencia.

  describe("Repo — prisma-journal-entries.repo.ts (3-query Promise.all en findLinesByAccountPaginated: rows + count + prior-rows findMany skip:0,take:skip)", () => {
    it("α3: repo findLinesByAccountPaginated method exists (NEW impl paralelo a findLinesByAccount legacy unchanged — ADDITIVE 3-touchpoint cascade)", () => {
      const source = fs.readFileSync(REPO_FILE, "utf8");
      expect(source).toMatch(REPO_FINDPAGINATED_RE);
    });

    it("α4: repo findLinesByAccountPaginated uses `Promise.all([` parallel pattern (3 queries: page rows + total count + prior rows for openingBalanceDelta — heredado Sale pilot canonical EXACT matures cumulative cross-POC)", () => {
      const source = fs.readFileSync(REPO_FILE, "utf8");
      expect(source).toMatch(REPO_PROMISE_ALL_RE);
    });

    it("α5: repo findLinesByAccountPaginated has prior-rows findMany with `skip:0, take:skip` shape (LEDGER ASYMMETRY vs Journal .count() — 3rd query reduces debit/credit in JS for openingBalanceDelta, bounded to take=skip so page=1 → take:0 → empty → delta=0)", () => {
      const source = fs.readFileSync(REPO_FILE, "utf8");
      expect(source).toMatch(REPO_PRIOR_ROWS_RE);
    });
  });

  // ── D3: Service — ledger.service.ts (α6-α7) ──────────────────────────────
  // §13 Service NEW método return cumulative-state DTO LedgerPaginatedDto
  // paralelo a getAccountLedger legacy 5ta evidencia matures cumulative
  // cross-POC. R-money TIER 1 discharged: Prisma.Decimal accumulator;
  // string at DTO boundary only.

  describe("Service — ledger.service.ts (getAccountLedgerPaginated NEW método paralelo, legacy getAccountLedger preservado)", () => {
    it("α6: service getAccountLedgerPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (forwards to port.findLinesByAccountPaginated mismo VO contract — paralelo a getAccountLedger legacy unchanged)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_GETPAGINATED_PAGINATION_RE);
    });

    it("α7: service getAccountLedgerPaginated return type includes `openingBalance: string` field (DTO LedgerPaginatedDto extends with cumulative-state opening — serialized via roundHalfUp+toFixed(2) at DTO boundary, R-money TIER 1 discharged sigma-13)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_OPENINGBALANCE_RE);
    });
  });

  // ── D4: HTTP route — ledger/route.ts (α8) ────────────────────────────────
  // §13 HTTP route Response.json wrap LedgerPaginatedDto shape 5ta evidencia
  // matures cumulative cross-POC (heredado Sale/Purchase/Payment/Journal —
  // consume parsePaginationParams helper from C0 canonical home + service
  // .getAccountLedgerPaginated NEW método).

  describe("HTTP route — ledger/route.ts (parsePaginationParams wire-up)", () => {
    it("α8: route imports `parsePaginationParams` from C0 canonical home `@/modules/shared/presentation/parse-pagination-params` heredado Sale pilot (consume shared HTTP boundary helper)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_IMPORT_PARSE_RE);
    });
  });

  // ── D5: UI — page.tsx + ledger-page-client.tsx (α9-α10) ──────────────────
  // §13 UI shadcn Pagination + URL search params sync RSC pattern 5ta
  // evidencia matures cumulative cross-POC (heredado Sale/Purchase/Payment/
  // Journal). T11 shadcn pagination.tsx file exists DROPPED — heredado Sale
  // pilot ya exists pre-RED PASS redundant pollutes ledger semantic precision.

  describe("UI — page.tsx + ledger-page-client.tsx (RSC twin-call + buildHref URL searchParams)", () => {
    it("α9: page.tsx calls `getAccountLedgerPaginated(` (RSC twin-call accounts + paginated ledger — consume LedgerPaginatedDto shape from ledgerService.getAccountLedgerPaginated NEW método server-side)", () => {
      const source = fs.readFileSync(PAGE_FILE, "utf8");
      expect(source).toMatch(PAGE_GETPAGINATED_CALL_RE);
    });

    it("α10: ledger-page-client.tsx contains `function buildHref(` helper (URL nav preserving orgSlug+accountId+dateFrom+dateTo+periodId+page params — 6-param multi-filter shape mirror journal-entry-list.tsx L104-120 sister-2 precedent — shadcn Pagination wire + Consultar submit gate router.push)", () => {
      const source = fs.readFileSync(CLIENT_FILE, "utf8");
      expect(source).toMatch(CLIENT_BUILDHREF_RE);
    });
  });
});
