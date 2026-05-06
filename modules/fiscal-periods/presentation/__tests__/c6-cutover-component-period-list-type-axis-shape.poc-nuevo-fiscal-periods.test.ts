/**
 * POC nuevo fiscal-periods C6 RED — 1 component TYPE-axis cutover legacy
 * isomorphic barrel `@/features/fiscal-periods` → hex isomorphic barrel
 * `@/modules/fiscal-periods/presentation/index` (client-safe, TYPE-only). Marco
 * lock Opción ε identifier-preserving alias barrel re-export pattern NEW
 * canonical home — hex isomorphic barrel ADD `export type { FiscalPeriodSnapshot
 * as FiscalPeriod }` from `../domain/fiscal-period.entity`. Identifier name
 * `FiscalPeriod` preservado en period-list.tsx (diff mínimo path swap mecánico).
 *
 * VACUOUS-CLOSED partial scope reduction canonical home (D1 NEW lección formal
 * 2da evidencia matures cumulative — C5 full + C6 partial). Step 0 cycle-start
 * cold C6 inventory PROYECT-scope confirmó: 7 test files TYPE swap proyectados
 * bookmark inicial → 0 hits reales (premise-verification-canonical-claim 6ta
 * evidencia matures cumulative — bookmark drift count vs realidad). C6 scope
 * reducido a 1 component period-list.tsx TYPE-only swap único call-site real.
 *
 * §13.A4-η RSC boundary serialization adapter axis 7ma evidencia matures
 * cumulative cross-POC sub-cycle (deferred C2 §13.A reverse 6ta direction →
 * resolved C6 PROACTIVE pre-cementado page-side ya present). Page consumer
 * `app/(dashboard)/[orgSlug]/settings/periods/page.tsx:25` ya hace
 * `(await service.list(orgId)).map((p) => p.toSnapshot())` + línea 45
 * `JSON.parse(JSON.stringify(periods))` post-C4 production cutover — RSC
 * boundary serialization adapter PROACTIVE pre-cementado. period-list.tsx
 * recibe FiscalPeriodSnapshot post-JSON-stringified shape, NO Prisma row
 * directo. Verification 6/6 fields consumidos compatible (id, name, year,
 * startDate, endDate, status — domain/fiscal-period.entity.ts:27-41).
 *
 * Opciones consideradas Step 0 cold C6 (Marco lock ε post-recon):
 *   - α `FiscalPeriodLike` isomorphic: NO viable (3/6 fields, missing id/name/year)
 *   - β `@/generated/prisma/client` direct: viola lock cross-POC NO Prisma direct components
 *   - γ `FiscalPeriodSnapshot` server barrel: NO viable server-only incompatible "use client"
 *   - δ extend isomorphic barrel ADD `FiscalPeriodSnapshot` re-export: funcional
 *   - ε (LOCK): identifier-preserving alias `export type { FiscalPeriodSnapshot
 *     as FiscalPeriod }` — preserva identifier en period-list (diff mínimo path
 *     swap), source `../domain/fiscal-period.entity` direct (server-only NO
 *     trigger, domain pure)
 *
 * 1 component TYPE-only consumer único call-site real:
 *   - components/accounting/period-list.tsx (línea 11 `import type
 *     { FiscalPeriod } from "@/features/fiscal-periods"` legacy isomorphic
 *     barrel, period-list.tsx is "use client" — Client Component)
 *
 * 3α single test file homogeneous granularity bisect-friendly:
 *   - 1 POS hex isomorphic barrel re-export TYPE-only alias `^export type
 *     \{ FiscalPeriodSnapshot as FiscalPeriod \} from "\.\.\/domain\/fiscal-
 *     period\.entity";$/m` modules/fiscal-periods/presentation/index.ts (Test 1)
 *   - 1 POS hex isomorphic barrel TYPE-only import `^import type
 *     \{ FiscalPeriod \} from "@\/modules\/fiscal-periods\/presentation\/
 *     index";$/m` per archivo (Test 2)
 *   - 1 NEG legacy isomorphic barrel path drop `from\s+"@\/features\/fiscal-
 *     periods"` per archivo (Test 3)
 *
 * Test file location modules/fiscal-periods/presentation/__tests__/ — target
 * hex ownership mirror precedent C2/C3/C4 EXACT — self-contained future-proof
 * vs C7 wholesale delete features/fiscal-periods/*. period-list.tsx pre-existing
 * file NO en scope wholesale C7.
 *
 * Marco locks aplicados (heredados Step 0 close fiscal-periods + lock C6):
 *   - Opción ε identifier-preserving alias: `FiscalPeriod` en period-list.tsx
 *     mantiene name (zero rename), only path swap. Diff mínimo, mantenibilidad
 *     diff vs C7 retire bookmark forward.
 *   - L1 (C1-α Opción A re-export bridge cementado): hex isomorphic barrel
 *     pre-existente `MONTH_NAMES_ES + monthNameEs + createFiscalPeriodSchema +
 *     findPeriodCoveringDate + FiscalPeriodLike`. C6 ADD 1 línea TYPE-only
 *     `export type { FiscalPeriodSnapshot as FiscalPeriod }` extiende API
 *     superficial sin breaking.
 *   - L4 (capturar D1 cumulative cementación cumulative fiscal-periods):
 *     §13.A4-η 7ma evidencia matures cumulative + §13.A reverse 6ta resolved
 *     PROACTIVE + premise-verification 6ta + VACUOUS-CLOSED partial 2da +
 *     Opción ε identifier-preserving NEW canonical home (4 D1 NEW cumulative
 *     batch único pre-D1 post-GREEN).
 *
 * Cross-cycle red test cementación gate forward (8va evidencia POC fiscal-
 * periods C6 PROACTIVE matures cumulative cross-POC sub-cycle): 3α tests
 * survive forward C7 + D1 unchanged — no path collision (C7 wholesale delete
 * features/fiscal-periods/* NO touches modules/fiscal-periods/presentation/
 * index.ts re-export NEW + components/accounting/period-list.tsx TYPE swap +
 * D1 doc-only). C7 retire schedule bookmark forward DEBE incluir C6 3α paired
 * symmetry — surface a Marco D1 cumulative.
 *
 * §13.A4-η factory return shape sub-pattern N+7ma matures cumulative cross-POC
 * (POC fiscal-periods C-bis N+3ma + C2 N+4ma + C3 N+5ma + C4 N+6ma + C6 N+7ma
 * evidencia matures cumulative — TYPE-axis path swap RSC boundary serialization
 * adapter PROACTIVE pre-cementado page-side resuelto C6). Engram canonical home
 * `arch/§13/A4-eta-factory-return-shape-sub-pattern` matures cumulative — NO
 * requiere re-cementación canonical home; matures cumulative.
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado):
 * shape test asserta paths `components/accounting/period-list.tsx` +
 * `modules/fiscal-periods/presentation/index.ts` que persisten post C7
 * wholesale delete features/fiscal-periods/*. Test vive en
 * `modules/fiscal-periods/presentation/__tests__/` — NO toca features/fiscal-
 * periods/* que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror C2/C3/C4 EXACT (`fs.readFileSync`
 * regex match) — keep pattern POC nuevo fiscal-periods. Target asserciones
 * consumer surface paths.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1 FAIL: hex isomorphic barrel `modules/fiscal-periods/presentation/
 *     index.ts` NO contiene hoy `export type { FiscalPeriodSnapshot as
 *     FiscalPeriod } from "../domain/fiscal-period.entity"` — `toMatch` fails
 *     (target re-export NO present pre-GREEN).
 *   - T2 FAIL: period-list.tsx hoy importa `from "@/features/fiscal-periods"`
 *     legacy (línea 11 pre-cutover) — `toMatch` hex isomorphic barrel pattern
 *     fails (target path NO present pre-GREEN).
 *   - T3 FAIL: period-list.tsx hoy contiene `from "@/features/fiscal-periods"`
 *     legacy isomorphic barrel path PRESENT pre-cutover — `not.toMatch`
 *     reverses. Test fails on unwanted match (legacy path PRESENT pre-GREEN).
 * Total expected FAIL pre-GREEN: 3/3 (Marco mandate failure mode honest
 * enumerated single side fiscal-periods C6).
 *
 * Cross-ref:
 *   - architecture.md §13.A4-η factory return shape sub-pattern (N+7ma matures
 *     cumulative cross-POC sub-cycle continuation post POC fiscal-periods C4
 *     N+6ma)
 *   - architecture.md §13 RSC boundary serialization adapter (7ma evidencia
 *     matures cumulative — page-side PROACTIVE pre-cementado C4 production
 *     cutover, period-list TYPE swap consume-side resolved C6)
 *   - engram `arch/§13/A4-eta-factory-return-shape-sub-pattern` (canonical home)
 *   - engram `arch/§13/A-reverse-direction-type-only-existence-only` 6ta
 *     evidencia resolved POC fiscal-periods C6 (period-list.tsx TYPE-only
 *     deferred C2 → resolved C6)
 *   - engram `arch/vacuous-closed-cycle-canonical-home` (D1 NEW lección formal
 *     2da evidencia matures cumulative — C5 full + C6 partial)
 *   - engram `feedback/premise-verification-canonical-claim` 6ta evidencia
 *     (bookmark drift count vs realidad — 7 test files projected → 0 reales C6)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (8va evidencia
 *     POC fiscal-periods C6 PROACTIVE matures cumulative cross-POC sub-cycle)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex
 *     shape C2/C3/C4 — `^import type { <symbol> } from ...;$/m` anchor TYPE-
 *     only + `^export type { <alias> } from ...;$/m` re-export anchor)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode honest 3/3
 *     enumerated single side fiscal-periods C6)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED commit body — Opción ε identifier-
 *     preserving alias barrel re-export NEW + §13.A4-η 7ma + §13.A reverse 6ta
 *     resolved + premise-verification 6ta + VACUOUS-CLOSED partial 2da)
 *   - components/accounting/period-list.tsx (target T2, T3)
 *   - modules/fiscal-periods/presentation/index.ts (target T1)
 *   - modules/fiscal-periods/domain/fiscal-period.entity.ts (FiscalPeriodSnapshot
 *     source — 6/6 fields verified compatible Step 0 cold C6 pre-RED MANDATORY)
 *   - app/(dashboard)/[orgSlug]/settings/periods/page.tsx (page consumer §13
 *     RSC boundary PROACTIVE pre-cementado C4 — `.toSnapshot()` línea 25 +
 *     `JSON.parse(JSON.stringify())` línea 45)
 *   - modules/fiscal-periods/presentation/__tests__/c2-cutover-components-value-axis-shape.poc-nuevo-fiscal-periods.test.ts
 *     (precedent shape POC nuevo fiscal-periods C2 RED + GREEN — mirror EXACT
 *     literal Nα homogeneous granularity per archivo bisect-friendly)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("POC nuevo fiscal-periods C6 — 1 component TYPE-axis cutover legacy isomorphic barrel `@/features/fiscal-periods` → hex isomorphic barrel `@/modules/fiscal-periods/presentation/index` (Opción ε identifier-preserving alias `FiscalPeriodSnapshot as FiscalPeriod` mirror C2 precedent EXACT literal 3α homogeneous granularity per archivo)", () => {
  // hex isomorphic barrel — re-export TYPE-only alias source domain entity direct (server-only NO trigger)
  it("Test 1: modules/fiscal-periods/presentation/index.ts contains `export type { FiscalPeriodSnapshot as FiscalPeriod } from \"../domain/fiscal-period.entity\"` (POSITIVE hex isomorphic barrel TYPE-only re-export alias post-cutover Opción ε identifier-preserving)", () => {
    const src = read("modules/fiscal-periods/presentation/index.ts");
    expect(src).toMatch(
      /^export type \{ FiscalPeriodSnapshot as FiscalPeriod \} from "\.\.\/domain\/fiscal-period\.entity";$/m,
    );
  });

  // period-list.tsx
  it("Test 2: period-list.tsx contains `import type { FiscalPeriod } from \"@/modules/fiscal-periods/presentation/index\"` (POSITIVE hex isomorphic barrel TYPE-only import swap target post-cutover)", () => {
    const src = read("components/accounting/period-list.tsx");
    expect(src).toMatch(
      /^import type \{ FiscalPeriod \} from "@\/modules\/fiscal-periods\/presentation\/index";$/m,
    );
  });
  it("Test 3: period-list.tsx NO contains legacy `from \"@/features/fiscal-periods\"` (NEGATIVE legacy isomorphic barrel path drop post-cutover)", () => {
    const src = read("components/accounting/period-list.tsx");
    expect(src).not.toMatch(/from\s+"@\/features\/fiscal-periods"/);
  });
});
