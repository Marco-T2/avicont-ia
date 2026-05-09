/**
 * POC nuevo monthly-close C1 RED-α corrige in-place — domain layer entity-less
 * shape minimal driver-anchored 2 outbound reader ports cross-module + 1 single
 * bundle errors file precedent mirror cumulative cross-module 13 evidencias
 * EXACT (single bundle `<module>-errors.ts` convention NO `index.ts` barrel
 * NO per-class separate files). C1 scope ajustado 3 archivos NEW: 2 reader
 * ports (FiscalPeriodReaderPort + AccountingReaderPort) + 1 single bundle
 * errors file (`monthly-close-errors.ts`) con 2 typed Error classes inline
 * (PeriodAlreadyClosedError + BalanceNotZeroError).
 *
 * **Sub-cycle adjustment pre-GREEN — RED-α corrige in-place** (mirror precedent
 * fiscal-periods C1-α pattern EXACT sub-cycle scope adjustment pre-GREEN sin
 * churn git revert): RED1 commit `758975c` redactado por agente con estructura
 * 5α (3 separate files w/ index.ts barrel). Pre-GREEN cumulative-precedent
 * structural-conventions verification surface 13:0 cumulative cross-module
 * supersede absoluto contra mi RED1 inventado:
 *   - 13 evidencias single bundle file `<module>-errors.ts`: iva-books +
 *     mortality + receivables + shared + payment + accounting + purchase +
 *     fiscal-periods + payables + voucher-types + contacts + org-settings +
 *     sale
 *   - 0 evidencias `index.ts` barrel + per-class separate files
 * 13:0 cumulative-precedent supersede absoluto — opción (2) honor RED1
 * violaría convención sin razón monthly-close-specific. Marco lock RED-α
 * corrige in-place cleanest path mirror fiscal-periods C1-α sub-cycle pattern.
 *
 * **Failure attribution: AGENTE self-surface** — pre-RED redact gate MISSED
 * cumulative structural-conventions verification. Lección NEW emerge cumulative
 * D1 captura:
 *   - `textual-rule-verification recursive structural conventions` NEW canonical
 *     home 1ra evidencia paired sister `textual-rule-verification recursive
 *     métricas Step 0` heredado C0. Aplicación: pre-RED redact MANDATORY grep
 *     cumulative file structure precedent (`find <layer>/<scope>/*` ≥ 3
 *     evidencias) ANTES de inventar estructura nueva.
 *   - `Marco-lock-superseded-by-cumulative-precedent` 2da evidencia matures
 *     cumulative (lock #1 naming axis `*ReaderPort` 4 evidencias 1ra + lock #4
 *     errors structure single bundle 13 evidencias 2da). Pattern emerge
 *     aplicable cross-POC futuros.
 *   - Single bundle errors file convention 14ª evidencia matures cumulative
 *     cross-module.
 *
 * Marco lock C1 final post-recon reverse delegation 5 ambigüedades resolved
 * (heredado RED1 commit `758975c`):
 *   1. Naming axis: opción (b) `*ReaderPort` suffix mirror iva-books/sale
 *      precedent cumulative 4 evidencias supersede pre-bookmark.
 *   2. Method signatures: opción (a) adoptar archive `design.md` flow EXACT
 *      con recon-driven correction:
 *        - FiscalPeriodReaderPort: `getById(orgId, periodId): Promise<Snapshot>`
 *          mirror iva-books FP port precedent EXACT (Snapshot LOCAL `{id,
 *          status: "OPEN" | "CLOSED"}`); consumer-side check `status === "OPEN"`
 *          (NO `isOpen` port method); `validateCanClose` es
 *          monthly-close.service internal NO FP port.
 *        - AccountingReaderPort: `sumDebitCredit` only (balance gate accounting
 *          domain SRP isolated); cross-entity counts 5 entities defer C1.5/C2
 *          axis-distinct.
 *   3. IvaBooksReaderPort: opción (a) DROP scope C1 — recon-evidence-based
 *      sin driver real (evidence-supersedes-assumption-lock NEW canonical home
 *      paired sister Marco-lock-superseded-by-cumulative-precedent).
 *   4. Errors C1: opción (b) ≥1 typed Error class. Locked `PeriodAlreadyClosedError`
 *      + `BalanceNotZeroError` locally definidas wrap códigos
 *      `@/features/shared/errors` (PERIOD_ALREADY_CLOSED + PERIOD_UNBALANCED
 *      constants). RED-α structural correction: single bundle file
 *      `monthly-close-errors.ts` mirror cumulative 13 evidencias EXACT (NO
 *      barrel NO per-class separate).
 *   5. ports/ subdir convention: APROBADO mirror sale/payment/iva-books
 *      precedent EXACT.
 *
 * **Snapshot LOCAL types GREEN target shape recon-driven mirror precedent EXACT**:
 *   - FiscalPeriodReaderPort: Snapshot LOCAL `{id: string, status: "OPEN" |
 *     "CLOSED"}` mirror iva-books `IvaFiscalPeriod` precedent EXACT (§13
 *     Reader port Snapshot LOCAL inline 8va evidencia D1 cementación
 *     cumulative cross-module).
 *   - AccountingReaderPort: Snapshot LOCAL `{debit: Money, credit: Money}` —
 *     reuse Money VO existente `modules/shared/domain/value-objects/money.ts`
 *     (Marco lock GREEN opción (d) — coherente domain pure NO Prisma leak R5,
 *     Money VO 4ta cementación cross-POC matures, service-level eq via
 *     Money.equals() native, NO crear type alias redundante violation
 *     rule-of-three). NEW §13 sub-evidencia variant: Snapshot LOCAL Money VO
 *     reuse pattern (paired sister §13 #1655 Snapshot LOCAL inline primitive-
 *     typed; variant: VO-typed vs primitive-typed) — 1ra evidencia POC
 *     monthly-close D1 cementación.
 *
 * 3α homogeneous granularity bisect-friendly POS existence (todas FAIL
 * pre-GREEN — `existsSync === true` reverses cuando file missing, mirror C0
 * + RED1 precedent EXACT pattern):
 *   - T1 POS: modules/monthly-close/domain/ports/fiscal-period-reader.port.ts
 *     file exists (driver-anchored cross-module fiscal-periods hex YA consume
 *     `makeFiscalPeriodsService` features/monthly-close.service.ts:11)
 *   - T2 POS: modules/monthly-close/domain/ports/accounting-reader.port.ts
 *     file exists (driver-anchored sumDebitCredit raw SQL JOIN pertenece
 *     accounting domain — features/monthly-close.repository.ts:108-131)
 *   - T3 POS: modules/monthly-close/domain/errors/monthly-close-errors.ts
 *     file exists (single bundle 14ª evidencia cumulative cross-module
 *     precedent EXACT — 2 typed Error classes inline + código constants
 *     wrap @/features/shared/errors PERIOD_ALREADY_CLOSED + PERIOD_UNBALANCED)
 *
 * Test file location modules/monthly-close/__tests__/ — top-level scope mirror
 * C0 + RED1 precedent EXACT (skeleton-level concern, NO domain-internal).
 * Domain layer materialization C1 con primer file real `domain/ports/*.port.ts`
 * + `domain/errors/<module>-errors.ts` (NO `.gitkeep`, NO empty barrels
 * speculativos).
 *
 * Self-contained future-proof (lección A6 #5 + Marco lock L6 heredado): shape
 * test asserta paths bajo `modules/monthly-close/domain/` que persisten todo
 * el POC C2-C7 (ningún ciclo borra estos paths — solo expanden contenido +
 * application/infrastructure layers materializan C2/C3). C7 wholesale delete
 * `features/monthly-close/*` NO toca paths del C1 RED-α. CLEAN forward verified
 * pre-RED-α via cross-cycle-red-test-cementacion-gate Step 0.5.
 *
 * Source-string assertion pattern: mirror C0 + RED1 precedent EXACT
 * (`existsSync(resolve(ROOT, rel))`) + fiscal-periods C1-α precedent — keep
 * pattern POC nuevo monthly-close. Target asserciones domain skeleton 2 ports
 * + 1 single bundle errors file únicamente. Method signatures + interface
 * shape + Snapshot LOCAL types + typed Error class shape se verifican GREEN
 * tsc + suite cross-cycle (NO RED-time content assertions — mirror lección
 * `red-regex-discipline` heredado: NO regex needed C1 existence-only,
 * existsSync suficiente).
 *
 * Expected RED-α failure mode pre-GREEN (per lección
 * red-acceptance-failure-mode heredado):
 *   - T1-T3 FAIL: 3 files (2 ports + 1 single bundle errors) NO existen
 *     pre-GREEN — `existsSync === true` reverses (path AUSENTE pre-GREEN, POS
 *     existence assertion fails on missing path). Layer dir
 *     `modules/monthly-close/domain/` también materializa primera vez con
 *     primer file real C1 GREEN (NO pre-existe vacío, mirror fiscal-periods
 *     precedent EXACT).
 * Total expected pre-GREEN: 3 FAIL / 0 PASS / 0 divergent paths declarados.
 * NO preservation guards (innecesarios skeleton create-only — todos POS
 * existence cutover puro mirror C0 3/3 FAIL precedent + fiscal-periods
 * C1-α 5/5 FAIL precedent EXACT).
 *
 * Cross-ref:
 *   - architecture.md §13 Reader port domain-internal Snapshot LOCAL
 *     definition (1ra evidencia formal POC payment C4-α — engram #1655). C1
 *     monthly-close 8va evidencia D1 cementación cumulative cross-module
 *     (FiscalPeriodReaderPort Snapshot LOCAL primitive-typed mirror
 *     `IvaFiscalPeriod` EXACT; AccountingReaderPort Snapshot LOCAL VO-typed
 *     reuse Money — NEW sub-evidencia variant 1ra POC monthly-close).
 *   - architecture.md §13 fiscal-periods-C cross-module hex (7ma cementada
 *     cumulative). C1 monthly-close 8va evidencia D1.
 *   - architecture.md §17 carve-out cross-module UoW (deferred C3 wiring —
 *     C1 domain-only).
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
 *   - modules/{sale,payment,iva-books,fiscal-periods,accounting,purchase,
 *     payables,receivables,voucher-types,contacts,org-settings,mortality,
 *     shared}/domain/errors/<module>-errors.ts (cumulative 13 evidencias
 *     single bundle file precedent EXACT — structural-conventions axis lock).
 *   - modules/shared/domain/value-objects/money.ts (Money VO 4ta cementación
 *     cross-POC matures: sale + payment + payables + monthly-close;
 *     AccountingReaderPort Snapshot LOCAL `{debit: Money, credit: Money}` —
 *     domain pure coherente, eq via Money.equals() native).
 *   - modules/monthly-close/__tests__/c0-skeleton-shape.poc-nuevo-monthly-close.test.ts
 *     (mirror precedent EXACT existsSync pattern + JSDoc structure shape).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C1 → C2-C7 CLEAN: paths bajo `modules/monthly-close/domain/`
 *     persisten todo el POC, ningún ciclo borra; C2 application service +
 *     C3 infra adapters consume estos ports → axis-distinct
 *     EXISTENCE→CONSUMPTION/IMPLEMENTATION sin shape collision).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 3/3 FAIL
 *     todas POS existence sin divergent paths — clean cutover skeleton
 *     create-only).
 *   - engram `feedback/red-regex-discipline` (NO regex needed C1 existence-only
 *     — solo existsSync, mirror C0 precedent).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED-α commit body — RED-α corrige
 *     in-place cumulative-precedent supersede 13:0 + Marco lock RED-α path
 *     mirror fiscal-periods C1-α sub-cycle pattern).
 *   - engram `feedback/sub-phase-start-coherence-gate` (Step 0 baseline cold
 *     verify pre-RED — métricas 4 runtime ground truth verified textual NO
 *     truncated: suite 5350p/7f/19s/5376/517 + TSC 17 + ESLint 10e/16w full +
 *     REQ-FMB.5 0; 7 fails ledger enumerated lección
 *     enumerated-baseline-failure-ledger compliance).
 *   - engram `feedback/textual-rule-verification` recursive métricas Step 0
 *     baseline (heredado C0) + NEW recursive structural conventions
 *     (RED-α self-surface failure pre-RED redact gate MISSED cumulative file
 *     structure verification 13:0 → lección NEW canonical home 1ra evidencia
 *     paired sister recursive métricas).
 *   - engram `feedback/Marco-lock-superseded-by-cumulative-precedent` (1ra
 *     evidencia C1 lock #1 naming axis `*ReaderPort` 4 evidencias). RED-α
 *     2da evidencia matures cumulative (lock #4 errors structure single
 *     bundle 13 evidencias supersede mi RED1 inventado).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (1ra evidencia
 *     C1 lock #3 IvaBooks DROP recon-driven — paired sister
 *     Marco-lock-superseded-by-cumulative-precedent).
 *   - engram `poc-nuevo/monthly-close/c0-closed` (precedent C0 cycle
 *     bookmark post-GREEN clean cutover sin drift — 4 métricas baseline
 *     EXACT preserved cumulative).
 *   - engram `poc-nuevo/monthly-close/c1-red` (RED1 commit `758975c` 5α
 *     superseded por RED-α 3α — same file in-place corrige mirror
 *     fiscal-periods C1-α sub-cycle pattern).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

describe("POC nuevo monthly-close C1 RED-α corrige in-place — domain layer entity-less shape minimal driver-anchored 2 reader ports cross-module + 1 single bundle errors file precedent mirror cumulative 13 evidencias EXACT (single bundle convention NO barrel NO per-class) Opción α minimal 3α POS existence clean cutover sin divergent paths sin preservation guards skeleton create-only sub-cycle adjustment mirror fiscal-periods C1-α pattern", () => {
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

  it("Test 2: modules/monthly-close/domain/ports/accounting-reader.port.ts file exists (POSITIVE AccountingReaderPort outbound cross-module sumDebitCredit balance gate accounting domain SRP isolated — Snapshot LOCAL `{debit: Money, credit: Money}` reuse Money VO existente domain pure NO Prisma leak R5 + Money VO 4ta cementación cross-POC matures + NEW §13 sub-evidencia variant VO-typed)", () => {
    expect(exists("modules/monthly-close/domain/ports/accounting-reader.port.ts")).toBe(true);
  });

  // ── B: domain/errors/ single bundle file (Test 3) ──
  // Marco lock RED-α structural correction: single bundle `monthly-close-errors.ts`
  // mirror cumulative 13 evidencias EXACT (NO index.ts barrel NO per-class
  // separate files). RED1 5α superseded por RED-α 3α — sub-cycle adjustment
  // pre-GREEN sin churn git revert mirror fiscal-periods C1-α pattern.

  it("Test 3: modules/monthly-close/domain/errors/monthly-close-errors.ts file exists (POSITIVE single bundle 14ª evidencia cumulative cross-module precedent EXACT — 2 typed Error classes inline PeriodAlreadyClosedError + BalanceNotZeroError wrap códigos @/features/shared/errors PERIOD_ALREADY_CLOSED + PERIOD_UNBALANCED constants mirror sale/payment/iva-books/fiscal-periods/accounting/purchase/payables/receivables/voucher-types/contacts/org-settings/mortality/shared single bundle convention)", () => {
    expect(exists("modules/monthly-close/domain/errors/monthly-close-errors.ts")).toBe(true);
  });
});
