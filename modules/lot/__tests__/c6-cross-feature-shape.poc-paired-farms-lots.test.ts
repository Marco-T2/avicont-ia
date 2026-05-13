/**
 * POC paired farms+lots C6 RED — cross-feature ports migration paired-lot side
 * (D5 CONSOLIDATE LotInquiryPort canonical home modules/lot/domain/ports/
 * lot-inquiry.port.ts rename from lot-existence.port.ts + D7 LotSnapshot
 * canonical EXPAND `{id, name, initialCount}` driver-anchored + mortality
 * re-export bridge backwards-compat + LocalLotInquiryAdapter canonical NEW +
 * AI-agent + pricing cross-feature consumers cutover legacy → hex DI).
 *
 * Axis: cross-feature SERVICE method consumers (LotsService.* → LotInquiryPort
 * DI) via D5 CONSOLIDATE canonical home pattern paired sister contacts EXACT
 * mirror precedent. CR2 NEW recon emergente detectó modules/lot/domain/ports/
 * lot-existence.port.ts YA EXISTE signature IDÉNTICA mortality LotInquiryPort
 * → consolidate canonical home discipline DRY preserved cross-POC + zero
 * callsite churn mortality consumers via re-export bridge backwards-compat.
 *
 * Marco lock D5 CONSOLIDATE/UNIFY canonical home paired sister contacts EXACT
 * mirror (rename modules/lot/domain/ports/lot-existence.port.ts → lot-inquiry.port.ts
 * canonical home + mortality re-export bridge backwards-compat preserve consumer
 * churn zero). D1 DEFER compound query findFarmsWithActiveLots cleanup pending
 * engram heredado 9no preserve. D3 SPLIT RED-α + GREEN paired sister C0-C5
 * EXACT precedent. D4 FarmInquiryPort signature mínimo driver-anchored (paired
 * sister LotInquiryPort minimal canonical pattern preserved). D6 path convention
 * top-level `modules/{farm,lot}/__tests__/` Marco bookmark literal mention +
 * matches C0/C1 multi-layer precedent. D7 LotSnapshot canonical EXPAND
 * `{id, name, initialCount}` driver-anchored (CR8 NEW invariant-collision
 * pricing.service.ts:42 requires lot.name access post-cutover — mortality
 * compat preserved additive backwards-compat). D8 AI-agent + pricing test
 * mocks adapt MISMO BATCH GREEN atomic (CR9 NEW test mocks cascade scope).
 *
 * §13.NEW emergentes 2 target D8 paired-POC closure cementación:
 *   1. §13/port-name-canonical-collision-mortality-vs-lot-axis-distinct 1ra
 *      evidencia matures — PROMOTE canonical home discipline DRY a domain del
 *      provider (modules/lot), consumer module re-export bridge backwards-compat.
 *   2. §13/port-direction-provider-vs-consumer-axis-distinct 1ra evidencia
 *      matures — canonical home rule: lives in PROVIDER cuando shape canonical
 *      es del provider domain (C6 PUSH). Marco lock L5 reframe MOVE→CONSOLIDATE
 *      via evidence-supersedes-assumption-lock 21ma matures cumulative.
 *
 * Invariant-collision-elevation cumulative cross-POC matures:
 *   - 7ma evidencia CR8 NEW D7 LotSnapshot expand `{id, name, initialCount}`
 *     additive backwards-compat preserved (mortality consumer compat intact +
 *     pricing.lotName satisfied + chat.ts listLots LLM richer).
 *   - 8va evidencia CR9 NEW D8 test mocks cascade scope expand mismo batch GREEN.
 *
 * 6 archivos cutover INCLUIDOS paired-lot side Marco lock D3 split RED-α
 * existence-only + GREEN atomic single batch paired sister C0/C1/C2/C3/C4/C5
 * EXACT precedent:
 *   1. modules/lot/domain/ports/lot-inquiry.port.ts (CANONICAL HOME rename
 *      from lot-existence.port.ts + D7 LotSnapshot expand `{id, name, initialCount}`
 *      + D4 signature list+findById Q5A)
 *   2. modules/lot/infrastructure/local-lot-inquiry.adapter.ts (NEW canonical
 *      adapter wrapping makeLotService)
 *   3. modules/mortality/domain/lot-inquiry.port.ts (re-export bridge backwards-compat
 *      `export { LotInquiryPort, LotSnapshot } from "@/modules/lot/domain/ports/lot-inquiry.port"`)
 *   4. modules/mortality/infrastructure/prisma-lot-inquiry.adapter.ts (REFACTOR
 *      menor rewire wrap modules/lot/presentation/server EXACT)
 *   5. features/ai-agent/agent.service.ts + chat.ts (cutover legacy `new LotsService()`
 *      → LotInquiryPort DI)
 *   6. features/pricing/pricing.service.ts (cutover legacy `new LotsService()`
 *      → LotInquiryPort DI + D7 lot.name access preserved)
 *
 * Marco lock final RED scope C6 paired-lot side (13 assertions α — paired
 * sister mirror farm 13 assertions = 26 paired total Marco aprobado pre-RED-α
 * paired sister C5 13/13 per side EXACT precedent):
 *
 *   ── A: LotInquiryPort canonical home consolidate (Tests α14-α17) ──
 *     α14 modules/lot/domain/ports/lot-inquiry.port.ts FILE EXISTS (D5 canonical
 *         home rename from lot-existence.port.ts — paired sister contacts EXACT
 *         mirror precedent)
 *     α15 modules/lot/domain/ports/lot-existence.port.ts FILE DOES NOT EXIST
 *         (renamed away to lot-inquiry.port.ts canonical home — D5 consolidate
 *         discipline DRY no duplicación signature idéntica)
 *     α16 lot-inquiry.port.ts exports `interface LotInquiryPort` with `list(`
 *         and `findById(` methods (D4 Q5A list(filters) único + findById paired
 *         sister minimal canonical pattern preserved)
 *     α17 lot-inquiry.port.ts exports `type LotSnapshot` with id+name+initialCount
 *         fields (D7 expand driver-anchored consumer evidence concreta pricing.lotName
 *         line 42 + mortality compat preserved additive backwards-compat)
 *
 *   ── B: LocalLotInquiryAdapter infrastructure NEW (Tests α18-α19) ──
 *     α18 modules/lot/infrastructure/local-lot-inquiry.adapter.ts FILE EXISTS
 *         (NEW canonical adapter greenfield C6 atomic single batch GREEN target
 *         — wrap makeLotService precedent paired sister LocalContactsExistenceAdapter
 *         EXACT mirror)
 *     α19 local-lot-inquiry.adapter.ts declares `class LocalLotInquiryAdapter`
 *         (paired sister LocalContactsExistenceAdapter precedent EXACT mirror
 *         — D5 consolidate canonical pattern adapter implements LotInquiryPort)
 *
 *   ── C: Mortality re-export bridge + adapter rewire (Tests α20-α21) ──
 *     α20 modules/mortality/domain/lot-inquiry.port.ts re-exports from
 *         `@/modules/lot/domain/ports/lot-inquiry.port` (D5 bridge backwards-compat
 *         preserve mortality consumers callsite churn zero — cleanup pending
 *         engram NEW 14mo cumulative cross-POC DEFER absoluto post-mortality
 *         next migration)
 *     α21 modules/mortality/infrastructure/prisma-lot-inquiry.adapter.ts does
 *         NOT contain `new LotsService(` literal (D5 REFACTOR menor rewire
 *         wrap modules/lot/presentation/server EXACT — ADDITIVE strategy preserve
 *         features/lots/* intactos hasta C7)
 *
 *   ── D: Presentation hex wiring (Tests α22-α23) ──
 *     α22 composition-root.ts exports `LocalLotInquiryAdapter` (barrel chain
 *         wiring infrastructure → presentation paired sister precedent EXACT)
 *     α23 server.ts re-exports `LotInquiryPort` and `LotSnapshot` types
 *         (paired sister `server.ts` mirror precedent — public API surface
 *         consumer features import single source `@/modules/lot/presentation/server`)
 *
 *   ── E: AI-agent cross-feature cutover (Tests α24-α25) ──
 *     α24 features/ai-agent/agent.service.ts does NOT import `LotsService`
 *         from `@/features/lots/server` (legacy class dropped post-cutover,
 *         ADDITIVE strategy preserva features/lots/* intactos hasta C7)
 *     α25 features/ai-agent/modes/chat.ts imports `LotInquiryPort` from
 *         `@/modules/lot/presentation/server` (consumer ChatModeDeps type
 *         migration LotsService → LotInquiryPort)
 *
 *   ── F: Pricing cross-feature cutover (Test α26) ──
 *     α26 features/pricing/pricing.service.ts does NOT import `LotsService`
 *         from `@/features/lots/server` (D7 cutover legacy `new LotsService()`
 *         → LotInquiryPort DI + lot.name access preserved via expand canonical)
 *
 * Expected RED failure mode pre-GREEN per `feedback_red_acceptance_failure_mode`:
 *   - α14 FAIL ENOENT — archivo `modules/lot/domain/ports/lot-inquiry.port.ts`
 *     NO existe pre-GREEN (D5 rename target greenfield, hoy archivo es
 *     lot-existence.port.ts pre-cutover)
 *   - α15 FAIL behavioral assertion mismatch — modules/lot/domain/ports/lot-existence.port.ts
 *     YA EXISTE pre-GREEN (D5 rename pendiente — paired sister contacts EXACT mirror)
 *   - α16 FAIL ENOENT cascade (file lot-inquiry.port.ts no existe pre-GREEN)
 *   - α17 FAIL ENOENT cascade
 *   - α18 FAIL ENOENT — archivo `modules/lot/infrastructure/local-lot-inquiry.adapter.ts`
 *     NO existe pre-GREEN (greenfield NEW canonical adapter C6 target)
 *   - α19 FAIL ENOENT cascade
 *   - α20 FAIL behavioral assertion mismatch — mortality/domain/lot-inquiry.port.ts
 *     hoy define LotInquiryPort + LotSnapshot canonical PULL pattern (NO
 *     re-export bridge — D5 consolidate target)
 *   - α21 FAIL behavioral assertion mismatch — mortality/infrastructure/prisma-lot-inquiry.adapter.ts
 *     línea 7 contiene `new LotsService()` legacy DI default. `not.toMatch`
 *     reverses (PRESENT pre-cutover).
 *   - α22 FAIL behavioral assertion mismatch — composition-root.ts hoy NO
 *     exporta LocalLotInquiryAdapter (solo makeLotService + makeLotRepository +
 *     PrismaLotRepository post-C2 cementado)
 *   - α23 FAIL behavioral assertion mismatch — server.ts hoy NO re-exporta
 *     LotInquiryPort (solo Lot + LotSnapshot + LotStatus + LotSummary + etc
 *     post-C5 cementado — LotInquiryPort no está canonical home aún)
 *   - α24 FAIL behavioral assertion mismatch — agent.service.ts hoy importa
 *     `import { LotsService } from "@/features/lots/server"` línea 4 legacy
 *     class. `not.toMatch` reverses (PRESENT pre-cutover).
 *   - α25 FAIL behavioral assertion mismatch — chat.ts hoy importa
 *     `import type { LotsService } from "@/features/lots/server"` línea 15
 *     legacy class type. Regex hex `LotInquiryPort` import match falla.
 *   - α26 FAIL behavioral assertion mismatch — pricing.service.ts hoy importa
 *     `import { LotsService } from "@/features/lots/server"` línea 2 legacy.
 *     `not.toMatch` reverses (PRESENT pre-cutover).
 * Total expected FAIL pre-GREEN: 13/13 lot side (paired sister 13/13 farm =
 * 26/26 total cumulative cross-POC `feedback_enumerated_baseline_failure_ledger`
 * 18ma matures cumulative cross-POC recursive aplicación forward).
 *
 * Self-contained future-proof check: shape test asserta paths
 * `modules/{lot,mortality}/{domain,infrastructure,presentation}/...` +
 * `features/{ai-agent,pricing}/...` que persisten post C7 wholesale delete
 * `features/lots/`. Test vive en top-level `modules/lot/__tests__/` mirror
 * C0/C1 precedent EXACT — NO toca `features/lots/*` que C7 borrará.
 * Self-contained vs future deletes ✓.
 *
 * Cross-ref:
 *   - engram `poc-paired-farms-lots/c5/closed` #1846 (cycle-start bookmark
 *     C6 heredado — D1-D7 + 2 Opción A locks aplicados cumulative C5 closure)
 *   - engram `poc-paired-farms-lots/c6/d5-strategy-locked` (7 locks final
 *     pre-RED-α D5+D1+D3+D4+D6+D7+D8 cumulative this cycle)
 *   - engram `feedback/evidence-supersedes-assumption-lock` (21ma matures
 *     cumulative cross-POC — Marco lock L5 MOVE plan superseded por CR2 NEW
 *     emergente CONSOLIDATE)
 *   - engram `feedback_invariant_collision_elevation` (7ma+8va matures cumulative
 *     cross-POC — CR8 LotSnapshot D7 expand + CR9 test mocks D8 scope expand)
 *   - engram `feedback/mortality-lot-inquiry-port-re-export-bridge-cleanup-pending`
 *     (14mo cumulative cross-POC — D5 bridge DEFER absoluto post-mortality
 *     next migration)
 *   - engram `arch/§13/port-name-canonical-collision-mortality-vs-lot-axis-distinct`
 *     (1ra evidencia matures POC paired farms+lots C6 §13 NEW emergente
 *     canonical home discipline DRY paired sister contacts EXACT mirror)
 *   - engram `arch/§13/port-direction-provider-vs-consumer-axis-distinct`
 *     (1ra evidencia matures POC paired farms+lots C6 §13 NEW emergente
 *     canonical home rule provider-driven shape)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 13/13
 *     enumerated behavioral assertion mismatch + ENOENT cascade paired-lot side)
 *   - engram `feedback_red_regex_discipline` (^import...m anchor + optional
 *     props convention preserved 18ma matures cumulative cross-POC)
 *   - engram `feedback_enumerated_baseline_failure_ledger` (18ma matures
 *     cumulative cross-POC per-α explicit ledger)
 *   - modules/contacts/domain/ports/contact-existence.port.ts (paired sister
 *     contacts EXACT mirror precedent canonical home discipline)
 *   - modules/mortality/domain/lot-inquiry.port.ts (existing PULL pattern
 *     pre-C6 — D5 consolidate target → re-export bridge backwards-compat)
 *   - modules/mortality/infrastructure/prisma-lot-inquiry.adapter.ts (target
 *     REFACTOR menor rewire wrap modules/lot/presentation/server)
 *   - modules/lot/domain/ports/lot-inquiry.port.ts (target D5 canonical home
 *     rename + D7 LotSnapshot expand)
 *   - modules/lot/infrastructure/local-lot-inquiry.adapter.ts (target NEW
 *     canonical adapter)
 *   - features/ai-agent/agent.service.ts + modes/chat.ts (target cutover
 *     legacy → LotInquiryPort DI)
 *   - features/pricing/pricing.service.ts (target cutover legacy → LotInquiryPort
 *     DI + lot.name access preserved D7)
 */
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LOT_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(__dirname, "../../..");

function readLotFile(rel: string): string {
  return readFileSync(resolve(LOT_ROOT, rel), "utf-8");
}

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// ── C6 cross-feature ports cutover targets (6 archivos paired-lot side) ──

const LOT_INQUIRY_PORT = resolve(
  LOT_ROOT,
  "domain/ports/lot-inquiry.port.ts",
);
const LOT_EXISTENCE_PORT_OLD = resolve(
  LOT_ROOT,
  "domain/ports/lot-existence.port.ts",
);
const LOCAL_LOT_INQUIRY_ADAPTER = resolve(
  LOT_ROOT,
  "infrastructure/local-lot-inquiry.adapter.ts",
);

// ── Regex patterns (positive ^import...m anchor + negative legacy not.toMatch) ──

const EXPORT_INTERFACE_LOT_INQUIRY_PORT_RE =
  /^export\s+interface\s+LotInquiryPort\b/m;
const EXPORT_TYPE_LOT_SNAPSHOT_RE =
  /^export\s+type\s+LotSnapshot\b/m;
const LOT_SNAPSHOT_ID_FIELD_RE = /\bid\s*:\s*string\b/;
const LOT_SNAPSHOT_NAME_FIELD_RE = /\bname\s*:\s*string\b/;
const LOT_SNAPSHOT_INITIAL_COUNT_FIELD_RE = /\binitialCount\s*:\s*number\b/;
const LOT_INQUIRY_PORT_LIST_METHOD_RE = /\blist\s*\(/;
const LOT_INQUIRY_PORT_FIND_BY_ID_METHOD_RE = /\bfindById\s*\(/;
const EXPORT_CLASS_LOCAL_LOT_INQUIRY_ADAPTER_RE =
  /^export\s+class\s+LocalLotInquiryAdapter\b/m;
const MORTALITY_BRIDGE_REEXPORT_RE =
  /^export\s*(?:type\s*)?\{[^}]*\bLotInquiryPort\b[^}]*\}\s*from\s*["']@\/modules\/lot\/domain\/ports\/lot-inquiry\.port["']/m;
const NEW_LOTS_SERVICE_CTOR_RE = /new\s+LotsService\s*\(/;
const COMP_ROOT_REEXPORT_LOCAL_LOT_INQUIRY_ADAPTER_RE =
  /\bLocalLotInquiryAdapter\b/;
const SERVER_REEXPORT_LOT_INQUIRY_PORT_RE =
  /\bLotInquiryPort\b/;
const SERVER_REEXPORT_LOT_SNAPSHOT_RE =
  /\bLotSnapshot\b/;
const LEGACY_LOTS_SERVICE_IMPORT_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bLotsService\b[^}]*\}\s*from\s*["']@\/features\/lots\/server["']/m;
const IMPORT_LOT_INQUIRY_PORT_HEX_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bLotInquiryPort\b[^}]*\}\s*from\s*["']@\/modules\/lot\/presentation\/server["']/m;

describe("POC paired farms+lots C6 — cross-feature ports migration paired-lot side (D5 CONSOLIDATE LotInquiryPort canonical home rename from lot-existence.port.ts + D7 LotSnapshot expand `{id, name, initialCount}` driver-anchored + mortality re-export bridge backwards-compat + LocalLotInquiryAdapter NEW + AI-agent + pricing cross-feature consumers cutover legacy → hex DI shape, Marco locks D5 CONSOLIDATE paired sister contacts EXACT + D1 DEFER compound query cleanup pending + D3 SPLIT RED-α/GREEN paired sister C0-C5 EXACT + D4 mínimo driver-anchored + D6 path convention top-level + D7 LotSnapshot expand CR8 + D8 test mocks adapt mismo batch GREEN atomic CR9)", () => {
  // ── A: LotInquiryPort canonical home consolidate (α14-α17) ─────────────────

  it("α14: modules/lot/domain/ports/lot-inquiry.port.ts FILE EXISTS (D5 canonical home rename from lot-existence.port.ts — paired sister contacts canonical home pattern EXACT mirror precedent + DRY discipline + zero callsite churn mortality consumers via re-export bridge)", () => {
    expect(existsSync(LOT_INQUIRY_PORT)).toBe(true);
  });

  it("α15: modules/lot/domain/ports/lot-existence.port.ts FILE DOES NOT EXIST (D5 rename target away — consolidate discipline DRY no duplicación signature idéntica preserved cross-POC paired sister contacts EXACT mirror)", () => {
    expect(existsSync(LOT_EXISTENCE_PORT_OLD)).toBe(false);
  });

  it("α16: lot-inquiry.port.ts exports `interface LotInquiryPort` with `list(` and `findById(` methods (D4 Q5A list(filters) único Marco lock heredado preserved + findById paired sister minimal canonical pattern + driver-anchored consumer evidence concreta chat.ts listLots + mortality findById)", () => {
    const src = readLotFile("domain/ports/lot-inquiry.port.ts");
    expect(src).toMatch(EXPORT_INTERFACE_LOT_INQUIRY_PORT_RE);
    expect(src).toMatch(LOT_INQUIRY_PORT_LIST_METHOD_RE);
    expect(src).toMatch(LOT_INQUIRY_PORT_FIND_BY_ID_METHOD_RE);
  });

  it("α17: lot-inquiry.port.ts exports `type LotSnapshot` with id+name+initialCount fields (D7 expand driver-anchored consumer evidence concreta pricing.lotName line 42 + mortality compat preserved additive backwards-compat + chat.ts listLots LLM richer better)", () => {
    const src = readLotFile("domain/ports/lot-inquiry.port.ts");
    expect(src).toMatch(EXPORT_TYPE_LOT_SNAPSHOT_RE);
    expect(src).toMatch(LOT_SNAPSHOT_ID_FIELD_RE);
    expect(src).toMatch(LOT_SNAPSHOT_NAME_FIELD_RE);
    expect(src).toMatch(LOT_SNAPSHOT_INITIAL_COUNT_FIELD_RE);
  });

  // ── B: LocalLotInquiryAdapter infrastructure NEW (α18-α19) ─────────────────

  it("α18: modules/lot/infrastructure/local-lot-inquiry.adapter.ts FILE EXISTS (NEW canonical adapter greenfield C6 atomic single batch GREEN target — wrap makeLotService precedent paired sister LocalContactsExistenceAdapter EXACT mirror)", () => {
    expect(existsSync(LOCAL_LOT_INQUIRY_ADAPTER)).toBe(true);
  });

  it("α19: local-lot-inquiry.adapter.ts declares `class LocalLotInquiryAdapter` (paired sister LocalContactsExistenceAdapter precedent EXACT mirror — D5 consolidate canonical pattern adapter implements LotInquiryPort)", () => {
    const src = readLotFile("infrastructure/local-lot-inquiry.adapter.ts");
    expect(src).toMatch(EXPORT_CLASS_LOCAL_LOT_INQUIRY_ADAPTER_RE);
  });

  // ── C: Mortality re-export bridge + adapter rewire (α20-α21) ───────────────

  it("α20: modules/mortality/domain/lot-inquiry.port.ts re-exports from `@/modules/lot/domain/ports/lot-inquiry.port` (D5 bridge backwards-compat preserve mortality consumers callsite churn zero — cleanup pending engram NEW 14mo cumulative cross-POC DEFER absoluto post-mortality next migration)", () => {
    const src = readRepoFile("modules/mortality/domain/lot-inquiry.port.ts");
    expect(src).toMatch(MORTALITY_BRIDGE_REEXPORT_RE);
  });

  it("α21: modules/mortality/infrastructure/prisma-lot-inquiry.adapter.ts does NOT contain `new LotsService(` literal (D5 REFACTOR menor rewire wrap modules/lot/presentation/server EXACT — ADDITIVE strategy preserve features/lots/* intactos hasta C7 wholesale delete)", () => {
    const src = readRepoFile("modules/mortality/infrastructure/prisma-lot-inquiry.adapter.ts");
    expect(src).not.toMatch(NEW_LOTS_SERVICE_CTOR_RE);
  });

  // ── D: Presentation hex wiring (α22-α23) ───────────────────────────────────

  it("α22: composition-root.ts exports `LocalLotInquiryAdapter` (barrel chain wiring infrastructure → presentation paired sister precedent EXACT mirror — public API surface adapter factory)", () => {
    const src = readLotFile("presentation/composition-root.ts");
    expect(src).toMatch(COMP_ROOT_REEXPORT_LOCAL_LOT_INQUIRY_ADAPTER_RE);
  });

  it("α23: server.ts re-exports `LotInquiryPort` and `LotSnapshot` types (paired sister `server.ts` mirror precedent — public API surface consumer features import single source `@/modules/lot/presentation/server`)", () => {
    const src = readLotFile("presentation/server.ts");
    expect(src).toMatch(SERVER_REEXPORT_LOT_INQUIRY_PORT_RE);
    expect(src).toMatch(SERVER_REEXPORT_LOT_SNAPSHOT_RE);
  });

  // ── E: AI-agent cross-feature cutover (α24-α25) ────────────────────────────

  it("α24: modules/ai-agent/application/agent.service.ts does NOT import `LotsService` from `@/features/lots/server` (legacy class dropped post-cutover, ADDITIVE strategy preserva features/lots/* intactos hasta C7 wholesale delete per Marco lock heredado D1 Opt C C4 precedent EXACT; path migrated from features/ to modules/ at poc-ai-agent-hex C5)", () => {
    const src = readRepoFile("modules/ai-agent/application/agent.service.ts");
    expect(src).not.toMatch(LEGACY_LOTS_SERVICE_IMPORT_RE);
  });

  it("α25: modules/ai-agent/application/modes/chat.ts imports `LotInquiryPort` from `@/modules/lot/presentation/server` (consumer ChatModeDeps type migration LotsService → LotInquiryPort paired sister cross-feature consumer migration inline mismo batch D8; path migrated from features/ to modules/ at poc-ai-agent-hex C5)", () => {
    const src = readRepoFile("modules/ai-agent/application/modes/chat.ts");
    expect(src).toMatch(IMPORT_LOT_INQUIRY_PORT_HEX_RE);
  });

  // ── F: Pricing cross-feature cutover (α26) ─────────────────────────────────

  it("α26: modules/ai-agent/application/pricing/pricing.service.ts does NOT import `LotsService` from `@/features/lots/server` (D7 cutover legacy `new LotsService()` → LotInquiryPort DI + lot.name access preserved via expand canonical `{id, name, initialCount}` driver-anchored; path migrated from features/ to modules/ at poc-ai-agent-hex C5)", () => {
    const src = readRepoFile("modules/ai-agent/application/pricing/pricing.service.ts");
    expect(src).not.toMatch(LEGACY_LOTS_SERVICE_IMPORT_RE);
  });
});
