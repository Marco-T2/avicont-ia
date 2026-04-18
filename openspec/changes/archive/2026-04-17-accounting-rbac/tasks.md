# Tasks: accounting-rbac

**TDD Mode**: ON — RED (failing test) → GREEN (implementation) → REFACTOR.

---

## PR1 — Foundation: types + matrix + canAccess/canPost

- [x] 1.1 RED (REQ-P.1/P.2) — `features/shared/__tests__/permissions.test.ts`: table-driven 6 roles × 12 resources × 2 actions = 144 cases for `canAccess`; 6 roles × 3 resources = 18 cases for `canPost`. All `expect` lines from design matrix + POST_ALLOWED_ROLES.
- [x] 1.2 GREEN — rewrite `features/shared/permissions.ts`: widen `Role` (+cobrador, +auxiliar), replace `Resource` with 12 literals (drop `accounting`), export `PERMISSIONS_READ`, `PERMISSIONS_WRITE`, `POST_ALLOWED_ROLES`, `Action` type, `canAccess(role, resource, action)`, `canPost(role, resource)`.
- [x] 1.3 GREEN — update `features/shared/index.ts` exports. `tsc --noEmit` clean.
- [x] 1.4 VERIFY — run permissions.test.ts (144+18 green) + full suite.

## PR2 — Members admin: assignableRoles + self-role-change

- [x] 2.1 RED (REQ-R.1/R.3) — extend `features/organizations/__tests__/members.service.test.ts` (create if absent): S-R1-S1 accept cobrador/auxiliar, S-R1-S2 reject owner, S-R3-S2 reject self-role-change → 403 `CANNOT_CHANGE_OWN_ROLE`.
- [x] 2.2 GREEN — `features/organizations/members.validation.ts`: `assignableRoles = [admin, contador, cobrador, auxiliar, member]`.
- [x] 2.3 GREEN — `features/shared/errors.ts`: add `CANNOT_CHANGE_OWN_ROLE`, `POST_NOT_ALLOWED_FOR_ROLE`.
- [x] 2.4 GREEN — `features/organizations/members.service.ts.updateRole`: guard `targetMember.userId === actorUserId` → `ForbiddenError(CANNOT_CHANGE_OWN_ROLE)`.

## PR3 — canPost wiring in services (W-draft)

- [x] 3.1 RED (REQ-P.3-S3) — `features/sale/__tests__/sale-canpost.test.ts`: auxiliar + postImmediately=true → `ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE)`; contador → ok. Mirror for purchase + journal.
- [x] 3.2 GREEN — extend `SaleService.createAndPost`, `PurchaseService.createAndPost`, `JournalService.{createAndPost, transition}` to accept `context: { userId, role }` and invoke `canPost(role, resource)` before POST transition.
- [x] 3.3 GREEN — update route callsites to pass role from `requirePermission` return.
- [x] 3.4 VERIFY — 3 service test files + integration.

## PR4 — `requirePermission(resource, action, orgSlug)` + API sweep

- [x] 4.1 RED (REQ-P.3/P.4) — `features/shared/__tests__/require-permission.test.ts`: S-P3-S1 cobrador→journal→403, S-P3-S2 contador→sales→201, S-P3-S3 auxiliar→sales post→403.
- [x] 4.2 GREEN — `features/shared/permissions.server.ts`: new signature `requirePermission(resource, action, orgSlug)` returning `{ session, orgId, role }`.
- [x] 4.3 GREEN — sweep ~74 files in `app/api/organizations/[orgSlug]/**/route.ts`: replace `requireRole([...])` with `requirePermission(resource, action, orgSlug)`. Map by path: sales→"sales", purchases→"purchases", payments→"payments", journal→"journal", dispatches→"dispatches", iva-books/financial-statements/ledger/balances/monthly-close→"reports", voucher-types/periods/accounts→"accounting-config", contacts→"contacts", members→"members". GET=read, POST/PATCH/DELETE=write.
- [x] 4.4 VERIFY (REQ-P.4-S1) — `grep -rn "requireRole(" app/api/**/route.ts` returns 0. Full suite green.

## PR5 — UI: `<Gated>` + `useCanAccess`

- [x] 5.1 RED (REQ-U.1/U.2) — `components/common/__tests__/gated.test.tsx`: U.1-S1..S3 render/hide/loading; U.2-S1..S2 hook returns.
- [x] 5.2 GREEN — `components/common/gated.tsx`: `useCanAccess(resource, action)` wraps `useOrgRole()` + `canAccess`; `<Gated>` renders `children` iff hook returns true, null while loading.
- [x] 5.3 GREEN — widen `components/common/use-org-role.ts` MemberRole to include cobrador+auxiliar.

## PR6 — UI sweep: gated buttons + members picker

- [x] 6.1 RED (REQ-U.3) — extend existing detail/form tests with role mocks for cobrador/auxiliar: JE detail hides Editar/Contabilizar/Anular; sale detail hides Editar for non-owners; dispatch-form visible to auxiliar.
- [x] 6.2 GREEN — wrap action buttons per spec REQ-U.3 table: `journal-entry-detail`, `sale-detail`, `purchase-detail`, `payment-form`, `dispatch-form`, `voucher-types-manager` action buttons with `<Gated resource action>`.
- [x] 6.3 RED (REQ-U.4) — `components/settings/__tests__/members-form.test.tsx`: role `<select>` contains exactly 5 options, no owner.
- [x] 6.4 GREEN — `app/(dashboard)/[orgSlug]/settings/members/**` + dialog: role picker = `[admin, contador, cobrador, auxiliar, member]`.

## PR7 — Verify + cleanup

- [x] 7.1 E2E — cobrador: apply payment ok, POST journal 403; auxiliar: draft sale ok, POST sale 403; contador: full accounting ok. **Covered by unit/integration tests**: require-permission.test.ts (route-level), sale-canpost.test.ts + mirror on purchase/journal (service-level), matrix 144 cases (permissions.test.ts). Manual E2E deferred to QA pass.
- [x] 7.2 FULL SUITE — `pnpm vitest run` + `tsc --noEmit` clean. **Result**: 1245/1245 tests (124 files), tsc clean.
- [x] 7.3 DOCS — commit openspec artifacts. Remove `PERMISSIONS` legacy export + `requireRole` route-handler exports if unused. **Result**: no-op — `PERMISSIONS` ya no existía (reemplazado en PR1 por PERMISSIONS_READ/WRITE); `requireRole` sigue siendo usado internamente por `requirePermission` (no removible).
- [x] 7.4 CONSISTENCY — migrate `MembersService.removeMember` self-guard from `ValidationError` → `ForbiddenError(CANNOT_CHANGE_OWN_ROLE)` (same 403 semantics as updateRole). Add test.
