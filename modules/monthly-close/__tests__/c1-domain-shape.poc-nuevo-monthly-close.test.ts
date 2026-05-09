/**
 * POC nuevo monthly-close C1 RED — domain layer entity-less shape minimal
 * driver-anchored ports + errors typed precedent mirror sale/payment/iva-books
 * (entity-rich precedent EXACT cumulative cross-module 7+ reader ports), NO
 * mirror fiscal-periods flat root convention. C1 scope 5 archivos NEW: 2
 * outbound reader ports cross-module (FiscalPeriodReaderPort +
 * AccountingReaderPort) + 1 errors barrel + 2 typed Error classes
 * (PeriodAlreadyClosedError + BalanceNotZeroError).
 *
 * Marco lock C1 final post-recon reverse delegation 5 ambigüedades resolved:
 *   1. Naming axis: opción (b) `*ReaderPort` suffix (mirror iva-books/sale
 *      precedent cumulative 4 evidencias) — supersede Marco lock pre-bookmark
 *      (`FiscalPeriodReader` sin Port). Justificación: cumulative cross-module
 *      precedent strength > individual lock. Capturar D1
 *      Marco-lock-superseded-by-cumulative-precedent NEW canonical home 1ra
 *      evidencia.
 *   2. Method signatures: opción (a) adoptar archive `design.md` flow EXACT
 *      con recon-driven correction:
 *        - FiscalPeriodReaderPort: `getById(orgId, periodId): Promise<Snapshot>`
 *          mirror iva-books FP port precedent EXACT (Snapshot LOCAL `{id,
 *          status: "OPEN" | "CLOSED"}`); consumer-side check `status === "OPEN"`
 *          (NO `isOpen` port method); `validateCanClose` es
 *          monthly-close.service internal NO FP port (recon-driven correction
 *          archive design.md interpretation).
 *        - AccountingReaderPort: `sumDebitCredit` only (balance gate accounting
 *          domain SRP isolated); cross-entity counts (Dispatch/Payment/JE/Sale/
 *          Purchase 5 entities) defer C1.5/C2 axis-distinct.
 *   3. IvaBooksReaderPort: opción (a) DROP scope C1 — recon-evidence-based
 *      sin driver real (`grep IvaBook|iva-book|IVA features/monthly-close → 0
 *      hits`; archive `design.md` menciona `iva_*_books` solo en context schema
 *      CASCADE drop, NO closure flow). Marco lock pre-bookmark "3 ports"
 *      superseded por recon evidence (mismo principio cumulative-precedent
 *      supersede inverso: evidence > assumption). Capturar D1
 *      evidence-supersedes-assumption-lock NEW canonical home 1ra evidencia
 *      paired sister `Marco-lock-superseded-by-cumulative-precedent` C1 lock #1.
 *   4. Errors C1: opción (b) ≥1 typed error class. Locked
 *      `PeriodAlreadyClosedError` + `BalanceNotZeroError` locally definidas
 *      wrap códigos `@/features/shared/errors` (PERIOD_ALREADY_CLOSED +
 *      PERIOD_UNBALANCED constants). Mirror sale/payment domain/errors
 *      precedent typed Error classes barrel.
 *   5. ports/ subdir convention: APROBADO mirror sale/payment/iva-books
 *      precedent EXACT — `domain/ports/*.ts` (NO flat root mirror
 *      fiscal-periods convention).
 *
 * 5α homogeneous granularity bisect-friendly POS existence (todas FAIL
 * pre-GREEN — `existsSync === true` reverses cuando file missing, mirror C0
 * precedent EXACT pattern):
 *   - T1 POS: modules/monthly-close/domain/ports/fiscal-period-reader.port.ts
 *     file exists (driver-anchored cross-module fiscal-periods hex YA consume
 *     `makeFiscalPeriodsService` features/monthly-close.service.ts:11)
 *   - T2 POS: modules/monthly-close/domain/ports/accounting-reader.port.ts
 *     file exists (driver-anchored sumDebitCredit raw SQL JOIN pertenece
 *     accounting domain, currently inline raw SQL repo —
 *     features/monthly-close.repository.ts:108-131)
 *   - T3 POS: modules/monthly-close/domain/errors/index.ts file exists
 *     (barrel typed Error classes domain layer)
 *   - T4 POS: modules/monthly-close/domain/errors/period-already-closed.error.ts
 *     file exists (typed Error class wrap PERIOD_ALREADY_CLOSED código)
 *   - T5 POS: modules/monthly-close/domain/errors/balance-not-zero.error.ts
 *     file exists (typed Error class wrap PERIOD_UNBALANCED código)
 *
 * Test file location modules/monthly-close/__tests__/ — top-level scope mirror
 * C0 precedent EXACT (skeleton-level concern, NO domain-internal). Domain
 * layer materialization C1 con primer file real `domain/ports/*.port.ts` +
 * `domain/errors/*.ts` (NO `.gitkeep`, NO empty barrels speculativos).
 * Self-contained future-proof (lección A6 #5 + Marco lock L6 heredado): shape
 * test asserta paths bajo `modules/monthly-close/domain/` que persisten todo
 * el POC C2-C7 (ningún ciclo borra estos paths — solo expanden contenido +
 * application/infrastructure layers materializan C2/C3). C7 wholesale delete
 * `features/monthly-close/*` NO toca paths del C1 RED. CLEAN forward verified
 * pre-RED via cross-cycle-red-test-cementacion-gate Step 0.5.
 *
 * Source-string assertion pattern: mirror C0 precedent EXACT
 * (`existsSync(resolve(ROOT, rel))`) + fiscal-periods C1-α precedent — keep
 * pattern POC nuevo monthly-close. Target asserciones domain skeleton 2 ports
 * + 1 errors barrel + 2 typed Error class files únicamente. Method signatures
 * + interface shape + Snapshot LOCAL types se verifican GREEN tsc + suite
 * cross-cycle (NO RED-time content assertions — mirror lección
 * `red-regex-discipline` heredado: NO regex needed C1 existence-only,
 * existsSync suficiente).
 *
 * Expected RED failure mode pre-GREEN (per lección
 * red-acceptance-failure-mode heredado):
 *   - T1-T5 FAIL: 5 files (2 ports + 1 errors barrel + 2 typed Error classes)
 *     NO existen pre-GREEN — `existsSync === true` reverses (path AUSENTE
 *     pre-GREEN, POS existence assertion fails on missing path). Layer dir
 *     `modules/monthly-close/domain/` también materializa primera vez con
 *     primer file real C1 GREEN (NO pre-existe vacío, mirror fiscal-periods
 *     precedent EXACT).
 * Total expected pre-GREEN: 5 FAIL / 0 PASS / 0 divergent paths declarados.
 * NO preservation guards (innecesarios skeleton create-only — todos POS
 * existence cutover puro mirror C0 3/3 FAIL precedent + fiscal-periods
 * C1-α 5/5 FAIL precedent EXACT).
 *
 * Cross-ref:
 *   - architecture.md §13 Reader port domain-internal Snapshot LOCAL
 *     definition (1ra evidencia formal POC payment C4-α — engram #1655
 *     `arch/§13/reader-port-snapshot-local`). C1 monthly-close 8va evidencia
 *     cumulative cross-module D1 cementación (FiscalPeriodReaderPort +
 *     AccountingReaderPort define Snapshot LOCAL inline).
 *   - architecture.md §13 fiscal-periods-C cross-module hex (7ma cementada
 *     cumulative). C1 monthly-close 8va evidencia D1 cementación (port
 *     outbound consume fiscal-periods via infra adapter C3 calling
 *     `makeFiscalPeriodsService` factory).
 *   - architecture.md §17 carve-out cross-module UoW (deferred C3 wiring —
 *     C1 domain-layer-only, NO infra adapters yet).
 *   - openspec/changes/archive/2026-04-21-cierre-periodo/design.md (logic
 *     frozen pre-hex archive — flow steps `getById/isOpen/validateCanClose`
 *     interpretados como port method names por Marco lock pre-recon;
 *     recon-driven correction: `isOpen` consumer-side, `validateCanClose`
 *     internal service method).
 *   - features/monthly-close/monthly-close.service.ts:11 (driver-anchored
 *     cross-module hex consume `makeFiscalPeriodsService` único cross-module
 *     real flow closure — recon Step 0.3 verified).
 *   - features/monthly-close/monthly-close.repository.ts:108-131 (sumDebitCredit
 *     raw SQL JOIN journal_lines+journal_entries — driver real
 *     AccountingReaderPort hex shape responsabilidad accounting domain).
 *   - modules/iva-books/domain/ports/fiscal-period-reader.port.ts (precedent
 *     EXACT shape: Snapshot LOCAL `IvaFiscalPeriod {id, status}` + `getById`
 *     único método; consumer-side check `status === "OPEN"`; mirror EXACT
 *     C1 monthly-close FiscalPeriodReaderPort GREEN target).
 *   - modules/sale/domain/ports/* + modules/payment/domain/ports/* (precedent
 *     `*ReaderPort` suffix cumulative 4 evidencias — naming axis (b) lock).
 *   - modules/monthly-close/__tests__/c0-skeleton-shape.poc-nuevo-monthly-close.test.ts
 *     (mirror precedent EXACT existsSync pattern + JSDoc structure shape +
 *     5α POS existence homogeneous granularity).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C1 → C2-C7 CLEAN: paths bajo `modules/monthly-close/domain/`
 *     persisten todo el POC, ningún ciclo borra; C2 application service +
 *     C3 infra adapters consume estos ports → axis-distinct
 *     EXISTENCE→CONSUMPTION/IMPLEMENTATION sin shape collision).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 5/5 FAIL
 *     todas POS existence sin divergent paths — clean cutover skeleton
 *     create-only).
 *   - engram `feedback/red-regex-discipline` (NO regex needed C1 existence-only
 *     — solo existsSync, mirror C0 precedent; aplica C2+ cuando assertions
 *     content + method signatures + import statements).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED commit body — Opción (b) naming axis
 *     supersede + Opción (a) IvaBooks DROP recon-evidence-based + 5α
 *     driver-anchored).
 *   - engram `feedback/sub-phase-start-coherence-gate` (Step 0 baseline cold
 *     verify pre-RED — métricas 4 runtime ground truth verified textual NO
 *     truncated: suite 5350p/7f/19s/5376/517 + TSC 17 + ESLint 10e/16w full
 *     [10e/13w app-only excl. 3w stress k6] + REQ-FMB.5 0; 7 fails ledger
 *     enumerated lección enumerated-baseline-failure-ledger compliance).
 *   - engram `feedback/textual-rule-verification` recursive métricas Step 0
 *     baseline (ESLint app-only output empty `npx eslint app` corregido a
 *     `npm run lint` canonical full project — interpretation drift surface
 *     honest sin reconciliar silent).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (NEW canonical
 *     home 1ra evidencia C1 IvaBooks DROP recon-driven — paired sister
 *     `Marco-lock-superseded-by-cumulative-precedent` C1 lock #1 naming axis).
 *   - engram `poc-nuevo/monthly-close/c0-closed` (precedent C0 cycle bookmark
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

describe("POC nuevo monthly-close C1 RED — domain layer entity-less shape minimal driver-anchored 2 reader ports cross-module + errors barrel + 2 typed Error classes precedent mirror sale/payment/iva-books EXACT (entity-rich convention NO fiscal-periods flat root) Opción α minimal 5α POS existence clean cutover sin divergent paths sin preservation guards skeleton create-only", () => {
  // ── A: domain/ports/ outbound reader ports cross-module (Tests 1-2) ──
  // Marco lock Opción α minimal driver-anchored — 2 ports outbound real flow
  // consumers verified recon Step 0.3 (FiscalPeriodReaderPort hex YA via
  // makeFiscalPeriodsService features/monthly-close.service.ts:11 +
  // AccountingReaderPort sumDebitCredit raw SQL JOIN
  // features/monthly-close.repository.ts:108-131). IvaBooksReaderPort DROP
  // scope C1 recon-evidence-based (sin driver real, evidence > assumption).

  it("Test 1: modules/monthly-close/domain/ports/fiscal-period-reader.port.ts file exists (POSITIVE FiscalPeriodReaderPort outbound cross-module hex consume fiscal-periods via infra adapter C3 — Snapshot LOCAL inline mirror iva-books precedent EXACT §13 8va evidencia D1 + naming `*ReaderPort` suffix cumulative 4 evidencias precedent supersede pre-bookmark lock)", () => {
    expect(exists("modules/monthly-close/domain/ports/fiscal-period-reader.port.ts")).toBe(true);
  });

  it("Test 2: modules/monthly-close/domain/ports/accounting-reader.port.ts file exists (POSITIVE AccountingReaderPort outbound cross-module sumDebitCredit balance gate accounting domain SRP isolated — Snapshot LOCAL `{debit, credit}` mirror iva-books precedent §13 8va evidencia + driver-anchored monthly-close.repository.ts:108-131 raw SQL JOIN responsabilidad accounting hex C3)", () => {
    expect(exists("modules/monthly-close/domain/ports/accounting-reader.port.ts")).toBe(true);
  });

  // ── B: domain/errors/ barrel + 2 typed Error classes (Tests 3-5) ──
  // Marco lock errors C1: ≥1 typed Error class definida — locked 2 wrap
  // códigos @/features/shared/errors (PERIOD_ALREADY_CLOSED + PERIOD_UNBALANCED
  // constants). Mirror sale/payment domain/errors precedent typed Error class
  // barrel pattern.

  it("Test 3: modules/monthly-close/domain/errors/index.ts file exists (POSITIVE errors barrel typed Error classes re-export — mirror sale/payment domain/errors barrel precedent EXACT)", () => {
    expect(exists("modules/monthly-close/domain/errors/index.ts")).toBe(true);
  });

  it("Test 4: modules/monthly-close/domain/errors/period-already-closed.error.ts file exists (POSITIVE PeriodAlreadyClosedError typed Error class wrap PERIOD_ALREADY_CLOSED código @/features/shared/errors — mirror sale/payment typed Error class precedent)", () => {
    expect(exists("modules/monthly-close/domain/errors/period-already-closed.error.ts")).toBe(true);
  });

  it("Test 5: modules/monthly-close/domain/errors/balance-not-zero.error.ts file exists (POSITIVE BalanceNotZeroError typed Error class wrap PERIOD_UNBALANCED código @/features/shared/errors balance gate eq(D,C) failure inside-TX — mirror sale/payment typed Error class precedent)", () => {
    expect(exists("modules/monthly-close/domain/errors/balance-not-zero.error.ts")).toBe(true);
  });
});
