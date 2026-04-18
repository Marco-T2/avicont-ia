# rbac-roles Specification

## Purpose

Define el conjunto cerrado de roles asignables por organización, su asignación por miembro, y la API de administración. Los roles gobiernan qué recursos y acciones puede ejecutar cada usuario dentro de una organización.

## Requirements

### Requirement: Role Set

The system MUST define exactly 6 roles: `owner`, `admin`, `contador`, `cobrador`, `auxiliar`, `member`. The first 5 are assignable via the members admin UI/API. `owner` is set implicitly when the user creates the organization and is not reassignable via members API.

#### Scenario: R.1-S1 — Asignables en members API

- GIVEN an authenticated `admin`
- WHEN they POST `/members` with `role: "cobrador"` or `"auxiliar"`
- THEN the request succeeds with 201

#### Scenario: R.1-S2 — owner no asignable

- GIVEN an authenticated `admin`
- WHEN they POST `/members` with `role: "owner"`
- THEN the request fails with 422 validation error

#### Scenario: R.1-S3 — rol inválido

- GIVEN an authenticated `admin`
- WHEN they POST `/members` with `role: "super-admin"` (not in enum)
- THEN the request fails with 422

---

### Requirement: Per-Org Role Scope

The system MUST scope roles per `(organizationId, userId)`. A user MAY hold different roles in different organizations. A user MUST hold at most one role per organization.

#### Scenario: R.2-S1 — mismo user, orgs distintas

- GIVEN user `U` is `admin` in org `A` and `cobrador` in org `B`
- WHEN `U` fetches `/api/organizations/B/members/me`
- THEN the response returns `role: "cobrador"`

#### Scenario: R.2-S2 — duplicado rechazado

- GIVEN user `U` is already member of org `A`
- WHEN another POST attempts to add `U` to org `A` again
- THEN the request fails with 409 (duplicate)

---

### Requirement: Role Mutability via Admin

The system SHALL allow `owner` and `admin` to change another member's role via PATCH. Members MUST NOT be able to change their own role.

#### Scenario: R.3-S1 — admin modifica rol

- GIVEN an authenticated `admin`
- WHEN they PATCH `/members/{memberId}` with `{role: "contador"}`
- THEN the role is updated and 200 is returned

#### Scenario: R.3-S2 — self-role change rechazado

- GIVEN a `contador` authenticated as their own member row
- WHEN they PATCH their own member with `{role: "admin"}`
- THEN the request fails with 403
