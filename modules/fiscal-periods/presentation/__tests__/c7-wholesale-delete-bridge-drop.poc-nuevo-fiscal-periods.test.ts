/**
 * POC nuevo fiscal-periods C7 RED — wholesale delete `features/fiscal-periods/*`
 * (3 archivos: index.ts + fiscal-periods.types.ts + server.ts) atomic + DROP
 * línea 9 bridge re-export `modules/fiscal-periods/presentation/server.ts`
 * (Opción A class identity preservada via re-export bridge cementado C1-α
 * GREEN). Cumulative absorb cross-cycle 0 residual consumers post C1-α through
 * C6 verified 10mo + 11mo grep gates CLEAN PROACTIVE pre-RED.
 *
 * §13.A5-ζ wholesale 4ta evidencia matures cumulative cross-POC sub-cycle
 * (cumulative POC paired-pr 1ra + payment 2da + contacts 3ra + fiscal-periods
 * 4ta). Engram canonical home `arch/§13/A5-zeta-classification-by-target-type`
 * matures cumulative — NO requiere re-cementación canonical home.
 *
 * Marco lock C7 Opción C mixto retire RED tests cumulative same-axis (D1 NEW
 * canonical home `feedback/retirement-strategy-mixto` 1ra evidencia POC
 * fiscal-periods C7):
 *   - Delete wholesale 5 archivos completos: c-bis (8α) + c2 (4α) + c3 (8α)
 *     + c4 (42α) + c6 (3α). Total 65α retire wholesale GREEN. Diff mínimo,
 *     archaeology recoverable via git log + RED commit hashes preservados.
 *   - Skip+comment intra-file C1-α T4+T5 únicos (preservar precedent EXACT
 *     mismo archivo T1-T3 ya skipped C-bis GREEN). NO delete archivo C1-α —
 *     mantener consistency intra-file retire pattern (delete file completo
 *     C1-α rompería symmetry intra-file existente).
 *
 * 10mo retirement-reinventory-gate-class-symbol-grep CLEAN confirmado pre-RED
 * (1ra evidencia POC contacts C4-bis + 2da evidencia POC fiscal-periods C7
 * PROACTIVE matures cumulative): grep `\bFiscalPeriodsService\b` PROJECT-scope
 * → 0 residual consumers via paths legacy. Hits únicos: features/fiscal-
 * periods/server.ts:2,19 (self-import + class declaration desaparecen con
 * wholesale delete) + 1 mention JSDoc features/accounting/journal.dates.ts:10
 * (comentario, NO import). Resto consumers usan `makeFiscalPeriodsService`
 * factory via `@/modules/fiscal-periods/presentation/server` HEX path.
 *
 * 11mo retirement-reinventory-gate-vimock-factory-grep CLEAN confirmado
 * pre-RED (1ra evidencia POC contacts C4-ter + 2da evidencia POC fiscal-
 * periods C7 PROACTIVE matures cumulative): grep `vi\.mock.*@/features/
 * fiscal-periods` PROJECT-scope → 0 declaraciones ejecutables. Hits únicos:
 * textos JSDoc descriptivos `c3-cutover-...test.ts:111,114` (NO `vi.mock(...)`
 * ejecutable).
 *
 * Production consumers `@/features/fiscal-periods/*` excl tests + bridge line:
 * 1 hit único `modules/fiscal-periods/presentation/server.ts:9` (target DROP
 * C7). Cero consumers cumulative absorb post C1-α/C-bis/C2/C3/C4/C5/C6.
 *
 * cross-cycle-red-test-cementacion-gate 9na evidencia matures cumulative
 * cross-POC sub-cycle (8va C6 PROACTIVE forward → 9na C7 retire schedule
 * MANDATORY). 6 RED test files cumulative collide path C7 wholesale delete
 * + DROP bridge — retire schedule mixto Opción C lockeado pre-RED.
 *
 * 5α single test file homogeneous granularity bisect-friendly:
 *   - T1 NEG: features/fiscal-periods/index.ts file ABSENT (existsSync false)
 *   - T2 NEG: features/fiscal-periods/fiscal-periods.types.ts file ABSENT
 *   - T3 NEG: features/fiscal-periods/server.ts file ABSENT
 *   - T4 NEG: modules/fiscal-periods/presentation/server.ts NO contains
 *     legacy bridge `export { FiscalPeriodsService } from "@/features/fiscal-
 *     periods/server"` (DROP línea 9 bridge)
 *   - T5 POS preservation guard: modules/fiscal-periods/presentation/server.ts
 *     preserves canonical hex exports (makeFiscalPeriodsService factory +
 *     FiscalPeriod entity class + createFiscalPeriodSchema) post-DROP — guard
 *     contra over-delete accidental durante GREEN
 *
 * Test file location modules/fiscal-periods/presentation/__tests__/ — target
 * hex ownership mirror precedent C2/C3/C4/C6 EXACT — self-contained future-
 * proof. Test file NO toca features/fiscal-periods/* que GREEN borrará.
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado):
 * shape test asserta paths `modules/fiscal-periods/presentation/server.ts`
 * que persiste post-GREEN (target ABSENT bridge línea + canonical preserved)
 * + 3 paths `features/fiscal-periods/*` ABSENT verificación post wholesale
 * delete. Test vive en `modules/fiscal-periods/presentation/__tests__/` —
 * NO toca features/fiscal-periods/* que GREEN borrará. Self-contained vs
 * future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent C1-α/C2/C3/C4/C6 EXACT
 * (`fs.readFileSync` regex match + `existsSync` file existence) — keep pattern
 * POC nuevo fiscal-periods. Target asserciones consumer surface paths +
 * bridge line absent + canonical exports preserved.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1-T3 FAIL: 3 files existen pre-GREEN — `existsSync === false` reverses
 *     (file PRESENT pre-GREEN, NEG absent assertion fails on unwanted match).
 *   - T4 FAIL: bridge línea 9 PRESENT pre-GREEN — `not.toMatch` reverses
 *     (legacy re-export PRESENT pre-GREEN, NEG absent assertion fails on
 *     unwanted match).
 *   - T5 PASS pre-GREEN (preservation guard pattern explícito divergent path
 *     declared + justified per Marco red-acceptance-failure-mode lock): hex
 *     canonical exports YA presentes pre-GREEN (líneas 3, 4, 12 server.ts),
 *     GREEN preserves post-DROP línea 9 bridge únicamente. JUSTIFICACIÓN
 *     divergent path: T5 NO es cutover assertion (todas FAIL pre-GREEN
 *     precedente C1-α 5/5 cutover puro), es preservation guard contra
 *     over-delete accidental durante GREEN — pattern preservation guard
 *     reconocido deliberately accept PASS pre-GREEN, NO silent acceptance,
 *     declared explicit + justified. Wholesale delete + DROP cycles requieren
 *     preservation guard (cutover cycles NO).
 * Total expected pre-GREEN: 4 FAIL + 1 PASS (preservation guard explícito
 * justified divergent path).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-ζ wholesale (4ta evidencia matures cumulative
 *     cross-POC sub-cycle continuation post POC contacts 3ra)
 *   - engram `arch/§13/A5-zeta-classification-by-target-type` (canonical home
 *     matures cumulative cross-POC)
 *   - engram `feedback/retirement-reinventory-gate-class-symbol-grep` (10mo
 *     axis 2da evidencia POC fiscal-periods C7 PROACTIVE CLEAN matures
 *     cumulative)
 *   - engram `feedback/retirement-reinventory-gate-vimock-factory-grep` (11mo
 *     axis 2da evidencia POC fiscal-periods C7 PROACTIVE CLEAN matures
 *     cumulative)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (9na evidencia
 *     POC fiscal-periods C7 retire schedule mixto Opción C MANDATORY)
 *   - engram `feedback/retirement-strategy-mixto` (D1 NEW canonical home —
 *     delete wholesale 5 archivos + skip+comment intra-file 2α C1-α
 *     symmetry preservation 1ra evidencia POC fiscal-periods C7)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex
 *     shape C1-α/C6 — `^export \{ <symbol> \} from ...;$/m` anchor +
 *     `not.toMatch` legacy bridge mismo regex shape Opción A reverso)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 4/5 FAIL +
 *     1/5 PASS preservation guard explícito justified divergent path)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED commit body — §13.A5-ζ wholesale 4ta
 *     matures cumulative + 10mo + 11mo grep gates CLEAN + retirement-strategy-
 *     mixto NEW canonical home + cross-cycle 9na PROACTIVE)
 *   - features/fiscal-periods/index.ts (target T1 — DELETE wholesale GREEN)
 *   - features/fiscal-periods/fiscal-periods.types.ts (target T2 — DELETE)
 *   - features/fiscal-periods/server.ts (target T3 — DELETE class shim
 *     FiscalPeriodsService + toLegacyShape)
 *   - modules/fiscal-periods/presentation/server.ts (target T4 — DROP línea
 *     9 bridge + T5 POS preservation guard canonical exports)
 *   - modules/fiscal-periods/presentation/__tests__/c1-alpha-cutover-services-
 *     shape.poc-nuevo-fiscal-periods.test.ts (retire intra-file skip+comment
 *     T4+T5 GREEN — preservar precedent EXACT T1-T3 skipped C-bis)
 *   - 5 archivos delete wholesale GREEN: c-bis + c2 + c3 + c4 + c6 RED test
 *     files cumulative same-axis
 *   - modules/contacts/presentation/__tests__/* (precedent POC contacts C4
 *     wholesale delete + DROP bridge — mirror EXACT literal pattern shape)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("POC nuevo fiscal-periods C7 — wholesale delete features/fiscal-periods/* atomic + DROP línea 9 bridge re-export modules/fiscal-periods/presentation/server.ts (Opción A class identity preservada via re-export bridge cementado C1-α GREEN — cumulative absorb cross-cycle 0 residual consumers post C1-α through C6 verified 10mo + 11mo grep gates CLEAN PROACTIVE pre-RED 5α homogeneous granularity bisect-friendly 4 NEG file/line absent + 1 POS preservation guard explícito)", () => {
  // ── A: features/fiscal-periods/* file ABSENT (Tests 1-3) ─────────────────
  // Wholesale delete 3 archivos atomic GREEN. Cumulative absorb cross-cycle
  // 0 residual consumers verified pre-RED (10mo class symbol grep CLEAN +
  // 11mo vi.mock factory grep CLEAN).

  it("Test 1: features/fiscal-periods/index.ts file ABSENT (NEGATIVE wholesale delete legacy isomorphic barrel post-cutover)", () => {
    expect(exists("features/fiscal-periods/index.ts")).toBe(false);
  });

  it("Test 2: features/fiscal-periods/fiscal-periods.types.ts file ABSENT (NEGATIVE wholesale delete legacy types declaration post-cutover)", () => {
    expect(exists("features/fiscal-periods/fiscal-periods.types.ts")).toBe(false);
  });

  it("Test 3: features/fiscal-periods/server.ts file ABSENT (NEGATIVE wholesale delete legacy class shim FiscalPeriodsService + toLegacyShape post-cutover)", () => {
    expect(exists("features/fiscal-periods/server.ts")).toBe(false);
  });

  // ── B: DROP línea 9 bridge re-export `export { FiscalPeriodsService } from "@/features/fiscal-periods/server"` (Test 4) ──
  // DROP línea 9 modules/fiscal-periods/presentation/server.ts — Opción A
  // bridge cementado C1-α GREEN class identity preservada via re-export
  // legacy shim. Cumulative absorb cross-cycle 0 residual consumers verified
  // pre-RED — DROP línea bridge desensables shim post wholesale delete.

  it("Test 4: modules/fiscal-periods/presentation/server.ts NO contains `export { FiscalPeriodsService } from \"@/features/fiscal-periods/server\"` (NEGATIVE bridge re-export DROP post-cutover Opción A class identity preservada cumulative absorb cross-cycle)", () => {
    const src = read("modules/fiscal-periods/presentation/server.ts");
    expect(src).not.toMatch(
      /export\s*\{\s*FiscalPeriodsService\s*\}\s*from\s+["']@\/features\/fiscal-periods\/server["']/,
    );
  });

  // ── C: Hex barrel canonical exports preservation guard (Test 5) ──────────
  // T5 POS preservation guard pattern explícito (failure mode divergent path
  // declared + justified per feedback/red-acceptance-failure-mode): assert
  // canonical hex exports preserved post-DROP línea 9 bridge — guard contra
  // over-delete accidental durante GREEN (factory + entity class + schema
  // ancla 3 paths composition-root + domain + validation). PASS pre-GREEN
  // explícito deliberately accepted preservation guard pattern, NO silent
  // acceptance.

  it("Test 5: modules/fiscal-periods/presentation/server.ts preserves canonical hex exports (POSITIVE preservation guard — makeFiscalPeriodsService factory + FiscalPeriod entity + createFiscalPeriodSchema post-DROP línea 9 bridge PASS pre-GREEN deliberately accepted preservation guard pattern)", () => {
    const src = read("modules/fiscal-periods/presentation/server.ts");
    expect(src).toMatch(
      /^export \{ makeFiscalPeriodsService \} from "\.\/composition-root";$/m,
    );
    expect(src).toMatch(
      /^export \{ FiscalPeriod \} from "\.\.\/domain\/fiscal-period\.entity";$/m,
    );
    expect(src).toMatch(
      /^export \{ createFiscalPeriodSchema \} from "\.\/fiscal-period\.validation";$/m,
    );
  });
});
