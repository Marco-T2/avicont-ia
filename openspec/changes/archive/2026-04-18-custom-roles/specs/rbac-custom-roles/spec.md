# rbac-custom-roles Specification

## Purpose

Define the full lifecycle of per-organization custom roles: creation from a system template, editing of matrix and canPost flags, deletion with guards, slug uniqueness, and system-role immutability. This is a NEW capability introduced by the `custom-roles` change.

## Requirements

### Requirement: CR.1 — System Role Seeding

The system SHALL seed exactly 6 system roles (`owner`, `admin`, `contador`, `cobrador`, `auxiliar`, `member`) for every organization idempotently. Seeding MUST occur via migration for existing orgs and via `syncOrganization()` for new orgs. If seeding was missed, `requirePermission` MUST trigger a fallback seed before evaluating any permission.

#### Scenario: CR.1-S1 — idempotent seed on existing org

- GIVEN an org that already has all 6 system roles seeded
- WHEN the seed migration runs again (e.g., re-deploy)
- THEN no duplicate rows are created and the existing rows are unchanged

#### Scenario: CR.1-S2 — new org receives system roles

- GIVEN a new organization is created via Clerk webhook
- WHEN `syncOrganization()` is called
- THEN the org has exactly 6 rows with `isSystem = true`, one per system slug

#### Scenario: CR.1-S3 — fallback seed in requirePermission

- GIVEN an org that somehow has zero `CustomRole` rows (missed migration)
- WHEN any API route calls `requirePermission(resource, action, orgSlug)`
- THEN the 6 system roles are seeded before the permission check proceeds, and the check returns the correct result

---

### Requirement: CR.2 — System Role Immutability

The system MUST reject PATCH and DELETE requests targeting any role where `isSystem = true`. The API MUST return HTTP 403 with error code `SYSTEM_ROLE_IMMUTABLE`. The UI MUST NOT render edit or delete controls for system roles.

#### Scenario: CR.2-S1 — PATCH system role rejected

- GIVEN role `contador` with `isSystem = true`
- WHEN an admin sends PATCH `/api/organizations/[orgSlug]/roles/contador`
- THEN the response is 403 with `{ code: "SYSTEM_ROLE_IMMUTABLE" }`

#### Scenario: CR.2-S2 — DELETE system role rejected

- GIVEN role `owner` with `isSystem = true`
- WHEN an admin sends DELETE `/api/organizations/[orgSlug]/roles/owner`
- THEN the response is 403 with `{ code: "SYSTEM_ROLE_IMMUTABLE" }`

#### Scenario: CR.2-S3 — UI hides controls for system roles

- GIVEN the `/settings/roles` page listing system roles
- WHEN an `admin` views the list
- THEN no Edit or Delete button is rendered next to any system role row

---

### Requirement: CR.3 — Custom Role Creation from Template

The system SHALL allow an `owner` or `admin` to create a custom role by selecting a system role as a template. The new role MUST receive a snapshot of the template's permission matrix at creation time. Changes to the template after creation MUST NOT affect the custom role.

#### Scenario: CR.3-S1 — create custom role from template

- GIVEN an `admin` POSTs `{ name: "Facturador", templateSlug: "contador" }` to `/api/organizations/[orgSlug]/roles`
- WHEN the request is processed
- THEN a new `CustomRole` row is created with `isSystem = false`, slug `facturador`, and the same matrix snapshot as `contador` at that moment

#### Scenario: CR.3-S2 — snapshot independence

- GIVEN a custom role `facturador` created from template `contador`
- WHEN the `contador` system role matrix is (hypothetically) updated in a future migration
- THEN `facturador` retains its snapshotted matrix and is unaffected

#### Scenario: CR.3-S3 — unauthorized user cannot create role

- GIVEN a `contador` (not owner/admin)
- WHEN they POST to `/api/organizations/[orgSlug]/roles`
- THEN the response is 403

---

### Requirement: CR.4 — Slug Auto-Derivation and Uniqueness

The system MUST auto-derive a slug from the role name (lowercase, spaces → hyphens, special chars stripped). The slug MUST be editable before first save. The combination `(organizationId, slug)` MUST be unique. Duplicate slug submissions MUST return HTTP 422 with error code `SLUG_TAKEN`.

#### Scenario: CR.4-S1 — slug auto-derived

- GIVEN `name: "Mi Rol Especial"`
- WHEN the creation form computes the slug
- THEN the slug preview shows `mi-rol-especial`

#### Scenario: CR.4-S2 — duplicate slug rejected

- GIVEN org `A` already has a role with slug `facturador`
- WHEN a second POST to the same org sends `slug: "facturador"`
- THEN the response is 422 with `{ code: "SLUG_TAKEN" }`

#### Scenario: CR.4-S3 — same slug in different org is allowed

- GIVEN org `A` has slug `facturador` and org `B` does not
- WHEN org `B` POSTs a role with slug `facturador`
- THEN the request succeeds with 201

---

### Requirement: CR.5 — Custom Role Editing (Matrix + canPost)

The system SHALL allow an `owner` or `admin` to edit any non-system role's permission matrix and `canPost` flag via PATCH. Every successful PATCH MUST trigger `revalidateOrgMatrix(orgId)` to invalidate the in-process cache.

#### Scenario: CR.5-S1 — edit matrix cell

- GIVEN custom role `facturador` with `canAccess("facturador", "journal", "write") === false`
- WHEN admin PATCHes `{ matrix: { journal: { write: true } } }`
- THEN the role is updated and within ≤60s `canAccess("facturador", "journal", "write")` returns `true` on all instances

#### Scenario: CR.5-S2 — edit canPost flag

- GIVEN custom role `facturador` with `canPost: false`
- WHEN admin PATCHes `{ canPost: true }`
- THEN the role allows the posting flow for members assigned to `facturador`

#### Scenario: CR.5-S3 — cache invalidated on PATCH

- GIVEN the org matrix is cached in-process
- WHEN a PATCH succeeds
- THEN `revalidateOrgMatrix(orgId)` is called and subsequent permission checks load fresh data

---

### Requirement: CR.6 — Self-Lock Guard (D.4 Extension)

The system MUST block any PATCH that would remove `members.write` access from the caller's own currently-assigned role. The API MUST return HTTP 403 with error code `SELF_LOCK_GUARD`. This guard applies to custom roles only (system roles are already immutable).

#### Scenario: CR.6-S1 — self-lock blocked

- GIVEN an `admin` whose current role is `facturador` (custom)
- WHEN they PATCH `facturador` to set `members.write = false`
- THEN the response is 403 with `{ code: "SELF_LOCK_GUARD" }`

#### Scenario: CR.6-S2 — other admin not blocked

- GIVEN admin `A` whose role is `admin` (system), and custom role `facturador` exists
- WHEN `A` PATCHes `facturador` to set `members.write = false`
- THEN the PATCH succeeds (guard only applies when caller's OWN role is the one being modified)

---

### Requirement: CR.7 — Custom Role Deletion with Member Guard

The system MUST reject DELETE if any `OrganizationMembership` row is currently assigned to that role. The API MUST return HTTP 409 with error code `ROLE_HAS_MEMBERS`. Only roles with zero assigned members MAY be deleted.

#### Scenario: CR.7-S1 — delete blocked by members

- GIVEN custom role `facturador` has 2 members assigned
- WHEN admin sends DELETE `/api/organizations/[orgSlug]/roles/facturador`
- THEN the response is 409 with `{ code: "ROLE_HAS_MEMBERS" }`

#### Scenario: CR.7-S2 — delete succeeds when empty

- GIVEN custom role `facturador` has zero members assigned
- WHEN admin sends DELETE
- THEN the response is 200 and the role row is removed

---

### Requirement: CR.8 — assignableRoles Async Validation

The system MUST validate `assignableRoles` (member PATCH payload) asynchronously against the org's current role slugs. Any slug not present in the org's `CustomRole` table MUST cause a 422 response. This replaces the previous static Zod enum.

#### Scenario: CR.8-S1 — valid org role accepted

- GIVEN org `A` has roles `admin`, `contador`, `facturador`
- WHEN a member PATCH sends `role: "facturador"`
- THEN the request passes validation

#### Scenario: CR.8-S2 — unknown slug rejected

- GIVEN org `A` does NOT have a role slug `cajero`
- WHEN a member PATCH sends `role: "cajero"`
- THEN the response is 422 with a validation error
