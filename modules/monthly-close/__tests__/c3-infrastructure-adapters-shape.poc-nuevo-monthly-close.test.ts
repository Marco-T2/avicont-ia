/**
 * POC nuevo monthly-close C3 RED-α — infrastructure adapters Prisma concretes
 * + UoW implementación §17 carve-out cross-module driver-anchored cumulative-
 * precedent EXACT (sale + accounting + iva-books UoW POC #9 shared shape +
 * §17 carve-out cite OBLIGATORIA cross-module concrete imports + 3 evidencias
 * UoW naming `prisma-<module>-unit-of-work.ts` + 3 evidencias §17 cite cumulative).
 * 5α POS existence skeleton mirror C0 + C1-α + C2.1-α + C2.2-α precedent EXACT.
 *
 * **Marco locks pre-RED 6 ejes confirmados**:
 *
 *   1. **Adapter location: monthly-close/infrastructure/ todos 5 adapters**
 *      (cumulative-precedent EXACT supersede absoluto). 4 con cross-module
 *      Prisma direct (DraftDocumentsReader 5 entity tables + AccountingReader
 *      raw SQL JOIN journal_lines/journal_entries + PeriodLockingWriter 5
 *      entity tables + UoW assembles 4 adapters) → §17 carve-out cite
 *      OBLIGATORIA. FiscalPeriodReader factory-wrap `makeFiscalPeriodsService`
 *      hex (R3 vigente) → NO §17 cite (mirror iva-books `legacy-fiscal-periods.adapter.ts`
 *      pattern EXACT — wraps factory NOT direct Prisma).
 *
 *   2. **FiscalPeriodReader naming opción (b) `fiscal-period-reader.adapter.ts`**
 *      (NO prisma- prefix). Factory-wrap NO-direct-Prisma → consistente NO
 *      prisma- prefix mirror accounting `fiscal-periods-read.adapter.ts`
 *      precedent EXACT (variant naming infix `-read` adopted as `-reader`
 *      suffix mirror `*ReaderPort` 5 evidencias cumulative cross-module). 2
 *      precedents inconsistentes pre-bookmark (iva-books `legacy-` + accounting
 *      `*-read.adapter.ts`) — Marco lock cumulative path forward decide
 *      opción (b) honest surface evidence-supersedes-assumption-lock 4ta
 *      evidencia matures (lock #2 inconsistencia precedent surface honest
 *      pre-execute).
 *
 *   3. **PeriodLockingWriter naming opción (a) `prisma-period-locking-writer.adapter.ts`**.
 *      Paired sister Reader pattern coherente, write semantics distinct, NEW
 *      canonical home Writer adapter naming POC monthly-close 1ra evidencia
 *      formal. 0 precedents `*-writer.adapter.ts` cross-module — NEW pattern
 *      Marco lock NEW canonical D1 cementación.
 *
 *   4. **Granularity opción α1 atomic single batch C3** (5 archivos NEW + 1
 *      RED test 5α existence-only). Mirror C2.1 cumulative cycle scope precedent
 *      (4 NEW + 1 MOD = 5 archivos batch atomic). UoW assembly natural mismo
 *      batch (depends on 4 adapters compile clean GREEN cycle scope).
 *
 *   5. **Timeout 30_000 wiring opción APROBADO** `withAuditTx(repo, ctx, fn,
 *      { timeout: 30_000 })` 4to arg signature `audit-tx.ts:32`. Adapter
 *      constructor constants (NO config dinámico). Sale + accounting + iva-books
 *      UoW NO usan options 4to arg (default no-timeout, Prisma default 5s) —
 *      monthly-close NEW 1ra evidencia POC paired sister legacy parity
 *      preservation `prisma.$transaction(cb, {timeout: 30_000})`
 *      `features/monthly-close.service.ts:228`. JSDoc cite Riesgo C/D resolution.
 *
 *   6. **Riesgo C lock cascade rationale JSDoc opción (c) ambas**:
 *      - PrismaPeriodLockingWriterAdapter JSDoc: "STRICT ORDER preserved at
 *        service-level" + ref design.md §Lock order (FK direction Sale↔JE
 *        rationale archive `openspec/changes/archive/2026-04-21-cierre-periodo/design.md`).
 *      - PrismaMonthlyCloseUnitOfWork JSDoc: §17 carve-out + Riesgo C citation
 *        ref design.md §Lock order (top-level adapter assembly context).
 *      service.ts:62-64 ya cita design.md §"Lock order" cumulative consume.
 *
 * **evidence-supersedes-assumption-lock 4ta evidencia matures cumulative
 * cross-POC** (C3 lock #2 inconsistencia precedent factory-wrap adapter naming
 * iva-books `legacy-` vs accounting `*-read.adapter.ts` 2 axis-distinct
 * precedents para misma tarea — Marco lock decide cumulative path forward
 * opción (b) `*-reader.adapter.ts` mirror accounting variant + suffix `*Reader`
 * cumulative 5 evidencias supersede pre-bookmark — 1ra C1 4 paths post-recon +
 * 2da C2.1 4 paths α/δ/ε/ζ UoW POC #9 + 3ra C2.2 1 path wording-implícito +
 * 4ta C3 1 path naming-inconsistencia-axis-distinct).
 *
 * **textual-rule-verification recursive structural conventions 3ra evidencia
 * matures cumulative** (C1 1ra evidencia recursive métricas Step 0 + C2.2 2da
 * evidencia recursive C1 cementación textual JSDoc supersede wording loose +
 * C3 3ra evidencia recursive 7 conventions verified ≥3 evidencias EXACT
 * pre-bookmark). Pre-RED redact gate textual rule verification recursive 7
 * conventions:
 *   1. UoW file naming `prisma-<module>-unit-of-work.ts`: 3 evidencias (sale +
 *      accounting + iva-books).
 *   2. UoW location `<module>/infrastructure/`: 4 evidencias (sale + accounting
 *      + iva-books + shared base).
 *   3. §17 carve-out cite OBLIGATORIA cross-module concrete imports: 3
 *      evidencias cementadas (sale UoW cita "§17 carve-out" + accounting UoW
 *      cita "§17 carve-out" + iva-books UoW cita "NO §17 carve-out — todos los
 *      imports propio módulo o shared base").
 *   4. JSDoc UoW first sentence "Postgres-backed adapter for `<X>UnitOfWork`":
 *      3 evidencias (sale + accounting + iva-books).
 *   5. JSDoc UoW "Mirror" + "Delegates fully a `withAuditTx` 4 invariantes
 *      (correlationId pre-tx, SET LOCAL inside, fn invoke, return shape)": 3
 *      evidencias.
 *   6. Reader adapter naming `prisma-<X>-reader.adapter.ts`: ≥3 evidencias
 *      (sale `prisma-iva-book-reader` + sale `prisma-org-settings-reader` +
 *      iva-books `prisma-purchase-reader` + iva-books `prisma-sale-reader`).
 *   7. Tx-bound at construction pattern `constructor(private readonly tx:
 *      Prisma.TransactionClient)`: 3+ evidencias (PrismaFiscalPeriodsTxRepo +
 *      PrismaAccountBalancesRepo + PrismaJournalEntriesRepository).
 *
 * 2 axis-distinct surfaces honest pre-RED redact gate (NO collision RED-time
 * content assertions, NEW pattern declared D1 cementación):
 *   - Writer adapter naming `prisma-<X>-writer.adapter.ts`: 0 precedents — NEW
 *     pattern monthly-close 1ra evidencia formal canonical home D1 (Lock #3).
 *   - Factory-wrap adapter naming axis-distinct INCONSISTENTE precedent:
 *     iva-books `legacy-fiscal-periods.adapter.ts` ≠ accounting
 *     `fiscal-periods-read.adapter.ts` — 2 precedents distintos misma tarea.
 *     Marco lock #2 opción (b) `*-reader.adapter.ts` cumulative path forward
 *     3ra evidencia matures (iva-books + accounting + monthly-close NEW).
 *
 * **Cumulative-precedent verification ≥3 evidencias EXACT pre-RED redact gate
 * structural conventions infrastructure adapters** (heredado lección C1 + C2.1
 * + C2.2 matures 3ra evidencia recursive):
 *   - UoW naming `prisma-<module>-unit-of-work.ts`: **3 evidencias** (sale
 *     `prisma-sale-unit-of-work.ts` + accounting `prisma-accounting-unit-of-
 *     work.ts` + iva-books `prisma-iva-book-unit-of-work.ts`) — supersede ≥3 ✓.
 *   - UoW location `<module>/infrastructure/`: **4 evidencias** cumulative
 *     cross-module — supersede absoluto.
 *   - §17 carve-out cite OBLIGATORIA cross-module concrete imports: **3
 *     evidencias cementadas** (sale + accounting + iva-books NO cite explícita
 *     porque own-module + shared base) — pattern canónico cementado.
 *   - JSDoc UoW first sentence + "Mirror" + "Delegates fully a `withAuditTx`
 *     4 invariantes" pattern: **3 evidencias** cumulative.
 *   - Reader adapter naming `prisma-<X>-reader.adapter.ts`: **≥4 evidencias**
 *     cumulative cross-module (sale x2 + iva-books x2) — supersede ≥3 ✓.
 *   - Tx-bound at construction pattern `constructor(private readonly tx:
 *     Prisma.TransactionClient)`: **3+ evidencias** (PrismaFiscalPeriodsTxRepo
 *     + PrismaAccountBalancesRepo + PrismaJournalEntriesRepository) — supersede
 *     absoluto.
 *   - withAuditTx 4to arg `{timeout?, maxWait?}` signature `audit-tx.ts:32`
 *     disponible: **1 evidencia signature canonical** (NO consumed sale +
 *     accounting + iva-books — monthly-close NEW 1ra evidencia consume legacy
 *     parity preservation).
 *
 * **§13 emergentes capturar D1 cumulative** (defer cementación):
 *   - §13 §17 carve-out cumulative 4ta evidencia matures cross-module (sale +
 *     accounting + iva-books NO + monthly-close NEW = 4 evidencias formales).
 *   - §13 NEW Writer adapter naming `prisma-<X>-writer.adapter.ts` 1ra evidencia
 *     POC monthly-close paired sister Reader pattern Lock #3.
 *   - §13 NEW UoW timeout option pass via withAuditTx 4to arg 1ra evidencia
 *     POC monthly-close (legacy parity preservation 30_000 Lock #5).
 *   - §13 NEW factory-wrap adapter naming convention NO-prisma-prefix 3ra
 *     evidencia matures (iva-books `legacy-*` + accounting `*-read.adapter.ts`
 *     + monthly-close `*-reader.adapter.ts` Lock #2).
 *   - Riesgo C lock cascade rationale JSDoc paired adapter + UoW pattern NEW
 *     canonical home 1ra evidencia (Lock #6).
 *   - evidence-supersedes-assumption-lock 4ta evidencia matures cumulative
 *     (Lock #2 inconsistencia precedent surface honest pre-execute).
 *   - textual-rule-verification recursive structural conventions 3ra evidencia
 *     matures (C1 1ra + C2.2 2da + C3 3ra recursive 7 conventions).
 *
 * **Infrastructure adapters GREEN target shape recon-driven mirror precedent
 * EXACT**:
 *   - `fiscal-period-reader.adapter.ts`: factory-wrap `makeFiscalPeriodsService`
 *     hex + narrow `entity.toSnapshot()` 13→2 (`{id, status: "OPEN"|"CLOSED"}`)
 *     mirror iva-books `legacy-fiscal-periods.adapter.ts` precedent shape EXACT
 *     + accounting `fiscal-periods-read.adapter.ts` naming variant.
 *     `NotFoundError(PERIOD_NOT_FOUND)` pass-through legacy parity (adapter NO
 *     captura, throw propaga bit-exact). NO §17 cite (factory-wrap R3 vigente).
 *   - `prisma-draft-documents-reader.adapter.ts`: PrismaClient direct + 5
 *     entities `Promise.all` count cross-entity mirror legacy
 *     `monthly-close.repository.ts:57-89` shape EXACT
 *     `{dispatches, payments, journalEntries, sales, purchases: number}`.
 *     §17 carve-out cite (cross-module Prisma access 5 entity tables).
 *   - `prisma-accounting-reader.adapter.ts`: tx-bound at construction (mirror
 *     PrismaFiscalPeriodsTxRepo pattern) + raw SQL JOIN
 *     `journal_lines + journal_entries POSTED` mirror legacy
 *     `monthly-close.repository.ts:108-131` shape EXACT. §17 carve-out cite
 *     (cross-module Prisma access accounting tables).
 *   - `prisma-period-locking-writer.adapter.ts`: tx-bound at construction + 5
 *     `updateMany {POSTED → LOCKED}` cross-entity mirror legacy
 *     `monthly-close.repository.ts:135-216` shape EXACT 5 methods
 *     `Promise<number>` lock count primitive. §17 carve-out cite (cross-module
 *     Prisma access 5 entity tables) + Riesgo C lock cascade rationale JSDoc
 *     ref design.md §Lock order Lock #6.
 *   - `prisma-monthly-close-unit-of-work.ts`: assembles 4 adapters tx-bound
 *     dentro `withAuditTx` callback + `BaseScope.fiscalPeriods` consumido via
 *     `PrismaFiscalPeriodsTxRepo` shared cumulative POC #9 + `correlationId`
 *     PRE-TX. `withAuditTx(repo, ctx, fn, {timeout: 30_000})` 4to arg legacy
 *     parity preservation Lock #5. §17 carve-out cite + Riesgo C citation
 *     ref design.md §Lock order Lock #6 (top-level adapter assembly context).
 *
 * 5α homogeneous granularity bisect-friendly POS existence (todas FAIL pre-GREEN
 * — `existsSync === true` reverses cuando file missing, mirror C0 + C1-α +
 * C2.1-α + C2.2-α precedent EXACT pattern):
 *   - T1 POS: modules/monthly-close/infrastructure/fiscal-period-reader.adapter.ts
 *     file exists (factory-wrap `makeFiscalPeriodsService` Lock #2 NO-prisma-
 *     prefix mirror accounting precedent variant).
 *   - T2 POS: modules/monthly-close/infrastructure/prisma-draft-documents-reader.adapter.ts
 *     file exists (PrismaClient direct + 5 entities `Promise.all` cross-entity
 *     §17 carve-out cite).
 *   - T3 POS: modules/monthly-close/infrastructure/prisma-accounting-reader.adapter.ts
 *     file exists (tx-bound at construction + raw SQL JOIN journal_lines/
 *     journal_entries §17 carve-out cite).
 *   - T4 POS: modules/monthly-close/infrastructure/prisma-period-locking-writer.adapter.ts
 *     file exists (tx-bound at construction + 5 `updateMany` cross-entity §17
 *     carve-out cite + Riesgo C JSDoc ref design.md Lock #3 NEW Writer pattern).
 *   - T5 POS: modules/monthly-close/infrastructure/prisma-monthly-close-unit-of-work.ts
 *     file exists (assembles 4 adapters + BaseScope.fiscalPeriods + withAuditTx
 *     4to arg timeout 30_000 + §17 cite + Riesgo C ref Lock #5 + #6).
 *
 * Test file location modules/monthly-close/__tests__/ — top-level scope mirror
 * C0 + C1-α + C2.1-α + C2.2-α precedent EXACT. Infrastructure layer materialization
 * C3 con primer file real `infrastructure/<adapter>.ts` (NO `.gitkeep`, NO empty
 * barrels speculativos — layer dir materializa primer file real C3).
 *
 * Self-contained future-proof (lección A6 #5 + Marco lock L6 heredado): shape
 * test asserta 5 paths bajo `modules/monthly-close/infrastructure/` que persisten
 * todo el POC C4-C7 (ningún ciclo borra estos paths — solo expanden contenido +
 * composition root C4 consume estos adapters + integration tests C5 behavioral
 * + cutover routes C6 hex factory). C7 wholesale delete `features/monthly-close/*`
 * NO toca paths del C3 RED-α. CLEAN forward verified pre-RED-α via
 * cross-cycle-red-test-cementacion-gate Step 0.5.
 *
 * Source-string assertion pattern: mirror C0 + C1-α + C2.1-α + C2.2-α precedent
 * EXACT (`existsSync(resolve(ROOT, rel))`) — keep pattern POC nuevo monthly-close
 * cumulative. Target asserciones infrastructure layer skeleton 5 adapter files
 * únicamente. Class shape + tx-bound constructor + JSDoc §17 cite + JSDoc
 * Riesgo C ref + withAuditTx 4to arg timeout + Snapshot LOCAL hidration +
 * Money VO reuse + raw SQL JOIN signature se verifican GREEN tsc + suite
 * cross-cycle (NO RED-time content assertions — mirror lección red-regex-discipline
 * + C1 lección heredados: NO regex needed C3 existence-only, existsSync
 * suficiente, axis-distinct EXISTENCE→CONTENT separation).
 *
 * Expected RED-α failure mode pre-GREEN (per lección red-acceptance-failure-mode
 * heredado):
 *   - T1-T5 FAIL: 5 files NEW NO existen pre-GREEN — `existsSync === true`
 *     reverses (path AUSENTE pre-GREEN, POS existence assertion fails on
 *     missing path). Layer dir `modules/monthly-close/infrastructure/` también
 *     materializa primera vez con primer file real C3 GREEN (NO pre-existe
 *     vacío, mirror sale + accounting + iva-books precedent infrastructure/
 *     first-file pattern EXACT).
 * Total expected pre-GREEN: 5 FAIL / 0 PASS / 0 divergent paths declarados.
 * NO preservation guards (innecesarios skeleton create-only — todos POS
 * existence cutover puro mirror C0 3/3 FAIL + C1-α 3/3 FAIL + C2.1-α 3/3 FAIL
 * + C2.2-α 1/1 FAIL precedent EXACT).
 *
 * Cross-ref:
 *   - architecture.md §17 carve-out cross-module UoW (4ta evidencia matures
 *     monthly-close NEW + sale + accounting + iva-books NO precedent cementado
 *     cumulative cross-module).
 *   - architecture.md §13 NEW Writer adapter naming `prisma-<X>-writer.adapter.ts`
 *     1ra evidencia POC monthly-close paired sister Reader pattern.
 *   - architecture.md §13 NEW UoW timeout option pass via withAuditTx 4to arg
 *     1ra evidencia POC monthly-close legacy parity 30_000 preservation.
 *   - architecture.md §13 NEW factory-wrap adapter naming convention NO-prisma-
 *     prefix 3ra evidencia matures (iva-books + accounting + monthly-close).
 *   - openspec/changes/archive/2026-04-21-cierre-periodo/design.md §"Lock order"
 *     (FK direction Sale↔JE rationale archive frozen logic — Riesgo C citation
 *     ref Lock #6 cementado JSDoc adapter + UoW).
 *   - features/monthly-close/monthly-close.repository.ts:57-89
 *     (`countDraftDocuments` 5 entities `Promise.all` shape EXACT —
 *     PrismaDraftDocumentsReaderAdapter GREEN target).
 *   - features/monthly-close/monthly-close.repository.ts:108-131 (`sumDebitCredit`
 *     raw SQL JOIN journal_lines + journal_entries POSTED shape EXACT —
 *     PrismaAccountingReaderAdapter GREEN target).
 *   - features/monthly-close/monthly-close.repository.ts:135-216 (5 separate
 *     `lockDispatches/lockPayments/lockJournalEntries/lockSales/lockPurchases`
 *     `updateMany {POSTED → LOCKED}` shape EXACT — PrismaPeriodLockingWriterAdapter
 *     GREEN target).
 *   - features/monthly-close/monthly-close.service.ts:135-230 (driver-anchored
 *     `close()` flow EXACT + `repo.transaction(cb, {timeout: 30_000})` legacy
 *     parity preservation Lock #5).
 *   - features/shared/audit-tx.ts:28-40 (`withAuditTx(repo, ctx, fn, options?:
 *     {timeout?, maxWait?})` 4to arg signature canonical Lock #5 disponible
 *     consume legacy parity preservation).
 *   - modules/sale/infrastructure/prisma-sale-unit-of-work.ts (precedent EXACT
 *     §17 carve-out cite cross-module concrete imports + Mirror + Delegates
 *     fully a `withAuditTx` 4 invariantes JSDoc structure).
 *   - modules/accounting/infrastructure/prisma-accounting-unit-of-work.ts
 *     (precedent EXACT §17 carve-out cite shared base + Mirror + Delegates
 *     fully a `withAuditTx` 4 invariantes JSDoc structure).
 *   - modules/iva-books/infrastructure/prisma-iva-book-unit-of-work.ts (precedent
 *     EXACT NO §17 cite "todos los imports propio módulo o shared base R3
 *     vigente" + JSDoc structure 3ra evidencia cumulative cross-module).
 *   - modules/iva-books/infrastructure/legacy-fiscal-periods.adapter.ts
 *     (precedent factory-wrap `makeFiscalPeriodsService` shape EXACT + narrow
 *     `entity.toSnapshot()` 13→2 + `NotFoundError(PERIOD_NOT_FOUND)` pass-through
 *     legacy parity — naming `legacy-` axis-distinct precedent Lock #2 inconsistencia).
 *   - modules/accounting/infrastructure/fiscal-periods-read.adapter.ts (precedent
 *     factory-wrap shape EXACT + naming variant `*-read.adapter.ts` NO-prisma-
 *     prefix Lock #2 opción (b) Marco lock cumulative path forward decide).
 *   - modules/shared/infrastructure/prisma-fiscal-periods-tx.repo.ts (precedent
 *     tx-bound at construction pattern `constructor(private readonly tx:
 *     Prisma.TransactionClient)` shape EXACT + cumulative POC #9 shared
 *     `BaseScope.fiscalPeriods.markClosed` consumido GREEN target UoW assembly).
 *   - modules/shared/infrastructure/prisma-unit-of-work.ts (precedent shape
 *     PrismaUnitOfWork + UnitOfWorkRepoLike + delegates `withAuditTx` 4
 *     invariantes pattern matures).
 *   - modules/accounting/infrastructure/prisma-account-balances.repo.ts +
 *     modules/accounting/infrastructure/prisma-journal-entries.repo.ts
 *     (precedent tx-bound at construction `private readonly tx:
 *     Prisma.TransactionClient` cumulative 3+ evidencias cross-module supersede
 *     absoluto pre-bookmark).
 *   - modules/monthly-close/domain/ports/{fiscal-period-reader,draft-documents-
 *     reader,accounting-reader,period-locking-writer}.port.ts (C1+C2.1
 *     cementados — adapters C3 implement port interfaces shape EXACT GREEN
 *     target).
 *   - modules/monthly-close/application/{monthly-close-unit-of-work,monthly-close.service}.ts
 *     (C2.1+C2.2 cementados MonthlyCloseScope + UnitOfWork generic alias +
 *     MonthlyCloseService — UoW adapter C3 implementa scope membership
 *     `accounting + locking` tx-bound + `BaseScope.fiscalPeriods.markClosed`
 *     consumido shared cumulative POC #9).
 *   - modules/monthly-close/__tests__/c2-1-application-ports-shape.poc-nuevo-
 *     monthly-close.test.ts +
 *     modules/monthly-close/__tests__/c2-2-application-service-class-shape.poc-
 *     nuevo-monthly-close.test.ts (mirror precedent EXACT existsSync pattern
 *     + JSDoc structure shape + C1 lección "NO RED-time content assertions"
 *     supersede cumulative).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C3 → C4-C7 CLEAN: paths bajo
 *     `modules/monthly-close/infrastructure/` persisten todo el POC, ningún
 *     ciclo borra; C4 composition root factory consume adapters + C5 integration
 *     tests behavioral expanden + C6 cutover routes hex factory + C7 wholesale
 *     delete `features/monthly-close/*` NO toca hex paths C3 RED-α).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 5/5 FAIL todas
 *     POS existence sin divergent paths — clean cutover skeleton create-only
 *     mirror C0 + C1-α + C2.1-α + C2.2-α precedent EXACT).
 *   - engram `feedback/red-regex-discipline` (NO regex needed C3 existence-only
 *     — solo existsSync, mirror C2.1-α + C2.2-α precedent + 5α atomic single
 *     batch pre-RED redact gate cumulative C1 lección recursive).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite + rationale
 *     + cross-ref applied RED-α commit body — Marco lock #1-6 confirmados +
 *     7 capturas D1 cumulative + lecciones matures 4ta + 3ra evidencias).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (1ra C1 + 2da
 *     C2.1 + 3ra C2.2 + 4ta C3 evidencia matures cumulative cross-POC — Lock
 *     #2 inconsistencia precedent factory-wrap naming surface honest
 *     pre-execute).
 *   - engram `feedback/textual-rule-verification` recursive structural
 *     conventions 3ra evidencia matures (C1 1ra + C2.2 2da + C3 3ra recursive
 *     7 conventions verified ≥3 evidencias EXACT pre-bookmark).
 *   - engram `feedback/Marco-lock-superseded-by-cumulative-precedent` (C1 2
 *     + C2.1 4 + C3 1 evidencias supersede paths — Lock #2 factory-wrap naming
 *     2 axis-distinct precedents inconsistentes 3ra evidencia matures cumulative
 *     opción (b) `*-reader.adapter.ts` cumulative path forward decide).
 *   - engram `poc-nuevo/monthly-close/c2.2-closed` (precedent C2.2 cycle bookmark
 *     post-GREEN clean cutover sin drift — 4 métricas baseline EXACT preserved
 *     cumulative + 7 fails ledger same set + master HEAD `7359cb8` +9 unpushed
 *     origin).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

describe("POC nuevo monthly-close C3 RED-α — infrastructure adapters Prisma concretes + UoW implementación §17 carve-out cross-module driver-anchored cumulative-precedent EXACT (sale + accounting + iva-books UoW POC #9 shared shape + §17 carve-out cite OBLIGATORIA cross-module concrete imports 3 evidencias + UoW naming `prisma-<module>-unit-of-work.ts` 3 evidencias + tx-bound at construction pattern 3+ evidencias) Opción α1 atomic single batch 5α POS existence clean cutover sin divergent paths sin preservation guards skeleton create-only mirror C0 + C1-α + C2.1-α + C2.2-α precedent EXACT cumulative-precedent recursive evidence-supersedes-assumption-lock 4ta evidencia + textual-rule-verification recursive structural conventions 3ra evidencia matures + 7 conventions verified ≥3 evidencias EXACT pre-RED redact gate", () => {
  // ── A: infrastructure/ factory-wrap adapter NO-prisma-prefix (Test 1) ──
  // Marco lock #2 opción (b) `fiscal-period-reader.adapter.ts` (NO prisma-
  // prefix) — factory-wrap NO-direct-Prisma → consistente NO prisma- prefix
  // mirror accounting `fiscal-periods-read.adapter.ts` precedent EXACT (variant
  // naming infix `-read` adopted as `-reader` suffix mirror `*ReaderPort` 5
  // evidencias cumulative cross-module). 2 precedents inconsistentes pre-bookmark
  // (iva-books `legacy-` + accounting `*-read.adapter.ts`) — Marco lock cumulative
  // path forward decide opción (b) honest surface evidence-supersedes-assumption-
  // lock 4ta evidencia matures.

  it("Test 1: modules/monthly-close/infrastructure/fiscal-period-reader.adapter.ts file exists (POSITIVE factory-wrap `makeFiscalPeriodsService` hex + narrow `entity.toSnapshot()` 13→2 `{id, status: \"OPEN\"|\"CLOSED\"}` mirror iva-books `legacy-fiscal-periods.adapter.ts` precedent shape EXACT + accounting `fiscal-periods-read.adapter.ts` naming variant — `NotFoundError(PERIOD_NOT_FOUND)` pass-through legacy parity adapter NO captura throw propaga bit-exact + NO §17 cite factory-wrap R3 vigente Lock #1 + Lock #2 opción (b) NO-prisma-prefix mirror accounting precedent variant Marco lock cumulative path forward decide 3ra evidencia matures factory-wrap adapter naming convention NO-prisma-prefix iva-books + accounting + monthly-close cumulative)", () => {
    expect(exists("modules/monthly-close/infrastructure/fiscal-period-reader.adapter.ts")).toBe(true);
  });

  // ── B: infrastructure/ prisma-direct cross-entity reader cross-module (Test 2) ──
  // Marco lock #1 location monthly-close/infrastructure/ + §17 carve-out cite
  // OBLIGATORIA cross-module Prisma access (5 entity tables dispatch/payment/
  // journalEntry/sale/purchase). PrismaClient direct + 5 entities `Promise.all`
  // count mirror legacy `monthly-close.repository.ts:57-89` shape EXACT
  // `{dispatches, payments, journalEntries, sales, purchases: number}`.

  it("Test 2: modules/monthly-close/infrastructure/prisma-draft-documents-reader.adapter.ts file exists (POSITIVE PrismaClient direct + 5 entities `Promise.all` count cross-entity mirror legacy `monthly-close.repository.ts:57-89` shape EXACT MonthlyCloseDraftCounts `{dispatches, payments, journalEntries, sales, purchases: number}` primitive-typed Snapshot LOCAL — §17 carve-out cite OBLIGATORIA cross-module Prisma access 5 entity tables dispatch/payment/journalEntry/sale/purchase Lock #1 + 4ta evidencia matures cumulative cross-module sale + accounting + iva-books NO + monthly-close NEW)", () => {
    expect(exists("modules/monthly-close/infrastructure/prisma-draft-documents-reader.adapter.ts")).toBe(true);
  });

  // ── C: infrastructure/ prisma-direct tx-bound reader cross-module accounting (Test 3) ──
  // Marco lock #1 location monthly-close/infrastructure/ + §17 carve-out cite
  // OBLIGATORIA cross-module Prisma access (accounting tables journal_lines +
  // journal_entries). Tx-bound at construction (mirror PrismaFiscalPeriodsTxRepo
  // pattern) + raw SQL JOIN POSTED mirror legacy `monthly-close.repository.ts:108-131`
  // shape EXACT.

  it("Test 3: modules/monthly-close/infrastructure/prisma-accounting-reader.adapter.ts file exists (POSITIVE tx-bound at construction `constructor(private readonly tx: Prisma.TransactionClient)` mirror PrismaFiscalPeriodsTxRepo + PrismaAccountBalancesRepo + PrismaJournalEntriesRepository precedent 3+ evidencias supersede absoluto + raw SQL JOIN journal_lines + journal_entries POSTED mirror legacy `monthly-close.repository.ts:108-131` shape EXACT MonthlyClosePeriodBalance `{debit: Money, credit: Money}` VO-typed reuse — §17 carve-out cite OBLIGATORIA cross-module Prisma access accounting tables Lock #1 + 4ta evidencia matures cumulative + Money VO 4ta cementación cross-POC + sumDebitCredit balance gate INSIDE-TX atomicity snapshot consistency under lock cascade)", () => {
    expect(exists("modules/monthly-close/infrastructure/prisma-accounting-reader.adapter.ts")).toBe(true);
  });

  // ── D: infrastructure/ prisma-direct tx-bound writer cross-entity (Test 4) ──
  // Marco lock #1 location monthly-close/infrastructure/ + §17 carve-out cite
  // OBLIGATORIA cross-module Prisma access (5 entity tables). Marco lock #3
  // opción (a) `prisma-period-locking-writer.adapter.ts` paired sister Reader
  // pattern coherente, write semantics distinct, NEW canonical home Writer
  // adapter naming POC monthly-close 1ra evidencia formal. Marco lock #6 opción
  // (c) Riesgo C lock cascade rationale JSDoc cementación: "STRICT ORDER
  // preserved at service-level" + ref design.md §Lock order.

  it("Test 4: modules/monthly-close/infrastructure/prisma-period-locking-writer.adapter.ts file exists (POSITIVE tx-bound at construction + 5 `updateMany {POSTED → LOCKED}` cross-entity mirror legacy `monthly-close.repository.ts:135-216` shape EXACT 5 methods `Promise<number>` lock count primitive — §17 carve-out cite OBLIGATORIA cross-module Prisma access 5 entity tables dispatch/payment/journalEntry/sale/purchase Lock #1 + Lock #3 opción (a) prisma-*-writer.adapter.ts paired sister Reader pattern NEW canonical home 1ra evidencia POC monthly-close + Lock #6 opción (c) Riesgo C JSDoc rationale lock cascade STRICT ORDER preserved at service-level + ref design.md §Lock order FK direction Sale↔JE archive cementado)", () => {
    expect(exists("modules/monthly-close/infrastructure/prisma-period-locking-writer.adapter.ts")).toBe(true);
  });

  // ── E: infrastructure/ UoW assemble adapters tx-bound + timeout (Test 5) ──
  // Marco lock #1 location monthly-close/infrastructure/ + §17 carve-out cite
  // OBLIGATORIA top-level adapter assembly context. Marco lock #5 timeout
  // 30_000 wiring `withAuditTx(repo, ctx, fn, {timeout: 30_000})` 4to arg
  // legacy parity preservation 1ra evidencia POC monthly-close (sale + accounting
  // + iva-books NO usan options 4to arg default no-timeout). Marco lock #6 opción
  // (c) Riesgo C citation ref design.md §Lock order top-level UoW JSDoc.
  // UoW naming `prisma-<module>-unit-of-work.ts` 3 evidencias cumulative
  // (sale + accounting + iva-books) — supersede absoluto.

  it("Test 5: modules/monthly-close/infrastructure/prisma-monthly-close-unit-of-work.ts file exists (POSITIVE assembles 4 adapters tx-bound dentro `withAuditTx` callback + `BaseScope.fiscalPeriods` consumido via `PrismaFiscalPeriodsTxRepo` shared cumulative POC #9 + `correlationId` PRE-TX + `withAuditTx(repo, ctx, fn, {timeout: 30_000})` 4to arg signature `audit-tx.ts:32` legacy parity preservation Lock #5 1ra evidencia POC monthly-close — UoW naming `prisma-<module>-unit-of-work.ts` 3 evidencias cumulative supersede absoluto sale + accounting + iva-books + UoW location infrastructure/ 4 evidencias supersede absoluto + JSDoc UoW first sentence \"Postgres-backed adapter for `MonthlyCloseUnitOfWork`\" + Mirror sale precedent + Delegates fully a `withAuditTx` 4 invariantes (correlationId pre-tx + SET LOCAL inside + fn invoke + return shape) JSDoc structure 3 evidencias supersede + §17 carve-out cite OBLIGATORIA top-level adapter assembly context Lock #1 + Lock #6 opción (c) Riesgo C citation ref design.md §Lock order)", () => {
    expect(exists("modules/monthly-close/infrastructure/prisma-monthly-close-unit-of-work.ts")).toBe(true);
  });
});
