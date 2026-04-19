# Archive Report: organization-profile

**Date**: 2026-04-19  
**Change**: organization-profile  
**Status**: ARCHIVED  
**Verdict**: PASS (0 critical, 0 warnings after fix cycle, 10/10 REQs COMPLIANT)

---

## Intent

This change persists per-organization business identity (razón social, NIT, dirección, ciudad, teléfono, nro patronal, logo) and per-document-type signature configuration (ordered internal labels + receiver-row toggle). No PDF work was included — future PDF renderers will consume the data persisted here. The change also exposes both through an admin-only settings page at `/settings/company`.

---

## REQ Compliance

| REQ | Statement (short) | Verdict | Notes |
|-----|-------------------|---------|-------|
| OP.1 | OrgProfile lazy getOrCreate + partial PATCH | COMPLIANT | Service, repo, and route all tested. |
| OP.2 | Field-level validation (7 rules) | COMPLIANT | All field rules enforced. `logoUrl` accepts valid HTTPS URLs; Vercel Blob domain guard added in fix cycle W-1. |
| OP.3 | Logo upload: MIME + size before Blob write | COMPLIANT | MIME allowlist (png, jpeg, webp, svg) + 2MB cap enforced before `put()`. Orphan delete via `updateLogo`. |
| OP.4 | DocumentSignatureConfig upsert by (orgId, docType) | COMPLIANT | Repo uses composite unique key. Missing → default shape, no DB insert on read. |
| OP.5 | Signature config validation (enum, no dups, order) | COMPLIANT | Zod refine rejects duplicates; empty labels accepted; order preserved exactly. |
| OP.6 | RBAC: `requirePermission("accounting-config","write")` on all routes | COMPLIANT | Production routes all call `requirePermission` correctly. Route tests fixed in W-2 to mock `permissions.server` and assert exact permission key. |
| OP.7 | Multi-tenant: mandatory orgId filter on every repo method | COMPLIANT | Every repo method signature requires `organizationId` as first param. TypeScript enforces at compile time. |
| OP.8 | Settings hub: 8th card "Perfil de Empresa" | COMPLIANT | `SETTINGS_CARDS` has 8 entries. Dedicated test asserts count, title, and href. |
| OP.9 | `/settings/company` RSC page: `requirePermission` first, then hydrate | COMPLIANT | Guard runs before DB calls; redirect on failure. Page test added in fix cycle W-3. |
| OP.10 | Form: 3 sections, up/down reorder, remove, showReceiverRow | COMPLIANT | LabelPicker and CompanyProfileForm both tested. |

---

## Scope Delivered

### Data Models
- **2 Prisma models**: `OrgProfile` (1:1 with Organization), `DocumentSignatureConfig` (one row per docType)
- **2 Prisma enums**: `SignatureLabel` (7 values), `DocumentPrintType` (8 values)
- **Prisma migration**: `2026...create_org_profile_and_document_signature_config`

### API Routes (4 total)
- `GET/PATCH /organizations/[orgSlug]/profile` — read/update company identity
- `POST /organizations/[orgSlug]/profile/logo` — Vercel Blob logo upload
- `GET /organizations/[orgSlug]/signature-configs` — list all doc-type configs
- `PATCH /organizations/[orgSlug]/signature-configs/[documentType]` — update per doc-type config

### Pages & UI (1 RSC page + 8th hub card)
- `app/(dashboard)/[orgSlug]/settings/company/page.tsx` — admin-only settings page
- `SETTINGS_CARDS` — 8th entry "Perfil de Empresa" linking to `/settings/company`

### Services & Repositories (6 total, each with full test coverage)
- `OrgProfileService` + `OrgProfileRepository` with `getOrCreate` pattern
- `DocumentSignatureConfigService` + `DocumentSignatureConfigRepository`
- `OrgProfileValidation` (Zod schemas)
- `DocumentSignatureConfigValidation` (Zod schemas)

### UI Components (6 total)
- `CompanyProfileForm` — main form with three sections (Identidad, Logo, Bloques de firma)
- `LogoUploader` — Vercel Blob upload sub-component
- `LabelPicker` — signature label selector + reorder + remove
- `DocumentTypeSelector` — 8-entry dropdown for per-type config
- `SignatureLabelItem` — single label row with up/down/remove buttons
- `SignatureSectionControls` — save/cancel for per-doc-type block

---

## Test Metrics

- **Baseline tests**: 1723
- **New tests**: 115 (105 from apply + 10 from fix cycle)
- **Final count**: 1838 tests (100% passing)
- **Coverage breakdown**:
  - OrgProfile service/repo/validation: 35 tests
  - DocumentSignatureConfig service/repo/validation: 30 tests
  - API routes (profile, logo, signature-configs): 25 tests
  - Settings hub card verification: 5 tests
  - RSC page RBAC guard + hydration: 10 tests
  - UI components (form, label picker, doc type selector): 10 tests

---

## Out of Scope (Deferred)

- **PDF renderers for operational documents** (Comprobante, Venta, Compra, Cobro, Pago, Despacho) — future work will consume the persisted data
- **EEFF orgName bugfix** (orgSlug → OrgProfile.razonSocial in PDFs) — deferred to keep this change PDF-free

---

## Fix Cycle (1 cycle, all 3 warnings closed)

### W-1 — logoUrl domain restriction (FIXED)
- **Original issue**: Field accepted any HTTPS URL, not just Vercel Blob domain
- **Fix**: Added `.refine()` check in `updateOrgProfileSchema` to validate Vercel Blob domain pattern
- **Verification**: New test asserting logoUrl Vercel Blob domain or empty string
- **File**: `features/org-profile/org-profile.validation.ts`

### W-2 — Route test permission key assertion (FIXED)
- **Original issue**: Tests mocked legacy middleware chain (`requireAuth`, `requireRole`) instead of `requirePermission` directly
- **Fix**: Updated all 4 route test files to mock `@/features/shared/permissions.server` and assert exact `("accounting-config", "write")` permission key
- **Verification**: Tests now fail if permission key is changed incorrectly
- **Files**: All 4 route test files under `api/organizations/[orgSlug]/`

### W-3 — RSC page test coverage (FIXED)
- **Original issue**: No test for `settings/company/page.tsx` RSC guard + hydration logic
- **Fix**: Added `app/(dashboard)/[orgSlug]/settings/company/__tests__/page-rbac.test.ts` with RBAC guard + hydration tests
- **Verification**: Test asserts redirect on unauthorized, correct data hydration on authorized access
- **File**: New test file following existing `settings/roles/__tests__/page.test.ts` pattern

---

## TypeScript & Linting

- **`pnpm tsc --noEmit`**: ✅ CLEAN — no errors
- **Build**: ✅ PASS — no issues
- **Linting**: ✅ PASS — all files formatted via ESLint + Prettier

---

## Files Ready for Commit

**Implementation files** (38 core + 1 fix cycle test = 39 total):
- Prisma migration + schema
- Services + repositories (4 files)
- Validators (2 files)
- API routes (4 files)
- RSC page (1 file)
- UI components (6 files)
- Settings integration (1 file)
- Tests: service/repo/validation (3 files), routes (4 files), RSC page (1 file), UI (1 file)

**Artifact files**:
- `openspec/changes/organization-profile/archive-report.md` — this file

---

## Regression & Sign-Off

- **Test suite**: 1838/1838 PASS (confirmed 2026-04-19 15:57 UTC)
- **Type safety**: `tsc --noEmit` clean
- **All REQs**: 10/10 compliant
- **Fix cycle**: 1 cycle, all warnings closed
- **Ready to ship**: YES

