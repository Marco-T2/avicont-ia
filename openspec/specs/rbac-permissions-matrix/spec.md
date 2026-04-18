# rbac-permissions-matrix Specification

## Purpose

Define la matriz de autorización Role × Resource × Action como fuente única de verdad. Todo enforcement server-side (API) y UI deriva de esta matriz. El mecanismo concreto de encoding (maps separados read/write vs recursos duplicados) se decide en design.

## Requirements

### Requirement: Resource Catalog

The system MUST define exactly 12 resources: `members`, `accounting-config`, `sales`, `purchases`, `payments`, `journal`, `dispatches`, `reports`, `contacts`, `farms`, `documents`, `agent`. The coarse `accounting` resource MUST be deprecated after the sweep.

#### Scenario: P.1-S1 — catálogo completo

- GIVEN the `Resource` type export
- WHEN inspected at compile-time
- THEN it contains exactly the 12 listed literals and no `accounting` literal

---

### Requirement: Authorization Matrix

The system MUST expose a `canAccess(role, resource, action)` function where `action ∈ {"read", "write"}`. The matrix MUST match the table below. Any call with a tuple not allowed by the matrix returns `false`.

| Resource | Owner | Admin | Contador | Cobrador | Auxiliar | Member |
|----------|:-----:|:-----:|:--------:|:--------:|:--------:|:------:|
| members | RW | RW | — | — | — | — |
| accounting-config | RW | RW | — | — | — | — |
| sales | RW | RW | RW | R | W-draft | — |
| purchases | RW | RW | RW | — | W-draft | — |
| payments | RW | RW | RW | RW | — | — |
| journal | RW | RW | RW | — | — | — |
| dispatches | RW | RW | R | — | RW | — |
| reports | RW | RW | R | R | — | — |
| contacts | RW | RW | RW | RW | R | — |
| farms | RW | RW | RW | — | RW | RW |
| documents | RW | RW | RW | R | R | R |
| agent | RW | RW | RW | RW | RW | RW |

`W-draft` means the role can create draft documents but cannot POST/VOID; enforced at the service layer, surfaced here as `canAccess(role, "sales", "write") === true` plus a status-level guard.

#### Scenario: P.2-S1 — contador lee reports

- GIVEN role `contador`
- WHEN `canAccess("contador", "reports", "read")` is called
- THEN returns `true`

#### Scenario: P.2-S2 — cobrador no toca journal

- GIVEN role `cobrador`
- WHEN `canAccess("cobrador", "journal", "write")` or `"read"` is called
- THEN returns `false`

#### Scenario: P.2-S3 — auxiliar crea dispatch

- GIVEN role `auxiliar`
- WHEN `canAccess("auxiliar", "dispatches", "write")` is called
- THEN returns `true`

---

### Requirement: Server-Side Enforcement

The system MUST enforce authorization via `requirePermission(resource, action, orgSlug)`. Routes MUST NOT rely on `requireRole([...])` after migration is complete. Unauthorized calls MUST return HTTP 403 with error code `FORBIDDEN`.

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

---

### Requirement: No Legacy Role Checks in Migrated Routes

After sweep completion, `grep -r "requireRole(" app/api/` MUST return zero matches in route handlers (excluding tests and the deprecated export itself).

#### Scenario: P.4-S1 — sweep completo

- GIVEN the post-migration codebase
- WHEN `grep -r "requireRole(" app/api/` is run
- THEN zero matches returned
