/**
 * POC nuevo A5-C1 — voucher-types consumers cutover shape (Path α'' atomic
 * Cat 1 + Cat 2 merged). Cutover from `@/features/voucher-types/server` shim
 * legacy (0-args + `toLegacyShape()` POJO) → `@/modules/voucher-types/presentation/server`
 * factory hex (`makeVoucherTypesService()` + `entity.toSnapshot()` adapter
 * explicit). vi.mock factory paired hygiene swap atomic mismo commit.
 *
 * Axis: cutover atomic batch 6 app pages + 3 api routes (Cat 1) + 10 vi.mock
 * factory test files (Cat 2) — Path α'' merge ratificado §13.A4-η precedent
 * paired sister cumulative cross-POC. Cat 3 cross-feature (4) + cross-module
 * composition-roots (2) DEFERRED A5-C2a + A5-C2b granularity 5 ciclos split
 * lockeada Marco (vs A4 4 ciclos — asimetría material reflected Cat 3 doble).
 *
 * 9 Cat 1 paths cutover scope (per-file granularity, hex /server re-exporta
 * schemas — single import line post-cutover sufficient):
 *   - 6 pages dashboard:
 *       app/(dashboard)/[orgSlug]/settings/voucher-types/page.tsx (L24)
 *       app/(dashboard)/[orgSlug]/accounting/journal/page.tsx (L41)
 *       app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx (L27)
 *       app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx (L28)
 *       app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx (L27)
 *       app/(dashboard)/[orgSlug]/accounting/correlation-audit/page.tsx (L23)
 *   - 3 api routes:
 *       app/api/organizations/[orgSlug]/agent/route.ts (L37 module-scope)
 *       app/api/organizations/[orgSlug]/voucher-types/route.ts (L6 module-scope, 2 legacy imports → 1 hex line)
 *       app/api/organizations/[orgSlug]/voucher-types/[typeId]/route.ts (L6 module-scope, 2 legacy imports → 1 hex line)
 *
 * 10 Cat 2 vi.mock factory cutover scope (load-bearing render path verified
 * Step 5 prep re-grep PROACTIVE — bookmark "11 mocks" inferential overcount,
 * ground truth 10 mocks, 1 unidad correction paired sister #1564/#1565
 * pattern engram inventory accuracy):
 *   - 7 dashboard tests:
 *       app/(dashboard)/[orgSlug]/settings/voucher-types/__tests__/page-rbac.test.ts
 *       app/(dashboard)/[orgSlug]/accounting/journal/__tests__/page.test.ts
 *       app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/__tests__/page-rbac.test.ts
 *       app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page-rbac.test.ts
 *       app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.ts
 *       app/(dashboard)/[orgSlug]/accounting/journal/new/__tests__/page-rbac.test.ts
 *       app/(dashboard)/[orgSlug]/accounting/correlation-audit/__tests__/page-rbac.test.ts
 *   - 2 api route tests:
 *       app/api/organizations/__tests__/route.test.ts
 *       app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-journal-entry.test.ts
 *   - 1 modules adapter test:
 *       modules/accounting/infrastructure/__tests__/voucher-types-read.adapter.test.ts
 *
 * Marco lock final RED scope (54 assertions α distribución):
 *   ── Cat 1 source cutover (Tests 1-18) ──
 *   - Tests 1-9 POSITIVE hex import present (per-file 1 import check):
 *       6 pages + 3 api routes — `from "@/modules/voucher-types/presentation/server"`
 *   - Tests 10-18 NEGATIVE legacy import absent:
 *       6 pages + 3 api routes — NO `from "@/features/voucher-types/server"`
 *
 *   ── Cat 1 makeFactory representative (Tests 19-20, mirror A4 EXACT) ──
 *   - Tests 19-20 POSITIVE makeVoucherTypesService callsite (no `new`):
 *       T19 (settings page representative): contains `makeVoucherTypesService()`
 *         AND NOT `new VoucherTypesService()`
 *       T20 (voucher-types route representative): same shape
 *
 *   ── Cat 1 .toSnapshot() representative §13.A5-γ (Tests 21-24, 4 patterns) ──
 *   §13.A5-γ formal cementación PROACTIVE pre-RED — DTO divergence runtime
 *   path coverage 8 callsites material (4× magnitud vs §13.A4-α). Hex entity
 *   con VOs (`code: VoucherTypeCode`, `prefix: VoucherTypePrefix`) vs legacy
 *   POJO `VoucherTypeCfg` via `toLegacyShape()` adapter — cutover requires
 *   `.toSnapshot()` adapter explicit. Opción C 4 representative cubre 4
 *   patterns estructurally distinct (NO per-callsite escalation):
 *       T21 (settings page direct VO access): page contains `.toSnapshot()`
 *         adapter (post-list, pre `vt.code`/`vt.prefix` mapping)
 *       T22 (journal page JSON.stringify RSC boundary): page contains
 *         `.toSnapshot()` adapter pre `JSON.stringify(...)` Server→Client
 *       T23 (voucher-types route GET handler Response.json API contract):
 *         GET handler body contains `.toSnapshot()` pre `Response.json(...)`
 *       T24 (agent route VO arg post-getByCode): route contains `.toSnapshot()`
 *         post-getByCode pre `voucherType.prefix` argument access
 *
 *   ── Cat 2 vi.mock factory cutover (Tests 25-54) ──
 *   - Tests 25-34 POSITIVE vi.mock target hex (10 test files):
 *       contains `vi.mock("@/modules/voucher-types/presentation/server"`
 *   - Tests 35-44 NEGATIVE vi.mock target legacy absent (10 test files):
 *       NO `vi.mock("@/features/voucher-types/server"`
 *   - Tests 45-54 POSITIVE mock factory shape (10 test files):
 *       contains `makeVoucherTypesService:` named export key (factory return
 *       shape post-cutover — vs class export legacy shape pre-cutover)
 *
 * §13.A5-α candidate emergente cumulative (deferred formal cementación
 * pre-RED A5-C2a per Marco lock — multi-level composition-root delegation
 * `modules/{sale,purchase}/presentation/composition-root.ts` importan legacy
 * `VoucherTypesRepository` directo, requires atomic cutover both modules
 * juntos). Cross-ref engram `poc-nuevo/a5/pre-recon-comprehensive` #1579 +
 * paired sister `poc-futuro/a5-voucher-types/pre-recon-comprehensive` #1580.
 *
 * §13.A5-β candidate DESCARTADO pre-cementación (optional DI defaulting
 * `??= new VoucherTypesService()` feature-level services — pattern feature
 * pre-existing NO emergente A5).
 *
 * Scenario (b) gap §21 candidate (defer A5-D1 doc-only post-mortem
 * cumulative): routes voucher-types/route.ts + [typeId]/route.ts handler-level
 * coverage = ZERO. AMPLIFIES risk §13.A5-γ DTO divergence — handler-level es
 * única layer que catch Response.json contract regression. Engram POC futuro
 * `poc-futuro/a5-voucher-types-routes-coverage-gap` deferred A5-D1 timing
 * (NO PROACTIVE NOW per Marco lock 2 finals).
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T9 FAIL: 9 Cat 1 archivos todavía importan `@/features/voucher-types/server`,
 *   regex match `@/modules/voucher-types/presentation/server` falla.
 * - T10-T18 FAIL: legacy imports presentes, regex match negativo no se cumple
 *   (assertion `not.toMatch` falla).
 * - T19-T20 FAIL: `new VoucherTypesService()` callsites todavía presentes
 *   y `makeVoucherTypesService()` ausente.
 * - T21-T24 FAIL: `.toSnapshot()` adapter ausente en 4 callsites material
 *   representative (settings page + journal page + voucher-types route GET
 *   handler + agent route post-getByCode).
 * - T25-T34 FAIL: vi.mock target hex ausente.
 * - T35-T44 FAIL: vi.mock target legacy presente.
 * - T45-T54 FAIL: mock factory shape `makeVoucherTypesService:` ausente
 *   (legacy class shape `class VoucherTypesService` o `function VoucherTypesService`
 *   present pre-cutover).
 * Total expected FAIL pre-GREEN: 54/54 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta
 * paths que persisten post A5-C3 atomic delete `features/voucher-types/`
 * wholesale. NO toca `features/voucher-types/*` que A5-C3 borra. Self-
 * contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent A4-C1
 * `modules/org-settings/presentation/__tests__/c1-cutover-shape.poc-nuevo-a4.test.ts`
 * EXACT shape (path constants + regex patterns + describe block organization).
 *
 * Cross-ref:
 *   - architecture.md §13.7 #10/#11/#12/#13/#14 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A4-α DTO divergence (paired sister precedent §13.A5-γ)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` (formal cementación PROACTIVE pre-RED)
 *   - engram `poc-nuevo/a5/13-gamma-dto-divergence` (paired sister)
 *   - engram `poc-nuevo/a5/pre-recon-comprehensive` #1579 (inventory correction Cat 2 + Cat 3)
 *   - engram `poc-futuro/a5-voucher-types/pre-recon-comprehensive` #1580 (paired sister)
 *   - engram `poc-nuevo/a4/closed` #1577 baseline runtime hereda A5
 *   - modules/voucher-types/presentation/server.ts (hex barrel cutover target — re-exporta schemas single import line)
 *   - modules/voucher-types/presentation/composition-root.ts (factory)
 *   - modules/voucher-types/domain/voucher-type.entity.ts (toSnapshot 8 fields)
 *   - modules/org-settings/presentation/__tests__/c1-cutover-shape.poc-nuevo-a4.test.ts (precedent shape A4-C1)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 1 source cutover targets (9 paths) ────────────────────────────────────

const PAGE_SETTINGS_VOUCHER_TYPES = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/settings/voucher-types/page.tsx",
);
const PAGE_JOURNAL_LIST = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/page.tsx",
);
const PAGE_JOURNAL_DETAIL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx",
);
const PAGE_JOURNAL_EDIT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx",
);
const PAGE_JOURNAL_NEW = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx",
);
const PAGE_CORRELATION_AUDIT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/correlation-audit/page.tsx",
);
const ROUTE_AGENT = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/agent/route.ts",
);
const ROUTE_VOUCHER_TYPES = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/voucher-types/route.ts",
);
const ROUTE_VOUCHER_TYPE_BY_ID = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/voucher-types/[typeId]/route.ts",
);

// ── Cat 2 vi.mock factory cutover targets (10 test files) ─────────────────────

const RBAC_SETTINGS_VOUCHER_TYPES = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/settings/voucher-types/__tests__/page-rbac.test.ts",
);
const PAGE_TEST_JOURNAL_LIST = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/__tests__/page.test.ts",
);
const RBAC_JOURNAL_DETAIL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/__tests__/page-rbac.test.ts",
);
const RBAC_JOURNAL_EDIT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page-rbac.test.ts",
);
const PAGE_TEST_JOURNAL_EDIT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.ts",
);
const RBAC_JOURNAL_NEW = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/journal/new/__tests__/page-rbac.test.ts",
);
const RBAC_CORRELATION_AUDIT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/correlation-audit/__tests__/page-rbac.test.ts",
);
const ROUTE_TEST_ORGANIZATIONS = path.join(
  REPO_ROOT,
  "app/api/organizations/__tests__/route.test.ts",
);
const ROUTE_TEST_AGENT = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-journal-entry.test.ts",
);
const ADAPTER_TEST_VOUCHER_TYPES_READ = path.join(
  REPO_ROOT,
  "modules/accounting/infrastructure/__tests__/voucher-types-read.adapter.test.ts",
);

// ── Regex patterns ────────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/voucher-types\/presentation\/server["']/;
const LEGACY_SERVER_RE = /from\s*["']@\/features\/voucher-types\/server["']/;

const MAKE_FACTORY_RE = /makeVoucherTypesService\(\)/;
const NEW_LEGACY_CTOR_RE = /new\s+VoucherTypesService\s*\(\s*\)/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;

const VI_MOCK_HEX_RE = /vi\.mock\(\s*["']@\/modules\/voucher-types\/presentation\/server["']/;
const VI_MOCK_LEGACY_RE = /vi\.mock\(\s*["']@\/features\/voucher-types\/server["']/;
const MAKE_FACTORY_KEY_RE = /makeVoucherTypesService\s*:/;

describe("POC nuevo A5-C1 — voucher-types consumers cutover shape (Path α'' atomic Cat 1 + Cat 2)", () => {
  // ── POSITIVE Cat 1 source-shape (Tests 1-9) — hex import present ───────────

  it("Test 1: page settings/voucher-types imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_SETTINGS_VOUCHER_TYPES, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: page accounting/journal imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_LIST, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 3: page accounting/journal/[entryId] imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_DETAIL, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 4: page accounting/journal/[entryId]/edit imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_EDIT, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 5: page accounting/journal/new imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_NEW, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 6: page accounting/correlation-audit imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAGE_CORRELATION_AUDIT, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 7: api route agent imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(ROUTE_AGENT, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 8: api route voucher-types imports VoucherTypesService factory + schema from hex presentation/server (re-exports)", () => {
    const source = fs.readFileSync(ROUTE_VOUCHER_TYPES, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 9: api route voucher-types/[typeId] imports VoucherTypesService factory + schema from hex presentation/server (re-exports)", () => {
    const source = fs.readFileSync(ROUTE_VOUCHER_TYPE_BY_ID, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  // ── NEGATIVE Cat 1 source-shape (Tests 10-18) — legacy import absent ───────
  // Future-proof contra accidental re-import legacy shim. NO toca Cat 3
  // cross-feature/cross-module deps (A5-C2a + A5-C2b cleanup scope deferred).

  it("Test 10: page settings/voucher-types does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_SETTINGS_VOUCHER_TYPES, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 11: page accounting/journal does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_LIST, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 12: page accounting/journal/[entryId] does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_DETAIL, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 13: page accounting/journal/[entryId]/edit does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_EDIT, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 14: page accounting/journal/new does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_NEW, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 15: page accounting/correlation-audit does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_CORRELATION_AUDIT, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 16: api route agent does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(ROUTE_AGENT, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 17: api route voucher-types does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(ROUTE_VOUCHER_TYPES, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 18: api route voucher-types/[typeId] does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(ROUTE_VOUCHER_TYPE_BY_ID, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  // ── POSITIVE Cat 1 makeFactory representative (Tests 19-20) ────────────────
  // Mirror A4-C1 EXACT — 2 representative (1 page + 1 route), NO per-callsite
  // escalation (Hex import positive 9 + Legacy import absent 9 ya cubren
  // per-callsite granularity per Marco lock 5 finals).

  it("Test 19: page settings/voucher-types uses makeVoucherTypesService() factory and NOT new VoucherTypesService()", () => {
    const source = fs.readFileSync(PAGE_SETTINGS_VOUCHER_TYPES, "utf8");
    expect(source).toMatch(MAKE_FACTORY_RE);
    expect(source).not.toMatch(NEW_LEGACY_CTOR_RE);
  });

  it("Test 20: api route voucher-types uses makeVoucherTypesService() factory and NOT new VoucherTypesService()", () => {
    const source = fs.readFileSync(ROUTE_VOUCHER_TYPES, "utf8");
    expect(source).toMatch(MAKE_FACTORY_RE);
    expect(source).not.toMatch(NEW_LEGACY_CTOR_RE);
  });

  // ── POSITIVE Cat 1 .toSnapshot() representative §13.A5-γ (Tests 21-24) ─────
  // §13.A5-γ formal cementación PROACTIVE pre-RED — DTO divergence runtime
  // path coverage MATERIAL CONFIRMED 8 callsites (4× magnitud vs §13.A4-α).
  // Hex `service.list/getByCode/create/update` retorna `VoucherType` entity
  // con VOs (`code: VoucherTypeCode`, `prefix: VoucherTypePrefix`); legacy
  // shim retornaba POJO `VoucherTypeCfg` via `toLegacyShape()` adapter.
  // Cutover requiere `.toSnapshot()` adapter explicit en boundary callsites
  // material. Opción C 4 representative cubre 4 patterns estructurally
  // distinct (Marco lock 2 finales).

  it("Test 21: §13.A5-γ pattern 1 direct VO access — page settings/voucher-types contains .toSnapshot() adapter (post-list, pre vt.code/vt.prefix mapping)", () => {
    const source = fs.readFileSync(PAGE_SETTINGS_VOUCHER_TYPES, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_RE);
  });

  it("Test 22: §13.A5-γ pattern 2 JSON.stringify RSC boundary — page accounting/journal contains .toSnapshot() adapter (pre Server→Client serialization)", () => {
    const source = fs.readFileSync(PAGE_JOURNAL_LIST, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_RE);
  });

  it("Test 23: §13.A5-γ pattern 3 Response.json API contract — voucher-types route GET handler body contains .toSnapshot() adapter (pre Response.json)", () => {
    const source = fs.readFileSync(ROUTE_VOUCHER_TYPES, "utf8");
    const getStart = source.indexOf("export async function GET(");
    const postStart = source.indexOf("export async function POST(");
    expect(getStart).toBeGreaterThanOrEqual(0);
    expect(postStart).toBeGreaterThan(getStart);
    const getBody = source.slice(getStart, postStart);
    expect(getBody).toMatch(TO_SNAPSHOT_RE);
  });

  it("Test 24: §13.A5-γ pattern 4 agent route VO arg post-getByCode — agent route contains .toSnapshot() adapter (post-getByCode, pre voucherType.prefix argument access)", () => {
    const source = fs.readFileSync(ROUTE_AGENT, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_RE);
  });

  // ── POSITIVE Cat 2 vi.mock target hex (Tests 25-34) ────────────────────────
  // §13.A4-η precedent paired sister cumulative cross-POC: vi.mock factory
  // load-bearing render path coverage (Step 5 prep PROACTIVE re-grep
  // confirmed ALL 10 mocks load-bearing — Path α'' atomic merge required).

  it("Test 25: page-rbac settings/voucher-types vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(RBAC_SETTINGS_VOUCHER_TYPES, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 26: page test accounting/journal vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(PAGE_TEST_JOURNAL_LIST, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 27: page-rbac accounting/journal/[entryId] vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_DETAIL, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 28: page-rbac accounting/journal/[entryId]/edit vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_EDIT, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 29: page test accounting/journal/[entryId]/edit vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(PAGE_TEST_JOURNAL_EDIT, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 30: page-rbac accounting/journal/new vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_NEW, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 31: page-rbac accounting/correlation-audit vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(RBAC_CORRELATION_AUDIT, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 32: api route test organizations vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(ROUTE_TEST_ORGANIZATIONS, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 33: api route test agent confirm-journal-entry vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(ROUTE_TEST_AGENT, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 34: modules/accounting voucher-types-read.adapter test vi.mock targets hex @/modules/voucher-types/presentation/server", () => {
    const source = fs.readFileSync(ADAPTER_TEST_VOUCHER_TYPES_READ, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  // ── NEGATIVE Cat 2 vi.mock target legacy absent (Tests 35-44) ──────────────

  it("Test 35: page-rbac settings/voucher-types vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(RBAC_SETTINGS_VOUCHER_TYPES, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 36: page test accounting/journal vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_TEST_JOURNAL_LIST, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 37: page-rbac accounting/journal/[entryId] vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_DETAIL, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 38: page-rbac accounting/journal/[entryId]/edit vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_EDIT, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 39: page test accounting/journal/[entryId]/edit vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PAGE_TEST_JOURNAL_EDIT, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 40: page-rbac accounting/journal/new vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_NEW, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 41: page-rbac accounting/correlation-audit vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(RBAC_CORRELATION_AUDIT, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 42: api route test organizations vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(ROUTE_TEST_ORGANIZATIONS, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 43: api route test agent confirm-journal-entry vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(ROUTE_TEST_AGENT, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  it("Test 44: modules/accounting voucher-types-read.adapter test vi.mock does NOT target legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(ADAPTER_TEST_VOUCHER_TYPES_READ, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  // ── POSITIVE Cat 2 mock factory shape (Tests 45-54) ────────────────────────
  // Mirror A4-C1 Tests 27-30 EXACT — RED contract honesto incluye TODO
  // cutover atomic mock factory return shape adapter (named export
  // `makeVoucherTypesService:` matches real hex factory signature, NO class
  // export legacy shape pre-cutover).

  it("Test 45: page-rbac settings/voucher-types mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(RBAC_SETTINGS_VOUCHER_TYPES, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 46: page test accounting/journal mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(PAGE_TEST_JOURNAL_LIST, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 47: page-rbac accounting/journal/[entryId] mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_DETAIL, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 48: page-rbac accounting/journal/[entryId]/edit mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_EDIT, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 49: page test accounting/journal/[entryId]/edit mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(PAGE_TEST_JOURNAL_EDIT, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 50: page-rbac accounting/journal/new mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(RBAC_JOURNAL_NEW, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 51: page-rbac accounting/correlation-audit mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(RBAC_CORRELATION_AUDIT, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 52: api route test organizations mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(ROUTE_TEST_ORGANIZATIONS, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 53: api route test agent confirm-journal-entry mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(ROUTE_TEST_AGENT, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });

  it("Test 54: modules/accounting voucher-types-read.adapter test mock factory shape contains makeVoucherTypesService named export", () => {
    const source = fs.readFileSync(ADAPTER_TEST_VOUCHER_TYPES_READ, "utf8");
    expect(source).toMatch(MAKE_FACTORY_KEY_RE);
  });
});
