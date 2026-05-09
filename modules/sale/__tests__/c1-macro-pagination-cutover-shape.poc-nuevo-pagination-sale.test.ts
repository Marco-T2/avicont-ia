/**
 * POC nuevo pagination-sale C1-MACRO RED — cross-layer cutover shape (port +
 * adapter + service + HTTP route + UI page/list/shadcn). 1 RED test file 5
 * describes layered atomic single batch RED+GREEN macro-cycle (evidence-
 * supersedes-assumption-lock retroactiva intra-POC #1782 ~6 ciclos scope
 * collapsed → C0 + C1-MACRO + D1 per Marco lock Opción 1 BREAKING signature).
 *
 * Marco lock pre-RED (Step 0 expand 1-9 verified este turno):
 *   L1 Estrategia signature change = Opción 1 BREAKING. findAll mismo nombre,
 *      signature acepta `pagination?: PaginationOptions` + return
 *      `Promise<PaginatedResult<Sale>>` siempre. Obliga atomic batch C1+C2+
 *      C3+C4+C5 single commit (NO TDD incremental — colapsa POC scope).
 *   L2 Granularity α = 1 RED file 5 describes layered (~11 regex existence-
 *      only red-regex-discipline). Mirror C0 4α escalado cross-layer cohesivo.
 *   L3 Scope supersede #1782 ~6 ciclos confirmado — POC pilot revisado
 *      C0 CLOSED + C1-MACRO + D1 (3 cycles total post-supersede).
 *   L4 shadcn Pagination strategy = `npx shadcn add pagination` CLI install
 *      (Marco lock F #1782 alineado).
 *   L5 StatusFilter SaleList axis-η Sub-φ = mover server-side via URL
 *      searchParams. SaleList drop client-side useState filter. Coherent UX
 *      pre-pagination filter.
 *   L6 Test path = `modules/sale/__tests__/c1-macro-pagination-cutover-
 *      shape.poc-nuevo-pagination-sale.test.ts`. NEW naming convention tag
 *      `c{N}-macro-...` 1ra evidencia matures cross-layer cohesion.
 *
 * §13 NEW emergentes pre-RED (D1 cumulative cementación target additionals
 * sobre C0 5 ya nominados — total POC ~10-12 §13 NEW):
 *   1. §13 NEW C1-MACRO atomic batch BREAKING signature change pattern 1ra
 *      evidencia (port + adapter + service + route + UI + fake atomic).
 *   2. §13 NEW Prisma `skip/take` + `count` parallel ($transaction[fM,count])
 *      pattern adapter PaginationOptions 1ra evidencia.
 *   3. §13 NEW HTTP route Response.json wrap PaginatedResult<T> shape 1ra
 *      evidencia (raw json wrap pattern divergence vs Sale[] flat).
 *   4. §13 NEW Service signature change return generic VO `PaginatedResult<T>`
 *      1ra evidencia (consume shared VO downstream port).
 *   5. §13 NEW UI shadcn Pagination + URL search params sync RSC pattern 1ra
 *      evidencia (server-side pagination state in URL, client-side wire-up).
 *   6. §13 NEW Page.tsx `searchParams: Promise<...>` Next.js 16 RSC pattern +
 *      filters/pagination wire 1ra evidencia (params + searchParams paired).
 *   7. §13 NEW Test file naming `c{N}-macro-...` cross-layer cohesion 1ra
 *      evidencia (extiende c{N}-{descriptor} POC #11.0a A3 precedent).
 *   8. §13 NEW evidence-supersedes-assumption-lock retroactiva intra-POC
 *      scope collapse 1ra evidencia (recon #1782 ~6 ciclos → 3 ciclos
 *      post-Marco-lock Opción 1).
 *   9. red-regex-discipline existence-only 8va aplicación matures cumulative
 *      cross-POC (mirror C0 4α 7ma + payment C0-pre 6α + paired-pr C7-pre +
 *      cross-cycle C0/C1b/C3-C4/C5-C6 poc-nuevo-a3).
 *  10. textual-rule-verification recursive structural conventions 8va matures
 *      (mirror C0 7ma 4 conventions verified — c{N} naming + readFileSync +
 *      poc-id suffix + path resolve REPO_ROOT pattern).
 *
 * Cross-ref engrams cumulative:
 *   - `poc-nuevo-pagination-sale/c0-closed` #1785 (paired sister 1er ciclo
 *     CLOSED — VO + schema + helper canonical home consumido downstream).
 *   - `discovery/pagination-recon-fcdb399` #1782 (canonical home recon — 12
 *     listados + 7 axes Marco lock + VO shape canonical APROBADO + POC pilot
 *     scope ~6 ciclos pre-supersede).
 *   - `baseline/fcdb399-enumerated-failure-ledger` #1780 (7f enumerated
 *     explicit pre-RED preserved {6,9} envelope membership).
 *   - `arch/lecciones/dispatches-hub-flake-recurrente` rev 8 (§13.A3-D4-α 31ª
 *     timeout pole stuck preserved across cycle).
 *   - `feedback_red_acceptance_failure_mode` (failure mode honest 11/11
 *     enumerated forward-looking pre-GREEN).
 *   - `feedback_canonical_rule_application_commit_body` (cite + rationale +
 *     cross-ref applied RED body — 10 §13 NEW emergentes cementación targets).
 *   - `feedback_textual_rule_verification` (4 conventions verified ≥3
 *     evidencias pre-RED commit — c{N} naming heredada + readFileSync
 *     heredada + poc-id suffix heredada + REPO_ROOT path resolve heredada).
 *   - `feedback_invariant_collision_elevation` (BREAKING signature collision
 *     elevated → in-memory fake §13.A4-η Sub-B/Sub-D paired axis-distinct
 *     surfaced honest pre-RED — fake adapt mismo batch atomic).
 *
 * Cross-cycle RED test cementación gate forward-only D1:
 *   - C1-MACRO RED targets paths SALE-MODULE + APP-DASHBOARD/API + COMPONENTS
 *     (cross-layer atomic). D1 = doc-only cementación architecture.md +
 *     lecciones engram (NO RED tests futuros). Gate satisfecho trivialmente.
 *
 * Granularity α RED scope (11α existence-only forward-looking 5 layered
 * describes):
 *   D1 Port (2): T1 findAll signature accept pagination + T2 return
 *      PaginatedResult<Sale>.
 *   D2 Adapter (2): T3 skip/take pattern + T4 count query.
 *   D3 Service (2): T5 list signature accept pagination + T6 return
 *      PaginatedResult<Sale>.
 *   D4 HTTP route (2): T7 import parsePaginationParams + T8 call invocation.
 *   D5 UI (3): T9 page.tsx consume `.items` + T10 sale-list.tsx PaginatedResult
 *      shape import + T11 components/ui/pagination.tsx file exists (shadcn).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_
 * mode`):
 *   T1-T10 FAIL: regex MISMATCH — pre-RED state 10 source files don't contain
 *   target patterns (current findAll returns Promise<Sale[]>, no skip/take/
 *   count, no parsePaginationParams import, no .items access, no
 *   PaginatedResult import in UI).
 *   T11 FAIL: file ABSENT — `components/ui/pagination.tsx` NOT yet created
 *   pre-GREEN (shadcn install deferred a GREEN phase).
 *   Total expected FAIL pre-GREEN: 11/11 enumerated explicit (10 regex
 *   mismatch + 1 ENOENT).
 *
 * Source-string assertion pattern: mirror precedent C0 + payment C0-pre +
 * paired-pr C7-pre + cross-cycle poc-nuevo-a3 (`fs.readFileSync` regex match
 * + `fs.existsSync` for file presence — keep red-regex-discipline pattern.
 * Existence-only assertions verify shape source post-GREEN; runtime behavior
 * assertions defer post-cementación D1 si Marco lockea integration tests).
 *
 * Self-contained future-proof check (lección A6 #5): test asserta paths bajo
 * `modules/sale/{domain,infrastructure,application}` + `app/api/.../sales/
 * route.ts` + `app/(dashboard)/.../sales/page.tsx` + `components/sales/sale-
 * list.tsx` + `components/ui/pagination.tsx` que persisten post D1
 * cementación. Test vive en `modules/sale/__tests__/` — NO toca paths futuros
 * fuera scope cumulative. Self-contained vs D1 (doc-only) ✓.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C1-MACRO target file paths (5 layers + shadcn install) ──────────────────

const PORT_FILE = path.join(
  REPO_ROOT,
  "modules/sale/domain/ports/sale.repository.ts",
);
const ADAPTER_FILE = path.join(
  REPO_ROOT,
  "modules/sale/infrastructure/prisma-sale.repository.ts",
);
const SERVICE_FILE = path.join(
  REPO_ROOT,
  "modules/sale/application/sale.service.ts",
);
const ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/sales/route.ts",
);
const PAGE_FILE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/sales/page.tsx",
);
const SALE_LIST_FILE = path.join(
  REPO_ROOT,
  "components/sales/sale-list.tsx",
);
const PAGINATION_UI_FILE = path.join(
  REPO_ROOT,
  "components/ui/pagination.tsx",
);

// ── Regex patterns existence-only (red-regex-discipline 8va matures) ────────

const PORT_FINDALL_PAGINATION_RE =
  /findAll\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const PORT_FINDALL_RETURN_RE =
  /findAll\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*Sale\s*>\s*>/;

const ADAPTER_SKIP_TAKE_RE = /skip:\s*[\s\S]*?take:\s*/;
const ADAPTER_COUNT_RE = /(?:db\.sale\.count\b|sale\.count\s*\()/;

const SERVICE_LIST_PAGINATION_RE =
  /list\s*\([\s\S]*?pagination\??:\s*PaginationOptions/;
const SERVICE_LIST_RETURN_RE =
  /list\s*\([\s\S]*?\)\s*:\s*Promise<\s*PaginatedResult\s*<\s*Sale\s*>\s*>/;

const ROUTE_IMPORT_PARSE_RE =
  /^import\s*\{[\s\S]*?parsePaginationParams[\s\S]*?\}\s*from\s*["']@\/modules\/shared\/presentation\/parse-pagination-params["']/m;
const ROUTE_CALL_PARSE_RE = /parsePaginationParams\s*\(\s*searchParams\s*\)/;

const PAGE_ITEMS_ACCESS_RE = /\.items\b/;
const SALE_LIST_PAGINATED_RE = /\bPaginatedResult\b/;

describe("POC nuevo pagination-sale C1-MACRO — cross-layer cutover shape (port findAll BREAKING signature + Prisma skip/take/count adapter + service list signature change + HTTP route parsePaginationParams wire + UI page.tsx items access + sale-list.tsx PaginatedResult prop + shadcn pagination component install, §13 NEW C1-MACRO atomic batch BREAKING + Prisma skip/take/count + HTTP route Response.json wrap + Service generic VO + UI shadcn + page searchParams RSC + test naming c{N}-macro + evidence-supersedes-assumption-lock 8 §13 NEW emergentes 1ra evidencia matures cumulative cross-POC, 11α existence-only forward-looking pre-GREEN 11/11 FAIL: 10 regex mismatch + 1 ENOENT)", () => {
  // ── D1: Port — modules/sale/domain/ports/sale.repository.ts (Tests 1-2) ──
  // §13 NEW C1-MACRO atomic batch BREAKING signature change pattern 1ra
  // evidencia + Service signature change return generic VO PaginatedResult<T>
  // 1ra evidencia consumed downstream.

  describe("Port — sale.repository.ts (BREAKING findAll signature)", () => {
    it("Test 1: port findAll signature accepts `pagination?: PaginationOptions` parameter (consume shared VO from C0 canonical home modules/shared/domain/value-objects/pagination)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDALL_PAGINATION_RE);
    });

    it("Test 2: port findAll return type `Promise<PaginatedResult<Sale>>` (BREAKING change from Promise<Sale[]> — consumers cumulative atomic batch flip)", () => {
      const source = fs.readFileSync(PORT_FILE, "utf8");
      expect(source).toMatch(PORT_FINDALL_RETURN_RE);
    });
  });

  // ── D2: Adapter — modules/sale/infrastructure/prisma-sale.repository.ts ──
  // §13 NEW Prisma `skip/take` + `count` parallel pattern adapter
  // PaginationOptions 1ra evidencia (axis-distinct vs unbounded findMany pre-
  // C1).

  describe("Adapter — prisma-sale.repository.ts (Prisma skip/take + count)", () => {
    it("Test 3: adapter findAll uses Prisma `skip` + `take` pattern (offset/page-based pagination math via PaginationOptions.page + pageSize)", () => {
      const source = fs.readFileSync(ADAPTER_FILE, "utf8");
      expect(source).toMatch(ADAPTER_SKIP_TAKE_RE);
    });

    it("Test 4: adapter findAll calls `count` query (total computation for PaginatedResult.total + totalPages — likely $transaction[findMany, count] parallel pattern)", () => {
      const source = fs.readFileSync(ADAPTER_FILE, "utf8");
      expect(source).toMatch(ADAPTER_COUNT_RE);
    });
  });

  // ── D3: Service — modules/sale/application/sale.service.ts (Tests 5-6) ──
  // §13 NEW Service signature change return generic VO PaginatedResult<T>
  // 1ra evidencia.

  describe("Service — sale.service.ts (list signature change return PaginatedResult)", () => {
    it("Test 5: service list signature accepts `pagination?: PaginationOptions` parameter (forwards to repo.findAll mismo VO contract)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LIST_PAGINATION_RE);
    });

    it("Test 6: service list return type `Promise<PaginatedResult<Sale>>` (BREAKING change from Promise<Sale[]> — driver consumers cumulative atomic flip)", () => {
      const source = fs.readFileSync(SERVICE_FILE, "utf8");
      expect(source).toMatch(SERVICE_LIST_RETURN_RE);
    });
  });

  // ── D4: HTTP route — app/api/.../sales/route.ts (Tests 7-8) ─────────────
  // §13 NEW HTTP route Response.json wrap PaginatedResult<T> shape 1ra
  // evidencia (consume parsePaginationParams helper from C0 canonical home).

  describe("HTTP route — sales/route.ts (parsePaginationParams wire-up)", () => {
    it("Test 7: route imports `parsePaginationParams` from C0 canonical home `@/modules/shared/presentation/parse-pagination-params` (consume shared HTTP boundary helper)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_IMPORT_PARSE_RE);
    });

    it("Test 8: route invokes `parsePaginationParams(searchParams)` to extract pagination VO from URLSearchParams (HTTP boundary translation presentation concern)", () => {
      const source = fs.readFileSync(ROUTE_FILE, "utf8");
      expect(source).toMatch(ROUTE_CALL_PARSE_RE);
    });
  });

  // ── D5: UI — page.tsx + sale-list.tsx + shadcn pagination (Tests 9-11) ──
  // §13 NEW UI shadcn Pagination + URL search params sync RSC pattern 1ra
  // evidencia + Page.tsx `searchParams: Promise<...>` Next.js 16 RSC pattern
  // 1ra evidencia + StatusFilter axis-η Sub-φ moved server-side.

  describe("UI — page.tsx + sale-list.tsx + shadcn pagination", () => {
    it("Test 9: page.tsx accesses `.items` (consume PaginatedResult shape from saleService.list — server-side pagination wire)", () => {
      const source = fs.readFileSync(PAGE_FILE, "utf8");
      expect(source).toMatch(PAGE_ITEMS_ACCESS_RE);
    });

    it("Test 10: sale-list.tsx references `PaginatedResult` (import or prop type — consume paginated payload shape downstream of page.tsx)", () => {
      const source = fs.readFileSync(SALE_LIST_FILE, "utf8");
      expect(source).toMatch(SALE_LIST_PAGINATED_RE);
    });

    it("Test 11: components/ui/pagination.tsx file exists (shadcn pagination component installed via `npx shadcn add pagination` per Marco lock F #1782)", () => {
      expect(fs.existsSync(PAGINATION_UI_FILE)).toBe(true);
    });
  });
});
