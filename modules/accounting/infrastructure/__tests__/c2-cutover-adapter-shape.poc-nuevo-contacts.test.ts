/**
 * POC nuevo contacts C2 RED — cross-module accounting infrastructure adapter
 * cutover `ContactsReadAdapter` dependency legacy shim → hex factory
 * `makeContactsService()` atomic single-axis (mirror receivables/payables
 * `contacts-existence.adapter.ts` shape EXACT — constructor DI default
 * factory pattern hex canonical adapter).
 *
 * Axis: ContactsReadAdapter dependency cutover OUT of legacy shim
 * `@/features/contacts/server` (zero-arg `new ContactsService()`) → canonical
 * hex barrel `@/modules/contacts/presentation/server` (`makeContactsService()`
 * factory). Path swap mecánico atomic single-axis preservation — mirror
 * payment C1+C2 split granularity precedent.
 *
 * §13.A reverse direction TYPE-only/existence-only 5ta evidencia matures
 * cumulative cross-POC — Q1-α retroactive reclassification post-emergente
 * surface Step 0 expand pre-RED este turno. Bookmark heredado clasificó
 * "VALUE 5ta evidencia matures cumulative" incorrect; inventory ground
 * truth confirma adapter retorna `Promise<void>` + único método
 * `getActiveById` pass-through narrow Contact→void NO consume VALUE fields
 * runtime. Premise verification MANDATORY pre-canonical claim recursive
 * aplicación per `feedback_textual_rule_verification` +
 * `feedback_invariant_collision_elevation` heredados — escalated NO
 * silently resolved.
 *
 * 3 axis-distinct invariant collisions detected pre-RED contacts C1
 * (constructor signature + method coverage + return shape) NO aplican C2
 * adapter scope:
 *   - (1) ctor zero-arg: `makeContactsService()` también zero-arg facade
 *     (PrismaContactRepository inyectado internamente) — sin colisión.
 *   - (2) method coverage: adapter solo usa `getActiveById` que existe en
 *     hex con signature compatible — Balance methods NO entran scope
 *     adapter.
 *   - (3) return shape: adapter retorna `Promise<void>` — NO aplica VALUE
 *     shape.
 * Las 3 collisions aplican naturalmente a 3 routes API Balance methods
 * (consumers separados scope C3+).
 *
 * Marco locks pre-RED C2:
 *   - L1 (Q1 Opción α atomic minimum natural) Marco lock #1: adapter cutover
 *     legacy shim → `makeContactsService()` hex factory + paired test mock
 *     swap. 2 archivos atomic single-axis estricto. Mirror payment C1+C2
 *     EXACT split precedent. Las 3 collisions deferidas a C3+ donde
 *     naturalmente aplican (Balance routes).
 *   - L2 (Q2 reclassification VALUE→TYPE-only retroactive) Marco lock #2:
 *     §13.A reverse direction TYPE-only/existence-only 5ta evidencia
 *     matures cumulative cross-POC. Bookmark VALUE 5ta cumulative incorrect
 *     — premise verification recursive aplicación NEW canonical home
 *     cementación target D1 doc-only.
 *   - L3 (Q3 5 ciclos preserved) Marco lock #3: C2 adapter mínimo + C3
 *     Balance routes (3 routes con 3 collisions resolution) + C4 wholesale
 *     delete `features/contacts/*` + D1 doc-only.
 *   - L4 (Trust bookmark `5e3dc3b` post-GREEN C1) Marco lock #4: skip suite
 *     full pre-RED. Working tree clean post C1 commits, no edits intermedios.
 *
 * Marco lock final RED scope C2 (6 assertions α):
 *
 *   ── A: Adapter file hex factory cutover (Tests 1-4) ──
 *   `modules/accounting/infrastructure/contacts-read.adapter.ts` cutover —
 *   import `makeContactsService` from hex barrel + factory call + drop
 *   legacy shim import + drop `new ContactsService()` instantiation.
 *     T1 POSITIVE: import { makeContactsService } from "@/modules/contacts/presentation/server"
 *     T2 NEGATIVE: NO import { ContactsService } from "@/features/contacts/server"
 *     T3 POSITIVE: makeContactsService(...) factory invocation present
 *     T4 NEGATIVE: NO `new ContactsService(...)` instantiation
 *
 *   ── B: Paired test vi.mock target swap §13.A4-η (Tests 5-6) ──
 *   `modules/accounting/infrastructure/__tests__/contacts-read.adapter.test.ts`
 *   vi.mock target swap MANDATORY paired §13.A4-η LOAD-BEARING factory
 *   render path coverage. Factory shape post-cutover — vi.mock changes from
 *   class identity (legacy `class { method }`) to factory return shape (hex
 *   `makeContactsService` returns service instance).
 *     T5 POSITIVE: vi.mock("@/modules/contacts/presentation/server", ...)
 *     T6 NEGATIVE: NO vi.mock("@/features/contacts/server", ...)
 *
 * Expected RED failure mode pre-GREEN (per
 * `feedback_red_acceptance_failure_mode`):
 *   - T1 FAIL: adapter hoy importa `ContactsService` de legacy shim — toMatch
 *     hex factory pattern no match
 *   - T2 FAIL: adapter hoy importa `from "@/features/contacts/server"` —
 *     not.toMatch reverses
 *   - T3 FAIL: adapter hoy `new ContactsService()`, NOT `makeContactsService()`
 *     factory call — toMatch factory pattern no match
 *   - T4 FAIL: adapter hoy contains `new ContactsService()` — not.toMatch
 *     reverses
 *   - T5 FAIL: paired test hoy vi.mock target legacy shim — toMatch hex
 *     target pattern no match
 *   - T6 FAIL: paired test hoy contains `vi.mock("@/features/contacts/server", ...)` —
 *     not.toMatch reverses
 * Total expected FAIL pre-GREEN: 6/6 honest declared.
 *
 * Self-contained future-proof check: shape test asserta paths
 * `modules/accounting/infrastructure/contacts-read.adapter.ts` y su paired
 * test que persisten post C4 wholesale delete `features/contacts/*`. Test
 * vive en `modules/accounting/infrastructure/__tests__/` — NO toca
 * `features/contacts/*` que C4 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent contacts C1 + payment
 * C4-α + C0-pre EXACT (`fs.readFileSync` regex match). Target asserciones
 * adapter cutover dependency surface paths + paired test vi.mock target.
 *
 * Cross-ref:
 *   - architecture.md §13.A reverse direction TYPE-only/existence-only 5ta
 *     evidencia matures cumulative cross-POC (cementación target D1
 *     doc-only NEW canonical home reclassification VALUE→TYPE-only)
 *   - engram canonical home `arch/§13/A5-alpha-multi-level-composition-root-delegation`
 *     (matures cumulative POC contacts C2 N+1ma evidencia post C1 14ma)
 *   - engram `poc-nuevo/contacts/c1/closed` (preceding sub-cycle bookmark
 *     cycle-start este turno heredado + Step 0 checklist applied)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest
 *     6/6 enumerated single side contacts C2)
 *   - engram `feedback_invariant_collision_elevation` (Q1-α retroactive
 *     reclassification VALUE→TYPE-only 5ta evidencia matures applied este
 *     turno + 3 axis-distinct collisions deferred a C3+ scope natural)
 *   - engram `feedback_textual_rule_verification` (premise verification
 *     pre-canonical claim recursive aplicación bookmark VALUE 5ta
 *     incorrect)
 *   - engram `feedback_red_regex_discipline` (regex discipline mirror
 *     precedent C1 EXACT — \b boundaries + import specifier list precision)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite +
 *     rationale + cross-ref applied RED body)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate
 *     suficiente post-RED + trust bookmark `5e3dc3b` post-GREEN C1
 *     baseline pre-RED skip suite full)
 *   - modules/accounting/infrastructure/contacts-read.adapter.ts (target
 *     T1-T4)
 *   - modules/accounting/infrastructure/__tests__/contacts-read.adapter.test.ts
 *     (target T5-T6 — vi.mock §13.A4-η LOAD-BEARING)
 *   - modules/receivables/infrastructure/contacts-existence.adapter.ts
 *     (precedent shape post-cutover EXACT — constructor DI default factory
 *     pattern hex canonical adapter 1ra evidencia)
 *   - modules/payables/infrastructure/contacts-existence.adapter.ts
 *     (precedent shape post-cutover EXACT 2da evidencia adapter pattern hex
 *     canonical)
 *   - modules/contacts/presentation/__tests__/c1-cutover-services-shape.poc-nuevo-contacts.test.ts
 *     (precedent C1 RED preceding cycle structure mirror EXACT)
 *   - modules/payment/presentation/__tests__/c4-alpha-cutover-adapter-shape.poc-nuevo-payment.test.ts
 *     (precedent payment C4-α adapter cutover RED structure mirror)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const ADAPTER_FILE = path.join(
  REPO_ROOT,
  "modules/accounting/infrastructure/contacts-read.adapter.ts",
);
const ADAPTER_TEST_FILE = path.join(
  REPO_ROOT,
  "modules/accounting/infrastructure/__tests__/contacts-read.adapter.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

// Regex precision rationale (per `feedback_red_regex_discipline`): mirror
// precedent contacts C1 EXACT — `\b` word boundaries on imported identifier
// + import specifier list pattern. Hex barrel re-exports both
// `makeContactsService` factory + `ContactsService` class (Opción A re-export
// from C1 GREEN), so `ContactsService` presence in barrel doesn't violate
// the negative regex on `@/features/contacts/server` (different source path).
const HEX_FACTORY_IMPORT_RE =
  /import\s*\{[^}]*\bmakeContactsService\b[^}]*\}\s*from\s+["']@\/modules\/contacts\/presentation\/server["']/;
const LEGACY_SHIM_CONTACTS_SERVICE_IMPORT_RE =
  /import\s*\{[^}]*\bContactsService\b[^}]*\}\s*from\s+["']@\/features\/contacts\/server["']/;
const FACTORY_CALL_RE = /\bmakeContactsService\s*\(/;
const NEW_CONTACTS_SERVICE_RE = /\bnew\s+ContactsService\s*\(/;
const HEX_BARREL_VI_MOCK_RE =
  /vi\.mock\(\s*["']@\/modules\/contacts\/presentation\/server["']/;
const LEGACY_SHIM_VI_MOCK_RE =
  /vi\.mock\(\s*["']@\/features\/contacts\/server["']/;

describe("POC nuevo contacts C2 — cross-module accounting infrastructure adapter cutover ContactsReadAdapter dependency legacy shim → hex factory makeContactsService atomic single-axis (§13.A reverse direction TYPE-only/existence-only 5ta evidencia matures cumulative cross-POC Q1-α retroactive reclassification + §13.A4-η vi.mock factory paired LOAD-BEARING)", () => {
  // ── A: Adapter file hex factory cutover (Tests 1-4) ─────────────────────
  // Marco lock L1 Q1 Opción α — adapter import + factory call + drop legacy
  // shim import + drop `new ContactsService()` instantiation. Mirror
  // precedent receivables/payables `contacts-existence.adapter.ts` EXACT
  // shape (constructor DI default factory pattern hex canonical adapter).

  it("Test 1: contacts-read.adapter.ts DOES import { makeContactsService } from `@/modules/contacts/presentation/server` (hex factory POSITIVE post-cutover Marco lock L1 Opción α atomic single-axis)", () => {
    const source = fs.readFileSync(ADAPTER_FILE, "utf8");
    expect(source).toMatch(HEX_FACTORY_IMPORT_RE);
  });

  it("Test 2: contacts-read.adapter.ts NO contains `import { ContactsService } from \"@/features/contacts/server\"` (legacy shim import dropped post-cutover Marco lock L1)", () => {
    const source = fs.readFileSync(ADAPTER_FILE, "utf8");
    expect(source).not.toMatch(LEGACY_SHIM_CONTACTS_SERVICE_IMPORT_RE);
  });

  it("Test 3: contacts-read.adapter.ts contains `makeContactsService(` factory invocation (POSITIVE factory pattern post-cutover mirror receivables/payables precedent EXACT — constructor DI default factory OR module-level singleton both acceptable shapes)", () => {
    const source = fs.readFileSync(ADAPTER_FILE, "utf8");
    expect(source).toMatch(FACTORY_CALL_RE);
  });

  it("Test 4: contacts-read.adapter.ts NO contains `new ContactsService(` instantiation (legacy class instantiation dropped post-cutover Marco lock L1 — factory pattern hex canonical replaces)", () => {
    const source = fs.readFileSync(ADAPTER_FILE, "utf8");
    expect(source).not.toMatch(NEW_CONTACTS_SERVICE_RE);
  });

  // ── B: Paired test vi.mock target swap §13.A4-η (Tests 5-6) ─────────────
  // Marco lock L1 paired vi.mock target swap MANDATORY §13.A4-η LOAD-BEARING
  // factory render path coverage. Factory shape post-cutover — vi.mock
  // changes from class identity (legacy `class { method }`) to factory
  // return shape (hex `makeContactsService` returns service instance).

  it("Test 5: contacts-read.adapter.test.ts contains `vi.mock(\"@/modules/contacts/presentation/server\", ...)` (POSITIVE vi.mock target swap §13.A4-η LOAD-BEARING factory pattern post-cutover paired)", () => {
    const source = fs.readFileSync(ADAPTER_TEST_FILE, "utf8");
    expect(source).toMatch(HEX_BARREL_VI_MOCK_RE);
  });

  it("Test 6: contacts-read.adapter.test.ts NO contains `vi.mock(\"@/features/contacts/server\", ...)` (legacy vi.mock target dropped post-cutover Marco lock L1)", () => {
    const source = fs.readFileSync(ADAPTER_TEST_FILE, "utf8");
    expect(source).not.toMatch(LEGACY_SHIM_VI_MOCK_RE);
  });
});
