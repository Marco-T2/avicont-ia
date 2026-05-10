/**
 * POC paired farms+lots C6 RED — cross-feature ports migration paired-farm side
 * (NEW FarmInquiryPort + LocalFarmInquiryAdapter + presentation hex wiring +
 * AI-agent cross-feature consumers cutover legacy → hex DI).
 *
 * Axis: cross-feature SERVICE method consumers (FarmsService.* → FarmInquiryPort
 * DI) via NEW canonical port modules/farm/domain/ports/farm-inquiry.port.ts +
 * NEW LocalFarmInquiryAdapter wrapping makeFarmService. Paired sister lot side
 * mirror (D5 CONSOLIDATE LotInquiryPort canonical home modules/lot/domain/ports/
 * lot-inquiry.port.ts rename from lot-existence.port.ts + mortality re-export
 * bridge backwards-compat).
 *
 * Marco lock D5 CONSOLIDATE/UNIFY canonical home paired sister contacts EXACT
 * mirror precedent (CR2 NEW recon emergente lot-existence.port.ts YA EXISTE
 * signature IDÉNTICA → consolidate canonical home discipline DRY preserved
 * cross-POC + zero callsite churn mortality consumers via re-export bridge).
 * D1 DEFER compound query findFarmsWithActiveLots cleanup pending engram
 * heredado 9no preserve (AgentContextRepository repository layer NO service
 * consumer axis-distinct C6 scope estricto). D3 SPLIT RED-α + GREEN paired
 * sister C0-C5 EXACT precedent cumulative 6 ciclos consistentes. D4 FarmInquiryPort
 * signature mínimo driver-anchored `list(orgId, filters?: { memberId?: string })`
 * + `findById(orgId, farmId)` + FarmSnapshot {id, name, memberId, location}
 * EXACT mirror Farm entity. D6 path convention top-level `modules/{farm,lot}
 * /__tests__/` Marco bookmark literal mention + matches C0/C1 multi-layer
 * precedent (C6 cross-cutting layers domain+infrastructure+presentation+features
 * scope NO encaja presentation-exclusive). D7 LotSnapshot canonical EXPAND
 * `{id, name, initialCount}` driver-anchored (CR8 NEW invariant-collision
 * pricing.service.ts:42 requires lot.name access post-cutover — mortality
 * compat preserved additive backwards-compat + chat.ts listLots LLM richer).
 * D8 AI-agent + pricing test mocks adapt MISMO BATCH GREEN atomic — expand
 * scope 3 test files EDIT (CR9 NEW test mocks cascade scope decision pre-RED).
 *
 * §13.NEW emergentes 2 target D8 paired-POC closure cementación:
 *   1. §13/port-name-canonical-collision-mortality-vs-lot-axis-distinct 1ra
 *      evidencia matures cumulative cross-POC — cuando dos modules tienen
 *      puertos signature IDÉNTICA, PROMOTE canonical home discipline DRY a
 *      domain del provider (modules/lot), consumer module re-export bridge
 *      backwards-compat paired sister contacts EXACT mirror.
 *   2. §13/port-direction-provider-vs-consumer-axis-distinct 1ra evidencia
 *      matures — canonical home rule: lives in CONSUMER cuando consumer drives
 *      interface (mortality C0 PULL); lives in PROVIDER cuando shape canonical
 *      es del provider domain (C6 PUSH farm/lot expose capability). Marco lock
 *      L5 reframe MOVE→CONSOLIDATE via evidence-supersedes-assumption-lock 21ma.
 *
 * Invariant-collision-elevation cumulative cross-POC matures:
 *   - 7ma evidencia CR8 NEW — LotSnapshot canonical shape mortality `{id, initialCount}`
 *     superseded por driver-anchored consumer evidence concreta pricing.lotName
 *     line 42 + chat.ts listLots LLM richer. D7 expand `{id, name, initialCount}`
 *     additive backwards-compat preserved (mortality consumer compat intact).
 *   - 8va evidencia CR9 NEW — AI-agent 3 test files vi.mock FarmsService/LotsService
 *     legacy cascade post-cutover. D8 adapt mismo batch GREEN atomic scope expand.
 *
 * 6 archivos cutover INCLUIDOS paired-farm side Marco lock D3 split RED-α
 * existence-only + GREEN atomic single batch paired sister C0/C1/C2/C3/C4/C5
 * EXACT precedent:
 *   1. modules/farm/domain/ports/farm-inquiry.port.ts (NEW canonical FarmInquiryPort
 *      + FarmSnapshot D4 signature mínimo driver-anchored)
 *   2. modules/farm/infrastructure/local-farm-inquiry.adapter.ts (NEW canonical
 *      adapter wrapping makeFarmService)
 *   3. modules/farm/presentation/composition-root.ts (EDIT re-export
 *      LocalFarmInquiryAdapter factory)
 *   4. modules/farm/presentation/server.ts (EDIT re-export FarmInquiryPort +
 *      FarmSnapshot types)
 *   5. features/ai-agent/agent.service.ts (cutover legacy `new FarmsService()`
 *      → FarmInquiryPort DI via LocalFarmInquiryAdapter)
 *   6. features/ai-agent/modes/chat.ts (consumer types ChatModeDeps FarmInquiryPort
 *      + service consumer paths cutover)
 *
 * Marco lock final RED scope C6 paired-farm side (13 assertions α — paired
 * sister mirror lot 13 assertions = 26 paired total Marco aprobado pre-RED-α
 * paired sister C5 13/13 per side EXACT precedent):
 *
 *   ── A: FarmInquiryPort domain shape NEW (Tests α1-α4) ──
 *     α1 modules/farm/domain/ports/farm-inquiry.port.ts FILE EXISTS (NEW canonical
 *        port — greenfield greenfield C6 atomic single batch GREEN target)
 *     α2 farm-inquiry.port.ts exports `interface FarmInquiryPort` (D4 signature
 *        canonical paired sister LotInquiryPort minimal precedent EXACT mirror)
 *     α3 farm-inquiry.port.ts exports `type FarmSnapshot` with id+name+memberId+location
 *        string fields (D4 driver-anchored Farm entity shape EXACT mirror)
 *     α4 FarmInquiryPort signature includes `list(` and `findById(` methods
 *        (D4 Q5A list(filters) único + findById paired sister LotInquiryPort
 *        minimal precedent EXACT mirror)
 *
 *   ── B: LocalFarmInquiryAdapter infrastructure NEW (Tests α5-α6) ──
 *     α5 modules/farm/infrastructure/local-farm-inquiry.adapter.ts FILE EXISTS
 *        (NEW canonical adapter — greenfield C6 atomic single batch GREEN target)
 *     α6 local-farm-inquiry.adapter.ts declares `class LocalFarmInquiryAdapter`
 *        (paired sister LocalContactsExistenceAdapter precedent EXACT mirror)
 *
 *   ── C: Presentation hex wiring (Tests α7-α8) ──
 *     α7 composition-root.ts exports `LocalFarmInquiryAdapter` (barrel chain
 *        wiring infrastructure → presentation paired sister payables precedent)
 *     α8 server.ts re-exports `FarmInquiryPort` and `FarmSnapshot` types from
 *        composition-root (public API surface consumer features import single
 *        source `@/modules/farm/presentation/server`)
 *
 *   ── D: AI-agent agent.service.ts cutover (Tests α9-α11) ──
 *     α9 features/ai-agent/agent.service.ts imports `FarmInquiryPort` from
 *        `@/modules/farm/presentation/server` (cutover legacy class ctor
 *        `new FarmsService()` → FarmInquiryPort DI Path α direct mecánico)
 *     α10 features/ai-agent/agent.service.ts does NOT import `FarmsService`
 *         from `@/features/farms/server` (legacy class dropped post-cutover,
 *         ADDITIVE strategy preserva features/farms/* intactos hasta C7
 *         wholesale delete per Marco lock heredado D1 Opt C C4 precedent)
 *     α11 features/ai-agent/agent.service.ts does NOT contain `new FarmsService(`
 *         ctor literal (legacy class ctor instantiation dropped post-cutover)
 *
 *   ── E: AI-agent chat.ts consumer type cutover (Tests α12-α13) ──
 *     α12 features/ai-agent/modes/chat.ts imports `FarmInquiryPort` from
 *         `@/modules/farm/presentation/server` (consumer ChatModeDeps type
 *         migration FarmsService → FarmInquiryPort)
 *     α13 features/ai-agent/modes/chat.ts does NOT import `FarmsService` from
 *         `@/features/farms/server` (legacy type dropped post-cutover)
 *
 * Expected RED failure mode pre-GREEN per `feedback_red_acceptance_failure_mode`:
 *   - α1 FAIL ENOENT — archivo `modules/farm/domain/ports/farm-inquiry.port.ts`
 *     NO existe pre-GREEN (greenfield NEW canonical port C6 target)
 *   - α2-α4 FAIL ENOENT cascade (file read throws — file does not exist pre-GREEN)
 *   - α5 FAIL ENOENT — archivo `modules/farm/infrastructure/local-farm-inquiry.adapter.ts`
 *     NO existe pre-GREEN (greenfield NEW canonical adapter C6 target)
 *   - α6 FAIL ENOENT cascade
 *   - α7 FAIL behavioral assertion mismatch — composition-root.ts hoy NO exporta
 *     LocalFarmInquiryAdapter (solo makeFarmService + makeFarmRepository +
 *     PrismaFarmRepository + attachLots post-C5 cementado)
 *   - α8 FAIL behavioral assertion mismatch — server.ts hoy NO re-exporta
 *     FarmInquiryPort (solo Farm + FarmSnapshot + MemberInquiryPort + FarmService +
 *     etc post-C5 cementado)
 *   - α9 FAIL behavioral assertion mismatch — agent.service.ts hoy importa
 *     `import { FarmsService } from "@/features/farms/server"` línea 3 legacy
 *     class. Regex hex `FarmInquiryPort` import match falla.
 *   - α10 FAIL behavioral assertion mismatch — agent.service.ts hoy importa
 *     legacy `@/features/farms/server` línea 3. `not.toMatch` reverses (PRESENT
 *     pre-cutover).
 *   - α11 FAIL behavioral assertion mismatch — agent.service.ts hoy contiene
 *     `new FarmsService()` línea 33. `not.toMatch` ctor pattern reverses.
 *   - α12 FAIL behavioral assertion mismatch — chat.ts hoy importa
 *     `import type { FarmsService } from "@/features/farms/server"` línea 14
 *     legacy class type. Regex hex `FarmInquiryPort` import match falla.
 *   - α13 FAIL behavioral assertion mismatch — chat.ts hoy importa legacy
 *     `@/features/farms/server` línea 14. `not.toMatch` reverses (PRESENT).
 * Total expected FAIL pre-GREEN: 13/13 farm side (paired sister 13/13 lot =
 * 26/26 total cumulative cross-POC `feedback_enumerated_baseline_failure_ledger`
 * 18ma matures cumulative cross-POC recursive aplicación forward).
 *
 * Self-contained future-proof check: shape test asserta paths
 * `modules/farm/{domain,infrastructure,presentation}/...` + `features/ai-agent/...`
 * que persisten post C7 wholesale delete `features/farms/`. Test vive en
 * top-level `modules/farm/__tests__/` mirror C0/C1 precedent EXACT — NO toca
 * `features/farms/*` que C7 borrará. Self-contained vs future deletes ✓.
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
 *   - engram `arch/§13/port-name-canonical-collision-mortality-vs-lot-axis-distinct`
 *     (1ra evidencia matures POC paired farms+lots C6 §13 NEW emergente
 *     canonical home discipline DRY paired sister contacts EXACT mirror)
 *   - engram `arch/§13/port-direction-provider-vs-consumer-axis-distinct`
 *     (1ra evidencia matures POC paired farms+lots C6 §13 NEW emergente
 *     canonical home rule provider-driven shape)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 13/13
 *     enumerated behavioral assertion mismatch + ENOENT cascade paired-farm side)
 *   - engram `feedback_red_regex_discipline` (^import...m anchor + optional
 *     props convention preserved 18ma matures cumulative cross-POC)
 *   - engram `feedback_enumerated_baseline_failure_ledger` (18ma matures
 *     cumulative cross-POC per-α explicit ledger)
 *   - modules/payables/domain/ports/contact-existence.port.ts (paired sister
 *     contacts EXACT mirror precedent canonical home discipline)
 *   - modules/mortality/domain/lot-inquiry.port.ts (existing PULL pattern
 *     pre-C6 — D5 consolidate target → re-export bridge backwards-compat)
 *   - modules/farm/domain/ports/farm-inquiry.port.ts (target NEW canonical
 *     FarmInquiryPort + FarmSnapshot D4 signature)
 *   - modules/farm/infrastructure/local-farm-inquiry.adapter.ts (target NEW
 *     canonical adapter)
 *   - features/ai-agent/agent.service.ts (target cutover legacy → FarmInquiryPort DI)
 *   - features/ai-agent/modes/chat.ts (target consumer types ChatModeDeps cutover)
 */
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FARM_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(__dirname, "../../..");

function readFarmFile(rel: string): string {
  return readFileSync(resolve(FARM_ROOT, rel), "utf-8");
}

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// ── C6 cross-feature ports cutover targets (6 archivos paired-farm side) ──

const FARM_INQUIRY_PORT = resolve(
  FARM_ROOT,
  "domain/ports/farm-inquiry.port.ts",
);
const LOCAL_FARM_INQUIRY_ADAPTER = resolve(
  FARM_ROOT,
  "infrastructure/local-farm-inquiry.adapter.ts",
);

// ── Regex patterns (positive ^import...m anchor + negative legacy not.toMatch) ──

const EXPORT_INTERFACE_FARM_INQUIRY_PORT_RE =
  /^export\s+interface\s+FarmInquiryPort\b/m;
const EXPORT_TYPE_FARM_SNAPSHOT_RE =
  /^export\s+type\s+FarmSnapshot\b/m;
const FARM_SNAPSHOT_ID_FIELD_RE = /\bid\s*:\s*string\b/;
const FARM_SNAPSHOT_NAME_FIELD_RE = /\bname\s*:\s*string\b/;
const FARM_SNAPSHOT_MEMBER_ID_FIELD_RE = /\bmemberId\s*:\s*string\b/;
const FARM_SNAPSHOT_LOCATION_FIELD_RE = /\blocation\s*:\s*string\b/;
const FARM_INQUIRY_PORT_LIST_METHOD_RE = /\blist\s*\(/;
const FARM_INQUIRY_PORT_FIND_BY_ID_METHOD_RE = /\bfindById\s*\(/;
const EXPORT_CLASS_LOCAL_FARM_INQUIRY_ADAPTER_RE =
  /^export\s+class\s+LocalFarmInquiryAdapter\b/m;
const COMP_ROOT_REEXPORT_LOCAL_FARM_INQUIRY_ADAPTER_RE =
  /\bLocalFarmInquiryAdapter\b/;
const SERVER_REEXPORT_FARM_INQUIRY_PORT_RE =
  /\bFarmInquiryPort\b/;
const SERVER_REEXPORT_FARM_SNAPSHOT_RE =
  /\bFarmSnapshot\b/;
const IMPORT_FARM_INQUIRY_PORT_HEX_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bFarmInquiryPort\b[^}]*\}\s*from\s*["']@\/modules\/farm\/presentation\/server["']/m;
const LEGACY_FARMS_SERVICE_IMPORT_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bFarmsService\b[^}]*\}\s*from\s*["']@\/features\/farms\/server["']/m;
const NEW_FARMS_SERVICE_CTOR_RE = /new\s+FarmsService\s*\(/;

describe("POC paired farms+lots C6 — cross-feature ports migration paired-farm side (NEW FarmInquiryPort + LocalFarmInquiryAdapter + AI-agent cross-feature consumers cutover legacy → hex DI shape, Marco locks D5 CONSOLIDATE canonical paired sister contacts EXACT + D1 DEFER compound query cleanup pending + D3 SPLIT RED-α/GREEN paired sister C0-C5 EXACT + D4 FarmInquiryPort signature mínimo driver-anchored list+findById + D6 path convention top-level matches C0/C1 multi-layer + D7 LotSnapshot expand `{id, name, initialCount}` driver-anchored CR8 + D8 test mocks adapt mismo batch GREEN atomic CR9)", () => {
  // ── A: FarmInquiryPort domain shape NEW (α1-α4) ────────────────────────────

  it("α1: modules/farm/domain/ports/farm-inquiry.port.ts FILE EXISTS (NEW canonical port greenfield C6 atomic single batch GREEN target — paired sister LotInquiryPort canonical pattern minimal EXACT mirror precedent D4)", () => {
    expect(existsSync(FARM_INQUIRY_PORT)).toBe(true);
  });

  it("α2: farm-inquiry.port.ts exports `interface FarmInquiryPort` (D4 signature canonical paired sister LotInquiryPort minimal precedent EXACT mirror — driver-anchored consumer evidence concreta AI-agent listFarms + farms page list)", () => {
    const src = readFarmFile("domain/ports/farm-inquiry.port.ts");
    expect(src).toMatch(EXPORT_INTERFACE_FARM_INQUIRY_PORT_RE);
  });

  it("α3: farm-inquiry.port.ts exports `type FarmSnapshot` with id+name+memberId+location string fields (D4 driver-anchored Farm entity shape EXACT mirror — anti-immediacy YAGNI minimal scope)", () => {
    const src = readFarmFile("domain/ports/farm-inquiry.port.ts");
    expect(src).toMatch(EXPORT_TYPE_FARM_SNAPSHOT_RE);
    expect(src).toMatch(FARM_SNAPSHOT_ID_FIELD_RE);
    expect(src).toMatch(FARM_SNAPSHOT_NAME_FIELD_RE);
    expect(src).toMatch(FARM_SNAPSHOT_MEMBER_ID_FIELD_RE);
    expect(src).toMatch(FARM_SNAPSHOT_LOCATION_FIELD_RE);
  });

  it("α4: FarmInquiryPort signature includes `list(` and `findById(` methods (D4 Q5A list(filters) único Marco lock heredado preserved + findById paired sister LotInquiryPort minimal precedent EXACT mirror)", () => {
    const src = readFarmFile("domain/ports/farm-inquiry.port.ts");
    expect(src).toMatch(FARM_INQUIRY_PORT_LIST_METHOD_RE);
    expect(src).toMatch(FARM_INQUIRY_PORT_FIND_BY_ID_METHOD_RE);
  });

  // ── B: LocalFarmInquiryAdapter infrastructure NEW (α5-α6) ──────────────────

  it("α5: modules/farm/infrastructure/local-farm-inquiry.adapter.ts FILE EXISTS (NEW canonical adapter greenfield C6 atomic single batch GREEN target — wrap makeFarmService precedent paired sister LocalContactsExistenceAdapter EXACT mirror)", () => {
    expect(existsSync(LOCAL_FARM_INQUIRY_ADAPTER)).toBe(true);
  });

  it("α6: local-farm-inquiry.adapter.ts declares `class LocalFarmInquiryAdapter` (paired sister LocalContactsExistenceAdapter precedent EXACT mirror — D5 consolidate canonical pattern adapter implements FarmInquiryPort port shape)", () => {
    const src = readFarmFile("infrastructure/local-farm-inquiry.adapter.ts");
    expect(src).toMatch(EXPORT_CLASS_LOCAL_FARM_INQUIRY_ADAPTER_RE);
  });

  // ── C: Presentation hex wiring (α7-α8) ─────────────────────────────────────

  it("α7: composition-root.ts exports `LocalFarmInquiryAdapter` (barrel chain wiring infrastructure → presentation paired sister payables composition-root precedent EXACT mirror — public API surface adapter factory)", () => {
    const src = readFarmFile("presentation/composition-root.ts");
    expect(src).toMatch(COMP_ROOT_REEXPORT_LOCAL_FARM_INQUIRY_ADAPTER_RE);
  });

  it("α8: server.ts re-exports `FarmInquiryPort` and `FarmSnapshot` types from composition-root (paired sister `server.ts` mirror precedent — public API surface consumer features import single source `@/modules/farm/presentation/server`)", () => {
    const src = readFarmFile("presentation/server.ts");
    expect(src).toMatch(SERVER_REEXPORT_FARM_INQUIRY_PORT_RE);
    expect(src).toMatch(SERVER_REEXPORT_FARM_SNAPSHOT_RE);
  });

  // ── D: AI-agent agent.service.ts cutover (α9-α11) ──────────────────────────

  it("α9: features/ai-agent/agent.service.ts imports `FarmInquiryPort` from `@/modules/farm/presentation/server` (cutover legacy class ctor `new FarmsService()` → FarmInquiryPort DI Path α direct mecánico mirror C4 routes precedent EXACT — D7 cross-feature SERVICE consumer cutover)", () => {
    const src = readRepoFile("features/ai-agent/agent.service.ts");
    expect(src).toMatch(IMPORT_FARM_INQUIRY_PORT_HEX_RE);
  });

  it("α10: features/ai-agent/agent.service.ts does NOT import `FarmsService` from `@/features/farms/server` (legacy class dropped post-cutover, ADDITIVE strategy preserva features/farms/* intactos hasta C7 wholesale delete per Marco lock heredado D1 Opt C C4 precedent EXACT)", () => {
    const src = readRepoFile("features/ai-agent/agent.service.ts");
    expect(src).not.toMatch(LEGACY_FARMS_SERVICE_IMPORT_RE);
  });

  it("α11: features/ai-agent/agent.service.ts does NOT contain `new FarmsService(` literal (legacy class ctor instantiation dropped post-cutover, ADDITIVE preserve legacy intactos features/farms/farms.service.ts hasta C7)", () => {
    const src = readRepoFile("features/ai-agent/agent.service.ts");
    expect(src).not.toMatch(NEW_FARMS_SERVICE_CTOR_RE);
  });

  // ── E: AI-agent chat.ts consumer type cutover (α12-α13) ────────────────────

  it("α12: features/ai-agent/modes/chat.ts imports `FarmInquiryPort` from `@/modules/farm/presentation/server` (consumer ChatModeDeps type migration FarmsService → FarmInquiryPort paired sister cross-feature consumer migration inline mismo batch D8)", () => {
    const src = readRepoFile("features/ai-agent/modes/chat.ts");
    expect(src).toMatch(IMPORT_FARM_INQUIRY_PORT_HEX_RE);
  });

  it("α13: features/ai-agent/modes/chat.ts does NOT import `FarmsService` from `@/features/farms/server` (legacy type dropped post-cutover)", () => {
    const src = readRepoFile("features/ai-agent/modes/chat.ts");
    expect(src).not.toMatch(LEGACY_FARMS_SERVICE_IMPORT_RE);
  });
});
