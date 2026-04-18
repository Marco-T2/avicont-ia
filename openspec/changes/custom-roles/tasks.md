# Tasks: Custom Roles per Organization

> REQ coverage: CR.1–CR.8 · P.2mod · P.3mod · P.5 · P.6 · R.1mod · R.3mod · R.4 · U.1mod · U.2mod · U.4mod · U.5
> Structure: 8 PRs · 32 tasks · TDD RED→GREEN→REFACTOR throughout

---

## PR1 — Foundation: Schema + Cache + Types

> New Prisma model, module-scope cache, widened Role type, 5 new error codes.
> No behavior change yet — static paths remain via compatibility until PR2.

### PR1.1 — ✅ Add `CustomRole` Prisma model + migration

**RED**: `prisma/__tests__/custom-role.schema.test.ts` — assert create/find round-trip for 1 system row and 1 custom row; assert `@@unique([organizationId, slug])` throws P2002 on duplicate insert.

**GREEN**: `prisma/schema.prisma` — add `CustomRole` model (D.1: `organizationId`, `slug`, `name`, `isSystem`, `permissionsRead String[]`, `permissionsWrite String[]`, `canPost Boolean`, `@@unique([organizationId, slug])`). Run `pnpm prisma migrate dev --name add_custom_roles`.

**Satisfies**: CR.1 (table exists), CR.4 (unique constraint), D.1, D.2

**Done when**: migration applied, round-trip test green, duplicate insert throws.

---

### PR1.2 — ✅ Widen `Role` type + add `SystemRole` const

**RED**: `features/shared/__tests__/permissions.types.test.ts` — assert `type Role = string`; assert `SYSTEM_ROLES` tuple contains exactly `['owner','admin','contador','cobrador','auxiliar','member']`; assert `SystemRole` narrows correctly.

**GREEN**: `features/shared/permissions.ts` — change `type Role = string`; add `const SYSTEM_ROLES = [...] as const`; add `type SystemRole = typeof SYSTEM_ROLES[number]`. Export both.

**Satisfies**: R.1mod (Role widens), D.8

**Done when**: existing permissions.test.ts still passes; no TypeScript errors on `role === 'owner'` comparisons.

---

### PR1.3 — ✅ Add 5 new error codes

**RED**: `features/shared/__tests__/errors.custom-roles.test.ts` — assert each new code exports a string literal: `SYSTEM_ROLE_IMMUTABLE`, `SELF_LOCK_GUARD`, `SLUG_TAKEN`, `RESERVED_SLUG`, `ROLE_HAS_MEMBERS`.

**GREEN**: `features/shared/errors.ts` — append 5 new `export const` entries.

**Satisfies**: CR.2 (SYSTEM_ROLE_IMMUTABLE), CR.4 (SLUG_TAKEN), CR.6 (SELF_LOCK_GUARD), CR.7 (ROLE_HAS_MEMBERS), D.4, D.5, D.10

**Done when**: all 5 codes importable; existing error tests unaffected.

---

### PR1.4 — ✅ Implement `permissions.cache.ts`

**RED**: `features/shared/__tests__/permissions.cache.test.ts` — unit tests for: (a) cache miss triggers DB load (mock), (b) cache hit skips DB, (c) TTL=60s expiry reloads, (d) `revalidateOrgMatrix` evicts only target org, (e) single-flight: two concurrent calls issue one DB read, (f) LRU cap 1000 drops oldest, (g) `_resetCache()` clears all.

**GREEN**: `features/shared/permissions.cache.ts` — implement `getMatrix(orgId)`, `revalidateOrgMatrix(orgId)`, `_resetCache()` using module-scope `Map<orgId, {matrix, expiresAt, inflight?>}>`; 60s TTL; promise-based single-flight guard.

**Satisfies**: P.5 (cache + invalidation), P.2mod (cache-backed canAccess), D.3

**Done when**: all 7 cache unit tests green; no DB calls on cache hit.

---

### PR1.5 — ✅ Prisma seed script for existing orgs

**RED**: `prisma/__tests__/seed-system-roles.test.ts` — mock `prisma.organization.findMany` returning 2 orgs; assert `createMany({skipDuplicates:true})` called once per org with 6 system role payloads.

**GREEN**: `prisma/seed-system-roles.ts` — query all orgs, `createMany` 6 system `CustomRole` rows per org with `skipDuplicates:true`. Wire into `package.json` scripts.

**Satisfies**: CR.1-S1 (idempotent seed for existing orgs), D.6

**Done when**: seed script runs without error on empty DB; duplicate run produces no new rows.

---

## PR2 — `requirePermission` + `canAccess` → DB matrix

> Swap static map for cache-backed matrix. All 62+ routes untouched (signature frozen).

### PR2.1 — ✅ `requirePermission` reads from cache + fallback seed

**RED**: `features/shared/__tests__/require-permission.test.ts` (extend existing) — add: (a) matrix loaded from cache on call, (b) org with 0 roles triggers inline seed then re-checks, (c) unauthorized returns 403 `FORBIDDEN`, (d) signature `(resource, action, orgSlug)` contract test with 62+ call sites assertion (count grep).

**GREEN**: `features/shared/permissions.server.ts` — call `getMatrix(orgId)` from cache; if matrix is empty trigger `seedSystemRoles(orgId)` inline before re-read; evaluate `(role, resource, action)` against matrix.

**Satisfies**: P.3mod (signature frozen, DB-driven), CR.1-S3 (fallback seed), D.6 (runtime fallback)

**Done when**: existing 62+ route integration tests pass without touching route files. ✅

---

### PR2.2 — ✅ `canAccess` facade reads from cache

**RED**: `features/shared/__tests__/permissions.test.ts` (extend) — add: (a) `canAccess("contador","reports","read",orgId)` → true from seeded system snapshot; (b) unknown role → false; (c) custom role with `journal.write=true` in mock matrix → true; (d) expired cache (mock TTL) triggers reload.

**GREEN**: `features/shared/permissions.ts` — make `canAccess(role, resource, action, orgId)` async; call `getMatrix(orgId)`; lookup `matrix[role][resource][action]`. Keep existing sync overload as compatibility shim (reads from last fetched matrix per org in same request scope).

**Satisfies**: P.2mod-S1..S5, D.7 (async facade)

**Done when**: all P.2 scenarios pass; `<Gated>` / `useCanAccess` still compile (public API unchanged). ✅

---

## PR3 — Service `canPost` migration (sale + purchase)

> Only 2 service files; journal gates via `requirePermission` (no canPost needed).

### PR3.1 — `sale.service.ts` async `canPost`

**RED**: `features/sale/__tests__/sale-canpost.test.ts` (extend) — add: (a) custom role `facturador` with `canPost=true` in mock matrix → posting allowed; (b) `auxiliar` with `canPost=false` → 403; (c) mock `getMatrix` called once per request (no extra DB calls).

**GREEN**: `features/sale/sale.service.ts` — replace `POST_ALLOWED_ROLES.includes(role)` with `await canPost(role, resource, orgId)` reading from cache matrix.

**Satisfies**: P.6-S1, P.6-S2, D.7 (sale migration)

**Done when**: existing sale.service.iva.test.ts still green; canPost tests pass.

---

### PR3.2 — `purchase.service.ts` async `canPost`

**RED**: `features/purchase/__tests__/purchase-canpost.test.ts` — mirror sale tests: (a) `canPost=true` allows; (b) `canPost=false` → 403.

**GREEN**: `features/purchase/purchase.service.ts` — same swap as PR3.1.

**Satisfies**: P.6 (purchase branch), D.7

**Done when**: existing purchase.service.iva.test.ts still green; new canPost tests green.

---

## PR4 — Roles CRUD Service + Repository + Validation

> Business logic: slugify, reserved-slug guard, self-lock guard, array normalize, member-guard on delete.

### PR4.1 — `slugify` + reserved-slug utilities

**RED**: `features/organizations/__tests__/roles.validation.test.ts` — assert: `slugify("Mi Rol Especial") === "mi-rol-especial"`; diacritics stripped; max 32 chars; reserved slugs list rejects with `RESERVED_SLUG`; collision suffix `-2`..`-99`.

**GREEN**: `features/organizations/roles.validation.ts` — implement `slugify(name)` + `assertNotReserved(slug)` + `resolveUniqueSlug(base, existingSlugs)`. No DB in this file.

**Satisfies**: CR.4 (slug derivation, D.4-S1), D.5

**Done when**: all slug unit tests green; no DB calls.

---

### PR4.2 — `roles.repository.ts`

**RED**: `features/organizations/__tests__/roles.repository.test.ts` — mock Prisma; assert: `findAllByOrg(orgId)`, `findBySlug(orgId, slug)`, `create(data)`, `update(id, patch)`, `delete(id)`, `countMembers(roleSlug, orgId)` each call correct Prisma method with correct args.

**GREEN**: `features/organizations/roles.repository.ts` — thin Prisma wrappers for `CustomRole`. Export typed functions only; no business logic.

**Satisfies**: CR.1 (foundation for seeding), R.4 (data access layer), D.1

**Done when**: all 6 repository mock tests green.

---

### PR4.3 — `RolesService` CRUD + self-lock guard + member guard

**RED**: `features/organizations/__tests__/roles.service.test.ts` — mock repository; assert: (a) `createRole` snapshots template matrix, sets `isSystem=false`; (b) `updateRole` calls `revalidateOrgMatrix`; (c) self-lock guard: PATCH that removes `members.write` from caller's own role → `ForbiddenError(SELF_LOCK_GUARD)`; (d) other admin patching same role → no guard; (e) `deleteRole` with members → `ConflictError(ROLE_HAS_MEMBERS)`; (f) `deleteRole` with 0 members → calls `repo.delete`; (g) PATCH/DELETE system role → `ForbiddenError(SYSTEM_ROLE_IMMUTABLE)`; (h) array normalize called on write (sort+dedupe); (i) `exists(orgId, slug)` returns bool.

**GREEN**: `features/organizations/roles.service.ts` — implement `RolesService` class with `listRoles`, `createRole`, `getRole`, `updateRole`, `deleteRole`, `exists`. Inject repository. Normalize arrays on write (D.11). Call `revalidateOrgMatrix` after every mutation.

**Satisfies**: CR.2, CR.3, CR.5, CR.6, CR.7, D.4, D.11, R.4

**Done when**: all 9 service test cases green.

---

## PR5 — Roles API Routes (5 endpoints)

### PR5.1 — `GET /api/organizations/[orgSlug]/roles` + `POST`

**RED**: `app/api/organizations/[orgSlug]/roles/__tests__/route.test.ts` — mock `RolesService`; assert: (a) GET returns 200 + array of 7 roles for seeded org (6 system + 1 custom); (b) member (no `members.write`) GET → 403; (c) POST with valid body → 201 + created role; (d) POST reserved slug → 422 `RESERVED_SLUG`; (e) POST duplicate slug → 409 `SLUG_TAKEN`; (f) unauthorized POST → 403.

**GREEN**: `app/api/organizations/[orgSlug]/roles/route.ts` — implement `GET` and `POST` handlers; gate with `requirePermission("members","write",orgSlug)`; delegate to `RolesService`.

**Satisfies**: R.4-S1, R.4-S2, CR.3-S3, CR.4-S2, D.10

**Done when**: all 6 route test cases green.

---

### PR5.2 — `GET/PATCH/DELETE /api/organizations/[orgSlug]/roles/[roleSlug]`

**RED**: `app/api/organizations/[orgSlug]/roles/[roleSlug]/__tests__/route.test.ts` — assert: (a) GET → 200 with full role; (b) PATCH system role → 403 `SYSTEM_ROLE_IMMUTABLE`; (c) PATCH self-lock → 403 `SELF_LOCK_GUARD`; (d) PATCH valid custom role → 200 + `revalidateOrgMatrix` called; (e) DELETE system role → 403 `SYSTEM_ROLE_IMMUTABLE`; (f) DELETE with members → 409 `ROLE_HAS_MEMBERS`; (g) DELETE with 0 members → 200.

**GREEN**: `app/api/organizations/[orgSlug]/roles/[roleSlug]/route.ts` — implement `GET`, `PATCH`, `DELETE`; same permission gate; delegate to `RolesService`.

**Satisfies**: CR.2-S1, CR.2-S2, CR.5-S3, CR.6-S1, CR.7-S1, CR.7-S2, D.10

**Done when**: all 7 route test cases green.

---

## PR6 — Members Async Role Validation

### PR6.1 — `buildAddMemberSchema(orgId)` factory

**RED**: `features/organizations/__tests__/members.validation.test.ts` (extend) — add: (a) `buildAddMemberSchema("alpha")` with mock `rolesService.exists` returning true → `parseAsync` resolves; (b) unknown slug → `parseAsync` rejects with 422 shape; (c) `owner` slug → still rejected (R.1-S2 preserved).

**GREEN**: `features/organizations/members.validation.ts` — replace static `z.enum(ASSIGNABLE_ROLES)` with `buildAddMemberSchema(orgId)` factory that returns `z.object({ role: z.string().refine(async (s) => rolesService.exists(orgId, s), { message: "INVALID_ROLE" }) })`.

**Satisfies**: CR.8-S1, CR.8-S2, R.1-S3, R.1-S4, D.9

**Done when**: async-refine integration test green; owner still rejected.

---

### PR6.2 — Thread `orgId` through `members.service.ts`

**RED**: `features/organizations/__tests__/members.service.test.ts` (extend) — assert: (a) `addMember` calls `buildAddMemberSchema(orgId).parseAsync(body)`; (b) `updateMemberRole` calls `buildAddMemberSchema(orgId).parseAsync({ role })`.

**GREEN**: `features/organizations/members.service.ts` — pass `orgId` into `addMember` and `updateMemberRole`; call `buildAddMemberSchema(orgId).parseAsync`.

**Satisfies**: CR.8, R.3mod-S3, D.9

**Done when**: members service tests green; existing member-change scenarios pass.

---

## PR7 — UI CRUD Hub `/settings/roles`

### PR7.1 — `<Gated>` + `useCanAccess` resolve from dynamic matrix

**RED**: `components/common/__tests__/gated.test.tsx` (extend) — add: (a) custom role `facturador` with `journal.write=true` in mock matrix → children render; (b) loading state → children not rendered; (c) matrix update reflected after reload. `components/common/__tests__/use-org-role.test.ts` — (d) hook returns `false` during loading; (e) returns correct bool post-load.

**GREEN**: `components/common/gated.tsx` + `components/common/use-org-role.ts` — call `useCanAccess(resource, action)` which reads from React context/SWR that fetches `/api/organizations/[orgSlug]/members/me` matrix payload. Public props API unchanged.

**Satisfies**: U.1mod (all S1–S4), U.2mod (all S1–S3), D.8

**Done when**: all 5 UI unit tests green; no flash on loading; existing gated.test.tsx still green.

---

### PR7.2 — Dynamic role picker in members admin

**RED**: `components/settings/__tests__/role-picker.test.tsx` — mock GET `/roles` returning 5 system + 1 custom; assert: (a) picker contains exactly 6 options; (b) `owner` NOT in options; (c) custom role `facturador` IS in options.

**GREEN**: `components/settings/role-picker.tsx` — fetch `/api/organizations/[orgSlug]/roles` on mount; filter out `owner`; render `<select>` options dynamically. Used by add-member dialog.

**Satisfies**: U.4mod-S1, U.4mod-S2

**Done when**: role-picker tests green; members page compiles.

---

### PR7.3 — `<RoleCreateDialog>` with template selection

**RED**: `components/settings/__tests__/role-create-dialog.test.tsx` — assert: (a) Save disabled until template selected (U.5-S3); (b) POST called with `{ name, templateSlug, slug }` on Save; (c) slug preview updates as name typed; (d) dialog closes on success + triggers list refresh.

**GREEN**: `components/settings/role-form.tsx` + `role-create-dialog.tsx` — form with name input, slug preview (slugify util), template selector (from system roles), Save button gated on template selection.

**Satisfies**: CR.3-S1, CR.4-S1, U.5-S3, D.5

**Done when**: create dialog tests green.

---

### PR7.4 — `<RoleEditDrawer>` (matrix + canPost)

**RED**: `components/settings/__tests__/role-edit-drawer.test.tsx` — assert: (a) drawer opens with role's current matrix; (b) toggle cell → PATCH called; (c) `canPost` toggle → PATCH called; (d) system role → inputs disabled (no edit controls).

**GREEN**: `components/settings/role-edit-drawer.tsx` — drawer with matrix toggle grid + `canPost` switch; disabled when `role.isSystem`; calls PATCH on save.

**Satisfies**: CR.5-S1, CR.5-S2, CR.2-S3 (no controls for system), U.5-S1, U.5-S2

**Done when**: edit drawer tests green.

---

### PR7.5 — `<RoleDeleteDialog>` + `/settings/roles` page evolution

**RED**: `components/settings/__tests__/role-delete-dialog.test.tsx` — assert: (a) DELETE not called until confirmation clicked (U.5-S4); (b) 409 `ROLE_HAS_MEMBERS` shown as error. `app/(dashboard)/[orgSlug]/settings/roles/__tests__/page.test.ts` (extend) — assert page renders list with system rows read-only and custom rows with Edit/Delete buttons.

**GREEN**: `components/settings/role-delete-dialog.tsx` — two-step confirmation. `app/(dashboard)/[orgSlug]/settings/roles/page.tsx` — evolve to full list view: system roles as read-only rows, custom roles with Edit/Delete buttons; "Create role" button triggers `<RoleCreateDialog>`.

**Satisfies**: CR.2-S3, CR.7-S1 (409 surfaced in UI), U.5-S1, U.5-S2, U.5-S4

**Done when**: delete dialog and page tests green; roles matrix component still renders system matrix correctly.

---

## PR8 — Webhook Seed + Cleanup

### PR8.1 — `syncOrganization` seeds 6 system roles on new org

**RED**: `app/api/organizations/__tests__/route.test.ts` (extend) — mock `prisma.customRole.createMany`; trigger the org-creation webhook path; assert `createMany` called with 6 system role payloads and `skipDuplicates:true`.

**GREEN**: `app/api/organizations/route.ts` — inside `syncOrganization()` handler, after org upsert call `prisma.customRole.createMany({ data: SYSTEM_ROLE_SEEDS(orgId), skipDuplicates: true })`. Import `SYSTEM_ROLE_SEEDS` from a shared const (add to `features/shared/permissions.ts`).

**Satisfies**: CR.1-S2 (new org seeding), D.6 (webhook seed leg)

**Done when**: webhook route test green; no regression on org update path.

---

### PR8.2 — Final sweep: remove dead imports + smoke test

**RED**: `features/shared/__tests__/permissions.smoke.test.ts` — import `canAccess`, `requirePermission`, `canPost`; assert all 3 export correctly; assert `POST_ALLOWED_ROLES` is NOT exported (dead export removed).

**GREEN**: `features/shared/permissions.ts` — remove `POST_ALLOWED_ROLES` export. `features/organizations/members.validation.ts` — confirm no static `ASSIGNABLE_ROLES` enum remains. Remove any now-unused imports across touched files.

**Satisfies**: P.6 (static map removed), D.7 (canPost fully migrated), cleanup

**Done when**: smoke test green; TypeScript build passes with 0 errors; `POST_ALLOWED_ROLES` no longer importable.

---

## REQ Coverage Map

| REQ | PR(s) | Task(s) |
|-----|-------|---------|
| CR.1 (seeding) | PR1, PR2, PR8 | PR1.5, PR2.1, PR8.1 |
| CR.2 (system immutable) | PR4, PR5, PR7 | PR4.3, PR5.2, PR7.4 |
| CR.3 (create from template) | PR4, PR5 | PR4.3, PR5.1, PR7.3 |
| CR.4 (slug + unique) | PR1, PR4 | PR1.1, PR1.3, PR4.1 |
| CR.5 (edit matrix) | PR4, PR5, PR7 | PR4.3, PR5.2, PR7.4 |
| CR.6 (self-lock guard) | PR4, PR5 | PR4.3, PR5.2 |
| CR.7 (delete + member guard) | PR4, PR5, PR7 | PR4.3, PR5.2, PR7.5 |
| CR.8 (async role validation) | PR6 | PR6.1, PR6.2 |
| P.2mod (canAccess dynamic) | PR2 | PR2.2 |
| P.3mod (requirePermission frozen) | PR2 | PR2.1 |
| P.5 (cache) | PR1 | PR1.4 |
| P.6 (canPost via matrix) | PR3, PR8 | PR3.1, PR3.2, PR8.2 |
| R.1mod (Role = string) | PR1 | PR1.2 |
| R.3mod (admin changes role) | PR6 | PR6.2 |
| R.4 (CRUD API) | PR5 | PR5.1, PR5.2 |
| U.1mod (Gated dynamic) | PR7 | PR7.1 |
| U.2mod (useCanAccess dynamic) | PR7 | PR7.1 |
| U.4mod (role picker dynamic) | PR7 | PR7.2 |
| U.5 (settings/roles CRUD) | PR7 | PR7.3, PR7.4, PR7.5 |

**All 19 REQs covered. No unmapped requirements.**
