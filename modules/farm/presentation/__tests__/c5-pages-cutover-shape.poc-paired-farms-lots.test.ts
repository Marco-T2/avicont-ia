/**
 * POC paired farms+lots C5 RED — cutover UI pages farms hex factory invocation
 * + NEW `attachLots` infrastructure bridge (paired sister `contact-attacher.ts`
 * EXACT mirror precedent C5-C6 paired payables/receivables) + NEW DTO type
 * `FarmSnapshotWithLots` presentation export + consumer client type migration
 * `farms-client.tsx` (paired-farm side, paired sister mirror lot).
 *
 * Axis: cutover UI page invocation patterns from legacy class ctor
 * `new FarmsService()` → hex factory `makeFarmService()` + NEW infrastructure
 * lots attacher `attachLots(orgId, items)` bridge per call site MANDATORY
 * paired sister `contact-attacher.ts` EXACT mirror precedent A5-C1 4ta
 * aplicación cumulative cross-POC (`prisma.chickenLot.findMany` Prisma raw
 * access NO cross-module hex coupling — paired sister §13 NEW
 * `lots-attacher-prisma-direct-vs-cross-module-hex-coupling-axis-distinct`
 * 1ra evidencia matures Marco lock D1=a aprobado). NEW DTO presentation
 * `FarmSnapshotWithLots = FarmSnapshot & { lots: ChickenLot[] }` paired sister
 * `PayableSnapshotWithContact = PayableSnapshot & { contact: Contact }` EXACT
 * mirror cementado D8 paired sister C5-C6 closure (§13.B-paired letter NEW
 * classification "DTO drop axis paired" 9na evidencia matures cumulative cross-POC
 * recursive aplicación forward `farm-snapshot-with-lots-prisma-raw-vs-lot-snapshot-cross-module-axis-distinct`
 * 1ra evidencia matures Marco lock D1=a aprobado).
 *
 * RSC boundary serialization adapter pattern MANDATORY per call site (paired
 * sister `cutover-consumer-return-shape-verification-gate` canonical home
 * #1774 8va evidencia matures cumulative cross-POC — hotfix-correctivo-contacts
 * 12 callsites cumulative precedent EXACT mirror): pages consume Farm entity
 * + Lot entity returns from hex services → cross RSC boundary → consumer
 * client React component → `JSON.stringify(entity)` serializes propiedades
 * propias NO getters de clase → consumer access fails undefined → bug runtime
 * latente. Bridge `.toSnapshot()` per call site mandatorio atomic mismo GREEN
 * commit (Opción C Path α direct entity → snapshot mapping mirror paired sister
 * contact-attacher.ts línea 22 `items.map((p) => ({ ...p.toSnapshot(), contact: byId.get(p.contactId)! }))`).
 *
 * Marco lock D1=a (FarmSnapshot & { lots: ChickenLot[] } Prisma raw mirror
 * paired sister Contact prisma type EXACT) + D2=a (atomic single batch ~10
 * archivos paired sister C5-C6 14 archivos EXACT mirror precedent) + D3=a
 * (Q7A `{ lot, summary }` return shape getSummary hex confirmado) + D5=a
 * (mismo batch C5 consumer client migrate inline paired sister C5-C6 EXACT)
 * + D6 (dialogs EXCLUSIÓN honest correction bookmark scope mention erróneo —
 * `evidence-supersedes-assumption-lock` 18ma matures cumulative cross-POC,
 * dialogs no consumer types verified Step 0 expand recon) + D7=a (Opt A
 * existence-only regex shape mirror C0-C4 convention preserve forward).
 * Auth pattern legacy preserved EXACT mirror Marco lock heredado D2 Opt B
 * C4 (requireAuth+requireOrgAccess returning organizationId directly — RBAC
 * migration cross-POC out-of-scope per `feedback/farm-lot-routes-auth-pattern-legacy-vs-canonical-require-permission-cleanup-pending`
 * 13mo cumulative cross-POC).
 *
 * 6 archivos cutover INCLUIDOS paired-farm side Marco lock D2 atomic single
 * batch paired sister C0/C1/C2/C3/C4 EXACT precedent:
 *   1. modules/farm/infrastructure/lots-attacher.ts (NEW source greenfield
 *      paired sister contact-attacher.ts EXACT mirror — prisma.chickenLot
 *      .findMany + group by farmId + map toSnapshot)
 *   2. modules/farm/presentation/composition-root.ts (EDIT re-export attachLots
 *      from ../infrastructure/lots-attacher mirror paired sister)
 *   3. modules/farm/presentation/server.ts (EDIT re-export attachLots from
 *      ./composition-root + NEW export type FarmSnapshotWithLots = FarmSnapshot
 *      & { lots: ChickenLot[] } + NEW import type ChickenLot from
 *      @/generated/prisma/client mirror paired sister Contact)
 *   4. app/(dashboard)/[orgSlug]/farms/page.tsx (cutover legacy class
 *      `new FarmsService()` → hex `makeFarmService()` + attachLots bridge
 *      per call site list/listByMember)
 *   5. app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx (cutover legacy
 *      class → hex factory + .toSnapshot() bridge per call site getById)
 *   6. app/(dashboard)/[orgSlug]/farms/farms-client.tsx (consumer type
 *      migration FarmWithLots → FarmSnapshotWithLots paired sister C5-C6
 *      payable-list/receivable-list EXACT mirror precedent)
 *
 * Marco lock final RED scope C5 (13 assertions α paired-farm side — paired
 * sister mirror lot 13 assertions = 26 paired total Marco aprobado pre-RED-α
 * paired sister C5-C6 13/13 per side EXACT precedent):
 *
 *   ── A: lots-attacher NEW infrastructure (Tests α1-α4) ──
 *     α1 modules/farm/infrastructure/lots-attacher.ts FILE EXISTS (paired sister
 *        contact-attacher.ts EXACT mirror precedent — Marco lock D1=a infrastructure
 *        layer composition pattern paired sister cumulative cross-POC)
 *     α2 lots-attacher.ts exports `attachLots` async function (paired sister
 *        `attachContacts` mirror — signature `(orgId, items: Farm[]) => Promise<FarmSnapshotWithLots[]>`)
 *     α3 lots-attacher.ts queries `prisma.chickenLot.findMany` (Prisma raw
 *        access infrastructure boundary — paired sister `prisma.contact.findMany`
 *        EXACT mirror Marco lock D1=a NO cross-module hex coupling axis-distinct)
 *     α4 lots-attacher.ts uses `.toSnapshot()` Path α direct entity → snapshot
 *        mapping (paired sister `p.toSnapshot()` línea 22 EXACT mirror Opción C
 *        precedent A5-C1 5ta aplicación cumulative cross-POC matures)
 *
 *   ── B: presentation hex wiring (Tests α5-α7) ──
 *     α5 composition-root.ts re-exports `attachLots` from `../infrastructure/lots-attacher`
 *        (paired sister payables composition-root mirror precedent — barrel chain
 *        wiring infrastructure → presentation)
 *     α6 server.ts re-exports `attachLots` from `./composition-root` (paired
 *        sister `server.ts` mirror línea 54 EXACT precedent — public API surface
 *        consumer pages import single source `@/modules/farm/presentation/server`)
 *     α7 server.ts exports type `FarmSnapshotWithLots = FarmSnapshot & { lots: ChickenLot[] }`
 *        (NEW DTO paired sister `PayableSnapshotWithContact` línea 56 EXACT mirror
 *        precedent — Marco lock D1=a Prisma raw ChickenLot type composition NO
 *        cross-module hex LotSnapshot coupling)
 *
 *   ── C: farms/page.tsx cutover (Tests α8-α10) ──
 *     α8 farms/page.tsx imports `makeFarmService` from `@/modules/farm/presentation/server`
 *        (cutover legacy class ctor `new FarmsService()` → hex factory Path α
 *        direct mecánico mirror C4 routes precedent EXACT)
 *     α9 farms/page.tsx imports `attachLots` from `@/modules/farm/presentation/server`
 *        (bridge MANDATORY per call site list/listByMember return Farm[] → cross
 *        RSC boundary → consumer farms-client.tsx receives FarmSnapshotWithLots[]
 *        — paired sister `attachContacts` invocation pattern EXACT mirror)
 *     α10 farms/page.tsx does NOT import from `@/features/farms` NOR
 *         `@/features/farms/server` (legacy class+types dropped post-cutover,
 *         ADDITIVE strategy preserva features/farms/* intactos hasta C7 wholesale
 *         delete per Marco lock heredado D1 Opt C C4 precedent EXACT)
 *
 *   ── D: farms/[farmId]/page.tsx cutover (Tests α11-α12) ──
 *     α11 farms/[farmId]/page.tsx imports `makeFarmService` from hex (cutover
 *         legacy `new FarmsService()` → factory + `.toSnapshot()` bridge MANDATORY
 *         per call site getById return Farm entity)
 *     α12 farms/[farmId]/page.tsx does NOT import from `@/features/farms` NOR
 *         `@/features/farms/server` (legacy class+types dropped post-cutover)
 *
 *   ── E: farms-client.tsx consumer type migration (Test α13) ──
 *     α13 farms-client.tsx imports `FarmSnapshotWithLots` from
 *         `@/modules/farm/presentation/server` (consumer prop type migration
 *         FarmWithLots legacy → FarmSnapshotWithLots hex DTO paired sister C5-C6
 *         payable-list/receivable-list EXACT mirror precedent — Marco lock D5=a
 *         mismo batch C5 client migrate inline)
 *
 * Expected RED failure mode pre-GREEN per `feedback_red_acceptance_failure_mode`:
 *   - α1 FAIL ENOENT — archivo `modules/farm/infrastructure/lots-attacher.ts`
 *     NO existe pre-GREEN (greenfield NEW source file paired sister
 *     contact-attacher.ts mirror precedent)
 *   - α2-α4 FAIL ENOENT cascade (file read throws or empty content regex match
 *     falla — file does not exist pre-GREEN)
 *   - α5 FAIL behavioral assertion mismatch — composition-root.ts hoy NO
 *     re-exporta attachLots (solo makeFarmService + makeFarmRepository +
 *     PrismaFarmRepository post-C2 cementado)
 *   - α6 FAIL behavioral assertion mismatch — server.ts hoy NO re-exporta
 *     attachLots (solo Farm + FarmSnapshot + FarmService + etc post-C3
 *     cementado)
 *   - α7 FAIL behavioral assertion mismatch — server.ts hoy NO exporta type
 *     `FarmSnapshotWithLots` (greenfield NEW DTO type pendiente C5)
 *   - α8 FAIL behavioral assertion mismatch — farms/page.tsx hoy importa
 *     `import { FarmsService } from "@/features/farms/server"` legacy class.
 *     Regex `^import...makeFarmService...from "@/modules/farm/presentation/server"`
 *     match falla.
 *   - α9 FAIL behavioral assertion mismatch — farms/page.tsx hoy NO importa
 *     attachLots (greenfield NEW bridge pendiente C5)
 *   - α10 FAIL behavioral assertion mismatch — farms/page.tsx hoy importa
 *     legacy paths `@/features/farms/server` + `@/features/farms`. `not.toMatch`
 *     legacy import path expectation reverses (legacy PRESENT pre-cutover).
 *   - α11 FAIL behavioral assertion mismatch — farms/[farmId]/page.tsx hoy
 *     importa `FarmsService` + `LotsService` legacy classes. Regex hex factory
 *     match falla.
 *   - α12 FAIL behavioral assertion mismatch — farms/[farmId]/page.tsx hoy
 *     importa legacy paths `@/features/farms/server` + `@/features/lots/server`.
 *     `not.toMatch` `@/features/farms` reverses.
 *   - α13 FAIL behavioral assertion mismatch — farms-client.tsx hoy importa
 *     `import type { FarmWithLots } from "@/features/farms"` legacy POJO type.
 *     Regex hex `FarmSnapshotWithLots` import from `@/modules/farm/presentation/server`
 *     match falla.
 * Total expected FAIL pre-GREEN: 13/13 farm side (paired sister 13/13 lot =
 * 26/26 total cumulative cross-POC `feedback_enumerated_baseline_failure_ledger`
 * 16ma matures cumulative cross-POC recursive aplicación forward).
 *
 * Self-contained future-proof check: shape test asserta paths
 * `app/(dashboard)/[orgSlug]/farms/...` + `modules/farm/{infrastructure,presentation}/...`
 * que persisten post C7 wholesale delete `features/farms/`. Test vive en
 * `modules/farm/presentation/__tests__/` mirror C4 precedent EXACT — NO toca
 * `features/farms/*` que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Cross-ref:
 *   - engram `poc-paired-farms-lots/c4/closed` #1844 (cycle-start bookmark
 *     C5 heredado — D1-D4 locks aplicados + 6 cross-feature legacy consumers
 *     preservados intactos via ADDITIVE strategy)
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
 *     enumerated behavioral assertion mismatch paired-farm side)
 *   - engram `feedback_red_regex_discipline` (^import...m anchor + ?? optional
 *     Marco lock convention preserved 16ma matures cumulative cross-POC)
 *   - engram `feedback_enumerated_baseline_failure_ledger` (16ma matures
 *     cumulative cross-POC per-α explicit ledger)
 *   - modules/payables/infrastructure/contact-attacher.ts (paired sister
 *     EXACT mirror precedent line-by-line for lots-attacher.ts greenfield)
 *   - modules/payables/presentation/server.ts (paired sister line 54
 *     `export { attachContact, attachContacts } from "./composition-root"` +
 *     línea 56 `export type PayableSnapshotWithContact = PayableSnapshot & { contact: Contact }`
 *     EXACT mirror precedent)
 *   - modules/farm/infrastructure/lots-attacher.ts (target NEW greenfield source)
 *   - modules/farm/presentation/composition-root.ts (target EDIT re-export attachLots)
 *   - modules/farm/presentation/server.ts (target EDIT re-export attachLots +
 *     NEW export type FarmSnapshotWithLots)
 *   - app/(dashboard)/[orgSlug]/farms/page.tsx (target cutover hex factory + attachLots bridge)
 *   - app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx (target cutover hex factory)
 *   - app/(dashboard)/[orgSlug]/farms/farms-client.tsx (target consumer type migration)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C5 cutover targets (6 archivos paired-farm side) ──

const LOTS_ATTACHER = path.join(
  REPO_ROOT,
  "modules/farm/infrastructure/lots-attacher.ts",
);
const COMP_ROOT = path.join(
  REPO_ROOT,
  "modules/farm/presentation/composition-root.ts",
);
const SERVER = path.join(
  REPO_ROOT,
  "modules/farm/presentation/server.ts",
);
const FARMS_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/farms/page.tsx",
);
const FARM_DETAIL_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx",
);
const FARMS_CLIENT = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/farms/farms-client.tsx",
);

// ── Regex patterns (positive ^import...m anchor + negative legacy not.toMatch) ──

const ATTACH_LOTS_FN_RE =
  /export\s+(?:async\s+)?function\s+attachLots\s*\(/;
const PRISMA_CHICKEN_LOT_QUERY_RE = /prisma\.chickenLot\.findMany/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;
const COMP_ROOT_REEXPORT_ATTACH_LOTS_RE =
  /export\s*\{[^}]*\battachLots\b[^}]*\}\s*from\s*["']\.\.\/infrastructure\/lots-attacher["']/;
const SERVER_REEXPORT_ATTACH_LOTS_RE =
  /export\s*\{[^}]*\battachLots\b[^}]*\}\s*from\s*["']\.\/composition-root["']/;
const FARM_SNAPSHOT_WITH_LOTS_TYPE_RE =
  /export\s+type\s+FarmSnapshotWithLots\s*=/;
const IMPORT_MAKE_FARM_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeFarmService\b[^}]*\}\s*from\s*["']@\/modules\/farm\/presentation\/server["']/m;
const IMPORT_ATTACH_LOTS_HEX_RE =
  /^import\s*\{[^}]*\battachLots\b[^}]*\}\s*from\s*["']@\/modules\/farm\/presentation\/server["']/m;
const LEGACY_FEATURES_FARMS_IMPORT_RE =
  /from\s+["']@\/features\/farms(?:\/server)?["']/;
const IMPORT_FARM_SNAPSHOT_WITH_LOTS_HEX_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bFarmSnapshotWithLots\b[^}]*\}\s*from\s*["']@\/modules\/farm\/presentation\/server["']/m;

describe("POC paired farms+lots C5 — cutover UI pages farms hex factory + NEW attachLots infrastructure bridge + NEW FarmSnapshotWithLots DTO presentation + consumer client type migration shape (paired-farm side, Marco lock D1=a Prisma raw ChickenLot mirror paired sister Contact + D2=a atomic single batch ~10 archivos paired sister C5-C6 14 archivos EXACT precedent + D3=a Q7A `{ lot, summary }` confirmado + D5=a client migrate inline mismo batch + D6 dialogs EXCLUSIÓN honest correction + D7=a Opt A existence-only)", () => {
  // ── A: lots-attacher NEW infrastructure file (α1-α4) ──────────────────────

  it("α1: modules/farm/infrastructure/lots-attacher.ts FILE EXISTS (paired sister contact-attacher.ts EXACT mirror precedent — Marco lock D1=a infrastructure layer composition pattern paired sister cumulative cross-POC, NEW source greenfield C5 atomic single batch)", () => {
    expect(fs.existsSync(LOTS_ATTACHER)).toBe(true);
  });

  it("α2: lots-attacher.ts exports `attachLots` async function (paired sister `attachContacts` mirror — signature `(orgId, items: Farm[]) => Promise<FarmSnapshotWithLots[]>`)", () => {
    const source = fs.readFileSync(LOTS_ATTACHER, "utf8");
    expect(source).toMatch(ATTACH_LOTS_FN_RE);
  });

  it("α3: lots-attacher.ts queries `prisma.chickenLot.findMany` (Prisma raw access infrastructure boundary — paired sister `prisma.contact.findMany` EXACT mirror Marco lock D1=a NO cross-module hex coupling axis-distinct §13 NEW lots-attacher-prisma-direct-vs-cross-module-hex-coupling-axis-distinct 1ra evidencia matures)", () => {
    const source = fs.readFileSync(LOTS_ATTACHER, "utf8");
    expect(source).toMatch(PRISMA_CHICKEN_LOT_QUERY_RE);
  });

  it("α4: lots-attacher.ts uses `.toSnapshot()` Path α direct entity → snapshot mapping (paired sister `p.toSnapshot()` línea 22 EXACT mirror Opción C precedent A5-C1 5ta aplicación cumulative cross-POC matures)", () => {
    const source = fs.readFileSync(LOTS_ATTACHER, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_RE);
  });

  // ── B: presentation hex wiring (α5-α7) ────────────────────────────────────

  it("α5: composition-root.ts re-exports `attachLots` from `../infrastructure/lots-attacher` (paired sister payables composition-root mirror precedent — barrel chain wiring infrastructure → presentation)", () => {
    const source = fs.readFileSync(COMP_ROOT, "utf8");
    expect(source).toMatch(COMP_ROOT_REEXPORT_ATTACH_LOTS_RE);
  });

  it("α6: server.ts re-exports `attachLots` from `./composition-root` (paired sister `server.ts` mirror línea 54 EXACT precedent — public API surface consumer pages import single source `@/modules/farm/presentation/server`)", () => {
    const source = fs.readFileSync(SERVER, "utf8");
    expect(source).toMatch(SERVER_REEXPORT_ATTACH_LOTS_RE);
  });

  it("α7: server.ts exports type `FarmSnapshotWithLots = FarmSnapshot & { lots: ChickenLot[] }` (NEW DTO paired sister `PayableSnapshotWithContact` línea 56 EXACT mirror precedent — Marco lock D1=a Prisma raw ChickenLot type composition NO cross-module hex LotSnapshot coupling §13 NEW farm-snapshot-with-lots-prisma-raw-vs-lot-snapshot-cross-module-axis-distinct 1ra evidencia matures)", () => {
    const source = fs.readFileSync(SERVER, "utf8");
    expect(source).toMatch(FARM_SNAPSHOT_WITH_LOTS_TYPE_RE);
  });

  // ── C: farms/page.tsx cutover (α8-α10) ────────────────────────────────────

  it("α8: app/(dashboard)/[orgSlug]/farms/page.tsx imports `makeFarmService` from `@/modules/farm/presentation/server` (cutover legacy class ctor `new FarmsService()` → hex factory Path α direct mecánico mirror C4 routes precedent EXACT)", () => {
    const source = fs.readFileSync(FARMS_PAGE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_FARM_SERVICE_HEX_RE);
  });

  it("α9: farms/page.tsx imports `attachLots` from `@/modules/farm/presentation/server` (bridge MANDATORY per call site list/listByMember return Farm[] → cross RSC boundary → consumer farms-client.tsx receives FarmSnapshotWithLots[] — paired sister `attachContacts` invocation pattern EXACT mirror, cutover-consumer-return-shape-verification-gate 8va evidencia matures)", () => {
    const source = fs.readFileSync(FARMS_PAGE, "utf8");
    expect(source).toMatch(IMPORT_ATTACH_LOTS_HEX_RE);
  });

  it("α10: farms/page.tsx does NOT import from `@/features/farms` NOR `@/features/farms/server` (legacy class+types dropped post-cutover, ADDITIVE strategy preserva features/farms/* intactos hasta C7 wholesale delete per Marco lock heredado D1 Opt C C4 precedent EXACT)", () => {
    const source = fs.readFileSync(FARMS_PAGE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_FARMS_IMPORT_RE);
  });

  // ── D: farms/[farmId]/page.tsx cutover (α11-α12) ──────────────────────────

  it("α11: app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx imports `makeFarmService` from `@/modules/farm/presentation/server` (cutover legacy `new FarmsService()` → factory + `.toSnapshot()` bridge MANDATORY per call site getById return Farm entity)", () => {
    const source = fs.readFileSync(FARM_DETAIL_PAGE, "utf8");
    expect(source).toMatch(IMPORT_MAKE_FARM_SERVICE_HEX_RE);
  });

  it("α12: farms/[farmId]/page.tsx does NOT import from `@/features/farms` NOR `@/features/farms/server` (legacy class+types dropped post-cutover)", () => {
    const source = fs.readFileSync(FARM_DETAIL_PAGE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_FARMS_IMPORT_RE);
  });

  // ── E: farms-client.tsx consumer type migration (α13) ─────────────────────

  it("α13: app/(dashboard)/[orgSlug]/farms/farms-client.tsx imports `FarmSnapshotWithLots` from `@/modules/farm/presentation/server` (consumer prop type migration FarmWithLots legacy → FarmSnapshotWithLots hex DTO paired sister C5-C6 payable-list/receivable-list EXACT mirror precedent — Marco lock D5=a mismo batch C5 client migrate inline)", () => {
    const source = fs.readFileSync(FARMS_CLIENT, "utf8");
    expect(source).toMatch(IMPORT_FARM_SNAPSHOT_WITH_LOTS_HEX_RE);
  });
});
