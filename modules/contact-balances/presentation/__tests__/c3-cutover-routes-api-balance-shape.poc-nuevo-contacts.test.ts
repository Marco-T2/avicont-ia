/**
 * POC nuevo contacts C3 RED — cross-module routes API Balance methods cutover
 * 3 routes API (`balance/route.ts` + `credit-balance/route.ts` +
 * `pending-documents/route.ts`) dependency legacy shim re-export
 * `ContactsService` class from `@/modules/contacts/presentation/server` (Opción
 * A re-export from C1 GREEN — `features/contacts/server.ts` legacy class
 * preserved end-to-end via `toLegacyShape = entity.toSnapshot()`) → hex
 * cross-module factory `makeContactBalancesService()` from
 * `@/modules/contact-balances/presentation/server` atomic single-axis Path α
 * single ciclo C3 (mirror payment C1 + contacts C1 split granularity
 * precedent — homogeneous cross-route 3 routes share pattern uniforme).
 *
 * Axis: Balance method consumers (3 routes API) cutover OUT of legacy shim
 * `@/modules/contacts/presentation/server` re-export `ContactsService` class
 * (zero-arg `new ContactsService()` exposing Balance methods passthrough vía
 * `features/contacts/server.ts:91-131` delegating internally a
 * `makeContactBalancesService()`) → directo cross-module hex factory
 * `makeContactBalancesService()` desde `@/modules/contact-balances/presentation/server`
 * canonical hex barrel cross-module composition root. Path swap mecánico
 * atomic single-axis preservation Marco lock L1 Q1 Opción α.
 *
 * 3 axis-distinct invariant collisions resolution mode aplicado C3
 * (homogeneous cross-route — NO axis-distinct entre routes):
 *   - (1) Constructor signature: `new ContactsService()` zero-arg legacy
 *     shim → `makeContactBalancesService()` factory zero-arg cross-module
 *     composition root (homogeneous).
 *   - (2) Method coverage: legacy shim expone Balance methods passthrough
 *     (`getBalanceSummary` + `getCreditBalance` + `getPendingDocuments`) →
 *     split natural a `makeContactBalancesService()` cross-module donde
 *     residen NATIVAMENTE en
 *     `modules/contact-balances/application/contact-balances.service.ts`
 *     (NOT en hex `modules/contacts/application/contacts.service.ts`).
 *   - (3) Return shape §13.A5-ε: declared NO MATERIAL preliminar (Marco lock
 *     L3 Q3=I) — `getBalanceSummary` retorna `ContactBalanceSummary` POJO
 *     puro, `getCreditBalance` retorna `Promise<number>` scalar puro,
 *     `getPendingDocuments` retorna `PendingDocument[]` POJO puro. Sin
 *     entities con VO embedded, NO `.toSnapshot()` adapter aplicable, NO
 *     Section C runtime shape assertions. Mirror mortality C1 NO MATERIAL
 *     precedent.
 *
 * Marco locks pre-RED C3:
 *   - L1 (Q1 Opción α single ciclo atomic 4 archivos) Marco lock #1: 3 routes
 *     API + 1 RED test single file shape contract atomic single-axis Path α.
 *     NO split β. Las 3 routes comparten pattern uniforme — homogeneous
 *     cross-route. Mirror payment C1 + contacts C1 split granularity
 *     precedent EXACT.
 *   - L2 (Q2 Opción B preserve asymmetry instanciación) Marco lock #2:
 *     `balance/route.ts` per-request instantiation preserved (zero-arg
 *     `new` o factory call inside handler), `credit-balance/route.ts` +
 *     `pending-documents/route.ts` module-level singleton preserved
 *     (`const service = makeContactBalancesService()`). NO uniform refactor —
 *     single-axis cutover SOLO. Asimetría existente NO toca scope C3.
 *   - L3 (Q3 Opción I §13.A5-ε NO MATERIAL preliminar) Marco lock #3: POJO
 *     + scalar puros, NO entities con VO embedded. NO Section C runtime
 *     shape assertions. Mirror mortality C1 NO MATERIAL precedent. Si
 *     emerge MATERIAL future cycle, declare canonical home cementación
 *     target D1 doc-only.
 *   - L4 (Trust bookmark `0de1b48` post-GREEN C2) Marco lock #4: skip suite
 *     full pre-RED. Working tree clean post C2 commits, no edits
 *     intermedios. Per `feedback_low_cost_verification_asymmetry` heredado.
 *
 * Marco lock final RED scope C3 (8 assertions α):
 *
 *   ── A: Per-route hex barrel import target swap POSITIVE (Tests 1-3) ──
 *   3 routes individual diagnostic granularity preserved (high signal —
 *   auth boundary + per-route failure surface independent). Mirror C1 A1
 *   per-route POSITIVE precedent.
 *     T1 balance/route.ts POS: import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server"
 *     T2 credit-balance/route.ts POS: idem
 *     T3 pending-documents/route.ts POS: idem
 *
 *   ── B: Legacy shim ContactsService import dropped NEGATIVE consolidated (Test 4) ──
 *   3 routes joined collectively asserts NO route contains
 *   `import { ContactsService } from "@/modules/contacts/presentation/server"`.
 *   Cheap consolidated NEG single regex sweep (mirror C1 B consolidated
 *   negative pattern). Hex barrel re-export `ContactsService` from legacy
 *   shim Opción A (C1 GREEN line 13) NO viola NEG porque source path es el
 *   mismo barrel — assertion targetea el import statement en routes, NO el
 *   barrel re-export.
 *     T4 NEG: NO route contains legacy ContactsService import statement
 *
 *   ── C: Per-route factory call POSITIVE (Tests 5-7) ──
 *   3 routes individual diagnostic granularity factory call invocation. NO
 *   distingue per-request vs module-level singleton (Marco lock L2 Q2
 *   Opción B asymmetry preserved — ambos shapes acceptable post-cutover).
 *     T5 balance/route.ts POS: makeContactBalancesService( factory call
 *     T6 credit-balance/route.ts POS: idem
 *     T7 pending-documents/route.ts POS: idem
 *
 *   ── D: `new ContactsService(` instantiation dropped NEGATIVE consolidated (Test 8) ──
 *   3 routes joined collectively asserts NO route contains
 *   `new ContactsService(` instantiation. Mirror C2 T4 NEG pattern EXACT.
 *     T8 NEG: NO route contains `new ContactsService(` instantiation
 *
 * Expected RED failure mode pre-GREEN (per
 * `feedback_red_acceptance_failure_mode` + `feedback_enumerated_baseline_failure_ledger`):
 *   - T1 FAIL: balance/route.ts hoy importa `ContactsService` de legacy
 *     shim re-export — toMatch hex factory pattern no match
 *   - T2 FAIL: credit-balance/route.ts idem T1 — toMatch no match
 *   - T3 FAIL: pending-documents/route.ts idem T1 — toMatch no match
 *   - T4 FAIL: las 3 routes hoy contienen
 *     `import { ContactsService } from "@/modules/contacts/presentation/server"` —
 *     not.toMatch reverses
 *   - T5 FAIL: balance/route.ts hoy `new ContactsService()`, NOT
 *     `makeContactBalancesService()` factory call — toMatch no match
 *   - T6 FAIL: credit-balance/route.ts idem T5 — toMatch no match
 *   - T7 FAIL: pending-documents/route.ts idem T5 — toMatch no match
 *   - T8 FAIL: las 3 routes hoy contienen `new ContactsService(` — not.toMatch reverses
 * Total expected FAIL pre-GREEN: 8/8 honest declared enumerated explicit.
 *
 * Self-contained future-proof check: shape test asserta paths a 3 route
 * files que persisten post C4 wholesale delete `features/contacts/*`. Test
 * vive en `modules/contact-balances/presentation/__tests__/` — NO toca
 * `features/contacts/*` que C4 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent contacts C2 + C1 +
 * payment C4-α + C0-pre EXACT (`fs.readFileSync` regex match). Target
 * asserciones routes API cutover dependency surface paths.
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α multi-level composition-root delegation
 *     (16ma evidencia matures cumulative cross-POC sub-cycle continuation
 *     post C2 15ma)
 *   - architecture.md §13.A5-ε declared NO MATERIAL preliminar (Marco lock
 *     L3 Q3=I — POJO + scalar puros sin VO embedded)
 *   - engram canonical home `arch/§13/A5-alpha-multi-level-composition-root-delegation`
 *     (matures cumulative POC contacts C3 16ma evidencia)
 *   - engram `poc-nuevo/contacts/c2/closed` (preceding sub-cycle bookmark
 *     cycle-start este turno heredado + Step 0 checklist applied)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest
 *     8/8 enumerated explicit per `feedback_enumerated_baseline_failure_ledger`)
 *   - engram `feedback_invariant_collision_elevation` (3 axis-distinct
 *     collisions resolution mode applied homogeneous cross-route)
 *   - engram `feedback_red_regex_discipline` (regex discipline mirror
 *     precedent C2 + C1 EXACT — \b boundaries + import specifier list
 *     precision)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite +
 *     rationale + cross-ref applied RED body)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate
 *     suficiente post-RED + trust bookmark `0de1b48` post-GREEN C2
 *     baseline pre-RED skip suite full)
 *   - engram `feedback_pre_phase_audit` (ESLint pre-phase audit post-RED
 *     authoring MANDATORY clean lección NEW C1 cascade-NEW retroactive
 *     aplicación)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/balance/route.ts
 *     (target T1 + T5)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/credit-balance/route.ts
 *     (target T2 + T6)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/pending-documents/route.ts
 *     (target T3 + T7)
 *   - modules/contact-balances/presentation/server.ts (hex barrel
 *     cross-module factory + Balance types ContactBalanceSummary +
 *     PendingDocument + CreditBalance VO already exposed)
 *   - modules/contact-balances/presentation/composition-root.ts:9
 *     (`makeContactBalancesService()` zero-arg factory cross-module
 *     composition root canonical)
 *   - modules/accounting/infrastructure/__tests__/c2-cutover-adapter-shape.poc-nuevo-contacts.test.ts
 *     (precedent C2 RED preceding cycle structure mirror EXACT — adapter
 *     scope single side cross-module)
 *   - modules/contacts/presentation/__tests__/c1-cutover-services-shape.poc-nuevo-contacts.test.ts
 *     (precedent C1 RED — per-route POSITIVE granularity 5 routes)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const BALANCE_ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/balance/route.ts",
);
const CREDIT_BALANCE_ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/credit-balance/route.ts",
);
const PENDING_DOCUMENTS_ROUTE_FILE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/pending-documents/route.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

// Regex precision rationale (per `feedback_red_regex_discipline`): mirror
// precedent contacts C2 + C1 EXACT — `\b` word boundaries on imported
// identifier + import specifier list pattern. Hex barrel
// `@/modules/contacts/presentation/server` re-exports `ContactsService` class
// (Opción A re-export from C1 GREEN line 13), so legacy NEG regex targets the
// import statement on the routes (source path `@/modules/contacts/presentation/server`),
// NOT the barrel re-export. Cross-module barrel
// `@/modules/contact-balances/presentation/server` exposes
// `makeContactBalancesService` factory NATIVAMENTE — no name collision with
// contacts barrel, no overlap.
const HEX_FACTORY_IMPORT_RE =
  /import\s*\{[^}]*\bmakeContactBalancesService\b[^}]*\}\s*from\s+["']@\/modules\/contact-balances\/presentation\/server["']/;
const LEGACY_SHIM_CONTACTS_SERVICE_IMPORT_RE =
  /import\s*\{[^}]*\bContactsService\b[^}]*\}\s*from\s+["']@\/modules\/contacts\/presentation\/server["']/;
const FACTORY_CALL_RE = /\bmakeContactBalancesService\s*\(/;
const NEW_CONTACTS_SERVICE_RE = /\bnew\s+ContactsService\s*\(/;

describe("POC nuevo contacts C3 — cross-module routes API Balance methods cutover 3 routes API legacy shim ContactsService → hex factory makeContactBalancesService cross-module atomic single-axis Path α (Marco lock L1 Q1 Opción α single ciclo + L2 Q2 Opción B preserve asymmetry instanciación + L3 Q3 Opción I §13.A5-ε NO MATERIAL preliminar)", () => {
  // ── A: Per-route hex barrel import target swap POSITIVE (Tests 1-3) ─────
  // Marco lock L1 Q1 Opción α — 3 routes individual diagnostic granularity
  // preserved (high signal — auth boundary + per-route failure surface
  // independent). Mirror C1 A1 per-route POSITIVE precedent EXACT.

  it("Test 1: balance/route.ts DOES import { makeContactBalancesService } from `@/modules/contact-balances/presentation/server` (hex cross-module factory POSITIVE post-cutover Marco lock L1 Opción α atomic single-axis)", () => {
    const source = fs.readFileSync(BALANCE_ROUTE_FILE, "utf8");
    expect(source).toMatch(HEX_FACTORY_IMPORT_RE);
  });

  it("Test 2: credit-balance/route.ts DOES import { makeContactBalancesService } from `@/modules/contact-balances/presentation/server` (hex cross-module factory POSITIVE post-cutover Marco lock L1 Opción α)", () => {
    const source = fs.readFileSync(CREDIT_BALANCE_ROUTE_FILE, "utf8");
    expect(source).toMatch(HEX_FACTORY_IMPORT_RE);
  });

  it("Test 3: pending-documents/route.ts DOES import { makeContactBalancesService } from `@/modules/contact-balances/presentation/server` (hex cross-module factory POSITIVE post-cutover Marco lock L1 Opción α)", () => {
    const source = fs.readFileSync(PENDING_DOCUMENTS_ROUTE_FILE, "utf8");
    expect(source).toMatch(HEX_FACTORY_IMPORT_RE);
  });

  // ── B: Legacy shim ContactsService import dropped NEGATIVE consolidated (Test 4) ──
  // 3 routes joined collectively asserts NO route contains legacy import
  // statement `import { ContactsService } from "@/modules/contacts/presentation/server"`.
  // Hex barrel re-export Opción A line 13 NO viola — assertion targetea el
  // import statement en las routes (source path the barrel), NOT el barrel
  // re-export internals. Mirror C1 B consolidated NEG precedent.

  it("Test 4: NO route (balance + credit-balance + pending-documents) contains `import { ContactsService } from \"@/modules/contacts/presentation/server\"` (legacy shim ContactsService class identity import dropped post-cutover Marco lock L1 — Balance methods consumers split natural a hex cross-module makeContactBalancesService factory)", () => {
    const balanceSource = fs.readFileSync(BALANCE_ROUTE_FILE, "utf8");
    const creditBalanceSource = fs.readFileSync(
      CREDIT_BALANCE_ROUTE_FILE,
      "utf8",
    );
    const pendingDocumentsSource = fs.readFileSync(
      PENDING_DOCUMENTS_ROUTE_FILE,
      "utf8",
    );
    const joined = `${balanceSource}\n${creditBalanceSource}\n${pendingDocumentsSource}`;
    expect(joined).not.toMatch(LEGACY_SHIM_CONTACTS_SERVICE_IMPORT_RE);
  });

  // ── C: Per-route factory call POSITIVE (Tests 5-7) ──────────────────────
  // Marco lock L2 Q2 Opción B asymmetry preserved — `balance/route.ts`
  // per-request instantiation acceptable, `credit-balance/route.ts` +
  // `pending-documents/route.ts` module-level singleton acceptable. Ambos
  // shapes match `makeContactBalancesService(` factory invocation. NO uniform
  // refactor scope C3.

  it("Test 5: balance/route.ts contains `makeContactBalancesService(` factory invocation (POSITIVE factory pattern post-cutover — Marco lock L2 Q2 Opción B per-request instantiation preserved)", () => {
    const source = fs.readFileSync(BALANCE_ROUTE_FILE, "utf8");
    expect(source).toMatch(FACTORY_CALL_RE);
  });

  it("Test 6: credit-balance/route.ts contains `makeContactBalancesService(` factory invocation (POSITIVE factory pattern post-cutover — Marco lock L2 Q2 Opción B module-level singleton preserved)", () => {
    const source = fs.readFileSync(CREDIT_BALANCE_ROUTE_FILE, "utf8");
    expect(source).toMatch(FACTORY_CALL_RE);
  });

  it("Test 7: pending-documents/route.ts contains `makeContactBalancesService(` factory invocation (POSITIVE factory pattern post-cutover — Marco lock L2 Q2 Opción B module-level singleton preserved)", () => {
    const source = fs.readFileSync(PENDING_DOCUMENTS_ROUTE_FILE, "utf8");
    expect(source).toMatch(FACTORY_CALL_RE);
  });

  // ── D: `new ContactsService(` instantiation dropped NEGATIVE consolidated (Test 8) ──
  // 3 routes joined collectively asserts NO route contains
  // `new ContactsService(` instantiation. Mirror C2 T4 NEG pattern EXACT.

  it("Test 8: NO route (balance + credit-balance + pending-documents) contains `new ContactsService(` instantiation (legacy class instantiation dropped post-cutover Marco lock L1 — factory pattern hex cross-module canonical replaces)", () => {
    const balanceSource = fs.readFileSync(BALANCE_ROUTE_FILE, "utf8");
    const creditBalanceSource = fs.readFileSync(
      CREDIT_BALANCE_ROUTE_FILE,
      "utf8",
    );
    const pendingDocumentsSource = fs.readFileSync(
      PENDING_DOCUMENTS_ROUTE_FILE,
      "utf8",
    );
    const joined = `${balanceSource}\n${creditBalanceSource}\n${pendingDocumentsSource}`;
    expect(joined).not.toMatch(NEW_CONTACTS_SERVICE_RE);
  });
});
