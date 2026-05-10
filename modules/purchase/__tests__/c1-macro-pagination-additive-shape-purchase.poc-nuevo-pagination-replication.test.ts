/**
 * POC nuevo pagination-replication C1-MACRO Purchase — cross-layer additive
 * shape (port + adapter + service + HTTP route + UI page/list). 1 RED test
 * file 5 describes layered atomic single batch RED+GREEN macro-cycle (mirror
 * precedent EXACT POC pagination-sale C1-MACRO #1789, replication scope
 * cumulative cross-POC Purchase + Payment + D1 ~3 ciclos post-DEFER dispatch).
 *
 * Marco lock pre-RED:
 *   L1 Estrategia signature change = Opción C ADDITIVE NEW método paralelo.
 *      Port añade `findPaginated(orgId, filters?, pagination?):
 *      Promise<PaginatedResult<Purchase>>` paralelo a `findAll(orgId,
 *      filters?): Promise<Purchase[]>` legacy preservado. Service añade
 *      `listPaginated(orgId, filters?, pagination?): Promise<PaginatedResult
 *      <Purchase>>` paralelo a `list(orgId, filters?): Promise<Purchase[]>`
 *      legacy preservado. Dual-API transitional axis-distinct cross-POC
 *      reusable canonical heredado Sale pilot precedent EXACT (#1789).
 *      Marco lock E1 DEFER cleanup pending purchase-period-id-filter-drift
 *      preserved interface domain port + fake unchanged scope-distinct.
 *   L2 Granularity α = 10 tests existence-only red-regex-discipline (drop
 *      T11 shadcn pagination.tsx file exists redundant — heredado Sale pilot
 *      C1-MACRO `8fe5315` GREEN install). 5 layered describes cross-layer
 *      cohesion: D1 Port (T1+T2) + D2 Adapter (T3+T4) + D3 Service (T5+T6)
 *      + D4 HTTP route (T7+T8) + D5 UI (T9+T10).
 *   L3 Filename convention = module prefix in basename `c1-macro-pagination-
 *      additive-shape-purchase.poc-nuevo-pagination-replication.test.ts`.
 *      POC suffix unificado `poc-nuevo-pagination-replication`, módulo
 *      discriminator basename upfront. Paired sister payment file siguiente
 *      cycle preserves same convention.
 *   L4 shadcn Pagination heredado Sale pilot — `components/ui/pagination.tsx`
 *      existing pre-RED. POC pagination-replication NO re-installs.
 *   L5 Server-side filters PRE-pagination canonical heredado Sale pilot
 *      precedent (URL searchParams sync RSC).
 *
 * §13 emergentes pre-RED ledger D1 cumulative cementación target POC
 * pagination-replication (mostly heredados Sale pilot matures cumulative
 * cross-POC + 1 NEW emergente §13 + 4 cleanup pending engrams NEW canonical
 * homes saved Step 0 expand):
 *   1. §13 C1-MACRO ADDITIVE dual-method paralelo (findAll+findPaginated,
 *      list+listPaginated) transitional 2da evidencia matures cumulative
 *      cross-POC (heredado Sale pilot 1ra #1789).
 *   2. §13 Prisma `skip/take` + `count` Promise.all parallel adapter
 *      findPaginated impl 2da evidencia (heredado Sale pilot 1ra).
 *   3. §13 HTTP route Response.json wrap PaginatedResult<T> shape 2da
 *      evidencia (heredado).
 *   4. §13 Service NEW método return generic VO `PaginatedResult<T>`
 *      paralelo a list legacy 2da evidencia (heredado).
 *   5. §13 UI shadcn Pagination + URL searchParams sync RSC pattern 2da
 *      evidencia (heredado).
 *   6. §13 Page.tsx `searchParams: Promise<...>` Next.js 16 RSC pattern 2da
 *      evidencia (heredado).
 *   7. §13 Test file naming `c{N}-macro-...` cross-layer cohesion 2da
 *      evidencia matures (heredado).
 *   8. §13 direct-consumer-tests cascade variant 2da evidencia (heredado
 *      Sale pilot 1ra #1789 — `app/(dashboard)/[orgSlug]/purchases/__tests__
 *      /page.test.ts` + `components/purchases/__tests__/purchase-list-date-
 *      format.test.tsx` + `components/purchases/__tests__/purchase-list-
 *      unification.test.tsx` paired sister cascade adapt mismo batch GREEN).
 *   9. §13 NEW shadcn pagination.tsx heredado cross-POC drop redundant T11
 *      1ra evidencia matures (paired sister Sale pilot 11α — POC pagination-
 *      replication granularity α 10 evidencia variant).
 *  10. §13 NEW Payment port location asymmetry domain/payment.repository.ts
 *      vs Sale/Purchase domain/ports/X.repository.ts 1ra evidencia (paired
 *      sister Cleanup E2 composition root direct instance Cleanup pending
 *      engram canonical home `feedback/payment-port-location-asymmetry`
 *      8vo cumulative cross-POC). Manifests siguiente cycle Payment RED-α.
 *  11. §13 NEW payment-adapter-$transaction-axis-distinct-not-used-by-
 *      pagination-read-only 1ra evidencia matures cross-POC (saved this
 *      Step 0 expand engram). Manifests siguiente cycle Payment GREEN.
 *  12. red-regex-discipline existence-only 9na aplicación matures cumulative
 *      cross-POC (mirror Sale pilot C1-MACRO 8va + C0 7ma + cumulative
 *      cross-POC).
 *  13. textual-rule-verification recursive structural conventions 9na matures
 *      (mirror Sale pilot 8va — c{N} naming + readFileSync + poc-id suffix
 *      module-prefix basename + path resolve REPO_ROOT pattern).
 *  14. pre-phase-audit-gate scope cumulative cross-POC 8va matures (Step 0
 *      expand cycle-start cold cumulative cross-POC — verified baseline +
 *      cross-cycle red-test cementación gate forward-only zero collision +
 *      mock-source-identification-gate per módulo asymmetry surface +
 *      direct-consumer-tests cascade pre-execute MANDATORY identified).
 *  15. mock-source-identification-gate matures cumulative cross-POC per
 *      módulo asymmetry preserved (Purchase factory `mockMakePurchaseService`
 *      vs Payment class instance `mockPaymentList` heredado pre-RED — Cleanup
 *      E2 composition root DEFER preserves both patterns).
 *
 * Cross-ref engrams cumulative cross-POC:
 *   - `poc-nuevo-pagination-sale/closed` #1799 (POC precedent inmediato CLOSED
 *     C0 + C1-MACRO + D1 — 4 sub-fases cumulative pattern Opción C ADDITIVE
 *     dual-method canonical heredado).
 *   - `poc-nuevo-pagination-sale/c1-macro-closed` #1789 (Sale pilot RED file
 *     reference EXACT mirror estructural — `modules/sale/__tests__/c1-macro-
 *     pagination-additive-shape.poc-nuevo-pagination-sale.test.ts` 11α
 *     existence-only 5 layered describes — replicación pattern Purchase 10α
 *     drop T11 shadcn redundant).
 *   - `discovery/pagination-recon-fcdb399` #1782 (canonical home recon — 12
 *     listados Categ A H Purchase hex module + 7 axes Marco lock + VO shape
 *     canonical APROBADO heredado).
 *   - `baseline/fcdb399-enumerated-failure-ledger` #1780 (7f enumerated
 *     explicit pre-RED preserved {6,9} envelope membership across full POC
 *     cycle cumulative cross-POC).
 *   - `feedback/dispatch-pagination-defer-pending-hex-migration` (5to cleanup
 *     pending NEW POC pagination-replication Marco lock 1 DEFER dispatch).
 *   - `feedback/purchase-period-id-filter-drift-domain-fake-cleanup-pending`
 *     (6to cleanup pending NEW POC pagination-replication Marco lock E1
 *     DEFER fix interface domain extension scope-distinct).
 *   - `feedback/payment-composition-root-direct-instance-vs-factory-make-
 *     cleanup-pending` (7mo cleanup pending NEW POC pagination-replication
 *     Marco lock E2 DEFER refactor scope-distinct).
 *   - `feedback/payment-port-location-asymmetry-domain-vs-domain-ports-
 *     cleanup-pending` (8vo cleanup pending NEW POC pagination-replication
 *     port file location asymmetry).
 *   - `arch/§13/payment-adapter-transaction-axis-distinct-not-used-by-
 *     pagination-read-only` (§13 NEW emergente 1ra evidencia matures cross-
 *     POC saved Step 0 expand).
 *   - `feedback_red_acceptance_failure_mode` (failure mode honest 10/10
 *     enumerated forward-looking pre-GREEN — drop T11 redundant pollutes
 *     11/11 ledger semantic precision).
 *   - `feedback_canonical_rule_application_commit_body` (cite + rationale +
 *     cross-ref applied RED body — 15 §13 emergentes cementación targets
 *     cumulative cross-POC matures).
 *   - `feedback_textual_rule_verification` (4 conventions verified ≥3
 *     evidencias pre-RED commit — c{N}-macro naming + readFileSync +
 *     module-prefix basename + REPO_ROOT path resolve).
 *   - `feedback_pre_phase_audit` (8va evidencia matures cumulative cross-POC
 *     Step 0 expand cycle-start cold cumulative pre-RED Purchase).
 *
 * Cross-cycle RED test cementación gate forward-only:
 *   - C1-MACRO Purchase RED targets paths PURCHASE-MODULE + APP-DASHBOARD/API
 *     + COMPONENTS (cross-layer atomic). Future C1-MACRO Payment RED targets
 *     PAYMENT-MODULE paths divergent — zero collision verified Step 0 expand.
 *     Sale pilot RED targets `modules/sale/...` only — zero collision Purchase
 *     paths verified Step 0 expand.
 *   - D1 = doc-only cementación architecture.md cumulative POC entero post-2
 *     C1-MACRO. NO RED tests futuros. Gate satisfecho trivialmente.
 *
 * Granularity α RED scope (10α existence-only forward-looking 5 layered
 * describes — drop T11 shadcn heredado Sale pilot):
 *   D1 Port (2): T1 findPaginated NEW signature accepts pagination + T2
 *      return PaginatedResult<Purchase> (findAll legacy preservado sin tocar
 *      — Marco lock E1 DEFER PurchaseFilters periodId drift preserved).
 *   D2 Adapter (2): T3 skip/take pattern (en findPaginated impl) + T4 count
 *      query (en findPaginated impl). Promise.all parallel pattern canonical
 *      heredado Sale pilot precedent EXACT (axis-distinct $transaction NO
 *      ejercida adapter-side preserve precedent).
 *   D3 Service (2): T5 listPaginated NEW signature accepts pagination + T6
 *      return PaginatedResult<Purchase> (list legacy preservado sin tocar).
 *   D4 HTTP route (2): T7 import parsePaginationParams from C0 canonical
 *      home + T8 call invocation parsePaginationParams(searchParams).
 *   D5 UI (2): T9 page.tsx consume `.items` (de listPaginated) + T10
 *      purchase-list.tsx PaginatedResult shape import/ref.
 *   T11 DROPPED — shadcn pagination.tsx heredado Sale pilot ya exists
 *      pre-RED PASS redundant pollutes ledger semantic precision (10/10 FAIL
 *      regex mismatch zero ENOENT — files exist).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_
 * mode`) 10/10 FAIL enumerated explicit:
 *   T1-T2 FAIL: regex MISMATCH — findPaginated NOT YET in port (legacy
 *   findAll preserved retorna Promise<Purchase[]> intacto).
 *   T3-T4 FAIL: regex MISMATCH — adapter sin skip/take/count (legacy findAll
 *   findMany unbounded preserved intacto, NO db.purchase.count).
 *   T5-T6 FAIL: regex MISMATCH — listPaginated NOT YET in service (legacy
 *   list preserved retorna Promise<Purchase[]> intacto).
 *   T7-T8 FAIL: regex MISMATCH — no parsePaginationParams import/call yet.
 *   T9-T10 FAIL: regex MISMATCH — no .items access in page yet (purchases.map
 *   preserved), no PaginatedResult ref in purchase-list yet.
 *   Total expected FAIL pre-GREEN: 10/10 enumerated explicit (10 regex
 *   mismatch + 0 ENOENT — files exist already).
 *
 * Source-string assertion pattern: mirror Sale pilot precedent EXACT
 * (`fs.readFileSync` regex match — keep red-regex-discipline 9na matures
 * existence-only assertions verify shape source post-GREEN; runtime behavior
 * assertions defer post-cementación D1).
 *
 * Self-contained future-proof check (lección A6 #5): test asserta paths bajo
 * `modules/purchase/{domain,infrastructure,application}` + `app/api/.../
 * purchases/route.ts` + `app/(dashboard)/.../purchases/page.tsx` + `components
 * /purchases/purchase-list.tsx` que persisten post D1 cementación. Test vive
 * en `modules/purchase/__tests__/` — NO toca paths futuros fuera scope
 * cumulative. Self-contained vs D1 (doc-only) ✓.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C1-MACRO Purchase target file paths (5 layers — drop shadcn heredado) ──

const PORT_FILE = path.join(
  REPO_ROOT,
  "modules/purchase/domain/ports/purchase.repository.ts",
);
const ADAPTER_FILE = path.join(
  REPO_ROOT,
  "modules/purchase/infrastructure/prisma-purchase.repository.ts",
);
const SERVICE_FILE = path.join(
  REPO_ROOT,
  "modules/purchase/application/purchase.service.ts",
);
const ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/purchases/route.ts",
);
const PAGE_FILE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/purchases/page.tsx",
);
const PURCHASE_LIST_FILE = path.join(
  REPO_ROOT,
  "components/purchases/purchase-list.tsx",
);

// ── Regex patterns existence-only (red-regex-discipline 9na matures) ────────
// Opción C ADDITIVE: regex target NEW métodos `findPaginated` (port) +
// `listPaginated` (service) — paralelos a `findAll` + `list` legacy
// preservados sin tocar. Marco lock E1 DEFER PurchaseFilters periodId drift
// preserved — interface domain port + fake unchanged scope-distinct.

const PORT_FINDPAGINATED_PAGINATION_RE =
  /findPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const PORT_FINDPAGINATED_RETURN_RE =
  /findPaginated\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*Purchase\s*>\s*>/;

const ADAPTER_SKIP_TAKE_RE = /skip:\s*[\s\S]*?take:\s*/;
const ADAPTER_COUNT_RE = /(?:db\.purchase\.count\b|purchase\.count\s*\()/;

const SERVICE_LISTPAGINATED_PAGINATION_RE =
  /listPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const SERVICE_LISTPAGINATED_RETURN_RE =
  /listPaginated\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*Purchase\s*>\s*>/;

const ROUTE_IMPORT_PARSE_RE =
  /^import\s*\{[\s\S]*?parsePaginationParams[\s\S]*?\}\s*from\s*["']@\/modules\/shared\/presentation\/parse-pagination-params["']/m;
const ROUTE_CALL_PARSE_RE = /parsePaginationParams\s*\(\s*searchParams\s*\)/;

const PAGE_ITEMS_ACCESS_RE = /\.items\b/;
const PURCHASE_LIST_PAGINATED_RE = /\bPaginatedResult\b/;

describe("POC nuevo pagination-replication C1-MACRO Purchase — cross-layer additive shape (port findPaginated NEW método paralelo legacy findAll preservado + Prisma skip/take/count adapter findPaginated impl + service listPaginated NEW método paralelo legacy list preservado + HTTP route parsePaginationParams wire consume listPaginated + UI page.tsx items access + purchase-list.tsx PaginatedResult prop, §13 dual-method ADDITIVE 2da + Prisma skip/take/count 2da + HTTP route Response.json wrap 2da + Service NEW método paralelo 2da + UI shadcn URL searchParams 2da + page searchParams RSC 2da + test naming c{N}-macro 2da + direct-consumer-tests cascade variant 2da heredados + §13 NEW shadcn drop redundant T11 1ra evidencia + §13 NEW payment-port-location-asymmetry 1ra evidencia + §13 NEW payment-adapter-$transaction-axis-distinct 1ra evidencia matures cross-POC, 10α existence-only forward-looking pre-GREEN 10/10 FAIL: 10 regex mismatch + 0 ENOENT files exist drop T11 shadcn heredado)", () => {
  // ── D1: Port — modules/purchase/domain/ports/purchase.repository.ts ────────
  // §13 C1-MACRO ADDITIVE dual-method paralelo pattern 2da evidencia matures
  // (heredado Sale pilot 1ra #1789) + Service NEW método return generic VO
  // PaginatedResult<T> 2da evidencia consumed downstream. Marco lock E1
  // DEFER PurchaseFilters periodId drift preserved (legacy findAll intacto).

  describe("Port — purchase.repository.ts (ADDITIVE findPaginated NEW método paralelo, legacy findAll preservado)", () => {
    it("Test 1: port findPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (consume shared VO from C0 canonical home modules/shared/domain/value-objects/pagination heredado Sale pilot — paralelo a findAll legacy unchanged)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_PAGINATION_RE);
    });

    it("Test 2: port findPaginated NEW return type `Promise<PaginatedResult<Purchase>>` (ADDITIVE NEW método paralelo a findAll legacy retorna Promise<Purchase[]> intacto)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_RETURN_RE);
    });
  });

  // ── D2: Adapter — prisma-purchase.repository.ts (Tests 3-4) ───────────────
  // §13 Prisma `skip/take` + `count` Promise.all parallel pattern adapter
  // findPaginated impl PaginationOptions 2da evidencia matures (heredado Sale
  // pilot 1ra — axis-distinct $transaction NO ejercida adapter-side preserve
  // precedent EXACT cross-POC reusable canonical).

  describe("Adapter — prisma-purchase.repository.ts (Prisma skip/take + count en findPaginated impl)", () => {
    it("Test 3: adapter findPaginated uses Prisma `skip` + `take` pattern (offset/page-based pagination math via PaginationOptions.page + pageSize — en NEW impl paralelo a findAll legacy)", () => {
      const source = fs.readFileSync(ADAPTER_FILE, "utf8");
      expect(source).toMatch(ADAPTER_SKIP_TAKE_RE);
    });

    it("Test 4: adapter findPaginated calls `count` query (total computation for PaginatedResult.total + totalPages — Promise.all([findMany, count]) parallel pattern heredado Sale pilot precedent EXACT en NEW impl)", () => {
      const source = fs.readFileSync(ADAPTER_FILE, "utf8");
      expect(source).toMatch(ADAPTER_COUNT_RE);
    });
  });

  // ── D3: Service — purchase.service.ts (Tests 5-6) ────────────────────────
  // §13 Service NEW método return generic VO PaginatedResult<T> paralelo a
  // list legacy 2da evidencia matures (heredado Sale pilot 1ra #1789).

  describe("Service — purchase.service.ts (listPaginated NEW método paralelo, legacy list preservado)", () => {
    it("Test 5: service listPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (forwards to repo.findPaginated mismo VO contract — paralelo a list legacy unchanged)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LISTPAGINATED_PAGINATION_RE);
    });

    it("Test 6: service listPaginated NEW return type `Promise<PaginatedResult<Purchase>>` (ADDITIVE NEW método paralelo a list legacy retorna Promise<Purchase[]> intacto)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LISTPAGINATED_RETURN_RE);
    });
  });

  // ── D4: HTTP route — purchases/route.ts (Tests 7-8) ──────────────────────
  // §13 HTTP route Response.json wrap PaginatedResult<T> shape 2da evidencia
  // matures (heredado Sale pilot 1ra — consume parsePaginationParams helper
  // from C0 canonical home + service.listPaginated NEW método).

  describe("HTTP route — purchases/route.ts (parsePaginationParams wire-up + listPaginated consume)", () => {
    it("Test 7: route imports `parsePaginationParams` from C0 canonical home `@/modules/shared/presentation/parse-pagination-params` heredado Sale pilot (consume shared HTTP boundary helper)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_IMPORT_PARSE_RE);
    });

    it("Test 8: route invokes `parsePaginationParams(searchParams)` to extract pagination VO from URLSearchParams (HTTP boundary translation presentation concern — feeds service.listPaginated NEW método)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_CALL_PARSE_RE);
    });
  });

  // ── D5: UI — page.tsx + purchase-list.tsx (Tests 9-10) ───────────────────
  // §13 UI shadcn Pagination + URL search params sync RSC pattern 2da
  // evidencia matures (heredado Sale pilot 1ra) + Page.tsx `searchParams:
  // Promise<...>` Next.js 16 RSC pattern 2da evidencia matures (heredado).
  // T11 shadcn pagination.tsx file exists DROPPED — heredado Sale pilot ya
  // exists pre-RED PASS redundant pollutes ledger semantic precision (§13 NEW
  // shadcn heredado cross-POC drop redundant 1ra evidencia matures).

  describe("UI — page.tsx + purchase-list.tsx (drop T11 shadcn heredado redundant)", () => {
    it("Test 9: page.tsx accesses `.items` (consume PaginatedResult shape from purchaseService.listPaginated NEW método — server-side pagination wire)", () => {
      const source = fs.readFileSync(PAGE_FILE, "utf8");
      expect(source).toMatch(PAGE_ITEMS_ACCESS_RE);
    });

    it("Test 10: purchase-list.tsx references `PaginatedResult` (import or prop type — consume paginated payload shape downstream of page.tsx)", () => {
      const source = fs.readFileSync(PURCHASE_LIST_FILE, "utf8");
      expect(source).toMatch(PURCHASE_LIST_PAGINATED_RE);
    });
  });
});
