/**
 * POC nuevo fiscal-periods C2 RED — 2 components VALUE-axis cutover legacy
 * isomorphic barrel `@/features/fiscal-periods` → hex isomorphic barrel
 * `@/modules/fiscal-periods/presentation/index` (client-safe). Marco lock
 * Opción 1 homogeneous VALUE-pure scope tras Step 0 expand premise-verification
 * 4ta evidencia (bookmark scope drift 3-axis: count 4 components → realidad 3
 * components + 1 production route.ts; pattern `FiscalPeriodLike` 0 external
 * consumers; `FiscalPeriod` Prisma row TYPE missing pattern list bookmark).
 * Diferidos: `period-list.tsx` TYPE-only `FiscalPeriod` Prisma row → C6 absorb
 * (§13.A reverse direction TYPE-only/existence-only 6ta evidencia matures
 * cumulative cross-POC retroactive reclassification VALUE→TYPE-only PROACTIVE
 * pre-RED) + `app/api/.../periods/route.ts` production VALUE
 * `createFiscalPeriodSchema` → C4 batch (mirror contacts C4-ter precedent EXACT
 * 12 production VALUE consumers cycle separado de components).
 *
 * 2 components VALUE consumers FULL (NO type-only):
 *   - components/accounting/journal-entry-form.tsx (línea 26 import
 *     `findPeriodCoveringDate` from `@/features/fiscal-periods`)
 *   - components/accounting/period-create-dialog.tsx (línea 23 import
 *     `MONTH_NAMES_ES` from `@/features/fiscal-periods`)
 *
 * 4α single test file homogeneous granularity per archivo bisect-friendly
 * (mirror C-bis precedent EXACT — 2 archivos × 2 assertions = 4α total):
 *   - 2 POS hex isomorphic barrel `^import { <symbol> } from "@/modules/fiscal-periods/presentation/index";$/m` per archivo (Tests 1, 3)
 *   - 2 NEG legacy isomorphic barrel path drop `from\s+"@\/features\/fiscal-periods"` per archivo (Tests 2, 4)
 *
 * Test file location modules/fiscal-periods/presentation/__tests__/ — target
 * hex ownership mirror precedent C-bis EXACT — self-contained future-proof vs
 * C7 wholesale delete features/fiscal-periods/*. Components son pre-existing
 * files NO en scope wholesale C7.
 *
 * Marco locks aplicados (heredados Step 0 close fiscal-periods + lock C2):
 *   - Q-C2 Opción 1 homogeneous VALUE-pure: 2 archivos VALUE-axis puros (NO
 *     TYPE-only mezclado, NO production route.ts mezclado). Defer period-list
 *     C6 + route.ts C4 preserva mental model recon homogeneous cumulative.
 *   - L1 (C1-α Opción A re-export bridge cementado): hex isomorphic barrel
 *     ya exporta MONTH_NAMES_ES + findPeriodCoveringDate (verified Step 0
 *     expand `modules/fiscal-periods/presentation/index.ts` líneas 4 + 7-8).
 *     Swap mecánico puro path mirror C1-α precedent EXACT — 2 archivos × 1
 *     línea swap target.
 *   - L4 (capturar D1 cumulative cementación cumulative fiscal-periods):
 *     §13.A reverse direction 6ta evidencia matures + premise-verification-
 *     canonical-claim 4ta evidencia matures + 14-axis classification REFINED
 *     post-cycle close (post §13.A reverse 6ta evidencia matures).
 *
 * Cross-cycle red test cementación gate forward (5ta evidencia POC fiscal-
 * periods C2 PROACTIVE matures cumulative cross-POC sub-cycle): 4α tests
 * survive forward all cycles C3 through D1 unchanged — no path collision (C3
 * cross-module adapters + C4 page.tsx/route.ts + C5 vi.mock+integration + C6
 * test files TYPE absorbe period-list deferred + C7 wholesale delete features/
 * fiscal-periods/* + D1 doc-only). NO retire schedule needed — invariants hold
 * cumulative POC closure.
 *
 * §13.A4-η factory return shape sub-pattern N+4ma matures cumulative cross-POC
 * (POC contacts N+2ma + POC fiscal-periods C-bis N+3ma + POC fiscal-periods
 * C2 N+4ma evidencia matures cumulative — VALUE-axis path swap cementación
 * mecánico puro mirror C1-α/C-bis precedent EXACT). Engram canonical home
 * `arch/§13/A4-eta-factory-return-shape-sub-pattern` matures cumulative cross-
 * POC sub-cycle — NO requiere re-cementación canonical home; matures cumulative.
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado):
 * shape test asserta paths `components/accounting/journal-entry-form.tsx` +
 * `components/accounting/period-create-dialog.tsx` que persisten post C7
 * wholesale delete features/fiscal-periods/*. Test vive en
 * `modules/fiscal-periods/presentation/__tests__/` — NO toca features/fiscal-
 * periods/* que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror C-bis EXACT (`fs.readFileSync` regex
 * match) — keep pattern POC nuevo fiscal-periods. Target asserciones consumer
 * surface paths.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1, T3 FAIL: 2 components hoy importan `from "@/features/fiscal-periods"`
 *     (legacy isomorphic barrel pre-cutover) — `toMatch` hex isomorphic barrel
 *     pattern fails (target path NO present pre-GREEN).
 *   - T2, T4 FAIL: 2 components hoy contienen `from "@/features/fiscal-periods"`
 *     legacy isomorphic barrel path PRESENT pre-cutover — `not.toMatch`
 *     reverses. Test fails on unwanted match (legacy path PRESENT pre-GREEN).
 * Total expected FAIL pre-GREEN: 4/4 (Marco mandate failure mode honest
 * enumerated single side fiscal-periods C2).
 *
 * Cross-ref:
 *   - architecture.md §13.A4-η factory return shape sub-pattern (N+4ma matures
 *     cumulative cross-POC sub-cycle continuation post POC fiscal-periods
 *     C-bis N+3ma)
 *   - engram `arch/§13/A4-eta-factory-return-shape-sub-pattern` (canonical home)
 *   - engram `poc-nuevo/fiscal-periods/bookmark-step0` (Step 0 close C-bis +
 *     forward C2 candidates Marco lock Opción 1 homogeneous VALUE-pure)
 *   - engram `arch/§13/a-reverse-direction-type-only-existence-only` 6ta
 *     evidencia matures cumulative cross-POC POC fiscal-periods C2 (period-
 *     list.tsx TYPE-only Prisma row retroactive reclassification VALUE→TYPE-
 *     only PROACTIVE pre-RED defer C6)
 *   - engram `feedback/premise-verification-canonical-claim` 4ta evidencia
 *     (bookmark scope drift 3-axis fiscal-periods C2 retroactive reclassification)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (5ta evidencia
 *     POC fiscal-periods C2 PROACTIVE matures cumulative cross-POC sub-cycle)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex
 *     shape C-bis — `^import { <symbol> } from ...;$/m` anchor)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode honest 4/4
 *     enumerated single side fiscal-periods C2)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED commit body — §13.A4-η matures
 *     cumulative + §13.A reverse 6ta + premise-verification 4ta)
 *   - components/accounting/journal-entry-form.tsx (target T1, T2)
 *   - components/accounting/period-create-dialog.tsx (target T3, T4)
 *   - modules/fiscal-periods/presentation/__tests__/c-bis-cutover-services-value-axis-shape.poc-nuevo-fiscal-periods.test.ts
 *     (precedent shape POC nuevo fiscal-periods C-bis RED + GREEN — mirror
 *     EXACT literal Nα homogeneous granularity per archivo bisect-friendly)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("POC nuevo fiscal-periods C2 — 2 components VALUE-axis cutover legacy isomorphic barrel `@/features/fiscal-periods` → hex isomorphic barrel `@/modules/fiscal-periods/presentation/index` (mirror C-bis precedent EXACT literal 4α homogeneous granularity per archivo)", () => {
  // journal-entry-form.tsx
  it("Test 1: journal-entry-form.tsx contains `import { findPeriodCoveringDate } from \"@/modules/fiscal-periods/presentation/index\"` (POSITIVE hex isomorphic barrel swap target post-cutover)", () => {
    const src = read("components/accounting/journal-entry-form.tsx");
    expect(src).toMatch(
      /^import \{ findPeriodCoveringDate \} from "@\/modules\/fiscal-periods\/presentation\/index";$/m,
    );
  });
  it("Test 2: journal-entry-form.tsx NO contains legacy `from \"@/features/fiscal-periods\"` (NEGATIVE legacy isomorphic barrel path drop post-cutover)", () => {
    const src = read("components/accounting/journal-entry-form.tsx");
    expect(src).not.toMatch(/from\s+"@\/features\/fiscal-periods"/);
  });

  // period-create-dialog.tsx
  it("Test 3: period-create-dialog.tsx contains `import { MONTH_NAMES_ES } from \"@/modules/fiscal-periods/presentation/index\"` (POSITIVE hex isomorphic barrel swap target post-cutover)", () => {
    const src = read("components/accounting/period-create-dialog.tsx");
    expect(src).toMatch(
      /^import \{ MONTH_NAMES_ES \} from "@\/modules\/fiscal-periods\/presentation\/index";$/m,
    );
  });
  it("Test 4: period-create-dialog.tsx NO contains legacy `from \"@/features/fiscal-periods\"` (NEGATIVE legacy isomorphic barrel path drop post-cutover)", () => {
    const src = read("components/accounting/period-create-dialog.tsx");
    expect(src).not.toMatch(/from\s+"@\/features\/fiscal-periods"/);
  });
});
