/**
 * POC nuevo monthly-close C2.2 RED-α — application layer service class
 * orquestador puro `MonthlyCloseService` consume 4 ports cementados C1+C2.1
 * + UoW callback `closeMonth` use case tx-aware mirror sale/payment/purchase
 * cumulative-precedent EXACT (13 evidencias service class file naming +
 * class export + 4 evidencias deps interface + 4 evidencias inline DTO/Result
 * + 4 evidencias decomposed args + 4 evidencias spread correlationId UoW.run).
 * 1α POS existence skeleton mirror C0 + C1-α + C2.1-α precedent EXACT.
 *
 * **Marco locks pre-RED 4 ejes confirmados**:
 *
 *   1. **RED granularity α1 existence-only 1α** (mirror C0+C1+C2.1 cumulative
 *      pattern EXACT): 1α POS file existence
 *      `modules/monthly-close/application/monthly-close.service.ts`. Behavioral
 *      coverage defer C5 integration tests UoW-level. Cumulative-precedent 4
 *      evidencias matures supersede behavioral RED upfront. red-regex-discipline
 *      + C1 lección "NO RED-time content assertions" heredado.
 *
 *   2. **DTOs inline service file** (cumulative ≥4 evidencias supersede
 *      absoluto): `CloseResult` interface inline mirror sale `PostSaleResult`
 *      + `CreateDraftResult` + `UpdateSaleInput` + `EditPreview` precedent
 *      EXACT. NO split presentation/dto/. NO separate `monthly-close.types.ts`
 *      legacy precedent (1 evidencia vs 4+ inline supersede).
 *
 *   3. **Drafts check via DraftDocumentsReaderPort PRE-TX inline** (β PRESERVED
 *      C2.1): `countDraftsByPeriod()` returns 5-count `MonthlyCloseDraftCounts`
 *      shape. Service-level evalúa total + throw `DraftEntriesPresentError`
 *      con 5 readonly fields (15ª evidencia single bundle ADD C2.1 GREEN).
 *      NO helper `validateCanClose()` YAGNI — 1 callsite C2.2 close() único.
 *      Helper defer C2.5 si getSummary aterriza (axis-distinct).
 *
 *   4. **Pre-TX `period.status !== "OPEN"` string compare service-level**
 *      (Marco lock confirmado Path (i) — wording loose `period.isOpen() guard`
 *      implícito string compare). C1 cementación textual JSDoc explicit
 *      `fiscal-period-reader.port.ts:20` "Consumer-side check `status ===
 *      \"OPEN\"` (NO isOpen port method)" + cumulative-precedent 4 evidencias
 *      supersede absoluto (sale `sale.service.ts:219` + purchase + payment
 *      assertPeriodOpen primitive consume + accounting). Snapshot LOCAL
 *      primitive-typed `MonthlyCloseFiscalPeriod {id, status: "OPEN"|"CLOSED"}`
 *      cementado C1 SIN modify. Throw `PeriodAlreadyClosedError` (typed C1).
 *      NO duplicate INSIDE-TX (TOCTOU Riesgo A heredado defer scope POC).
 *
 * **evidence-supersedes-assumption-lock 3ra evidencia matures cumulative
 * cross-POC** (C2.2 wording loose "period.isOpen()" path supersede por C1
 * cementación textual + 4 cumulative paths primitive supersede absoluto —
 * 1ra C1 4 supersede paths post-recon + 2da C2.1 4 supersede paths α/δ/ε/ζ
 * UoW POC #9 + 3ra C2.2 1 supersede path wording-implícito).
 *
 * **textual-rule-verification recursive structural conventions 2da evidencia
 * matures cumulative** (C1 1ra evidencia recursive métricas Step 0 + C2.2
 * 2da evidencia recursive C1 cementación textual JSDoc supersede Marco lock
 * loose wording — pattern emerge canónico cumulative cross-cycle). Pre-RED
 * redact gate textual rule verification recursive: cementación textual de
 * ciclo previo (C1 JSDoc explicit) supersede wording posterior implícito.
 *
 * **Cumulative-precedent verification ≥3 evidencias EXACT pre-RED redact gate
 * structural conventions service class** (heredado lección C1 + C2.1 matures
 * 2da evidencia recursive):
 *   - Service file `<module>.service.ts` location application/: **13
 *     evidencias** cumulative cross-module (sale + payment + purchase +
 *     contacts + iva-book + payables + receivables + mortality + voucher-types
 *     + org-settings + fiscal-periods + journals + contact-balances) —
 *     supersede absoluto.
 *   - Class `<Module>Service` exported: **13 evidencias** mismas — supersede
 *     absoluto.
 *   - `interface <Module>ServiceDeps` + `private readonly deps`: **4
 *     evidencias** (Sale + Payments + Purchase + IvaBook) — supersede ≥3 ✓.
 *   - Inline DTO/Result types EN service file: **≥4 evidencias** (sale
 *     `PostSaleResult` + `CreateDraftResult` + `UpdateSaleInput` + `EditPreview`
 *     + payment `CreatePaymentServiceInput` + `UpdatePaymentServiceInput` +
 *     `LockedEditContext`) — supersede ≥3 ✓.
 *   - Decomposed args método write `(orgId, id, userId, ...)`: **≥4
 *     evidencias** (sale post/update/void/createAndPost + payment
 *     post/update/void/createAndPost) — supersede ≥3 ✓.
 *   - Spread `correlationId` from UoW.run/withAuditTx return `{ result,
 *     correlationId }`: **≥4 evidencias** (sale 5 use cases UoW + payment 5
 *     use cases withAuditTx) — supersede ≥3 ✓.
 *   - Money.equals() bit-perfect balance gate (Money VO existing
 *     `modules/shared/domain/value-objects/money.ts:34` `equals(other: Money):
 *     boolean { return this.raw.equals(other.raw) }`): **1ra evidencia POC
 *     monthly-close** paired sister Money VO 4ta cementación cross-POC matures
 *     (sale + payment + payables + monthly-close).
 *
 * **§13 emergentes capturar D1 cumulative** (defer cementación):
 *   - §13 service class structural conventions cumulative 13 evidencias
 *     absoluto matures D1 (file naming + class export + deps interface)
 *   - §13 inline DTO/Result service file pattern ≥4 evidencias supersede
 *     pre-bookmark
 *   - §13 spread correlationId UoW.run pattern ≥4 evidencias supersede
 *     absoluto
 *   - §13 Money.equals() balance gate 1ra evidencia POC monthly-close paired
 *     sister 4ta cementación Money VO cross-POC
 *   - textual-rule-verification recursive structural conventions 2da evidencia
 *     matures (C1 JSDoc cementación supersede C2.2 wording loose)
 *
 * **Service class GREEN target shape recon-driven mirror precedent EXACT**:
 *
 *   ```ts
 *   // modules/monthly-close/application/monthly-close.service.ts
 *   export interface CloseResult {
 *     periodId: string;
 *     periodStatus: "CLOSED";
 *     closedAt: Date;
 *     correlationId: string;
 *     locked: { dispatches; payments; journalEntries; sales; purchases: number };
 *   }
 *
 *   export interface MonthlyCloseServiceDeps {
 *     fiscalPeriods: FiscalPeriodReaderPort;
 *     draftDocuments: DraftDocumentsReaderPort;
 *     uow: MonthlyCloseUnitOfWork;
 *   }
 *
 *   export class MonthlyCloseService {
 *     constructor(private readonly deps: MonthlyCloseServiceDeps) {}
 *
 *     async close(
 *       organizationId: string,
 *       periodId: string,
 *       userId: string,
 *       justification?: string,
 *     ): Promise<CloseResult> {
 *       // PRE-TX
 *       const period = await this.deps.fiscalPeriods.getById(organizationId, periodId);
 *       if (period.status !== "OPEN") throw new PeriodAlreadyClosedError();
 *
 *       const drafts = await this.deps.draftDocuments.countDraftsByPeriod(
 *         organizationId, periodId,
 *       );
 *       const total = drafts.dispatches + drafts.payments + drafts.journalEntries
 *                   + drafts.sales + drafts.purchases;
 *       if (total > 0) {
 *         throw new DraftEntriesPresentError(
 *           drafts.dispatches, drafts.payments, drafts.journalEntries,
 *           drafts.sales, drafts.purchases,
 *         );
 *       }
 *
 *       // INSIDE-TX
 *       const { result, correlationId } = await this.deps.uow.run(
 *         { userId, organizationId, justification },
 *         async (scope) => {
 *           const balance = await scope.accounting.sumDebitCredit(organizationId, periodId);
 *           if (!balance.debit.equals(balance.credit)) {
 *             throw new BalanceNotZeroError(balance.debit, balance.credit);
 *           }
 *           // STRICT ORDER 5 lock cascade
 *           const dispatches     = await scope.locking.lockDispatches(organizationId, periodId);
 *           const payments       = await scope.locking.lockPayments(organizationId, periodId);
 *           const journalEntries = await scope.locking.lockJournalEntries(organizationId, periodId);
 *           const sales          = await scope.locking.lockSales(organizationId, periodId);
 *           const purchases      = await scope.locking.lockPurchases(organizationId, periodId);
 *           // markClosed LAST
 *           const { closedAt } = await scope.fiscalPeriods.markClosed(
 *             organizationId, periodId, userId,
 *           );
 *           return { periodId, periodStatus: "CLOSED" as const, closedAt,
 *             locked: { dispatches, payments, journalEntries, sales, purchases } };
 *         },
 *       );
 *       return { ...result, correlationId };
 *     }
 *   }
 *   ```
 *
 * 1α homogeneous granularity bisect-friendly POS existence (FAIL pre-GREEN —
 * `existsSync === true` reverses cuando file missing, mirror C0 + C1-α +
 * C2.1-α precedent EXACT):
 *   - T1 POS: modules/monthly-close/application/monthly-close.service.ts
 *     file exists (orquestador puro consume 4 ports cementados C1+C2.1 + UoW
 *     callback closeMonth use case tx-aware).
 *
 * Test file location modules/monthly-close/__tests__/ — top-level scope
 * mirror C0 + C1-α + C2.1-α precedent EXACT.
 *
 * Self-contained future-proof (lección A6 #5 + L6 heredado): shape test asserta
 * path bajo `modules/monthly-close/application/` que persiste todo el POC
 * C2.2-C7 (ningún ciclo borra este path — solo expande contenido C5 integration
 * tests behavioral + C7 cutover routes hex). C7 wholesale delete
 * `features/monthly-close/*` NO toca path del C2.2 RED-α.
 *
 * Source-string assertion pattern: mirror C0 + C1-α + C2.1-α precedent EXACT
 * (`existsSync(resolve(ROOT, rel))`) — keep pattern POC nuevo monthly-close
 * cumulative. Target asserción application layer service class skeleton 1
 * file únicamente. Class shape + interface deps + close() flow + DTOs inline
 * se verifican GREEN tsc + suite cross-cycle (NO RED-time content assertions
 * — mirror lección red-regex-discipline + C1 lección heredados: NO regex
 * needed C2.2 existence-only, existsSync suficiente, axis-distinct
 * EXISTENCE→CONTENT separation).
 *
 * Expected RED-α failure mode pre-GREEN (per lección
 * red-acceptance-failure-mode heredado):
 *   - T1 FAIL: file NEW NO existe pre-GREEN — `existsSync === true` reverses
 *     (path AUSENTE pre-GREEN, POS existence assertion fails on missing path).
 *     application/ layer dir ya materializó C2.1 (monthly-close-unit-of-work.ts)
 *     — service file segundo en application/ post-C2.1.
 * Total expected pre-GREEN: 1 FAIL / 0 PASS / 0 divergent paths declarados.
 * NO preservation guards (innecesarios skeleton create-only — POS existence
 * cutover puro mirror C0 3/3 FAIL + C1-α 3/3 FAIL + C2.1-α 3/3 FAIL precedent
 * EXACT).
 *
 * Cross-ref:
 *   - features/monthly-close/monthly-close.service.ts:135-230 (driver-anchored
 *     `close()` flow EXACT — Pre-TX correlationId + period + drafts + canClose
 *     guard → INSIDE-TX setAuditContext + sumDebitCredit + balance gate +
 *     5 lock cascade STRICT ORDER + markPeriodClosed → CloseResult shape).
 *   - features/monthly-close/monthly-close.types.ts:1-20 (driver-anchored
 *     `CloseResult` shape `{periodId, periodStatus: "CLOSED", closedAt,
 *     correlationId, locked: {5 counts}}` — GREEN target inline service file).
 *   - modules/sale/application/sale.service.ts (precedent EXACT 13 evidencias
 *     `class SaleService` + 5 use cases inline DTO/Result + decomposed args +
 *     spread correlationId UoW.run + private readonly deps + period.status
 *     string compare line 219).
 *   - modules/payment/application/payments.service.ts (precedent EXACT 4 use
 *     cases withAuditTx + spread correlationId + LockedEditContext inline +
 *     assertPeriodOpen primitive consume).
 *   - modules/purchase/application/purchase.service.ts (precedent
 *     PurchaseServiceDeps interface + private readonly deps + decomposed args
 *     cumulative 4ta evidencia).
 *   - modules/iva-books/application/iva-book.service.ts (precedent
 *     IvaBookServiceDeps interface 4ta evidencia paired sister).
 *   - modules/monthly-close/application/monthly-close-unit-of-work.ts (C2.1
 *     cementado MonthlyCloseScope + UnitOfWork generic alias — service consume
 *     scope.accounting + scope.locking + scope.fiscalPeriods.markClosed +
 *     scope.correlationId via BaseScope).
 *   - modules/monthly-close/domain/ports/{fiscal-period-reader,draft-documents-
 *     reader,accounting-reader,period-locking-writer}.port.ts (C1+C2.1
 *     cementados — service consume 2 PRE-TX ReaderPorts outside scope +
 *     2 INSIDE-TX scope-bound vía MonthlyCloseScope membership).
 *   - modules/monthly-close/domain/errors/monthly-close-errors.ts (C1+C2.1
 *     cementados 3 typed Error classes PeriodAlreadyClosed + BalanceNotZero +
 *     DraftEntriesPresent — service throws cumulative single bundle 15ª
 *     evidencia ADD C2.1 GREEN).
 *   - modules/shared/domain/ports/unit-of-work.ts (UoW POC #9 shared shape
 *     `UnitOfWork<TScope>.run(ctx, fn): Promise<{result, correlationId}>`
 *     supersede absoluto cumulative-precedent C2.2 spread pattern).
 *   - modules/shared/domain/ports/fiscal-periods-tx.repo.ts
 *     (`markClosed(orgId, periodId, userId): Promise<{closedAt, closedBy}>`
 *     shared cumulative POC #9 — service GREEN destruct `closedAt` único campo
 *     consumido).
 *   - modules/shared/domain/value-objects/money.ts:34 (`equals(other: Money):
 *     boolean { return this.raw.equals(other.raw) }` bit-perfect Decimal —
 *     1ra evidencia consumed POC monthly-close balance gate paired sister
 *     4ta cementación Money VO cross-POC).
 *   - modules/monthly-close/__tests__/c2-1-application-ports-shape.poc-nuevo-monthly-close.test.ts
 *     (mirror precedent EXACT existsSync pattern + JSDoc structure shape +
 *     C1 lección "NO RED-time content assertions" matures cumulative).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C2.2 → C3-C7 CLEAN: path
 *     `modules/monthly-close/application/monthly-close.service.ts` persiste
 *     todo el POC, C5 integration tests behavioral expanden contenido NO
 *     borran, C7 wholesale delete legacy `features/monthly-close/*` NO toca
 *     hex).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 1/1 FAIL POS
 *     existence sin divergent paths — clean cutover skeleton create-only
 *     mirror C0 + C1-α + C2.1-α precedent EXACT).
 *   - engram `feedback/red-regex-discipline` (NO regex needed C2.2
 *     existence-only — solo existsSync, mirror C2.1-α precedent + 1α minimal
 *     pre-RED redact gate cumulative C1 lección recursive).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED-α commit body — RED granularity α1
 *     existence-only locks confirmados cumulative-precedent ≥4 evidencias
 *     supersede absoluto + evidence-supersedes-assumption-lock 3ra evidencia
 *     matures + textual-rule-verification recursive 2da evidencia matures).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (C1 1ra + C2.1
 *     2da + C2.2 3ra evidencia matures cumulative cross-POC — wording loose
 *     `period.isOpen()` superseded por C1 cementación textual JSDoc explicit
 *     consumer-side string check primitive Snapshot supersede absoluto).
 *   - engram `feedback/textual-rule-verification` recursive structural
 *     conventions 2da evidencia matures (C1 1ra recursive métricas + C2.2
 *     2da recursive C1 cementación textual JSDoc supersede wording loose
 *     posterior).
 *   - engram `poc-nuevo/monthly-close/c2.1-closed` (precedent C2.1 cycle
 *     bookmark post-GREEN clean cutover sin drift — 4 métricas baseline EXACT
 *     preserved cumulative).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

describe("POC nuevo monthly-close C2.2 RED-α — application layer service class orquestador puro MonthlyCloseService consume 4 ports cementados C1+C2.1 + UoW callback close() use case tx-aware mirror sale/payment/purchase cumulative-precedent EXACT (13 evidencias service class file naming + class export + 4 evidencias deps interface + 4 evidencias inline DTO/Result + 4 evidencias decomposed args + 4 evidencias spread correlationId UoW.run + Money.equals() 1ra POC monthly-close) Opción α1 minimal 1α POS existence clean cutover sin divergent paths sin preservation guards skeleton create-only mirror C0 + C1-α + C2.1-α precedent EXACT cumulative-precedent recursive evidence-supersedes-assumption-lock 3ra evidencia + textual-rule-verification recursive structural conventions 2da evidencia matures", () => {
  // ── A: application/ service class orquestador puro (Test 1) ──
  // Marco lock Opción α1 existence-only 1α driver-anchored — service class
  // consume 2 PRE-TX ReaderPorts outside scope (FiscalPeriodReaderPort +
  // DraftDocumentsReaderPort) + UoW.run callback INSIDE-TX consume
  // MonthlyCloseScope membership (accounting tx-bound + locking tx-bound +
  // BaseScope.fiscalPeriods.markClosed shared) + spread correlationId from
  // UoW.run return cumulative-precedent EXACT pattern.

  it("Test 1: modules/monthly-close/application/monthly-close.service.ts file exists (POSITIVE class MonthlyCloseService orquestador puro consume 4 ports cementados C1+C2.1 + UoW callback close() use case tx-aware mirror sale/payment/purchase cumulative-precedent EXACT — interface MonthlyCloseServiceDeps + private readonly deps + decomposed args close(orgId, periodId, userId, justification?) + spread correlationId UoW.run + inline CloseResult DTO + period.status string compare service-level + Money.equals() balance gate INSIDE-TX + 5 lock cascade STRICT ORDER + markPeriodClosed LAST cumulative 13 evidencias service class + 4 evidencias deps + 4 evidencias inline DTO + 4 evidencias decomposed args + 4 evidencias spread correlationId supersede absoluto)", () => {
    expect(exists("modules/monthly-close/application/monthly-close.service.ts")).toBe(true);
  });
});
