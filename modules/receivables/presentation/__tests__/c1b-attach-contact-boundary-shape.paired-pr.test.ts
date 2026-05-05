/**
 * POC paired payables↔receivables C1b — boundary attachContact Option A
 * push INTO hex shape (paired-receivables side, paired sister mirror payables).
 *
 * Axis: functional move 3 privados shim INTO modules/receivables/presentation/server.ts
 * boundary hex per Marco lock #1610 Option A "preserva legacy POJO contract en
 * boundary hex". Granularity 9→8 ciclos refined Marco lock L1 (drop C2,
 * C1b unified). NEW kind de ciclo en POC paired vs path-swap precedent
 * A5-C2a/C2b/C2c/C0/C1a — primera functional code migration (NO mecánica swap).
 * §13.A5-γ MATERIAL aplicado (16 callsites paired, magnitude 4× vs §13.A4-α);
 * resolution Option A push INTO boundary hex preserva legacy POJO contract,
 * mínimo refactor consumers.
 *
 * 3 privados shim INCLUIDOS Marco lock L2 (paired sister symmetric mirror):
 *   - features/receivables/receivables.service.ts L101-112: attachContacts (plural,
 *     list-style: prisma.contact.findMany scoped + Map by id)
 *   - features/receivables/receivables.service.ts L114-122: attachContact (singular,
 *     getById/create/update-style: prisma.contact.findFirst scoped)
 *   - features/receivables/receivables.service.ts L124-146: toReceivableWithContact
 *     (mapper privado Prisma.Decimal reconstruction MonetaryAmount.value→Prisma.Decimal
 *     en amount/paid/balance + contact attach)
 *
 * Marco lock final RED scope (4 assertions α paired-receivables side — paired sister
 * mirror payables 4 assertions = 8 paired total parsimonious vs C1a 10):
 *   ── Hex boundary export POSITIVE (Tests 1-2) ──
 *     T1 server.ts exports attachContact (singular)
 *     T2 server.ts exports attachContacts (plural)
 *
 *   ── Hex boundary functional content POSITIVE (Tests 3-4) ──
 *     T3 server.ts contains Prisma.Decimal reference (mapper reconstruction at
 *        hex per Marco lock L3 ACCEPT leak — boundary hex Prisma.Decimal coupling
 *        knowingly accepted; Option B candidate cuando consumers migran a hex
 *        entity + ContactRead use-case)
 *     T4 server.ts contains prisma.contact.find reference (cross-module direct
 *        query at hex per Marco lock L4 F3-C ACCEPT — defer ContactHydratePort
 *        extraction a future POC contacts cleanup; mark TODO commit body)
 *
 * Marco locks aplicados pre-RED (C1b unified ciclo):
 *   - L1: 1 ciclo unificado C1b (drop C2, granularity 9→8 refined)
 *   - L2: 3 privados juntos (attachContacts plural + attachContact singular + mapper)
 *   - L3: ACEPTAR Prisma.Decimal leak per #1610 Option A + callout commit body
 *   - L4: F3-C ACEPTAR prisma.contact direct query + defer port POC contacts futuro + TODO
 *   - L5: Test path modules/{payables,receivables}/presentation/__tests__/ (paired sister 2 files)
 *   - L6: Defer baseline verify pre-RED (single vitest gate suficiente post-RED)
 *   - L7: Defer §13 sub-rule cementación (kind nueva functional move) post-cumulative D8
 *
 * §13.A5-α paired sister sub-cycle continuation (7ma evidencia matures cumulative
 * cross-§13 same POC paired): A5-C2a (3ra) → A5-C2b (4ta) → A5-C2c (5ta) → C0
 * (5ta + sister continuation) → C1a (6ta paired sister Path α direct) → **C1b
 * (7ma paired sister Option A push INTO functional move NEW kind)**. Engram
 * canonical home `arch/§13/A5-alpha-multi-level-composition-root-delegation` ya
 * cementado A5-C2a — C1b NO require re-cementación (kind nuevo functional move
 * defer §13 sub-rule cementación post-cumulative D8 per Marco lock L7).
 *
 * §13.A5-γ MATERIAL boundary preservation:
 *   - Mapper Prisma.Decimal reconstruction (amount/paid/balance) preserves legacy
 *     POJO contract `ReceivableWithContact = AccountsReceivable & { contact: Contact }`
 *     en boundary hex post-cutover. NO callsite consumer migration required C1b.
 *   - Public shim API `list/getById/create/update/updateStatus/void` retornos
 *     `Promise<ReceivableWithContact>` PRESERVED — C1b internal refactor only,
 *     consumer-facing surface unchanged.
 *
 * §13.A5-ε method-level signature divergence — DESCARTADO C1b (verified Step 0
 * expand): NO method shim divergent — internal helper move (functional code
 * migration) NO signature divergence emergente. Mapper return type
 * `ReceivableWithContact` consistente shim (pre) ↔ hex (post).
 *
 * Sub-findings emergentes pre-RED honest (Step 0 surface to Marco — locked):
 *   - EMERGENTE #1: bookmark heredado #1617 line range 114-146 omitía L101-112
 *     attachContacts plural — Marco lock L2 INCLUIR los 3 privados juntos
 *     (symmetry + shared mapper bundle).
 *   - EMERGENTE #2: Prisma.Decimal coupling at boundary hex — Marco lock L3
 *     ACCEPT leak per Option A legacy POJO preservation; Option B candidate
 *     cuando consumers migran a hex entity + ContactRead use-case.
 *   - EMERGENTE #3: prisma.contact.findFirst/findMany direct query at boundary
 *     hex (cross-module direct contact table query) — Marco lock L4 F3-C ACCEPT
 *     leak + defer ContactHydratePort extraction a future POC contacts cleanup;
 *     TODO callout commit body GREEN apply.
 *   - EMERGENTE #4: NO mirror precedent EXACT — C1b primera kind functional code
 *     migration vs path swap precedent (A5-C2a/b/c/C0/C1a). §13 sub-rule
 *     cementación timing defer post-cumulative D8 per Marco lock L7 (1 ciclo
 *     NO suficiente evidencia, paired sister puro C1b este turno).
 *   - EMERGENTE #5: granularity ambiguity C1b vs C2 — Marco lock L1 1 ciclo
 *     unificado (drop C2, helpers privados son atomic unit minimum-scope honest).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1 FAIL: server.ts barrel hoy 51 LOC pure barrel re-export, NO contiene
 *     `attachContact` literal. Regex match falla.
 *   - T2 FAIL: server.ts NO contiene `attachContacts` literal. Regex match falla.
 *   - T3 FAIL: server.ts NO contiene `Prisma.Decimal` reference (no Prisma import,
 *     mapper aún en features/receivables/receivables.service.ts L133-135). Regex
 *     match falla.
 *   - T4 FAIL: server.ts NO contiene `prisma.contact.find` reference (no prisma
 *     import, query aún en features/receivables/receivables.service.ts L107-110 +
 *     L118-120). Regex match falla.
 * Total expected FAIL pre-GREEN: 4/4 (Marco mandate failure mode honest enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L5): shape test
 * asserta path `modules/receivables/presentation/server.ts` que persiste post C7
 * wholesale delete `features/receivables/`. Test vive en
 * modules/receivables/presentation/__tests__/ — NO toca features/receivables/*
 * que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent C1a + C0 + A5-C2b
 * (`fs.readFileSync` regex match) — keep pattern pareja paired POC. Departure
 * note: kind nueva functional move (vs path swap precedent) target asserción
 * shifts de "consumer imports" (C0/C1a) → "boundary exports + functional content"
 * (C1b) — pattern preserved, axis adjusted target side hex boundary.
 *
 * Cross-ref:
 *   - architecture.md §13.7 #2/#10/#10-skippable/#12/#13/#14 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage (cementada A5-D1)
 *   - architecture.md §13.A5-α paired sister 6ta evidencia matures (cementada C1a `47449d8` paired closure)
 *   - architecture.md §13.A4-α DTO divergence (precedent paired sister §13.A5-γ scaled 4× magnitud)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 (canonical home — paired sister 7ma evidencia matures cumulative this RED C1b)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (formal cementación A5-D1 — boundary Option A applied this RED C1b)
 *   - engram `poc-nuevo/paired-payables-receivables/c1a-closed` #1617 (cycle-start bookmark C1b heredado — Step 0 expand surface 5 emergentes Marco lock L1-L7)
 *   - engram `poc-nuevo/paired-payables-receivables/c0-closed` #1615 (preceding cycle paired POC)
 *   - engram `paired/proximo-poc/pre-decision-analysis` #1610 (Marco lock Option A pre-decisional)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode declared honest 4/4 enumerated)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite + rationale + cross-ref applied RED commit body)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (Marco lock #3 PROACTIVE applied post-GREEN cumulative cross-POC)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate suficiente post-RED Marco lock L6)
 *   - engram `feedback_jsdoc_atomic_revoke` (precedent C1a `47449d8` Opción A clean atomic 2 archivos)
 *   - features/receivables/receivables.service.ts L101-146 (3 privados shim source pre-cutover)
 *   - features/receivables/receivables.types.ts (ReceivableWithContact = AccountsReceivable & { contact: Contact } legacy POJO contract preserved)
 *   - modules/receivables/presentation/server.ts (target boundary hex — barrel re-export pre-RED 51 LOC, post-GREEN +functional)
 *   - modules/receivables/presentation/composition-root.ts (factories pre-existing post C1a closure)
 *   - modules/payables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts (paired sister mirror RED this batch)
 *   - modules/receivables/presentation/__tests__/c0-dispatch-cleanup-shape.paired-pr.test.ts (precedent shape C0 RED `d6b9f4d` + GREEN `5f18aac`)
 *   - modules/sale/presentation/__tests__/c1a-cross-module-shape.paired-pr.test.ts (precedent shape C1a RED `5ca99cf` + GREEN `47449d8`)
 *   - paired-pr-C0 RED `d6b9f4d` + GREEN `5f18aac` master (preceding ciclo paired POC)
 *   - paired-pr-C1a RED `5ca99cf` + GREEN `47449d8` master (preceding ciclo paired POC)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C1b boundary hex target (1 archivo paired-receivables side) ───────────────

const RECEIVABLES_SERVER = path.join(
  REPO_ROOT,
  "modules/receivables/presentation/server.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const ATTACH_CONTACT_EXPORT_RE = /export\s+(?:async\s+)?function\s+attachContact\b|export\s*\{\s*[^}]*\battachContact\b[^}]*\}|export\s+const\s+attachContact\s*=/;
const ATTACH_CONTACTS_EXPORT_RE = /export\s+(?:async\s+)?function\s+attachContacts\b|export\s*\{\s*[^}]*\battachContacts\b[^}]*\}|export\s+const\s+attachContacts\s*=/;
const PRISMA_DECIMAL_RE = /\bPrisma\.Decimal\b/;
const PRISMA_CONTACT_FIND_RE = /\bprisma\.contact\.(?:findFirst|findMany)\b/;

describe("POC paired payables↔receivables C1b — boundary attachContact Option A push INTO hex shape (paired-receivables side, §13.A5-γ MATERIAL boundary preservation, 7ma evidencia §13.A5-α paired sister sub-cycle functional move NEW kind)", () => {
  // ── Hex boundary export POSITIVE (Tests 1-2) ────────────────────────────

  it("Test 1: modules/receivables/presentation/server.ts exports attachContact (singular, getById/create/update-style hex boundary)", () => {
    const source = fs.readFileSync(RECEIVABLES_SERVER, "utf8");
    expect(source).toMatch(ATTACH_CONTACT_EXPORT_RE);
  });

  it("Test 2: modules/receivables/presentation/server.ts exports attachContacts (plural, list-style hex boundary)", () => {
    const source = fs.readFileSync(RECEIVABLES_SERVER, "utf8");
    expect(source).toMatch(ATTACH_CONTACTS_EXPORT_RE);
  });

  // ── Hex boundary functional content POSITIVE (Tests 3-4) ────────────────
  // Marco lock L3 + L4 ACCEPT both leaks at boundary hex per Option A legacy POJO
  // contract preservation + defer ContactHydratePort extraction a future POC contacts cleanup.

  it("Test 3: modules/receivables/presentation/server.ts contains Prisma.Decimal reference (mapper reconstruction MonetaryAmount.value→Prisma.Decimal at boundary hex per Marco lock L3)", () => {
    const source = fs.readFileSync(RECEIVABLES_SERVER, "utf8");
    expect(source).toMatch(PRISMA_DECIMAL_RE);
  });

  it("Test 4: modules/receivables/presentation/server.ts contains prisma.contact.find reference (cross-module direct contact table query at boundary hex per Marco lock L4 F3-C — TODO ContactHydratePort extraction future POC contacts)", () => {
    const source = fs.readFileSync(RECEIVABLES_SERVER, "utf8");
    expect(source).toMatch(PRISMA_CONTACT_FIND_RE);
  });
});
