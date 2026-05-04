/**
 * POC nuevo A4-C2 — org-settings cleanup Cat 3 cross-feature + cross-module
 * single-batch atomic shape (Path α'' merge cumulative confirmed runtime).
 *
 * Axis: cleanup atomic 5 archivos Cat 3 — 3 source (cross-feature/cross-module
 * deps internal callers) + 2 paired test files (type-only imports + mock value
 * shape adapters). Resolves §13.A4-δ cross-module dep + §13.A4-ε cross-feature
 * dep cementados pre-RED #1565.
 *
 * 5 archivos cleanup scope (verificados Step 0 A4-C2 + runtime fresh):
 *   - SOURCE 3 archivos / ~12 changes:
 *       features/dispatch/dispatch.service.ts (5 changes: import + factory
 *         fallback + 3 .toSnapshot() callsites en createAndPost/update/post)
 *       features/ai-agent/tools/find-accounts.ts (4 changes: import + factory
 *         fallback + 2 .toSnapshot() callsites en executeFindAccountsByPurpose
 *         /runHeuristic)
 *       modules/payment/infrastructure/adapters/legacy-org-settings.adapter.ts
 *         (3 changes: import + factory fallback + 1 .toSnapshot() callsite)
 *   - TESTS PAIRED 2 archivos / ~4 changes:
 *       features/dispatch/__tests__/dispatch.service.audit.test.ts (2 changes:
 *         type-only import target + mock value toSnapshot wrap)
 *       features/ai-agent/__tests__/tools.find-accounts.test.ts (2 changes:
 *         type-only import target + mock value toSnapshot wrap)
 *
 * Marco lock α final RED scope (21 assertions α — granular per callsite mirror
 * precedent A4-C1 T17-T18 GET+PATCH split honest):
 *   ── Source + tests cutover (Tests 1-10) ──
 *   - Tests 1-5 POSITIVE hex import present (5 files):
 *       T1 dispatch.service.ts → from "@/modules/org-settings/presentation/server"
 *       T2 find-accounts.ts → idem
 *       T3 legacy-org-settings.adapter.ts → idem
 *       T4 dispatch.service.audit.test.ts → idem
 *       T5 tools.find-accounts.test.ts → idem
 *   - Tests 6-10 NEGATIVE legacy import absent (5 files):
 *       T6-T10 NO from "@/features/org-settings/server"
 *
 *   ── Source factory callsite (Tests 11-13) ──
 *   - 3 source files makeOrgSettingsService callsite (no `new`):
 *       T11 dispatch.service.ts → makeOrgSettingsService() AND NOT new OrgSettingsService()
 *       T12 find-accounts.ts → idem
 *       T13 adapter → idem
 *
 *   ── Runtime path coverage .toSnapshot() granular per callsite (Tests 14-19) ──
 *   - dispatch.service.ts × 3 callsites split per method body:
 *       T14 createAndPost (línea 259-414) body contains `.toSnapshot()`
 *       T15 updatePostedDispatchTx (línea 550-779 PRIVATE method — corrected
 *           atomic mid-cycle GREEN commit body NAMED explicit; original RED
 *           scope cementó "async update(" PUBLIC method por inventory
 *           inferential method-name error §13.A4-ι NO-formal mirror §13.A4-ζ
 *           + §13.A4-θ precedents) body contains `.toSnapshot()`
 *       T16 post (línea 789-921) body contains `.toSnapshot()`
 *   - find-accounts.ts × 2 callsites split per function body:
 *       T17 executeFindAccountsByPurpose body contains `.toSnapshot()`
 *       T18 runHeuristic body contains `.toSnapshot()`
 *   - adapter × 1 callsite file-level:
 *       T19 source contains `.toSnapshot()`
 *
 *   ── Tests paired mock value shape adapter (Tests 20-21) ──
 *   - 2 test files mock value toSnapshot: key shape:
 *       T20 dispatch.service.audit.test.ts contains `toSnapshot:` key
 *       T21 tools.find-accounts.test.ts contains `toSnapshot:` key
 *
 * §13.A4-δ cross-module dep adapter cementado #1565 — resolved this RED scope:
 * legacy-org-settings.adapter.ts (modules/payment hex) ya NO importa
 * @/features/org-settings shim legacy. Cycle conceptual modules → features →
 * modules eliminado atomic mismo commit GREEN.
 *
 * §13.A4-ε cross-feature dep cementado #1565 — resolved this RED scope:
 * features/dispatch/dispatch.service.ts + features/ai-agent/tools/find-accounts.ts
 * cleanup paired mismo commit GREEN. Mirror precedent A3-C5 HubService refactor
 * decisión cross-feature dep cleanup pattern.
 *
 * §13.A4-α DTO divergence cementado pre-RED #1565 — 6 .toSnapshot() callsites
 * cubren resolución cross-feature/cross-module: 3 dispatch + 2 find-accounts +
 * 1 adapter. Total 6 + 4 (Cat 1 settings/general + 4 paired pages) + 2 (Cat 1
 * api route GET+PATCH) = 12 .toSnapshot() callsites POC nuevo A4 cumulative.
 *
 * §13.A4-η paired sister cumulative — Cat 2 vi.mock factory load-bearing
 * resolved A4-C1; A4-C2 type-only imports + mock value shape adapters
 * complementan resolution test mock contracts.
 *
 * §13.A4-θ candidate NO-cementado formal (Marco lock 2 confirmed): fixture
 * shape Prisma OrgSettings vs hex snapshot type divergence
 * (tools.find-accounts.test.ts:29-51 makeSettings) — categoría inventory
 * pre-recon fixture, encaja `feedback_textual_rule_verification` aplicado
 * fixtures (mirror §13.A4-ζ adapter @deprecated precedent NO-formal).
 * Surface honest GREEN commit body documentar fixture shape adapter
 * explicit + cross-ref §13.A4-ζ precedent. NO §13 escalation cementación
 * formal por scope dilución pattern cumulative cross-evidence.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T5 FAIL: source/tests todavía importan @/features/org-settings/server,
 *   regex match @/modules/org-settings/presentation/server falla.
 * - T6-T10 FAIL: legacy imports presentes, regex match negativo no se cumple.
 * - T11-T13 FAIL: `new OrgSettingsService()` callsites todavía presentes
 *   y `makeOrgSettingsService()` ausente.
 * - T14-T16 FAIL: `.toSnapshot()` ausente en createAndPost/update/post bodies.
 * - T17-T18 FAIL: `.toSnapshot()` ausente en executeFindAccountsByPurpose
 *   /runHeuristic bodies.
 * - T19 FAIL: `.toSnapshot()` ausente en adapter source.
 * - T20-T21 FAIL: mock value `toSnapshot:` key ausente en test files.
 * Total expected FAIL pre-GREEN: 21/21 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * que persisten post A4-C3 atomic delete `features/org-settings/` wholesale.
 * NO toca features/org-settings/* que A4-C3 borra. Self-contained vs future
 * deletes ✓.
 *
 * Source-string assertion pattern: mirror `c1-cutover-shape.poc-nuevo-a4.test.ts`
 * (A4-C1 RED precedent same POC) + `c2-cutover-shape.poc-nuevo-a3.test.ts`.
 *
 * Cross-ref:
 *   - architecture.md §13.7 #10/#11/#12/#13 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A4-α DTO divergence (cementación pre-RED #1565)
 *   - architecture.md §13.A4-β callers no-args (cementación pre-RED #1565)
 *   - architecture.md §13.A4-δ cross-module dep (cementación pre-RED #1565, resolved this commit)
 *   - architecture.md §13.A4-ε cross-feature dep (cementación pre-RED #1565, resolved this commit)
 *   - engram bookmark `poc-futuro/a4-org-settings/pre-recon-comprehensive` (#1565)
 *   - engram bookmark `poc-nuevo/a4/13.eta-mock-factory-load-bearing` (§13.A4-η post-RED)
 *   - engram bookmark `poc-nuevo/a3/closed` (#1562) baseline runtime hereda A4
 *   - modules/org-settings/presentation/server.ts (hex barrel cutover target)
 *   - modules/org-settings/presentation/__tests__/c1-cutover-shape.poc-nuevo-a4.test.ts (precedent A4-C1)
 *   - modules/purchase/presentation/__tests__/c2-cutover-shape.poc-nuevo-a3.test.ts (precedent A3-C2)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 3 source cleanup targets ─────────────────────────────────────────────

const DISPATCH_SERVICE = path.join(
  REPO_ROOT,
  "features/dispatch/dispatch.service.ts",
);
const FIND_ACCOUNTS = path.join(
  REPO_ROOT,
  "features/ai-agent/tools/find-accounts.ts",
);
const PAYMENT_ADAPTER = path.join(
  REPO_ROOT,
  "modules/payment/infrastructure/adapters/legacy-org-settings.adapter.ts",
);

// ── Cat 3 paired test cleanup targets ────────────────────────────────────────

const DISPATCH_AUDIT_TEST = path.join(
  REPO_ROOT,
  "features/dispatch/__tests__/dispatch.service.audit.test.ts",
);
const FIND_ACCOUNTS_TEST = path.join(
  REPO_ROOT,
  "features/ai-agent/__tests__/tools.find-accounts.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/org-settings\/presentation\/server["']/;
const LEGACY_SERVER_RE = /from\s*["']@\/features\/org-settings\/server["']/;

const MAKE_FACTORY_RE = /makeOrgSettingsService\(\)/;
const NEW_LEGACY_CTOR_RE = /new\s+OrgSettingsService\s*\(\s*\)/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;
const MOCK_TO_SNAPSHOT_KEY_RE = /toSnapshot\s*:/;

describe("POC nuevo A4-C2 — org-settings cleanup Cat 3 cross-feature/cross-module shape", () => {
  // ── POSITIVE source-shape (Tests 1-5) — hex import present ─────────────────

  it("Test 1: dispatch.service.ts imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: find-accounts.ts imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 3: legacy-org-settings.adapter.ts imports OrgSettingsService factory from hex presentation/server", () => {
    const source = fs.readFileSync(PAYMENT_ADAPTER, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 4: dispatch.service.audit.test.ts imports OrgSettingsService type from hex presentation/server", () => {
    const source = fs.readFileSync(DISPATCH_AUDIT_TEST, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 5: tools.find-accounts.test.ts imports OrgSettingsService type from hex presentation/server", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS_TEST, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  // ── NEGATIVE source-shape (Tests 6-10) — legacy import absent ──────────────

  it("Test 6: dispatch.service.ts does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 7: find-accounts.ts does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 8: legacy-org-settings.adapter.ts does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(PAYMENT_ADAPTER, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 9: dispatch.service.audit.test.ts does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(DISPATCH_AUDIT_TEST, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 10: tools.find-accounts.test.ts does NOT import from legacy @/features/org-settings/server", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS_TEST, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  // ── POSITIVE factory callsite (Tests 11-13) — makeOrgSettingsService ───────
  // §13.A4-β callers no-args resolution: 0-args `new OrgSettingsService()`
  // → factory `makeOrgSettingsService()` composition-root pattern.

  it("Test 11: dispatch.service.ts uses makeOrgSettingsService() factory and NOT new OrgSettingsService()", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(MAKE_FACTORY_RE);
    expect(source).not.toMatch(NEW_LEGACY_CTOR_RE);
  });

  it("Test 12: find-accounts.ts uses makeOrgSettingsService() factory and NOT new OrgSettingsService()", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS, "utf8");
    expect(source).toMatch(MAKE_FACTORY_RE);
    expect(source).not.toMatch(NEW_LEGACY_CTOR_RE);
  });

  it("Test 13: legacy-org-settings.adapter.ts uses makeOrgSettingsService() factory and NOT new OrgSettingsService()", () => {
    const source = fs.readFileSync(PAYMENT_ADAPTER, "utf8");
    expect(source).toMatch(MAKE_FACTORY_RE);
    expect(source).not.toMatch(NEW_LEGACY_CTOR_RE);
  });

  // ── POSITIVE .toSnapshot() runtime path coverage granular per callsite ────
  // Tests 14-16 dispatch.service.ts split per method body (createAndPost +
  // update + post). §13.A4-α DTO divergence resolution mandatory per callsite.

  it("Test 14: dispatch.service.ts createAndPost method body contains `.toSnapshot()` adapter call", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    const start = source.indexOf("async createAndPost(");
    const end = source.indexOf("async update(", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toMatch(TO_SNAPSHOT_RE);
  });

  it("Test 15: dispatch.service.ts updatePostedDispatchTx PRIVATE method body contains `.toSnapshot()` adapter call (corrected atomic mid-cycle § A4-ι NO-formal)", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    const start = source.indexOf("private async updatePostedDispatchTx(");
    const end = source.indexOf("async delete(", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toMatch(TO_SNAPSHOT_RE);
  });

  it("Test 16: dispatch.service.ts post method body contains `.toSnapshot()` adapter call", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    const start = source.indexOf("async post(");
    const end = source.indexOf("async void(", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toMatch(TO_SNAPSHOT_RE);
  });

  // Tests 17-18 find-accounts.ts split per function body
  // (executeFindAccountsByPurpose + runHeuristic).

  it("Test 17: find-accounts.ts executeFindAccountsByPurpose body contains `.toSnapshot()` adapter call", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS, "utf8");
    const start = source.indexOf("export async function executeFindAccountsByPurpose(");
    const end = source.indexOf("async function runHeuristic(", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toMatch(TO_SNAPSHOT_RE);
  });

  it("Test 18: find-accounts.ts runHeuristic body contains `.toSnapshot()` adapter call", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS, "utf8");
    const start = source.indexOf("async function runHeuristic(");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start);
    expect(body).toMatch(TO_SNAPSHOT_RE);
  });

  // Test 19 adapter file-level (single callsite).

  it("Test 19: legacy-org-settings.adapter.ts source contains `.toSnapshot()` adapter call", () => {
    const source = fs.readFileSync(PAYMENT_ADAPTER, "utf8");
    expect(source).toMatch(TO_SNAPSHOT_RE);
  });

  // ── POSITIVE mock value shape (Tests 20-21) — toSnapshot key adapter ──────
  // §13.A4-α DTO divergence resolution test mock contract: mock returns
  // entity-like with .toSnapshot() method matching real hex factory shape.

  it("Test 20: dispatch.service.audit.test.ts mock value contains toSnapshot: key shape", () => {
    const source = fs.readFileSync(DISPATCH_AUDIT_TEST, "utf8");
    expect(source).toMatch(MOCK_TO_SNAPSHOT_KEY_RE);
  });

  it("Test 21: tools.find-accounts.test.ts mock value contains toSnapshot: key shape", () => {
    const source = fs.readFileSync(FIND_ACCOUNTS_TEST, "utf8");
    expect(source).toMatch(MOCK_TO_SNAPSHOT_KEY_RE);
  });
});
