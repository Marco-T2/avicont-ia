# Delta for rbac-roles

## MODIFIED Requirements

### Requirement: Role Set

The system MUST define a base set of 6 system roles (`owner`, `admin`, `contador`, `cobrador`, `auxiliar`, `member`) stored in the DB with `isSystem = true`. The `Role` type MUST widen from a closed literal union to `string` to accommodate custom role slugs. The closed set of system slugs MUST remain available as a const tuple for type-narrowing purposes. Custom roles extend this set per organization with `isSystem = false`.

(Previously: `Role` was a closed literal union of exactly 6 values; no custom roles existed; no DB representation.)

#### Scenario: R.1-S1 — assignable system roles

- GIVEN an authenticated `admin`
- WHEN they POST `/members` with `role: "cobrador"` or `"auxiliar"`
- THEN the request succeeds with 201

#### Scenario: R.1-S2 — owner not assignable via members API

- GIVEN an authenticated `admin`
- WHEN they POST `/members` with `role: "owner"`
- THEN the request fails with 422 validation error

#### Scenario: R.1-S3 — custom role slug accepted

- GIVEN org `A` has custom role with slug `facturador`
- WHEN admin POSTs `/members` with `role: "facturador"`
- THEN the request succeeds with 201 (async Zod validation passes)

#### Scenario: R.1-S4 — unknown slug rejected

- GIVEN org `A` does NOT have a role `cajero`
- WHEN admin POSTs `/members` with `role: "cajero"`
- THEN the request fails with 422

---

### Requirement: Role Mutability via Admin

The system SHALL allow `owner` and `admin` to change another member's role via PATCH, where the new role MUST exist in the org's `CustomRole` table (system or custom). Members MUST NOT be able to change their own role. Role changes that would trigger the self-lock guard (CR.6) on the caller's own role assignment MUST be blocked.

(Previously: no self-lock guard extension; no async role validation against DB.)

#### Scenario: R.3-S1 — admin modifica rol

- GIVEN an authenticated `admin`
- WHEN they PATCH `/members/{memberId}` with `{role: "contador"}`
- THEN the role is updated and 200 is returned

#### Scenario: R.3-S2 — self-role change rechazado

- GIVEN a `contador` authenticated as their own member row
- WHEN they PATCH their own member with `{role: "admin"}`
- THEN the request fails with 403

#### Scenario: R.3-S3 — assign custom role

- GIVEN custom role `facturador` exists in the org
- WHEN admin PATCHes a member to `role: "facturador"`
- THEN the update succeeds and the member now resolves permissions through the `facturador` matrix

## ADDED Requirements

### Requirement: R.4 — Role CRUD API

The system MUST expose a REST API for role management scoped to an organization:

| Method | Path | Who |
|--------|------|-----|
| GET | `/api/organizations/[orgSlug]/roles` | owner, admin |
| POST | `/api/organizations/[orgSlug]/roles` | owner, admin |
| GET | `/api/organizations/[orgSlug]/roles/[roleSlug]` | owner, admin |
| PATCH | `/api/organizations/[orgSlug]/roles/[roleSlug]` | owner, admin |
| DELETE | `/api/organizations/[orgSlug]/roles/[roleSlug]` | owner, admin |

All endpoints MUST be protected by `requirePermission("members", "write", orgSlug)`.

#### Scenario: R.4-S1 — GET returns system and custom roles

- GIVEN org `alpha` with 6 system roles and 1 custom role
- WHEN admin GETs `/api/organizations/alpha/roles`
- THEN the response contains 7 roles, each with `id`, `slug`, `name`, `isSystem`, `canPost`, and `matrix`

#### Scenario: R.4-S2 — member cannot access roles API

- GIVEN a `member` (no write on `members`)
- WHEN they GET `/api/organizations/alpha/roles`
- THEN the response is 403
