/**
 * POC correctivo contacts — RED textual gate hotfix retroactivo cutover
 * incompleto C4 GREEN cumulative single batch detected in-the-wild post-D1.
 *
 * Bug runtime confirmado origin reporte Marco /sales/new render Radix
 * `<SelectItem value={undefined}>` throw. Causa raíz: cutover legacy class
 * `new ContactsService()` → factory `makeContactsService()` (commit 1bf7c34
 * poc-nuevo-contacts-C4 GREEN single batch) NO aplicó §13 RSC boundary
 * serialization adapter pattern paired consumer adjustment (.toSnapshot()
 * chain). Cutover incompleto cementó drift latente 12 callsites cumulative
 * cross-feature/cross-module.
 *
 * Asimetría diagnóstica vs poc-nuevo-fiscal-periods C4 GREEN aa6c5a6
 * (commit posterior cronológicamente C4 contacts → C4 fiscal-periods):
 * fiscal-periods aplicó §13 RSC boundary serialization adapter 5ta evidencia
 * matures cumulative `.then((entities) => entities.map((p) => p.toSnapshot()))`
 * chain per archivo (10 page.tsx production) post-cutover atomic mismo
 * GREEN commit. Contacts C4 NO aplicó — gap §13 PROACTIVE pre-RED Step 0
 * 11-axis classification falló (axis NEW pendiente "consumer return-shape
 * verification" cuando productor entity con getters privados sobre
 * `this.props` cruza RSC boundary o `JSON.stringify`).
 *
 * Bug shape technical:
 *   `contactsService.list()` / `.getById()` returns `Promise<Contact>` /
 *   `Promise<Contact[]>` donde `Contact` entity (`modules/contacts/domain/
 *   contact.entity.ts:79-80`) `private constructor(private readonly props:
 *   ContactProps)` + getters wrap `this.props.{id,name,...}`. JSON.stringify
 *   serializa SOLO propiedades enumerables propias (NO getters de clase) →
 *   produce `{"props":{"id":"...","name":"..."}}`. Consumer post-serialización
 *   accede `c.id` / `c.name` directo → `undefined` runtime.
 *
 * Defensive serialization workaround `JSON.parse(JSON.stringify(contacts))`
 * en prop wrap pre-Client Component pass enmascara TypeScript estructural
 * coincidence (`Contact` Prisma type + entity getters mismo shape estructural
 * `id: string`/`name: string`) → bug invisible TSC, cementado drift runtime.
 *
 * Sweep PROJECT-scope MANDATORY surface findings textual exhaustivo (mirror
 * fiscal-periods C4 audit pattern Categ A/B/A'/A-bis):
 *   Categ A — BUG CONFIRMADO RSC boundary 10 page.tsx production:
 *     A1  app/(dashboard)/[orgSlug]/sales/new/page.tsx (CRASH REPORTADO)
 *     A2  app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx
 *     A3  app/(dashboard)/[orgSlug]/payments/page.tsx
 *     A4  app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx
 *     A5  app/(dashboard)/[orgSlug]/payments/new/page.tsx
 *     A6  app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx
 *         (PEOR — spread `{...contact, balanceSummary}` también roto)
 *     A7  app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx
 *     A8  app/(dashboard)/[orgSlug]/purchases/new/page.tsx
 *     A9  app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx
 *     A10 app/(dashboard)/[orgSlug]/dispatches/new/page.tsx
 *   Categ A-bis — BUG CONFIRMADO HTTP boundary 2 route.ts API endpoints
 *   (Response.json wrap internamente JSON.stringify mismo problema):
 *     A11 app/api/organizations/[orgSlug]/contacts/route.ts (GET list + POST create)
 *     A12 app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts
 *         (GET getById + PATCH update + DELETE deactivate)
 *   Categ A' — CORRECTO already snapshot 1 archivo:
 *     A'1 app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx usa
 *         `makeContactBalancesService().listWithBalancesFlat()` que internamente
 *         hace `contact.toSnapshot()` (verified contact-balances.service.ts:124)
 *   Categ B — NO APLICA server-only consumers 11 callsites adapters/services/
 *   AI tools/composition roots leen getters dentro mismo proceso server-side.
 *
 * Scope expand audit otros factories hex `make*Service`: fiscal-periods +
 * org-settings YA aplican toSnapshot per cada callsite RSC boundary.
 * sale/purchase entities pasan por mappers explícitos (toSaleWithDetails +
 * toPurchaseWithDetails) field-by-field projection POJO output. contact-
 * balances devuelve POJO ContactWithBalanceFlat by design. mortality DEFER
 * scope (NO evidencia bug runtime). makeContactsService único factory hex
 * con drift latente cruzando boundaries serializados.
 *
 * Marco lock granularity Opción 1 single batch atomic 12 archivos (10 page +
 * 2 route) mirror fiscal-periods C4 GREEN cumulative single-batch precedent
 * EXACT. Bug uniforme mismo patrón, scope coherente, NO axis natural split.
 * Bisectable via per-file diff dentro del commit.
 *
 * Marco lock RED test shape minimal textual gate per archivo single test
 * file (NO 12 separados). Total 24α en 1 archivo NEW vs 42α fiscal-periods
 * scaled per-archivo, scope homogéneo justifica consolidación.
 *
 * 24α distribution intercalado POS/NEG per archivo bisect-friendly mirror
 * precedent C4-ter EXACT:
 *   Section A — 10 page.tsx (10 POS toSnapshot chain + 10 NEG no JSON.parse
 *     JSON.stringify(contact*) wrap = 20α)
 *   Section B — 2 route.ts (2 POS toSnapshot present + 2 NEG no
 *     Response.json bare entity wrap = 4α)
 *
 * Cross-cycle-red-test-cementacion-gate verify CLEAN pre-RED este turno:
 * scope NO overlap C4-ter cumulative test file (cementación legacy class →
 * factory cutover scope axis distinct). Categ A-bis routes scope NEW NO
 * overlap C4-ter Section B routes test (cementación factory pattern axis
 * distinct vs return-shape verification axis NEW).
 *
 * Test file location modules/contacts/presentation/__tests__/ — target hex
 * ownership mirror precedent c4-ter EXACT — self-contained future-proof.
 * Path Marco lock raw `modules/contacts/__tests__/` ajustado convención
 * cumulative-precedent repo `presentation/__tests__/` honest surface.
 *
 * Expected failure mode pre-GREEN: 24/24 FAIL enumerated explicit per
 * feedback_red_acceptance_failure_mode:
 *   Section A POS T1/T3/T5/T7/T9/T11/T13/T15/T17/T19 toSnapshot chain
 *     currently absent en chain `contactsService.{list,getById}` calls
 *   Section A NEG T2/T4/T6/T8/T10/T12/T14/T16/T18/T20 JSON.parse JSON.stringify
 *     wrap currently present en prop pass pre-Client Component
 *   Section B POS T21/T23 toSnapshot chain currently absent en Response.json
 *     wrap pre HTTP serialization
 *   Section B NEG T22/T24 Response.json bare entity (sin .toSnapshot()) wrap
 *     currently present
 *
 * Lecciones canonical home D1 cementación target engram batch save POST-
 * doc commit (NO architecture.md inline mirror feedback_engram_textual_lock_
 * redundancy):
 *   1. feedback/cutover-consumer-return-shape-verification-gate NEW canonical
 *      home 1ra evidencia (paired sister §13 RSC boundary serialization
 *      adapter — gate side vs pattern side)
 *   2. pre-phase-audit-gate scope expand cumulative cross-POC 6ta evidencia
 *      matures (consumer return-shape verification axis NEW)
 *   3. evidence-supersedes-assumption-lock 10ma evidencia matures (assumed
 *      cutover complete via class→factory swap superseded por evidence
 *      runtime bug — atomic cutover requiere paired consumer adjustment)
 *   4. §13 RSC boundary serialization adapter retroactive aplicación 6ta
 *      evidencia matures (fiscal-periods 5ta → contacts retroactive 6ta)
 *   5. feedback/json-parse-stringify-cleanup-pending NEW canonical home 1ra
 *      evidencia DEFER scope (paired sister bug fix — defensive serialization
 *      pre-hex pattern cleanup pending)
 *
 * Architecture.md §19.12 contacts addendum doc-only commit verify retroactivo
 * fix bug RSC boundary serialization gap C4 (cutover incompleto detected
 * in-the-wild post-D1) — mini párrafo cross-ref engram NO §19.NEW append
 * §19.12.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

// POS — toSnapshot chain present (post-GREEN expectation)
// Matches `contactsService.{list,getById}(args).then(...c.toSnapshot()...)`
// REQUIRING `.then(` directly attached to the call's closing paren — prevents
// false positive cross-line match against sibling `.toSnapshot()` chains
// in same Promise.all (e.g. periodsService.list().then(p=>p.toSnapshot())).
const TO_SNAPSHOT_CHAIN_REGEX =
  /contactsService\.(?:list|getById)\([^)]*\)\.then\([\s\S]{0,200}?\.toSnapshot\(\)/;

// NEG — defensive serialization wrap absent (post-GREEN expectation drop).
// Matches `JSON.parse(JSON.stringify(contact*))` (covers `contacts` and
// `contactWithBalance` variants per A1-A10 inventory).
const JSON_WRAP_CONTACT_REGEX =
  /JSON\.parse\(JSON\.stringify\(contact[a-zA-Z]*\)\)/;

// Routes Categ A-bis — POS toSnapshot present in source (any chain).
// Routes use `Response.json(...)` wrap; toSnapshot must appear before each
// service call response is serialized.
const TO_SNAPSHOT_PRESENT_REGEX = /\.toSnapshot\(\)/;

// Routes Categ A-bis — NEG bare entity wrap in Response.json absent.
// Matches `Response.json(contact)` (single entity GET/PATCH/DELETE) or
// `Response.json({ contacts })` (list shorthand) — both serialize raw entity.
const RESPONSE_JSON_BARE_REGEX =
  /Response\.json\((?:contact[,)\s]|\{\s*contacts\s*\})/;

describe("POC correctivo contacts — RED textual gate hotfix cutover incompleto C4 RSC boundary serialization adapter retroactivo", () => {
  // ── Section A: 10 page.tsx production VALUE consumers RSC boundary ──

  // A1 sales/new/page.tsx (CRASH REPORTADO)
  it("Test 1: sales/new/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/new/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 2: sales/new/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/new/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A2 sales/[saleId]/page.tsx
  it("Test 3: sales/[saleId]/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 4: sales/[saleId]/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A3 payments/page.tsx
  it("Test 5: payments/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 6: payments/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A4 payments/[paymentId]/page.tsx
  it("Test 7: payments/[paymentId]/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 8: payments/[paymentId]/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A5 payments/new/page.tsx
  it("Test 9: payments/new/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/new/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 10: payments/new/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/new/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A6 accounting/contacts/[contactId]/page.tsx (getById + spread peor caso)
  it("Test 11: accounting/contacts/[contactId]/page.tsx contains toSnapshot chain post contactsService.getById call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 12: accounting/contacts/[contactId]/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A7 purchases/[purchaseId]/page.tsx
  it("Test 13: purchases/[purchaseId]/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 14: purchases/[purchaseId]/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A8 purchases/new/page.tsx
  it("Test 15: purchases/new/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/new/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 16: purchases/new/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/new/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A9 dispatches/[dispatchId]/page.tsx
  it("Test 17: dispatches/[dispatchId]/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 18: dispatches/[dispatchId]/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // A10 dispatches/new/page.tsx
  it("Test 19: dispatches/new/page.tsx contains toSnapshot chain post contactsService call (POS)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/new/page.tsx")).toMatch(TO_SNAPSHOT_CHAIN_REGEX);
  });
  it("Test 20: dispatches/new/page.tsx NO contains JSON.parse(JSON.stringify(contact*)) wrap (NEG)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/new/page.tsx")).not.toMatch(JSON_WRAP_CONTACT_REGEX);
  });

  // ── Section B: 2 route.ts API endpoints HTTP boundary ──

  // A11 app/api/organizations/[orgSlug]/contacts/route.ts (GET list + POST create)
  it("Test 21: contacts/route.ts contains toSnapshot present in Response.json wrap (POS)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/route.ts")).toMatch(TO_SNAPSHOT_PRESENT_REGEX);
  });
  it("Test 22: contacts/route.ts NO contains Response.json bare entity wrap (NEG)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/route.ts")).not.toMatch(RESPONSE_JSON_BARE_REGEX);
  });

  // A12 app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts (GET + PATCH + DELETE)
  it("Test 23: contacts/[contactId]/route.ts contains toSnapshot present in Response.json wrap (POS)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts")).toMatch(TO_SNAPSHOT_PRESENT_REGEX);
  });
  it("Test 24: contacts/[contactId]/route.ts NO contains Response.json bare entity wrap (NEG)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts")).not.toMatch(RESPONSE_JSON_BARE_REGEX);
  });
});
