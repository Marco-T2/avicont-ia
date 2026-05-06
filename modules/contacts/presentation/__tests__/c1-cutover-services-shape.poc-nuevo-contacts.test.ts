/**
 * POC nuevo contacts C1 RED — cross-feature/cross-module presentation cutover
 * routes + pages + cross-module services + vi.mock targets ContactsService class
 * hex barrel (single feature axis, NO paired sister — contacts is a single
 * feature axis).
 *
 * Axis: ContactsService class identity cutover OUT of legacy barrel
 * `@/features/contacts/server` → canonical hex barrel
 * `@/modules/contacts/presentation/server`. Mirror precedent payment C1 EXACT
 * literal (commit `c1-cutover-services-shape.poc-nuevo-payment.test.ts`) —
 * Opción A re-export legacy class identity preserved via hex barrel ADD line
 * `export { ContactsService } from "@/features/contacts/server"` (NO hex
 * application path — preserves zero-arg ctor + ContactRow POJO shape +
 * Balance methods end-to-end). Path swap mecánico puro 20 consumers.
 *
 * §13.A5-α multi-level composition-root delegation 14ma evidencia matures
 * cumulative cross-POC sub-cycle continuation post-cementación canonical
 * (cumulative payment C1 13ma + paired-pr 11ma + earlier). Engram canonical
 * home `arch/§13/A5-alpha-multi-level-composition-root-delegation` — C1 NO
 * requiere re-cementación canonical home; matures cumulative cross-POC
 * sub-cycle precedent forward C2-C3-C4.
 *
 * §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL N+1ma
 * evidencia matures cumulative cross-POC (cumulative payment C1 + paired
 * A4-C1 cementada). 11 vi.mock declarations target swap MANDATORY paired —
 * page tests mock target swap from `@/features/contacts/server` →
 * `@/modules/contacts/presentation/server`. Class identity preserved (Opción
 * A re-export legacy shim) — vi.mock shape `class ContactsService { method = mock }`
 * stays unchanged, only target path swaps.
 *
 * Marco locks pre-RED C1 (corrected Q1-α retroactive este turno):
 *   - L1 (Q1-α Opción A re-export legacy class de hex barrel) Marco lock #1:
 *     hex barrel `modules/contacts/presentation/server.ts` ADD re-export
 *     `export { ContactsService } from "@/features/contacts/server"` (LEGACY
 *     shim, NO hex application). Preserva zero-arg ctor + ContactRow POJO
 *     shape (`toLegacyShape = entity.toSnapshot() as unknown as ContactRow`
 *     features/contacts/server.ts:18-19) + Balance methods (delegan a
 *     `makeContactBalancesService()` features/contacts/server.ts:91-131) +
 *     class identity full end-to-end. Mirror payment C1 EXACT literal — re-
 *     export source path mirror precedent literal. C4 wholesale delete
 *     `features/contacts/*` defer.
 *   - L2 (Q2 deferred a C2) Marco lock #2: Path simplificado v2 .toSnapshot()
 *     adapter NO requerido en C1 — legacy shim re-export preserves ContactRow
 *     POJO shape end-to-end via existing `toLegacyShape` adapter ya cementado
 *     en shim. Path simplificado v2 promueve a presentation cuando C2 cutover
 *     real hex application emerge (drop legacy shim + entity-direct + .toSnapshot()
 *     adapter at presentation pre-RSC boundary mirror mortality C1 cementación).
 *   - L3 (Q3 SPLIT scope) Marco lock #3: `modules/accounting/infrastructure/contacts-read.adapter.ts`
 *     cutover SPLIT a C2 separate cycle. C1 scope reduced 22→20 source
 *     consumers + 11 vi.mock atomic single-axis. §13.A reverse direction
 *     VALUE 5ta evidencia matures cumulative — Marco lock L2 (b) heredado
 *     C2 separate explicit. Atomic principle preservation single-axis per
 *     cycle.
 *   - L4 (Q4 Path α'' merge atomic Cat 1+Cat 2 single ciclo C1) Marco lock #4:
 *     mirror payment C1 EXACT — 21 source files + 11 vi.mock atomic single
 *     batch single-axis. Preserves bisect-friendly granularity.
 *   - L5 (Trust bookmark `e0a279c` post-GREEN C0-pre verified) Marco lock #5:
 *     skip suite full pre-RED. Mirror payment C1 L3 + paired-pr-C7 L2 precedent
 *     EXACT. Working tree clean post C0-pre commits, no edits intermedios.
 *
 * Marco lock final RED scope C1 (14 assertions α):
 *
 *   ── A: Hex canonical barrel import POSITIVE per axis (Tests 1-10) ──
 *   20 callsites swap import path `@/features/contacts/server` →
 *   `@/modules/contacts/presentation/server`. Hex barrel post-GREEN re-exports
 *   { ContactsService } from "@/features/contacts/server" (Opción A Marco lock
 *   #1) — class identity preserved, ContactRow POJO shape preserved, Balance
 *   methods preserved.
 *
 *     ── A1: 5 routes POSITIVE per file (Tests 1-5) ──
 *     Server-side schemas + Balance method consumers. Per-file diagnostic
 *     granularity preserved (high signal — auth boundary).
 *       T1 app/api/organizations/[orgSlug]/contacts/route.ts
 *       T2 app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts
 *       T3 app/api/organizations/[orgSlug]/contacts/[contactId]/balance/route.ts
 *       T4 app/api/organizations/[orgSlug]/contacts/[contactId]/credit-balance/route.ts
 *       T5 app/api/organizations/[orgSlug]/contacts/[contactId]/pending-documents/route.ts
 *
 *     ── A2: 11 pages POSITIVE consolidated occurrence count (Test 6) ──
 *     11 page.tsx files joined collectively asserts hex import pattern present
 *     ≥ 11 occurrences (one per file post-cutover). Consolidated for 14-total
 *     target. Single failure diagnostic acceptable trade-off (per-file failure
 *     surface via TypeScript compile error pre-suite anyway).
 *       T6 11 pages collective: accounting/contacts × 2 + dispatches × 2 +
 *          payments × 3 + purchases × 2 + sales × 2 (occurrence count ≥ 11)
 *
 *     ── A3: 4 cross-module POSITIVE per file (Tests 7-10) ──
 *     Cross-feature/cross-module services. Per-file diagnostic granularity
 *     preserved (high signal — services consumed by multiple consumers
 *     downstream).
 *       T7 features/accounting/journal.service.ts
 *       T8 features/ai-agent/tools/find-contact.ts
 *       T9 features/ai-agent/tools/parse-operation.ts
 *       T10 features/dispatch/dispatch.service.ts
 *
 *   ── B: Legacy `from "@/features/contacts/server"` ABSENT consolidated (Test 11) ──
 *   PROJECT-scope grep app/ + features/ paths consolidated single assertion —
 *   20 callsite sources collectively NO contain legacy barrel import. Single
 *   assertion replaces 20 per-callsite negatives (consolidated 14-total target
 *   estricto Marco lock).
 *     T11 20 callsite sources collectively NO contain
 *         `from "@/features/contacts/server"` (legacy barrel sub-import dropped
 *         post-cutover ALL 20 callsites consolidated)
 *
 *   ── C: §13.A4-η vi.mock factory load-bearing render path coverage (Tests 12-13) ──
 *   11 vi.mock declarations target swap MANDATORY paired §13.A4-η. Class
 *   identity preserved (Opción A re-export legacy shim) — vi.mock shape
 *   `class ContactsService { method }` stays unchanged. Only target path swaps.
 *   Consolidated occurrence count: POSITIVE ≥ 11 + NEGATIVE == 0.
 *     T12 11 vi.mock POSITIVE consolidated: vi.mock target
 *         `@/modules/contacts/presentation/server` occurrence count ≥ 11 across
 *         11 page test files joined collectively (factory pattern §13.A4-η
 *         LOAD-BEARING render path coverage MATERIAL — page renders require
 *         ContactsService class with CRUD + Balance methods mocked, target path
 *         swap Opción A class identity preserved)
 *     T13 11 vi.mock NEGATIVE consolidated: vi.mock target
 *         `@/features/contacts/server` occurrence count == 0 (legacy target
 *         dropped post-cutover ALL 11 page test files consolidated)
 *
 *   ── D: Hex barrel canonical Opción A re-export (Test 14) ──
 *   Opción A Marco lock #1 — hex barrel re-export legacy class identity
 *   `{ ContactsService }` from `@/features/contacts/server` (LEGACY shim, NO
 *   hex application). Preserves zero-arg ctor + ContactRow POJO shape + Balance
 *   methods + class identity end-to-end. Mirror payment C1 EXACT literal
 *   precedent.
 *     T14 modules/contacts/presentation/server.ts contains
 *         `export { ContactsService } from "@/features/contacts/server"`
 *         (canonical Opción A re-export legacy class — preserves zero-arg ctor
 *         + ContactRow POJO shape + Balance methods + class identity defer C4
 *         wholesale delete features/contacts/*)
 *
 * §13.A5-α multi-level composition-root delegation pattern matures cumulative
 * cross-POC sub-cycle continuation (POC nuevo contacts single feature axis
 * 14ma evidencia matures cumulative): mirror canonical home pattern — multi-
 * level composition root delegation external callsite → ContactsService legacy
 * class → makeContactsService factory hex (internal toLegacyShape adapter via
 * entity.toSnapshot()) → ContactsService hex inner. Path swap (Opción A)
 * preserves class identity, hex factory disponible NO requires factory addition
 * pre-RED — legacy shim ya delega a `makeContactsService()` y
 * `makeContactBalancesService()` internally.
 *
 * §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL — 11 page
 * tests target swap paired MANDATORY (NO orphan post-cutover). Class identity
 * preserved Opción A re-export legacy shim — vi.mock shape `class ContactsService { method }`
 * NO requires factory shape swap. Forward-applicable: Opción A re-export
 * class identity preserved → vi.mock target swap solo path (NO shape swap).
 *
 * Sub-findings emergentes (Step 0 expand pre-RED este turno):
 *   - EMERGENTE #1: 9-axis classification consumers `features/contacts/*`
 *     verified Step 0 expand: CONSUMER 20 (5 routes + 11 pages + 4 cross-module
 *     services) + RESIDUAL 0 + DEAD-IMPORT 0 + TEST-MOCK-DECLARATION 11 +
 *     TEST-SHAPE-ASSERTION-NEGATIVE 0 + DOC-ONLY-MENTION 1 (sale-to-with-details
 *     mapper JSDoc only NO runtime import) + HEX-PURE 6 (composition-roots +
 *     existence adapters TYPE-only OR factory pattern already on hex) +
 *     HEX-INTERNAL 5 (modules/contacts/* definition + tests) + SPLIT-DEFERRED 1
 *     (modules/accounting/infrastructure/contacts-read.adapter.ts split a C2
 *     §13.A reverse direction VALUE 5ta evidencia Marco lock L2 (b) heredado).
 *   - EMERGENTE #2: ContactsService legacy ctor zero-arg with NO args required
 *     — ALL 20 callsites use ZERO-ARG `new ContactsService()`. Mirror payment
 *     C1 EMERGENTE #2 EXACT pattern. Cutover mecánico path swap puro Opción A
 *     legacy shim re-export.
 *   - EMERGENTE #3: §13.A5-α multi-level composition-root delegation 14ma
 *     evidencia matures cumulative cross-POC sub-cycle (post payment C1 13ma).
 *     Hex factory `makeContactsService()` + `makeContactsServiceForTx(tx)` +
 *     `makeContactBalancesService()` disponible composition-root.ts NO requires
 *     factory addition pre-RED — legacy shim ya delega internally end-to-end.
 *   - EMERGENTE #4: NO §13.A5-ε method-on-class shim drop alias aplicable —
 *     contacts legacy shim NO contiene method-name aliases divergence (vs
 *     payment C1 `findUnappliedPayments` → `findUnappliedByContact` cementación
 *     2da evidencia). Method coverage divergence detected pre-RED (legacy shim
 *     HAS Balance methods, hex application DOES NOT) — preserved end-to-end via
 *     legacy shim re-export Opción A literal, NO requires drop alias C1 scope.
 *     Defer Balance method axis a C2 (cuando emerge cutover hex application
 *     real + Balance method consumers split a `makeContactBalancesService()`
 *     directly).
 *   - EMERGENTE #5: ESLint R1+R2+R4+R5 baseline preservation predicted —
 *     R1-R5 apply ONLY `modules/<glob>/{domain,application,presentation}/`. C1
 *     edits viven en `app/<glob>` (routes + pages) + `features/<glob>` (cross-
 *     module services) NO afectado por R1-R5 rules. banServerBarrels guard
 *     `components/<glob>` + `app/<glob>/<X>-client.{ts,tsx}` — pages page.tsx +
 *     route.ts + features/* NO son `*-client` allowed. Hex barrel re-export
 *     line añadido `modules/contacts/presentation/server.ts` modules/<glob>/presentation/
 *     scope rules R1-R5 apply BUT re-export from features/* legacy is canonical
 *     Opción A allowed pattern (mirror payment C1 hex barrel post-GREEN — same
 *     scope rules applied). Predicted 0 new ESLint violations baseline 10e/13w
 *     preserved post-C1 GREEN.
 *   - EMERGENTE #6: NO §13.B-paired aplica — contacts es single feature axis,
 *     sin sister symmetric (paired POC payables↔receivables fue caso especial
 *     paired axis emergente §13.B NEW top-level letter cementación).
 *   - EMERGENTE #7: Hex barrel `modules/contacts/presentation/server.ts` ya
 *     re-exporta `makeContactsService` + `makeContactsServiceForTx` factory
 *     (líneas 4-6) + schemas (líneas 7-11) + Contact entity types + value
 *     objects + errors. Opción A re-export legacy class identity ADD
 *     `export { ContactsService } from "@/features/contacts/server"` mantiene
 *     compat post-cutover routes/pages/cross-module — DTO contract ContactRow
 *     POJO shape preservado defer C2 hex application cutover real + Balance
 *     methods split a ContactBalancesService directly.
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1-T5 FAIL: 5 routes hoy importan `from "@/features/contacts/server"`
 *     legacy barrel — `toMatch` hex canonical pattern fails (hex import path NO
 *     present pre-cutover).
 *   - T6 FAIL: 11 pages hoy importan `from "@/features/contacts/server"` ALL
 *     11 callsites — `toMatch` hex pattern occurrence count ≥ 11 fails (hex
 *     import path NO present pre-cutover en NINGUNA página pre-GREEN).
 *   - T7-T10 FAIL: 4 cross-module hoy importan `from "@/features/contacts/server"`
 *     legacy barrel — `toMatch` hex canonical pattern fails per file.
 *   - T11 FAIL: 20 callsite sources collectively contienen
 *     `from "@/features/contacts/server"` pre-cutover — `not.toMatch` legacy
 *     pattern reverses. Test fails on unwanted match (legacy import path
 *     PRESENT pre-cutover ALL 20 callsites).
 *   - T12 FAIL: 11 page test files hoy contienen `vi.mock("@/features/contacts/server", ...)` —
 *     `toMatch` hex target pattern occurrence ≥ 11 fails (hex vi.mock target
 *     NO present pre-cutover en NINGÚN test pre-GREEN).
 *   - T13 FAIL: 11 page test files hoy contienen `vi.mock("@/features/contacts/server", ...)` ALL
 *     11 callsites — `not.toMatch` legacy pattern occurrence == 0 reverses.
 *     Test fails on unwanted matches (legacy vi.mock target PRESENT pre-cutover
 *     ALL 11 page test files).
 *   - T14 FAIL: hex barrel `modules/contacts/presentation/server.ts` hoy NO
 *     contiene `export { ContactsService } from "@/features/contacts/server"`
 *     pre-GREEN (re-export añadido GREEN scope). Test fails on missing positive
 *     match canonical Opción A re-export legacy shim.
 * Total expected FAIL pre-GREEN: 14/14 (Marco mandate failure mode honest
 * enumerated single side contacts).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado
 * mismo path C0-pre): shape test asserta paths
 * `app/api/organizations/[orgSlug]/...`, `app/(dashboard)/[orgSlug]/...`,
 * `features/accounting/...`, `features/ai-agent/...`, `features/dispatch/...`,
 * `modules/contacts/presentation/server.ts` que persisten post C4 wholesale
 * delete `features/contacts/*`. Test vive en `modules/contacts/presentation/__tests__/` —
 * NO toca `features/contacts/*` que C4 borrará. Self-contained vs future
 * deletes ✓. (Cross-module `features/accounting/journal.service.ts` etc. son
 * pre-existing services NO en scope wholesale C4.)
 *
 * Source-string assertion pattern: mirror precedent C0-pre + payment C1 + paired-pr
 * (`fs.readFileSync` regex match) — keep pattern POC nuevo contacts. Target
 * asserciones consumer surface paths + hex barrel canonical re-export shape.
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α multi-level composition delegation (14ma
 *     evidencia matures cumulative cross-POC sub-cycle continuation post
 *     payment C1 13ma)
 *   - architecture.md §13.A4-η vi.mock factory load-bearing render path coverage
 *     MATERIAL (paired sister precedent A4-C1 cementada cumulative — Opción A
 *     re-export class identity preserved, target path swap only NO shape swap)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587
 *     (canonical home — POC nuevo contacts 14ma evidencia matures cumulative)
 *   - engram `poc-nuevo/contacts/c0-pre/closed` #1666 (preceding sub-cycle POC
 *     nuevo contacts — bookmark cycle-start este turno heredado + Step 0
 *     checklist applied)
 *   - engram `poc-nuevo/payment/c1/closed` (preceding cross-POC payment C1 —
 *     mirror EXACT precedent literal Opción A re-export legacy shim)
 *   - engram `feedback/step-0-expand-eslint-restricted-imports-grep` (Step 0
 *     expand pre-RED 9-axis classification + cross-feature deps + §13.A5
 *     patterns aplicabilidad + R1-R5 baseline preservation predicted applied
 *     este turno)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 14/14
 *     enumerated single side contacts)
 *   - engram `feedback_invariant_collision_elevation` (Marco lock retroactive
 *     Q1-α corrected post-emergente surface — 3 axis-distinct invariant
 *     collisions detected pre-RED + escalated NO silently resolved + Marco
 *     L1 ESTRICTO axis-distinct collision retroactive permitido)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite +
 *     rationale + cross-ref applied RED body — §13.A5-α 14ma + §13.A4-η
 *     LOAD-BEARING N+1ma matures cumulative)
 *   - engram `feedback_retirement_reinventory_gate` (9-axis classification
 *     applied Step 0 expand: CONSUMER 20 + RESIDUAL 0 + DEAD-IMPORT 0 +
 *     TEST-MOCK-DECLARATION 11 + TEST-SHAPE-ASSERTION-NEGATIVE 0 + DOC-ONLY-
 *     MENTION 1 + HEX-PURE 6 + HEX-INTERNAL 5 + SPLIT-DEFERRED 1 identified
 *     pre-RED)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate
 *     suficiente post-RED Marco lock procedure + trust bookmark `e0a279c`
 *     post-GREEN C0-pre baseline pre-RED skip suite full Marco lock #5)
 *   - engram `feedback_textual_rule_verification` (Marco lock textual canonical
 *     home pre-RED §13.A5-α + §13.A4-η verified architecture.md cementación)
 *   - app/api/organizations/[orgSlug]/contacts/route.ts (target T1)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts (target T2)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/balance/route.ts (target T3)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/credit-balance/route.ts (target T4)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/pending-documents/route.ts (target T5)
 *   - app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx + 10 more pages (target T6 collective)
 *   - features/accounting/journal.service.ts (target T7)
 *   - features/ai-agent/tools/find-contact.ts (target T8)
 *   - features/ai-agent/tools/parse-operation.ts (target T9)
 *   - features/dispatch/dispatch.service.ts (target T10)
 *   - 11 page test files (target T12 + T13 vi.mock collective §13.A4-η LOAD-BEARING)
 *   - modules/contacts/presentation/server.ts (target T14 — hex barrel canonical
 *     Opción A re-export legacy classes ADD `export { ContactsService } from "@/features/contacts/server"`)
 *   - features/contacts/server.ts (legacy shim ContactsService class — preserved
 *     C1 scope as canonical Opción A source, drop C4 wholesale delete)
 *   - modules/contacts/presentation/__tests__/c0-pre-cutover-schemas-shape.poc-nuevo-contacts.test.ts
 *     (precedent shape POC nuevo contacts C0-pre RED `c7584d7` + GREEN `e0a279c`)
 *   - modules/payment/presentation/__tests__/c1-cutover-services-shape.poc-nuevo-payment.test.ts
 *     (precedent shape POC nuevo payment C1 RED — mirror EXACT literal Opción A
 *     re-export legacy shim)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C1 cutover targets (21 source files single-axis + 11 vi.mock test files) ──

// 5 routes
const CONTACTS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/route.ts",
);
const CONTACTS_BY_ID_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts",
);
const CONTACTS_BALANCE_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/balance/route.ts",
);
const CONTACTS_CREDIT_BALANCE_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/credit-balance/route.ts",
);
const CONTACTS_PENDING_DOCS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/pending-documents/route.ts",
);

// 11 pages
const PAGES = [
  "app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx",
  "app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx",
  "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx",
  "app/(dashboard)/[orgSlug]/dispatches/new/page.tsx",
  "app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx",
  "app/(dashboard)/[orgSlug]/payments/new/page.tsx",
  "app/(dashboard)/[orgSlug]/payments/page.tsx",
  "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx",
  "app/(dashboard)/[orgSlug]/purchases/new/page.tsx",
  "app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx",
  "app/(dashboard)/[orgSlug]/sales/new/page.tsx",
].map((p) => path.join(REPO_ROOT, p));

// 4 cross-module
const JOURNAL_SERVICE = path.join(
  REPO_ROOT,
  "features/accounting/journal.service.ts",
);
const AI_AGENT_FIND_CONTACT = path.join(
  REPO_ROOT,
  "features/ai-agent/tools/find-contact.ts",
);
const AI_AGENT_PARSE_OPERATION = path.join(
  REPO_ROOT,
  "features/ai-agent/tools/parse-operation.ts",
);
const DISPATCH_SERVICE = path.join(
  REPO_ROOT,
  "features/dispatch/dispatch.service.ts",
);

// 11 page test files (vi.mock targets §13.A4-η LOAD-BEARING)
const PAGE_TESTS = [
  "app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts",
  "app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/dispatches/new/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts",
  "app/(dashboard)/[orgSlug]/payments/new/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/purchases/new/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-rbac.test.ts",
  "app/(dashboard)/[orgSlug]/sales/new/__tests__/page-rbac.test.ts",
].map((p) => path.join(REPO_ROOT, p));

// Hex barrel target T14
const HEX_BARREL_SERVER = path.join(
  REPO_ROOT,
  "modules/contacts/presentation/server.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

// Regex precision rationale (per `feedback_red_regex_discipline`): assert
// `import { ... ContactsService ... } from "@/modules/contacts/presentation/server"`
// specifically (NOT just the module path). Pattern guard contra C0-pre prior
// schema cutover false-positive — `from "@/modules/contacts/presentation/server"`
// alone matches incidental schema import lines `import { createContactSchema, ... }`
// added by C0-pre commit `e0a279c` to api/contacts/route.ts +
// api/contacts/[contactId]/route.ts. Precise pattern asserts ContactsService
// runtime import name presence in import specifier list.
const HEX_CANONICAL_SERVER_IMPORT_RE =
  /import\s*\{[^}]*\bContactsService\b[^}]*\}\s*from\s+["']@\/modules\/contacts\/presentation\/server["']/;
const HEX_CANONICAL_SERVER_IMPORT_GLOBAL_RE =
  /import\s*\{[^}]*\bContactsService\b[^}]*\}\s*from\s+["']@\/modules\/contacts\/presentation\/server["']/g;
const LEGACY_FEATURES_CONTACTS_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/contacts\/server["']/;
const HEX_CANONICAL_SERVER_VI_MOCK_GLOBAL_RE =
  /vi\.mock\(\s*["']@\/modules\/contacts\/presentation\/server["']/g;
const LEGACY_FEATURES_CONTACTS_SERVER_VI_MOCK_GLOBAL_RE =
  /vi\.mock\(\s*["']@\/features\/contacts\/server["']/g;
const HEX_BARREL_OPCION_A_REEXPORT_RE =
  /export\s*\{\s*ContactsService\s*\}\s*from\s+["']@\/features\/contacts\/server["']/;

describe("POC nuevo contacts C1 — cross-feature/cross-module presentation cutover routes + pages + cross-module services + vi.mock targets ContactsService class hex barrel (single feature axis NO paired, §13.A5-α 14ma evidencia matures cumulative cross-POC sub-cycle continuation + §13.A4-η LOAD-BEARING render path coverage MATERIAL Opción A re-export legacy shim class identity preserved)", () => {
  // ── A1: 5 routes POSITIVE per file (Tests 1-5) ────────────────────────────
  // Opción A Marco lock #1 — hex barrel re-exporta { ContactsService }
  // from "@/features/contacts/server" (post-GREEN canonical re-export legacy
  // shim). 5 routes swap import path únicamente — class identity preserved,
  // ContactRow POJO shape preservado, Balance methods preservadas.

  // ── Tests 1-2 RETIRED scope-expired pre-C4-ter route.ts factory cutover ──
  // C4-ter invierte invariant cumulative cross-cycle scope evolution — Tests
  // 1-2 cementación histórica preserved archaeology (skip + comentario, NO
  // delete wholesale). Los 2 tests cementaron en C1 GREEN (commit 5e3dc3b)
  // que las 2 routes API CRUD (api/.../contacts + api/.../contacts/[contactId])
  // DEBEN importar `ContactsService` from `@/modules/contacts/presentation/server`
  // (Opción A re-export legacy shim, class identity preserved). C4-ter RED
  // (commit 0252624) invierte el invariant: las 2 routes cutover VALUE-axis
  // legacy `ContactsService` class → factory `makeContactsService()` pattern
  // hex same barrel path. Same axis que Tests 7-10 retired este mismo commit
  // (cross-module services cutover). Mantener Tests 1-2 activos contradiría
  // C4-ter GREEN naturalmente.
  //
  // Lección NEW canonical home: `feedback/retirement-reinventory-gate-class-symbol-grep`
  // 10mo axis cumulative cross-POC. Marco lock Opción A4 — retire Tests 1-2
  // mismo C4 GREEN commit mirror Tests 7-10 retire precedent EXACT cumulative.
  it.skip("Test 1: app/api/organizations/[orgSlug]/contacts/route.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class hex post-cutover Opción A canonical re-export legacy shim class identity preserved)", () => {
    const source = fs.readFileSync(CONTACTS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 2: app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class hex post-cutover)", () => {
    const source = fs.readFileSync(CONTACTS_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  // ── Tests 3-5 RETIRED scope-expired pre-C3 cutover ────────────────────────
  // C3 invierte invariant cumulative cross-cycle scope evolution — Tests 3-5
  // cementación histórica preserved archaeology (skip + comentario, NO delete
  // wholesale). Los 3 tests cementaron en C1 GREEN (commit 5e3dc3b) que las
  // 3 routes API Balance methods (balance/credit-balance/pending-documents)
  // DEBEN importar `ContactsService` from `@/modules/contacts/presentation/server`
  // (Opción A re-export legacy shim, class identity preserved). C3 RED (commit
  // ed390af) invierte el invariant: las 3 routes cutover cross-module a
  // `@/modules/contact-balances/presentation/server` factory `makeContactBalancesService`
  // — el legacy shim ContactsService import dropped (C3 T4 NEG consolidated)
  // + per-route hex barrel POSITIVE granularity (C3 T1-T3) reemplaza la
  // cementación histórica de C1 Tests 3-5. Mantener Tests 3-5 activos
  // contradiría C3 RED naturalmente — collision detected post-C3 GREEN attempt
  // previo turno (sub-agent escaló honest revert clean).
  //
  // Lección NEW canonical home: `feedback/cross-cycle-red-test-cementacion-gate`
  // 1ra evidencia POC contacts C3 pre-GREEN. Marco lock Opción C split 2 commits
  // (C3-pre prerequisite gate retire Tests 3-5 + C3 GREEN routes cutover) mirror
  // C0-pre prerequisite gate precedent EXACT. Skip vs delete wholesale: archaeology
  // preserved + delete wholesale defer D1 doc-only post-mortem si surface cleanup
  // preference futuro. `it.skip` (NO `describe.skip`) preserva diagnostic
  // granularity per-test.
  it.skip("Test 3: app/api/organizations/[orgSlug]/contacts/[contactId]/balance/route.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class Balance method consumer hex post-cutover)", () => {
    const source = fs.readFileSync(CONTACTS_BALANCE_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 4: app/api/organizations/[orgSlug]/contacts/[contactId]/credit-balance/route.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class Balance method consumer hex post-cutover)", () => {
    const source = fs.readFileSync(CONTACTS_CREDIT_BALANCE_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 5: app/api/organizations/[orgSlug]/contacts/[contactId]/pending-documents/route.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class Balance method consumer hex post-cutover)", () => {
    const source = fs.readFileSync(CONTACTS_PENDING_DOCS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  // ── A2: 11 pages POSITIVE consolidated occurrence count (Test 6) ─────────
  // 11 page.tsx files joined collectively asserts hex import pattern present
  // ≥ 11 occurrences (one per file post-cutover). Consolidated for 14-total
  // target.

  // ── Test 6 RETIRED scope-expired pre-C5 page.tsx callsite cutover VALUE-axis ──
  // C5 invierte invariant cumulative cross-cycle scope evolution — Test 6
  // cementación histórica preserved archaeology (skip + comentario, NO delete
  // wholesale). Test 6 cementó en C1 GREEN (commit 5e3dc3b) que las 11 page.tsx
  // files DEBEN contener `from "@/modules/contacts/presentation/server"` ≥ 11
  // occurrences (consolidated POSITIVE hex import ALL pages post-cutover Opción
  // A class identity preserved). C5 GREEN page.tsx callsite cutover
  // `app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx` (1 de los 11) swap
  // import target a `@/modules/contact-balances/presentation/server` factory
  // `makeContactBalancesService().listWithBalancesFlat()` (Marco lock A1 flat
  // POJO via contact.toSnapshot() mirror legacy shim shape EXACT + B1 factory
  // mock pattern + Sub-α ADD listWithBalancesFlat() a GREEN). Count baja 11 → 10
  // occurrences → assertion `≥ 11` FAIL. Mantener Test 6 activo contradiría C5
  // GREEN naturalmente — collision detected proactively pre-RED este turno
  // (cross-cycle-red-test-cementacion-gate 3ra evidencia PROACTIVE matures
  // cumulative cross-POC: 1ra C3 retroactive surface post-edits + 2da C4
  // PROACTIVE surface pre-edits + 3ra C5 PROACTIVE surface pre-edits — gate
  // matures cumulative forward).
  //
  // Lección NEW canonical home: `feedback/cross-cycle-red-test-cementacion-gate`
  // 3ra evidencia POC contacts C5 pre-RED. Marco lock C-α' split C5-pre
  // prerequisite gate (Test 6 + Test 12 retire absorb Opción 1 same-axis
  // cementación count POSITIVE retire pre-cutover) + C5 RED + C5 GREEN mirror
  // C3-pre + C4-pre prerequisite gate precedent EXACT cumulative. Skip vs
  // delete wholesale: archaeology preserved + delete wholesale defer D1
  // doc-only post-mortem si surface cleanup preference futuro. `it.skip` (NO
  // `describe.skip`) preserva diagnostic granularity per-test.
  it.skip("Test 6: 11 pages collectively contain `from \"@/modules/contacts/presentation/server\"` ≥ 11 occurrences (consolidated POSITIVE hex import ALL pages post-cutover Opción A class identity preserved)", () => {
    const sources = PAGES.map((p) => fs.readFileSync(p, "utf8")).join("\n");
    const matches = sources.match(HEX_CANONICAL_SERVER_IMPORT_GLOBAL_RE) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(11);
  });

  // ── A3: Tests 7-10 RETIRED scope-expired pre-C4-bis cross-module factory cutover ──
  // C4-bis invierte invariant cumulative cross-cycle scope evolution — Tests 7-10
  // cementación histórica preserved archaeology (skip + comentario, NO delete
  // wholesale). Los 4 tests cementaron en C1 GREEN (commit 5e3dc3b) que las 4
  // cross-module services (journal.service + find-contact + parse-operation +
  // dispatch.service) DEBEN importar `ContactsService` from
  // `@/modules/contacts/presentation/server` (Opción A re-export legacy shim,
  // class identity preserved). C4-bis RED (commit e6104be) invierte el invariant:
  // los 4 archivos cutover VALUE-axis legacy `ContactsService` class →
  // factory `makeContactsService()` pattern hex same barrel path (Marco lock 2
  // Sub-B inline `ReturnType<typeof makeContactsService>` cast-silenced
  // equivalent structurally — preserva DI pattern hex consistent NO standalone
  // function export Marco lock Q-pre2 Q2.3 (c) heredado). El import line cambia
  // de `import { ContactsService }` a `import { makeContactsService }`, y `new
  // ContactsService()` cambia a `makeContactsService()` factory call. Mantener
  // Tests 7-10 activos contradiría C4-bis GREEN naturalmente — collision
  // detected pre-RED este turno (cross-cycle-red-test-cementacion-gate 4ta
  // evidencia PROACTIVE matures cumulative cross-POC: 1ra C3 retroactive + 2da
  // C4-pre PROACTIVE + 3ra C5-pre PROACTIVE + 4ta C4 PROACTIVE — gate funcionó
  // forward).
  //
  // Lección NEW canonical home: `feedback/retirement-reinventory-gate-class-symbol-grep`
  // 10mo axis cumulative cross-POC — class symbol grep PROJECT-scope MANDATORY
  // cuando wholesale delete + DROP re-export bridge (Step 0 9-axis classification
  // expand axis 10mo). Marco lock Opción A4 — C4-ter NEW RED + GREEN cumulative
  // single batch + retire Tests 7-10 mismo C4 GREEN commit mirror Tests 3-5
  // retire C3-pre + Tests 6+12 retire C5-pre + Test 14 retire C4-pre precedent
  // EXACT cumulative. Skip vs delete wholesale: archaeology preserved + delete
  // wholesale defer D1 doc-only post-mortem si surface cleanup preference futuro.
  // `it.skip` (NO `describe.skip`) preserva diagnostic granularity per-test.
  it.skip("Test 7: features/accounting/journal.service.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class hex post-cutover cross-module)", () => {
    const source = fs.readFileSync(JOURNAL_SERVICE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 8: features/ai-agent/tools/find-contact.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class hex post-cutover cross-module)", () => {
    const source = fs.readFileSync(AI_AGENT_FIND_CONTACT, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 9: features/ai-agent/tools/parse-operation.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class hex post-cutover cross-module)", () => {
    const source = fs.readFileSync(AI_AGENT_PARSE_OPERATION, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 10: features/dispatch/dispatch.service.ts DOES import from `@/modules/contacts/presentation/server` (ContactsService class hex post-cutover cross-module)", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  // ── B: Legacy `from "@/features/contacts/server"` ABSENT consolidated (Test 11) ──
  // PROJECT-scope grep app/ + features/ paths consolidated single assertion —
  // 20 callsite sources collectively NO contain legacy barrel import. Single
  // assertion replaces 20 per-callsite negatives.

  it("Test 11: 20 callsite sources collectively NO contain `from \"@/features/contacts/server\"` (legacy barrel import dropped post-cutover ALL 20 callsites consolidated PROJECT-scope grep app/ + features/ paths)", () => {
    const sources = [
      fs.readFileSync(CONTACTS_ROUTE, "utf8"),
      fs.readFileSync(CONTACTS_BY_ID_ROUTE, "utf8"),
      fs.readFileSync(CONTACTS_BALANCE_ROUTE, "utf8"),
      fs.readFileSync(CONTACTS_CREDIT_BALANCE_ROUTE, "utf8"),
      fs.readFileSync(CONTACTS_PENDING_DOCS_ROUTE, "utf8"),
      ...PAGES.map((p) => fs.readFileSync(p, "utf8")),
      fs.readFileSync(JOURNAL_SERVICE, "utf8"),
      fs.readFileSync(AI_AGENT_FIND_CONTACT, "utf8"),
      fs.readFileSync(AI_AGENT_PARSE_OPERATION, "utf8"),
      fs.readFileSync(DISPATCH_SERVICE, "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(LEGACY_FEATURES_CONTACTS_SERVER_IMPORT_RE);
  });

  // ── C: §13.A4-η vi.mock factory load-bearing render path coverage (Tests 12-13) ──
  // 11 vi.mock declarations target swap MANDATORY paired §13.A4-η. Class
  // identity preserved (Opción A re-export legacy shim) — vi.mock shape
  // `class ContactsService { method }` stays unchanged. Only target path swaps.

  // ── Test 12 RETIRED scope-expired pre-C5 page.test.ts vi.mock SHAPE swap VALUE-axis ──
  // C5 invierte invariant cumulative cross-cycle scope evolution — Test 12
  // cementación histórica preserved archaeology (skip + comentario, NO delete
  // wholesale). Test 12 cementó en C1 GREEN (commit 5e3dc3b) que las 11 page
  // test files DEBEN contener `vi.mock("@/modules/contacts/presentation/server",
  // ...)` ≥ 11 occurrences (consolidated POSITIVE vi.mock target swap §13.A4-η
  // LOAD-BEARING render path coverage MATERIAL — page renders require
  // ContactsService class con CRUD + Balance methods mocked, target path swap
  // Opción A class identity preserved). C5 GREEN page.test.ts vi.mock SHAPE
  // cutover `app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts`
  // (1 de los 11) swap target a `@/modules/contact-balances/presentation/server`
  // factory pattern (Marco lock B1 `vi.mock(.., () => ({ makeContactBalancesService:
  // vi.fn(() => ({ listWithBalancesFlat: mockListWithBalances })) }))` NO class
  // identity preserved como C1 Opción A) + Sub-α ADD listWithBalancesFlat() a
  // GREEN. Count baja 11 → 10 occurrences → assertion `≥ 11` FAIL. Mantener
  // Test 12 activo contradiría C5 GREEN naturalmente — collision detected
  // proactively pre-RED este turno (cross-cycle-red-test-cementacion-gate 3ra
  // evidencia PROACTIVE matures cumulative cross-POC: 1ra C3 retroactive +
  // 2da C4 PROACTIVE + 3ra C5 PROACTIVE — gate matures cumulative forward).
  //
  // Lección NEW canonical home: `feedback/cross-cycle-red-test-cementacion-gate`
  // 3ra evidencia POC contacts C5 pre-RED. Marco lock C-α' split C5-pre
  // prerequisite gate (Test 6 + Test 12 retire absorb Opción 1 same-axis
  // cementación count POSITIVE retire pre-cutover) + C5 RED + C5 GREEN mirror
  // C3-pre + C4-pre prerequisite gate precedent EXACT cumulative. Skip vs
  // delete wholesale: archaeology preserved + delete wholesale defer D1
  // doc-only post-mortem si surface cleanup preference futuro. `it.skip` (NO
  // `describe.skip`) preserva diagnostic granularity per-test.
  it.skip("Test 12: 11 page test files collectively contain `vi.mock(\"@/modules/contacts/presentation/server\", ...)` ≥ 11 occurrences (consolidated POSITIVE vi.mock target swap §13.A4-η LOAD-BEARING render path coverage MATERIAL — page renders require ContactsService class with CRUD + Balance methods mocked, target path swap Opción A class identity preserved)", () => {
    const sources = PAGE_TESTS.map((p) => fs.readFileSync(p, "utf8")).join(
      "\n",
    );
    const matches =
      sources.match(HEX_CANONICAL_SERVER_VI_MOCK_GLOBAL_RE) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(11);
  });

  it("Test 13: 11 page test files collectively contain `vi.mock(\"@/features/contacts/server\", ...)` ZERO occurrences (consolidated NEGATIVE legacy vi.mock target dropped post-cutover ALL 11 page test files)", () => {
    const sources = PAGE_TESTS.map((p) => fs.readFileSync(p, "utf8")).join(
      "\n",
    );
    const matches =
      sources.match(LEGACY_FEATURES_CONTACTS_SERVER_VI_MOCK_GLOBAL_RE) ?? [];
    expect(matches.length).toBe(0);
  });

  // ── Test 14 RETIRED scope-expired pre-C4 wholesale delete ────────────────
  // C4 invierte invariant cumulative cross-cycle scope evolution — Test 14
  // cementación histórica preserved archaeology (skip + comentario, NO delete
  // wholesale). Test 14 cementó en C1 GREEN (commit 5e3dc3b) que el hex barrel
  // `modules/contacts/presentation/server.ts` DEBE re-exportar Opción A
  // `export { ContactsService } from "@/features/contacts/server"` (línea 13)
  // como legacy shim re-export class identity preserved + zero-arg ctor +
  // ContactRow POJO shape + Balance methods end-to-end. C4 GREEN wholesale
  // delete `features/contacts/*` invierte el invariant: la línea 13 se DROP
  // (no hay source legacy shim para re-exportar) + ContactsService class
  // deja de existir como entry point. Mantener Test 14 activo contradiría C4
  // GREEN naturalmente — collision detected proactively pre-RED este turno
  // (cross-cycle-red-test-cementacion-gate 2da evidencia PROACTIVE — gate
  // funcionó forward, distinto C3 retroactive 1ra evidencia).
  //
  // Lección NEW canonical home: `feedback/cross-cycle-red-test-cementacion-gate`
  // 2da evidencia POC contacts C4 pre-RED (1ra C3 retroactive surface post-edits;
  // 2da C4 PROACTIVE surface pre-edits — pattern matures cumulative). Marco
  // lock P-δ revised split C4-pre prerequisite gate (re-exports Contact POJO
  // + ContactFilters + ContactWithBalance flat isomorphic + Test 14 retire
  // skip+comment archaeology) mirror C3-pre + C0-pre prerequisite gate
  // precedent EXACT. Skip vs delete wholesale: archaeology preserved + delete
  // wholesale defer D1 doc-only post-mortem si surface cleanup preference
  // futuro. `it.skip` (NO `describe.skip`) preserva diagnostic granularity
  // per-test.
  it.skip("Test 14: modules/contacts/presentation/server.ts contains `export { ContactsService } from \"@/features/contacts/server\"` (canonical Opción A re-export legacy shim class identity preserved — preserves zero-arg ctor + ContactRow POJO shape + Balance methods + class identity defer C4 wholesale delete features/contacts/*)", () => {
    const source = fs.readFileSync(HEX_BARREL_SERVER, "utf8");
    expect(source).toMatch(HEX_BARREL_OPCION_A_REEXPORT_RE);
  });
});
