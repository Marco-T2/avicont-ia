/**
 * POC paired farms+lots C4 RED — cutover routes API farms hex factory invocation
 * + schemas import path swap (paired-farm side, paired sister mirror lot).
 *
 * Axis: cutover invocation patterns from legacy class ctor `new FarmsService()`
 * → hex factory `makeFarmService()` + schemas import path swap legacy
 * `@/features/farms` → hex `@/modules/farm/presentation/{server,validation}`
 * in 2 source archivos farms (1 list/create route + 1 [farmId] GET/PATCH/DELETE
 * route). Marco lock D1 Opt C ADDITIVE NEW método paralelo strategy cementado
 * pre-RED-α — preserva 6 cross-feature legacy consumers intactos defer sub-cycles
 * respectivos (AI-agent C6 + pricing sub-cycle posterior + mortality C6 MOVE
 * port + 3 pages C5 separate). Auth pattern legacy preserved EXACT mirror
 * Marco lock D2 Opt B (requireAuth+requireOrgAccess returning organizationId
 * directly — RBAC migration cross-POC out-of-scope per `feedback/farm-lot-routes-
 * auth-pattern-legacy-vs-canonical-require-permission-cleanup-pending` 13mo
 * cumulative cross-POC).
 *
 * Asymmetry vs paired sister payables/receivables C3-C4 cutover precedent EXACT
 * mirror — group B `attachContact[s]` bridge NO aplica este POC paired farms+lots
 * per §13 NEW `farm-presentation-no-bridge-vs-payables-receivables-bridge-attach-contact-axis-distinct`
 * cementado C3 (#1839 1ra evidencia matures) — Farm+Lot self-contained domain NO
 * Contact attach DTO contract preservation requerida. Group D vi.mock §13.A4-η
 * NO aplica este POC — zero existing route.test.ts farms+lots verified Step 0
 * expand recon (NO direct-consumer-tests cascade scope C4).
 *
 * 2 source archivos cutover INCLUIDOS Marco lock D3 split RED-α + GREEN cumulative
 * atomic paired sister C0/C1/C2/C3 EXACT precedent:
 *   1. app/api/organizations/[orgSlug]/farms/route.ts (GET list + POST create — 2 callsites)
 *   2. app/api/organizations/[orgSlug]/farms/[farmId]/route.ts (GET + PATCH + DELETE — 3 callsites)
 *
 * Marco lock final RED scope C4 (6 assertions α paired-farm side — paired sister
 * mirror lot 6 assertions = 12 paired total Marco approved pre-RED-α):
 *
 *   ── A: Hex factory import POSITIVE (Tests α1, α3) ──
 *     α1 farms/route.ts imports `makeFarmService` from `@/modules/farm/presentation/server`
 *     α3 farms/[farmId]/route.ts imports `makeFarmService` from `@/modules/farm/presentation/server`
 *
 *   ── B: Hex schema import POSITIVE (Tests α2, α4) ──
 *     α2 farms/route.ts imports `createFarmSchema` from `@/modules/farm/presentation/{server,validation}`
 *     α4 farms/[farmId]/route.ts imports `updateFarmSchema` from `@/modules/farm/presentation/{server,validation}`
 *
 *   ── C: Legacy class+schema import ABSENT (Tests α5, α6) ──
 *     α5 farms/route.ts does NOT import from `@/features/farms/server` NOR `@/features/farms`
 *     α6 farms/[farmId]/route.ts does NOT import from `@/features/farms/server` NOR `@/features/farms`
 *
 * Expected RED failure mode pre-GREEN per `feedback_red_acceptance_failure_mode`:
 *   - α1, α3 FAIL behavioral assertion mismatch — source archivos hoy importan
 *     `import { FarmsService } from "@/features/farms/server"` legacy class.
 *     Regex `^import...makeFarmService...from "@/modules/farm/presentation/server"`
 *     match falla.
 *   - α2, α4 FAIL behavioral assertion mismatch — source archivos hoy importan
 *     `import { createFarmSchema|updateFarmSchema } from "@/features/farms"` legacy
 *     barrel. Regex hex path match falla.
 *   - α5, α6 FAIL behavioral assertion mismatch — source archivos hoy importan
 *     legacy paths. `not.toMatch` legacy import path expectation reverses (legacy
 *     PRESENT pre-cutover). Test fails on unwanted match.
 * Total expected FAIL pre-GREEN: 6/6 farm side (paired sister 6/6 lot = 12/12 total
 * cumulative cross-POC `feedback_enumerated_baseline_failure_ledger` 14ma matures).
 *
 * Self-contained future-proof check: shape test asserta paths
 * `app/api/organizations/[orgSlug]/farms/...` que persisten post C7 wholesale delete
 * `features/farms/`. Test vive en `modules/farm/presentation/__tests__/` — NO toca
 * `features/farms/*` que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Cross-ref:
 *   - engram `poc-paired-farms-lots/c3/closed` #1838 (cycle-start bookmark C4 heredado)
 *   - engram `arch/§13/farm-presentation-no-bridge-vs-payables-receivables-bridge-attach-contact-axis-distinct` #1839 (C3 1ra evidencia matures — group B bridge NO aplica este POC)
 *   - engram `arch/§13/asymmetric-auth-pattern-legacy-preserve-vs-canonical-require-permission` (C4 1ra evidencia matures — auth legacy preserved D2 Opt B)
 *   - engram `feedback/evidence-supersedes-assumption-lock` (17ma matures — cross-feature consumers magnitude Step 0 expand evidence superseded bookmark estimación)
 *   - engram `feedback/farm-lot-find-all-legacy-vs-hex-factory-dual-method-cleanup-pending` (12mo cumulative cross-POC — ADDITIVE strategy preserva 6 legacy consumers defer sub-cycles)
 *   - engram `feedback/farm-lot-routes-auth-pattern-legacy-vs-canonical-require-permission-cleanup-pending` (13mo cumulative cross-POC — auth pattern legacy preserved D2)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 6/6 enumerated behavioral assertion mismatch)
 *   - engram `feedback_red_regex_discipline` (^import...m anchor + ?? optional Marco lock convention preserved)
 *   - engram `feedback_enumerated_baseline_failure_ledger` (14ma matures cumulative cross-POC per-α explicit ledger)
 *   - modules/payables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts (paired sister precedent EXACT mirror cumulative cross-POC — groups A/C structure preserved, B bridge omitted, D vi.mock omitted)
 *   - app/api/organizations/[orgSlug]/farms/route.ts (target list+create cutover — 2 callsites)
 *   - app/api/organizations/[orgSlug]/farms/[farmId]/route.ts (target getById+update+delete cutover — 3 callsites)
 *   - modules/farm/presentation/server.ts (hex barrel re-exports `makeFarmService` + schemas — consumer surface ready post-C3 cementado)
 *   - modules/farm/presentation/validation.ts (hex schemas createFarmSchema + updateFarmSchema cementado C3)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C4 cutover targets (2 archivos paired-farm side) ──

const FARMS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/farms/route.ts",
);
const FARMS_BY_ID_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/farms/[farmId]/route.ts",
);

// ── Regex patterns (positive ^import...m anchor + negative legacy not.toMatch) ──

const IMPORT_MAKE_FARM_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeFarmService\b[^}]*\}\s*from\s*["']@\/modules\/farm\/presentation\/server["']/m;
const IMPORT_CREATE_FARM_SCHEMA_HEX_RE =
  /^import\s*\{[^}]*\bcreateFarmSchema\b[^}]*\}\s*from\s*["']@\/modules\/farm\/presentation\/(server|validation)["']/m;
const IMPORT_UPDATE_FARM_SCHEMA_HEX_RE =
  /^import\s*\{[^}]*\bupdateFarmSchema\b[^}]*\}\s*from\s*["']@\/modules\/farm\/presentation\/(server|validation)["']/m;
const LEGACY_FEATURES_FARMS_IMPORT_RE =
  /from\s+["']@\/features\/farms(?:\/server)?["']/;

describe("POC paired farms+lots C4 — cutover routes API farms hex factory + schemas shape (paired-farm side, Marco lock D1 Opt C ADDITIVE NEW método paralelo + D2 Opt B auth legacy preserved + D3 split RED-α/GREEN paired sister C0/C1/C2/C3 EXACT precedent)", () => {
  // ── A: Hex factory import POSITIVE (α1, α3) ─────────────────────────────

  it("α1: app/api/organizations/[orgSlug]/farms/route.ts imports `makeFarmService` from `@/modules/farm/presentation/server` (list+create — 2 callsites cutover Path α direct factory swap mecánico)", () => {
    const source = fs.readFileSync(FARMS_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_FARM_SERVICE_HEX_RE);
  });

  it("α3: app/api/organizations/[orgSlug]/farms/[farmId]/route.ts imports `makeFarmService` from `@/modules/farm/presentation/server` (getById+update+delete — 3 callsites)", () => {
    const source = fs.readFileSync(FARMS_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_FARM_SERVICE_HEX_RE);
  });

  // ── B: Hex schema import POSITIVE (α2, α4) ──────────────────────────────

  it("α2: app/api/organizations/[orgSlug]/farms/route.ts imports `createFarmSchema` from `@/modules/farm/presentation/{server|validation}` (POST create body parse)", () => {
    const source = fs.readFileSync(FARMS_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_CREATE_FARM_SCHEMA_HEX_RE);
  });

  it("α4: app/api/organizations/[orgSlug]/farms/[farmId]/route.ts imports `updateFarmSchema` from `@/modules/farm/presentation/{server|validation}` (PATCH update body parse)", () => {
    const source = fs.readFileSync(FARMS_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_UPDATE_FARM_SCHEMA_HEX_RE);
  });

  // ── C: Legacy class+schema import ABSENT (α5, α6) ───────────────────────

  it("α5: app/api/organizations/[orgSlug]/farms/route.ts does NOT import from `@/features/farms` NOR `@/features/farms/server` (legacy class+schema imports dropped post-cutover, ADDITIVE preserves features/farms/* intactos hasta C7 wholesale delete)", () => {
    const source = fs.readFileSync(FARMS_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_FARMS_IMPORT_RE);
  });

  it("α6: app/api/organizations/[orgSlug]/farms/[farmId]/route.ts does NOT import from `@/features/farms` NOR `@/features/farms/server` (legacy class+schema imports dropped post-cutover, ADDITIVE preserves features/farms/* intactos hasta C7 wholesale delete)", () => {
    const source = fs.readFileSync(FARMS_BY_ID_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_FARMS_IMPORT_RE);
  });
});
