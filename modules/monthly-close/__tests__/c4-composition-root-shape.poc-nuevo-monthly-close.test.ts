/**
 * POC nuevo monthly-close C4 RED-α — presentation layer composition root
 * factory `makeMonthlyCloseService(): MonthlyCloseService` zero-arg cumulative-
 * precedent EXACT supersede absoluto driver-anchored. 1α POS existence skeleton
 * mirror C0 + C1-α + C2.1-α + C2.2-α + C3-α precedent EXACT cumulative-precedent
 * recursive (reduced cardinality 1α vs C3-α 5α — single artifact composition
 * root NEW + barrel populate MOD GREEN scope).
 *
 * **Marco locks pre-RED 6 ejes confirmados**:
 *
 *   1. **Location `modules/monthly-close/presentation/composition-root.ts`**
 *      cumulative-precedent EXACT 5 evidencias supersede absoluto (sale +
 *      payment + fiscal-periods + iva-books + accounting). Único archivo bajo
 *      `presentation/` autorizado a importar de `infrastructure/` (architecture.md
 *      R4 carve-out). ESLint glob `eslint.config.mjs:152`
 *      `modules/<m>/presentation/composition-root.ts` cubre este archivo
 *      automáticamente sin modificación.
 *
 *   2. **Factory signature opción (b) `makeMonthlyCloseService(): MonthlyCloseService`
 *      zero-arg** cumulative-precedent EXACT 5 evidencias supersede absoluto
 *      (`makeSaleService` + `makePaymentsService` + `makeFiscalPeriodsService` +
 *      `makeIvaBookService` + `makeJournalsService` todos zero-arg). Bookmark
 *      C3-closed wording "(prisma)" param loose superseded por evidence-supersedes-
 *      assumption-lock **5ta evidencia matures cumulative cross-POC** (1ra C1 4
 *      paths + 2da C2.1 4 paths α/δ/ε/ζ + 3ra C2.2 1 path wording + 4ta C3 1
 *      path naming-inconsistencia + 5ta C4 1 path bookmark wording loose
 *      superseded por cumulative-precedent EXACT). Internamente factory consume
 *      `prisma` module-level via `import { prisma } from "@/lib/prisma"`
 *      convención #4 precedent (3 evidencias EXACT sale + iva-books + accounting).
 *
 *   3. **server.ts barrel populate opción (b)** `export { makeMonthlyCloseService }
 *      from "./composition-root"` coherencia cross-module consumption pattern.
 *      C0 placeholder cementó intent. 2 evidencias precedent (payment +
 *      fiscal-periods) supportive — fiscal-periods es precedent más reciente y
 *      EXACT pattern aplicable + monthly-close consume fiscal-periods via barrel
 *      populate cumulative. **§13 server.ts barrel populate variant matures 3ra
 *      evidencia D1 cementación target** (payment + fiscal-periods + monthly-close).
 *
 *   4. **NO §17 carve-out cite at composition-root JSDoc opción (a)** cumulative-
 *      precedent absoluto 5 evidencias (sale + payment + iva-books + accounting +
 *      fiscal-periods todos NO §17 cite). Composition root 0 cross-module Prisma
 *      direct (encapsulado en adapters C3 ya cementados — `FiscalPeriodReaderAdapter`
 *      factory-wrap + `PrismaDraftDocumentsReaderAdapter` own-module + `PrismaMonthlyCloseUnitOfWork`
 *      internal assembly). R4 carve-out cite (architecture.md) suficiente.
 *      **6ta evidencia matures absoluto** monthly-close NEW.
 *
 *   5. **NO test composition-root dedicado opción (a)** cumulative majority 4
 *      evidencias (sale + iva-books + accounting + fiscal-periods); payment 1
 *      evidencia opt-in axis-distinct. RED-α POS existence-only suficiente —
 *      factory single-shot trivial wiring; integration downstream C5
 *      (PrismaMonthlyCloseUnitOfWork + adapters propios + cross-module FiscalPeriodsService
 *      via factory) cubre el shape end-to-end. **5ta evidencia matures D1
 *      cementación target** (sale + iva-books + accounting + fiscal-periods +
 *      monthly-close NEW).
 *
 *   6. **Granularity opción α1 atomic single batch** 2 archivos NEW + 1 MOD
 *      (1 RED test 1α POS existence + 1 GREEN composition-root.ts ~30-40 LOC
 *      mirror iva-books pattern + 1 server.ts barrel populate export). Mirror
 *      C0 + C1-α + C2.1-α + C2.2-α + C3-α precedent EXACT cumulative cycle scope.
 *
 * **Pre-RED redact gate textual-rule-verification recursive structural
 * conventions 4ta evidencia matures cumulative** (C1 1ra evidencia recursive
 * métricas Step 0 + C2.2 2da evidencia recursive C1 cementación textual JSDoc
 * supersede wording loose + C3 3ra evidencia recursive 7 conventions verified
 * ≥3 evidencias EXACT pre-bookmark + C4 4ta evidencia recursive 7 conventions
 * verified ≥3 evidencias EXACT pre-RED redact gate composition root layer):
 *
 *   1. **composition-root.ts location `<module>/presentation/composition-root.ts`**:
 *      5 evidencias EXACT supersede absoluto (sale + payment + fiscal-periods +
 *      iva-books + accounting). Marco lock #1 automatic.
 *   2. **Factory naming `make<X>Service` zero-arg signature**: 5 evidencias EXACT
 *      supersede absoluto (`makeSaleService(): SaleService` + `makePaymentsService():
 *      PaymentsService` + `makeFiscalPeriodsService(): FiscalPeriodsService` +
 *      `makeIvaBookService(): IvaBookService` + `makeJournalsService():
 *      JournalsService`). Marco lock #2 opción (b) zero-arg cumulative supersede
 *      absoluto + bookmark wording "(prisma)" loose superseded.
 *   3. **`import "server-only"` first line**: 5 evidencias EXACT supersede absoluto.
 *   4. **`import { prisma } from "@/lib/prisma"` module-level**: 3 evidencias EXACT
 *      (sale + iva-books + accounting modules con UoW + Prisma direct adapter).
 *      Convención reusada por monthly-close composition root C4 GREEN target.
 *   5. **`repoLike: UnitOfWorkRepoLike = { transaction: (fn, options) =>
 *      prisma.$transaction(fn, options) }` pattern**: 3 evidencias EXACT (sale +
 *      iva-books + accounting). Convención reusada GREEN target.
 *   6. **R4 carve-out cite JSDoc** (architecture.md "presentation/ MUST NOT
 *      import infrastructure/, except composition-root.ts"): 4 evidencias (sale +
 *      payment + iva-books + accounting; fiscal-periods opt-out factory tiny).
 *      Marco lock #4 conduce cite OBLIGATORIA en GREEN composition-root JSDoc
 *      (5ta evidencia matures monthly-close NEW).
 *   7. **NO §17 carve-out cite at composition-root** (presentation→infrastructure
 *      own-module + cross-module via presentation→presentation factory shape):
 *      5 evidencias absoluto (todos los precedents). 6ta evidencia matures
 *      monthly-close NEW.
 *
 * **§13 emergentes capturar D1 cumulative** (defer cementación):
 *   - §13 §13 makeMonthlyCloseService composition root **6ta evidencia matures**
 *     cumulative (sale + payment + fiscal-periods + iva-books + accounting +
 *     monthly-close NEW).
 *   - §13 factory zero-arg signature canonical **6ta evidencia EXACT supersede
 *     absoluto**.
 *   - §13 R4 carve-out cite composition-root JSDoc **5ta evidencia matures**
 *     (sale + payment + iva-books + accounting + monthly-close NEW; fiscal-periods
 *     opt-out factory tiny).
 *   - §13 NO §17 cite at composition-root **6ta evidencia absoluto** cumulative.
 *   - §13 NO test composition-root dedicado **5ta evidencia matures** (sale +
 *     iva-books + accounting + fiscal-periods + monthly-close NEW; payment 1
 *     evidencia opt-in axis-distinct).
 *   - §13 server.ts barrel populate variant **3ra evidencia matures** (payment +
 *     fiscal-periods + monthly-close NEW). Cross-module consumption coherencia
 *     pattern matures cumulative.
 *   - evidence-supersedes-assumption-lock **5ta evidencia matures cumulative
 *     cross-POC** (Lock #2 bookmark wording "(prisma)" param loose superseded
 *     por cumulative-precedent EXACT 5 evidencias zero-arg).
 *   - textual-rule-verification recursive structural conventions **4ta evidencia
 *     matures cumulative** (C1 + C2.2 + C3 + C4 recursive 7 conventions verified
 *     ≥3 evidencias EXACT pre-RED redact gate composition root layer).
 *
 * **Composition root GREEN target shape recon-driven mirror iva-books precedent
 * EXACT** (~30-40 LOC):
 *   - `import "server-only"` first line.
 *   - `import { prisma } from "@/lib/prisma"` module-level (convención #4).
 *   - `import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work"`.
 *   - Service + 2 adapters + UoW imports relative paths (own-module
 *     `application/` + `infrastructure/`).
 *   - JSDoc R4 carve-out cite + NO §17 cite (Lock #4 + cumulative-precedent
 *     absoluto). NO memoización (mirror sale + payment + fiscal-periods +
 *     accounting 4 evidencias — solo iva-books memoiza por cycle-break).
 *   - `const repoLike: UnitOfWorkRepoLike = { transaction: (fn, options) =>
 *     prisma.$transaction(fn, options) };` (convención #5).
 *   - `export function makeMonthlyCloseService(): MonthlyCloseService`
 *     zero-arg (Lock #2). Body: `new MonthlyCloseService({ fiscalPeriods: new
 *     FiscalPeriodReaderAdapter(), draftDocuments: new
 *     PrismaDraftDocumentsReaderAdapter(prisma), uow: new
 *     PrismaMonthlyCloseUnitOfWork(repoLike) })`. 3 deps wiring directos
 *     (FiscalPeriodReaderAdapter default-init wraps factory + DraftDocsReader
 *     own-module Prisma + UoW internal assembly).
 *
 * **server.ts barrel populate GREEN target** (Lock #3 b):
 *   - `import "server-only"` first line (cementado C0).
 *   - `export { makeMonthlyCloseService } from "./composition-root"` agregado.
 *   - Mirror fiscal-periods/server.ts pattern EXACT (factory re-export only,
 *     defer types re-exports a C5/C6 cuando consumers necesiten).
 *
 * 1α homogeneous granularity bisect-friendly POS existence (FAIL pre-GREEN
 * `existsSync === true` reverses cuando file missing, mirror C0 + C1-α + C2.1-α
 * + C2.2-α + C3-α precedent EXACT pattern):
 *   - T1 POS: modules/monthly-close/presentation/composition-root.ts file
 *     exists (factory makeMonthlyCloseService zero-arg + R4 carve-out cite +
 *     NO §17 cite + repoLike pattern + 3 deps wiring directos + JSDoc shape
 *     mirror iva-books precedent EXACT).
 *
 * Test file location modules/monthly-close/__tests__/ — top-level scope mirror
 * C0 + C1-α + C2.1-α + C2.2-α + C3-α precedent EXACT. Presentation layer
 * materialization C4 con primer file real `presentation/composition-root.ts`
 * (NO `.gitkeep`, NO empty barrels speculativos — composition-root.ts emerge
 * primer file real C4; server.ts placeholder cementó C0 quedará populated
 * GREEN). NO content-grep RED-time, existsSync existence-only mirror C1
 * lección heredada cumulative supersede + red-regex-discipline.
 *
 * Self-contained future-proof (lección A6 #5 + Marco lock L6 heredado): shape
 * test asserta path bajo `modules/monthly-close/presentation/` que persiste
 * todo el POC C5-C7 (ningún ciclo borra este path — solo expanden contenido +
 * integration tests C5 behavioral consume composition root + cutover routes
 * C6 hex factory consume `makeMonthlyCloseService` via barrel + C7 wholesale
 * delete `features/monthly-close/*` NO toca paths del C4 RED-α). CLEAN forward
 * verified pre-RED-α via cross-cycle-red-test-cementacion-gate Step 0.6.
 *
 * Source-string assertion pattern: mirror C0 + C1-α + C2.1-α + C2.2-α + C3-α
 * precedent EXACT (`existsSync(resolve(ROOT, rel))`) — keep pattern POC nuevo
 * monthly-close cumulative. Target asserción presentation layer skeleton
 * composition-root.ts file únicamente. Class shape + zero-arg factory + JSDoc
 * R4 carve-out cite + NO §17 cite + repoLike pattern + 3 deps wiring se
 * verifican GREEN tsc + suite cross-cycle (NO RED-time content assertions —
 * mirror lección red-regex-discipline + C1 lección heredados: NO regex needed
 * C4 existence-only, existsSync suficiente, axis-distinct EXISTENCE→CONTENT
 * separation).
 *
 * Expected RED-α failure mode pre-GREEN (per lección red-acceptance-failure-mode
 * heredado):
 *   - T1 FAIL: file NEW NO existe pre-GREEN — `existsSync === true` reverses
 *     (path AUSENTE pre-GREEN, POS existence assertion fails on missing path).
 *     Layer dir `modules/monthly-close/presentation/` ya materializa C0
 *     placeholder (server.ts + index.ts existen) — composition-root.ts emerge
 *     primer file real C4 GREEN.
 * Total expected pre-GREEN: 1 FAIL / 0 PASS / 0 divergent paths declarados.
 * NO preservation guards (innecesarios skeleton create-only — POS existence
 * cutover puro mirror C0 + C1-α + C2.1-α + C2.2-α + C3-α precedent EXACT
 * cumulative cycle scope reduced cardinality 1α).
 *
 * Cross-ref:
 *   - architecture.md §"R4 carve-out" (presentation/ MUST NOT import
 *     infrastructure/ except composition-root.ts; ESLint glob
 *     `eslint.config.mjs:152` cubre automáticamente).
 *   - architecture.md §13 §13 makeMonthlyCloseService composition root 6ta
 *     evidencia matures cumulative cross-module.
 *   - architecture.md §13 factory zero-arg signature canonical 6ta evidencia
 *     EXACT supersede absoluto.
 *   - architecture.md §13 R4 carve-out cite composition-root JSDoc 5ta
 *     evidencia matures.
 *   - architecture.md §13 NO §17 cite at composition-root 6ta evidencia
 *     absoluto cumulative.
 *   - architecture.md §13 NO test composition-root dedicado 5ta evidencia
 *     matures.
 *   - architecture.md §13 server.ts barrel populate variant 3ra evidencia
 *     matures (payment + fiscal-periods + monthly-close).
 *   - features/monthly-close/server.ts:1-3 (driver-anchored barrel pattern
 *     legacy `import "server-only"; export { MonthlyCloseService } from
 *     "./monthly-close.service"`; export * from "./monthly-close.validation"
 *     — C6 cutover target hex factory).
 *   - app/api/organizations/[orgSlug]/monthly-close/route.ts:3,7 (driver-anchored
 *     legacy consumer `new MonthlyCloseService()` zero-arg — C6 cutover target
 *     `makeMonthlyCloseService()` zero-arg simétrico).
 *   - modules/sale/presentation/composition-root.ts (precedent EXACT factory
 *     zero-arg `makeSaleService(): SaleService` + R4 carve-out cite + NO §17
 *     cite + repoLike pattern + cross-module factory imports + multi-deps wiring).
 *   - modules/payment/presentation/composition-root.ts (precedent EXACT factory
 *     zero-arg `makePaymentsService(): PaymentsService` + R4 carve-out cite +
 *     NO §17 cite + tx variant axis-distinct `makePaymentsServiceForTx(tx)`).
 *   - modules/fiscal-periods/presentation/composition-root.ts (precedent EXACT
 *     factory zero-arg `makeFiscalPeriodsService(): FiscalPeriodsService`
 *     factory tiny — el precedent que monthly-close mismo consume via barrel
 *     server.ts).
 *   - modules/iva-books/presentation/composition-root.ts (precedent EXACT
 *     factory `makeIvaBookService(): IvaBookService` + R4 carve-out cite + NO
 *     §17 cite + own-module infrastructure imports + cross-module via factory
 *     shape — mirror pattern más cercano applicable a monthly-close: 0
 *     cross-module concrete imports infrastructure, todos los adapters propios
 *     módulo + cross-module via factory shape `makeFiscalPeriodsService()`).
 *   - modules/accounting/presentation/composition-root.ts (precedent EXACT
 *     factory zero-arg `makeJournalsService(): JournalsService` + R4 carve-out
 *     cite + NO §17 cite + repoLike pattern).
 *   - modules/fiscal-periods/presentation/server.ts (precedent EXACT barrel
 *     populate `export { makeFiscalPeriodsService } from "./composition-root"`
 *     — Lock #3 (b) target shape EXACT factor re-export only).
 *   - modules/payment/presentation/server.ts:3-9 (precedent EXACT barrel populate
 *     5 factory exports `export { makePaymentsService, makePaymentsServiceForTx,
 *     PrismaPaymentsRepository, makePaymentReader, makePaymentServiceAdapter }
 *     from "./composition-root"`).
 *   - modules/monthly-close/application/monthly-close.service.ts (C2.2 cementado
 *     consumer C4 composition root wires `MonthlyCloseService` + deps interface
 *     `{fiscalPeriods, draftDocuments, uow}` 3 deps).
 *   - modules/monthly-close/infrastructure/fiscal-period-reader.adapter.ts
 *     (C3 cementado factory-wrap default-init `constructor(service =
 *     makeFiscalPeriodsService())` cumulative-precedent EXACT — composition
 *     root C4 instancia `new FiscalPeriodReaderAdapter()` zero-arg consume
 *     default-init).
 *   - modules/monthly-close/infrastructure/prisma-draft-documents-reader.adapter.ts
 *     (C3 cementado `constructor(db: Pick<PrismaClient, ...>)` — composition
 *     root C4 instancia `new PrismaDraftDocumentsReaderAdapter(prisma)`
 *     module-level prisma).
 *   - modules/monthly-close/infrastructure/prisma-monthly-close-unit-of-work.ts
 *     (C3 cementado `constructor(repo: UnitOfWorkRepoLike)` — composition
 *     root C4 instancia `new PrismaMonthlyCloseUnitOfWork(repoLike)` —
 *     internamente assembly Accounting + PeriodLocking + FiscalPeriodsTxRepo
 *     tx-bound dentro `withAuditTx` callback timeout 30_000).
 *   - modules/monthly-close/presentation/server.ts (C0 placeholder cementó
 *     intent — Lock #3 (b) GREEN target populate `export {
 *     makeMonthlyCloseService } from "./composition-root"`).
 *   - modules/monthly-close/presentation/index.ts (C0 placeholder isomorphic
 *     barrel cementado — NO populate este RED-α, defer C5/C6 si necesario).
 *   - modules/monthly-close/__tests__/c3-infrastructure-adapters-shape.poc-nuevo-
 *     monthly-close.test.ts (precedent C3 RED-α heredado cumulative — mirror
 *     existsSync POS existence pattern + JSDoc structure shape + C1 lección
 *     "NO RED-time content assertions" supersede cumulative recursive).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C4 → C5-C7 CLEAN: path bajo
 *     `modules/monthly-close/presentation/composition-root.ts` persiste todo
 *     el POC, ningún ciclo borra; C5 integration tests behavioral consume
 *     composition root + C6 cutover routes hex factory consume
 *     `makeMonthlyCloseService` via barrel + C7 wholesale delete
 *     `features/monthly-close/*` NO toca hex paths C4 RED-α).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 1/1 FAIL POS
 *     existence sin divergent paths — clean cutover skeleton create-only
 *     mirror C0 + C1-α + C2.1-α + C2.2-α + C3-α precedent EXACT cumulative
 *     recursive reduced cardinality).
 *   - engram `feedback/red-regex-discipline` (NO regex needed C4 existence-only
 *     — solo existsSync, mirror C2.1-α + C2.2-α + C3-α precedent + 1α atomic
 *     single batch pre-RED redact gate cumulative C1 lección recursive).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite + rationale
 *     + cross-ref applied RED-α commit body — Marco lock #1-6 confirmados +
 *     8 capturas D1 cumulative + lecciones matures 5ta evidence-supersedes-
 *     assumption-lock + 4ta textual-rule-verification recursive structural
 *     conventions).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (1ra C1 + 2da
 *     C2.1 + 3ra C2.2 + 4ta C3 + 5ta C4 evidencia matures cumulative cross-POC
 *     — Lock #2 bookmark wording "(prisma)" param loose superseded por
 *     cumulative-precedent EXACT 5 evidencias zero-arg surface honest
 *     pre-execute).
 *   - engram `feedback/textual-rule-verification` recursive structural
 *     conventions 4ta evidencia matures (C1 1ra + C2.2 2da + C3 3ra + C4 4ta
 *     recursive 7 conventions verified ≥3 evidencias EXACT pre-bookmark).
 *   - engram `feedback/Marco-lock-superseded-by-cumulative-precedent` (Lock #2
 *     factory signature 5 evidencias supersede absoluto bookmark wording
 *     "(prisma)" loose superseded — cumulative path forward decide opción (b)
 *     zero-arg cumulative-precedent EXACT).
 *   - engram `poc-nuevo/monthly-close/c3-closed` (precedent C3 cycle bookmark
 *     post-GREEN clean cutover sin drift — 4 métricas baseline EXACT preserved
 *     cumulative + 7 fails ledger same set + master HEAD `a80e6c3` +11 unpushed
 *     origin + adapters cementados C3 GREEN target consume C4 composition root).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

describe("POC nuevo monthly-close C4 RED-α — presentation layer composition root factory `makeMonthlyCloseService(): MonthlyCloseService` zero-arg cumulative-precedent EXACT supersede absoluto driver-anchored (sale + payment + fiscal-periods + iva-books + accounting 5 evidencias zero-arg + 7 conventions verified ≥3 evidencias EXACT + R4 carve-out cite cumulative-precedent + NO §17 cite cumulative-precedent absoluto) Opción α1 atomic single batch 1α POS existence clean cutover sin divergent paths sin preservation guards skeleton create-only mirror C0 + C1-α + C2.1-α + C2.2-α + C3-α precedent EXACT cumulative-precedent recursive evidence-supersedes-assumption-lock 5ta evidencia (bookmark wording \"prisma\" param loose superseded por cumulative-precedent EXACT zero-arg) + textual-rule-verification recursive structural conventions 4ta evidencia matures + 7 conventions verified ≥3 evidencias EXACT pre-RED redact gate composition root layer", () => {
  // ── A: presentation/ composition root factory zero-arg (Test 1) ──
  // Marco lock #1 location modules/monthly-close/presentation/composition-root.ts
  // 5 evidencias EXACT supersede absoluto. Marco lock #2 opción (b) factory
  // signature `makeMonthlyCloseService(): MonthlyCloseService` zero-arg
  // cumulative-precedent EXACT 5 evidencias supersede absoluto + bookmark
  // wording "(prisma)" param loose superseded evidence-supersedes-assumption-
  // lock 5ta evidencia matures cross-POC. Marco lock #4 opción (a) NO §17
  // cite at composition-root 5 evidencias absoluto. Marco lock #5 opción (a)
  // NO test composition-root dedicado 4 evidencias majority — RED-α POS
  // existence-only suficiente. Composition root 0 cross-module Prisma direct
  // (encapsulado en adapters C3 ya cementados — `FiscalPeriodReaderAdapter`
  // factory-wrap + `PrismaDraftDocumentsReaderAdapter` own-module +
  // `PrismaMonthlyCloseUnitOfWork` internal assembly). R4 carve-out cite
  // (architecture.md) suficiente JSDoc.

  it("Test 1: modules/monthly-close/presentation/composition-root.ts file exists (POSITIVE factory `makeMonthlyCloseService(): MonthlyCloseService` zero-arg cumulative-precedent EXACT 5 evidencias supersede absoluto sale + payment + fiscal-periods + iva-books + accounting + body 3 deps wiring directos `{fiscalPeriods: new FiscalPeriodReaderAdapter(), draftDocuments: new PrismaDraftDocumentsReaderAdapter(prisma), uow: new PrismaMonthlyCloseUnitOfWork(repoLike)}` mirror iva-books precedent EXACT pattern más cercano applicable own-module infrastructure imports + cross-module via factory shape `makeFiscalPeriodsService()` default-init wrap — `import \"server-only\"` first line cementado C0 5 evidencias EXACT + `import { prisma } from \"@/lib/prisma\"` module-level convención #4 3 evidencias EXACT + `repoLike: UnitOfWorkRepoLike = { transaction: (fn, options) => prisma.$transaction(fn, options) }` convención #5 3 evidencias EXACT + R4 carve-out cite JSDoc Marco lock #4 5ta evidencia matures + NO §17 cite at composition-root cumulative-precedent absoluto 6ta evidencia + NO memoización mirror sale + payment + fiscal-periods + accounting 4 evidencias supersede solo iva-books memoiza por cycle-break — Lock #1 location automatic + Lock #2 opción (b) zero-arg cumulative-precedent EXACT supersede absoluto + Lock #4 opción (a) NO §17 cite cumulative absoluto + Lock #5 opción (a) NO test dedicado majority + Lock #6 granularity α1 atomic single batch + evidence-supersedes-assumption-lock 5ta evidencia matures cumulative cross-POC bookmark wording \"prisma\" param loose superseded por cumulative-precedent EXACT zero-arg)", () => {
    expect(exists("modules/monthly-close/presentation/composition-root.ts")).toBe(true);
  });
});
