/**
 * POC nuevo monthly-close C2.1 RED-α — application layer ports outbound +
 * UoW shape minimal driver-anchored cumulative-precedent EXACT (sale +
 * accounting + purchase + iva-books UoW POC #9 shared shape generic
 * `UnitOfWork<TScope extends BaseScope>` + 4 evidencias `XScope extends
 * BaseScope` + 4 evidencias `= UnitOfWork<XScope>` type alias). C2.1 scope
 * 3 archivos NEW: 2 ports outbound (DraftDocumentsReaderPort outside-scope
 * read-only + PeriodLockingWriterPort tx-bound inside-scope) + 1 UoW shape
 * file (`monthly-close-unit-of-work.ts` mirror sale-uow precedent EXACT
 * application/ location 3:1 majority cumulative).
 *
 * **Sub-cycle adjustment pre-RED redact 4α → 3α IN-PLACE** (mirror precedent
 * fiscal-periods C1-α + monthly-close C1-α pattern matures cumulative — 3ra
 * evidencia matures): Marco lock pre-RED 4α explicit (T4 DraftEntriesPresentError
 * content-grep) ajustado IN-PLACE a 3α POS existence puro pre-RED redact gate.
 * Cumulative-precedent C1 lección "NO RED-time content assertions"
 * (`c1-domain-shape.poc-nuevo-monthly-close.test.ts:113-116`) + red-regex-discipline
 * heredado: T4 content-grep substring sin precedent ≥3 evidencias cross-module
 * → NEW pattern injustificado POC monthly-close C2.1. DraftEntriesPresentError
 * shape (export + extends ValidationError + readonly fields) verified GREEN tsc
 * compile + suite cross-cycle (axis-distinct EXISTENCE→CONTENT separation
 * mirror C1 lección EXACT).
 *
 * **Failure attribution: agente self-surface** — pre-RED redact gate cumulative
 * C1 lección recursive structural conventions: T4 axis EXISTENCE/CONTENT
 * conflict surfaced honest pre-RED redact (NO commit churn, IN-PLACE 3α
 * adjustment). Lección matures cumulative D1 captura:
 *   - `pre-RED redact gate sub-cycle adjustment IN-PLACE pattern` 3ra evidencia
 *     matures (fiscal-periods C1-α 1ra + monthly-close C1-α 2da + C2.1 RED-α
 *     3ra) — pattern emerge canónico POC sub-cycle adjustment cumulative
 *     cross-POC.
 *   - `red-regex-discipline` + C1 lección "NO RED-time content assertions"
 *     matures cumulative cross-cycle (C1 + C2.1 evidencias paired sister).
 *
 * **Marco re-locks pre-RED post evidence-supersedes-assumption-lock 2da
 * evidencia matures cumulative cross-POC (4 supersede paths α/δ/ε/ζ single
 * recon UoW POC #9 + sale + accounting + purchase shared root cause)**:
 *
 *   1. **Lock α SUPERSEDED** (tx-paired methods AccountingReaderPort C1):
 *      cumulative-precedent R5 NO Prisma leak port — tx context EXCLUSIVE via
 *      scope-membership. AccountingReaderPort C1 signature UNCHANGED.
 *      AccountingReaderPort entra `MonthlyCloseScope` tx-bound vía adapter C3
 *      (mirror sale `journalEntries: JournalEntriesRepository` consumido
 *      tx-bound dentro scope). NoTx variant defer (getSummary out of C2 scope
 *      axis distinto).
 *
 *   2. **Lock β PRESERVED** (DraftDocumentsReaderPort 1 port driver-anchored):
 *      driver real `features/monthly-close/monthly-close.repository.ts:57-89`
 *      `countDraftDocuments(orgId, periodId)` único método retorna 5-count
 *      shape `{dispatches, payments, journalEntries, sales, purchases:
 *      number}`. Mirror sale `IvaBookReaderPort` outside-scope read-only
 *      (NO tx-bound). Snapshot LOCAL inline `MonthlyCloseDraftCounts`
 *      primitive-typed mirror iva-books `IvaFiscalPeriod` precedent + C1
 *      `MonthlyCloseFiscalPeriod` precedent EXACT cumulative.
 *
 *   3. **Lock γ PRESERVED ajustado** (PeriodLockingWriterPort 1 port owned
 *      monthly-close 5 methods): driver real
 *      `features/monthly-close/monthly-close.repository.ts:135-216` 5
 *      separate methods `lockDispatches/lockPayments/lockJournalEntries/
 *      lockSales/lockPurchases` mismo class boundary. 1 port consumer-driven
 *      hex monthly-close OWNS (NO 5 ports cross-module split anticipatorio
 *      YAGNI). Enter `MonthlyCloseScope` tx-bound — methods NO tx parameter
 *      en signature (R5, scope-membership cumulative cross-module pattern).
 *
 *   4. **Lock δ SUPERSEDED** (FiscalPeriodWriter monthly-close OWNS): YA
 *      existe `FiscalPeriodsTxRepo.markClosed` shared
 *      `@/modules/shared/domain/ports/fiscal-periods-tx.repo.ts` cumulative
 *      POC #9 — JSDoc literalmente menciona *"When the future monthly-close
 *      POC migrates to hexagonal, this port is the destination"*. CONSUME
 *      existing via `BaseScope.fiscalPeriods` (NO new monthly-close-owned
 *      FiscalPeriodWriterPort).
 *
 *   5. **Lock ε SUPERSEDED** (AuditContext UoW callback parameter):
 *      cumulative-precedent `UoW.run(ctx: AuditContext, fn: (scope) =>
 *      Promise<T>)` shape — `ctx` es PARAMETER de `run`, NO callback ctx.
 *      Adapter C3 llama `setAuditContext` auto INSIDE-tx (5 evidencias UoW
 *      POC #9 + sale + accounting + purchase + iva-books).
 *
 *   6. **Lock ζ SUPERSEDED** (UoW rich callback context + timeout port):
 *      `UnitOfWork<MonthlyCloseScope>` generic extends `BaseScope` cumulative
 *      4 evidencias type alias pattern + 4 evidencias `XScope extends
 *      BaseScope` cumulative cross-module precedent EXACT. Callback recibe
 *      `scope` (mirror sale + accounting + purchase + iva-books). Timeout
 *      30s NO en port (C3 adapter handles).
 *
 *   7. **Lock η PRESERVED** (single bundle 15ª evidencia
 *      DraftEntriesPresentError ADD `monthly-close-errors.ts` existing C1
 *      GREEN file — verified GREEN tsc compile + suite cross-cycle
 *      axis-distinct EXISTENCE→CONTENT mirror C1 lección EXACT).
 *
 * **Cumulative-precedent verification ≥3 evidencias EXACT pre-RED redact gate
 * recursive structural conventions** (heredado lección C1):
 *   - `<X>Scope extends BaseScope`: 5 evidencias cumulative (SaleScope +
 *     AccountingScope + PurchaseScope + IvaBookScope + monthly-close NEW C2.1
 *     6ta) — supersede absoluto.
 *   - `= UnitOfWork<XScope>` type alias: 4 evidencias cumulative
 *     (SaleUnitOfWork + AccountingUnitOfWork + PurchaseUnitOfWork +
 *     IvaBookUnitOfWork + monthly-close NEW C2.1 5ta) — supersede absoluto.
 *   - UoW location `application/<module>-unit-of-work.ts`: 3:1 majority
 *     cumulative (sale + purchase + iva-books application/ vs accounting
 *     domain/ports/) — monthly-close mirror majority application/ location
 *     ✓ aligned con Marco lock C2 explicit "UoW boundary application-level
 *     (NO infrastructure C3)".
 *   - Port file naming `<concept>-<role>.port.ts`: 14+ evidencias cumulative
 *     cross-module (mirror C1 cementación EXACT) — DraftDocumentsReaderPort
 *     + PeriodLockingWriterPort suffix `*ReaderPort`/`*WriterPort` cumulative
 *     5 evidencias supersede pre-bookmark.
 *   - Snapshot LOCAL inline naming `<ModuleConsumer><Concept>` cumulative 7+
 *     evidencias cross-module (MonthlyCloseFiscalPeriod C1 + MonthlyClose
 *     PeriodBalance C1 + MonthlyCloseDraftCounts C2.1 NEW).
 *
 * **Snapshot LOCAL types GREEN target shape recon-driven mirror precedent
 * EXACT**:
 *   - DraftDocumentsReaderPort: Snapshot LOCAL `MonthlyCloseDraftCounts
 *     {dispatches, payments, journalEntries, sales, purchases: number}`
 *     primitive-typed mirror `MonthlyCloseFiscalPeriod` precedent EXACT C1
 *     (§13 Reader port Snapshot LOCAL inline 9na evidencia D1 cumulative
 *     cross-module).
 *   - PeriodLockingWriterPort: NO Snapshot LOCAL (5 methods retornan
 *     `Promise<number>` lock count primitive — driver real shape EXACT).
 *     §13 NEW sub-evidencia variant Writer port primitive-return cross-entity
 *     scope-membership 1ra evidencia POC monthly-close D1 cementación.
 *   - MonthlyCloseScope: cross-module hex tx-bound scope-membership pattern
 *     cumulative 4ta evidencia matures (sale `journalEntries` + accounting
 *     `accountBalances` + purchase + iva-books + monthly-close NEW
 *     `accounting: AccountingReaderPort` + `locking: PeriodLockingWriterPort`).
 *     `fiscalPeriods.markClosed` consumido via BaseScope cumulative shared.
 *
 * 3α homogeneous granularity bisect-friendly POS existence (todas FAIL
 * pre-GREEN — `existsSync === true` reverses cuando file missing, mirror C0
 * + C1-α precedent EXACT pattern):
 *   - T1 POS: modules/monthly-close/domain/ports/draft-documents-reader.port.ts
 *     file exists (driver-anchored cross-entity counts pre-TX read-only
 *     `validateCanClose` features/monthly-close.service.ts:42-69)
 *   - T2 POS: modules/monthly-close/domain/ports/period-locking-writer.port.ts
 *     file exists (driver-anchored 5 lock methods INSIDE-TX
 *     features/monthly-close.repository.ts:135-216)
 *   - T3 POS: modules/monthly-close/application/monthly-close-unit-of-work.ts
 *     file exists (mirror sale/purchase/iva-books application/ location
 *     cumulative 3:1 majority + UoW POC #9 shared shape generic
 *     `UnitOfWork<MonthlyCloseScope>` cumulative 4 evidencias type alias
 *     supersede)
 *
 * Test file location modules/monthly-close/__tests__/ — top-level scope
 * mirror C0 + C1-α precedent EXACT. Application layer materialization C2.1
 * con primer file real `application/monthly-close-unit-of-work.ts` (NO
 * `.gitkeep`, NO empty barrels speculativos — layer dir materializa primer
 * file real C2.1+).
 *
 * Self-contained future-proof (lección A6 #5 + Marco lock L6 heredado):
 * shape test asserta paths bajo `modules/monthly-close/{domain,application}/`
 * que persisten todo el POC C2.2-C7 (ningún ciclo borra estos paths — solo
 * expanden contenido + service class C2.2 + infrastructure adapters C3
 * implementan). C7 wholesale delete `features/monthly-close/*` NO toca paths
 * del C2.1 RED-α. CLEAN forward verified pre-RED-α via
 * cross-cycle-red-test-cementacion-gate Step 0.5.
 *
 * Source-string assertion pattern: mirror C0 + C1-α precedent EXACT
 * (`existsSync(resolve(ROOT, rel))`) — keep pattern POC nuevo monthly-close
 * cumulative. Target asserciones application layer skeleton 2 ports + 1 UoW
 * shape file únicamente. Method signatures + interface shape + Snapshot LOCAL
 * types + UoW generic alias se verifican GREEN tsc + suite cross-cycle (NO
 * RED-time content assertions — mirror lección red-regex-discipline + C1
 * lección heredados: NO regex needed C2.1 existence-only, existsSync
 * suficiente, axis-distinct EXISTENCE→CONTENT).
 *
 * Expected RED-α failure mode pre-GREEN (per lección
 * red-acceptance-failure-mode heredado):
 *   - T1-T3 FAIL: 3 files NEW (2 ports outbound + 1 UoW shape) NO existen
 *     pre-GREEN — `existsSync === true` reverses (path AUSENTE pre-GREEN, POS
 *     existence assertion fails on missing path). Layer dir
 *     `modules/monthly-close/application/` también materializa primera vez
 *     con primer file real C2.1 GREEN (NO pre-existe vacío, mirror
 *     fiscal-periods + sale precedent application/ first-file pattern EXACT).
 * Total expected pre-GREEN: 3 FAIL / 0 PASS / 0 divergent paths declarados.
 * NO preservation guards (innecesarios skeleton create-only — todos POS
 * existence cutover puro mirror C0 3/3 FAIL + C1-α 3/3 FAIL precedent EXACT).
 *
 * Cross-ref:
 *   - architecture.md §13 Reader port domain-internal Snapshot LOCAL
 *     definition (1ra evidencia formal POC payment C4-α — engram #1655). C1
 *     monthly-close 8va + C2.1 9na evidencia D1 cementación cumulative
 *     cross-module (DraftDocumentsReaderPort Snapshot LOCAL primitive-typed
 *     mirror `MonthlyCloseFiscalPeriod` precedent EXACT C1).
 *   - architecture.md §13 cross-module hex tx-bound scope-membership pattern
 *     4ta evidencia matures (sale `journalEntries` + accounting
 *     `accountBalances` + purchase + iva-books + monthly-close NEW
 *     `accounting` + `locking` C2.1).
 *   - architecture.md §13 NEW sub-evidencia variant Writer port
 *     primitive-return cross-entity 1ra evidencia POC monthly-close
 *     (PeriodLockingWriterPort 5 methods `Promise<number>` lock count
 *     primitive paired sister §13 #1655 + C1 VO-typed variant).
 *   - architecture.md §17 carve-out cross-module UoW (deferred C3 wiring —
 *     C2.1 application-level only, infrastructure C3 wires Prisma adapter +
 *     scope tx-bound fields).
 *   - openspec/changes/archive/2026-04-21-cierre-periodo/design.md (logic
 *     frozen pre-hex archive — flow steps interpretados como UoW scope
 *     membership por Marco lock pre-recon; recon-driven correction:
 *     evidence-supersedes-assumption-lock 2da evidencia matures 4 paths
 *     α/δ/ε/ζ SUPERSEDED por cumulative-precedent UoW POC #9 shared root
 *     cause).
 *   - features/monthly-close/monthly-close.service.ts:42-69 (driver-anchored
 *     `validateCanClose` consume `countDraftDocuments` cross-entity 5-count
 *     shape pre-TX read-only — DraftDocumentsReaderPort GREEN target).
 *   - features/monthly-close/monthly-close.service.ts:179-229 (driver-anchored
 *     `prisma.$transaction(cb, {timeout: 30_000})` INSIDE-TX
 *     `setAuditContext → sumDebitCredit → eq() → lock cascade STRICT ORDER →
 *     markPeriodClosed` flow — MonthlyCloseScope GREEN target shape +
 *     PeriodLockingWriterPort 5 methods + AccountingReaderPort tx-bound +
 *     BaseScope.fiscalPeriods consumido cumulative shared).
 *   - features/monthly-close/monthly-close.repository.ts:57-89
 *     (`countDraftDocuments` 5 entities `Promise.all` shape EXACT —
 *     DraftDocumentsReaderPort GREEN target Snapshot LOCAL).
 *   - features/monthly-close/monthly-close.repository.ts:135-216 (5 separate
 *     `lockDispatches/lockPayments/lockJournalEntries/lockSales/lockPurchases`
 *     methods `Promise<number>` driver shape EXACT — PeriodLockingWriterPort
 *     GREEN target).
 *   - modules/shared/domain/ports/unit-of-work.ts (cumulative POC #9 shared
 *     shape generic `UnitOfWork<TScope extends BaseScope>` + `BaseScope
 *     {correlationId, fiscalPeriods: FiscalPeriodsTxRepo.markClosed}` +
 *     `AuditContext {userId, organizationId, justification?}` — supersede
 *     absoluto monthly-close C2.1 cumulative-precedent root cause 4 lock
 *     paths α/δ/ε/ζ).
 *   - modules/shared/domain/ports/fiscal-periods-tx.repo.ts (`markClosed`
 *     shared cumulative POC #9 — JSDoc literalmente menciona future
 *     monthly-close target, CONSUME existing NO new port — Lock δ
 *     SUPERSEDED).
 *   - modules/sale/application/sale-unit-of-work.ts (precedent EXACT shape:
 *     `SaleScope extends BaseScope` + `SaleUnitOfWork = UnitOfWork<SaleScope>`
 *     + cross-module tx-bound repos owned source module — mirror EXACT C2.1
 *     monthly-close `MonthlyCloseScope` + `MonthlyCloseUnitOfWork` GREEN
 *     target).
 *   - modules/accounting/domain/ports/unit-of-work.ts (precedent shape mirror
 *     `AccountingScope extends BaseScope` + `AccountingUnitOfWork =
 *     UnitOfWork<AccountingScope>`).
 *   - modules/purchase/application/purchase-unit-of-work.ts +
 *     modules/iva-books/application/iva-book-unit-of-work.ts (precedent UoW
 *     application/ location 3:1 majority cumulative cross-module — Marco
 *     lock C2.1 application-level location aligned).
 *   - modules/iva-books/domain/ports/iva-book-reader.port.ts +
 *     modules/sale/domain/ports/iva-book-reader.port.ts (precedent
 *     outside-scope read-only port pattern — DraftDocumentsReaderPort mirror
 *     EXACT outside scope read-only Lock β).
 *   - modules/monthly-close/domain/ports/{fiscal-period-reader,accounting-
 *     reader}.port.ts + modules/monthly-close/domain/errors/monthly-close-
 *     errors.ts (C1 cementados — heredados sin modify C2.1, AccountingReader
 *     C1 signature UNCHANGED Lock α SUPERSEDED, scope-bound via
 *     MonthlyCloseScope membership C2.1).
 *   - modules/monthly-close/__tests__/c1-domain-shape.poc-nuevo-monthly-close.test.ts
 *     (mirror precedent EXACT existsSync pattern + JSDoc structure shape +
 *     C1 lección "NO RED-time content assertions" supersede T4 4α → 3α
 *     pre-RED redact adjustment).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C2.1 → C2.2-C7 CLEAN: paths bajo
 *     `modules/monthly-close/{domain,application}/` persisten todo el POC,
 *     ningún ciclo borra; C2.2 service class consume estos ports + UoW →
 *     axis-distinct EXISTENCE→CONSUMPTION sin shape collision).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 3/3 FAIL
 *     todas POS existence sin divergent paths — clean cutover skeleton
 *     create-only mirror C1-α + C0 precedent EXACT).
 *   - engram `feedback/red-regex-discipline` (NO regex needed C2.1
 *     existence-only — solo existsSync, mirror C1-α precedent + 3α adjustment
 *     pre-RED redact gate cumulative C1 lección recursive).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED-α commit body — sub-cycle adjustment
 *     4α → 3α IN-PLACE pre-RED redact pattern matures cumulative 3ra
 *     evidencia + evidence-supersedes-assumption-lock 2da evidencia 4
 *     supersede paths α/δ/ε/ζ single recon UoW POC #9 root cause).
 *   - engram `feedback/sub-phase-start-coherence-gate` (Step 0 baseline cold
 *     verify pre-RED — métricas 4 runtime ground truth verified textual NO
 *     truncated: suite 5353p/7f/19s/5379/518 + TSC 17 + ESLint 10e/16w full
 *     + REQ-FMB.5 0; 7 fails ledger enumerated lección
 *     enumerated-baseline-failure-ledger compliance).
 *   - engram `feedback/textual-rule-verification` recursive structural
 *     conventions matures cumulative (C1 1ra evidencia + C2.1 2da evidencia
 *     paired sister recursive métricas Step 0).
 *   - engram `feedback/Marco-lock-superseded-by-cumulative-precedent` (C1
 *     2 evidencias + C2.1 4 evidencias supersede paths α/δ/ε/ζ single recon
 *     UoW POC #9 + sale + accounting + purchase + iva-books cumulative
 *     shared root cause).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (C1 1ra evidencia
 *     + C2.1 2da evidencia matures cumulative — driver-anchored
 *     cumulative-precedent supersede assumed shapes pre-bookmark Marco
 *     locks).
 *   - engram `poc-nuevo/monthly-close/c1-closed` (precedent C1 cycle bookmark
 *     post-GREEN clean cutover sin drift — 4 métricas baseline EXACT
 *     preserved cumulative).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

describe("POC nuevo monthly-close C2.1 RED-α — application layer ports outbound + UoW shape minimal driver-anchored cumulative-precedent EXACT (sale + accounting + purchase + iva-books UoW POC #9 shared shape generic UnitOfWork<TScope extends BaseScope> 4 evidencias type alias supersede + 5 evidencias XScope extends BaseScope cumulative cross-module) Opción α minimal 3α POS existence clean cutover sin divergent paths sin preservation guards skeleton create-only sub-cycle adjustment 4α → 3α IN-PLACE pre-RED redact gate mirror C1 lección NO RED-time content assertions cumulative-precedent recursive", () => {
  // ── A: domain/ports/ outbound reader + writer ports cross-entity (Tests 1-2) ──
  // Marco lock Opción α minimal driver-anchored — 2 ports outbound real flow
  // consumers verified recon Step 0 (DraftDocumentsReaderPort
  // features/monthly-close.service.ts:42-69 `validateCanClose` pre-TX
  // read-only outside-scope + PeriodLockingWriterPort
  // features/monthly-close.repository.ts:135-216 5 lock methods INSIDE-TX
  // tx-bound inside-scope MonthlyCloseScope membership pattern cumulative
  // cross-module 4ta evidencia matures).

  it("Test 1: modules/monthly-close/domain/ports/draft-documents-reader.port.ts file exists (POSITIVE DraftDocumentsReaderPort outbound cross-entity 5-count shape pre-TX read-only outside scope mirror sale IvaBookReaderPort precedent EXACT — Snapshot LOCAL inline `MonthlyCloseDraftCounts {dispatches, payments, journalEntries, sales, purchases: number}` primitive-typed mirror MonthlyCloseFiscalPeriod precedent C1 EXACT §13 9na evidencia D1 + naming `*ReaderPort` suffix cumulative 5 evidencias precedent supersede pre-bookmark lock)", () => {
    expect(exists("modules/monthly-close/domain/ports/draft-documents-reader.port.ts")).toBe(true);
  });

  it("Test 2: modules/monthly-close/domain/ports/period-locking-writer.port.ts file exists (POSITIVE PeriodLockingWriterPort 1 port owned monthly-close consumer-driven hex 5 methods lockDispatches/lockPayments/lockJournalEntries/lockSales/lockPurchases (orgId, periodId): Promise<number> lock count primitive driver shape EXACT — tx-bound inside scope MonthlyCloseScope membership NO tx parameter en signature R5 + naming `*WriterPort` suffix cumulative + §13 NEW sub-evidencia variant Writer port primitive-return cross-entity 1ra evidencia POC monthly-close)", () => {
    expect(exists("modules/monthly-close/domain/ports/period-locking-writer.port.ts")).toBe(true);
  });

  // ── B: application/ UoW shape file (Test 3) ──
  // Marco lock UoW boundary application-level (NO infrastructure C3) +
  // cumulative-precedent UoW POC #9 shared shape `UnitOfWork<TScope extends
  // BaseScope>` generic 4 evidencias supersede absoluto. UoW location
  // application/ 3:1 majority cumulative (sale + purchase + iva-books vs
  // accounting domain/ports/) — monthly-close mirror majority application/.
  // MonthlyCloseScope extends BaseScope lists tx-bound `accounting:
  // AccountingReaderPort` + `locking: PeriodLockingWriterPort` (cross-module
  // hex tx-bound scope-membership pattern cumulative 4ta evidencia matures);
  // BaseScope.fiscalPeriods.markClosed + correlationId consumido cumulative
  // shared (Lock δ + ε SUPERSEDED).

  it("Test 3: modules/monthly-close/application/monthly-close-unit-of-work.ts file exists (POSITIVE MonthlyCloseScope extends BaseScope + MonthlyCloseUnitOfWork = UnitOfWork<MonthlyCloseScope> type alias mirror sale/purchase/iva-books precedent EXACT cumulative 4 evidencias supersede + UoW location application/ 3:1 majority — cross-module tx-bound scope-membership accounting + locking 4ta evidencia matures + BaseScope.fiscalPeriods.markClosed + AuditContext + correlationId consumido cumulative shared POC #9 root cause supersede 4 paths α/δ/ε/ζ)", () => {
    expect(exists("modules/monthly-close/application/monthly-close-unit-of-work.ts")).toBe(true);
  });
});
