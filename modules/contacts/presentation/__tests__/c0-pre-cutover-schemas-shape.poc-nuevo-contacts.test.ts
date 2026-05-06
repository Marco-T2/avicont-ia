/**
 * POC nuevo contacts C0-pre — barrel sub-import migration prerequisite cutover
 * schemas zod + DEEP path import migration `components/payments/payment-form.tsx`
 * §13.A5-ζ-prerequisite 3ra evidencia matures cumulative cross-POC (1ra paired
 * C7-pre + 2da payment C0-pre + 3ra contacts C0-pre).
 *
 * 3 paths cutover scope:
 *   - 2 api routes schemas zod barrel sub-import migration:
 *       app/api/organizations/[orgSlug]/contacts/route.ts (L7 createContactSchema + contactFiltersSchema)
 *       app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts (L4 updateContactSchema)
 *   - 1 client component DEEP path import migration:
 *       components/payments/payment-form.tsx (L29 PendingDocument from `@/features/contacts/contacts.types` DEEP)
 *
 * Marco lock final RED scope (6 assertions α distribución):
 *   - Tests 1-3 POSITIVE hex import present (per-file 1 import check):
 *       T1 api/contacts/route.ts schemas from `@/modules/contacts/presentation/server`
 *       T2 api/contacts/[contactId]/route.ts updateContactSchema from `@/modules/contacts/presentation/server`
 *       T3 payment-form.tsx PendingDocument from `@/modules/contact-balances/presentation/index` (isomorphic — client component "use client")
 *   - Tests 4-6 NEGATIVE legacy import absent (per-file):
 *       T4 api/contacts/route.ts NO `@/features/contacts` barrel sub-import
 *       T5 api/contacts/[contactId]/route.ts NO `@/features/contacts` barrel sub-import
 *       T6 payment-form.tsx NO `@/features/contacts/contacts.types` DEEP path
 *
 * §13 patterns aplicabilidad:
 *   - §13.A5-ζ-prerequisite barrel sub-import migration prerequisite to wholesale delete:
 *     3ra evidencia matures cumulative cross-POC — POC paired C7-pre 1ra + POC payment C0-pre 2da + POC contacts C0-pre 3ra. PendingDocument bit-exact shape verified hex `modules/contact-balances/application/contact-balances.service.ts:19-30` vs legacy `features/contacts/contacts.types.ts:60` — safe migration NO MATERIAL divergence.
 *
 * Expected RED failure mode pre-GREEN:
 * - T1-T3 FAIL: hex imports ausente.
 * - T4-T5 FAIL: schemas zod present import `@/features/contacts` barrel.
 * - T6 FAIL: DEEP path `@/features/contacts/contacts.types` present.
 * Total expected FAIL pre-GREEN: 6/6.
 *
 * Source-string assertion pattern: mirror precedent paired C7-pre + payment C0-pre EXACT.
 *
 * Cross-ref:
 *   - architecture.md §13.A5-ζ-prerequisite canonical home
 *   - engram arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration-prerequisite (1ra paired C7-pre)
 *   - engram poc-nuevo/payment/c0-pre/closed (2da evidencia)
 *   - modules/contacts/presentation/server.ts (hex barrel server-side schemas re-export)
 *   - modules/contact-balances/presentation/index.ts (hex isomorphic barrel PendingDocument)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const ROUTE_CONTACTS = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/route.ts",
);
const ROUTE_CONTACTS_BY_ID = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/route.ts",
);
const PAYMENT_FORM = path.join(
  REPO_ROOT,
  "components/payments/payment-form.tsx",
);

const HEX_CONTACTS_SERVER_RE =
  /from\s*["']@\/modules\/contacts\/presentation\/server["']/;
const HEX_CONTACT_BALANCES_INDEX_RE =
  /from\s*["']@\/modules\/contact-balances\/presentation\/index["']/;
const LEGACY_FEATURES_CONTACTS_BARREL_RE =
  /from\s*["']@\/features\/contacts(?:\/[^"'/]+)?["']/;
const LEGACY_FEATURES_CONTACTS_TYPES_DEEP_RE =
  /from\s*["']@\/features\/contacts\/contacts\.types["']/;

describe("POC nuevo contacts C0-pre — barrel sub-import migration prerequisite + DEEP path migration", () => {
  // POSITIVE hex import present (Tests 1-3) ─────────────────────────────────

  it("Test 1: api/contacts/route.ts imports schemas zod from hex presentation/server", () => {
    const source = fs.readFileSync(ROUTE_CONTACTS, "utf8");
    expect(source).toMatch(HEX_CONTACTS_SERVER_RE);
  });

  it("Test 2: api/contacts/[contactId]/route.ts imports updateContactSchema from hex presentation/server", () => {
    const source = fs.readFileSync(ROUTE_CONTACTS_BY_ID, "utf8");
    expect(source).toMatch(HEX_CONTACTS_SERVER_RE);
  });

  it("Test 3: payment-form.tsx imports PendingDocument from hex contact-balances isomorphic barrel (client component safe)", () => {
    const source = fs.readFileSync(PAYMENT_FORM, "utf8");
    expect(source).toMatch(HEX_CONTACT_BALANCES_INDEX_RE);
  });

  // NEGATIVE legacy import absent (Tests 4-6) ───────────────────────────────

  it("Test 4: api/contacts/route.ts does NOT import from legacy @/features/contacts barrel sub-import", () => {
    const source = fs.readFileSync(ROUTE_CONTACTS, "utf8");
    // Filter out @/features/contacts/server (ContactsService class — separate cycle C1)
    const lines = source.split("\n").filter((l) => !/@\/features\/contacts\/server/.test(l));
    const filtered = lines.join("\n");
    expect(filtered).not.toMatch(LEGACY_FEATURES_CONTACTS_BARREL_RE);
  });

  it("Test 5: api/contacts/[contactId]/route.ts does NOT import from legacy @/features/contacts barrel sub-import", () => {
    const source = fs.readFileSync(ROUTE_CONTACTS_BY_ID, "utf8");
    const lines = source.split("\n").filter((l) => !/@\/features\/contacts\/server/.test(l));
    const filtered = lines.join("\n");
    expect(filtered).not.toMatch(LEGACY_FEATURES_CONTACTS_BARREL_RE);
  });

  it("Test 6: payment-form.tsx does NOT import from DEEP path @/features/contacts/contacts.types", () => {
    const source = fs.readFileSync(PAYMENT_FORM, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_CONTACTS_TYPES_DEEP_RE);
  });
});
