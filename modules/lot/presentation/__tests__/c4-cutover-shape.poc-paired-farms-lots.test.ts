/**
 * POC paired farms+lots C4 RED — cutover routes API lots hex factory invocation
 * + schemas import path swap (paired-lot side, paired sister mirror farm).
 *
 * Axis: cutover invocation patterns from legacy class ctor `new LotsService()`
 * → hex factory `makeLotService()` + schemas import path swap legacy
 * `@/features/lots` → hex `@/modules/lot/presentation/{server,validation}`
 * in 2 source archivos lots (1 list/create + farmId-filter route + 1 [lotId]
 * GET getSummary/PATCH close route). Marco lock D1 Opt C ADDITIVE NEW método
 * paralelo strategy cementado pre-RED-α — preserva 6 cross-feature legacy
 * consumers intactos defer sub-cycles respectivos (AI-agent C6 + pricing
 * sub-cycle posterior + mortality C6 MOVE port + 3 pages C5 separate). Auth
 * pattern legacy preserved EXACT mirror Marco lock D2 Opt B (requireAuth+
 * requireOrgAccess returning organizationId directly — RBAC migration cross-POC
 * out-of-scope per `feedback/farm-lot-routes-auth-pattern-legacy-vs-canonical-
 * require-permission-cleanup-pending` 13mo cumulative cross-POC + Resource
 * `"lots"` ausente en `features/permissions/permissions.ts` PERMISSIONS_READ
 * + PERMISSIONS_WRITE — Resource expansion out-of-POC scope).
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
 *   1. app/api/organizations/[orgSlug]/lots/route.ts (GET list/listByFarm + POST create — 2 callsites)
 *   2. app/api/organizations/[orgSlug]/lots/[lotId]/route.ts (GET getSummary + PATCH close — 2 callsites)
 *
 * Marco lock final RED scope C4 (6 assertions α paired-lot side — paired sister
 * mirror farm 6 assertions = 12 paired total Marco approved pre-RED-α):
 *
 *   ── A: Hex factory import POSITIVE (Tests α7, α9) ──
 *     α7 lots/route.ts imports `makeLotService` from `@/modules/lot/presentation/server`
 *     α9 lots/[lotId]/route.ts imports `makeLotService` from `@/modules/lot/presentation/server`
 *
 *   ── B: Hex schema import POSITIVE (Tests α8, α10) ──
 *     α8 lots/route.ts imports `createLotSchema` from `@/modules/lot/presentation/{server,validation}`
 *     α10 lots/[lotId]/route.ts imports `closeLotSchema` from `@/modules/lot/presentation/{server,validation}`
 *
 *   ── C: Legacy class+schema import ABSENT (Tests α11, α12) ──
 *     α11 lots/route.ts does NOT import from `@/features/lots/server` NOR `@/features/lots`
 *     α12 lots/[lotId]/route.ts does NOT import from `@/features/lots/server` NOR `@/features/lots`
 *
 * Expected RED failure mode pre-GREEN per `feedback_red_acceptance_failure_mode`:
 *   - α7, α9 FAIL behavioral assertion mismatch — source archivos hoy importan
 *     `import { LotsService } from "@/features/lots/server"` legacy class.
 *     Regex `^import...makeLotService...from "@/modules/lot/presentation/server"`
 *     match falla.
 *   - α8, α10 FAIL behavioral assertion mismatch — source archivos hoy importan
 *     `import { createLotSchema|closeLotSchema } from "@/features/lots"` legacy
 *     barrel. Regex hex path match falla.
 *   - α11, α12 FAIL behavioral assertion mismatch — source archivos hoy importan
 *     legacy paths. `not.toMatch` legacy import path expectation reverses (legacy
 *     PRESENT pre-cutover). Test fails on unwanted match.
 * Total expected FAIL pre-GREEN: 6/6 lot side (paired sister 6/6 farm = 12/12 total
 * cumulative cross-POC `feedback_enumerated_baseline_failure_ledger` 14ma matures).
 *
 * Self-contained future-proof check: shape test asserta paths
 * `app/api/organizations/[orgSlug]/lots/...` que persisten post C7 wholesale delete
 * `features/lots/`. Test vive en `modules/lot/presentation/__tests__/` — NO toca
 * `features/lots/*` que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Cross-ref:
 *   - engram `poc-paired-farms-lots/c3/closed` #1838 (cycle-start bookmark C4 heredado)
 *   - engram `arch/§13/farm-presentation-no-bridge-vs-payables-receivables-bridge-attach-contact-axis-distinct` #1839 (C3 1ra evidencia matures — group B bridge NO aplica este POC)
 *   - engram `arch/§13/asymmetric-auth-pattern-legacy-preserve-vs-canonical-require-permission` (C4 1ra evidencia matures — auth legacy preserved D2 Opt B + Resource "lots" ausente)
 *   - engram `feedback/evidence-supersedes-assumption-lock` (17ma matures — cross-feature consumers magnitude Step 0 expand evidence superseded bookmark estimación)
 *   - engram `feedback/farm-lot-find-all-legacy-vs-hex-factory-dual-method-cleanup-pending` (12mo cumulative cross-POC — ADDITIVE strategy preserva 6 legacy consumers defer sub-cycles)
 *   - engram `feedback/farm-lot-routes-auth-pattern-legacy-vs-canonical-require-permission-cleanup-pending` (13mo cumulative cross-POC — auth pattern legacy preserved D2)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 6/6 enumerated behavioral assertion mismatch)
 *   - engram `feedback_red_regex_discipline` (^import...m anchor + ?? optional Marco lock convention preserved)
 *   - engram `feedback_enumerated_baseline_failure_ledger` (14ma matures cumulative cross-POC per-α explicit ledger)
 *   - modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts (paired sister precedent EXACT mirror cumulative cross-POC — groups A/C structure preserved, B bridge omitted, D vi.mock omitted)
 *   - app/api/organizations/[orgSlug]/lots/route.ts (target list/listByFarm+create cutover — 2 callsites)
 *   - app/api/organizations/[orgSlug]/lots/[lotId]/route.ts (target getSummary+close cutover — 2 callsites)
 *   - modules/lot/presentation/server.ts (hex barrel re-exports `makeLotService` + schemas — consumer surface ready post-C3 cementado)
 *   - modules/lot/presentation/validation.ts (hex schemas createLotSchema + closeLotSchema cementado C3, farmId.cuid() preserved D5 lock)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C4 cutover targets (2 archivos paired-lot side) ──

const LOTS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/lots/route.ts",
);
const LOTS_BY_ID_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/lots/[lotId]/route.ts",
);

// ── Regex patterns (positive ^import...m anchor + negative legacy not.toMatch) ──

const IMPORT_MAKE_LOT_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeLotService\b[^}]*\}\s*from\s*["']@\/modules\/lot\/presentation\/server["']/m;
const IMPORT_CREATE_LOT_SCHEMA_HEX_RE =
  /^import\s*\{[^}]*\bcreateLotSchema\b[^}]*\}\s*from\s*["']@\/modules\/lot\/presentation\/(server|validation)["']/m;
const IMPORT_CLOSE_LOT_SCHEMA_HEX_RE =
  /^import\s*\{[^}]*\bcloseLotSchema\b[^}]*\}\s*from\s*["']@\/modules\/lot\/presentation\/(server|validation)["']/m;
const LEGACY_FEATURES_LOTS_IMPORT_RE =
  /from\s+["']@\/features\/lots(?:\/server)?["']/;

describe("POC paired farms+lots C4 — cutover routes API lots hex factory + schemas shape (paired-lot side, Marco lock D1 Opt C ADDITIVE NEW método paralelo + D2 Opt B auth legacy preserved + D3 split RED-α/GREEN paired sister C0/C1/C2/C3 EXACT precedent)", () => {
  // ── A: Hex factory import POSITIVE (α7, α9) ─────────────────────────────

  it("α7: app/api/organizations/[orgSlug]/lots/route.ts imports `makeLotService` from `@/modules/lot/presentation/server` (list/listByFarm+create — 2 callsites cutover Path α direct factory swap mecánico)", () => {
    const source = fs.readFileSync(LOTS_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_LOT_SERVICE_HEX_RE);
  });

  it("α9: app/api/organizations/[orgSlug]/lots/[lotId]/route.ts imports `makeLotService` from `@/modules/lot/presentation/server` (getSummary+close — 2 callsites)", () => {
    const source = fs.readFileSync(LOTS_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_LOT_SERVICE_HEX_RE);
  });

  // ── B: Hex schema import POSITIVE (α8, α10) ─────────────────────────────

  it("α8: app/api/organizations/[orgSlug]/lots/route.ts imports `createLotSchema` from `@/modules/lot/presentation/{server|validation}` (POST create body parse)", () => {
    const source = fs.readFileSync(LOTS_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_CREATE_LOT_SCHEMA_HEX_RE);
  });

  it("α10: app/api/organizations/[orgSlug]/lots/[lotId]/route.ts imports `closeLotSchema` from `@/modules/lot/presentation/{server|validation}` (PATCH close body parse)", () => {
    const source = fs.readFileSync(LOTS_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(IMPORT_CLOSE_LOT_SCHEMA_HEX_RE);
  });

  // ── C: Legacy class+schema import ABSENT (α11, α12) ─────────────────────

  it("α11: app/api/organizations/[orgSlug]/lots/route.ts does NOT import from `@/features/lots` NOR `@/features/lots/server` (legacy class+schema imports dropped post-cutover, ADDITIVE preserves features/lots/* intactos hasta C7 wholesale delete)", () => {
    const source = fs.readFileSync(LOTS_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_LOTS_IMPORT_RE);
  });

  it("α12: app/api/organizations/[orgSlug]/lots/[lotId]/route.ts does NOT import from `@/features/lots` NOR `@/features/lots/server` (legacy class+schema imports dropped post-cutover, ADDITIVE preserves features/lots/* intactos hasta C7 wholesale delete)", () => {
    const source = fs.readFileSync(LOTS_BY_ID_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_LOTS_IMPORT_RE);
  });
});
