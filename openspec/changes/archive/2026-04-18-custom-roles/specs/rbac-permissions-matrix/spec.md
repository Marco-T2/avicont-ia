# Delta for rbac-permissions-matrix

## MODIFIED Requirements

### Requirement: Authorization Matrix

The system MUST expose a `canAccess(role, resource, action)` function where `action ∈ {"read", "write"}` and `role` is a `string` (no longer a closed literal union). For any call, the function MUST load the org's permission matrix from the in-process cache (keyed by `orgId`, TTL 60s) and evaluate the tuple against it. System roles retain their hardcoded matrix as the initial snapshot. Any call with a tuple not in the matrix returns `false`.

(Previously: `role` was constrained to 6 literals; matrix was a static in-memory map; no cache or org scope.)

#### Scenario: P.2-S1 — contador lee reports

- GIVEN role `contador` in org `alpha`
- WHEN `canAccess("contador", "reports", "read")` is called with `orgId: "alpha"`
- THEN returns `true` (matches seeded system snapshot)

#### Scenario: P.2-S2 — cobrador no toca journal

- GIVEN role `cobrador` in org `alpha`
- WHEN `canAccess("cobrador", "journal", "write")` or `"read"` is called
- THEN returns `false`

#### Scenario: P.2-S3 — auxiliar crea dispatch

- GIVEN role `auxiliar` in org `alpha`
- WHEN `canAccess("auxiliar", "dispatches", "write")` is called
- THEN returns `true`

#### Scenario: P.2-S4 — custom role resolves from cache

- GIVEN org `alpha` has custom role `facturador` with `journal.write = true` in DB
- AND the matrix is loaded into the in-process cache
- WHEN `canAccess("facturador", "journal", "write")` is called
- THEN returns `true` without hitting the DB

#### Scenario: P.2-S5 — stale cache evicted after TTL

- GIVEN the matrix for org `alpha` was cached 61 seconds ago
- WHEN `canAccess` is called
- THEN the cache entry is considered expired and the matrix is reloaded from DB

---

### Requirement: Server-Side Enforcement

The system MUST enforce authorization via `requirePermission(resource, action, orgSlug)`. The function signature MUST remain frozen — no call sites are modified. Internally, it MUST resolve the org's matrix from the cache (or trigger fallback seed if the org has no roles). Routes MUST NOT rely on `requireRole([...])` after migration is complete. Unauthorized calls MUST return HTTP 403 with error code `FORBIDDEN`.

(Previously: `requirePermission` resolved against a static map; no cache or fallback seed.)

#### Scenario: P.3-S1 — cobrador POST journal → 403

- GIVEN `cobrador` authenticated in org
- WHEN they POST `/api/.../journal`
- THEN response is 403 with `{ code: "FORBIDDEN" }`

#### Scenario: P.3-S2 — contador POST sale → 201

- GIVEN `contador` authenticated in org
- WHEN they POST `/api/.../sales`
- THEN response is 201

#### Scenario: P.3-S3 — auxiliar POST sale draft OK, POST post → 403

- GIVEN `auxiliar` authenticated in org
- WHEN they POST `/api/.../sales` con `postImmediately: true`
- THEN response is 403

#### Scenario: P.3-S4 — requirePermission signature frozen

- GIVEN 62+ existing route call sites using `requirePermission(resource, action, orgSlug)`
- WHEN the matrix becomes DB-driven
- THEN no call site is modified; a contract test asserts the function accepts exactly those 3 arguments

## ADDED Requirements

### Requirement: P.5 — Per-Org Matrix Cache

The system MUST maintain an in-process `Map<orgId, { matrix, loadedAt }>` cache with a 60-second TTL. On every successful role mutation (POST, PATCH, DELETE to `/roles`), `revalidateOrgMatrix(orgId)` MUST be called to evict the entry immediately. Cache reads that find a stale or missing entry MUST reload from DB synchronously before returning.

#### Scenario: P.5-S1 — explicit invalidation on PATCH

- GIVEN org `alpha` matrix is cached
- WHEN admin PATCHes a role in `alpha`
- THEN `revalidateOrgMatrix("alpha")` is called and the next `canAccess` call fetches fresh data

#### Scenario: P.5-S2 — no cross-org contamination

- GIVEN org `alpha` and org `beta` both have cached matrices
- WHEN `revalidateOrgMatrix("alpha")` is called
- THEN org `beta`'s cache entry is unaffected

### Requirement: P.6 — canPost via Matrix

The system MUST resolve posting eligibility via `matrix.canPost` for each role (replacing the static `POST_ALLOWED_ROLES` map). Sale, purchase, and journal posting services MUST consult the org's cached matrix to determine if the caller's role has `canPost = true`.

#### Scenario: P.6-S1 — canPost true allows posting

- GIVEN custom role `facturador` with `canPost = true` in org `alpha`
- WHEN a member with role `facturador` attempts to POST a sale
- THEN the post-eligibility check passes

#### Scenario: P.6-S2 — canPost false blocks posting

- GIVEN role `auxiliar` with `canPost = false` in org `alpha`
- WHEN a member with role `auxiliar` attempts to POST a sale
- THEN the response is 403
