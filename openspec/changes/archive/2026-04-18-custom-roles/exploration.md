# Exploration: custom-roles

## Current State

### RBAC Framework (post accounting-rbac, closed 2026-04-17)

**Permissions encoding** (`features/shared/permissions.ts`):
- `Role` union: `owner | admin | contador | cobrador | auxiliar | member` (6 hardcoded literals)
- `Resource` union: 12 resources (`members`, `accounting-config`, `sales`, `purchases`, `payments`, `journal`, `dispatches`, `reports`, `contacts`, `farms`, `documents`, `agent`)
- `Action`: `read | write`
- Two separate maps: `PERMISSIONS_READ: Record<Resource, Role[]>` and `PERMISSIONS_WRITE: Record<Resource, Role[]>` — the matrix is **module-level constants**, evaluated once at server startup, static for the lifetime of the process.
- `canAccess(role, resource, action): boolean` — pure function, no DB hit.
- `canPost(role, "sales"|"purchases"|"journal"): boolean` — separate `POST_ALLOWED_ROLES` map, also a module-level constant.
- RAG/upload scopes also hardcoded per role.

**Server-side enforcement** (`features/shared/permissions.server.ts`):
- `requirePermission(resource, action, orgSlug)` — single gate for all 62+ API routes.
  Calls `requireAuth() → requireOrgAccess() → requireRole()` in sequence; looks up `OrganizationMember.role` from DB on every request.

**Client gating** (`components/common/gated.tsx`, `use-org-role.ts`):
- `useOrgRole()` fetches `/api/organizations/{slug}/members/me` once per mount, stores role in state.
- `useCanAccess(resource, action)` + `<Gated resource action>` delegate to `canAccess(role, resource, action)` — comparing DB-fetched role string against the static maps.

**OrganizationMember.role** (`prisma/schema.prisma`):
- `role String @default("member")` — free string, NO DB enum. Already flexible enough to store arbitrary role slugs.

**Members validation** (`features/organizations/members.validation.ts`):
- `assignableRoles = ["admin", "contador", "cobrador", "auxiliar", "member"]` — Zod enum, hardcoded.
- Both `addMemberSchema` and `updateRoleSchema` validate against this closed list.

**Self-lock guard** (`features/organizations/members.service.ts`):
- `updateRole()` throws `ForbiddenError(CANNOT_CHANGE_OWN_ROLE)` if `member.user.clerkUserId === currentClerkUserId`.
- `removeMember()` applies the same guard — cannot deactivate yourself.
- Owner row cannot be updated or removed (separate guard).

**Caching**:
- NO Redis, NO lru-cache, NO `unstable_cache` found anywhere in the project.
- Role resolution is a live DB lookup on every `requirePermission` call. No caching layer exists today.

**`/settings/roles` viewer**: read-only page for `admin`+ (`requirePermission("accounting-config", "read", orgSlug)`). Renders `RolesPermissionsMatrix` component — hardcoded static table.

**`POST_ALLOWED_ROLES`**: referenced only in `features/shared/permissions.ts` (definition) + `features/sale/sale.service.ts`, `features/purchase/purchase.service.ts`, `features/accounting/journal.service.ts` (consumption via `canPost()`). It is a 3-entry constant for the W-draft enforcement dimension.

**Call site volume**: ~68 route files import `requirePermission`/`canAccess`; 200 total occurrences.

---

## Affected Areas

- `features/shared/permissions.ts` — `canAccess` must read from DB-driven matrix instead of static maps; `Role` type widens to `string` for custom slugs; `POST_ALLOWED_ROLES` decision TBD
- `features/shared/permissions.server.ts` — `requirePermission` must resolve the matrix for the org dynamically (cache layer here)
- `prisma/schema.prisma` — new `CustomRole` model + seeding for system roles per-org
- `features/organizations/members.validation.ts` — `assignableRoles` Zod enum must open to accept custom slugs
- `features/organizations/members.service.ts` — no structural change, but slug validation for custom roles
- `components/common/gated.tsx` + `use-org-role.ts` — minor: client-side `canAccess` must also use dynamic matrix (fetched with the role, or shipped in the `/members/me` response)
- `app/(dashboard)/[orgSlug]/settings/roles/page.tsx` — evolves from read-only matrix viewer to editable custom-roles CRUD hub
- All 62+ API route files — **no change needed**: they call `requirePermission(resource, action, orgSlug)` which already encapsulates the lookup; only the internals of `requirePermission` change
- New API routes needed: `GET/POST /api/organizations/[orgSlug]/roles`, `GET/PATCH/DELETE /api/organizations/[orgSlug]/roles/[roleSlug]`

---

## Approaches

### 1. DB-per-org matrix with Next.js in-memory cache (recommended)

Introduce a `CustomRole` Prisma model: `{ id, organizationId, slug, name, isSystem, permissionsRead: String[], permissionsWrite: String[], canPost: String[] }`. Seed the 6 system roles as `isSystem: true` rows per org on first access or via migration script. `requirePermission` loads the org's effective matrix from DB, cached in-process with a short TTL (e.g. via a simple `Map<orgId, { matrix, ts }>` or Next.js `unstable_cache`).

- Pros: no new infra (no Redis needed); matrix is org-scoped as decided; backward-compatible with existing `requirePermission` signature; system roles protected by `isSystem` flag; `canAccess` stays a pure function (caller passes the matrix snapshot); `POST_ALLOWED_ROLES` folds in as a third dimension column on the model.
- Cons: in-memory cache is per-process (multi-instance deployments lose cross-instance coherence; on Vercel this is acceptable for short TTL ≤60s); cache eviction must be triggered on role edit; system role seeding must be idempotent and run before first permission check.
- Effort: **Medium** (new model + migration + seed + cache layer + CRUD API + UI; route files untouched).

### 2. DB-per-org matrix with Redis cache

Same model as Approach 1 but use Redis (e.g. Upstash) for cross-instance cache coherence.

- Pros: cache coherence across all Next.js instances; sub-millisecond reads; good for high-traffic multi-region.
- Cons: Redis not set up in this project (no dep, no env var); adds infra cost and complexity; overkill for a single-region SMB accounting app with <100 members per org.
- Effort: **High** (infra setup + Approach 1 work).

### 3. Flatten permissions into OrganizationMember (per-user ACL)

Store permissions directly on each member row, no role concept.

- Pros: maximum flexibility.
- Cons: explicitly discarded by user decision. Not explored further.
- Effort: **Very High**.

### 4. Hybrid — system roles stay static, custom roles DB-only

Keep `PERMISSIONS_READ/WRITE` for the 6 system roles (zero latency, no DB hit). Add a `CustomRole` model only for new org-created roles. `requirePermission` first checks if the member's role is a known system role (static lookup) else falls back to DB.

- Pros: zero latency for 99% of calls (most members will have system roles); no cache needed for system roles.
- Cons: dual lookup path increases complexity; harder to unit-test the combined path; breaks the single-source-of-truth goal (matrix split across code and DB); custom roles can't "inherit" from system roles cleanly.
- Effort: **Medium** (slightly simpler than Approach 1 for reads, but more complex branching logic).

---

## Recommendation

**Approach 1 — DB-per-org matrix with in-process cache**.

Rationale:
- No new infra required. The project has no Redis and no caching layer today — adding one for this use case is disproportionate.
- A per-process `Map` with 60s TTL is sufficient: Vercel serverless functions are short-lived; multi-instance drift resolves within 60s; a `revalidateOrgMatrix(orgId)` call on every admin edit clears the cache entry immediately.
- Keeps `requirePermission` signature **unchanged** — all 62+ route files are untouched.
- System roles as DB rows (isSystem: true) gives the matrix a single source of truth — the read-only viewer and the editor both read from the same table.
- `POST_ALLOWED_ROLES` (W-draft) should become a third column (`canPost: String[]`) on the `CustomRole` model — this makes it editable per org, consistent with the rest of the matrix, and eliminates the separate hardcoded constant.

**Open Questions — Resolved:**

| Question | Answer |
|---|---|
| Cache: in-memory vs Redis | In-memory Map with 60s TTL + explicit invalidation on edit. No Redis needed. |
| POST_ALLOWED_ROLES editable? | Yes — fold into CustomRole model as `canPost: String[]`. No reason to keep it hardcoded if the rest of the matrix is editable. |
| Inherit from system role vs start empty? | Start from a copy of a chosen system role's permissions (template). Admin picks "base role" on create; the copy is immediately editable. Custom roles do NOT link/inherit at runtime — snapshot only. |
| Slug: user-generated vs auto-derived? | Auto-derived from name (`"Mi Rol"` → `"mi-rol"`), editable before save, unique per-org (DB unique constraint `@@unique([organizationId, slug])`). |
| Migration — seed system roles per org | Idempotent migration script: for each existing `Organization`, upsert 6 system role rows (`isSystem: true`) using `createMany({ skipDuplicates: true })`. Runs once. New orgs seeded in `syncOrganization()`. |
| Self-lock guard | Extend the existing guard in `updateRole()`: if the target member is the caller AND the new custom role lacks `members.write`, throw a new `ForbiddenError("WOULD_LOCK_ORG")`. Additionally, refuse to delete a custom role if any admin (including the last one) is assigned it. |

---

## Risks

- **R-1 — Cache staleness on multi-instance deploys**: in-process cache diverges between Vercel function instances for up to TTL seconds after a role edit. Mitigated by: TTL ≤60s + immediate invalidation in the edit API handler.
- **R-2 — System role seeding at migration time**: must be idempotent (use `skipDuplicates`); must run before any permission check that hits the DB path. If migration is missed, all users lose access. Mitigation: add a fallback in `requirePermission` that seeds system roles on-demand if missing for the org.
- **R-3 — assignableRoles Zod enum must open**: `members.validation.ts` currently validates against a closed enum. For custom roles it needs runtime validation (fetch valid slugs for org, or accept any `string` with server-side existence check). This creates an async validation path.
- **R-4 — POST_ALLOWED_ROLES migration**: service files (`sale.service.ts`, `purchase.service.ts`, `journal.service.ts`) call `canPost(role, resource)` against the static constant. Must be refactored to accept the org matrix. Scope: 3 service files.
- **R-5 — Self-lock edge case**: an admin editing a custom role they are currently assigned could remove `members.write` from it, locking themselves out. Need a runtime check at PATCH `/roles/[roleSlug]` in addition to the member-level guard.
- **R-6 — /settings/roles page complexity**: evolves from a static table to a full CRUD page (list, create dialog, edit permissions grid, delete with guard). Significant UI work.
- **R-7 — Test matrix expansion**: system roles = 144 unit cases (existing); each custom role configuration is user-defined so integration tests must cover the DB-driven path end-to-end, not just the static map.

---

## Ready for Proposal

**Yes.** Scope is concrete, the chosen approach (Approach 1) is validated against the existing codebase, and all open questions are resolved. Recommend proceeding to `sdd-propose` with the following framing:

- **Change name**: `custom-roles`
- **Core deliverable**: `CustomRole` DB model + per-org matrix cache + editable `/settings/roles` page + CRUD API
- **System roles**: immutable, seeded as `isSystem: true` rows
- **Constraint**: `requirePermission` signature unchanged — route sweep NOT needed
- **Strict TDD**: enabled project-wide — apply to all new units
