/**
 * POC nuevo contacts C4-ter RED — 12 production VALUE consumers (10 page.tsx
 * server components + 2 route.ts API endpoints) cross-feature/cross-module
 * cumulative cutover legacy `ContactsService` class hex barrel re-export
 * Opción A → factory `makeContactsService()` pattern hex same barrel path +
 * 10 test vi.mock factory declarations cutover legacy `class ContactsService`
 * mock pattern → `makeContactsService` factory mock pattern (Marco lock B1
 * factory mock pattern alinea cutover NO class identity preserved mirror C5
 * GREEN precedent EXACT). Cementación VALUE-axis honest 44α explicit
 * pre-DROP línea 13 cumulative C4 GREEN single batch (Marco lock Opción A4
 * — C4-ter NEW RED + GREEN cumulative + retire C1 Tests 7-10 mismo C4-ter
 * GREEN commit mirror Tests 3-5 + Tests 6+12 + Test 14 retire precedent EXACT).
 *
 * Recon gap surfaced honest 3ra surface iterativa pre-GREEN commit Step 0
 * 9-axis classification falló cumulativo:
 *   - 1ra surface (C4 RED): grepé `features/contacts` paths only, 4 archivos
 *     features/* VALUE consumers invisibles (cementados C1 GREEN load-bearing).
 *   - 2da surface (C4-bis RED post-recon): clasificé features/* pero NO
 *     grepé class symbol PROJECT-scope, 12 production app/... + 10 vi.mock
 *     factory declarations invisibles.
 *   - 3ra surface (este commit C4-ter): vi.mock factory grep MANDATORY
 *     adicional 11mo axis recon Step 0 cumulative cross-POC.
 *
 * Lecciones NEW canonical home D1 cementación target (3 axis cumulative gap):
 *   1. `feedback/retirement-reinventory-gate-class-symbol-grep` 10mo axis —
 *      cuando wholesale delete + DROP re-export bridge, MANDATORY grep class
 *      symbol PROJECT-scope (NO solo path grep).
 *   2. `feedback/retirement-reinventory-gate-vimock-factory-grep` 11mo axis —
 *      MANDATORY grep vi.mock factory class declarations PROJECT-scope cuando
 *      mock factory cementaron legacy class identity (test mock pattern axis
 *      separado de production VALUE consumers axis).
 *   3. Step 0 expand REFINED 11 axes cumulative cross-POC future POCs.
 *
 * 12 production VALUE consumers FULL (NO type-only — `new ContactsService()`
 * instanciación + method calls server-side):
 *   Section A — 10 page.tsx server components:
 *     - app/(dashboard)/[orgSlug]/sales/new/page.tsx
 *     - app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx
 *     - app/(dashboard)/[orgSlug]/payments/page.tsx
 *     - app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx
 *     - app/(dashboard)/[orgSlug]/payments/new/page.tsx
 *     - app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx
 *     - app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx
 *     - app/(dashboard)/[orgSlug]/purchases/new/page.tsx
 *     - app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx
 *     - app/(dashboard)/[orgSlug]/dispatches/new/page.tsx
 *   Section B — 2 route.ts API endpoints:
 *     - app/api/organizations/[orgSlug]/contacts/route.ts
 *     - app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts
 *
 * 10 test vi.mock factory declarations (NO consumer real — fake class stub
 * para page render tests):
 *   Section C — 10 test mock factories:
 *     - app/(dashboard)/[orgSlug]/sales/new/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts
 *     - app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/payments/new/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/purchases/[purchaseId]/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/purchases/new/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts
 *     - app/(dashboard)/[orgSlug]/dispatches/new/__tests__/page-rbac.test.ts
 *
 * 44α single test file homogeneous granularity per archivo bisect-friendly:
 *   Section A — 10 page.tsx (10 POS hex factory + 10 NEG alternation = 20α)
 *   Section B — 2 route.ts (2 POS hex factory + 2 NEG alternation = 4α)
 *   Section C — 10 vi.mock factory declarations (10 POS makeContactsService
 *     factory mock + 10 NEG class ContactsService legacy mock = 20α)
 *
 * Cross-cycle-red-test-cementacion-gate verify CLEAN pre-RED este turno:
 * C4-ter scope NO overlap C4 RED (features/contacts/* delete + components
 * + ai-agent tests) NO overlap C4-bis RED (4 features/* VALUE consumers)
 * NO overlap D1 doc-only. C1 Tests 7-10 retire mismo C4-ter GREEN commit
 * (mirror Tests 3-5 retire C3-pre + Tests 6+12 retire C5-pre + Test 14
 * retire C4-pre precedent EXACT cumulative — gate funcionó forward).
 *
 * Test file location modules/contacts/presentation/__tests__/ — target hex
 * ownership mirror precedent c4 + c4-bis EXACT — self-contained future-proof.
 *
 * Expected failure mode pre-GREEN: 44/44 FAIL enumerated explicit per
 * feedback_red_acceptance_failure_mode (Section A POS T1/T3/T5/T7/T9/T11/
 * T13/T15/T17/T19 hex factory currently absent + NEG T2/T4/T6/T8/T10/T12/
 * T14/T16/T18/T20 legacy class import + new instanciación currently present
 * + Section B POS T21/T23 + NEG T22/T24 + Section C POS T25/T27/T29/T31/T33/
 * T35/T37/T39/T41/T43 makeContactsService mock currently absent + NEG T26/
 * T28/T30/T32/T34/T36/T38/T40/T42/T44 class ContactsService mock currently
 * present).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const FACTORY_IMPORT_REGEX =
  /^import \{ makeContactsService \} from "@\/modules\/contacts\/presentation\/server";$/m;
const LEGACY_VALUE_REGEX =
  /(?:import\s*\{\s*ContactsService\s*\}\s*from|new\s+ContactsService\s*\()/;
const FACTORY_MOCK_REGEX = /\bmakeContactsService\b/;
const LEGACY_MOCK_CLASS_REGEX = /\bclass\s+ContactsService\b/;

describe("POC nuevo contacts C4-ter — 12 production VALUE consumers + 10 vi.mock factory declarations cutover factory pattern hex", () => {
  // ── Section A: 10 page.tsx production VALUE consumers ──

  // sales/new/page.tsx
  it("Test 1: sales/new/page.tsx contains hex factory import (POSITIVE swap target post-cutover)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/new/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 2: sales/new/page.tsx NO contains legacy class import o new instanciación (NEGATIVE alternation drop)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/new/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // sales/[saleId]/page.tsx
  it("Test 3: sales/[saleId]/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 4: sales/[saleId]/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // payments/page.tsx
  it("Test 5: payments/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 6: payments/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // payments/[paymentId]/page.tsx
  it("Test 7: payments/[paymentId]/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 8: payments/[paymentId]/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // payments/new/page.tsx
  it("Test 9: payments/new/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/new/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 10: payments/new/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/new/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // accounting/contacts/[contactId]/page.tsx
  it("Test 11: accounting/contacts/[contactId]/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 12: accounting/contacts/[contactId]/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // purchases/[purchaseId]/page.tsx
  it("Test 13: purchases/[purchaseId]/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 14: purchases/[purchaseId]/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // purchases/new/page.tsx
  it("Test 15: purchases/new/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/new/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 16: purchases/new/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/new/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // dispatches/[dispatchId]/page.tsx
  it("Test 17: dispatches/[dispatchId]/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 18: dispatches/[dispatchId]/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // dispatches/new/page.tsx
  it("Test 19: dispatches/new/page.tsx contains hex factory import (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/new/page.tsx")).toMatch(FACTORY_IMPORT_REGEX);
  });
  it("Test 20: dispatches/new/page.tsx NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/new/page.tsx")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // ── Section B: 2 route.ts API endpoints ──

  // api/.../contacts/route.ts
  it("Test 21: api/.../contacts/route.ts contains hex factory import (POSITIVE)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/route.ts")).toMatch(/makeContactsService/);
  });
  it("Test 22: api/.../contacts/route.ts NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/route.ts")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // api/.../contacts/[contactId]/route.ts
  it("Test 23: api/.../contacts/[contactId]/route.ts contains hex factory import (POSITIVE)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts")).toMatch(/makeContactsService/);
  });
  it("Test 24: api/.../contacts/[contactId]/route.ts NO contains legacy class import o new instanciación (NEGATIVE)", () => {
    expect(read("app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts")).not.toMatch(LEGACY_VALUE_REGEX);
  });

  // ── Section C: 10 vi.mock factory declarations ──

  // sales/new/__tests__/page-rbac.test.ts
  it("Test 25: sales/new/page-rbac contains makeContactsService factory mock (POSITIVE Marco lock B1 mirror C5 precedent)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/new/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 26: sales/new/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/new/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // sales/[saleId]/__tests__/page-rbac.test.ts
  it("Test 27: sales/[saleId]/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 28: sales/[saleId]/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // payments/__tests__/page.test.ts
  it("Test 29: payments/page.test contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 30: payments/page.test NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // payments/[paymentId]/__tests__/page-rbac.test.ts
  it("Test 31: payments/[paymentId]/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 32: payments/[paymentId]/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // payments/new/__tests__/page-rbac.test.ts
  it("Test 33: payments/new/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/new/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 34: payments/new/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/payments/new/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // accounting/contacts/[contactId]/__tests__/page-rbac.test.ts
  it("Test 35: accounting/contacts/[contactId]/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 36: accounting/contacts/[contactId]/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // purchases/[purchaseId]/__tests__/page-rbac.test.ts
  it("Test 37: purchases/[purchaseId]/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 38: purchases/[purchaseId]/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // purchases/new/__tests__/page-rbac.test.ts
  it("Test 39: purchases/new/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/new/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 40: purchases/new/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/purchases/new/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // dispatches/[dispatchId]/__tests__/page-rbac.test.ts
  it("Test 41: dispatches/[dispatchId]/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 42: dispatches/[dispatchId]/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });

  // dispatches/new/__tests__/page-rbac.test.ts
  it("Test 43: dispatches/new/page-rbac contains makeContactsService factory mock (POSITIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/new/__tests__/page-rbac.test.ts")).toMatch(FACTORY_MOCK_REGEX);
  });
  it("Test 44: dispatches/new/page-rbac NO contains class ContactsService legacy mock (NEGATIVE)", () => {
    expect(read("app/(dashboard)/[orgSlug]/dispatches/new/__tests__/page-rbac.test.ts")).not.toMatch(LEGACY_MOCK_CLASS_REGEX);
  });
});
