/**
 * POC pagination-journal C1-MACRO Journal — cross-layer additive shape
 * (port + adapter + repo + service + HTTP route + UI page/list). 1 RED test
 * file 5 describes layered atomic single batch RED+GREEN macro-cycle (mirror
 * precedent EXACT Purchase C1-MACRO `940cfda`/`070e2d5` — POC pagination-
 * replication CLOSED, cumulative cross-POC).
 *
 * Journal-specific asymmetries vs Purchase precedent:
 *   - Split-port 3-touchpoint cascade (vs Purchase single-port 2-touchpoint):
 *     `JournalLedgerQueryPort` (read port) + `PrismaJournalLedgerQueryAdapter`
 *     (thin pass-through) + `JournalRepository` (Prisma impl). ALL three must
 *     gain `findPaginated` atomic same C1-MACRO commit per TSC gate.
 *   - Fake `InMemoryJournalLedgerQueryPort` lands in GREEN batch atomic per
 *     [[mock_hygiene_commit_scope]] — without it, the 3 services using the
 *     fake fail TSC.
 *   - Filters are simpler (no Purchase-style array unification): scalar/enum
 *     periodId + voucherTypeId + status + origin + dateFrom/dateTo.
 *   - `journalIncludeLines` 3-JOIN eager hydration accepted tradeoff —
 *     paginated read still carries lines + account + contact + voucherType
 *     per row. Documented §13 NEW emergente.
 *   - `sourceType IS NULL / IS NOT NULL` origin filter pattern preserved in
 *     DRY `buildJournalEntryWhere` helper (shared between findAll +
 *     findPaginated). §13 NEW emergente.
 *
 * Marco lock pre-RED (heredados Purchase EXACT):
 *   L1 Estrategia signature change = Opción C ADDITIVE NEW método paralelo.
 *      Port añade `findPaginated(orgId, filters?, pagination?):
 *      Promise<PaginatedResult<JournalEntryWithLines>>` paralelo a
 *      `list(orgId, filters?): Promise<JournalEntryWithLines[]>` legacy
 *      preservado. Adapter + Repo añaden `findPaginated` paralelo a
 *      `list`/`findAll` legacy preservados. Service añade
 *      `listPaginated(orgId, filters?, pagination?):
 *      Promise<PaginatedResult<JournalEntryWithLines>>` paralelo a
 *      `list(orgId, filters?): Promise<JournalEntryWithLines[]>` legacy
 *      preservado. Dual-method transitional axis-distinct heredado.
 *   L2 Granularity α = 10 tests existence-only red-regex-discipline (drop
 *      T11 shadcn `components/ui/pagination.tsx` — heredado Sale pilot
 *      install ya pre-existe, redundant PASS pollutes ledger semantic
 *      precision). 5 layered describes cross-layer cohesion:
 *      D1 Port (α1+α2) + D2 Repo/Adapter (α3+α4) + D3 Service (α5+α6)
 *      + D4 HTTP Route (α7) + D5 UI page+list (α8+α9+α10).
 *   L3 Filename convention = module-prefix in basename
 *      `c1-macro-pagination-additive-shape-journal.poc-pagination-journal
 *      .test.ts`. Paired sister Sale/Purchase/Payment precedent EXACT.
 *   L4 shadcn Pagination heredado Sale pilot — `components/ui/pagination.tsx`
 *      existing pre-RED. POC pagination-journal NO re-installs.
 *   L5 Server-side filters PRE-pagination canonical heredado Sale pilot
 *      precedent (URL searchParams sync RSC).
 *
 * Source-string assertion pattern: mirror Sale/Purchase pilot precedent
 * EXACT (`fs.readFileSync` regex match — keep red-regex-discipline matures
 * existence-only assertions verify shape source post-GREEN; runtime
 * behavior assertions defer post-cementación D1).
 *
 * REPO_ROOT: `path.resolve(__dirname, "../../..")` — test lives in
 * `modules/accounting/__tests__/`, 3 levels up to repo root (mirrors
 * Purchase α940cfda precedent EXACT).
 *
 * Expected RED failure mode pre-GREEN (per [[red_acceptance_failure_mode]])
 * 10/10 FAIL enumerated explicit:
 *   α1-α2 FAIL: regex MISMATCH — `findPaginated` NOT YET in port (legacy
 *   `list` preserved retorna Promise<JournalEntryWithLines[]> intacto).
 *   α3-α4 FAIL: regex MISMATCH — repo sin skip/take/count en findPaginated
 *   (legacy findAll findMany unbounded preserved intacto, NO journalEntry
 *   .count() call yet).
 *   α5-α6 FAIL: regex MISMATCH — `listPaginated` NOT YET in service (legacy
 *   `list` preserved retorna Promise<JournalEntryWithLines[]> intacto).
 *   α7 FAIL: regex MISMATCH — no `parsePaginationParams` import in route.
 *   α8 FAIL: regex MISMATCH — no `.items` access in page (entries passed
 *   bare array still).
 *   α9 FAIL: regex MISMATCH — no `PaginatedResult` ref in journal-entry-
 *   list (component receives bare JournalEntry[]).
 *   α10 FAIL: regex MISMATCH — no `buildHref` helper in journal-entry-list.
 *
 *   Total expected FAIL pre-GREEN: 10/10 enumerated explicit (10 regex
 *   mismatch + 0 ENOENT — all target files exist pre-RED).
 *
 * Cross-ref engrams:
 *   - spec #2459 · design #2460 · proposal #2458 · exploration #2454
 *   - Purchase POC closed precedent `070e2d5` C1-MACRO + `b5731770` D1
 *   - Sale pilot C1-MACRO precedent (canonical heredado)
 *   - [[red_regex_discipline]] (mirror precedent EXACT)
 *   - [[mock_hygiene_commit_scope]] (fake atomic same C1-MACRO)
 *   - [[paired_sister_default_no_surface]] (apply Purchase directly)
 *
 * §13 emergentes pre-RED ledger D1 cementación target (3 NEW + heredados):
 *   1. NEW arch/§13/journal-ledger-query-port-split-findpaginated-three-
 *      touchpoints — split-port READ routing through adapter+repo requires
 *      findPaginated in all 3 layers (vs Sale/Purchase single-port). 1ra
 *      evidencia.
 *   2. NEW arch/§13/journal-include-lines-eager-hydration-accepted-
 *      paginated-tradeoff — 3-JOIN eager hydration accepted in paginated
 *      context; lazy-load DEFER. 1ra evidencia.
 *   3. NEW arch/§13/origin-filter-null-check-preserve-findpaginated-shared-
 *      where-builder — sourceType IS NULL/NOT NULL extracted to shared
 *      buildJournalEntryWhere DRY. 1ra evidencia.
 *   Heredados matures (cumulative cross-POC):
 *   - §13 dual-method ADDITIVE transitional cross-POC reusable 4ta matures
 *   - §13 shared-presentation-carve-out 4ta matures
 *   - §13 vo-generic-paginated-result-shape 4ta matures
 *   - §13 shadcn drop redundant T11 cross-POC 4ta matures
 *
 * Self-contained future-proof: test asserta paths bajo
 * `modules/accounting/{domain,infrastructure,application}` + `app/api/.../
 * journal/route.ts` + `app/(dashboard)/.../accounting/journal/page.tsx` +
 * `components/accounting/journal-entry-list.tsx` que persisten post D1
 * cementación. Test vive en `modules/accounting/__tests__/` — NO toca paths
 * futuros fuera scope. Self-contained vs D1 (doc-only) ✓.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C1-MACRO Journal target file paths (5 layers — drop shadcn heredado) ──

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
  "modules/accounting/application/journals.service.ts",
);
const ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/journal/route.ts",
);
const PAGE_FILE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/page.tsx",
);
const LIST_FILE = path.join(
  REPO_ROOT,
  "components/accounting/journal-entry-list.tsx",
);

// ── Regex patterns existence-only (red-regex-discipline matures) ───────────
// Opción C ADDITIVE: regex target NEW métodos `findPaginated` (port + repo)
// + `listPaginated` (service) — paralelos a `list` / `findAll` legacy
// preservados sin tocar. Mirror Purchase precedent EXACT.

const PORT_FINDPAGINATED_PAGINATION_RE =
  /findPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const PORT_FINDPAGINATED_RETURN_RE =
  /findPaginated\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*JournalEntryWithLines\s*>\s*>/;

const REPO_SKIP_TAKE_RE = /skip:[\s\S]*?take:/;
// α4 regex tightened: scope `.count(` inside `findPaginated` method body
// (Journal-asymmetry — repo already has `journalEntry.count(` in
// `findForCorrelationAudit:199`; bare `\.count\(` would PASS pre-RED
// polluting ledger). Mirror Purchase precedent `db.purchase.count` shape
// but anchored to `findPaginated` proximity per [[red_regex_discipline]]
// + [[invariant_collision_elevation]] surface-honest fix pre-RED.
const REPO_COUNT_RE = /findPaginated[\s\S]*?\.count\(/;

const SERVICE_LISTPAGINATED_PAGINATION_RE =
  /listPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const SERVICE_LISTPAGINATED_RETURN_RE =
  /listPaginated\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*JournalEntryWithLines\s*>\s*>/;

const ROUTE_IMPORT_PARSE_RE =
  /^import\s*\{[\s\S]*?parsePaginationParams[\s\S]*?\}\s*from\s*["']@\/modules\/shared\/presentation\/parse-pagination-params["']/m;

const PAGE_ITEMS_ACCESS_RE = /\.items\b/;
const LIST_PAGINATED_RE = /\bPaginatedResult\b/;
const LIST_BUILDHREF_RE = /buildHref/;

describe("POC pagination-journal C1-MACRO Journal — cross-layer additive shape (port findPaginated NEW método paralelo legacy list preservado + Prisma skip/take/count repo findPaginated impl + service listPaginated NEW método paralelo legacy list preservado + HTTP route parsePaginationParams wire + UI page.tsx items access + journal-entry-list.tsx PaginatedResult prop + buildHref helper, §13 NEW journal-ledger-query-port-split-findpaginated-three-touchpoints 1ra evidencia + journal-include-lines-eager-hydration-accepted-paginated-tradeoff 1ra evidencia + origin-filter-null-check-preserve-findpaginated-shared-where-builder 1ra evidencia + §13 heredados dual-method ADDITIVE 4ta + shared-presentation-carve-out 4ta + vo-generic-paginated-result-shape 4ta + shadcn drop redundant T11 4ta matures cumulative cross-POC, 10α existence-only forward-looking pre-GREEN 10/10 FAIL: 10 regex mismatch + 0 ENOENT files exist)", () => {
  // ── D1: Port — modules/accounting/domain/ports/journal-ledger-query.port.ts ──
  // §13 C1-MACRO ADDITIVE dual-method paralelo pattern 4ta evidencia matures
  // cumulative cross-POC (heredado Sale/Purchase/Payment 1ra-3ra) +
  // §13 NEW split-port 3-touchpoint cascade 1ra evidencia.

  describe("Port — journal-ledger-query.port.ts (ADDITIVE findPaginated NEW método paralelo, legacy list preservado)", () => {
    it("α1: port findPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (consume shared VO from C0 canonical home modules/shared/domain/value-objects/pagination heredado Sale pilot — paralelo a list legacy unchanged)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_PAGINATION_RE);
    });

    it("α2: port findPaginated NEW return type `Promise<PaginatedResult<JournalEntryWithLines>>` (ADDITIVE NEW método paralelo a list legacy retorna Promise<JournalEntryWithLines[]> intacto)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_RETURN_RE);
    });
  });

  // ── D2: Repo/Adapter — prisma-journal-entries.repo.ts (α3-α4) ─────────────
  // §13 Prisma `skip/take` + `count` Promise.all parallel pattern repo
  // findPaginated impl PaginationOptions 4ta evidencia matures cumulative
  // cross-POC (heredado Sale/Purchase/Payment) + §13 NEW origin-filter-
  // null-check-preserve-findpaginated-shared-where-builder 1ra evidencia
  // (sourceType IS NULL/NOT NULL DRY extracted to buildJournalEntryWhere).

  describe("Repo — prisma-journal-entries.repo.ts (Prisma skip/take + count en findPaginated impl)", () => {
    it("α3: repo findPaginated uses Prisma `skip` + `take` pattern (offset/page-based pagination math via PaginationOptions.page + pageSize — en NEW impl paralelo a findAll legacy)", () => {
      const source = fs.readFileSync(REPO_FILE, "utf8");
      expect(source).toMatch(REPO_SKIP_TAKE_RE);
    });

    it("α4: repo findPaginated calls `.count(` query (total computation for PaginatedResult.total + totalPages — Promise.all([findMany, count]) parallel pattern heredado Sale pilot precedent EXACT en NEW impl)", () => {
      const source = fs.readFileSync(REPO_FILE, "utf8");
      expect(source).toMatch(REPO_COUNT_RE);
    });
  });

  // ── D3: Service — journals.service.ts (α5-α6) ────────────────────────────
  // §13 Service NEW método return generic VO PaginatedResult<T> paralelo a
  // list legacy 4ta evidencia matures cumulative cross-POC.

  describe("Service — journals.service.ts (listPaginated NEW método paralelo, legacy list preservado)", () => {
    it("α5: service listPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (forwards to port.findPaginated mismo VO contract — paralelo a list legacy unchanged)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LISTPAGINATED_PAGINATION_RE);
    });

    it("α6: service listPaginated NEW return type `Promise<PaginatedResult<JournalEntryWithLines>>` (ADDITIVE NEW método paralelo a list legacy retorna Promise<JournalEntryWithLines[]> intacto)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LISTPAGINATED_RETURN_RE);
    });
  });

  // ── D4: HTTP route — journal/route.ts (α7) ───────────────────────────────
  // §13 HTTP route Response.json wrap PaginatedResult<T> shape 4ta evidencia
  // matures cumulative cross-POC (heredado Sale/Purchase/Payment — consume
  // parsePaginationParams helper from C0 canonical home + service
  // .listPaginated NEW método).

  describe("HTTP route — journal/route.ts (parsePaginationParams wire-up)", () => {
    it("α7: route imports `parsePaginationParams` from C0 canonical home `@/modules/shared/presentation/parse-pagination-params` heredado Sale pilot (consume shared HTTP boundary helper)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_IMPORT_PARSE_RE);
    });
  });

  // ── D5: UI — page.tsx + journal-entry-list.tsx (α8-α9-α10) ───────────────
  // §13 UI shadcn Pagination + URL search params sync RSC pattern 4ta
  // evidencia matures cumulative cross-POC (heredado Sale/Purchase/Payment)
  // + §13 NEW journal-include-lines-eager-hydration-accepted-paginated-
  // tradeoff 1ra evidencia (3-JOIN journalIncludeLines accepted tradeoff).
  // T11 shadcn pagination.tsx file exists DROPPED — heredado Sale pilot ya
  // exists pre-RED PASS redundant pollutes ledger semantic precision (§13
  // shadcn heredado cross-POC drop redundant 4ta matures cumulative).

  describe("UI — page.tsx + journal-entry-list.tsx (drop T11 shadcn heredado redundant)", () => {
    it("α8: page.tsx accesses `.items` (consume PaginatedResult shape from journalService.listPaginated NEW método — server-side pagination wire)", () => {
      const source = fs.readFileSync(PAGE_FILE, "utf8");
      expect(source).toMatch(PAGE_ITEMS_ACCESS_RE);
    });

    it("α9: journal-entry-list.tsx references `PaginatedResult` (import or prop type — consume paginated payload shape downstream of page.tsx)", () => {
      const source = fs.readFileSync(LIST_FILE, "utf8");
      expect(source).toMatch(LIST_PAGINATED_RE);
    });

    it("α10: journal-entry-list.tsx contains `buildHref` helper (URL nav preserving orgSlug+periodId+voucherTypeId+status+origin+page params — shadcn Pagination wire)", () => {
      const source = fs.readFileSync(LIST_FILE, "utf8");
      expect(source).toMatch(LIST_BUILDHREF_RE);
    });
  });
});
