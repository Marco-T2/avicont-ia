/**
 * POC nuevo monthly-close C7 RED — wholesale delete `features/monthly-close/*`
 * (17 archivos: 5 src + 12 tests __tests__/) atomic. NO bridge DROP — hex
 * barrel `modules/monthly-close/presentation/server.ts` autónomo post-C6-a +
 * C6-b cumulative cutover (factory `makeMonthlyCloseService()` +
 * `closeRequestSchema` migrated atomic, NO re-export desde features/).
 * Cumulative absorb cross-cycle 0 residual consumers post C0-C6-b verified
 * 10mo + 11mo grep gates CLEAN PROACTIVE pre-RED.
 *
 * §13.A5-ζ wholesale 5ta evidencia matures cumulative cross-POC sub-cycle
 * (paired-pr 1ra + payment 2da + contacts 3ra + fiscal-periods 4ta +
 * monthly-close 5ta NEW). Engram canonical home
 * `arch/§13/A5-zeta-classification-by-target-type` matures cumulative — NO
 * requiere re-cementación canonical home.
 *
 * Marco lock C7 Q1 (c) retirement-strategy-preserve canonical home NEW 1ra
 * evidencia POC monthly-close (paired sister `feedback/retirement-strategy-
 * mixto` fiscal-periods C7 1ra evidencia). Diferencia distinción canonical:
 *   - retirement-strategy-mixto (fiscal-periods C7): RED tests cumulative
 *     same-axis colliden con C7 deletion (assertions feature/* paths POS) →
 *     delete wholesale 5 archivos + skip+comment intra-file C1-α 2α.
 *   - retirement-strategy-preserve (monthly-close C7 NEW): 10 RED tests
 *     cumulative POC monthly-close en modules/monthly-close/__tests__/c{0,1,
 *     2.1,2.2,2.5,3,4,5,6,6-b}-*.poc-nuevo-monthly-close.test.ts asserteen
 *     hex shape (path namespace `modules/monthly-close/*`) + cutover
 *     (`app/api/.../route.ts` importa hex) — assertions POS hex side, NO
 *     collide con features/* deletion. Cross-cycle gate verified 0 path
 *     collision con C7 deletion. Tests siguen pasando post-C7 wholesale
 *     delete sin retire — preserve as-is canonical strategy variant.
 *
 * 10mo retirement-reinventory-gate-class-symbol-grep CLEAN confirmado
 * pre-RED (1ra POC contacts C4-bis + 2da POC fiscal-periods C7 + 3ra POC
 * monthly-close C7 PROACTIVE matures cumulative): grep `\bMonthlyCloseService
 * \b` PROJECT-scope → 0 residual consumers via paths legacy. Hits únicos
 * intra-feature: features/monthly-close/server.ts:2 (re-export), features/
 * monthly-close/monthly-close.service.ts:19 (class declaration), 7 archivos
 * tests features/monthly-close/__tests__/* (`import { MonthlyCloseService }
 * from "../monthly-close.service"`). Resto consumers usan
 * `makeMonthlyCloseService` factory via `@/modules/monthly-close/presentation/
 * server` HEX path post-C6-a + C6-b cumulative cutover.
 *
 * 11mo retirement-reinventory-gate-vimock-factory-grep CLEAN confirmado
 * pre-RED (1ra POC contacts C4-ter + 2da POC fiscal-periods C7 + 3ra POC
 * monthly-close C7 PROACTIVE matures cumulative): grep `vi\.mock.*@/features/
 * monthly-close` PROJECT-scope → 1 hit único intra-feature features/monthly-
 * close/__tests__/monthly-close.rbac.test.ts:29 (eliminado con wholesale
 * delete). 0 declaraciones ejecutables app/ o modules/.
 *
 * Production consumers `@/features/monthly-close/*` excl tests:
 * 0 hits real imports outside features/. Hits modules/__tests__/c6-cutover +
 * c6-b-cutover RED tests cementado son referencias textuales en docstrings/
 * comments citando legacy path — NO imports ejecutables. Cero consumers
 * cumulative absorb post C0-C6-b cumulative cutover.
 *
 * cross-cycle-red-test-cementacion-gate 10ma evidencia matures cumulative
 * cross-POC sub-cycle (9na fiscal-periods C7 retire schedule MANDATORY
 * mixto → 10ma monthly-close C7 retire schedule preserve canonical). 10 RED
 * test files cumulative en modules/monthly-close/__tests__/ assert hex shape
 * (path namespace ortogonal `modules/monthly-close/*`) — NO path collision
 * con C7 features/* deletion. Q1 (c) preserve as-is lockeado pre-RED.
 *
 * §13 hex barrel autonomy post-cutover NO bridge re-export legacy 4ta
 * evidencia matures cumulative cross-POC sub-cycle (sale + payment +
 * fiscal-periods + monthly-close NEW). Verified pre-RED Step 0:
 * `modules/monthly-close/presentation/server.ts` contains únicamente:
 *   import "server-only";
 *   export { makeMonthlyCloseService } from "./composition-root";
 *   export * from "./validation";
 * NO `export * from "@/features/monthly-close/*"` ni `export { ... } from
 * "@/features/monthly-close/server"` — autónomo post-C6-a + C6-b cumulative
 * cutover. Distinción canonical vs fiscal-periods (Opción A class identity
 * preservada via re-export bridge cementado C1-α GREEN) — monthly-close NO
 * preservó class identity, factory + schema migrated atomic C6-a + C6-b sin
 * bridge intermedio. C7 wholesale delete puro sin DROP bridge step.
 *
 * 7α single test file homogeneous granularity bisect-friendly (6 NEG file/dir
 * absent + 1 POS preservation guard explícito):
 *   - T1 NEG: features/monthly-close/server.ts file ABSENT
 *   - T2 NEG: features/monthly-close/monthly-close.service.ts file ABSENT
 *   - T3 NEG: features/monthly-close/monthly-close.repository.ts file ABSENT
 *   - T4 NEG: features/monthly-close/monthly-close.types.ts file ABSENT
 *   - T5 NEG: features/monthly-close/monthly-close.validation.ts file ABSENT
 *   - T6 NEG: features/monthly-close/__tests__ dir ABSENT (12 test files
 *     removed implicit con dir wholesale delete)
 *   - T7 POS preservation guard: modules/monthly-close/presentation/server.ts
 *     preserves canonical hex exports (makeMonthlyCloseService factory +
 *     `export * from "./validation"` re-export delegate) + modules/monthly-
 *     close/presentation/validation.ts preserves closeRequestSchema export
 *     end-to-end contract guard contra over-delete accidental durante GREEN
 *
 * Test file location modules/monthly-close/__tests__/ — target hex ownership
 * mirror precedent C0-C6-b EXACT cumulative-precedent driver-anchored
 * self-contained future-proof. Test file NO toca features/monthly-close/*
 * que GREEN borrará.
 *
 * Self-contained future-proof check: shape test asserta paths
 * `modules/monthly-close/presentation/{server,validation}.ts` que persisten
 * post-GREEN (canonical preserved + closeRequestSchema export end-to-end) +
 * 5 paths features/monthly-close/* + 1 dir features/monthly-close/__tests__
 * ABSENT verificación post wholesale delete. Test vive en
 * `modules/monthly-close/__tests__/` — NO toca features/monthly-close/* que
 * GREEN borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent C0-C6-b EXACT
 * (`fs.readFileSync` regex match + `existsSync` file/dir existence) — keep
 * pattern POC nuevo monthly-close. Target asserciones features/* paths
 * absent + canonical hex exports preserved end-to-end.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1-T5 FAIL: 5 files existen pre-GREEN — `existsSync === false`
 *     reverses (file PRESENT pre-GREEN, NEG absent assertion fails on
 *     unwanted match).
 *   - T6 FAIL: dir features/monthly-close/__tests__ existe pre-GREEN —
 *     `existsSync === false` reverses (dir PRESENT pre-GREEN, NEG absent
 *     assertion fails on unwanted match).
 *   - T7 PASS pre-GREEN (preservation guard pattern explícito divergent
 *     path declared + justified per feedback_red_acceptance_failure_mode):
 *     hex canonical exports YA presentes pre-GREEN (server.ts líneas 2-3 +
 *     validation.ts línea 3), GREEN preserves end-to-end contract durante
 *     wholesale delete. JUSTIFICACIÓN divergent path: T7 NO es deletion
 *     assertion (T1-T6 deletion puro), es preservation guard contra
 *     over-delete accidental durante GREEN — pattern preservation guard
 *     reconocido deliberately accept PASS pre-GREEN, NO silent acceptance,
 *     declared explicit + justified. Wholesale delete cycles requieren
 *     preservation guard (mirror fiscal-periods C7 T5 EXACT precedent).
 * Total expected pre-GREEN: 6 FAIL + 1 PASS (preservation guard explícito
 * justified divergent path).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-ζ wholesale (5ta evidencia matures cumulative
 *     cross-POC sub-cycle continuation post POC fiscal-periods C7 4ta)
 *   - engram `arch/§13/A5-zeta-classification-by-target-type` (canonical
 *     home matures cumulative cross-POC)
 *   - engram `feedback/retirement-reinventory-gate-class-symbol-grep` (10mo
 *     axis 3ra evidencia POC monthly-close C7 PROACTIVE CLEAN matures
 *     cumulative)
 *   - engram `feedback/retirement-reinventory-gate-vimock-factory-grep`
 *     (11mo axis 3ra evidencia POC monthly-close C7 PROACTIVE CLEAN matures
 *     cumulative)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (10ma
 *     evidencia POC monthly-close C7 retire schedule preserve canonical)
 *   - engram `feedback/retirement-strategy-preserve` (D1 NEW canonical home
 *     — preserve as-is RED tests cumulative POC monthly-close NO collide
 *     1ra evidencia POC monthly-close C7 paired sister
 *     `feedback/retirement-strategy-mixto` fiscal-periods C7 1ra evidencia)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex
 *     shape C0-C6-b — `^export ... from "\./...";$/m` anchor preservation
 *     guard)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 6/7 FAIL +
 *     1/7 PASS preservation guard explícito justified divergent path)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED commit body — §13.A5-ζ wholesale
 *     5ta matures cumulative + 10mo + 11mo grep gates CLEAN + retirement-
 *     strategy-preserve NEW canonical home + cross-cycle 10ma + hex barrel
 *     autonomy 4ta)
 *   - features/monthly-close/server.ts (target T1 — DELETE wholesale GREEN
 *     re-export `MonthlyCloseService`)
 *   - features/monthly-close/monthly-close.service.ts (target T2 — DELETE
 *     class home `MonthlyCloseService`)
 *   - features/monthly-close/monthly-close.repository.ts (target T3 — DELETE
 *     repository legacy)
 *   - features/monthly-close/monthly-close.types.ts (target T4 — DELETE
 *     types declaration)
 *   - features/monthly-close/monthly-close.validation.ts (target T5 —
 *     DELETE legacy closeRequestSchema home, canonical migrated C6-a a
 *     modules/monthly-close/presentation/validation.ts)
 *   - features/monthly-close/__tests__ (target T6 — DELETE dir wholesale 12
 *     archivos tests legacy: audit-trigger, migration.smoke, integration,
 *     rbac, repository, service.multiplicity, service.share-contract,
 *     service, service.validate-can-close, summary, types, validation)
 *   - modules/monthly-close/presentation/server.ts (target T7 POS
 *     preservation guard canonical hex exports)
 *   - modules/monthly-close/presentation/validation.ts (target T7 POS
 *     preservation guard closeRequestSchema export end-to-end contract)
 *   - modules/monthly-close/__tests__/c{0,1,2-1,2-2,2-5,3,4,5,6,6-b}-*.poc-
 *     nuevo-monthly-close.test.ts (10 RED tests cumulative POC monthly-
 *     close — Q1 (c) preserve as-is, NO retire, assertions ortogonales hex
 *     namespace cross-cycle gate verified 0 path collision)
 *   - modules/fiscal-periods/presentation/__tests__/c7-wholesale-delete-
 *     bridge-drop.poc-nuevo-fiscal-periods.test.ts (precedent EXACT mirror
 *     literal pattern shape — distinción canonical: monthly-close NO bridge
 *     DROP, retirement-strategy-preserve vs mixto)
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

describe("POC nuevo monthly-close C7 — wholesale delete features/monthly-close/* atomic 17 archivos (5 src + 12 tests dir __tests__) NO bridge DROP — hex barrel modules/monthly-close/presentation/server.ts autónomo post-C6-a + C6-b cumulative cutover (factory makeMonthlyCloseService() + closeRequestSchema migrated atomic, NO re-export desde features/ — cumulative absorb cross-cycle 0 residual consumers post C0-C6-b verified 10mo + 11mo grep gates CLEAN PROACTIVE pre-RED 7α homogeneous granularity bisect-friendly 6 NEG file/dir absent + 1 POS preservation guard explícito + retirement-strategy-preserve canonical home NEW 1ra evidencia POC monthly-close paired sister retirement-strategy-mixto fiscal-periods C7)", () => {
  // ── A: features/monthly-close/* file ABSENT (Tests 1-5) ───────────────
  // Wholesale delete 5 archivos src atomic GREEN. Cumulative absorb
  // cross-cycle 0 residual consumers verified pre-RED (10mo class symbol
  // grep CLEAN + 11mo vi.mock factory grep CLEAN).

  it("Test 1: features/monthly-close/server.ts file ABSENT (NEGATIVE wholesale delete legacy re-export barrel MonthlyCloseService post-cutover C6-a + C6-b cumulative)", () => {
    expect(exists("features/monthly-close/server.ts")).toBe(false);
  });

  it("Test 2: features/monthly-close/monthly-close.service.ts file ABSENT (NEGATIVE wholesale delete legacy class home MonthlyCloseService post-cutover hex factory makeMonthlyCloseService cementado C2.2 + C6-a)", () => {
    expect(exists("features/monthly-close/monthly-close.service.ts")).toBe(false);
  });

  it("Test 3: features/monthly-close/monthly-close.repository.ts file ABSENT (NEGATIVE wholesale delete legacy repository post-cutover hex adapters cementados C3 prisma-monthly-close-summary-reader.adapter + draft-documents-reader.adapter + period-locking-writer.adapter + accounting-reader.adapter + fiscal-period-reader.adapter)", () => {
    expect(exists("features/monthly-close/monthly-close.repository.ts")).toBe(false);
  });

  it("Test 4: features/monthly-close/monthly-close.types.ts file ABSENT (NEGATIVE wholesale delete legacy types declaration post-cutover hex domain types cementados C1)", () => {
    expect(exists("features/monthly-close/monthly-close.types.ts")).toBe(false);
  });

  it("Test 5: features/monthly-close/monthly-close.validation.ts file ABSENT (NEGATIVE wholesale delete legacy closeRequestSchema home post-cutover canonical migrated C6-a a modules/monthly-close/presentation/validation.ts)", () => {
    expect(exists("features/monthly-close/monthly-close.validation.ts")).toBe(false);
  });

  // ── B: features/monthly-close/__tests__ dir ABSENT (Test 6) ───────────
  // Wholesale delete dir tests legacy 12 archivos atomic GREEN.

  it("Test 6: features/monthly-close/__tests__ dir ABSENT (NEGATIVE wholesale delete legacy tests dir 12 archivos: audit-trigger, migration.smoke, integration, rbac, repository, service.multiplicity, service.share-contract, service, service.validate-can-close, summary, types, validation post-cutover hex tests cementados modules/monthly-close/__tests__/ + modules/monthly-close/infrastructure/__tests__/)", () => {
    expect(exists("features/monthly-close/__tests__")).toBe(false);
  });

  // ── C: Hex barrel canonical exports preservation guard (Test 7) ──────
  // T7 POS preservation guard pattern explícito (failure mode divergent path
  // declared + justified per feedback/red-acceptance-failure-mode): assert
  // canonical hex exports preserved durante GREEN wholesale delete — guard
  // contra over-delete accidental (factory + validation re-export delegate
  // + closeRequestSchema declaration end-to-end contract). PASS pre-GREEN
  // explícito deliberately accepted preservation guard pattern, NO silent
  // acceptance. Mirror fiscal-periods C7 T5 EXACT precedent.

  it("Test 7: modules/monthly-close/presentation/server.ts preserves canonical hex exports (POSITIVE preservation guard end-to-end — makeMonthlyCloseService factory + export * from validation re-export delegate + closeRequestSchema declaration en validation.ts PASS pre-GREEN deliberately accepted preservation guard pattern mirror fiscal-periods C7 T5 EXACT)", () => {
    const serverSrc = read("modules/monthly-close/presentation/server.ts");
    expect(serverSrc).toMatch(
      /^export \{ makeMonthlyCloseService \} from "\.\/composition-root";$/m,
    );
    expect(serverSrc).toMatch(/^export \* from "\.\/validation";$/m);

    const validationSrc = read("modules/monthly-close/presentation/validation.ts");
    expect(validationSrc).toMatch(
      /^export const closeRequestSchema = z\.object\(\{$/m,
    );
  });
});
