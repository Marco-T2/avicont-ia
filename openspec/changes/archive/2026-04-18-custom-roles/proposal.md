# Proposal: Custom Roles per Organization

## Intent

Today the RBAC matrix is HARDCODED in `features/shared/permissions.ts`: 6 role literals, 12 resources, 2 actions, plus a separate `POST_ALLOWED_ROLES` map. Admins cannot model their own org (e.g., add "facturador", tweak "contador" write scope, or change who can post). The `/settings/roles` screen is read-only. We will make the matrix **data-driven per organization**, keeping the 6 system roles immutable and letting admins create/edit custom roles — without touching any of the 62+ API routes that call `requirePermission`.

## Scope

### In Scope
- New `CustomRole` Prisma model with `isSystem` flag (6 system rows per org + custom rows).
- Seeding migration: idempotent `createMany({ skipDuplicates: true })` for existing orgs + `syncOrganization()` hook for new orgs + fallback seed inside `requirePermission`.
- Per-org permission matrix loaded from DB with **in-process cache** (`Map<orgId, matrix>`, TTL 60s, explicit `revalidateOrgMatrix(orgId)` on every mutation).
- `POST_ALLOWED_ROLES` folded into the model as editable `canPost: String[]` column.
- Custom-role creation flow: pick a system role as template → snapshot its matrix → edit freely. No runtime inheritance.
- Slug auto-derived from name, editable before save, `@@unique([organizationId, slug])`.
- `/settings/roles` evolves from read-only matrix into full CRUD hub.
- New API: `GET/POST /api/organizations/[orgSlug]/roles`, `GET/PATCH/DELETE /api/organizations/[orgSlug]/roles/[roleSlug]`.
- Self-lock guard extended (D.4): block edits that strip `members.write` from caller's OWN role; refuse deletion if any member is assigned the role.
- `assignableRoles` Zod enum opens to async validation against org's role slugs.

### Out of Scope
- Per-user ACL or permission overrides.
- Cross-org role sharing / global role templates.
- Runtime role inheritance (we snapshot at create time).
- Bulk role-assignment UI.
- Redis or any external cache infrastructure.
- Adding/removing `Resource` or `Action` values (matrix dimensions stay fixed).

## Capabilities

### New Capabilities
- `rbac-custom-roles`: CRUD lifecycle for per-org custom roles (create from template, edit, delete with guards, slug uniqueness, canPost flags).

### Modified Capabilities
- `rbac-permissions-matrix`: matrix becomes per-org DB-driven with in-process cache; `canAccess`/`canPost` resolve against loaded matrix; `POST_ALLOWED_ROLES` no longer static.
- `rbac-roles`: `Role` widens from 6 literals to `string` (system slug set preserved); system rows protected by `isSystem`.
- `rbac-ui-gating`: `/settings/roles` becomes CRUD; `useCanAccess`/`<Gated>` resolve through the dynamic matrix while keeping the same component API.

## Approach

DB-per-org matrix with in-process cache (exploration Approach 1). Single `CustomRole` table, `isSystem` flag distinguishes the 6 locked rows from admin-created rows. `requirePermission(resource, action, orgSlug)` signature **stays frozen** — internally it now loads the org's matrix (cached) instead of reading a static map. All 62+ route call sites are untouched. 3 service files (`sale`, `purchase`, `journal`) switch from `POST_ALLOWED_ROLES` lookup to `matrix.canPost`. `<Gated>` and `useCanAccess()` keep their public API; internals read the cached matrix via `useOrgRole()`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | `CustomRole` model + migration + seed |
| `features/shared/permissions.ts` | Modified | `Role` widens to string; `canAccess`/`canPost` read matrix |
| `features/shared/permissions.server.ts` | Modified | `requirePermission` hits cached matrix; fallback seeder |
| `features/shared/permissions.cache.ts` | New | In-process `Map` + TTL + `revalidateOrgMatrix()` |
| `features/organizations/members.validation.ts` | Modified | `assignableRoles` becomes async org-scoped check |
| `features/organizations/members.service.ts` | Modified | Extended self-lock guard (D.4) |
| `features/organizations/roles/*` | New | Service + validation + API for role CRUD |
| `app/api/organizations/[orgSlug]/roles/**` | New | REST endpoints for CRUD |
| `features/shared/services/sale|purchase|journal.service.ts` | Modified | `canPost` via matrix, not static map |
| `components/common/gated.tsx`, `hooks/use-org-role.ts` | Modified | Resolve through dynamic matrix |
| `app/(dashboard)/[orgSlug]/settings/roles/page.tsx` | Modified | Read-only matrix → full CRUD UI |
| 62+ API route files | **Untouched** | `requirePermission` signature frozen |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cache drift across Vercel instances (up to TTL) | Medium | 60s TTL + explicit invalidation on every write; acceptable for SMB |
| System-role seeding misses an org | Low | Idempotent `createMany` + on-demand fallback seed in `requirePermission` |
| Admin self-locks by removing `members.write` from own role | Medium | Extended D.4 guard blocks the mutation at API layer |
| `assignableRoles` Zod enum → async check regresses validation | Low | Full test coverage on members.validation path |
| `POST_ALLOWED_ROLES` refactor breaks 3 posting services | Medium | Strict TDD — tests first on sale/purchase/journal post flows |
| UI CRUD scope creep | Medium | Freeze UI spec in sdd-spec; defer nice-to-haves |

## Rollback Plan

1. Revert the migration (`CustomRole` drop) — no existing column widened, so schema is additive.
2. Revert `permissions.ts` / `permissions.server.ts` / cache file — restores static maps.
3. Revert 3 service files (`canPost` back to static map).
4. Revert `/settings/roles` page to read-only.
5. API route call sites are untouched → nothing to roll back there.

Each step is a single-commit revert; rollback is safe because no existing data shape changes.

## Dependencies

- Prisma migration slot available.
- `syncOrganization()` (Clerk webhook handler) reachable for new-org seeding.

## Success Criteria

- [ ] Admin can create a custom role from any system template, edit its matrix + `canPost`, and assign it to members.
- [ ] The 6 system roles are immutable in UI and API (`isSystem=true` rejects PATCH/DELETE).
- [ ] All 62+ API routes still pass their existing permission tests without code changes.
- [ ] Permission checks after a role edit reflect within ≤60s cluster-wide (immediately in the invalidating instance).
- [ ] Admin cannot remove `members.write` from their own current role (D.4 guard).
- [ ] Deleting a role with assigned members fails with a clear error.
- [ ] New orgs get 6 system roles seeded automatically; existing orgs backfilled by idempotent migration.
- [ ] Strict TDD: every new service/API has tests written first (applies to `sdd-apply`).
