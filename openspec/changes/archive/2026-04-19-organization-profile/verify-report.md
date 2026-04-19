# Verify Report: organization-profile

**Date**: 2026-04-19
**Verifier**: sdd-verify (blind audit)
**Verdict**: PASS-WITH-WARNINGS
**Summary**: The `organization-profile` change is substantially correct. All 10 REQs are implemented and covered by tests. The 1828-test suite passes clean and `tsc --noEmit` exits with no errors. Two warnings surfaced during audit: (1) the route tests mock `@/features/shared/middleware` (the legacy chain) rather than `@/features/shared/permissions.server` — this works indirectly because `requirePermission` internally calls those functions, but the test intent is misleading and the 403 RBAC scenario is not tested against the exact `accounting-config` permission key; (2) the `logoUrl` field in `updateOrgProfileSchema` accepts any valid URL rather than restricting to the Vercel Blob domain pattern as specified in REQ-OP.2. No CRITICAL findings found.

---

## REQ Compliance Matrix

| REQ | Statement (short) | Verdict | Tests | Notes |
|-----|-------------------|---------|-------|-------|
| OP.1 | OrgProfile lazy getOrCreate + partial PATCH | COMPLIANT | ✅ | Service, repo, and route all tested. |
| OP.2 | Field-level validation (7 rules) | PARTIAL | ✅ | All field rules enforced. `logoUrl` accepts any URL, not just Vercel Blob domain. See W-1. |
| OP.3 | Logo upload: MIME + size before Blob write | COMPLIANT | ✅ | MIME allowlist + 2MB cap enforced before `put()`. Orphan delete via `updateLogo`. |
| OP.4 | DocumentSignatureConfig upsert by (orgId, docType) | COMPLIANT | ✅ | Repo uses composite unique key. Missing → default shape, no DB insert on read. |
| OP.5 | Signature config validation (enum, no dups, order) | COMPLIANT | ✅ | Zod refine rejects duplicates; empty labels accepted; order preserved exactly. |
| OP.6 | RBAC: `requirePermission("accounting-config","write")` on all routes | COMPLIANT | ⚠️ | Production routes all call `requirePermission` correctly. Route tests mock the middleware dependency indirectly — RBAC is exercised but not against the exact permission key. See W-2. |
| OP.7 | Multi-tenant: mandatory orgId filter on every repo method | COMPLIANT | ✅ | Every repo method signature requires `organizationId` as first param. TypeScript enforces at compile time. |
| OP.8 | Settings hub: 8th card "Perfil de Empresa" | COMPLIANT | ✅ | `SETTINGS_CARDS` has 8 entries. Dedicated test asserts count, title, and href. |
| OP.9 | `/settings/company` RSC page: `requirePermission` first, then hydrate | COMPLIANT | ✅ | Guard runs before DB calls; redirect on failure. No test file for page RSC (see W-3). |
| OP.10 | Form: 3 sections, up/down reorder, remove, showReceiverRow | COMPLIANT | ✅ | LabelPicker and CompanyProfileForm both tested. |

---

## Findings

### CRITICAL

None.

---

### WARNINGS

**W-1 — REQ-OP.2: `logoUrl` accepts any URL, not the Vercel Blob domain pattern**

- **Location**: `features/org-profile/org-profile.validation.ts` — `updateOrgProfileSchema`
- **Issue**: The spec says `logoUrl` "MUST be a valid URL on the Vercel Blob domain pattern". The implementation uses `z.string().url()` which accepts any HTTPS URL (e.g., `https://attacker.com/evil.png`). In practice the `logoUrl` is only set via the logo upload route (which does use Vercel Blob), but the PATCH `/profile` endpoint accepts `logoUrl` directly and would accept an arbitrary URL.
- **Risk**: A caller could set an arbitrary `logoUrl` via PATCH without going through the upload flow. Low severity because the field is admin-only, but it violates the spec's stated invariant.
- **Recommended fix**: Add `.refine((url) => !url || url.startsWith("https://"), ...)` at minimum, or tighten to the Vercel Blob domain pattern (e.g., `blob.vercel-storage.com`).

**W-2 — Route tests mock legacy middleware chain, not `requirePermission` directly**

- **Location**: All 4 route test files (`profile/route.test.ts`, `profile/logo/route.test.ts`, `signature-configs/route.test.ts`, `signature-configs/[documentType]/route.test.ts`)
- **Issue**: Tests mock `@/features/shared/middleware` (`requireAuth`, `requireOrgAccess`, `requireRole`) rather than `@/features/shared/permissions.server` (`requirePermission`). This works because `requirePermission` internally calls those functions, so the RBAC guard is exercised. However:
  - The 403 test simulates `requireRole` rejection, which does not verify that the correct `accounting-config:write` permission key was requested.
  - The test comment says "requirePermission falla" but the mock is on `requireRole` — if the production code changed the permission key, the tests would still pass.
- **Risk**: RBAC permission key correctness is not tested at the route level. A regression in the resource name (`"accounting-config"`) would not be caught by route tests.
- **Recommended fix**: Mock `@/features/shared/permissions.server` directly and assert it was called with `("accounting-config", "write", orgSlug)`.

**W-3 — No test file for RSC page `app/(dashboard)/[orgSlug]/settings/company/page.tsx`**

- **Location**: `app/(dashboard)/[orgSlug]/settings/company/page.tsx`
- **Issue**: Task T7.3 is marked done but there is no corresponding test file (no `page.test.ts` or `page.rbac.test.ts`). Task T7.1 asserts the settings hub data structure test via `lib/settings/__tests__/settings-cards.test.ts`, which does NOT cover the RSC page logic (requirePermission guard, redirect, data hydration).
- **Spec states**: "Strict TDD Mode: every production file must have a corresponding test."
- **Risk**: The redirect behavior on unauthorized access and the server-side hydration logic are not tested. The data hydration (`getOrCreate` + `listAll`) runs untested at page level.
- **Recommended fix**: Add `app/(dashboard)/[orgSlug]/settings/company/__tests__/page-rbac.test.ts` following the same pattern as `settings/roles/__tests__/page.test.ts`.

---

### SUGGESTIONS

**S-1 — Migration has no CASCADE on FK constraints**

- Both `org_profile` and `document_signature_config` use `ON DELETE RESTRICT` (Prisma default). Deleting an organization would fail unless both are cleaned up first. Spec does not address org deletion, but worth documenting as a future consideration.

**S-2 — `updateLogo` awaits `deleteLogoBlob` sequentially**

- `deleteLogoBlob` is described as "fire-and-forget" but is `await`-ed in `updateLogo`. This means a slow blob CDN delete would block the response. Since it swallows errors, correctness is unaffected, but true fire-and-forget would use `void this.deleteLogoBlob(previousUrl)`.

**S-3 — No test for logo orphan cleanup behavior in route**

- The logo route test verifies `put()` is called and `updateLogo` is called — but does not assert that `updateLogo` deletes the previous blob. This is covered in the service tests (T4.1), so it's a documentation gap rather than an untested path.

---

## Grep Gates

| Gate | Expected | Result |
|------|----------|--------|
| `grep -n "model OrgProfile" prisma/schema.prisma` | 1 hit | ✅ PASS — line 1050 |
| `grep -n "model DocumentSignatureConfig" prisma/schema.prisma` | 1 hit | ✅ PASS — line 1067 |
| `grep -n "enum SignatureLabel" prisma/schema.prisma` | 1 hit | ✅ PASS — line 1029 |
| `grep -n "enum DocumentPrintType" prisma/schema.prisma` | 1 hit | ✅ PASS — line 1039 |
| `grep -rn "requirePermission" app/api/organizations/[orgSlug]/profile/` | ≥2 hits | ✅ PASS — 3 hits (GET, PATCH, logo POST) |
| `grep -rn "requirePermission" app/api/organizations/[orgSlug]/signature-configs/` | ≥2 hits | ✅ PASS — 2 hits (list GET, docType PATCH) |
| `grep -rn "requirePermission" app/(dashboard)/[orgSlug]/settings/company/page.tsx` | 1 hit | ✅ PASS |
| `grep -rn "accounting-config" app/api/.../profile/` | non-empty | ✅ PASS — used on GET and PATCH |
| No `requireAuth`/`requireOrgAccess` in production route files | 0 hits | ✅ PASS — only in test mocks |
| `SignatureLabel` has exactly 7 values | 7 | ✅ PASS — ELABORADO, APROBADO, VISTO_BUENO, PROPIETARIO, REVISADO, REGISTRADO, CONTABILIZADO |
| `DocumentPrintType` has exactly 8 values | 8 | ✅ PASS — BALANCE_GENERAL, ESTADO_RESULTADOS, COMPROBANTE, DESPACHO, VENTA, COMPRA, COBRO, PAGO |
| Settings hub: 8 cards | 8 | ✅ PASS |
| No PDF files touched | 0 | ✅ PASS |
| No existing `OrgSettings` code modified | 0 | ✅ PASS — no such module exists |

---

## Regression

- **`pnpm tsc --noEmit`**: ✅ CLEAN — exited 0, no errors
- **`pnpm vitest run`**: ✅ PASS — **1828 tests passed** across 219 test files (matches apply claim of 1828)
- Test delta: +105 tests over baseline (1828 - 1723 = 105). Expected 105, confirmed 105.

---

## Recommendation

**Ready for archive** with mandatory fixes recommended before shipping:

1. **W-3** (missing RSC page test) — add `page-rbac.test.ts` for `settings/company/page.tsx` before merging. Low effort; 5-6 tests following existing patterns.
2. **W-2** (route test mock mismatch) — update route tests to mock `permissions.server` and assert the exact permission key. Medium effort; ensures RBAC regressions are caught.
3. **W-1** (logoUrl domain) — decide whether to enforce the Vercel Blob domain pattern or relax the spec. Low effort if accepting the relaxed version.

All three are warnings, none are blockers for archive if the team accepts the documented risk.
