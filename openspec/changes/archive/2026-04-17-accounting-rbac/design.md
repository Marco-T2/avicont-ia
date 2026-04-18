# Design: accounting-rbac

**Change**: `accounting-rbac`
**Date**: 2026-04-17
**Reads**: proposal, spec (3 capabilities, 11 REQs, 22 scenarios)

---

## Technical Approach

Extend in-place. Keep `requirePermission` as the single server-side enforcement point. Add action dimension (`read` / `write`) to matrix. W-draft handled outside matrix as a per-resource service-layer guard. UI gating via a tiny `<Gated>` component + `useCanAccess` hook reusing existing `useOrgRole`.

---

## Architecture Decisions

### D.1 — Matrix encoding

**Choice**: Two separate maps `PERMISSIONS_READ` and `PERMISSIONS_WRITE`, each `Record<Resource, Role[]>`.

**Alternatives**:
| Option | Pros | Cons |
|--------|------|------|
| Tuple `Record<Resource, Record<Action, Role[]>>` | Single map | Extra indirection on every lookup |
| Resource duplication (`sales-read`, `sales-write`) | Zero new concepts | Doubles Resource surface (24 literals), breaks the R/W semantic dimension |
| **Two separate maps** ✅ | Matches spec phrasing literally; each lookup is a single array-includes | Two declarations to keep in sync |

**Rationale**: closest to the spec's `action ∈ {read, write}`, zero runtime overhead, each map reads like a table.

### D.2 — `requirePermission` signature

**Choice**: `requirePermission(resource, action, orgSlug)` — action becomes a required positional param.

**Alternatives**: default action (confusing param order), two separate functions (`requireRead`/`requireWrite`: verbose).

**Rationale**: every route knows exactly whether it reads or writes; making action explicit catches mistakes at the call site. All 74 callsites are swept in one dedicated PR with grep-based checklist.

### D.3 — W-draft enforcement (auxiliar can't post)

**Choice**: `canPost(role, resource): boolean` helper backed by a dedicated `POST_ALLOWED_ROLES: Record<"sales"|"purchases"|"journal", Role[]>` map. Called at service layer inside `createAndPost`, `post`, and void operations.

**Alternatives**: inline `if (role === "auxiliar")` checks (not extensible), a 3rd matrix action `post` (inflates the matrix beyond the spec's read/write).

**Rationale**: keeps the matrix 2-dim as specified; post/void is a distinct concern (status transition, not CRUD), so a separate map is honest about what it gates. Service layer receives `role` via a new `context: { userId, role }` parameter added to `createAndPost` call signatures.

### D.4 — Self-role-change rejection

**Choice**: Guard at `MembersService.updateRole` — throws `ForbiddenError("CANNOT_CHANGE_OWN_ROLE")` → HTTP 403.

**Alternatives**: validation-layer rejection (422 — semantically wrong; the input is valid).

**Rationale**: business rule, lives with business logic.

### D.5 — `owner` provisioning

**Choice**: No-op. Already handled in `features/organizations/organizations.service.ts:55` (`syncOrganization` sets role `"owner"` on creator). `owner` stays out of `assignableRoles` Zod enum, so admins cannot promote/demote owner.

**Rationale**: existing behavior is correct; only documenting the invariant in spec.

---

## Data Flow

    Route handler
         │
         ├── requireAuth() ─────── Clerk session
         ├── requireOrgAccess ──── OrganizationMember row (userId, role)
         └── requirePermission(resource, action, orgSlug)
                  │
                  └── canAccess(role, resource, action)
                         │
                         ├── PERMISSIONS_READ[resource].includes(role)  // if action="read"
                         └── PERMISSIONS_WRITE[resource].includes(role) // if action="write"
         ↓ (on post/void)
    Service.createAndPost(orgId, input, { userId, role })
         │
         └── canPost(role, resource) → throw ForbiddenError if false

UI side:

    useOrgRole() → role
    useCanAccess(resource, action) → canAccess(role, resource, action)
    <Gated resource action>{children}</Gated>  // renders children iff hook returns true

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `features/shared/permissions.ts` | Modify | Role+2, Resource split to 12; 2 maps + POST_ALLOWED_ROLES; `canAccess(role, resource, action)`, `canPost` |
| `features/shared/permissions.server.ts` | Modify | `requirePermission(resource, action, orgSlug)` |
| `features/shared/errors.ts` | Modify | `CANNOT_CHANGE_OWN_ROLE`, `POST_NOT_ALLOWED_FOR_ROLE` |
| `features/organizations/members.validation.ts` | Modify | `assignableRoles` → `[admin, contador, cobrador, auxiliar, member]` |
| `features/organizations/members.service.ts` | Modify | `updateRole` self-guard |
| `features/sale/sale.service.ts` | Modify | `canPost` check in `createAndPost`, accept role context |
| `features/purchase/purchase.service.ts` | Modify | same |
| `features/accounting/journal.service.ts` | Modify | `canPost` in `createAndPost` + `transition(VOIDED/POSTED)` |
| `components/common/use-org-role.ts` | Modify | widen `MemberRole` to 6 roles |
| `components/common/gated.tsx` | Create | `<Gated>` + `useCanAccess` |
| `app/api/**/route.ts` | Modify (~74) | sweep `requireRole([...])` → `requirePermission(resource, action, orgSlug)` |
| `components/{accounting,sales,purchases,payments,dispatches,settings}/**` | Modify | wrap action buttons in `<Gated>` per spec REQ-U.3 table |
| `app/(dashboard)/[orgSlug]/settings/members/**` | Modify | role picker = 5 roles |

---

## Interfaces

```ts
// features/shared/permissions.ts
export type Role = "owner" | "admin" | "contador" | "cobrador" | "auxiliar" | "member";
export type Resource =
  | "members" | "accounting-config" | "sales" | "purchases" | "payments"
  | "journal" | "dispatches" | "reports" | "contacts" | "farms"
  | "documents" | "agent";
export type Action = "read" | "write";

export function canAccess(role: Role, resource: Resource, action: Action): boolean;
export function canPost(role: Role, resource: "sales"|"purchases"|"journal"): boolean;
```

```ts
// features/shared/permissions.server.ts
export async function requirePermission(
  resource: Resource,
  action: Action,
  orgSlug: string,
): Promise<{ session; orgId; role: Role }>;
```

```tsx
// components/common/gated.tsx
export function useCanAccess(resource: Resource, action: Action): boolean;
export function Gated({resource, action, children}: {resource: Resource; action: Action; children: ReactNode}): JSX.Element | null;
```

---

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | PERMISSIONS matrix | Table-driven: 6 roles × 12 resources × 2 actions = 144 cases. Single spec file. |
| Unit | `canPost` | 6 roles × 3 resources = 18 cases. |
| Unit | `<Gated>` / `useCanAccess` | Role resolved / loading / denied. |
| Integration | Route 403/200 per role | 1 sample route per resource × 2-3 roles = ~30 cases. |
| E2E | Cobrador payments OK, journal forbidden | Manual walkthrough. |
| E2E | Auxiliar draft sale OK, post forbidden | Manual walkthrough. |

---

## Migration

No DB migration (role is `String`). Existing `"member"` rows preserved (member coexists as legacy fallback). `owner` provisioning unchanged. Sweep can land PR-by-PR; `requireRole` utility stays until final PR removes it from route handlers.

## Open Questions

- None. D.1–D.5 locked.
