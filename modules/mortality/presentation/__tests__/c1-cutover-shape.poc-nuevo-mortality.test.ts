/**
 * POC nuevo mortality C1 — wholesale delete features/mortality/* atomic +
 * cross-consumer cutover shape (Path simplificado entity-direct, NO LOCAL DTO).
 * Cutover from `@/features/mortality/server` shim legacy (class
 * `MortalityService` + `toLegacyShape()` cast `as MortalityLogWithRelations`)
 * → `@/modules/mortality/presentation/server` factory hex
 * (`makeMortalityService()` + `Mortality` entity directo). vi.mock factory
 * paired hygiene swap atomic mismo commit.
 *
 * §13.A5-ε classification Marco lock: NO MATERIAL — divergence TYPE-only
 * (1 field `createdAt` Prisma `MortalityLog` pero ningún consumer lo lee
 * runtime, verified grep `createdAt|updatedAt` PROJECT-scope sobre 6 consumers
 * incl. components/mortality/log-mortality-form.tsx). Path simplificado
 * lockeado (vs Path a payment C4-β): lot-detail-client.tsx consume `Mortality`
 * entity directo de `@/modules/mortality/presentation/server`, drop type
 * `MortalityLogWithRelations` entirely — NO LOCAL DTO presentation/dto/
 * (asimetría material vs payment 5 fields runtime divergent).
 *
 * 5 Cat 1 paths cutover scope (per-file granularity):
 *   - 1 client component:
 *       app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx (L23 type)
 *   - 1 page dashboard:
 *       app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx (L6 value)
 *   - 2 api routes:
 *       app/api/organizations/[orgSlug]/mortality/route.ts (L4 value + L5 schema)
 *       app/api/organizations/[orgSlug]/agent/route.ts (L11 value + L13 schema)
 *   - 1 cross-feature consumer:
 *       features/pricing/pricing.service.ts (L4 value, callsites L17-L19)
 *
 * 1 Cat 2 vi.mock factory cutover scope:
 *   - app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-journal-entry.test.ts
 *     (L123 vi.mock target redirect hex)
 *
 * Wholesale delete features/mortality/* (4 archivos atomic):
 *   - features/mortality/index.ts (barrel re-export)
 *   - features/mortality/mortality.types.ts (3 types incl. orphan MortalityFilters)
 *   - features/mortality/mortality.validation.ts (logMortalitySchema duplicado)
 *   - features/mortality/server.ts (class shim + toLegacyShape mapper)
 *
 * Marco lock final RED scope (9 assertions α distribución):
 *   ── Cat 1 source cutover (Tests 1-6) ──
 *   - Tests 1-5 POSITIVE hex import present (per-file 1 import check):
 *       5 consumers — `from "@/modules/mortality/presentation/server"`
 *   - Test 6 NEGATIVE legacy import absent (forEach atomic 5 consumers):
 *       NO `from "@/features/mortality(/sub-path)?"`
 *
 *   ── Cat 2 vi.mock factory cutover (Tests 7-8) ──
 *   - Test 7 POSITIVE vi.mock target hex:
 *       `vi.mock("@/modules/mortality/presentation/server"`
 *   - Test 8 NEGATIVE vi.mock target legacy absent:
 *       NO `vi.mock("@/features/mortality/server"`
 *
 *   ── Wholesale delete (Test 9) ──
 *   - Test 9 features/mortality/ directory does NOT exist (atomic)
 *
 * §13 patterns aplicabilidad EXACT:
 *   - §13.A features-legacy-type-only-import: 1 evidencia (lot-detail-client.tsx
 *     `import type { MortalityLogWithRelations } from "@/features/mortality"`),
 *     resuelta wholesale 4ta evidencia post-cementación canonical (cumulative
 *     payment C2 1ra + C3 2da + C4-α 3ra evidencias).
 *   - §13.A5-ε signature divergence: NO MATERIAL (TYPE-only, drop sin LOCAL DTO).
 *   - §13.A5-ζ wholesale delete features/* atomic: 1 evidencia.
 *   - §13 R-name-collision-type-vs-value-shadowing: 0 collisions (grep clean).
 *   - §13 mapper move presentation→infrastructure: NO aplica (mortality.mapper.ts
 *     ya en infrastructure/ desde inicio, correcto desde build-out hex).
 *   - §13.B paired DTO drop axis paired: NO (mortality single-feature).
 *   - §13.A5-α multi-level composition delegation: NO (single-level R4 directo).
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T5 FAIL: 5 Cat 1 archivos todavía importan `@/features/mortality(/server)?`,
 *   regex match `@/modules/mortality/presentation/server` falla (ausente pre-GREEN).
 * - T6 FAIL: legacy imports presentes en 5 consumers, regex match negativo
 *   no se cumple (assertion `not.toMatch` falla en 1ra iteración forEach).
 * - T7 FAIL: vi.mock target hex ausente.
 * - T8 FAIL: vi.mock target legacy presente (`@/features/mortality/server`).
 * - T9 FAIL: directory `features/mortality/` existe (4 archivos pre-GREEN).
 * Total expected FAIL pre-GREEN: 9/9 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check: shape test asserta paths que persisten
 * post wholesale delete features/mortality/* atomic. NO toca `features/mortality/*`
 * que GREEN borra. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent A5-C1
 * `modules/voucher-types/presentation/__tests__/c1-cutover-shape.poc-nuevo-a5.test.ts`
 * EXACT shape (path constants + regex patterns + describe block organization).
 *
 * Cross-ref:
 *   - architecture.md §13.7 cumulative POC counters
 *   - architecture.md §13.A features-legacy-type-only-import (4ta evidencia)
 *   - architecture.md §13.A5-ε signature divergence (NO MATERIAL classification)
 *   - architecture.md §13.A5-ζ wholesale delete features/* atomic
 *   - modules/voucher-types/presentation/__tests__/c1-cutover-shape.poc-nuevo-a5.test.ts (precedent shape)
 *   - modules/mortality/presentation/server.ts (hex barrel cutover target)
 *   - modules/mortality/presentation/composition-root.ts (factory)
 *   - modules/mortality/domain/mortality.entity.ts (Mortality entity Path simplificado)
 *   - prisma/schema.prisma model MortalityLog (createdAt único field divergent NO MATERIAL)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 1 source cutover targets (5 consumers) ────────────────────────────────

const LOT_DETAIL_CLIENT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx",
);
const LOT_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx",
);
const ROUTE_MORTALITY = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/mortality/route.ts",
);
const ROUTE_AGENT = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/agent/route.ts",
);
const PRICING_SERVICE = path.join(
  REPO_ROOT,
  "features/pricing/pricing.service.ts",
);

// ── Cat 2 vi.mock factory cutover target (1 test file) ────────────────────────

const ROUTE_TEST_AGENT_CONFIRM = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-journal-entry.test.ts",
);

// ── Wholesale delete target ───────────────────────────────────────────────────

const FEATURES_MORTALITY_DIR = path.join(REPO_ROOT, "features/mortality");

// ── Regex patterns ────────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/mortality\/presentation\/server["']/;
const LEGACY_FEATURE_RE =
  /from\s*["']@\/features\/mortality(?:\/[^"']*)?["']/;

const VI_MOCK_HEX_RE =
  /vi\.mock\(\s*["']@\/modules\/mortality\/presentation\/server["']/;
const VI_MOCK_LEGACY_RE =
  /vi\.mock\(\s*["']@\/features\/mortality\/server["']/;

describe("POC nuevo mortality C1 — wholesale delete features/mortality/* + cross-consumer cutover shape (Path simplificado entity-direct)", () => {
  // ── POSITIVE Cat 1 source-shape (Tests 1-5) — hex import present ──────────

  it("Test 1: lot-detail-client.tsx imports Mortality entity from hex presentation/server (Path simplificado entity-direct)", () => {
    const source = fs.readFileSync(LOT_DETAIL_CLIENT, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: lots/[lotId]/page.tsx imports makeMortalityService factory from hex presentation/server", () => {
    const source = fs.readFileSync(LOT_PAGE, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 3: api/mortality/route.ts imports makeMortalityService factory + logMortalitySchema from hex presentation/server (re-exports)", () => {
    const source = fs.readFileSync(ROUTE_MORTALITY, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 4: api/agent/route.ts imports makeMortalityService factory + logMortalitySchema from hex presentation/server (re-exports)", () => {
    const source = fs.readFileSync(ROUTE_AGENT, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 5: features/pricing/pricing.service.ts imports makeMortalityService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PRICING_SERVICE, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  // ── NEGATIVE Cat 1 source-shape (Test 6) — legacy import absent forEach ───
  // Future-proof contra accidental re-import legacy shim (any sub-path of
  // @/features/mortality, incluyendo barrel index + /server). Atomic forEach
  // 5 consumers single test mirror precedent voucher-types Cat 1 negative
  // pattern (consolidado per-axis, NO per-file split — asimetría material
  // scope reducido vs A5 9 archivos).

  it("Test 6: 5 consumers do NOT import from legacy @/features/mortality (any sub-path)", () => {
    const consumers = [
      LOT_DETAIL_CLIENT,
      LOT_PAGE,
      ROUTE_MORTALITY,
      ROUTE_AGENT,
      PRICING_SERVICE,
    ];
    for (const file of consumers) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(LEGACY_FEATURE_RE);
    }
  });

  // ── Cat 2 vi.mock factory cutover (Tests 7-8) ─────────────────────────────

  it("Test 7: route.confirm-journal-entry test redirects vi.mock target to hex presentation/server", () => {
    const source = fs.readFileSync(ROUTE_TEST_AGENT_CONFIRM, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_RE);
  });

  it("Test 8: route.confirm-journal-entry test does NOT mock legacy @/features/mortality/server", () => {
    const source = fs.readFileSync(ROUTE_TEST_AGENT_CONFIRM, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  // ── Wholesale delete (Test 9) ─────────────────────────────────────────────

  it("Test 9: features/mortality/ directory does NOT exist (wholesale delete atomic 4 archivos)", () => {
    expect(fs.existsSync(FEATURES_MORTALITY_DIR)).toBe(false);
  });
});
