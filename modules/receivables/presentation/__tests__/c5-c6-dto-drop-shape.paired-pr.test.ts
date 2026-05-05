/**
 * POC paired payables↔receivables C5-C6 RED — drop legacy POJO type defs +
 * DTO divergence paired axis (cxc side, paired sister mirror payables).
 *
 * Axis: §13.B-paired NEW classification "DTO drop axis paired" emergent C5-C6
 * — drop `ReceivableWithContact` POJO Prisma DTO + `OpenAggregate` POJO duplicate
 * desde `features/receivables/receivables.types.ts` wholesale; introduce NEW
 * hex DTO `ReceivableSnapshotWithContact = ReceivableSnapshot & { contact: Contact }`
 * exported desde `modules/receivables/presentation/server.ts`. Bridge
 * `attachContact[s]` contract evolves: returns
 * `Promise<ReceivableSnapshotWithContact>` (drop `Prisma.Decimal` reconstruction
 * mapper interno simplifica). Path α direct `.toSnapshot()` invocation
 * post-simplify (mirror Opción C precedent A5-C1 `.toSnapshot()` adapter —
 * divergence vs C3-C4 Opción A bridge Decimal reconstruction). Marco lock final
 * pre-RED Path C5C — drop POJO entirely + Snapshot+Contact hex composition.
 *
 * §13.B-paired letter NEW classification cementación target D8 — sale/purchase
 * NUNCA tuvieron POJO Prisma DTO (`SaleWithContact`/`PurchaseWithContact` NO
 * existen verified Step 0 expand grep PROJECT-scope). Pattern emergent UNIQUE
 * a payables/receivables (legacy A1+A2 pre-hex). C5-C6 establishes NEW pattern
 * forward-applicable cualquier feature legacy con Prisma POJO DTO + contact
 * join shape.
 *
 * 7 archivos targeted paired-receivables side single atomic mirror C3-C4 precedent
 * EXACT estricto Path C5C drop POJO entirely:
 *   1. features/receivables/receivables.types.ts (drop POJO defs ReceivableWithContact + OpenAggregate)
 *   2. modules/receivables/presentation/server.ts (NEW export ReceivableSnapshotWithContact hex DTO)
 *   3. modules/receivables/infrastructure/contact-attacher.ts (drop local POJO def + drop Prisma.Decimal reconstruction + .toSnapshot() simplify)
 *   4. components/accounting/receivable-list.tsx (consumer swap ReceivableWithContact → ReceivableSnapshotWithContact via @/modules/receivables/presentation/server)
 *   5. features/receivables/receivables.service.ts (legacy shim swap return types via hex import)
 *   6. modules/receivables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts (textual cascade DENTRO Marco lock R5 absorbed)
 *   7. modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts (textual cascade DENTRO)
 *
 * Marco lock final RED scope C5-C6 (13 assertions α paired-receivables side —
 * paired sister mirror payables 13 assertions = 26 paired total Marco
 * confirmed pre-RED single atomic mirror C3-C4 magnitude EXACT):
 *
 *   ── A: Legacy POJO type defs DROPPED features/receivables/receivables.types.ts (Tests 1-2) ──
 *     T1 features/receivables/receivables.types.ts does NOT contain `ReceivableWithContact` literal (POJO Prisma DTO drop entirely §13.B-paired)
 *     T2 features/receivables/receivables.types.ts does NOT contain `OpenAggregate` literal (POJO duplicate de hex drop)
 *
 *   ── B: NEW hex DTO exported modules/receivables/presentation/server.ts (Tests 3-4) ──
 *     T3 server.ts contains `ReceivableSnapshotWithContact` literal (NEW hex DTO export §13.B-paired)
 *     T4 server.ts contains `ReceivableSnapshot & { contact: Contact }` composition shape (entity Snapshot intersection Contact)
 *
 *   ── C: Bridge mapper simplification + Decimal reconstruction DROP (Tests 5-7) ──
 *     T5 modules/receivables/infrastructure/contact-attacher.ts does NOT contain `type ReceivableWithContact` local def (drop duplicate)
 *     T6 contact-attacher.ts does NOT contain `Prisma.Decimal` instantiation (drop reconstruction mapper interno simplifica)
 *     T7 contact-attacher.ts contains `.toSnapshot()` invocation (Path α direct entity → snapshot mapping post-simplify)
 *
 *   ── D: Component consumer swap a hex (Tests 8-9) ──
 *     T8 components/accounting/receivable-list.tsx imports `ReceivableSnapshotWithContact` from `@/modules/receivables/presentation/server` (type-only hex consumer swap)
 *     T9 components/accounting/receivable-list.tsx does NOT contain `ReceivableWithContact` literal (legacy POJO consumer drop)
 *
 *   ── E: Legacy shim service.ts swap a hex types (Tests 10-11) ──
 *     T10 features/receivables/receivables.service.ts imports `ReceivableSnapshotWithContact` from `@/modules/receivables/presentation/server`
 *     T11 features/receivables/receivables.service.ts does NOT contain `ReceivableWithContact` literal (legacy shim type drop pre-C7 wholesale)
 *
 *   ── F: Tests c1b + c3-c4 cascade DENTRO textual swap (Tests 12-13) ──
 *     T12 modules/receivables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts does NOT contain `ReceivableWithContact` literal (textual cascade DENTRO Marco lock R5 absorbed — invariant collision elevation absorbed)
 *     T13 modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts does NOT contain `ReceivableWithContact` literal (textual cascade DENTRO)
 *
 * Marco locks aplicados pre-RED C5-C6:
 *   - L1: Path C5C (drop POJO entirely + ReceivableSnapshotWithContact hex DTO)
 *     vs C5A (relocate POJO) y C5B (drop features only). Cleaner long-term —
 *     eliminates Decimal reconstruction overhead bridge, alineado bookmark
 *     "entity Snapshot" mention, §13.B-paired pattern strong forward-applicable.
 *   - L2: Granularity single C5-C6 atomic (mirror C3-C4 precedent EXACT estricto)
 *     — single commit atomic 12-15 archivos paired single batch.
 *   - L3: Tests c1b + c3-c4 cascade DENTRO C5-C6 ciclo (invariant collision
 *     elevation R5 absorbed) — paired sister test textual swaps integrados
 *     GREEN time, NO escalan a C7-prelude.
 *   - L4: §13.B-paired letter assignment NEW classification "DTO drop axis
 *     paired" — cementación target D8 cumulative POC paired closure formal.
 *   - L5: Bridge contract evolution C5C — `attachContact[s]` returns
 *     `Promise<ReceivableSnapshotWithContact>` (drop Decimal reconstruction
 *     mapper interno simplifica). Mirror Opción C precedent A5-C1 `.toSnapshot()`
 *     adapter pattern — divergence vs C3-C4 Opción A bridge Decimal mantain.
 *
 * §13.A5-α paired sister sub-cycle continuation (9na evidencia matures cumulative
 * cross-§13 same POC paired): A5-C2a (3ra) → A5-C2b (4ta) → A5-C2c (5ta) → C0
 * (5ta + sister continuation) → C1a (6ta paired sister Path α direct Option B
 * inverso 2da aplicación) → C1b-α (7ma paired sister Option A push INTO
 * infrastructure/ functional move) → C3-C4 (8va paired sister Path α direct
 * factory swap + attachContact bridge §13.A5-γ Opción A NEW pattern emergent
 * 4ta aplicación post-cementación cumulative) → **C5-C6 (9na paired sister
 * Path C5C drop POJO + Snapshot+Contact hex DTO §13.B-paired NEW classification
 * emergent 5ta aplicación post-cementación cumulative)**.
 *
 * §13.B-paired DTO drop axis paired NEW classification emergent (NO existe en
 * docs/architecture.md verified Step 0 expand grep — cementación target D8):
 *   - Pre-cutover: `ReceivableWithContact = AccountsReceivable & { contact: Contact }`
 *     POJO Prisma DTO con `amount/paid/balance: Prisma.Decimal` (líneas 10-12
 *     features/receivables/receivables.types.ts). Bridge `attachContact[s]`
 *     mapper interno reconstructs `Prisma.Decimal` at infrastructure/ honor R5
 *     (post-C1b-α canonical R4 exception path).
 *   - Post-cutover: `ReceivableSnapshotWithContact = ReceivableSnapshot & { contact: Contact }`
 *     hex DTO con `amount/paid/balance: number` (entity Snapshot shape NO Decimal).
 *     Bridge mapper simplifica — uses `.toSnapshot()` direct entity → snapshot
 *     mapping (drop Decimal reconstruction overhead). Components consume hex
 *     Snapshot — `Number(r.amount)` keeps working (number → number identity
 *     vs string → number coercion previa).
 *   - Magnitude: 12 archivos paired total (6 per side: 2 features types/service
 *     + 1 hex barrel server.ts + 1 infrastructure/contact-attacher.ts + 1
 *     components/accounting/{X}-list.tsx + 2 paired test cascade c1b + c3-c4).
 *     Magnitude factor vs C3-C4 cutover (10 archivos paired) — slight uptick
 *     +20% expected cumulative growth multi-archivo type drop scope vs single-
 *     boundary cutover.
 *   - Forward-applicable: cualquier feature legacy con Prisma POJO DTO + contact
 *     join shape → §13.B-paired drop POJO + Snapshot+Contact hex DTO pattern
 *     aplica. Cementación target D8 NEW classification "DTO drop axis paired".
 *
 * §13.A5-γ Opción C `.toSnapshot()` adapter precedent A5-C1 4ta aplicación
 * post-cementación cumulative C5-C6 paired sister:
 *   - A5-C1 (1ra): voucher-types DTO divergence runtime path coverage 8 callsites
 *     Opción C 4 representative material 4× magnitud vs §13.A4-α precedent.
 *   - C5-C6 (4ta paired): bridge mapper simplification `.toSnapshot()` direct
 *     entity → snapshot mapping (drop Decimal reconstruction overhead). Mirror
 *     Opción C `.toSnapshot()` adapter pattern at infrastructure/ layer
 *     (boundary preservation honor — Snapshot exits infrastructure/, Contact
 *     attached at infrastructure/ boundary, R5 honored type-only Prisma at
 *     presentation layer hex barrel via `import type { Contact }` allowTypeImports).
 *
 * Sub-findings emergentes (Step 0 expand pre-RED):
 *   - EMERGENTE #1: §13.B-paired letter assignment NEW classification — sale/
 *     purchase NUNCA tuvieron POJO Prisma DTO confirmed grep PROJECT-scope
 *     `SaleWithContact`/`PurchaseWithContact` NO existen. Pattern UNIQUE legacy
 *     A1+A2 pre-hex.
 *   - EMERGENTE #2: invariant collision elevation R5 textual assertions tests
 *     c1b + c3-c4 — Marco lock cascade DENTRO C5-C6 absorbed. Tests still PASS
 *     post-GREEN (regexes don't reference legacy literal directly), pero textual
 *     comments docblock require swap para coherencia documental post-cutover.
 *   - EMERGENTE #3: bridge `attachContact[s]` contract evolution Snapshot+Contact
 *     — drops Decimal reconstruction overhead mapper interno simplifica. Mirror
 *     Opción C precedent A5-C1.
 *   - EMERGENTE #4: §13.A3-D4-α 17ª evidencia matures este Step 0.1 cycle-start
 *     cold post-bookmark D8 cementación target — cumulative 11ª-17ª = 7
 *     evidencias matures margin {6,9} envelope honored cumulative POC paired.
 *   - EMERGENTE #5: hex barrel server.ts adds `import type { Contact }` from
 *     prisma — R5 allowTypeImports presentation honored type-only erased at
 *     compile (NO runtime Prisma load chain).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1 FAIL: features/receivables/receivables.types.ts hoy contains
 *     `ReceivableWithContact` def línea 10 — `not.toMatch` legacy literal
 *     expectation reverses (literal PRESENT pre-cutover). Test fails on unwanted match.
 *   - T2 FAIL: features/receivables/receivables.types.ts hoy contains
 *     `OpenAggregate` interface línea 46 — `not.toMatch` falla.
 *   - T3 FAIL: modules/receivables/presentation/server.ts hoy NO contains
 *     `ReceivableSnapshotWithContact` (NEW type pendiente — would be added GREEN).
 *     Positive match falla.
 *   - T4 FAIL: server.ts hoy NO contains composition `ReceivableSnapshot & { contact:
 *     Contact }` (NEW shape pendiente). Positive match falla.
 *   - T5 FAIL: contact-attacher.ts hoy contains `type ReceivableWithContact` local
 *     def línea 12 — `not.toMatch` falla.
 *   - T6 FAIL: contact-attacher.ts hoy contains `Prisma.Decimal` reconstruction
 *     líneas 46-48 — `not.toMatch` falla.
 *   - T7 FAIL: contact-attacher.ts hoy NO contains `.toSnapshot()` invocation
 *     (mapper Decimal reconstruction pendiente simplify). Positive match falla.
 *   - T8 FAIL: components/accounting/receivable-list.tsx hoy imports
 *     `ReceivableWithContact` desde `@/features/receivables` (legacy import path
 *     pre-cutover). Positive match hex import path falla.
 *   - T9 FAIL: receivable-list.tsx hoy contains `ReceivableWithContact` literal
 *     multiple occurrences (líneas 43, 61, 72, 73, 94, 117...) — `not.toMatch` falla.
 *   - T10 FAIL: features/receivables/receivables.service.ts hoy imports legacy
 *     types desde `./receivables.types` (líneas 8-15 import block). Positive
 *     match hex import falla.
 *   - T11 FAIL: receivables.service.ts hoy contains `ReceivableWithContact`
 *     literal multiple occurrences (8 enumerated) — `not.toMatch` falla.
 *   - T12 FAIL: c1b test hoy contains `ReceivableWithContact` literal 5 occurrences
 *     textual docblock — `not.toMatch` falla.
 *   - T13 FAIL: c3-c4 test hoy contains `ReceivableWithContact` literal 6 occurrences
 *     textual docblock — `not.toMatch` falla.
 * Total expected FAIL pre-GREEN: 13/13 (Marco mandate failure mode honest enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L4): shape test
 * asserta paths `modules/receivables/...` que persisten post C7 wholesale delete
 * `features/receivables/`. Test vive en `modules/receivables/presentation/__tests__/` —
 * features/receivables/* targets (T1, T2, T10, T11) MUST get separately superseded
 * post-C7 wholesale. Self-contained vs future deletes verified ✓ — drop targets
 * simulate inevitable C7 wholesale outcome.
 *
 * Source-string assertion pattern: mirror precedent C3-C4 `a610ef6` + C1b-α
 * `ec83d7c` + C1a `5ca99cf` + C0 `d6b9f4d` + A5-C2b 14605bc (`fs.readFileSync`
 * regex match) — keep pattern paired POC. Departure note vs C3-C4: target
 * asserciones shifts de consumer surface invocation patterns (routes/pages
 * factory + bridge invocation) → DTO type def location + composition shape
 * (features types drop + hex barrel exports + infrastructure mapper simplify
 * + components/legacy-shim type consumer swap + paired test textual cascade).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α paired sister 8va evidencia matures (cementada C3-C4 `2278b11` paired closure)
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage Opción C precedent (cementada A5-D1 — 4ta aplicación post-cementación cumulative C5-C6 paired sister)
 *   - architecture.md §13.B-paired NEW classification "DTO drop axis paired" emergent C5-C6 cementación target D8 (NO existe en doc verified grep)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 (canonical home — paired sister 9na evidencia matures cumulative this RED C5-C6)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (formal cementación A5-D1 — Opción C `.toSnapshot()` adapter precedent 4ta aplicación post-cementación)
 *   - engram `poc-nuevo/paired-payables-receivables/c3-c4-closed` #1622 (cycle-start bookmark C5-C6 heredado)
 *   - engram `poc-nuevo/paired-payables-receivables/c1b-alpha-closed` #1620 (preceding cycle paired)
 *   - engram `poc-nuevo/paired-payables-receivables/c1a-closed` #1617 (preceding cycle paired)
 *   - engram `poc-nuevo/paired-payables-receivables/c0-closed` #1615 (preceding cycle paired)
 *   - engram `feedback/step-0-expand-eslint-restricted-imports-grep` #1619 (REFINED CR4+CR6 — Step 0 expand pre-RED grep ALL no-restricted-imports rules MANDATORY applied este turno)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 13/13 per side enumerated)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite + rationale + cross-ref applied RED body)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (Marco lock #3 PROACTIVE applied post-GREEN — cumulative cross-POC 7ma evidencia este RED→GREEN turn)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate suficiente post-RED Marco lock procedure)
 *   - engram `feedback_invariant_collision_elevation` (CR1-CR7 sequence catalog — applied tests c1b + c3-c4 textual cascade DENTRO C5-C6 R5 absorbed)
 *   - engram `feedback_jsdoc_atomic_revoke` (NO JSDoc revoke aplicó este turno — minimum scope honest cutover Path C5C drop)
 *   - features/receivables/receivables.types.ts (target T1+T2 — drop POJO Prisma DTO ReceivableWithContact + OpenAggregate)
 *   - features/receivables/receivables.service.ts (target T10+T11 — legacy shim swap a hex types pre-C7 wholesale)
 *   - modules/receivables/presentation/server.ts (target T3+T4 — NEW hex DTO ReceivableSnapshotWithContact composition shape)
 *   - modules/receivables/infrastructure/contact-attacher.ts (target T5+T6+T7 — drop local POJO def + Decimal reconstruction + .toSnapshot() simplify)
 *   - components/accounting/receivable-list.tsx (target T8+T9 — consumer swap hex import + drop legacy literal)
 *   - modules/receivables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts (target T12 — textual cascade DENTRO)
 *   - modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts (target T13 — textual cascade DENTRO)
 *   - modules/payables/presentation/__tests__/c5-c6-dto-drop-shape.paired-pr.test.ts (paired sister mirror RED this batch)
 *   - paired-pr-C0 RED `d6b9f4d` + GREEN `5f18aac` master (preceding ciclo paired POC)
 *   - paired-pr-C1a RED `5ca99cf` + GREEN `47449d8` master (preceding ciclo paired POC)
 *   - paired-pr-C1b-α RED `ec83d7c` + GREEN `89e6441` master (preceding ciclo paired POC)
 *   - paired-pr-C3-C4 RED `a610ef6` + GREEN `2278b11` master (preceding ciclo paired POC)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C5-C6 drop POJO + Snapshot+Contact hex DTO targets (7 archivos paired-receivables side) ──

const HEX_RECEIVABLES_SERVER = path.join(
  REPO_ROOT,
  "modules/receivables/presentation/server.ts",
);
const CONTACT_ATTACHER = path.join(
  REPO_ROOT,
  "modules/receivables/infrastructure/contact-attacher.ts",
);
const RECEIVABLE_LIST_COMPONENT = path.join(
  REPO_ROOT,
  "components/accounting/receivable-list.tsx",
);
const C1B_TEST_CASCADE = path.join(
  REPO_ROOT,
  "modules/receivables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts",
);
const C3_C4_TEST_CASCADE = path.join(
  REPO_ROOT,
  "modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const RECEIVABLE_WITH_CONTACT_RE = /\bReceivableWithContact\b/;
const RECEIVABLE_SNAPSHOT_WITH_CONTACT_RE = /\bReceivableSnapshotWithContact\b/;
const SNAPSHOT_CONTACT_COMPOSITION_RE =
  /ReceivableSnapshot\s*&\s*\{\s*contact\s*:\s*Contact\s*\}/;
const TYPE_RECEIVABLE_WITH_CONTACT_LOCAL_DEF_RE =
  /\btype\s+ReceivableWithContact\b/;
const PRISMA_DECIMAL_RE = /\bPrisma\.Decimal\b/;
const TO_SNAPSHOT_INVOCATION_RE = /\.toSnapshot\s*\(\s*\)/;
const HEX_RECEIVABLES_SERVER_IMPORT_RE =
  /from\s+["']@\/modules\/receivables\/presentation\/server["']/;

describe("POC paired payables↔receivables C5-C6 — drop legacy POJO type defs + DTO divergence paired axis (paired-receivables side, §13.B-paired NEW classification 'DTO drop axis paired' emergent + Path C5C drop POJO entirely + ReceivableSnapshotWithContact hex DTO + bridge mapper simplification + .toSnapshot() Opción C precedent A5-C1 4ta aplicación post-cementación cumulative, 9na evidencia §13.A5-α paired sister sub-cycle 5ta aplicación post-cementación cumulative)", () => {
  // ── B: NEW hex DTO exported modules/receivables/presentation/server.ts (Tests 3-4) ──
  // §13.B-paired NEW classification — ReceivableSnapshotWithContact replaces
  // legacy POJO Prisma DTO `ReceivableWithContact = AccountsReceivable & { contact:
  // Contact }` con hex composition `ReceivableSnapshot & { contact: Contact }`
  // (entity Snapshot shape NO Decimal — `amount/paid/balance: number`).

  it("Test 3: modules/receivables/presentation/server.ts contains `ReceivableSnapshotWithContact` literal (NEW hex DTO export §13.B-paired Path C5C drop POJO entirely)", () => {
    const source = fs.readFileSync(HEX_RECEIVABLES_SERVER, "utf8");
    expect(source).toMatch(RECEIVABLE_SNAPSHOT_WITH_CONTACT_RE);
  });

  it("Test 4: modules/receivables/presentation/server.ts contains `ReceivableSnapshot & { contact: Contact }` composition shape (entity Snapshot intersection Contact — R5 allowTypeImports presentation layer honored type-only Contact)", () => {
    const source = fs.readFileSync(HEX_RECEIVABLES_SERVER, "utf8");
    expect(source).toMatch(SNAPSHOT_CONTACT_COMPOSITION_RE);
  });

  // ── C: Bridge mapper simplification + Decimal reconstruction DROP (Tests 5-7) ──
  // contact-attacher.ts mapper interno simplifies: drop local POJO def + drop
  // Prisma.Decimal reconstruction + invokes .toSnapshot() direct entity →
  // snapshot mapping (Path α direct mirror Opción C precedent A5-C1 .toSnapshot()
  // adapter pattern at infrastructure/ boundary).

  it("Test 5: modules/receivables/infrastructure/contact-attacher.ts does NOT contain `type ReceivableWithContact` local def (drop duplicate POJO def — was línea 12 pre-cutover legacy boundary preservation)", () => {
    const source = fs.readFileSync(CONTACT_ATTACHER, "utf8");
    expect(source).not.toMatch(TYPE_RECEIVABLE_WITH_CONTACT_LOCAL_DEF_RE);
  });

  it("Test 6: modules/receivables/infrastructure/contact-attacher.ts does NOT contain `Prisma.Decimal` instantiation (drop reconstruction mapper interno simplifies — bridge contract evolves a Snapshot+Contact hex composition NO Decimal)", () => {
    const source = fs.readFileSync(CONTACT_ATTACHER, "utf8");
    expect(source).not.toMatch(PRISMA_DECIMAL_RE);
  });

  it("Test 7: modules/receivables/infrastructure/contact-attacher.ts contains `.toSnapshot()` invocation (Path α direct entity → snapshot mapping post-simplify mirror Opción C precedent A5-C1 .toSnapshot() adapter)", () => {
    const source = fs.readFileSync(CONTACT_ATTACHER, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_INVOCATION_RE);
  });

  // ── D: Component consumer swap a hex (Tests 8-9) ──
  // components/accounting/receivable-list.tsx swaps type-only consumer desde
  // legacy `@/features/receivables` a hex barrel `@/modules/receivables/presentation/server`
  // (type-only erased at compile — server-only safe via `import type`).

  it("Test 8: components/accounting/receivable-list.tsx imports `ReceivableSnapshotWithContact` from `@/modules/receivables/presentation/server` (type-only hex consumer swap §13.B-paired Path C5C)", () => {
    const source = fs.readFileSync(RECEIVABLE_LIST_COMPONENT, "utf8");
    expect(source).toMatch(RECEIVABLE_SNAPSHOT_WITH_CONTACT_RE);
    expect(source).toMatch(HEX_RECEIVABLES_SERVER_IMPORT_RE);
  });

  it("Test 9: components/accounting/receivable-list.tsx does NOT contain `ReceivableWithContact` literal (legacy POJO consumer drop wholesale — prop type + state types + filter callbacks all swap a ReceivableSnapshotWithContact)", () => {
    const source = fs.readFileSync(RECEIVABLE_LIST_COMPONENT, "utf8");
    expect(source).not.toMatch(RECEIVABLE_WITH_CONTACT_RE);
  });

  // ── F: Tests c1b + c3-c4 cascade DENTRO textual swap (Tests 12-13) ──
  // Marco lock cascade DENTRO C5-C6 (invariant collision elevation R5 absorbed)
  // — paired sister test docblock textual references swap a NEW literal
  // `ReceivableSnapshotWithContact` post-cutover. Coherencia documental forward.

  it("Test 12: modules/receivables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts does NOT contain `ReceivableWithContact` literal (textual cascade DENTRO Marco lock R5 absorbed — invariant collision elevation absorbed)", () => {
    const source = fs.readFileSync(C1B_TEST_CASCADE, "utf8");
    expect(source).not.toMatch(RECEIVABLE_WITH_CONTACT_RE);
  });

  it("Test 13: modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts does NOT contain `ReceivableWithContact` literal (textual cascade DENTRO Marco lock R5 absorbed — coherencia documental forward post-§13.B-paired drop)", () => {
    const source = fs.readFileSync(C3_C4_TEST_CASCADE, "utf8");
    expect(source).not.toMatch(RECEIVABLE_WITH_CONTACT_RE);
  });
});
