/**
 * POC nuevo contacts C5 RED — page.tsx callsite + page.test.ts vi.mock SHAPE
 * cutover VALUE-axis cross-module dependency legacy shim re-export
 * `ContactsService` class from `@/modules/contacts/presentation/server`
 * (Opción A re-export from C1 GREEN línea 13 — `features/contacts/server.ts`
 * legacy shim end-to-end via `toLegacyShape = entity.toSnapshot()` +
 * `listWithBalances()` flatten método nested→flat) → hex cross-module factory
 * `makeContactBalancesService().listWithBalancesFlat()` from
 * `@/modules/contact-balances/presentation/server` atomic single-axis Path α
 * single ciclo C5 (mirror payment C1 + contacts C1/C2/C3 split granularity
 * precedent EXACT — VALUE-axis emergente cross-cycle deferred a C5 separate
 * sub-cycle Marco lock Q-pre2 prior C4-pre).
 *
 * Axis: page.tsx callsite consumer + page.test.ts vi.mock SHAPE swap (1 page +
 * 1 test) cutover OUT of legacy shim `@/modules/contacts/presentation/server`
 * re-export `ContactsService` class (zero-arg `new ContactsService()` exposing
 * Balance methods passthrough vía `features/contacts/server.ts:91-131`
 * delegating internally a `makeContactBalancesService()`) → directo cross-module
 * hex factory `makeContactBalancesService().listWithBalancesFlat()` desde
 * `@/modules/contact-balances/presentation/server` canonical hex barrel
 * cross-module composition root + factory método NEW `listWithBalancesFlat()`
 * ADD a hex application service layer (Marco lock Sub-α ADD a GREEN atomic
 * cutover + dependency simultaneous mirror C2/C3 GREEN precedent EXACT).
 *
 * 3 axis-distinct invariant collisions resolution mode aplicado C5
 * (homogeneous cross-file axis page.tsx + page.test.ts — VALUE-axis):
 *   - (1) Constructor signature: `new ContactsService()` zero-arg legacy
 *     shim → `makeContactBalancesService()` factory zero-arg cross-module
 *     composition root (homogeneous mirror C3 ctor zero-arg).
 *   - (2) Method coverage: legacy shim `listWithBalances()` flatten método
 *     nested→flat adapter `features/contacts/server.ts:119-131` (`.map(({
 *     contact, balanceSummary }) => ({ ...toLegacyShape(contact), balanceSummary
 *     }))`) → split natural a `makeContactBalancesService().listWithBalancesFlat()`
 *     factory método NEW ADD a `modules/contact-balances/application/contact-balances.service.ts`
 *     (NEXT to existing `listWithBalances()` nested método base — preserve
 *     hex application contract base + flat adapter promote a hex presentation
 *     factory método NEW Marco lock Q-pre2 Q2.3 (c) "factory método NO
 *     standalone preserva DI pattern hex consistent").
 *   - (3) Return shape §13.A5-ε: declared NO MATERIAL preliminar (Marco lock
 *     A1 flat POJO via `contact.toSnapshot()` mirror legacy shim shape EXACT
 *     `features/contacts/server.ts:127-131`) — `listWithBalancesFlat()`
 *     retorna flat POJO `Array<Contact-POJO + balanceSummary>` mismo shape
 *     consumer `ContactList` espera vía `JSON.parse(JSON.stringify(contacts))`
 *     RSC boundary serialization adapter crude workaround pre-existente
 *     (cleanup defer D1 doc-only NO scope creep mid-C5). Mirror mortality C1
 *     NO MATERIAL precedent + Path simplificado v2 RSC boundary serialization
 *     adapter §13 1ra evidencia POC mortality C1 (entity.toSnapshot() POJO
 *     server-side pre-RSC boundary).
 *
 * Marco locks pre-RED C5:
 *   - Lock 1 (Reorder C5 antes C4) Marco lock #1: dependency chain page.tsx
 *     listWithBalances() consumer transitorio — features/contacts/server.ts
 *     shim sobrevive hasta C4 wholesale delete post-C5 GREEN clean. POC
 *     contacts secuencia revised: C0-pre + C1 + C2 + C3 + C4-pre + C5 + C4 +
 *     D1 (8 sub-fases). Opción 1/3 rejected (Opción 1 sub-completa wholesale
 *     semánticamente; Opción 3 rompe Q-pre2 atomic single-axis discipline).
 *   - Lock A (A1 Flat POJO via contact.toSnapshot()) Marco lock #2: mirror
 *     legacy shim shape EXACT `features/contacts/server.ts:127-131` + NO
 *     MATERIAL §13.A5-ε + Path simplificado v2 mortality precedent. Cleanup
 *     `JSON.parse/stringify` workaround crude defer D1 doc-only NO scope
 *     creep mid-C5. A2 (entity-direct flat) rejected (preserva workaround
 *     crude pero MATERIAL divergence si fields scalar diverge).
 *   - Lock B (B1 Factory mock pattern) Marco lock #3: alinea con cutover
 *     factory pattern hex (NO class identity preserved como C1 Opción A).
 *     vi.mock SHAPE post-cutover refleja consumer real
 *     `vi.mock(.., () => ({ makeContactBalancesService: vi.fn(() => ({
 *     listWithBalancesFlat: mockListWithBalances })) }))`. B2 (class mock
 *     pattern preservar) rejected (preserva pattern actual pero NO refleja
 *     factory cutover — divergence consumer real vs mock SHAPE).
 *   - Lock C (C-α' Split C5-pre prerequisite gate) Marco lock #4: mirror
 *     C3-pre + C4-pre precedent EXACT cumulative. Single-axis discipline
 *     (Test 6 + Test 12 retire ≠ VALUE cutover). Bisect-friendly.
 *   - Lock D (D-β C5-pre + C5 split) Marco lock #5: 3 commits totales (C5-pre
 *     + C5 RED + C5 GREEN). Consistent C-α' decision + cumulative C3-pre/C4-pre
 *     precedent.
 *   - Lock C5-pre Opción 1 (absorb Test 6 + Test 12 retire ambos) Marco lock
 *     #6: same-axis cementación count POSITIVE retire pre-cutover mirror
 *     C3-pre Tests 3-5 (3 tests same axis hex import path POSITIVE) precedent
 *     EXACT. cross-cycle-red-test-cementacion-gate 3ra evidencia PROACTIVE
 *     matures cumulative cross-POC (1ra C3 retroactive + 2da C4 PROACTIVE +
 *     3ra C5 PROACTIVE). Opción 2/3 rejected (Opción 2 over-split same-axis;
 *     Opción 3 rompe TDD discipline absorb retire en GREEN).
 *   - Lock Sub-α (ADD listWithBalancesFlat() a C5 GREEN) Marco lock #7: TDD
 *     purist + single-axis EXACT preservation + mirror C2/C3 GREEN precedent
 *     EXACT (atomic cutover + dependency simultaneous). Sub-β/γ rejected
 *     (Sub-β rompe single-axis Test retire dual-axis; Sub-γ over-splits 4
 *     commits). Factory método NEW ADD a hex application service class +
 *     factory return contiene método (NO standalone function export — preserva
 *     DI pattern hex consistent Marco lock Q-pre2 Q2.3 (c) heredado).
 *   - Lock Test file location (modules/contact-balances/presentation/__tests__/)
 *     Marco lock #8: target hex ownership — alinea con cementación target
 *     `listWithBalancesFlat()` factory método NEW. Self-contained future-proof
 *     vs C4 wholesale delete `features/contacts/*` (test vive hex module NO
 *     toca features/contacts).
 *   - Lock 8 α scope confirmed Marco lock #9: 4 page.tsx (T1-T4 POS/NEG pair)
 *     + 4 page.test.ts (T5-T8 POS/NEG pair). NO Section C runtime shape
 *     assertions (NO MATERIAL §13.A5-ε declared L3-equivalente). Mirror C3
 *     RED 8α structure EXACT.
 *
 * Marco lock final RED scope C5 (8 assertions α):
 *
 *   ── A: page.tsx POSITIVE/NEGATIVE pair (Tests 1-4) ──
 *   1 file individual diagnostic granularity preserved (high signal — server
 *   component callsite single source).
 *     T1 page.tsx POS: import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server"
 *     T2 page.tsx NEG: NO import { ContactsService } from "@/modules/contacts/presentation/server"
 *     T3 page.tsx POS: `.listWithBalancesFlat(` factory método call invocation
 *     T4 page.tsx NEG: NO `new ContactsService(` instantiation OR `.listWithBalances(` legacy método call (consolidated regex alternation)
 *
 *   ── B: page.test.ts POSITIVE/NEGATIVE pair (Tests 5-8) ──
 *   1 test file individual diagnostic granularity preserved (vi.mock SHAPE
 *   target swap + factory mock pattern Marco lock B1 reflects consumer real).
 *     T5 page.test.ts POS: vi.mock("@/modules/contact-balances/presentation/server"
 *     T6 page.test.ts NEG: NO vi.mock("@/modules/contacts/presentation/server"
 *     T7 page.test.ts POS: factory mock pattern `makeContactBalancesService:\s*vi\.fn\(`
 *     T8 page.test.ts NEG: NO class mock pattern `class ContactsService`
 *
 * Expected RED failure mode pre-GREEN (per
 * `feedback_red_acceptance_failure_mode` + `feedback_enumerated_baseline_failure_ledger`):
 *   - T1 FAIL: page.tsx hoy importa `ContactsService` from `@/modules/contacts/presentation/server` (vía línea 13 legacy shim re-export Opción A) — toMatch hex factory pattern no match
 *   - T2 FAIL: page.tsx hoy contiene legacy import statement — not.toMatch reverses
 *   - T3 FAIL: page.tsx hoy `.listWithBalances(` legacy método call NOT `.listWithBalancesFlat(` factory método NEW — toMatch no match
 *   - T4 FAIL: page.tsx hoy contiene `new ContactsService()` instantiation Y `.listWithBalances(` método call — not.toMatch alternation reverses
 *   - T5 FAIL: page.test.ts hoy `vi.mock("@/modules/contacts/presentation/server", ...)` NOT `@/modules/contact-balances/presentation/server` — toMatch no match
 *   - T6 FAIL: page.test.ts hoy contiene legacy vi.mock target — not.toMatch reverses
 *   - T7 FAIL: page.test.ts hoy `class ContactsService { listWithBalances = mockListWithBalances }` class mock pattern NOT factory mock pattern Marco lock B1 — toMatch no match
 *   - T8 FAIL: page.test.ts hoy contiene `class ContactsService` class mock pattern — not.toMatch reverses
 * Total expected FAIL pre-GREEN: 8/8 honest declared enumerated explicit.
 *
 * Self-contained future-proof check: shape test asserta paths a 2 archivos
 * (page.tsx + page.test.ts) que persisten post C4 wholesale delete
 * `features/contacts/*`. Test vive en
 * `modules/contact-balances/presentation/__tests__/` — NO toca
 * `features/contacts/*` que C4 borrará. Self-contained vs future deletes ✓.
 *
 * Cross-cycle-red-test-cementacion-gate verify CLEAN pre-RED este turno:
 *   - C5 RED assertions sobre `@/features/contacts/*` paths: ❌ NO (C5 cutover
 *     ES away from features/contacts target)
 *   - C5 RED assertions sobre 5 components / 2 ai-agent tests: ❌ NO (C5 NO
 *     toca esos consumers — C4 scope post-C5)
 *   - C5 RED assertions sobre línea 13 modules/contacts/presentation/server.ts:
 *     ❌ NO (C4 DROP scope post-C5)
 *   - D1 doc-only post-mortem: ❌ NO code overlap
 *   ✅ Cross-cycle gate fully clean — C5 RED scope NO overlap C4 + D1 paths.
 *
 * Source-string assertion pattern: mirror precedent contacts C3 + C2 + C1 +
 * payment C4-α + C0-pre EXACT (`fs.readFileSync` regex match). Target
 * asserciones page.tsx callsite consumer + page.test.ts vi.mock SHAPE swap
 * cutover dependency surface paths.
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α multi-level composition-root delegation (20ma
 *     evidencia matures cumulative cross-POC sub-cycle continuation post C5-pre
 *     19ma + C4-pre 19ma + C3 GREEN 18ma + C3-pre 17ma + C3 RED 16ma)
 *   - architecture.md §13.A5-ε declared NO MATERIAL preliminar (Marco lock A1
 *     flat POJO mirror legacy shim shape EXACT — Path simplificado v2 RSC
 *     boundary serialization adapter mortality C1 precedent)
 *   - engram canonical home `arch/§13/A5-alpha-multi-level-composition-root-delegation`
 *     (matures cumulative POC contacts C5 20ma evidencia)
 *   - engram canonical home `arch/§13/path-simplificado-v2-rsc-boundary-serialization-adapter`
 *     (POC mortality C1 1ra evidencia + POC contacts C5 2da evidencia
 *     entity.toSnapshot() POJO server-side pre-RSC boundary)
 *   - engram `poc-nuevo/contacts/c4-pre/closed` (preceding sub-cycle bookmark
 *     cycle-start este turno heredado + Step 0 checklist applied)
 *   - engram `poc-nuevo/contacts/c3/closed` (preceding sub-cycle bookmark
 *     C3 GREEN cumulative precedent split granularity homogeneous cross-route)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` 3ra evidencia
 *     PROACTIVE C5 pre-RED matures cumulative cross-POC + Test 6 + Test 12
 *     retire C5-pre absorb same-axis Opción 1
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest
 *     8/8 enumerated explicit per `feedback_enumerated_baseline_failure_ledger`)
 *   - engram `feedback_invariant_collision_elevation` (3 axis-distinct
 *     collisions resolution mode applied homogeneous cross-file VALUE-axis)
 *   - engram `feedback_red_regex_discipline` (regex discipline mirror
 *     precedent C3 + C2 + C1 EXACT — \b boundaries + import specifier list
 *     precision + alternation T4 NEG consolidated)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite +
 *     rationale + cross-ref applied RED body)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate
 *     suficiente post-RED + trust bookmark `1ea5bb7` post-C5-pre baseline
 *     pre-RED skip suite full)
 *   - engram `feedback_pre_phase_audit` (ESLint pre-phase audit post-RED
 *     authoring MANDATORY clean lección NEW C1 cascade-NEW retroactive
 *     aplicación cumulative)
 *   - app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx (target T1-T4)
 *   - app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts
 *     (target T5-T8)
 *   - modules/contact-balances/presentation/server.ts (hex barrel
 *     cross-module factory + Balance types ContactBalanceSummary +
 *     ContactWithBalance nested + PendingDocument + CreditBalance VO already
 *     exposed; ADD listWithBalancesFlat() factory método via class application
 *     service + factory return contiene método C5 GREEN scope Sub-α)
 *   - modules/contact-balances/presentation/composition-root.ts:9
 *     (`makeContactBalancesService()` zero-arg factory cross-module
 *     composition root canonical)
 *   - modules/contact-balances/application/contact-balances.service.ts:98-109
 *     (existing `listWithBalances()` nested método base preserved + ADD
 *     `listWithBalancesFlat()` flat POJO via contact.toSnapshot() C5 GREEN
 *     scope Sub-α atomic dependency)
 *   - features/contacts/server.ts:119-131 (legacy shim `listWithBalances()`
 *     flatten método nested→flat adapter precedent EXACT — mirror shape
 *     `.map(({ contact, balanceSummary }) => ({ ...toLegacyShape(contact),
 *     balanceSummary }))` Marco lock A1)
 *   - modules/contacts/presentation/__tests__/c1-cutover-services-shape.poc-nuevo-contacts.test.ts
 *     (Tests 6 + 12 retired C5-pre commit `1ea5bb7` skip+comment archaeology
 *     pre-cutover same-axis cementación count POSITIVE Opción 1)
 *   - modules/contact-balances/presentation/__tests__/c3-cutover-routes-api-balance-shape.poc-nuevo-contacts.test.ts
 *     (precedent C3 RED preceding cycle structure mirror EXACT — 8α 4 POS
 *     pairs + 4 NEG pairs page.tsx/page.test.ts homogeneous cross-file)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const PAGE_FILE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx",
);
const PAGE_TEST_FILE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

// Regex precision rationale (per `feedback_red_regex_discipline`): mirror
// precedent contacts C3 + C2 + C1 EXACT — `\b` word boundaries on imported
// identifier + import specifier list pattern. Hex barrel
// `@/modules/contacts/presentation/server` re-exports `ContactsService` class
// (Opción A re-export from C1 GREEN línea 13), so legacy NEG regex targets the
// import statement on page.tsx (source path `@/modules/contacts/presentation/server`),
// NOT the barrel re-export. Cross-module barrel
// `@/modules/contact-balances/presentation/server` exposes
// `makeContactBalancesService` factory NATIVAMENTE — no name collision with
// contacts barrel, no overlap. T4 NEG alternation regex uses non-capturing
// group `(?:...|...)` with `\b` boundaries on both legacy patterns; method
// call regex `\.listWithBalances\(` matches exact paren NOT `\.listWithBalancesFlat\(`
// (parser fails on `F` after `Balances`, no Flat suffix).
const HEX_FACTORY_IMPORT_RE =
  /import\s*\{[^}]*\bmakeContactBalancesService\b[^}]*\}\s*from\s+["']@\/modules\/contact-balances\/presentation\/server["']/;
const LEGACY_SHIM_CONTACTS_SERVICE_IMPORT_RE =
  /import\s*\{[^}]*\bContactsService\b[^}]*\}\s*from\s+["']@\/modules\/contacts\/presentation\/server["']/;
const FACTORY_LIST_FLAT_CALL_RE = /\.listWithBalancesFlat\s*\(/;
const LEGACY_NEW_CTOR_OR_LIST_BALANCES_RE =
  /(?:\bnew\s+ContactsService\s*\(|\.listWithBalances\s*\()/;
const VI_MOCK_HEX_CONTACT_BALANCES_RE =
  /vi\.mock\(\s*["']@\/modules\/contact-balances\/presentation\/server["']/;
const VI_MOCK_LEGACY_HEX_CONTACTS_RE =
  /vi\.mock\(\s*["']@\/modules\/contacts\/presentation\/server["']/;
const FACTORY_MOCK_PATTERN_RE =
  /\bmakeContactBalancesService\s*:\s*vi\.fn\s*\(/;
const CLASS_MOCK_PATTERN_RE = /\bclass\s+ContactsService\b/;

describe("POC nuevo contacts C5 — page.tsx callsite + page.test.ts vi.mock SHAPE cutover VALUE-axis cross-module legacy shim ContactsService → hex factory makeContactBalancesService().listWithBalancesFlat() atomic single-axis Path α (Marco lock 1 reorder C5 antes C4 + Lock A1 flat POJO contact.toSnapshot() + Lock B1 factory mock pattern + Lock C-α' split prerequisite gate + Lock D-β 3 commits + Sub-α ADD listWithBalancesFlat() factory método a GREEN)", () => {
  // ── A: page.tsx POSITIVE/NEGATIVE pair (Tests 1-4) ──────────────────────
  // Marco lock 1 reorder C5 antes C4 — page.tsx callsite consumer single
  // source diagnostic granularity preserved (high signal — server component
  // listWithBalances callsite + class instantiation pre-cutover dependency
  // chain). Mirror C3 A per-route POSITIVE precedent EXACT (homogeneous
  // cross-file VALUE-axis).

  it("Test 1: page.tsx DOES import { makeContactBalancesService } from `@/modules/contact-balances/presentation/server` (hex cross-module factory POSITIVE post-cutover Marco lock 1 reorder + Lock A1 flat POJO)", () => {
    const source = fs.readFileSync(PAGE_FILE, "utf8");
    expect(source).toMatch(HEX_FACTORY_IMPORT_RE);
  });

  it("Test 2: page.tsx NO contains `import { ContactsService } from \"@/modules/contacts/presentation/server\"` (legacy shim ContactsService class identity import dropped post-cutover Marco lock 1 — listWithBalances consumer split natural a hex cross-module makeContactBalancesService factory)", () => {
    const source = fs.readFileSync(PAGE_FILE, "utf8");
    expect(source).not.toMatch(LEGACY_SHIM_CONTACTS_SERVICE_IMPORT_RE);
  });

  it("Test 3: page.tsx contains `.listWithBalancesFlat(` factory método call invocation (POSITIVE flat POJO factory método NEW post-cutover Marco lock A1 mirror legacy shim shape EXACT features/contacts/server.ts:127-131 contact.toSnapshot() + Sub-α ADD a GREEN atomic dependency)", () => {
    const source = fs.readFileSync(PAGE_FILE, "utf8");
    expect(source).toMatch(FACTORY_LIST_FLAT_CALL_RE);
  });

  it("Test 4: page.tsx NO contains `new ContactsService(` instantiation OR `.listWithBalances(` legacy método call (consolidated NEG alternation — legacy class instantiation + nested-flatten método dropped post-cutover Marco lock 1 + Lock A1 — factory pattern hex cross-module canonical replaces both axes)", () => {
    const source = fs.readFileSync(PAGE_FILE, "utf8");
    expect(source).not.toMatch(LEGACY_NEW_CTOR_OR_LIST_BALANCES_RE);
  });

  // ── B: page.test.ts POSITIVE/NEGATIVE pair (Tests 5-8) ──────────────────
  // Marco lock B1 factory mock pattern alinea con cutover factory pattern
  // hex (NO class identity preserved como C1 Opción A). vi.mock SHAPE
  // post-cutover refleja consumer real `vi.mock(.., () => ({
  // makeContactBalancesService: vi.fn(() => ({ listWithBalancesFlat:
  // mockListWithBalances })) }))`. Mirror C3 D NEG consolidated precedent
  // EXACT (page.test.ts vi.mock SHAPE swap target axis-distinct vs page.tsx
  // callsite axis A — homogeneous cross-file VALUE-axis).

  it("Test 5: page.test.ts contains `vi.mock(\"@/modules/contact-balances/presentation/server\", ...)` target swap POSITIVE (hex cross-module factory mock target post-cutover Marco lock B1 reflects consumer real factory pattern hex)", () => {
    const source = fs.readFileSync(PAGE_TEST_FILE, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_CONTACT_BALANCES_RE);
  });

  it("Test 6: page.test.ts NO contains `vi.mock(\"@/modules/contacts/presentation/server\", ...)` (legacy hex contacts vi.mock target dropped post-cutover Marco lock B1 — vi.mock SHAPE refleja factory consumer real NO class identity preserved como C1 Opción A)", () => {
    const source = fs.readFileSync(PAGE_TEST_FILE, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_HEX_CONTACTS_RE);
  });

  it("Test 7: page.test.ts contains `makeContactBalancesService: vi.fn(` factory mock pattern (POSITIVE factory mock pattern post-cutover Marco lock B1 — refleja consumer real hex factory cutover NO class identity)", () => {
    const source = fs.readFileSync(PAGE_TEST_FILE, "utf8");
    expect(source).toMatch(FACTORY_MOCK_PATTERN_RE);
  });

  it("Test 8: page.test.ts NO contains `class ContactsService` class mock pattern (legacy class mock pattern dropped post-cutover Marco lock B1 — factory mock pattern hex canonical replaces, NO class identity preserved como C1 Opción A pattern)", () => {
    const source = fs.readFileSync(PAGE_TEST_FILE, "utf8");
    expect(source).not.toMatch(CLASS_MOCK_PATTERN_RE);
  });
});
