/**
 * POC nuevo pagination-replication C1-MACRO Payment — cross-layer additive
 * shape (port + adapter + service + HTTP route + UI page/list). 1 RED test
 * file 5 describes layered atomic single batch RED+GREEN macro-cycle (mirror
 * precedent EXACT POC pagination-sale C1-MACRO #1789 + Purchase C1-MACRO
 * #1806, replication scope cumulative cross-POC Purchase + Payment + D1
 * ~3 ciclos post-DEFER dispatch — cycle 2/3 Payment paired sister Purchase
 * inmediato precedent).
 *
 * Marco lock pre-RED:
 *   L1 Estrategia signature change = Opción C ADDITIVE NEW método paralelo.
 *      Port añade `findPaginated(orgId, filters?, pagination?):
 *      Promise<PaginatedResult<Payment>>` paralelo a `findAll(orgId,
 *      filters?): Promise<Payment[]>` legacy preservado. Service añade
 *      `listPaginated(orgId, filters?, pagination?): Promise<PaginatedResult
 *      <Payment>>` paralelo a `list(orgId, filters?): Promise<Payment[]>`
 *      legacy preservado. Dual-API transitional axis-distinct cross-POC
 *      reusable canonical heredado Sale pilot + Purchase precedent EXACT
 *      (#1789 + #1806).
 *   L2 Granularity α = 10 tests existence-only red-regex-discipline (drop
 *      T11 shadcn pagination.tsx file exists redundant — heredado Sale pilot
 *      C1-MACRO `8fe5315` GREEN install + Purchase C1-MACRO `070e2d5`
 *      preserved). 5 layered describes cross-layer cohesion: D1 Port (T1+T2)
 *      + D2 Adapter (T3+T4) + D3 Service (T5+T6) + D4 HTTP route (T7+T8)
 *      + D5 UI (T9+T10).
 *   L3 Filename convention = module prefix in basename `c1-macro-pagination-
 *      additive-shape-payment.poc-nuevo-pagination-replication.test.ts`.
 *      POC suffix unificado `poc-nuevo-pagination-replication`, módulo
 *      discriminator basename upfront (mirror Purchase precedent EXACT
 *      paired sister cycle 1/3).
 *   L4 shadcn Pagination heredado Sale pilot — `components/ui/pagination.tsx`
 *      existing pre-RED. POC pagination-replication NO re-installs.
 *   L5 Server-side filters PRE-pagination canonical heredado Sale + Purchase
 *      precedent (URL searchParams sync RSC).
 *   L-A NEW Marco lock pre-RED Payment cycle: PaymentList prop signature
 *      rename `payments: PaymentWithRelations[]` → `items: PaymentWithRelations[]`
 *      mirror Purchase precedent EXACT (consistency cross-POC matures
 *      cumulative — Sale + Purchase + Payment naming uniforme `items`
 *      canonical). Cascade `payment-list.test.tsx` props ~3 ocurrencias adapt
 *      mismo batch GREEN atomic. §13 NEW canonical prop naming items
 *      cross-module uniformity 2da evidencia matures (paired sister Purchase
 *      1ra precedent EXACT).
 *   L-B NEW Marco lock pre-RED Payment cycle: Test 10 regex target preserved
 *      paired sister Purchase precedent EXACT — `payment-list.tsx` import
 *      `type { PaginatedResult }` from shared VO + `items: PaymentWithRelations
 *      []` prop consume PaginatedResult upstream natural en prop interface.
 *
 * §13 emergentes pre-RED ledger D1 cumulative cementación target POC
 * pagination-replication Payment cycle (mostly heredados Sale + Purchase
 * precedent EXACT 3ra evidencia matures + NEW emergentes 2da/1ra evidencias
 * Payment-specific):
 *
 *   Heredados Sale + Purchase precedent EXACT 3ra evidencia matures:
 *   1. §13 C1-MACRO ADDITIVE dual-method paralelo (findAll+findPaginated,
 *      list+listPaginated) transitional 3ra evidencia matures cumulative
 *      cross-POC (heredado Sale pilot 1ra #1789 + Purchase 2da #1806).
 *   2. §13 Prisma `skip/take` + `count` Promise.all parallel adapter
 *      findPaginated impl 3ra evidencia (heredado Sale + Purchase 2da —
 *      $transaction axis-distinct NO ejercida adapter-side preserve).
 *   3. §13 HTTP route Response.json wrap PaginatedResult<T> shape 3ra
 *      evidencia (heredado).
 *   4. §13 Service NEW método return generic VO `PaginatedResult<T>`
 *      paralelo a list legacy 3ra evidencia (heredado).
 *   5. §13 UI shadcn Pagination + URL searchParams sync RSC pattern 3ra
 *      evidencia (heredado).
 *   6. §13 Page.tsx `searchParams: Promise<...>` Next.js 16 RSC pattern 3ra
 *      evidencia (heredado).
 *   7. §13 Test file naming `c{N}-macro-...` cross-layer cohesion 3ra
 *      evidencia matures (heredado).
 *   8. §13 direct-consumer-tests cascade variant 3ra evidencia (heredado
 *      Sale 1ra + Purchase 2da — `app/(dashboard)/[orgSlug]/payments/__tests__
 *      /page.test.ts` + `components/payments/__tests__/payment-list.test.tsx`
 *      paired sister cascade adapt mismo batch GREEN scope-truncado per
 *      Payment módulo asymmetry NO -format -unification heredados).
 *   9. §13 shadcn pagination.tsx heredado cross-POC drop redundant T11 2da
 *      evidencia matures (paired sister Purchase 1ra — POC pagination-
 *      replication granularity α 10 evidencia variant 2da).
 *
 *   NEW emergentes Payment-specific 2da evidencia matures (1ra Purchase
 *   precedent saved Step 0 expand cycle Purchase):
 *  10. §13 Payment port location asymmetry `domain/payment.repository.ts`
 *      vs Sale/Purchase `domain/ports/X.repository.ts` 2da evidencia matures
 *      cumulative cross-POC (paired sister Cleanup E2 composition root
 *      direct instance — Cleanup pending engram canonical home `feedback/
 *      payment-port-location-asymmetry` 8vo). Manifests this cycle Payment
 *      RED-α — Test 1+2 target file path `modules/payment/domain/payment.
 *      repository.ts` directo NO `domain/ports/payment.repository.ts` per
 *      Cleanup E2 DEFER scope-distinct.
 *  11. §13 payment-adapter-$transaction-axis-distinct-not-used-by-pagination-
 *      read-only 2da evidencia matures cross-POC (paired sister Purchase
 *      1ra precedent — $transaction availability incluida en DbClient
 *      Pick<PrismaClient, "payment" | "paymentAllocation" | "accountsReceivable"
 *      | "$transaction"> NO ejercida adapter-side findPaginated impl
 *      Promise.all([findMany, count]) parallel pattern preserve precedent
 *      EXACT). Manifests this cycle Payment GREEN.
 *  12. §13 Payment composition-root `new PaymentService()` direct instance
 *      vs Sale/Purchase `makeXService()` factory pattern 2da evidencia
 *      matures cumulative cross-POC (paired sister Purchase 1ra precedent —
 *      Cleanup E2 DEFER scope-distinct). Manifests this cycle page.test.ts
 *      mock pattern preserved class instance `class PaymentService { list =
 *      mockPaymentList }` cascade adapt `listPaginated = mockListPaginated`
 *      mismo batch GREEN.
 *
 *   NEW emergentes 1ra evidencia POC pagination-replication Payment cycle:
 *  13. §13 NEW canonical prop naming `items` cross-module uniformity 2da
 *      evidencia matures cumulative cross-POC (paired sister Purchase 1ra
 *      precedent EXACT cycle 1/3 — `purchase-list.tsx` rename `purchases`→
 *      `items` 4 ocurrencias preserved Purchase GREEN). Payment 2da matures
 *      `payment-list.tsx` rename `payments: PaymentWithRelations[]` →
 *      `items: PaymentWithRelations[]` Marco lock L-A pre-RED Payment cycle.
 *  14. §13 NEW direct-consumer-tests cascade scope-truncado asymmetry per
 *      módulo tests-presence 1ra evidencia matures POC pagination-replication
 *      Payment cycle (paired sister Sale + Purchase scope=3 archivos vs
 *      Payment scope=2 archivos NO `payment-list-format.test.tsx` ni
 *      `payment-list-unification.test.tsx` heredados pre-existentes — honest
 *      asymmetry surface per módulo tests-presence diferent). Manifests this
 *      cycle Payment GREEN cascade adapt mismo batch atomic scope=2 archivos
 *      ONLY (`page.test.ts` mockListPaginated + PaginatedResult shape mock
 *      cascade + `payment-list.test.tsx` items prop rename 3 ocurrencias
 *      cascade).
 *  15. red-regex-discipline existence-only 10ma aplicación matures cumulative
 *      cross-POC (mirror Sale pilot C1-MACRO 8va + C0 7ma + Purchase C1-MACRO
 *      9na + cumulative cross-POC).
 *  16. textual-rule-verification recursive structural conventions 10ma
 *      matures (mirror Sale pilot 8va + Purchase 9na — c{N} naming +
 *      readFileSync + poc-id suffix module-prefix basename + path resolve
 *      REPO_ROOT pattern).
 *  17. pre-phase-audit-gate scope cumulative cross-POC 9na matures (Step 0
 *      expand cycle-start cold cumulative cross-POC — verified baseline +
 *      cross-cycle red-test cementación gate forward-only zero collision +
 *      mock-source-identification-gate per módulo asymmetry surface +
 *      direct-consumer-tests cascade pre-execute MANDATORY identified
 *      scope-truncado Payment 2 archivos honest documented).
 *  18. mock-source-identification-gate matures cumulative cross-POC 9na per
 *      módulo asymmetry preserved (Sale + Purchase factory `mockMakeXService`
 *      vs Payment class instance `class PaymentService { list = mockPaymentList
 *      }` heredado pre-RED — Cleanup E2 composition root DEFER preserves
 *      both patterns scope-distinct).
 *
 * Cross-ref engrams cumulative cross-POC:
 *   - `poc-nuevo-pagination-replication/c1-macro-purchase-closed` #1806
 *     (Purchase cycle 1/3 inmediato precedent CLOSED — RED-α `940cfda` +
 *     GREEN `070e2d5` cumulative dual-method ADDITIVE pattern paired sister
 *     replicación EXACT mirror Payment cycle 2/3).
 *   - `poc-nuevo-pagination-sale/closed` #1799 (POC precedent original
 *     CLOSED C0 + C1-MACRO + D1 — 4 sub-fases cumulative pattern Opción C
 *     ADDITIVE dual-method canonical heredado).
 *   - `poc-nuevo-pagination-sale/c1-macro-closed` #1789 (Sale pilot RED file
 *     reference EXACT mirror estructural — replicación pattern Payment 10α
 *     drop T11 shadcn redundant).
 *   - `discovery/pagination-recon-fcdb399` #1782 (canonical home recon).
 *   - `baseline/fcdb399-enumerated-failure-ledger` #1780 (7f enumerated
 *     explicit pre-RED preserved {6,9} envelope membership cumulative
 *     cross-POC).
 *   - `feedback/dispatch-pagination-defer-pending-hex-migration` (5to cleanup
 *     pending NEW POC pagination-replication Marco lock 1 DEFER dispatch).
 *   - `feedback/payment-composition-root-direct-instance-vs-factory-make-
 *     cleanup-pending` (7mo cleanup pending NEW POC pagination-replication
 *     Marco lock E2 DEFER refactor scope-distinct — manifests Payment cycle).
 *   - `feedback/payment-port-location-asymmetry-domain-vs-domain-ports-
 *     cleanup-pending` (8vo cleanup pending NEW POC pagination-replication
 *     port file location asymmetry — manifests Payment cycle).
 *   - `arch/§13/payment-adapter-transaction-axis-distinct-not-used-by-
 *     pagination-read-only` (§13 1ra evidencia Purchase saved → 2da Payment
 *     this cycle).
 *   - `feedback_red_acceptance_failure_mode` (failure mode honest 10/10
 *     enumerated forward-looking pre-GREEN — drop T11 redundant pollutes
 *     11/11 ledger semantic precision).
 *   - `feedback_canonical_rule_application_commit_body` (cite + rationale +
 *     cross-ref applied RED body — 18 §13 emergentes cementación targets
 *     cumulative cross-POC matures Payment cycle).
 *   - `feedback_textual_rule_verification` (4 conventions verified ≥3
 *     evidencias pre-RED commit — c{N}-macro naming + readFileSync +
 *     module-prefix basename + REPO_ROOT path resolve).
 *   - `feedback_pre_phase_audit` (9na evidencia matures cumulative cross-POC
 *     Step 0 expand cycle-start cold cumulative pre-RED Payment).
 *
 * Cross-cycle RED test cementación gate forward-only:
 *   - C1-MACRO Payment RED targets paths PAYMENT-MODULE + APP-DASHBOARD/API
 *     + COMPONENTS (cross-layer atomic). Sale RED targets `modules/sale/...`
 *     ∩ Payment paths = ∅ verified Step 0 expand. Purchase RED targets
 *     `modules/purchase/...` + `app/.../purchases/...` + `components/purchases
 *     /...` ∩ Payment paths = ∅ verified Step 0 expand.
 *   - D1 = doc-only cementación architecture.md cumulative POC entero post-2
 *     C1-MACRO. NO RED tests futuros. Gate satisfecho trivialmente.
 *
 * Granularity α RED scope (10α existence-only forward-looking 5 layered
 * describes — drop T11 shadcn heredado Sale + Purchase):
 *   D1 Port (2): T1 findPaginated NEW signature accepts pagination + T2
 *      return PaginatedResult<Payment> (findAll legacy preservado sin tocar
 *      — paired sister Cleanup E2 composition root DEFER + port location
 *      asymmetry domain/ NO domain/ports/ Cleanup pending DEFER scope).
 *   D2 Adapter (2): T3 skip/take pattern (en findPaginated impl) + T4 count
 *      query (en findPaginated impl). Promise.all parallel pattern canonical
 *      heredado Sale + Purchase precedent EXACT (axis-distinct $transaction
 *      NO ejercida adapter-side preserve precedent).
 *   D3 Service (2): T5 listPaginated NEW signature accepts pagination + T6
 *      return PaginatedResult<Payment> (list legacy preservado sin tocar).
 *   D4 HTTP route (2): T7 import parsePaginationParams from C0 canonical
 *      home + T8 call invocation parsePaginationParams(searchParams).
 *   D5 UI (2): T9 page.tsx consume `.items` (de listPaginated) + T10
 *      payment-list.tsx PaginatedResult shape import/ref (paired sister
 *      Marco lock L-A items prop rename consume PaginatedResult upstream).
 *   T11 DROPPED — shadcn pagination.tsx heredado Sale + Purchase ya exists
 *      pre-RED PASS redundant pollutes ledger semantic precision (10/10 FAIL
 *      regex mismatch zero ENOENT — files exist).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_
 * mode`) 10/10 FAIL enumerated explicit:
 *   T1-T2 FAIL: regex MISMATCH — findPaginated NOT YET in port (legacy
 *   findAll preserved retorna Promise<Payment[]> intacto).
 *   T3-T4 FAIL: regex MISMATCH — adapter sin skip/take/count (legacy findAll
 *   findMany unbounded preserved intacto, NO db.payment.count).
 *   T5-T6 FAIL: regex MISMATCH — listPaginated NOT YET in service (legacy
 *   list preserved retorna Promise<Payment[]> intacto).
 *   T7-T8 FAIL: regex MISMATCH — no parsePaginationParams import/call yet.
 *   T9-T10 FAIL: regex MISMATCH — no .items access in page yet (payments
 *   passed directly to PaymentList preserved), no PaginatedResult ref in
 *   payment-list yet.
 *   Total expected FAIL pre-GREEN: 10/10 enumerated explicit (10 regex
 *   mismatch + 0 ENOENT — files exist already).
 *
 * Source-string assertion pattern: mirror Sale + Purchase precedent EXACT
 * (`fs.readFileSync` regex match — keep red-regex-discipline 10ma matures
 * existence-only assertions verify shape source post-GREEN; runtime behavior
 * assertions defer post-cementación D1).
 *
 * Self-contained future-proof check (lección A6 #5): test asserta paths bajo
 * `modules/payment/{domain,infrastructure,application}` + `app/api/.../
 * payments/route.ts` + `app/(dashboard)/.../payments/page.tsx` + `components
 * /payments/payment-list.tsx` que persisten post D1 cementación. Test vive
 * en `modules/payment/__tests__/` — NO toca paths futuros fuera scope
 * cumulative. Self-contained vs D1 (doc-only) ✓.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C1-MACRO Payment target file paths (5 layers — drop shadcn heredado) ──
// Marco lock E2 + port location asymmetry DEFER preserved — port file
// `modules/payment/domain/payment.repository.ts` directo NO `domain/ports/`
// per Cleanup pending engram canonical home 8vo asymmetry per módulo.

const PORT_FILE = path.join(
  REPO_ROOT,
  "modules/payment/domain/payment.repository.ts",
);
const ADAPTER_FILE = path.join(
  REPO_ROOT,
  "modules/payment/infrastructure/prisma-payments.repository.ts",
);
const SERVICE_FILE = path.join(
  REPO_ROOT,
  "modules/payment/application/payments.service.ts",
);
const ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/route.ts",
);
const PAGE_FILE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/page.tsx",
);
const PAYMENT_LIST_FILE = path.join(
  REPO_ROOT,
  "components/payments/payment-list.tsx",
);

// ── Regex patterns existence-only (red-regex-discipline 10ma matures) ──────
// Opción C ADDITIVE: regex target NEW métodos `findPaginated` (port) +
// `listPaginated` (service) — paralelos a `findAll` + `list` legacy
// preservados sin tocar.

const PORT_FINDPAGINATED_PAGINATION_RE =
  /findPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const PORT_FINDPAGINATED_RETURN_RE =
  /findPaginated\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*Payment\s*>\s*>/;

const ADAPTER_SKIP_TAKE_RE = /skip:\s*[\s\S]*?take:\s*/;
const ADAPTER_COUNT_RE = /(?:db\.payment\.count\b|payment\.count\s*\()/;

const SERVICE_LISTPAGINATED_PAGINATION_RE =
  /listPaginated\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const SERVICE_LISTPAGINATED_RETURN_RE =
  /listPaginated\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*Payment\s*>\s*>/;

const ROUTE_IMPORT_PARSE_RE =
  /^import\s*\{[\s\S]*?parsePaginationParams[\s\S]*?\}\s*from\s*["']@\/modules\/shared\/presentation\/parse-pagination-params["']/m;
const ROUTE_CALL_PARSE_RE = /parsePaginationParams\s*\(\s*searchParams\s*\)/;

const PAGE_ITEMS_ACCESS_RE = /\.items\b/;
const PAYMENT_LIST_PAGINATED_RE = /\bPaginatedResult\b/;

describe("POC nuevo pagination-replication C1-MACRO Payment — cross-layer additive shape (port findPaginated NEW método paralelo legacy findAll preservado + Prisma skip/take/count adapter findPaginated impl + service listPaginated NEW método paralelo legacy list preservado + HTTP route parsePaginationParams wire consume listPaginated + UI page.tsx items access + payment-list.tsx PaginatedResult prop, §13 dual-method ADDITIVE 3ra + Prisma skip/take/count 3ra + HTTP route Response.json wrap 3ra + Service NEW método paralelo 3ra + UI shadcn URL searchParams 3ra + page searchParams RSC 3ra + test naming c{N}-macro 3ra + direct-consumer-tests cascade variant 3ra heredados + §13 shadcn drop redundant T11 2da matures + §13 NEW Payment port location asymmetry 2da + §13 NEW payment-adapter-$transaction-axis-distinct 2da + §13 NEW Payment composition-root direct instance 2da matures + §13 NEW canonical prop naming items cross-module uniformity 2da matures + §13 NEW direct-consumer-tests cascade scope-truncado asymmetry Payment 2 vs Sale+Purchase 3 archivos 1ra evidencia matures, 10α existence-only forward-looking pre-GREEN 10/10 FAIL: 10 regex mismatch + 0 ENOENT files exist drop T11 shadcn heredado)", () => {
  // ── D1: Port — modules/payment/domain/payment.repository.ts ────────────────
  // §13 C1-MACRO ADDITIVE dual-method paralelo pattern 3ra evidencia matures
  // (heredado Sale 1ra #1789 + Purchase 2da #1806). Port location asymmetry
  // domain/ NO domain/ports/ preserved per Cleanup pending engram 8vo.

  describe("Port — payment.repository.ts (ADDITIVE findPaginated NEW método paralelo, legacy findAll preservado, location asymmetry domain/ DEFER preserved)", () => {
    it("Test 1: port findPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (consume shared VO from C0 canonical home modules/shared/domain/value-objects/pagination heredado Sale + Purchase — paralelo a findAll legacy unchanged)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_PAGINATION_RE);
    });

    it("Test 2: port findPaginated NEW return type `Promise<PaginatedResult<Payment>>` (ADDITIVE NEW método paralelo a findAll legacy retorna Promise<Payment[]> intacto)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDPAGINATED_RETURN_RE);
    });
  });

  // ── D2: Adapter — prisma-payments.repository.ts (Tests 3-4) ───────────────
  // §13 Prisma `skip/take` + `count` Promise.all parallel pattern adapter
  // findPaginated impl PaginationOptions 3ra evidencia matures (heredado Sale
  // 1ra + Purchase 2da — axis-distinct $transaction NO ejercida adapter-side
  // preserve precedent EXACT cross-POC reusable canonical, $transaction
  // disponible en DbClient Pick<...> heredado pre-POC NO usada by pagination
  // read-only count+items per Cleanup §13 NEW emergente Payment 2da).

  describe("Adapter — prisma-payments.repository.ts (Prisma skip/take + count en findPaginated impl, $transaction axis-distinct NO ejercida)", () => {
    it("Test 3: adapter findPaginated uses Prisma `skip` + `take` pattern (offset/page-based pagination math via PaginationOptions.page + pageSize — en NEW impl paralelo a findAll legacy)", () => {
      const source = fs.readFileSync(ADAPTER_FILE, "utf8");
      expect(source).toMatch(ADAPTER_SKIP_TAKE_RE);
    });

    it("Test 4: adapter findPaginated calls `count` query (total computation for PaginatedResult.total + totalPages — Promise.all([findMany, count]) parallel pattern heredado Sale + Purchase precedent EXACT en NEW impl)", () => {
      const source = fs.readFileSync(ADAPTER_FILE, "utf8");
      expect(source).toMatch(ADAPTER_COUNT_RE);
    });
  });

  // ── D3: Service — payments.service.ts (Tests 5-6) ────────────────────────
  // §13 Service NEW método return generic VO PaginatedResult<T> paralelo a
  // list legacy 3ra evidencia matures (heredado Sale 1ra + Purchase 2da).

  describe("Service — payments.service.ts (listPaginated NEW método paralelo, legacy list preservado)", () => {
    it("Test 5: service listPaginated NEW signature accepts `pagination?: PaginationOptions` parameter (forwards to repo.findPaginated mismo VO contract — paralelo a list legacy unchanged)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LISTPAGINATED_PAGINATION_RE);
    });

    it("Test 6: service listPaginated NEW return type `Promise<PaginatedResult<Payment>>` (ADDITIVE NEW método paralelo a list legacy retorna Promise<Payment[]> intacto)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LISTPAGINATED_RETURN_RE);
    });
  });

  // ── D4: HTTP route — payments/route.ts (Tests 7-8) ───────────────────────
  // §13 HTTP route Response.json wrap PaginatedResult<T> shape 3ra evidencia
  // matures (heredado Sale 1ra + Purchase 2da — consume parsePaginationParams
  // helper from C0 canonical home + service.listPaginated NEW método).

  describe("HTTP route — payments/route.ts (parsePaginationParams wire-up + listPaginated consume)", () => {
    it("Test 7: route imports `parsePaginationParams` from C0 canonical home `@/modules/shared/presentation/parse-pagination-params` heredado Sale + Purchase (consume shared HTTP boundary helper)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_IMPORT_PARSE_RE);
    });

    it("Test 8: route invokes `parsePaginationParams(searchParams)` to extract pagination VO from URLSearchParams (HTTP boundary translation presentation concern — feeds service.listPaginated NEW método)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_CALL_PARSE_RE);
    });
  });

  // ── D5: UI — page.tsx + payment-list.tsx (Tests 9-10) ────────────────────
  // §13 UI shadcn Pagination + URL search params sync RSC pattern 3ra
  // evidencia matures (heredado Sale 1ra + Purchase 2da) + Page.tsx
  // `searchParams: Promise<...>` Next.js 16 RSC pattern 3ra evidencia
  // matures (heredado). T11 shadcn pagination.tsx file exists DROPPED —
  // heredado Sale + Purchase ya exists pre-RED PASS redundant pollutes
  // ledger semantic precision (§13 shadcn heredado cross-POC drop redundant
  // 2da evidencia matures). Marco lock L-A pre-RED Payment cycle: items
  // prop rename PaymentList preserves §13 NEW canonical prop naming items
  // cross-module uniformity 2da matures cumulative cross-POC.

  describe("UI — page.tsx + payment-list.tsx (drop T11 shadcn heredado redundant, items prop rename L-A)", () => {
    it("Test 9: page.tsx accesses `.items` (consume PaginatedResult shape from paymentService.listPaginated NEW método — server-side pagination wire)", () => {
      const source = fs.readFileSync(PAGE_FILE, "utf8");
      expect(source).toMatch(PAGE_ITEMS_ACCESS_RE);
    });

    it("Test 10: payment-list.tsx references `PaginatedResult` (import or prop type — consume paginated payload shape downstream of page.tsx, paired sister L-A items prop rename consume PaginatedResult upstream natural en prop interface)", () => {
      const source = fs.readFileSync(PAYMENT_LIST_FILE, "utf8");
      expect(source).toMatch(PAYMENT_LIST_PAGINATED_RE);
    });
  });
});
