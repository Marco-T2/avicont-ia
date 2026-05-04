/**
 * POC nuevo A4-C1 — org-settings consumers cutover shape (Path α'' atomic
 * Cat 1 + Cat 2 merged). Cutover from `@/features/org-settings(/server)` shim
 * legacy (0-args + snapshot POJO) → `@/modules/org-settings/presentation(/server)`
 * factory hex (`makeOrgSettingsService()` + `entity.toSnapshot()` adapter
 * explicit). vi.mock factory paired hygiene swap atomic mismo commit.
 *
 * Axis: cutover atomic batch 5 app pages + 1 api route (Cat 1) + 4 page-rbac
 * vi.mock factory (Cat 2) — Path α'' merge ratificado por §12 latent path
 * coverage discovery pre-RED (vi.mock factory load-bearing render path NO
 * orphan suposición bookmark). Cat 3 cross-feature/cross-module DEFERRED
 * A4-C2 single-batch atomic.
 *
 * 7 imports cutover scope Cat 1 (verificados Step 0 #1565 + runtime fresh):
 *   - 5 pages × 1 import each:
 *       app/(dashboard)/[orgSlug]/settings/general/page.tsx (L5,9 module-scope)
 *       app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx (L8,32)
 *       app/(dashboard)/[orgSlug]/payments/new/page.tsx (L7,33)
 *       app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx (L7,31)
 *       app/(dashboard)/[orgSlug]/dispatches/new/page.tsx (L6,37)
 *   - 1 api route × 2 imports:
 *       app/api/organizations/[orgSlug]/settings/route.ts (L3 service +
 *         L4 schema barrel + L6 module-scope new)
 *
 * 4 vi.mock factory cutover scope Cat 2 (load-bearing render path):
 *   - app/(dashboard)/[orgSlug]/payments/new/__tests__/page-rbac.test.ts L60-65
 *   - app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts L74-79
 *   - app/(dashboard)/[orgSlug]/dispatches/new/__tests__/page-rbac.test.ts L51-56
 *   - app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts L60-65
 *
 * Marco lock α final RED scope (30 assertions):
 *   ── Cat 1 source cutover (Tests 1-18) ──
 *   - Tests 1-7 POSITIVE hex import present:
 *       T1-T5 (5 pages): `from "@/modules/org-settings/presentation/server"`
 *       T6 (api route service): `from "@/modules/org-settings/presentation/server"`
 *       T7 (api route schema): `from "@/modules/org-settings/presentation"` (barrel)
 *   - Tests 8-14 NEGATIVE legacy import absent:
 *       T8-T12 (5 pages): NO `from "@/features/org-settings/server"`
 *       T13 (api route): NO `from "@/features/org-settings/server"`
 *       T14 (api route): NO `from "@/features/org-settings"` exact barrel
 *   - Tests 15-16 POSITIVE makeOrgSettingsService callsite (no `new`):
 *       T15 (api route): contains `makeOrgSettingsService()` AND NOT
 *         `new OrgSettingsService()`
 *       T16 (settings/general page): same shape
 *   - Tests 17-18 POSITIVE runtime path coverage `.toSnapshot()` adapter
 *     (lección #12 PROACTIVE 5ta evidencia + §13.A4-α DTO divergence):
 *       T17 (api route GET handler body): contains `.toSnapshot()`
 *       T18 (api route PATCH handler body): contains `.toSnapshot()`
 *
 *   ── Cat 2 vi.mock factory cutover (Tests 19-30) ──
 *   - Tests 19-22 POSITIVE vi.mock target hex (4 page-rbac tests):
 *       contains `vi.mock("@/modules/org-settings/presentation/server"`
 *   - Tests 23-26 NEGATIVE vi.mock target legacy absent (4 page-rbac tests):
 *       NO `vi.mock("@/features/org-settings/server"`
 *   - Tests 27-30 POSITIVE mock factory shape adapter (4 page-rbac tests):
 *       contains `makeOrgSettingsService:` named export key (sub-axis material
 *       drafting per Marco mandate — RED contract honesto incluye TODO
 *       cutover atomic, NO defer GREEN-only)
 *
 * §13.A4-α DTO divergence cementado pre-RED (#1565): shim retorna
 * `OrgSettingsSnapshot` POJO via `entity.toSnapshot()` post-call; hex
 * `OrgSettingsService.getOrCreate/update` retorna `OrgSettings` entity.
 * Cutover requiere `.toSnapshot()` adapter explicit. Crítico api route —
 * `Response.json(entity)` serializa `{ props: {...} }` ≠ snapshot plano
 * shim, rompe contrato API si NO se adapta. Mirror precedent §13.T sale
 * línea 787 verified textual literal.
 *
 * §13.A4-β callers no-args cementado pre-RED (#1565): 6 app callers +
 * 2 cross-feature callers + 1 cross-module adapter caller = 9 callers
 * `new OrgSettingsService()` 0-args. Hex class signature
 * `new OrgSettingsService(repo, accountLookup)` 2-args. Cutover requiere
 * `makeOrgSettingsService()` factory composition-root. Cat 1 cubre 6/9
 * callers; A4-C2 cubre los 3 restantes single-batch atomic.
 *
 * §13.A4-η cementado este RED commit body (5ta evidencia paired sister
 * cumulative §11/§12 cross-evidence formal — vi.mock factory load-bearing
 * NO orphan): bookmark suposición Cat 1/Cat 2 separación independiente
 * (Opción α' previo) colide invariante mock-import path coupling. Step 0
 * PROACTIVE pre-RED descubrió render path coverage runtime — 4 test cases
 * "renders when requirePermission resolves" llegan al `getOrCreate` mock
 * intercept; sin Cat 2 paired atomic Cat 1 GREEN romperia 4 tests post-
 * cutover (real Prisma DB error en test env). Resolución Path α'' merge
 * atomic. Cumulative 5 §13 emergentes A4: §13.A4-α/β/γ/δ/ε pre-RED + η
 * post-RED commit body.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T7 FAIL: pages + api route todavía importan `@/features/org-settings(/server)`,
 *   regex match `@/modules/org-settings/presentation(/server)` falla.
 * - T8-T14 FAIL: legacy imports presentes, regex match negativo no se cumple
 *   (assertion `not.toMatch` falla).
 * - T15-T16 FAIL: `new OrgSettingsService()` callsites todavía presentes
 *   y `makeOrgSettingsService()` ausente.
 * - T17-T18 FAIL: `.toSnapshot()` ausente en GET/PATCH handler bodies.
 * - T19-T22 FAIL: vi.mock target hex ausente.
 * - T23-T26 FAIL: vi.mock target legacy presente.
 * - T27-T30 FAIL: mock factory shape `makeOrgSettingsService:` ausente.
 * Total expected FAIL pre-GREEN: 30/30 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta
 * paths que persisten post A4-C3 atomic delete `features/org-settings/`
 * wholesale. NO toca `features/org-settings/*` que A4-C3 borra. Self-
 * contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror `c2-cutover-shape.poc-nuevo-a3.test.ts`
 * + `c7-legacy-sale-deletion-shape.poc-nuevo-a3.test.ts`.
 *
 * Cross-ref:
 *   - architecture.md §13.7 #10/#11/#12/#13 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A4-α DTO divergence (cementación pre-RED #1565)
 *   - architecture.md §13.A4-β callers no-args (cementación pre-RED #1565)
 *   - engram bookmark `poc-futuro/a4-org-settings/pre-recon-comprehensive` (#1565)
 *   - engram bookmark `poc-nuevo/a4/pre-recon-comprehensive` (#1564)
 *   - engram `poc-nuevo/a3/closed` (#1562) baseline runtime hereda A4
 *   - modules/org-settings/presentation/server.ts (hex barrel cutover target)
 *   - modules/org-settings/presentation/composition-root.ts (factory)
 *   - modules/org-settings/domain/org-settings.entity.ts (toSnapshot 18 fields)
 *   - modules/purchase/presentation/__tests__/c2-cutover-shape.poc-nuevo-a3.test.ts (precedent shape)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 1 source cutover targets ─────────────────────────────────────────────

const PAGE_SETTINGS_GENERAL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/settings/general/page.tsx",
);
const PAGE_PAYMENT_DETAIL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx",
);
const PAGE_PAYMENT_NEW = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/new/page.tsx",
);
const PAGE_DISPATCH_DETAIL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx",
);
const PAGE_DISPATCH_NEW = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/dispatches/new/page.tsx",
);
const API_ROUTE_SETTINGS = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/settings/route.ts",
);

// ── Cat 2 vi.mock factory cutover targets (page-rbac tests) ──────────────────

const RBAC_PAYMENT_NEW = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/new/__tests__/page-rbac.test.ts",
);
const RBAC_PAYMENT_DETAIL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts",
);
const RBAC_DISPATCH_NEW = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/dispatches/new/__tests__/page-rbac.test.ts",
);
const RBAC_DISPATCH_DETAIL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/org-settings\/presentation\/server["']/;
const HEX_PRESENTATION_BARREL_RE =
  /from\s*["']@\/modules\/org-settings\/presentation["']/;
const LEGACY_SERVER_RE = /from\s*["']@\/features\/org-settings\/server["']/;
const LEGACY_BARREL_RE = /from\s*["']@\/features\/org-settings["']/;

const MAKE_FACTORY_RE = /makeOrgSettingsService\(\)/;
const NEW_LEGACY_CTOR_RE = /new\s+OrgSettingsService\s*\(\s*\)/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;

const VI_MOCK_HEX_RE = /vi\.mock\(\s*["']@\/modules\/org-settings\/presentation\/server["']/;
const VI_MOCK_LEGACY_RE = /vi\.mock\(\s*["']@\/features\/org-settings\/server["']/;
const MAKE_FACTORY_KEY_RE = /makeOrgSettingsService\s*:/;

describe("POC nuevo A4-C1 — org-settings consumers cutover shape (Path α'' atomic Cat 1 + Cat 2)", () => {
  // ── POSITIVE Cat 1 source-shape (Tests 1-7) — hex import present ───────────

  it("Test 1: page settings/general imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_SETTINGS_GENERAL, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: page payments/[paymentId] imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_PAYMENT_DETAIL, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 3: page payments/new imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_PAYMENT_NEW, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 4: page dispatches/[dispatchId] imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_DISPATCH_DETAIL, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 5: page dispatches/new imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_DISPATCH_NEW, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 6: api route imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(API_ROUTE_SETTINGS, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 7: api route imports updateOrgSettingsSchema from hex presentation barrel", () => {
    const source = fs.readFileSync(API_ROUTE_SETTINGS, "utf8");
    expect(source).toMatch(HEX_PRESENTATION_BARREL_RE);
  });

  // ── NEGATIVE Cat 1 source-shape (Tests 8-14) — legacy import absent ────────
  // Future-proof contra accidental re-import legacy shim. NO toca
  // features/dispatch/dispatch.service.ts + features/ai-agent/tools/find-accounts.ts
  // + modules/payment/infrastructure/adapters/legacy-org-settings.adapter.ts
  // (A4-C2 cleanup scope deferred — Cat 3 cross-feature/cross-module).

  it("Test 8: page settings/general does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(PAGE_SETTINGS_GENERAL, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 9: page payments/[paymentId] does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(PAGE_PAYMENT_DETAIL, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 10: page payments/new does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(PAGE_PAYMENT_NEW, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 11: page dispatches/[dispatchId] does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(PAGE_DISPATCH_DETAIL, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 12: page dispatches/new does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(PAGE_DISPATCH_NEW, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 13: api route does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(API_ROUTE_SETTINGS, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 14: api route does NOT import from legacy @/features/org-settings barrel exact", () => {
    const source = fs.readFileSync(API_ROUTE_SETTINGS, "utf8");
    expect(source).not.toMatch(LEGACY_BARREL_RE);
  });

  // ── POSITIVE Cat 1 callsite (Tests 15-16) — makeOrgSettingsService factory ─
  // §13.A4-β callers no-args resolution: 0-args `new OrgSettingsService()`
  // → factory `makeOrgSettingsService()` composition-root pattern.

  it("Test 15: api route uses makeOrgSettingsService() factory and NOT new OrgSettingsService()", () => {
    const source = fs.readFileSync(API_ROUTE_SETTINGS, "utf8");
    expect(source).toMatch(MAKE_FACTORY_RE);
    expect(source).not.toMatch(NEW_LEGACY_CTOR_RE);
  });

  it("Test 16: page settings/general uses makeOrgSettingsService() factory and NOT new OrgSettingsService()", () => {
    const source = fs.readFileSync(PAGE_SETTINGS_GENERAL, "utf8");
    expect(source).toMatch(MAKE_FACTORY_RE);
    expect(source).not.toMatch(NEW_LEGACY_CTOR_RE);
  });

  // ── POSITIVE Cat 1 runtime path coverage (Tests 17-18) — `.toSnapshot()` ──
  // §13.A4-α DTO divergence resolution: hex retorna `OrgSettings` entity;
  // shim retornaba `OrgSettingsSnapshot` POJO. Cutover requiere
  // `.toSnapshot()` adapter post-call EN api route GET+PATCH para
  // preservar shape `Response.json(snapshot)` contrato API. Lección #12
  // PROACTIVE 5ta evidencia (runtime path coverage RED scope).

  it("Test 17: api route GET handler body contains `.toSnapshot()` adapter call", () => {
    const source = fs.readFileSync(API_ROUTE_SETTINGS, "utf8");
    const getStart = source.indexOf("export async function GET(");
    const patchStart = source.indexOf("export async function PATCH(");
    expect(getStart).toBeGreaterThanOrEqual(0);
    expect(patchStart).toBeGreaterThan(getStart);
    const getBody = source.slice(getStart, patchStart);
    expect(getBody).toMatch(TO_SNAPSHOT_RE);
  });

  it("Test 18: api route PATCH handler body contains `.toSnapshot()` adapter call", () => {
    const source = fs.readFileSync(API_ROUTE_SETTINGS, "utf8");
    const patchStart = source.indexOf("export async function PATCH(");
    expect(patchStart).toBeGreaterThanOrEqual(0);
    const patchBody = source.slice(patchStart);
    expect(patchBody).toMatch(TO_SNAPSHOT_RE);
  });

  // ── POSITIVE Cat 2 vi.mock target (Tests 19-22) — hex path ────────────────
  // §13.A4-η cementación: vi.mock factory load-bearing render path coverage
  // (Step 0 PROACTIVE descubrió mock-import path coupling — Cat 1/Cat 2
  // estructuralmente acoplados, Path α'' atomic merge).

  it("Test 19: page-rbac payments/new vi.mock targets hex @/modules/org-settings/presentation/server", () => {
    const source = fs.readFileSync(RBAC_PAYMENT_NEW, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 20: page-rbac payments/[paymentId] vi.mock targets hex @/modules/org-settings/presentation/server", () => {
    const source = fs.readFileSync(RBAC_PAYMENT_DETAIL, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 21: page-rbac dispatches/new vi.mock targets hex @/modules/org-settings/presentation/server", () => {
    const source = fs.readFileSync(RBAC_DISPATCH_NEW, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 22: page-rbac dispatches/[dispatchId] vi.mock targets hex @/modules/org-settings/presentation/server", () => {
    const source = fs.readFileSync(RBAC_DISPATCH_DETAIL, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  // ── NEGATIVE Cat 2 vi.mock target (Tests 23-26) — legacy path absent ──────

  it("Test 23: page-rbac payments/new vi.mock does NOT target legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(RBAC_PAYMENT_NEW, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 24: page-rbac payments/[paymentId] vi.mock does NOT target legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(RBAC_PAYMENT_DETAIL, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 25: page-rbac dispatches/new vi.mock does NOT target legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(RBAC_DISPATCH_NEW, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 26: page-rbac dispatches/[dispatchId] vi.mock does NOT target legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(RBAC_DISPATCH_DETAIL, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  // ── POSITIVE Cat 2 mock factory shape (Tests 27-30) — makeOrgSettingsService ─
  // Sub-axis material drafting Marco mandate: RED contract honesto incluye
  // mock factory return type adapter (named export `makeOrgSettingsService:`
  // matches real hex factory signature, NO class export legacy shape).

  it("Test 27: page-rbac payments/new mock factory shape contains makeOrgSettingsService named export", () => {
    const source = fs.readFileSync(RBAC_PAYMENT_NEW, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 28: page-rbac payments/[paymentId] mock factory shape contains makeOrgSettingsService named export", () => {
    const source = fs.readFileSync(RBAC_PAYMENT_DETAIL, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 29: page-rbac dispatches/new mock factory shape contains makeOrgSettingsService named export", () => {
    const source = fs.readFileSync(RBAC_DISPATCH_NEW, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 30: page-rbac dispatches/[dispatchId] mock factory shape contains makeOrgSettingsService named export", () => {
    const source = fs.readFileSync(RBAC_DISPATCH_DETAIL, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });
});
