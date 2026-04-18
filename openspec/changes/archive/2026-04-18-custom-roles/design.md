# Design: Custom Roles per Organization

## Technical Approach

DB-per-org permission matrix backed by a single `CustomRole` table with `isSystem` flag separating the 6 locked system rows from admin-created rows. A module-scope in-process cache (`Map<orgId, matrix>`, TTL 60s) serves `requirePermission` without changing its signature — so all 62+ API call sites stay untouched. `POST_ALLOWED_ROLES` folds into `CustomRole.canPost` (editable per org). `/settings/roles` evolves to full CRUD. System roles cannot be renamed, deleted, or have `isSystem` toggled. TDD first on matrix loader, cache, self-lock guard, and the 2 `canPost` service call sites (not 3 — `journal.service.ts` does not use `canPost`; it relies on `requirePermission('journal','write')`).

## Architecture Decisions

### D.1 — Prisma schema for `CustomRole`

**Choice**: Single `CustomRole` model, `role` column on `OrganizationMember` stays `String` (no FK, no DB enum). String arrays for permission flags.

```prisma
model CustomRole {
  id               String   @id @default(cuid())
  organizationId   String
  slug             String   // e.g. "owner", "facturador"
  name             String   // human label, e.g. "Facturador"
  description      String?
  isSystem         Boolean  @default(false)
  permissionsRead  String[] // resources with read, e.g. ["sales","reports"]
  permissionsWrite String[] // resources with write
  canPost          String[] // subset of postable resources: "sales"|"purchases"|"journal"
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, slug])
  @@index([organizationId, isSystem])
  @@map("custom_roles")
}
```

- **No FK from `OrganizationMember.role` → `CustomRole.slug`**. Rationale: role is already a free `String @default("member")` today; adding an FK would (a) force a composite FK on `(organizationId, role)` which Prisma supports awkwardly, (b) require a cross-table write transaction on every member insert, (c) break the zero-change promise for 62+ routes. We enforce referential integrity at the service layer via the cache (reject assignment of unknown slugs) + D.9 async Zod refine.
- **No `memberCount` computed column**. Compute on demand in the roles-list API via `prisma.organizationMember.groupBy`. Rationale: avoids write amplification on every member mutation; the settings page is low-traffic.
- **`onDelete: Cascade`** on organization relation — when an org is deleted, its roles go with it.

**Verdict**: YES — additive model only, no existing column changes.

### D.2 — Permissions encoding

**Choice**: (a) **Postgres `String[]` columns** (`permissionsRead`, `permissionsWrite`, `canPost`).

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| (a) `String[]` columns | 1 row per role → whole matrix for an org loads in a single query; trivial cache shape; maps 1:1 to current static `Role[]` arrays | Postgres-specific; no per-cell audit | **CHOSEN** |
| (b) `CustomRolePermission` row-per-cell | Granular audit; DB-enforceable | N rows × 2 actions × ~8 roles = 192 rows per org loaded per request; joins; worse for cache simplicity | Rejected |
| (c) JSON column | Schemaless flex | No Postgres index; harder to validate shape | Rejected |

**Verdict**: YES — Postgres `String[]`, normalized (sorted ascending) on write for cache-key stability (see D.11). `canPost` uses the resource name (`"sales"|"purchases"|"journal"`), NOT a separate postable-resource enum — the runtime check validates membership against the `PostableResource` TS union.

### D.3 — Cache architecture

**Choice**: Plain module-scope `Map<orgId, { matrix: OrgMatrix; expiresAt: number }>` in `features/shared/permissions.cache.ts`. Single-flight via `Map<orgId, Promise<OrgMatrix>>`. NO Next.js `use cache` / `unstable_cache` / `revalidateTag`.

```ts
// features/shared/permissions.cache.ts
export type OrgMatrix = {
  orgId: string;
  roles: Map<string /* slug */, {
    permissionsRead: Set<Resource>;
    permissionsWrite: Set<Resource>;
    canPost: Set<PostableResource>;
    isSystem: boolean;
  }>;
  loadedAt: number;
};

export async function getMatrix(orgId: string): Promise<OrgMatrix>;
export function revalidateOrgMatrix(orgId: string): void;   // sync; drops entry + in-flight promise
export function _resetCache(): void;                         // test-only
```

- **TTL**: 60 seconds (proposal R-1 accepts ≤60s multi-instance drift).
- **Eviction**: size-bounded LRU-ish cap at 1000 orgs (drop oldest `loadedAt` on insert overflow). Rationale: serverless Node instance memory; far more than single tenant realistically hits.
- **Single-flight**: a second caller while a load is in-flight awaits the same Promise. Prevents thundering-herd DB hits on cold cache.
- **Next.js 16 serverless lifetime**: `use cache` is fetch-layer, not suitable for mutable per-org state keyed by `orgId`. `unstable_cache` is deprecated in 16. A plain `Map` in module scope survives across requests on a warm lambda and gets GC'd on cold start — which is EXACTLY what we want (60s TTL is the hard upper bound anyway). We deliberately do NOT try to persist across lambda cold starts.
- **Invalidation**: every write path (`POST/PATCH/DELETE /roles`, `POST/PATCH /members`) calls `revalidateOrgMatrix(orgId)` on success. Same-process: immediate. Other processes: ≤60s.

**Verdict**: YES — module-scope Map, 60s TTL, size cap 1000, single-flight, sync invalidator.

### D.4 — Self-lock guard (extended)

**Choice**: Guard lives in the **service layer** (`RolesService.updateRole` and `MembersService.updateRole`), not the PATCH handler. Rationale: services are the invariant boundary; HTTP handlers are thin.

Algorithm (for `RolesService.updateRole(orgId, roleSlug, patch, callerClerkUserId)`):
1. Load caller's current `OrganizationMember` → `callerRole`.
2. If `patch.slug === callerRole` (editing my own role):
   a. Compute the post-edit matrix for `callerRole` (merge patch onto current).
   b. If post-edit `permissionsWrite` does NOT include `"members"` → reject with `ForbiddenError(CANNOT_SELF_LOCK)`.
3. Proceed with update, then `revalidateOrgMatrix(orgId)`.

Also extend `MembersService.updateRole` (already has `CANNOT_CHANGE_OWN_ROLE` for same-user): reuse.

New error code: `CANNOT_SELF_LOCK` (add to `features/shared/errors.ts`). HTTP: **403**.

**Verdict**: YES — service layer, new error code, HTTP 403.

### D.5 — Slug strategy

**Choice**:
- `slugify(name)`: lowercase, trim, NFKD-normalize, strip diacritics, replace non-`[a-z0-9]+` runs with `-`, collapse repeated `-`, trim leading/trailing `-`. Max length **32**.
- **Collision**: append `-2`, `-3`, … until unique within `(organizationId, slug)`. Max 99 suffix (fail with `ConflictError(SLUG_COLLISION)` beyond).
- **Reserved slugs** (blocked at create): `["owner","admin","contador","cobrador","auxiliar","member"]` — these are the 6 system slugs and belong to `isSystem=true` rows only. Attempting to create a custom role with a reserved slug → `ValidationError(RESERVED_SLUG)` (HTTP 422).
- **Editable before save**: the client can override the auto-derived slug in the CREATE payload. On UPDATE, slug is **immutable** (would break `OrganizationMember.role` references). Rationale: simpler than cascading a rename.

**Verdict**: YES — auto-slug, reserved set blocked, immutable on update.

### D.6 — Seed migration strategy

**Choice**: **Both** — Prisma migration + seed script for existing orgs, AND per-request fallback inside `getMatrix()` for belt-and-suspenders safety.

1. **Prisma migration** (additive): creates `custom_roles` table.
2. **Seed script** (`prisma/seeds/custom-roles.ts`, invoked from the migration's SQL or a one-off `pnpm tsx` run): for each existing `Organization`, idempotent `prisma.customRole.createMany({ data: [...6 system rows...], skipDuplicates: true })`.
3. **`syncOrganization()` hook** (Clerk webhook, existing): on org creation, seed the 6 system roles in the same transaction.
4. **Fallback inside `getMatrix(orgId)`**: if the DB returns 0 rows for an org, seed the 6 system rows synchronously (`createMany` `skipDuplicates`), then reload. Prevents a 500 if the migration or webhook missed an org.

The 6 system rows are generated from the CURRENT static maps (`PERMISSIONS_READ`, `PERMISSIONS_WRITE`, `POST_ALLOWED_ROLES`) so behavior is 1:1 on day one.

**Verdict**: YES — migration + seed + webhook + runtime fallback.

### D.7 — `POST_ALLOWED_ROLES` removal path

**Choice**: Keep the `canPost(role, resource)` facade — now **async** — in `features/shared/permissions.ts`, reading from the cached matrix. Call sites in `sale.service.ts` and `purchase.service.ts` become `await canPost(role, 'sales', orgId)` / `await canPost(role, 'purchases', orgId)`.

**IMPORTANT correction to proposal's "3 service files"**: only `features/sale/sale.service.ts:376` and `features/purchase/purchase.service.ts:504` call `canPost`. `features/journal/**` does NOT use `canPost` — posting authority on journal is enforced via `requirePermission('journal','write',orgSlug)`. So the migration touches **2 service files**, plus `permissions.ts` facade, plus test files.

```ts
// features/shared/permissions.ts (after)
export async function canPost(
  role: string,
  resource: PostableResource,
  orgId: string,
): Promise<boolean>;

export async function canAccess(
  role: string,
  resource: Resource,
  action: Action,
  orgId: string,
): Promise<boolean>;
```

Rationale for a facade (vs inlining): one invalidation/TTL story, one test surface, preserves testability via `_resetCache()`.

**Verdict**: YES — async facade, 2 service files updated.

### D.8 — `Role` type widening

**Choice**: Keep a narrow `SystemRole = 'owner' | 'admin' | 'contador' | 'cobrador' | 'auxiliar' | 'member'` union for internal guards (e.g., `isSystemRole(slug)`). Rename the public-facing `Role` to `type Role = string` (alias). Narrowing points:

- `features/shared/permissions.ts` → exports both `Role` (= string) and `SystemRole` (= 6-literal union) + `SYSTEM_ROLES: readonly SystemRole[]`.
- `features/organizations/members.validation.ts` → switches from `z.enum(assignableRoles)` to `z.string().refine(asyncOrgSlugCheck)` (see D.9).
- Test fixtures using `Role` keep working (string assignable).
- Components reading `useOrgRole()` get `string` — no compile errors because usage is always `role === 'owner'` etc., which is still valid.

**Verdict**: YES — `Role = string`, `SystemRole` preserved for system-row logic only.

### D.9 — `assignableRoles` Zod async validation

**Choice**: Schema-level async refine, invoked in the **validation layer** (pre-service), with `orgId` injected via a factory.

```ts
// features/organizations/members.validation.ts (after)
export const buildAddMemberSchema = (orgId: string) =>
  z.object({
    email: z.string().email("Email inválido"),
    role: z.string().min(1, "Rol requerido").refine(
      async (slug) => await rolesService.exists(orgId, slug),
      { message: "Rol inexistente en esta organización" },
    ),
  });
```

Handlers call `await buildAddMemberSchema(orgId).parseAsync(body)` before `membersService.addMember(...)`. Rationale: keeps service pure (sync invariant), matches existing Zod-first pipeline.

**Verdict**: YES — async refine, validation layer, factory pattern for `orgId`.

### D.10 — API surface & error codes

| Route | Method | Payload | Success | Error codes |
|-------|--------|---------|---------|-------------|
| `/api/organizations/[orgSlug]/roles` | GET | — | 200 `{ roles: RoleDto[] }` | 403 |
| `/api/organizations/[orgSlug]/roles` | POST | `{ name, slug?, templateSlug, permissionsRead?, permissionsWrite?, canPost? }` | 201 `{ role }` | 422 `RESERVED_SLUG` / `INVALID_PAYLOAD`; 409 `SLUG_COLLISION`; 403 |
| `/api/organizations/[orgSlug]/roles/[roleSlug]` | GET | — | 200 `{ role }` | 404; 403 |
| `/api/organizations/[orgSlug]/roles/[roleSlug]` | PATCH | `{ name?, description?, permissionsRead?, permissionsWrite?, canPost? }` | 200 `{ role }` | 422 `SYSTEM_ROLE_IMMUTABLE` / `INVALID_PAYLOAD`; 403 `CANNOT_SELF_LOCK`; 404 |
| `/api/organizations/[orgSlug]/roles/[roleSlug]` | DELETE | — | 204 | 422 `SYSTEM_ROLE_IMMUTABLE`; 409 `ROLE_IN_USE`; 404; 403 |

- **Idempotent**: GET, DELETE (second call → 404).
- **409 vs 422 vs 403**: 409 = state conflict (slug taken, role assigned to members). 422 = payload/invariant violation (reserved slug, system-row mutation, unknown resource). 403 = authn/authz (not admin, self-lock).
- All routes gate with `requirePermission('members','write'|'read', orgSlug)` — **no new resource in the matrix**; role admin is part of `members`.

**Verdict**: YES — 5 routes, stable error taxonomy, reuses `members` resource.

### D.11 — Array ordering on write

**Choice**: Normalize (sort ASCII-ascending) `permissionsRead`, `permissionsWrite`, `canPost` on every INSERT/UPDATE in `RolesService`. Deduplicate with `Set`.

Rationale: (a) cache-key stability — if we ever hash the matrix for ETag, sorted arrays make it deterministic; (b) diff-friendly in audit logs; (c) no user-visible cost. Done in the service, not Zod, because Zod `.transform` would leak into the API response — normalization is an internal invariant.

**Verdict**: YES — normalize + dedupe in service layer on write.

### D.12 — Multi-instance cache consistency

**Choice**: **Document explicitly** that up to 60s drift on multi-instance Vercel deploys is ACCEPTABLE (proposal R-1). Concretely:

- Instance A mutates role X at t=0 → `revalidateOrgMatrix(orgId)` hits A's local Map only.
- Instance B holds a stale matrix until its entry's `expiresAt` (≤60s from its own load time).
- Acceptable because: (a) single-region SMB deployment; (b) permission flips are admin-driven, low-frequency; (c) the worst case is a user sees an old permission for ≤60s — no data corruption because mutating services re-check against the CURRENT cached matrix, which that instance itself invalidated on its last write.

If this becomes a problem, migrate to Redis pub/sub for `revalidateOrgMatrix` fan-out — already anticipated in proposal but explicitly out of scope.

**Verdict**: YES — documented as acceptable, no cross-instance invalidation.

## Data Flow

```
PATCH /api/organizations/acme/roles/facturador
        │
        ▼
  Zod validate (422 on reserved slug / unknown resource)
        │
        ▼
  requirePermission('members','write',orgSlug)  ── reads cache (getMatrix)
        │
        ▼
  RolesService.updateRole
      ├── isSystem guard       (422 SYSTEM_ROLE_IMMUTABLE)
      ├── self-lock guard D.4  (403 CANNOT_SELF_LOCK)
      ├── normalize arrays D.11
      ├── prisma.customRole.update
      └── revalidateOrgMatrix(orgId)   ── drops local Map entry
        │
        ▼
  200 { role }

Read path (any API call):
  handler → requirePermission → getMatrix(orgId)
                                    ├── cache hit → return
                                    └── miss → prisma query → seed-if-empty (D.6) → fill → return
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `CustomRole` model + `Organization.customRoles` relation |
| `prisma/migrations/*_custom_roles/migration.sql` | Create | Additive migration |
| `prisma/seeds/custom-roles.ts` | Create | Idempotent seed for existing orgs |
| `features/shared/permissions.ts` | Modify | `Role = string`; keep `SystemRole`; `canAccess`/`canPost` become async + `orgId`-aware |
| `features/shared/permissions.server.ts` | Modify | `requirePermission` calls `getMatrix(orgId)` internally |
| `features/shared/permissions.cache.ts` | Create | Module-scope Map + single-flight + TTL + `revalidateOrgMatrix` |
| `features/shared/errors.ts` | Modify | Add `CANNOT_SELF_LOCK`, `SYSTEM_ROLE_IMMUTABLE`, `RESERVED_SLUG`, `SLUG_COLLISION`, `ROLE_IN_USE` |
| `features/organizations/roles/roles.service.ts` | Create | CRUD + self-lock + normalize |
| `features/organizations/roles/roles.repository.ts` | Create | Prisma queries |
| `features/organizations/roles/roles.validation.ts` | Create | Zod schemas + slugify + reserved-slug guard |
| `features/organizations/members.validation.ts` | Modify | Async `role` refine via `rolesService.exists` |
| `features/organizations/members.service.ts` | Modify | Pass `orgId` to validation factory; no new guards (self-lock already covered) |
| `features/sale/sale.service.ts` | Modify | `await canPost(role, 'sales', orgId)` |
| `features/purchase/purchase.service.ts` | Modify | `await canPost(role, 'purchases', orgId)` |
| `app/api/organizations/[orgSlug]/roles/route.ts` | Create | GET list, POST create |
| `app/api/organizations/[orgSlug]/roles/[roleSlug]/route.ts` | Create | GET, PATCH, DELETE |
| `app/(dashboard)/[orgSlug]/settings/roles/page.tsx` | Modify | Read-only matrix → CRUD shell |
| `components/settings/roles-permissions-matrix.tsx` | Modify | Add edit mode + form controls |
| `components/settings/role-form.tsx` | Create | Create/edit role drawer |
| `components/common/gated.tsx`, `hooks/use-org-role.ts` | Modify | Delegate to `/api/organizations/[slug]/roles` matrix payload |
| `features/shared/services/webhooks/sync-organization.ts` | Modify | Seed 6 system roles on org creation |

## Testing Strategy (Strict TDD)

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `slugify`, reserved-slug guard, array normalize, `isSystemRole` | Pure functions; table-driven |
| Unit | `permissions.cache` — hit/miss/TTL/size cap/single-flight/invalidate | Fake clock + spy on Prisma |
| Unit | `RolesService.updateRole` self-lock D.4 | Mock repo; caller == target role; assert `CANNOT_SELF_LOCK` |
| Unit | `canAccess`/`canPost` async via matrix | Test against seeded in-memory matrix |
| Integration | Role CRUD API (all 5 routes, all error codes) | Prisma test DB; full HTTP pipeline |
| Integration | `requirePermission` with dynamic matrix (system + custom role) | Prisma test DB; simulate 62+ routes via 1 representative test |
| Integration | Seed fallback inside `getMatrix` (empty org → 6 rows appear) | Truncate `custom_roles`; call API; assert rows |
| Integration | `sale.service.post` + `purchase.service.post` with custom role having `canPost` toggled | Existing post tests extended |
| E2E (optional) | `/settings/roles` create → assign to member → verify permission in UI | Playwright; 1 happy path |

## Migration / Rollout

1. Deploy migration + seed (all existing orgs get 6 system rows).
2. Deploy backend with dual-read safety: `getMatrix` fallback seeder catches any org the migration missed.
3. Deploy UI (`/settings/roles` CRUD).
4. Monitor: cache hit rate, seed-fallback fires (should be 0 post-deploy), `CANNOT_SELF_LOCK` 403 rate.

Rollback: revert UI → revert backend → drop `custom_roles` table. All steps are additive-only; no existing column widened.

## Open Questions

None. All D.1..D.12 locked.
