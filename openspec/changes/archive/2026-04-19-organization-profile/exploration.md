# Exploration: organization-profile

_Generated: 2026-04-19 | Phase: sdd-explore | Artifact store: hybrid_

---

## Summary

- **No company identity fields exist yet**: `OrgSettings` holds only accounting account codes and numeric thresholds — zero business identity data (NIT, address, phone, personnel, directives, receipt footer). All 20 profile fields are completely absent.
- **PDF generation exists only for Balance General and Estado de Resultados** (via `pdfmake`). No voucher, dispatch, sale, purchase, payment, or cobros/pagos document has any PDF or print rendering — those are exclusively server-side API routes returning JSON or next.js pages.
- **The signature-per-document-type feature is net-new with no existing foundation** — no `DocumentType` discriminated union, no signature config table, no print routes for operational documents.

---

## Current State

### Data Model

#### `Organization` model (`prisma/schema.prisma` lines 13–46)
Fields: `id`, `clerkOrgId`, `name`, `slug`, `createdAt` + all relational arrays.
- `name` and `slug` exist and are synced from Clerk at org creation.
- No business identity fields: no NIT, address, phone, personnel names, etc.

#### `OrgSettings` model (`prisma/schema.prisma` lines 626–646)
Fields (all are accounting account codes or numeric params):
- `cajaGeneralAccountCode`, `bancoAccountCode`, `cxcAccountCode`, `cxpAccountCode`
- `roundingThreshold`, `cashParentCode`, `pettyCashParentCode`, `bankParentCode`
- `fleteExpenseAccountCode`, `polloFaenadoCOGSAccountCode`
- `itExpenseAccountCode`, `itPayableAccountCode`

**Nothing related to company identity, personnel, directives, or PDF signatures.**

### Settings UI (`/settings/general`)

- Page: `app/(dashboard)/[orgSlug]/settings/general/page.tsx`
- Form component: `components/settings/org-settings-form.tsx`
- API route: `app/api/organizations/[orgSlug]/settings/route.ts`
- Service: `features/org-settings/org-settings.service.ts`
- Repository: `features/org-settings/org-settings.repository.ts`
- Validation: `features/org-settings/org-settings.validation.ts`

Architecture: **pure REST + fetch** (no React Hook Form, no Zod on client). The form uses uncontrolled `useState` per field and calls `PATCH /api/organizations/{orgSlug}/settings` directly. No server actions in use here.

Settings hub at `/settings/page.tsx` lists 7 cards. Adding "Perfil de Empresa" would be an 8th card → new route `/settings/company`.

### PDF Rendering

PDF library: **`pdfmake`** (confirmed in `package.json` and imports).
Location: `features/accounting/financial-statements/exporters/`

| Document Type | Renderer | Status |
|---|---|---|
| Balance General | `pdf.exporter.ts` → `exportBalanceSheetPdf()` | DONE |
| Estado de Resultados | `pdf.exporter.ts` → `exportIncomeStatementPdf()` | DONE |

The exporters receive `orgName: string` as a plain parameter — currently sourced from `orgSlug` (the URL slug, not the company name). This means the PDF headers currently display the slug, not the full business name (this is an existing limitation that `organization-profile` would fix).

No other document types have any PDF rendering. The following are JSON-only + page-rendered:

| Document Type | API Route | PDF Status |
|---|---|---|
| Comprobantes (vouchers) | `/api/…/journal` | NOT IMPLEMENTED |
| Despachos | `/api/…/dispatches` | NOT IMPLEMENTED |
| Ventas | `/api/…/sales` | NOT IMPLEMENTED |
| Compras | `/api/…/purchases` | NOT IMPLEMENTED |
| Cobros/Pagos | `/api/…/payments` | NOT IMPLEMENTED |
| Libros IVA | `/api/…/iva-books` | NOT IMPLEMENTED |

No `/print/` routes, no `window.print`, no print-specific CSS found anywhere.

### RBAC — `accounting-config` resource

Confirmed in `features/shared/permissions.ts`:
- `accounting-config` read: `["owner", "admin"]`
- `accounting-config` write: `["owner", "admin"]`

Currently guards: accounts, periods, voucher-types, product-types, operational-doc-types, org-settings, the general settings page, and roles. All are "accounting infrastructure" — appropriate for company profile too.

The `/settings/general` page uses `requirePermission("accounting-config", "write", orgSlug)` (write, not read). The settings hub uses `read`. New company profile page should follow the write pattern since it is a configuration action.

### Document Type Identifiers

No canonical `DocumentType` enum or discriminated union exists. The closest:
- `VoucherTypeCfg` — user-defined voucher types with `code` + `prefix` (from DB table `voucher_types`)
- `OperationalDocType` — user-defined operational doc types with `code` + `direction` (COBRO/PAGO/BOTH)
- `PurchaseType` enum: `FLETE | POLLO_FAENADO | COMPRA_GENERAL | SERVICIO`
- `DispatchType` enum: `NOTA_DESPACHO | BOLETA_CERRADA`

There is NO fixed list of printable document categories. For signature config we need to define a new enum.

---

## Gaps

### Schema gaps
1. **20 company identity fields** — entirely missing from `OrgSettings` (or anywhere).
2. **`OrganizationDirective` table** — does not exist; directives block (0..N names + labels) has no schema.
3. **`DocumentSignatureConfig` table** — does not exist; no per-document-type signer configuration anywhere.
4. **`OrgProfile` model** — does not exist as a dedicated model.

### Service / API gaps
5. No `OrgProfileService` / `OrgProfileRepository`.
6. No API route for company profile CRUD.
7. No API route for directive CRUD.
8. No API route for signature config CRUD.

### UI gaps
9. No `/settings/company` page.
10. No "Perfil de Empresa" card in settings hub.
11. No directives list editor component.
12. No signature config editor component.

### PDF gaps
13. EEFF PDFs use `orgSlug` as org name (a bug this change will fix).
14. No PDF renderer for any operational document.
15. No PDF renderer that reads signature config from DB.

---

## PDF Consumer Inventory

| Document Type | Route (API or page) | Current Renderer | PDF Status |
|---|---|---|---|
| Balance General | `GET /api/…/financial-statements/balance-sheet?format=pdf` | `pdf.exporter.ts:exportBalanceSheetPdf` | DONE (no signature) |
| Estado de Resultados | `GET /api/…/financial-statements/income-statement?format=pdf` | `pdf.exporter.ts:exportIncomeStatementPdf` | DONE (no signature) |
| Comprobante (voucher) | `app/(dashboard)/[orgSlug]/accounting/…` | None | NOT IMPLEMENTED |
| Despacho | `app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx` | None | NOT IMPLEMENTED |
| Venta | `app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx` | None | NOT IMPLEMENTED |
| Compra | `app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx` | None | NOT IMPLEMENTED |
| Cobro/Pago | `app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx` | None | NOT IMPLEMENTED |

**Key insight**: Implementing PDF for operational documents (Comprobante, Despacho, Venta, Compra, Cobro/Pago) is a **large separate effort** — it requires designing renderers for each document type. The `organization-profile` change should focus on: (a) storing company profile + directives + signature config, and (b) exposing them via a service so future PDF renderers can consume them. The only existing PDFs (EEFF) should be upgraded to use `razonSocial` instead of `orgSlug`.

---

## Schema Alternatives

### A. Company Identity Fields — Where to store?

#### Alt A1: Extend `OrgSettings` with 20 new columns
- **Pro**: One table, one PATCH endpoint, compatible with existing service/repo patterns.
- **Con**: `OrgSettings` is already accounting-centric; mixing business identity creates a god table. Harder to separate concerns in future (e.g. making identity public-facing).
- **Verdict**: Acceptable for MVP given small team, but semantically wrong.

#### Alt A2: New `OrgProfile` model (1:1 with Organization)
- **Pro**: Clean separation — accounting config stays in `OrgSettings`, identity goes in `OrgProfile`. Each has its own service/repo/route. Easy to extend independently.
- **Con**: Two tables to maintain, slightly more boilerplate.
- **Verdict**: RECOMMENDED. Follows the existing `OrgSettings` 1:1 pattern. `OrgProfile` would be the home for NIT, address, phones, personnel, directive block labels, receipt footer — all the "printed document header" data.

#### Alt A3: JSON column on `OrgSettings`
- **Pro**: Zero migration risk, maximum flexibility.
- **Con**: Untyped, no Prisma validation, hard to query/filter individual fields, breaks the repo pattern.
- **Verdict**: REJECTED. Against the project's typed-field convention.

**Recommendation: Alt A2** — new `OrgProfile` model.

### B. Directives (0..N names) — How to store?

#### Alt B1: Relational table `OrganizationDirective(orgId, name, sortOrder)`
- **Pro**: Proper normalization. Easy to add, remove, reorder. Prisma cascade delete. Can add metadata per directive (title, position) in future.
- **Con**: Requires join on every profile fetch. More migration + CRUD code.
- **Verdict**: RECOMMENDED for 0..N with ordering semantics.

#### Alt B2: JSON array on `OrgProfile.directives`
- **Pro**: Zero extra table, simple PATCH with full replacement.
- **Con**: No individual-row addressing. Can't enforce uniqueness. Harder to diff for audit. Loss of type safety at DB level.
- **Verdict**: Acceptable but weaker. Prefer Alt B1.

**Recommendation: Alt B1** — `OrganizationDirective` relational table with `(organizationId, name, sortOrder)`.

### C. Signature Config (per document type, which signers appear) — How to store?

Signer roles to support: `propietario`, `contador`, `auxiliar`, `directive` (index-based from directives list).

#### Alt C1: JSON column on `OrgProfile` (e.g. `signatureConfig Json?`)
```json
{
  "balance_general": ["propietario", "contador"],
  "comprobante": ["contador", "auxiliar"],
  ...
}
```
- **Pro**: Fastest to ship. Single PATCH. No extra migration.
- **Con**: Untyped at DB level. No FK integrity on signer roles. Hard to validate with Prisma. Schema evolution is opaque.
- **Verdict**: Acceptable for MVP, carries tech debt.

#### Alt C2: New table `DocumentSignatureConfig(orgId, documentType, signerRoles String[])`
```
(orgId, documentType) unique
signerRoles: String[] -- ["propietario", "contador"]
```
- **Pro**: One row per document type. Queryable. Type-safe enum for documentType. Clear upsert semantics.
- **Con**: Requires defining `DocumentPrintType` enum (new). Extra migration.
- **Verdict**: RECOMMENDED. Clean, consistent with project patterns. The `@@unique([organizationId, documentType])` upsert pattern is already used elsewhere.

#### Alt C3: Normalized join table `DocumentSignatureConfig × DocumentSignatureSlot`
```
DocumentSignatureConfig(orgId, documentType) → id
DocumentSignatureSlot(configId, signerRole, sortOrder)
```
- **Pro**: Maximum normalization. Sortable slots.
- **Con**: Two tables for what is a simple ordered list. Over-engineered for 5–7 doc types × 4 signer roles.
- **Verdict**: REJECTED. Overkill.

**Recommendation: Alt C2** — `DocumentSignatureConfig` table with `documentType` enum + `signerRoles String[]`.

The `DocumentPrintType` enum to define:
```
BALANCE_GENERAL
ESTADO_RESULTADOS
COMPROBANTE
DESPACHO
VENTA
COMPRA
COBRO_PAGO
```

---

## UI Placement Recommendation

**Create a new `/settings/company` page** — do NOT extend `/settings/general`.

Rationale:
1. `/settings/general` is scoped to "Cuentas contables y parámetros" — its heading, description, and form sections all speak to accounting config. Mixing company identity here creates a misleading UI.
2. The settings hub already uses a card-per-section pattern. Adding an 8th card ("Perfil de Empresa") is natural and consistent.
3. The form will have 4 clearly distinct sections: (1) Identidad, (2) Personal, (3) Directivos, (4) Pie de recibo + Config de Firmas. These merit their own page.
4. The directive list needs a dynamic CRUD editor (add/remove/reorder rows) — this is a non-trivial component that doesn't belong alongside account code inputs.

**Page architecture**:
- Route: `app/(dashboard)/[orgSlug]/settings/company/page.tsx`
- Permission: `requirePermission("accounting-config", "write", orgSlug)` (matches general pattern)
- New card in settings hub with title "Perfil de Empresa" and description "Datos de la empresa para documentos impresos".
- Form: client component, same REST + fetch pattern as `OrgSettingsForm`, or optionally React Hook Form + Zod for the more complex directive list.

---

## Permission Recommendation

**Reuse `accounting-config:write`** — confirmed correct.

Evidence:
- All settings management (periods, voucher-types, product-types, operational-doc-types, accounts, org-settings) is already behind `accounting-config:write`.
- The resource label is "Config. contable" (`lib/settings/resource-labels.ts:5`).
- Allowed roles: `["owner", "admin"]` for both read and write — appropriate; only org owners/admins should configure company identity for printed documents.
- No new RBAC resource needed.

---

## Open Questions for Proposal Phase

1. **`OrgProfile` vs extending `OrgSettings`**: Proposal should confirm the decision to create a new `OrgProfile` model. This has downstream implications for the settings API route structure (`/api/organizations/[orgSlug]/profile` vs `/api/organizations/[orgSlug]/settings`).

2. **Directive label scope**: The "DIRECTIVOS:" and "SRES." labels — are they stored on `OrgProfile` (as `directivesTitle1`, `directivesTitle2` scalar fields) or as part of the directive table itself? Likely on `OrgProfile` since they are org-wide headings, not per-directive.

3. **EEFF orgName fix scope**: Should the proposal include fixing `exportBalanceSheetPdf`/`exportIncomeStatementPdf` to fetch `OrgProfile.razonSocial` instead of using `orgSlug`? This is a related bugfix. Recommendation: yes, include it — it is trivial once `OrgProfile` exists and it makes the PDF feature correct.

4. **PDF renderers for operational docs (Despacho, Venta, etc.)**: The user scoped signature config for these doc types, but the renderers do not exist. Should this change only store the config (future-ready) or also implement the renderers? Recommendation: store config now, defer renderers to a dedicated change (large effort). Proposal should clarify scope explicitly.

5. **Directive sort order UX**: Should directive reordering be drag-and-drop (complex) or up/down buttons (simple)? The relational table supports both via `sortOrder`. Proposal should pick a UI approach.

6. **`itExpenseAccountCode` + `itPayableAccountCode`**: These two fields exist in `OrgSettings` DB schema but are NOT exposed in the form or validation. Should they be added to the general settings form, or is this out of scope? (Out of scope for this change, but noting as a gap.)

7. **Telefono field**: Is it one phone field or two (telefono principal + alternativo)? The scope says "Teléfonos" (plural). Clarify before spec phase.

---

## skill_resolution

`injected` — compact rules were provided in this prompt (Next.js 16.2.1, Prisma 7.5.0 generated client, Clerk multi-tenant auth, RBAC via `requirePermission`, Strict TDD Mode active).
