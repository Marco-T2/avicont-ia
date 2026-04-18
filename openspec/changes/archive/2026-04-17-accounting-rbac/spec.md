# Spec: accounting-rbac

## Change: `accounting-rbac`

## Overview

Refine the existing RBAC framework: add roles `cobrador` + `auxiliar`, split coarse `accounting` resource into per-module resources, introduce read/write action dimension, and add UI gating for action buttons. 3 new capabilities — 11 REQs — 22 scenarios.

---

## Capability: rbac-roles

### REQ-R.1 — Role Set (assignables via admin)

6 roles total: `owner | admin | contador | cobrador | auxiliar | member`. First 5 assignable via admin API. `owner` implicit on org creation.

- R.1-S1: admin POSTs member with role=cobrador/auxiliar → 201
- R.1-S2: admin POSTs role=owner → 422
- R.1-S3: role=super-admin → 422

### REQ-R.2 — Per-org role scope

User MAY have different roles in different orgs. At most one role per (orgId, userId).

- R.2-S1: user admin en A, cobrador en B → `/B/members/me` returns cobrador
- R.2-S2: duplicate POST → 409

### REQ-R.3 — Role mutability

Only owner/admin PATCH others' roles. Self-role-change rejected.

- R.3-S1: admin PATCHes member role → 200
- R.3-S2: contador self-PATCH → 403

---

## Capability: rbac-permissions-matrix

### REQ-P.1 — Resource catalog

Exactly 12 resources: members, accounting-config, sales, purchases, payments, journal, dispatches, reports, contacts, farms, documents, agent. `accounting` deprecated post-sweep.

- P.1-S1: Resource type contains exactly 12 literals, none is `accounting`

### REQ-P.2 — Authorization matrix (Role × Resource × Action)

`canAccess(role, resource, action)` returns boolean per matrix. `action ∈ {read, write}`. `W-draft` for auxiliar = write with service-layer status guard.

| Resource | Owner | Admin | Contador | Cobrador | Auxiliar | Member |
|----------|:--:|:--:|:--:|:--:|:--:|:--:|
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

- P.2-S1: contador read reports → true
- P.2-S2: cobrador journal read/write → false
- P.2-S3: auxiliar dispatches write → true

### REQ-P.3 — Server-side enforcement

`requirePermission(resource, action, orgSlug)` enforces. Unauthorized → HTTP 403 with `FORBIDDEN`.

- P.3-S1: cobrador POST journal → 403
- P.3-S2: contador POST sale → 201
- P.3-S3: auxiliar POST sale with postImmediately=true → 403 (W-draft guard)

### REQ-P.4 — Legacy sweep

Zero `requireRole(` matches in `app/api/**/route.ts` post-sweep.

- P.4-S1: grep returns 0

---

## Capability: rbac-ui-gating

### REQ-U.1 — `<Gated>` component

Renders children iff `canAccess` true. Loading → nothing.

- U.1-S1: contador sees Contabilizar in JE detail
- U.1-S2: cobrador does NOT see Editar in sale detail
- U.1-S3: loading → no children

### REQ-U.2 — `useCanAccess` hook

Boolean hook. False while loading.

- U.2-S1: auxiliar sales.write → true
- U.2-S2: loading → false

### REQ-U.3 — Gated action buttons in critical views

Wrapped: JE detail (Editar/Contabilizar/Anular), sale detail (Editar/Anular), purchase detail (Editar), payment-form, dispatch-form, voucher-types-manager.

- U.3-S1: cobrador in JE detail → no action buttons
- U.3-S2: auxiliar in sale detail → Editar hidden for POSTED (status gate independent)

### REQ-U.4 — Members role picker

`<select>` lists exactly [admin, contador, cobrador, auxiliar, member]. No owner.

- U.4-S1: picker contents match

---

## Success Criteria

- Zero `requireRole(` in route handlers post-migration
- 5 roles assignable via UI
- E2E: cobrador payments ok, journal forbidden
- E2E: auxiliar draft sale ok, post forbidden
- tsc clean + full suite green
