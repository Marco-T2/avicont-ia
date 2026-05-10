/**
 * POC paired farms+lots C5 RED — cutover UI pages lots hex factory invocation
 * + `.toSnapshot()` bridge per call site MANDATORY + consumer client type
 * migration lot-detail-client + farm-detail-client cross-feature lots prop
 * (paired-lot side, paired sister mirror farm).
 *
 * Axis: cutover UI page invocation patterns from legacy class ctor
 * `new LotsService()` → hex factory `makeLotService()` + `.toSnapshot()` bridge
 * per call site MANDATORY (paired sister `cutover-consumer-return-shape-verification-gate`
 * canonical home #1774 8va evidencia matures cumulative cross-POC — pages
 * consume Lot entity returns from hex service `getSummary` + `listByFarm` →
 * cross RSC boundary → consumer client React component → `JSON.stringify(entity)`
 * serializes propiedades propias NO getters de clase → consumer access fails
 * undefined → bug runtime latente, hotfix-correctivo-contacts 12 callsites
 * cumulative precedent EXACT mirror).
 *
 * Q7A confirmado D3=a — hex `LotService.getSummary(orgId, id) → { lot: Lot;
 * summary: LotSummary }` divergence vs legacy shape `LotSummary { lot:
 * LotWithRelations, totalExpenses, totalMortality, aliveCount, costPerChicken }`
 * — page server-side compose ya hex `summary.lot.toSnapshot()` Q7A `{ lot,
 * summary }` consumer migration inline mismo batch D5=a (paired sister C5-C6
 * payable-list/receivable-list EXACT mirror precedent).
 *
 * Cross-feature lots consumer farms/[farmId]/page.tsx cutover paired-lot side
 * scope INCLUIDO — `lotsService.listByFarm(orgId, farmId)` legacy → hex
 * `makeLotService().listByFarm(orgId, farmId)` + `.map((l) => l.toSnapshot())`
 * bridge MANDATORY per call site cross-feature consumer Lot entity → cross
 * RSC boundary → farm-detail-client.tsx receives `lots: LotSnapshot[]` prop
 * type migration (ChickenLot Prisma raw → LotSnapshot hex DTO consumer prop
 * shape — paired sister precedent A5-C1 .toSnapshot() Opción C 5ta aplicación
 * cumulative cross-POC).
 *
 * Marco lock D1=a (paired sister Contact prisma type mirror confirmed —
 * farm-side FarmSnapshotWithLots Prisma raw ChickenLot composition) + D2=a
 * (atomic single batch ~10 archivos paired sister C5-C6 14 archivos EXACT
 * mirror precedent) + D3=a (Q7A `{ lot, summary }` return shape getSummary
 * hex confirmado) + D5=a (mismo batch C5 consumer client migrate inline paired
 * sister C5-C6 EXACT) + D6 (dialogs EXCLUSIÓN honest correction — `evidence-
 * supersedes-assumption-lock` 18ma matures cumulative cross-POC, dialogs no
 * consumer types verified Step 0 expand recon) + D7=a (Opt A existence-only
 * regex shape mirror C0-C4 convention preserve forward). Auth pattern legacy
 * preserved EXACT mirror Marco lock heredado D2 Opt B C4 (RBAC migration
 * cross-POC out-of-scope per `feedback/farm-lot-routes-auth-pattern-legacy-vs-canonical-require-permission-cleanup-pending`
 * 13mo cumulative cross-POC + Resource `"lots"` ausente en
 * `features/permissions/permissions.ts` — Resource expansion out-of-POC scope).
 *
 * 4 archivos cutover INCLUIDOS paired-lot side Marco lock D2 atomic single
 * batch paired sister C0/C1/C2/C3/C4 EXACT precedent:
 *   1. app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx (cutover legacy class
 *      `new LotsService()` → hex `makeLotService()` + `summary.lot.toSnapshot()`
 *      bridge MANDATORY Q7A `{ lot, summary }` consume)
 *   2. app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx (cutover cross-feature
 *      lots consumer `new LotsService()` → hex factory + `.map((l) => l.toSnapshot())`
 *      bridge MANDATORY per call site listByFarm Lot entity[] → cross RSC
 *      boundary)
 *   3. app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx (consumer
 *      type migration LotSummary legacy POJO → hex LotSnapshot + hex LotSummary
 *      VO shape divergence paired sister C5-C6 EXACT mirror precedent)
 *   4. app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx (consumer
 *      cross-feature lots prop type migration ChickenLot Prisma raw[] → LotSnapshot
 *      hex DTO[] paired sister C5-C6 EXACT mirror precedent — Marco lock D5=a
 *      cross-feature consumer migration inline mismo batch)
 *
 * Marco lock final RED scope C5 (13 assertions α paired-lot side — paired sister
 * mirror farm 13 assertions = 26 paired total Marco aprobado pre-RED-α paired
 * sister C5-C6 13/13 per side EXACT precedent):
 *
 *   ── A: lots/[lotId]/page.tsx cutover (Tests α14-α17) ──
 *     α14 lots/[lotId]/page.tsx imports `makeLotService` from
 *         `@/modules/lot/presentation/server` (cutover legacy class ctor
 *         `new LotsService()` → hex factory Path α direct mecánico mirror C4
 *         routes precedent EXACT)
 *     α15 lots/[lotId]/page.tsx does NOT import from `@/features/lots` NOR
 *         `@/features/lots/server` (legacy class+types dropped post-cutover,
 *         ADDITIVE strategy preserva features/lots/* intactos hasta C7 wholesale
 *         delete per Marco lock heredado D1 Opt C C4 precedent EXACT)
 *     α16 lots/[lotId]/page.tsx contains `.toSnapshot()` call (Q7A summary.lot
 *         RSC boundary serialization adapter bridge MANDATORY per call site —
 *         cutover-consumer-return-shape-verification-gate canonical home #1774
 *         8va evidencia matures cumulative cross-POC)
 *     α17 lots/[lotId]/page.tsx does NOT contain `new LotsService(` literal
 *         (legacy class ctor instantiation dropped post-cutover, ADDITIVE
 *         preserve legacy intactos features/lots/lots.service.ts hasta C7)
 *
 *   ── B: farms/[farmId]/page.tsx cross-feature lots cutover (Tests α18-α20) ──
 *     α18 farms/[farmId]/page.tsx imports `makeLotService` from hex (cross-feature
 *         consumer within farm-detail page — lots listByFarm cutover scope
 *         INCLUIDO esta cycle paired sister C5-C6 precedent EXACT mirror)
 *     α19 farms/[farmId]/page.tsx does NOT import from `@/features/lots` NOR
 *         `@/features/lots/server` (legacy class+types dropped post-cutover)
 *     α20 farms/[farmId]/page.tsx contains `.toSnapshot()` call (lots[] map
 *         bridge MANDATORY per call site listByFarm Lot entity[] → cross RSC
 *         boundary — `.map((l) => l.toSnapshot())` paired sister Opción C
 *         precedent A5-C1 5ta aplicación cumulative cross-POC)
 *
 *   ── C: lot-detail-client.tsx consumer type migration (Tests α21-α23) ──
 *     α21 lot-detail-client.tsx imports `LotSnapshot` from
 *         `@/modules/lot/presentation/server` (Q7A `{ lot, summary }` consume
 *         hex types — paired sister C5-C6 EXACT mirror precedent Marco lock
 *         D5=a client migrate inline)
 *     α22 lot-detail-client.tsx imports `LotSummary` from
 *         `@/modules/lot/presentation/server` (hex LotSummary VO shape
 *         divergence vs legacy LotSummary POJO — Q7A consume server-side
 *         compose result hex divergence inline mismo batch)
 *     α23 lot-detail-client.tsx does NOT import from `@/features/lots` NOR
 *         `@/features/lots/server` (legacy types dropped post-cutover)
 *
 *   ── D: farm-detail-client.tsx cross-feature lots prop migration (Tests α24-α26) ──
 *     α24 farm-detail-client.tsx imports `LotSnapshot` from
 *         `@/modules/lot/presentation/server` (separate `lots` prop type
 *         migration ChickenLot Prisma raw[] → LotSnapshot hex DTO[] paired
 *         sister C5-C6 EXACT mirror precedent — cross-feature consumer
 *         migration inline mismo batch D5=a)
 *     α25 farm-detail-client.tsx does NOT import `ChickenLot` from
 *         `@/generated/prisma/client` (cross-feature lots prop type migration
 *         post-cutover — RSC boundary serialization adapter compliant)
 *     α26 farms/[farmId]/page.tsx does NOT contain `new LotsService(` literal
 *         (legacy class ctor instantiation dropped post-cutover paired α17
 *         lots/[lotId]/page.tsx mirror — ADDITIVE preserve legacy intactos
 *         features/lots/lots.service.ts hasta C7)
 *
 * Expected RED failure mode pre-GREEN per `feedback_red_acceptance_failure_mode`:
 *   - α14 FAIL behavioral assertion mismatch — lots/[lotId]/page.tsx hoy
 *     importa `import { LotsService } from "@/features/lots/server"` legacy
 *     class. Regex `^import...makeLotService...from "@/modules/lot/presentation/server"`
 *     match falla.
 *   - α15 FAIL behavioral assertion mismatch — lots/[lotId]/page.tsx hoy
 *     importa legacy `@/features/lots/server`. `not.toMatch` legacy path
 *     reverses (legacy PRESENT pre-cutover).
 *   - α16 FAIL behavioral assertion mismatch — lots/[lotId]/page.tsx hoy NO
 *     llama `.toSnapshot()` (greenfield bridge pendiente C5, page recibe legacy
 *     LotSummary POJO directo de LotsService.getSummary).
 *   - α17 FAIL behavioral assertion mismatch — lots/[lotId]/page.tsx hoy
 *     contiene `new LotsService()` línea 32. `not.toMatch` ctor pattern
 *     reverses (PRESENT pre-cutover).
 *   - α18 FAIL behavioral assertion mismatch — farms/[farmId]/page.tsx hoy
 *     importa `LotsService` legacy class. Regex hex factory match falla.
 *   - α19 FAIL behavioral assertion mismatch — farms/[farmId]/page.tsx hoy
 *     importa `@/features/lots/server`. `not.toMatch` reverses (PRESENT
 *     pre-cutover).
 *   - α20 FAIL behavioral assertion mismatch — farms/[farmId]/page.tsx hoy
 *     NO llama `.toSnapshot()` (greenfield bridge pendiente C5, page recibe
 *     legacy ChickenLot[] POJO directo de LotsService.listByFarm).
 *   - α21 FAIL behavioral assertion mismatch — lot-detail-client.tsx hoy
 *     importa `import type { LotSummary } from "@/features/lots"` legacy POJO
 *     type. Regex hex `LotSnapshot` import from
 *     `@/modules/lot/presentation/server` match falla.
 *   - α22 FAIL behavioral assertion mismatch — lot-detail-client.tsx hoy NO
 *     importa hex `LotSummary` (greenfield VO shape divergence pendiente C5).
 *   - α23 FAIL behavioral assertion mismatch — lot-detail-client.tsx hoy
 *     importa legacy `@/features/lots`. `not.toMatch` reverses (PRESENT
 *     pre-cutover).
 *   - α24 FAIL behavioral assertion mismatch — farm-detail-client.tsx hoy
 *     importa `import type { ChickenLot } from "@/generated/prisma/client"`
 *     legacy Prisma raw type. Regex hex `LotSnapshot` import match falla.
 *   - α25 FAIL behavioral assertion mismatch — farm-detail-client.tsx hoy
 *     importa `ChickenLot` from `@/generated/prisma/client`. `not.toMatch`
 *     reverses (PRESENT pre-cutover).
 *   - α26 FAIL behavioral assertion mismatch — farms/[farmId]/page.tsx hoy
 *     contiene `new LotsService()` línea 39. `not.toMatch` ctor pattern
 *     reverses (PRESENT pre-cutover).
 * Total expected FAIL pre-GREEN: 13/13 lot side (paired sister 13/13 farm =
 * 26/26 total cumulative cross-POC `feedback_enumerated_baseline_failure_ledger`
 * 16ma matures cumulative cross-POC recursive aplicación forward).
 *
 * Self-contained future-proof check: shape test asserta paths
 * `app/(dashboard)/[orgSlug]/{lots,farms}/...` + `modules/lot/presentation/...`
 * que persisten post C7 wholesale delete `features/lots/`. Test vive en
 * `modules/lot/presentation/__tests__/` mirror C4 precedent EXACT — NO toca
 * `features/lots/*` que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Cross-ref:
 *   - engram `poc-paired-farms-lots/c4/closed` #1844 (cycle-start bookmark
 *     C5 heredado — D1-D4 locks aplicados + 6 cross-feature legacy consumers
 *     preservados intactos via ADDITIVE strategy, includes 3 pages C5 sub-cycle scope)
 *   - engram `poc-nuevo/paired-payables-receivables/c5-c6-closed` #1624 (paired
 *     sister C5-C6 precedent EXACT mirror cumulative cross-POC 14 archivos
 *     atomic single batch — §13.B-paired letter NEW classification "DTO drop
 *     axis paired" + Snapshot+Contact hex DTO + bridge mapper simplification
 *     .toSnapshot() Opción C precedent A5-C1 4ta aplicación)
 *   - engram `feedback/cutover-consumer-return-shape-verification-gate` #1774
 *     (1ra evidencia matures retroactive aplicación POC correctivo contacts —
 *     MANDATORY .toSnapshot() bridge per call site, paired sister §13 RSC
 *     boundary serialization adapter pattern gate side, 8va evidencia matures
 *     cumulative cross-POC este RED forward)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582
 *     (formal cementación A5-D1 — Opción C `.toSnapshot()` adapter precedent
 *     A5-C1 5ta aplicación post-cementación cumulative C5 paired farms+lots
 *     mismo precedent paired sister payables/receivables C5-C6 4ta aplicación)
 *   - engram `feedback/evidence-supersedes-assumption-lock` (18ma matures
 *     cumulative cross-POC — bookmark scope dialogs erróneo superseded por
 *     honest correction Step 0 expand recon, dialogs no consumer types verified)
 *   - engram `feedback/farm-lot-find-all-legacy-vs-hex-factory-dual-method-cleanup-pending`
 *     (12mo cumulative cross-POC — ADDITIVE strategy preserva 6 legacy consumers
 *     defer sub-cycles, includes 3 pages C5 cutover esta cycle scope)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 13/13
 *     enumerated behavioral assertion mismatch paired-lot side)
 *   - engram `feedback_red_regex_discipline` (^import...m anchor + ?? optional
 *     Marco lock convention preserved 16ma matures cumulative cross-POC)
 *   - engram `feedback_enumerated_baseline_failure_ledger` (16ma matures
 *     cumulative cross-POC per-α explicit ledger)
 *   - modules/payables/infrastructure/contact-attacher.ts (paired sister
 *     EXACT mirror precedent — items.map(p => ({...p.toSnapshot(), contact}))
 *     Opción C Path α direct entity → snapshot mapping)
 *   - components/accounting/payable-list.tsx + receivable-list.tsx (paired
 *     sister C5-C6 consumer client migration line 43-114 PayableSnapshotWithContact
 *     EXACT mirror precedent para lot-detail-client + farm-detail-client)
 *   - app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx (target cutover hex factory + Q7A toSnapshot bridge)
 *   - app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx (target cross-feature lots cutover hex factory + .map toSnapshot bridge)
 *   - app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx (target consumer type migration)
 *   - app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx (target cross-feature lots prop type migration)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C5 cutover targets (4 archivos paired-lot side) ──

const LOT_DETAIL_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx",
);
const FARM_DETAIL_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx",
);
const LOT_DETAIL_CLIENT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx",
);
const FARM_DETAIL_CLIENT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx",
);

// ── Regex patterns (positive ^import...m anchor + negative legacy not.toMatch) ──

const IMPORT_MAKE_LOT_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeLotService\b[^}]*\}\s*from\s*["']@\/modules\/lot\/presentation\/server["']/m;
const LEGACY_FEATURES_LOTS_IMPORT_RE =
  /from\s+["']@\/features\/lots(?:\/server)?["']/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;
const NEW_LOTS_SERVICE_CTOR_RE = /new\s+LotsService\s*\(/;
const IMPORT_LOT_SNAPSHOT_HEX_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bLotSnapshot\b[^}]*\}\s*from\s*["']@\/modules\/lot\/presentation\/server["']/m;
const IMPORT_LOT_SUMMARY_HEX_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bLotSummary\b[^}]*\}\s*from\s*["']@\/modules\/lot\/presentation\/server["']/m;
const LEGACY_CHICKEN_LOT_PRISMA_IMPORT_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bChickenLot\b[^}]*\}\s*from\s*["']@\/generated\/prisma\/client["']/m;

describe("POC paired farms+lots C5 — cutover UI pages lots hex factory + `.toSnapshot()` bridge per call site MANDATORY + consumer client type migration shape (paired-lot side, Marco lock D1=a Prisma raw paired sister + D2=a atomic single batch ~10 archivos paired sister C5-C6 14 archivos EXACT precedent + D3=a Q7A `{ lot, summary }` confirmado + D5=a client migrate inline mismo batch + D6 dialogs EXCLUSIÓN honest correction + D7=a Opt A existence-only)", () => {
  // ── A: lots/[lotId]/page.tsx cutover (α14-α17) ────────────────────────────

  it("α14: app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx imports `makeLotService` from `@/modules/lot/presentation/server` (cutover legacy class ctor `new LotsService()` → hex factory Path α direct mecánico mirror C4 routes precedent EXACT)", () => {
    const source = fs.readFileSync(LOT_DETAIL_PAGE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_LOT_SERVICE_HEX_RE);
  });

  it("α15: lots/[lotId]/page.tsx does NOT import from `@/features/lots` NOR `@/features/lots/server` (legacy class+types dropped post-cutover, ADDITIVE strategy preserva features/lots/* intactos hasta C7 wholesale delete)", () => {
    const source = fs.readFileSync(LOT_DETAIL_PAGE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_LOTS_IMPORT_RE);
  });

  it("α16: lots/[lotId]/page.tsx contains `.toSnapshot()` call (Q7A summary.lot RSC boundary serialization adapter bridge MANDATORY per call site — cutover-consumer-return-shape-verification-gate canonical home #1774 8va evidencia matures cumulative cross-POC)", () => {
    const source = fs.readFileSync(LOT_DETAIL_PAGE, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_RE);
  });

  it("α17: lots/[lotId]/page.tsx does NOT contain `new LotsService(` literal (legacy class ctor instantiation dropped post-cutover, ADDITIVE preserve legacy intactos features/lots/lots.service.ts hasta C7)", () => {
    const source = fs.readFileSync(LOT_DETAIL_PAGE, "utf8");
    expect(source).not.toMatch(NEW_LOTS_SERVICE_CTOR_RE);
  });

  // ── B: farms/[farmId]/page.tsx cross-feature lots cutover (α18-α20) ───────

  it("α18: app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx imports `makeLotService` from `@/modules/lot/presentation/server` (cross-feature consumer within farm-detail page — lots listByFarm cutover scope INCLUIDO esta cycle paired sister C5-C6 precedent EXACT mirror)", () => {
    const source = fs.readFileSync(FARM_DETAIL_PAGE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_LOT_SERVICE_HEX_RE);
  });

  it("α19: farms/[farmId]/page.tsx does NOT import from `@/features/lots` NOR `@/features/lots/server` (legacy class+types dropped post-cutover)", () => {
    const source = fs.readFileSync(FARM_DETAIL_PAGE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_LOTS_IMPORT_RE);
  });

  it("α20: farms/[farmId]/page.tsx contains `.toSnapshot()` call (lots[] map bridge MANDATORY per call site listByFarm Lot entity[] → cross RSC boundary — `.map((l) => l.toSnapshot())` paired sister Opción C precedent A5-C1 5ta aplicación cumulative cross-POC)", () => {
    const source = fs.readFileSync(FARM_DETAIL_PAGE, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_RE);
  });

  // ── C: lot-detail-client.tsx consumer type migration (α21-α23) ────────────

  it("α21: app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx imports `LotSnapshot` from `@/modules/lot/presentation/server` (Q7A `{ lot, summary }` consume hex types — paired sister C5-C6 EXACT mirror precedent Marco lock D5=a client migrate inline)", () => {
    const source = fs.readFileSync(LOT_DETAIL_CLIENT, "utf8");
    expect(source).toMatch(IMPORT_LOT_SNAPSHOT_HEX_RE);
  });

  it("α22: lot-detail-client.tsx imports `LotSummary` from `@/modules/lot/presentation/server` (hex LotSummary VO shape divergence vs legacy LotSummary POJO — Q7A consume server-side compose result hex divergence inline mismo batch)", () => {
    const source = fs.readFileSync(LOT_DETAIL_CLIENT, "utf8");
    expect(source).toMatch(IMPORT_LOT_SUMMARY_HEX_RE);
  });

  it("α23: lot-detail-client.tsx does NOT import from `@/features/lots` NOR `@/features/lots/server` (legacy types dropped post-cutover)", () => {
    const source = fs.readFileSync(LOT_DETAIL_CLIENT, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_LOTS_IMPORT_RE);
  });

  // ── D: farm-detail-client.tsx cross-feature lots prop migration (α24-α26) ─

  it("α24: app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx imports `LotSnapshot` from `@/modules/lot/presentation/server` (separate `lots` prop type migration ChickenLot Prisma raw[] → LotSnapshot hex DTO[] paired sister C5-C6 EXACT mirror precedent — cross-feature consumer migration inline mismo batch D5=a)", () => {
    const source = fs.readFileSync(FARM_DETAIL_CLIENT, "utf8");
    expect(source).toMatch(IMPORT_LOT_SNAPSHOT_HEX_RE);
  });

  it("α25: farm-detail-client.tsx does NOT import `ChickenLot` from `@/generated/prisma/client` (cross-feature lots prop type migration post-cutover — RSC boundary serialization adapter compliant)", () => {
    const source = fs.readFileSync(FARM_DETAIL_CLIENT, "utf8");
    expect(source).not.toMatch(LEGACY_CHICKEN_LOT_PRISMA_IMPORT_RE);
  });

  it("α26: farms/[farmId]/page.tsx does NOT contain `new LotsService(` literal (legacy class ctor instantiation dropped post-cutover paired α17 lots/[lotId]/page.tsx mirror — ADDITIVE preserve legacy intactos features/lots/lots.service.ts hasta C7)", () => {
    const source = fs.readFileSync(FARM_DETAIL_PAGE, "utf8");
    expect(source).not.toMatch(NEW_LOTS_SERVICE_CTOR_RE);
  });
});
