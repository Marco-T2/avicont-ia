/**
 * POC paired payables↔receivables C1b RED-α — boundary attachContact Option A
 * push INTO infrastructure/contact-attacher.ts shape (paired-payables side,
 * paired sister mirror receivables).
 *
 * **SUPERSEDING `ee87364`** per Marco lock CR2 — invariant collision elevation
 * `feedback_invariant_collision_elevation`. R5 lint-enforced architectural
 * invariant detected post-GREEN runtime verify métrica #3 (4 NEW errores
 * ESLint en boundary hex `presentation/server.ts:2,4` violando "domain/
 * application/presentation must NOT import Prisma. Define a port in domain/
 * and implement it in infrastructure/."). Marco lock CR1 α-A3 honor R5 letter
 * + spirit + mirror A5 hex layering canonical: place attachContact[s] +
 * mapper EN `modules/{X}/infrastructure/contact-attacher.ts` (Prisma allowed
 * at infrastructure layer per architecture canonical) + barrel re-export
 * desde `presentation/server.ts`. NO carve-out anti-pattern (vs α-A2 silent
 * override) + NO ContactHydratePort definition (vs α-A1 8 archivos new excede
 * mirror A5 precedent EXACT bisect-friendly granularity Marco lock #1).
 *
 * Axis: functional move 3 privados shim INTO modules/payables/infrastructure/
 * contact-attacher.ts boundary hex per Marco lock CR1 α-A3 (refined Marco
 * lock heredado #1610 Option A — Option A originalmente pensado push INTO
 * presentation/server.ts violates R5; refined push INTO infrastructure/
 * contact-attacher.ts honors R5 + barrel re-export desde presentation/server.ts
 * preserves consumer surface). Granularity 9→8 ciclos refined Marco lock L1
 * (drop C2, C1b unified). NEW kind de ciclo POC paired vs path-swap precedent
 * A5-C2a/C2b/C2c/C0/C1a — primera functional code migration (NO mecánica swap)
 * + primera invariant collision elevation aplicada cross-POC. §13.A5-γ MATERIAL
 * aplicado (16 callsites paired, magnitude 4× vs §13.A4-α); resolution Option A
 * push INTO infrastructure/contact-attacher.ts preserva legacy POJO contract
 * en boundary hex, mínimo refactor consumers + R5 invariant honored.
 *
 * 3 privados shim INCLUIDOS Marco lock L2 (paired sister symmetric mirror,
 * target re-located CR1 α-A3):
 *   - features/payables/payables.service.ts L101-112: attachContacts (plural,
 *     list-style: prisma.contact.findMany scoped + Map by id)
 *     → modules/payables/infrastructure/contact-attacher.ts (NEW file)
 *   - features/payables/payables.service.ts L114-122: attachContact (singular,
 *     getById/create/update-style: prisma.contact.findFirst scoped)
 *     → modules/payables/infrastructure/contact-attacher.ts (NEW file)
 *   - features/payables/payables.service.ts L124-146: toPayableWithContact
 *     (mapper privado Prisma.Decimal reconstruction MonetaryAmount.value→Prisma.Decimal
 *     en amount/paid/balance + contact attach)
 *     → modules/payables/infrastructure/contact-attacher.ts (NEW file)
 *
 * Barrel re-export pattern:
 *   - modules/payables/presentation/server.ts ADDS:
 *     `export { attachContact, attachContacts } from "../infrastructure/contact-attacher";`
 *   - server.ts barrel pure preserved (NO direct Prisma import — R5 honored ✓)
 *
 * Marco lock final RED-α scope (4 assertions α paired-payables side — paired
 * sister mirror receivables 4 assertions = 8 paired total parsimonious vs
 * C1a 10):
 *   ── Hex boundary barrel re-export POSITIVE (Tests 1-2) ──
 *     T1 server.ts re-exports attachContact (singular, barrel re-export from
 *        ../infrastructure/contact-attacher)
 *     T2 server.ts re-exports attachContacts (plural, barrel re-export idem)
 *
 *   ── Hex infrastructure functional content POSITIVE (Tests 3-4) ──
 *   ** RE-TARGETED CR1 α-A3 **: T3/T4 paths cambian de presentation/server.ts
 *   → infrastructure/contact-attacher.ts per Marco lock CR1. Honor R5
 *   architectural invariant + mirror A5 hex layering canonical (Prisma allowed
 *   at infrastructure layer ✓).
 *     T3 contact-attacher.ts contains Prisma.Decimal reference (mapper
 *        reconstruction MonetaryAmount.value→Prisma.Decimal at infrastructure
 *        layer per Marco lock L3 ACCEPT + CR1 α-A3 R5 honor)
 *     T4 contact-attacher.ts contains prisma.contact.find reference
 *        (cross-module direct contact table query at infrastructure layer per
 *        Marco lock L4 F3-C ACCEPT + CR1 α-A3 R5 honor — TODO ContactHydratePort
 *        extraction defer future POC contacts cleanup)
 *
 * Marco locks aplicados pre-RED-α (C1b unified ciclo, refined CR1):
 *   - L1: 1 ciclo unificado C1b (drop C2, granularity 9→8 refined)
 *   - L2: 3 privados juntos (attachContacts plural + attachContact singular + mapper)
 *   - L3: ACEPTAR Prisma.Decimal leak per #1610 Option A + callout commit body —
 *     **REFINED CR1 α-A3**: Prisma.Decimal at infrastructure/ layer (NO presentation/)
 *   - L4: F3-C ACEPTAR prisma.contact direct query + defer port POC contacts futuro +
 *     TODO commit body — **REFINED CR1 α-A3**: query at infrastructure/ layer
 *   - L5: Test path modules/{payables,receivables}/presentation/__tests__/ (paired
 *     sister 2 files preserved post-CR1 — tests asserting infrastructure paths)
 *   - L6: Defer baseline verify pre-RED (single vitest gate suficiente post-RED-α)
 *   - L7: Defer §13 sub-rule cementación (kind nueva functional move + invariant
 *     collision elevation pattern) post-cumulative D8
 *   - **CR1**: α-A3 infra move (modules/{X}/infrastructure/contact-attacher.ts)
 *   - **CR2**: NEW RED commit superseding ee87364 (NO amend)
 *   - **CR3**: git restore 4 archivos GREEN (preserva ee87364 intact)
 *   - **CR4**: Save lección retroactiva engram NEW (Step 0 expand pre-RED grep
 *     no-restricted-imports rules MANDATORY — pre-cementación D8 target)
 *
 * §13.A5-α paired sister sub-cycle continuation (7ma evidencia matures cumulative
 * cross-§13 same POC paired): A5-C2a (3ra) → A5-C2b (4ta) → A5-C2c (5ta) → C0
 * (5ta + sister continuation) → C1a (6ta paired sister Path α direct) → **C1b-α
 * (7ma paired sister Option A push INTO infrastructure/ + barrel re-export
 * functional move NEW kind + invariant collision elevation)**. Engram canonical
 * home `arch/§13/A5-alpha-multi-level-composition-root-delegation` ya cementado
 * A5-C2a — C1b-α NO require re-cementación (kind nuevo functional move + R5
 * invariant honor; defer §13 sub-rule cementación post-cumulative D8 per Marco
 * lock L7).
 *
 * §13.A5-γ MATERIAL boundary preservation (refined CR1 α-A3):
 *   - Mapper Prisma.Decimal reconstruction (amount/paid/balance) preserves legacy
 *     POJO contract `PayableWithContact = AccountsPayable & { contact: Contact }`
 *     en infrastructure/ layer post-cutover. NO callsite consumer migration
 *     required C1b — barrel re-export desde presentation/server.ts preserves
 *     consumer surface.
 *   - Public shim API `list/getById/create/update/updateStatus/void` retornos
 *     `Promise<PayableWithContact>` PRESERVED — C1b internal refactor only,
 *     consumer-facing surface unchanged.
 *
 * §13.A5-ε method-level signature divergence — DESCARTADO C1b (verified Step 0
 * expand): NO method shim divergent — internal helper move (functional code
 * migration) NO signature divergence emergente. Mapper return type
 * `PayableWithContact` consistente shim (pre) ↔ infrastructure/ (post).
 *
 * Sub-findings emergentes (Step 0 + post-GREEN runtime verify discovery):
 *   - EMERGENTE #1: bookmark heredado #1617 line range 114-146 omitía L101-112
 *     attachContacts plural — Marco lock L2 INCLUIR los 3 privados juntos
 *     (symmetry + shared mapper bundle).
 *   - EMERGENTE #2: Prisma.Decimal coupling — Marco lock L3 ACCEPT (refined
 *     CR1 α-A3: at infrastructure/ layer, NO presentation/).
 *   - EMERGENTE #3: prisma.contact direct query cross-module — Marco lock L4
 *     F3-C ACCEPT + TODO ContactHydratePort future POC contacts (refined CR1
 *     α-A3: at infrastructure/ layer).
 *   - EMERGENTE #4: NO mirror precedent EXACT — C1b primera kind functional
 *     code migration vs path swap precedent (Marco lock L7 defer §13 sub-rule
 *     cementación post-cumulative D8).
 *   - EMERGENTE #5: granularity ambiguity C1b vs C2 — Marco lock L1 1 ciclo
 *     unificado.
 *   - **EMERGENTE #6 RETROACTIVE post-GREEN runtime verify**: R5 lint-enforced
 *     architectural invariant collision detected at boundary hex (presentation/
 *     server.ts cannot import Prisma per ESLint no-restricted-imports rule).
 *     `feedback_invariant_collision_elevation` ESCALATION applied — Marco lock
 *     CR1-CR4 sequence resolved via α-A3 infra move (NO carve-out anti-pattern).
 *     NEW lección retroactiva saved engram (`feedback/step-0-expand-eslint-
 *     restricted-imports-grep`) — Step 0 expand pre-RED PROACTIVE 6th axis
 *     classification grep `no-restricted-imports` rules targeting target layer
 *     MANDATORY.
 *
 * Expected RED-α failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1 FAIL: server.ts barrel hoy 51 LOC pure barrel re-export, NO contiene
 *     `attachContact` literal. Regex match falla.
 *   - T2 FAIL: server.ts NO contiene `attachContacts` literal. Regex match falla.
 *   - T3 FAIL: modules/payables/infrastructure/contact-attacher.ts NO existe
 *     pre-GREEN — `fs.readFileSync` throws ENOENT. Test FAIL via thrown error
 *     (failure mode honest enumerated: file not yet created).
 *   - T4 FAIL: idem (same file NO existe pre-GREEN).
 * Total expected FAIL pre-GREEN: 4/4 (Marco mandate failure mode honest enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L5): shape test
 * asserta paths `modules/payables/presentation/server.ts` +
 * `modules/payables/infrastructure/contact-attacher.ts` que persisten post C7
 * wholesale delete `features/payables/`. Test vive en
 * modules/payables/presentation/__tests__/ — NO toca features/payables/* que
 * C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent C1a + C0 + A5-C2b
 * (`fs.readFileSync` regex match) — keep pattern paired POC. Departure note:
 * kind nueva functional move + invariant collision elevation (vs path swap +
 * R5-clean precedent) target asserción shifts:
 *   - C0/C1a: "consumer imports" (cross-module path swap)
 *   - C1b ee87364: "boundary exports + functional content at presentation/" (R5 violation)
 *   - C1b-α: "boundary exports at presentation/ + functional content at
 *     infrastructure/" (R5 honored ✓)
 *
 * Cross-ref:
 *   - architecture.md R5 (domain/application/presentation must NOT import Prisma — INVARIANT honored CR1 α-A3)
 *   - architecture.md §13.7 #2/#10/#10-skippable/#12/#13/#14 (lecciones aplicadas RED-α scope)
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage (cementada A5-D1)
 *   - architecture.md §13.A5-α paired sister 6ta evidencia matures (cementada C1a `47449d8` paired closure)
 *   - architecture.md §13.A4-α DTO divergence (precedent paired sister §13.A5-γ scaled 4× magnitud)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 (canonical home — paired sister 7ma evidencia matures cumulative this RED-α C1b)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (formal cementación A5-D1 — boundary Option A applied CR1 α-A3)
 *   - engram `poc-nuevo/paired-payables-receivables/c1a-closed` #1617 (cycle-start bookmark C1b heredado)
 *   - engram `paired/proximo-poc/pre-decision-analysis` #1610 (Marco lock Option A pre-decisional — refined CR1 α-A3 push INTO infrastructure/)
 *   - engram `feedback/step-0-expand-eslint-restricted-imports-grep` (NEW lección retroactiva CR4 — Step 0 expand pre-RED grep no-restricted-imports MANDATORY)
 *   - engram `feedback_invariant_collision_elevation` (CR1-CR4 sequence applied — escalation pattern reusable cross-POC)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 4/4 per side enumerated)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite + rationale + cross-ref applied RED-α body)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (Marco lock #3 PROACTIVE applied post-GREEN — cumulative cross-POC 6ta evidencia este turno post-CR1 GREEN re-execute)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate suficiente post-RED-α Marco lock L6)
 *   - engram `feedback_jsdoc_atomic_revoke` (precedent C1a `47449d8` Opción A clean atomic 2 archivos)
 *   - features/payables/payables.service.ts L101-146 (3 privados shim source pre-cutover)
 *   - features/payables/payables.types.ts (PayableWithContact = AccountsPayable & { contact: Contact } legacy POJO contract preserved)
 *   - modules/payables/presentation/server.ts (target boundary hex barrel — barrel re-export pre-RED 51 LOC, post-GREEN +1 re-export line)
 *   - modules/payables/infrastructure/contact-attacher.ts (target NEW file pre-GREEN ENOENT, post-GREEN ~50 LOC functional code at infrastructure/ layer R5 honored)
 *   - modules/payables/presentation/composition-root.ts (factories pre-existing post C1a closure)
 *   - modules/receivables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts (paired sister mirror RED-α this batch)
 *   - modules/receivables/presentation/__tests__/c0-dispatch-cleanup-shape.paired-pr.test.ts (precedent shape C0 RED `d6b9f4d` + GREEN `5f18aac`)
 *   - modules/sale/presentation/__tests__/c1a-cross-module-shape.paired-pr.test.ts (precedent shape C1a RED `5ca99cf` + GREEN `47449d8`)
 *   - paired-pr-C0 RED `d6b9f4d` + GREEN `5f18aac` master (preceding ciclo paired POC)
 *   - paired-pr-C1a RED `5ca99cf` + GREEN `47449d8` master (preceding ciclo paired POC)
 *   - paired-pr-C1b RED `ee87364` master (SUPERSEDED este RED-α — invariant collision elevation R5)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C1b-α boundary hex targets (2 archivos paired-payables side post-CR1 α-A3) ──

const PAYABLES_SERVER = path.join(
  REPO_ROOT,
  "modules/payables/presentation/server.ts",
);
const PAYABLES_CONTACT_ATTACHER = path.join(
  REPO_ROOT,
  "modules/payables/infrastructure/contact-attacher.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const ATTACH_CONTACT_EXPORT_RE = /export\s+(?:async\s+)?function\s+attachContact\b|export\s*\{\s*[^}]*\battachContact\b[^}]*\}|export\s+const\s+attachContact\s*=/;
const ATTACH_CONTACTS_EXPORT_RE = /export\s+(?:async\s+)?function\s+attachContacts\b|export\s*\{\s*[^}]*\battachContacts\b[^}]*\}|export\s+const\s+attachContacts\s*=/;
const PRISMA_DECIMAL_RE = /\bPrisma\.Decimal\b/;
const PRISMA_CONTACT_FIND_RE = /\bprisma\.contact\.(?:findFirst|findMany)\b/;

describe("POC paired payables↔receivables C1b-α — boundary attachContact Option A push INTO infrastructure/contact-attacher.ts shape (paired-payables side, §13.A5-γ MATERIAL boundary preservation, 7ma evidencia §13.A5-α paired sister sub-cycle functional move NEW kind + R5 invariant collision elevation honored)", () => {
  // ── Hex boundary barrel re-export POSITIVE (Tests 1-2) ──────────────────

  it("Test 1: modules/payables/presentation/server.ts re-exports attachContact (singular, barrel re-export from ../infrastructure/contact-attacher per Marco lock CR1 α-A3)", () => {
    const source = fs.readFileSync(PAYABLES_SERVER, "utf8");
    expect(source).toMatch(ATTACH_CONTACT_EXPORT_RE);
  });

  it("Test 2: modules/payables/presentation/server.ts re-exports attachContacts (plural, barrel re-export idem)", () => {
    const source = fs.readFileSync(PAYABLES_SERVER, "utf8");
    expect(source).toMatch(ATTACH_CONTACTS_EXPORT_RE);
  });

  // ── Hex infrastructure functional content POSITIVE (Tests 3-4) ──────────
  // RE-TARGETED CR1 α-A3: paths cambian de presentation/server.ts →
  // infrastructure/contact-attacher.ts. Honor R5 architectural invariant
  // (Prisma allowed at infrastructure layer per architecture canonical).

  it("Test 3: modules/payables/infrastructure/contact-attacher.ts contains Prisma.Decimal reference (mapper reconstruction MonetaryAmount.value→Prisma.Decimal at infrastructure layer per Marco lock L3 + CR1 α-A3 R5 honor)", () => {
    const source = fs.readFileSync(PAYABLES_CONTACT_ATTACHER, "utf8");
    expect(source).toMatch(PRISMA_DECIMAL_RE);
  });

  it("Test 4: modules/payables/infrastructure/contact-attacher.ts contains prisma.contact.find reference (cross-module direct contact table query at infrastructure layer per Marco lock L4 F3-C + CR1 α-A3 R5 honor — TODO ContactHydratePort extraction future POC contacts)", () => {
    const source = fs.readFileSync(PAYABLES_CONTACT_ATTACHER, "utf8");
    expect(source).toMatch(PRISMA_CONTACT_FIND_RE);
  });
});
