/**
 * POC nuevo monthly-close C2.5 RED-α — `getSummary` outside-scope read-only
 * outside-tx use case completion hex application surface gap (axis-distinct
 * deferred C2.5 per `monthly-close-unit-of-work.ts:16` + c2-1 test:44 + c2-2
 * test:30 + c5-integration test:37 4 evidencias textuales design intent).
 * 5α minimal existence-only POS — file existsSync + content-grep mínimo
 * (red-regex-discipline existence-only RED-time NO content-grep deeper, mirror
 * C0-α / C1-α / C2.1-α / C2.2-α / C3-α / C4-α / C6-α 7 evidencias EXACT
 * cumulative monthly-close).
 *
 * **Marco locks pre-RED 10 ejes confirmados defaults APROBADOS**:
 *
 *   #1 Port shape granularity (a) — UNO `MonthlyCloseSummaryReaderPort` 3
 *      métodos: `countPostedByPeriod` + `getJournalSummaryByVoucherType` +
 *      `sumDebitCreditNoTx`. Mirror `DraftDocumentsReaderPort` precedent EXACT
 *      single-port-multi-method outside-scope aggregating shape — 5ta evidencia
 *      matures cumulative cross-module outside-scope read-only port.
 *   #2 Posted counts shape (a) — single method `countPostedByPeriod(orgId,
 *      periodId): Promise<MonthlyClosePostedCounts>` aggregating 3 entities
 *      `{dispatches, payments, journalEntries: number}` mirror DraftDocuments
 *      `Promise.all` single call EXACT.
 *   #3 Balance NoTx return type (a) — `Promise<MonthlyClosePeriodBalance>`
 *      Money VO mirror C1 `AccountingReaderPort.sumDebitCredit` consistency
 *      tx-bound/NoTx axis-distinct only. Service-level computes
 *      `balanced`/`difference` paridad C2.2 `Money.equals` precedent — 1ra
 *      evidencia POC monthly-close NoTx variant Money VO consistency.
 *   #4 JournalSummary precision (a) — `totalDebit: number` legacy parity float
 *      arithmetic preservation regla #1 fidelidad. Riesgo H NEW float drift
 *      DEFER §13 D1 (defer scope POC).
 *   #5 MonthlyCloseSummary DTO home (a) — Inline `application/monthly-close.
 *      service.ts` mirror `CloseResult` precedent EXACT 2da evidencia matures.
 *   #6 Composition root wiring (a) — Add 4to dep `summaryReader:` MOD
 *      `makeMonthlyCloseService()` factory.
 *   #7 Granularity α (c) — RED+GREEN split mirror C2.1+C2.2+C3+C4 precedent
 *      multi-layer NEW behavioral.
 *   #8 Integration tests scope (c) — Hybrid: RED-α dedicated shape file + GREEN
 *      expand C5 service behavioral file post-GREEN cases legacy parity 599
 *      LOC subset.
 *   #9 RED-α scope existence-only POS — 5α: T1 port file existsSync + T2
 *      adapter file existsSync + T3 adapter `implements` source-grep (graceful
 *      empty-fallback pre-GREEN) + T4 service `getSummary` method source-grep +
 *      T5 composition-root `summaryReader:` source-grep MOD.
 *   #10 Riesgos heredados sin cambio + NEW Riesgo H float drift DEFER §13 D1.
 *
 * **Pre-RED redact gate textual-rule-verification recursive structural
 * conventions 6ta evidencia matures cumulative** (C1 + C2.2 + C3 + C4 + C6 +
 * C2.5 recursive 5 conventions verified ≥3 evidencias EXACT pre-RED redact):
 *
 *   1. **Outside-scope read-only port pattern** — 4 evidencias EXACT cumulative
 *      cross-module: `FiscalPeriodReaderPort` + `DraftDocumentsReaderPort`
 *      monthly-close + `IvaBookReaderPort` sale + `SaleReaderPort` iva-books.
 *      JSDoc explicit "OUTSIDE scope, resolves before UoW tx opens, mirror
 *      cumulative-precedent EXACT".
 *   2. **Prisma direct adapter outside-scope `Pick<PrismaClient, "tables">`
 *      ctor** — `PrismaDraftDocumentsReaderAdapter` precedent EXACT 1 evidencia
 *      local + cross-POC sale/iva-books reader adapters.
 *   3. **Service method positional args + Promise<DTO> return** — C2.2 `close
 *      (orgId, periodId, userId, justification?)` 4-arg precedent → `getSummary
 *      (orgId, periodId)` 2-arg positional mirror EXACT.
 *   4. **DTO inline service file** — `CloseResult` interface inline
 *      `application/monthly-close.service.ts:18-30` precedent → `MonthlyClose
 *      Summary` mirror EXACT 2da evidencia matures.
 *   5. **RED-α existence-only POS NO content-grep deeper** — C1 lección + C6-a
 *      precedent EXACT (red-regex-discipline 7 evidencias EXACT cumulative).
 *
 * **Cross-cycle-RED-test-cementacion-gate forward-only check C2.5 → C6-b + C7
 * CLEAN ✓**:
 *   - C2.5 paths NEW: `modules/monthly-close/{domain/ports/monthly-close-
 *     summary-reader.port.ts + infrastructure/prisma-monthly-close-summary-
 *     reader.adapter.ts + __tests__/c2-5-*.test.ts + application/service MOD +
 *     presentation/composition-root MOD}`.
 *   - C6-b future paths: `app/api/.../monthly-close/summary/route.ts MOD +
 *     route.test.ts MOD` (cutover hex factory + signature swap mirror C6-a
 *     pattern paired §13.A4-η).
 *   - C7 paths: wholesale delete `features/monthly-close/*` 17 files.
 *   - NO overlap triple cycles ✓.
 *
 * **8 §13 emergentes capturar D1 cumulative**:
 *   1. NEW summary reader port outside-scope axis-distinct read-only outside-tx
 *      5ta evidencia matures cumulative cross-module (Lock #1).
 *   2. NoTx variant accounting balance Money VO consistency tx-bound/NoTx 1ra
 *      ev POC monthly-close (Lock #3).
 *   3. JournalSummary `totalDebit: number` float drift legacy parity Riesgo H
 *      NEW DEFER §13 D1 (Lock #4).
 *   4. `MonthlyCloseSummary` DTO inline service file 2da ev matures cumulative
 *      (Lock #5).
 *   5. Composition root 4to dep extension 7ma ev matures cumulative cross-
 *      module (Lock #6).
 *   6. textual-rule-verification recursive structural conventions 6ta ev
 *      matures cumulative (C1+C2.2+C3+C4+C6+C2.5 recursive).
 *   7. red-regex-discipline existence-only RED-time 7ma ev matures cumulative.
 *   8. evidence-supersedes-assumption-lock 9na ev matures cumulative cross-POC
 *      (C5 closure bookmark assumption "service behavioral 7 cases via
 *      makeMonthlyCloseService factory" supersede absoluto por 4 evidencias
 *      textuales design intent C2.5 axis-distinct deferral).
 *
 * Self-contained future-proof: shape test asserta paths `modules/monthly-close/
 * {domain/ports + infrastructure + application + presentation}` que persisten
 * post C7 wholesale delete `features/monthly-close/*`. Test vive en
 * `modules/monthly-close/__tests__/` — NO toca features/* que C7 borrará ✓.
 *
 * Source-string + existsSync assertion pattern mirror C6-a precedent EXACT.
 *
 * Expected RED-α failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1 FAIL: port file `modules/monthly-close/domain/ports/monthly-close-
 *     summary-reader.port.ts` NO existe pre-GREEN — `existsSync === true`
 *     reverses (path AUSENTE pre-GREEN, POS existence assertion fails).
 *   - T2 FAIL: adapter file `modules/monthly-close/infrastructure/prisma-
 *     monthly-close-summary-reader.adapter.ts` NO existe pre-GREEN — idem.
 *   - T3 FAIL: adapter file NO existe → `readSafe()` returns "" empty string
 *     → regex match `implements MonthlyCloseSummaryReaderPort` falla.
 *   - T4 FAIL: service.ts hoy SOLO tiene `close()` method (line 80) — NO
 *     contiene `async getSummary(` literal pre-GREEN. Regex match falla.
 *   - T5 FAIL: composition-root.ts hoy SOLO tiene 3 deps wiring (fiscalPeriods
 *     + draftDocuments + uow line 87-89) — NO contiene `summaryReader:`
 *     literal pre-GREEN. Regex match falla.
 * Total expected FAIL pre-GREEN: 5/5 declared explícito Marco mandate failure
 * mode honest enumerated.
 *
 * Cross-ref:
 *   - architecture.md §13 outside-scope read-only port pattern 5ta ev matures.
 *   - architecture.md §13 NoTx variant Money VO consistency 1ra ev POC mc.
 *   - architecture.md §13 JournalSummary float drift Riesgo H NEW DEFER D1.
 *   - architecture.md §13 DTO inline service file 2da ev matures.
 *   - features/monthly-close/monthly-close.service.ts:70-119 (driver-anchored
 *     legacy `getSummary(orgId, periodId): Promise<MonthlyCloseSummary>` shape
 *     source-of-truth para hex C2.5 — 7 reads composite: 1 fiscal periods
 *     getById + 3 countByStatus POSTED + validateCanClose drafts +
 *     getJournalSummaryByVoucherType + sumDebitCreditNoTx).
 *   - features/monthly-close/monthly-close.repository.ts:23-53 (countByStatus
 *     parameterized 5 entities, 3 consumed POSTED en getSummary).
 *   - features/monthly-close/monthly-close.repository.ts:97-106 (sumDebitCreditNoTx
 *     NoTx variant — outside-tx read-only).
 *   - features/monthly-close/monthly-close.repository.ts:220-259 (getJournalSummary
 *     ByVoucherType — `+= Number(line.debit)` float arithmetic Riesgo H).
 *   - features/monthly-close/monthly-close.types.ts:28-55 (MonthlyCloseSummary
 *     DTO shape source-of-truth para hex inline service file Lock #5).
 *   - modules/monthly-close/domain/ports/draft-documents-reader.port.ts
 *     (precedent EXACT outside-scope single-port-multi-method aggregating —
 *     mirror Lock #1 + Lock #2).
 *   - modules/monthly-close/infrastructure/prisma-draft-documents-reader.adapter.ts
 *     (precedent EXACT Prisma direct adapter `Pick<PrismaClient,...>` ctor
 *     outside-scope read-only — mirror C2.5 adapter shape).
 *   - modules/monthly-close/domain/ports/accounting-reader.port.ts:33-38
 *     (C1 cementado tx-bound `sumDebitCredit` Money VO — Lock #3 NoTx variant
 *     mirror return type EXACT consistency cross-method).
 *   - modules/monthly-close/application/monthly-close.service.ts:77 (C2.2
 *     cementado service class single `close()` method — gap surface Lock #6
 *     wiring 4to dep `summaryReader:` GREEN target).
 *   - modules/monthly-close/presentation/composition-root.ts:85-91 (C4
 *     cementado factory `makeMonthlyCloseService(): MonthlyCloseService` zero-
 *     arg 3 deps — Lock #6 GREEN target add 4to dep wiring).
 *   - modules/monthly-close/__tests__/c6-cutover-shape.poc-nuevo-monthly-close.
 *     test.ts (precedent C6-α 4α minimal RED-α existence-only POS pattern
 *     EXACT — mirror RED-α 5α minimal cumulative-precedent recursive).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (C2.5 → C6-b +
 *     C7 forward-only CLEAN verified Step 0 pre-RED).
 *   - engram `feedback/red-acceptance-failure-mode` (5/5 FAIL enumerated
 *     declared explícito).
 *   - engram `feedback/red-regex-discipline` (existence-only POS RED-time
 *     7ma evidencia matures cumulative).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite + rationale
 *     + cross-ref applied RED-α commit body).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (9na ev matures
 *     cumulative cross-POC — C5 closure bookmark "service behavioral 7 cases"
 *     supersede absoluto por 4 evidencias textuales C2.5 axis-distinct deferral).
 *   - engram `feedback/textual-rule-verification` (recursive structural
 *     conventions 6ta evidencia matures cumulative C1+C2.2+C3+C4+C6+C2.5).
 *   - engram `poc-nuevo/monthly-close/c6-a-closed` #1754 (precedent C6-a cycle
 *     bookmark 4 ejes Opción A reduced cutover post invariant collision
 *     elevation MANDATORY pre-commit — Step 0 cycle-start C2.5 file+assumption
 *     pairs checklist Marco lock).
 *   - engram `poc-nuevo/monthly-close/c5-closed` #1752 (precedent C5 integration
 *     tests cementados — Lock #8 hybrid GREEN expand C5 behavioral cases).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function readSafe(rel: string): string {
  return exists(rel) ? read(rel) : "";
}

// ── C2.5 targets ────────────────────────────────────────────────────────────

const PORT_TS =
  "modules/monthly-close/domain/ports/monthly-close-summary-reader.port.ts";
const ADAPTER_TS =
  "modules/monthly-close/infrastructure/prisma-monthly-close-summary-reader.adapter.ts";
const SERVICE_TS = "modules/monthly-close/application/monthly-close.service.ts";
const COMPOSITION_ROOT_TS =
  "modules/monthly-close/presentation/composition-root.ts";

// ── Regex patterns ──────────────────────────────────────────────────────────

const ADAPTER_IMPLEMENTS_PORT_RE =
  /\bimplements\s+MonthlyCloseSummaryReaderPort\b/m;
const SERVICE_GET_SUMMARY_METHOD_RE = /\basync\s+getSummary\s*\(/m;
const COMPOSITION_ROOT_SUMMARY_READER_KEY_RE = /\bsummaryReader\s*:/m;

describe("POC nuevo monthly-close C2.5 RED-α — `getSummary` outside-scope read-only outside-tx use case completion hex application surface gap axis-distinct deferred per 4 evidencias textuales design intent (Lock #1 UNO `MonthlyCloseSummaryReaderPort` 3 métodos mirror DraftDocuments precedent EXACT + Lock #2 `countPostedByPeriod` single aggregating + Lock #3 NoTx variant Money VO consistency C1 sumDebitCredit + Lock #4 JournalSummary `totalDebit: number` legacy parity Riesgo H DEFER §13 D1 + Lock #5 DTO inline service file mirror CloseResult + Lock #6 4to dep `summaryReader:` MOD composition root + Lock #7 RED+GREEN split + Lock #8 hybrid integration tests + Lock #9 5α existence-only POS + Lock #10 Riesgos heredados sin cambio) Opción α1 atomic single batch axis-distinct existence-only POS RED-α (mirror C0+C1-α+C2.1-α+C2.2-α+C3-α+C4-α+C6-α 7 evidencias EXACT cumulative monthly-close + cumulative-precedent recursive evidence-supersedes-assumption-lock 9na evidencia matures cumulative cross-POC C5 closure bookmark assumption `service behavioral 7 cases via makeMonthlyCloseService factory` supersede absoluto por 4 evidencias textuales design intent C2.5 axis-distinct deferral + textual-rule-verification recursive structural conventions 6ta evidencia matures + 5 conventions verified ≥3 evidencias EXACT pre-RED redact gate)", () => {
  // ── A: NEW port file existence (Test 1) ─────────────────────────────────
  // Lock #1 UNO `MonthlyCloseSummaryReaderPort` outside-scope read-only —
  // mirror `DraftDocumentsReaderPort` + `FiscalPeriodReaderPort` + sale
  // `IvaBookReaderPort` + iva-books `SaleReaderPort` 4 evidencias EXACT
  // cumulative cross-module.

  it("Test 1: modules/monthly-close/domain/ports/monthly-close-summary-reader.port.ts file exists (POS port home Lock #1 UNO `MonthlyCloseSummaryReaderPort` outside-scope read-only outside-tx 5ta evidencia matures cumulative cross-module — mirror DraftDocumentsReaderPort + FiscalPeriodReaderPort + sale IvaBookReaderPort + iva-books SaleReaderPort 4 evidencias EXACT cumulative)", () => {
    expect(exists(PORT_TS)).toBe(true);
  });

  // ── B: NEW adapter file existence (Test 2) ──────────────────────────────
  // Lock #1 adapter Prisma direct outside-scope `Pick<PrismaClient,...>` ctor
  // mirror `PrismaDraftDocumentsReaderAdapter` precedent EXACT.

  it("Test 2: modules/monthly-close/infrastructure/prisma-monthly-close-summary-reader.adapter.ts file exists (POS adapter Prisma direct outside-scope read-only mirror PrismaDraftDocumentsReaderAdapter precedent EXACT — `Pick<PrismaClient, \"dispatch\"|\"payment\"|\"journalEntry\"|\"voucherType\"|...>` ctor outside-scope read-only outside-tx)", () => {
    expect(exists(ADAPTER_TS)).toBe(true);
  });

  // ── C: Adapter implements port contract (Test 3) ────────────────────────
  // Adapter wires Port → Prisma concrete via `implements` interface contract
  // (TS structural type system). Pre-GREEN file empty → readSafe returns ""
  // → regex match falla. Cumulative-precedent EXACT 6 ports cementados
  // C1+C2.1+C2.5 NEW.

  it("Test 3: prisma-monthly-close-summary-reader.adapter.ts source contains `implements MonthlyCloseSummaryReaderPort` (POS adapter→port contract wiring TS structural type system mirror PrismaDraftDocumentsReaderAdapter precedent EXACT — `class Prisma{X}Adapter implements {X}Port` pattern cumulative)", () => {
    const source = readSafe(ADAPTER_TS);
    expect(source).toMatch(ADAPTER_IMPLEMENTS_PORT_RE);
  });

  // ── D: Service `getSummary` method MOD (Test 4) ────────────────────────
  // Lock #5 inline DTO + Lock #2 service method positional 2-arg signature.
  // Service.ts existing C2.2 + adds NEW `async getSummary(orgId, periodId):
  // Promise<MonthlyCloseSummary>` method. Pre-GREEN service.ts SOLO tiene
  // `close()` line 80 — `async getSummary(` literal AUSENTE.

  it("Test 4: modules/monthly-close/application/monthly-close.service.ts source contains `async getSummary(` method declaration (POS service method MOD Lock #5 inline DTO + Lock #2 service method positional 2-arg `getSummary(orgId, periodId): Promise<MonthlyCloseSummary>` mirror legacy features/monthly-close/monthly-close.service.ts:70 EXACT shape preservation)", () => {
    const source = read(SERVICE_TS);
    expect(source).toMatch(SERVICE_GET_SUMMARY_METHOD_RE);
  });

  // ── E: Composition root 4to dep wiring MOD (Test 5) ────────────────────
  // Lock #6 add 4to dep `summaryReader: new PrismaMonthlyCloseSummaryReader
  // Adapter(prisma)` MOD `makeMonthlyCloseService()` factory. Pre-GREEN
  // composition-root.ts SOLO tiene 3 deps fiscalPeriods+draftDocuments+uow
  // line 87-89 — `summaryReader:` literal AUSENTE.

  it("Test 5: modules/monthly-close/presentation/composition-root.ts source contains `summaryReader:` factory dep key (POS composition root 4to dep wiring MOD Lock #6 add `summaryReader: new PrismaMonthlyCloseSummaryReaderAdapter(prisma)` extension factory `makeMonthlyCloseService()` 3 deps → 4 deps cumulative-precedent 7ma evidencia matures cumulative cross-module)", () => {
    const source = read(COMPOSITION_ROOT_TS);
    expect(source).toMatch(COMPOSITION_ROOT_SUMMARY_READER_KEY_RE);
  });
});
