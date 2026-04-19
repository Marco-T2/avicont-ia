# Tasks: organization-profile

This task list implements the **organization-profile** change end-to-end in Strict TDD order (RED → GREEN per unit). It is grounded in [spec.md](specs/organization-profile/spec.md) (10 REQs, 28 scenarios) and [design.md](design.md) (38 files, 14 architectural decisions). Every task references the REQ(s) it satisfies and the exact file(s) it touches. Execute batches in order; each batch is independently shippable.

---

### PR1 — Prisma schema + migration + generated types

- [x] T1.1 (RED) Write migration smoke test asserting `org_profile` table, `document_signature_config` table, `SignatureLabel` enum, and `DocumentPrintType` enum all exist after migration (REQ-OP.1, REQ-OP.4) — `prisma/__tests__/migration-smoke.test.ts`
- [x] T1.2 (GREEN) Add `SignatureLabel` enum (7 values) and `DocumentPrintType` enum (8 values) to schema (REQ-OP.1, REQ-OP.4) — `prisma/schema.prisma`
- [x] T1.3 (GREEN) Add `OrgProfile` model and `DocumentSignatureConfig` model with correct fields, unique constraints, indexes, and FK relations; add `profile OrgProfile?` and `documentSignatureConfigs DocumentSignatureConfig[]` on `Organization` (REQ-OP.1, REQ-OP.4, REQ-OP.7) — `prisma/schema.prisma`
- [x] T1.4 (GREEN) Run `prisma migrate dev --name add_organization_profile`; confirm SQL creates 2 enums + 2 tables with no INSERT statements (REQ-OP.1, REQ-OP.4) — `prisma/migrations/<ts>_add_organization_profile/migration.sql`
- [x] T1.5 Regenerate Prisma client; verify `OrgProfile`, `DocumentSignatureConfig`, `SignatureLabel`, `DocumentPrintType` are exported from `generated/prisma/` — `generated/prisma/`

---

### PR2 — Types + validation layer

- [x] T2.1 (RED) Write validation unit tests: `updateOrgProfileSchema` passes valid partial; rejects whitespace-only `razonSocial`; rejects `direccion` > 300 chars; rejects `logoUrl: "not-a-url"` (REQ-OP.2) — `features/org-profile/org-profile.validation.test.ts`
- [x] T2.2 (GREEN) Create `features/org-profile/org-profile.types.ts` with `UpdateOrgProfileInput`; create `features/org-profile/org-profile.validation.ts` with `updateOrgProfileSchema` and `logoUploadConstraints` (REQ-OP.2, REQ-OP.3) — `features/org-profile/org-profile.types.ts`, `features/org-profile/org-profile.validation.ts`
- [x] T2.3 (RED) Write validation unit tests: valid config with 3 ordered labels passes; duplicate labels rejected; unknown enum `FACTURA` rejected; empty `labels` passes; label order is preserved exactly as submitted (REQ-OP.5) — `features/document-signature-config/document-signature-config.validation.test.ts`
- [x] T2.4 (GREEN) Create `features/document-signature-config/document-signature-config.types.ts` with `UpdateSignatureConfigInput` and `DocumentSignatureConfigView`; create `features/document-signature-config/document-signature-config.validation.ts` with `updateSignatureConfigSchema`, `signatureLabelEnum`, `documentPrintTypeEnum` (REQ-OP.5) — `features/document-signature-config/document-signature-config.types.ts`, `features/document-signature-config/document-signature-config.validation.ts`
- [x] T2.5 Create `lib/document-print-type-labels.ts` with human-readable label maps for `DocumentPrintType` and `SignatureLabel` (REQ-OP.10) — `lib/document-print-type-labels.ts`
- [x] T2.6 Create barrel `features/org-profile/index.ts` and `features/document-signature-config/index.ts` — `features/org-profile/index.ts`, `features/document-signature-config/index.ts`

---

### PR3 — Repository layer

- [x] T3.1 (RED) Write repo unit tests (DI mock PrismaClient via `BaseRepository(db)`): `findByOrgId` scopes query to `orgId`; `create(orgId)` inserts all-defaults row; `update(orgId, patch)` only sets provided fields; no unscoped query overload exists (REQ-OP.1, REQ-OP.7) — `features/org-profile/org-profile.repository.test.ts`
- [x] T3.2 (GREEN) Create `OrgProfileRepository extends BaseRepository` with `findByOrgId(orgId)`, `create(orgId)`, `update(orgId, data)` — every method's first param is `orgId: string` (REQ-OP.1, REQ-OP.7) — `features/org-profile/org-profile.repository.ts`
- [x] T3.3 (RED) Write repo unit tests: `findMany(orgId)` returns only rows for that org; `findOne(orgId, docType)` scopes correctly; `upsert(orgId, docType, data)` uses composite unique key; label array order is preserved in returned row (REQ-OP.4, REQ-OP.7) — `features/document-signature-config/document-signature-config.repository.test.ts`
- [x] T3.4 (GREEN) Create `DocumentSignatureConfigRepository extends BaseRepository` with `findMany(orgId)`, `findOne(orgId, docType)`, `upsert(orgId, docType, data)` — every method's first param is `orgId: string` (REQ-OP.4, REQ-OP.7) — `features/document-signature-config/document-signature-config.repository.ts`

---

### PR4 — Service layer

- [x] T4.1 (RED) Write service unit tests (mock repo via DI): `getOrCreate` returns existing row without calling `create`; calls `repo.create` when `findByOrgId` returns `null`; second call returns same row (no double insert); `updateLogo` calls `update` with new URL then best-effort `deleteLogoBlob`; `deleteLogoBlob` swallows errors and never throws (REQ-OP.1) — `features/org-profile/org-profile.service.test.ts`
- [x] T4.2 (GREEN) Create `OrgProfileService` with `getOrCreate(orgId)`, `update(orgId, patch)`, `updateLogo(orgId, newUrl)`, `deleteLogoBlob(url)` — DI constructor accepts optional repo; `update` calls `getOrCreate` first (REQ-OP.1, REQ-OP.3) — `features/org-profile/org-profile.service.ts`
- [x] T4.3 (RED) Write service unit tests: `listAll(orgId)` always returns 8 views (missing rows → `{ labels: [], showReceiverRow: false }`); `getOrDefault` never calls `upsert`; `upsert(orgId, docType, patch)` delegates to repo and returns updated row (REQ-OP.4) — `features/document-signature-config/document-signature-config.service.test.ts`
- [x] T4.4 (GREEN) Create `DocumentSignatureConfigService` with `listAll(orgId)`, `getOrDefault(orgId, docType)`, `upsert(orgId, docType, patch)` — missing configs return default shape without DB insert (REQ-OP.4) — `features/document-signature-config/document-signature-config.service.ts`

---

### PR5 — API routes

- [x] T5.1 (RED) Write route tests for `GET /api/organizations/[orgSlug]/profile` and `PATCH /api/organizations/[orgSlug]/profile`: 403 without permission; 400 on zod failure with `fieldErrors`; 200 returns updated profile; cross-org `orgId` blocked (REQ-OP.1, REQ-OP.2, REQ-OP.6) — `app/api/organizations/[orgSlug]/profile/route.test.ts`
- [x] T5.2 (GREEN) Create profile route with `GET` (`getOrCreate`) and `PATCH` (`zod parse → service.update`); guard both handlers with `requirePermission("accounting-config", "write", orgSlug)` (REQ-OP.1, REQ-OP.2, REQ-OP.6, REQ-OP.7) — `app/api/organizations/[orgSlug]/profile/route.ts`
- [x] T5.3 (RED) Write route tests for `POST /api/organizations/[orgSlug]/profile/logo`: 400 on wrong MIME; 400 on oversize file; 200 returns `{ url }` on valid upload; 403 for non-admin (REQ-OP.3, REQ-OP.6) — `app/api/organizations/[orgSlug]/profile/logo/route.test.ts`
- [x] T5.4 (GREEN) Create logo upload route; validate MIME against `logoUploadConstraints.allowedMimes` and size against `logoUploadConstraints.maxBytes` before calling `put()`; return `{ url }`; guard with `requirePermission` (REQ-OP.3, REQ-OP.6) — `app/api/organizations/[orgSlug]/profile/logo/route.ts`
- [x] T5.5 (RED) Write route tests for `GET /api/organizations/[orgSlug]/signature-configs`: 200 returns exactly 8 views; 403 for non-admin (REQ-OP.4, REQ-OP.6) — `app/api/organizations/[orgSlug]/signature-configs/route.test.ts`
- [x] T5.6 (GREEN) Create signature-configs list route with `GET` (`service.listAll`); guard with `requirePermission` (REQ-OP.4, REQ-OP.6) — `app/api/organizations/[orgSlug]/signature-configs/route.ts`
- [x] T5.7 (RED) Write route tests for `PATCH /api/organizations/[orgSlug]/signature-configs/[documentType]`: 200 on valid upsert; 400 on duplicate labels; 400 on unknown `documentType` enum; 403 for non-admin (REQ-OP.4, REQ-OP.5, REQ-OP.6) — `app/api/organizations/[orgSlug]/signature-configs/[documentType]/route.test.ts`
- [x] T5.8 (GREEN) Create per-docType signature-config route with `PATCH` (`zod parse → service.upsert`); validate `documentType` path param against `documentPrintTypeEnum`; guard with `requirePermission`; `params: Promise<{ orgSlug: string, documentType: string }>` per Next.js 16 convention (REQ-OP.4, REQ-OP.5, REQ-OP.6) — `app/api/organizations/[orgSlug]/signature-configs/[documentType]/route.ts`

---

### PR6 — UI components

- [x] T6.1 (RED) Write component test for `LabelPicker`: clicking down-arrow on first label reorders local state `["ELABORADO","APROBADO"]` → `["APROBADO","ELABORADO"]`; clicking `×` removes label from list; "Agregar" dropdown adds a previously absent label; already-selected labels are absent from the "Agregar" options (REQ-OP.10) — `components/settings/company/label-picker.test.tsx`
- [x] T6.2 (GREEN) Create `LabelPicker` component: ordered label list with ↑ / ↓ buttons; inline × remove; dropdown for remaining labels; `showReceiverRow` checkbox; fires `onChange` on every state change (REQ-OP.10) — `components/settings/company/label-picker.tsx`
- [x] T6.3 Create `DocTypeDropdown` component: shadcn `Select` with 8 human-readable `DocumentPrintType` options from `lib/document-print-type-labels.ts` (REQ-OP.10) — `components/settings/company/doc-type-dropdown.tsx`
- [x] T6.4 Create `SignatureConfigEditor` component: receives `docType`, current view, `onChange`, `onSave`; renders `LabelPicker` + per-section Guardar button (REQ-OP.10) — `components/settings/company/signature-config-editor.tsx`
- [x] T6.5 Create `IdentitySection` component: text inputs for `razonSocial`, `nit`, `direccion`, `ciudad`, `telefono`, `nroPatronal`; inline field errors; per-section Guardar button (REQ-OP.2, REQ-OP.10) — `components/settings/company/identity-section.tsx`
- [x] T6.6 Create `LogoUploader` component: file input (MIME `accept` attribute); on file-select POSTs multipart to `/profile/logo`; writes returned URL into parent state via `onLogoChange`; preview `<img>`; 400 error shown inline (REQ-OP.3, REQ-OP.10) — `components/settings/company/logo-uploader.tsx`
- [x] T6.7 (RED) Write component test for `CompanyProfileForm`: saving Identidad only PATCHes `/profile` (not signature-configs); on 400 response renders `fieldErrors` under the correct inputs; on 200 calls `router.refresh()` and fires `toast.success` (REQ-OP.10) — `components/settings/company-profile-form.test.tsx`
- [x] T6.8 (GREEN) Create `CompanyProfileForm` (`"use client"`): holds `useState` for `profile` and `configs`; composes `IdentitySection`, `LogoUploader`, `DocTypeDropdown`, `SignatureConfigEditor`; per-section PATCH fetch; `toast.success`/`toast.error` via sonner; `router.refresh()` on success (REQ-OP.1, REQ-OP.3, REQ-OP.4, REQ-OP.10) — `components/settings/company-profile-form.tsx`

---

### PR7 — RSC page + settings hub

- [x] T7.1 (RED) Write component test asserting settings hub renders 8 cards when user has `accounting-config:read`; 8th card has title "Perfil de Empresa" and `href` matching `/${orgSlug}/settings/company` (REQ-OP.8) — update existing hub test or add assertions to `app/(dashboard)/[orgSlug]/settings/page.test.tsx`
- [x] T7.2 (GREEN) Add 8th entry to `SETTINGS_CARDS` in settings hub: `{ id: "company", title: "Perfil de Empresa", description: "...", href: (orgSlug) => \`/${orgSlug}/settings/company\`, Icon: Building2 }`; add `Building2` to the lucide import (REQ-OP.8) — `app/(dashboard)/[orgSlug]/settings/page.tsx`
- [x] T7.3 Create RSC page `app/(dashboard)/[orgSlug]/settings/company/page.tsx`: signature `{ params: Promise<{ orgSlug: string }> }`; call `requirePermission("accounting-config", "write", orgSlug)` first; on throw → `redirect(\`/${orgSlug}\`)`; hydrate `OrgProfile` via `OrgProfileService.getOrCreate(orgId)` and 8 views via `DocumentSignatureConfigService.listAll(orgId)`; pass both as props to `<CompanyProfileForm>` (REQ-OP.6, REQ-OP.9) — `app/(dashboard)/[orgSlug]/settings/company/page.tsx`

---

### PR8 — Finalization gate

- [x] T8.1 Run `tsc --noEmit` — must exit 0 (all 38 files type-check cleanly)
- [x] T8.2 Run `vitest run` — all tests pass (baseline 1723 + new tests from this change) — final: 1828 passed
- [x] T8.3 `grep -r "OrgProfile" prisma/schema.prisma` returns the model block
- [x] T8.4 `grep -r "DocumentSignatureConfig" prisma/schema.prisma` returns the model block
- [x] T8.5 `grep -r "requirePermission" app/api/organizations/\[orgSlug\]/profile/` returns hits — RBAC present on all new profile routes
- [x] T8.6 `grep -r "requirePermission" app/api/organizations/\[orgSlug\]/signature-configs/` returns hits — RBAC present on all signature-config routes
- [x] T8.7 Settings hub component test asserts exactly 8 cards render for admin user (REQ-OP.8)
