# Verify Report: custom-roles

## Verdict

PASS WITH WARNINGS

---

## Scoreboard

- **Scenarios**: 37/38 COMPLIANT, 1 PARTIAL, 0 UNTESTED, 0 MISSING, 0 DRIFT
- **Tests**: 1486 passing / 0 failing (153 test files)
- **TSC**: clean (0 errors)
- **TDD Mode**: Strict TDD active

---

## Findings

### CRITICAL
- None

### WARNING

**W-1 — `RolesListClient` stale state after `router.refresh()` (PR7.5 risk)**
- File: `components/settings/roles-list-client.tsx:29`
- `useState<CustomRoleShape[]>(initialRoles)` initializes state from props once. `router.refresh()` causes Next.js to re-render the server component with fresh data, but `useState` does NOT re-initialize from new prop values after mount. The `handleRefresh()` callback calls `router.refresh()` but never calls `setRoles()`. As a result, after Create/Edit/Delete operations, the roles list shown to the user will remain stale until the component unmounts and remounts (e.g., full page navigation).
- **Impact**: U.5 UI appears to succeed (toast shown, drawer closes) but the list does not reflect the change until a hard refresh.
- **No test covers the post-refresh list update**: `roles-list-client.test.tsx` tests render with initial state only; no test exercises the `handleRefresh` → list-update cycle.
- Scenarios partially affected: U.5-S1, U.5-S2 (structural assertions pass, but post-mutation state synchronization is not tested).

**W-2 — `RoleEditDrawer` reset-from-props race on concurrent open/save (PR7.4 risk)**
- File: `components/settings/role-edit-drawer.tsx:102–106`
- `resetState()` always reads from the `role` prop. If a PATCH succeeds, `onUpdated()` is called which triggers `router.refresh()`, then the parent server component re-renders and passes a new `role` prop. If the drawer is opened again before the refresh settles, the prop may not yet carry the updated matrix, so the drawer would show the old (pre-edit) state momentarily.
- **Impact**: Low probability, cosmetic only (stale checkbox state for one open cycle). No data loss. The PATCH was already committed server-side.
- **Partially tested**: `role-edit-drawer.test.tsx` covers the PATCH call and toggle behavior but does not test the re-open-after-refresh cycle.

**W-3 — CR.4-S3 (cross-org slug isolation) — no dedicated test**
- Spec scenario: org `A` has slug `facturador`; org `B` can POST the same slug → 201.
- Evidence: The `@@unique([organizationId, slug])` Prisma constraint (`prisma/__tests__/custom-role.schema.test.ts`) proves isolation at the DB layer. `roles.service.test.ts` tests `resolveUniqueSlug` only within one org scope.
- A route-level integration test specifically asserting a same-slug cross-org 201 response is absent. The DB-layer test is sufficient structural evidence, but no behavioral test exercises the full POST path with two different orgIds.
- Classified as PARTIAL for CR.4-S3.

### SUGGESTION

**S-1 — `RolesListClient`: add `useEffect` to sync state from props**
- Add `useEffect(() => { setRoles(initialRoles); }, [initialRoles])` so that when `router.refresh()` causes the server component to re-pass updated `initialRoles`, the client state is updated accordingly.

**S-2 — Add smoke test for cross-org slug independence (CR.4-S3)**
- One additional route test with two distinct `orgId` values + same slug → both 201.

**S-3 — `RoleEditDrawer`: consider using `key={role.id}` on the drawer component**
- Forces remount when the edited role changes, eliminating any stale-prop race described in W-2.

---

## Per-REQ Coverage

| REQ | Scenarios | Status | Evidence |
|-----|-----------|--------|----------|
| CR.1 | S1, S2, S3 | COMPLIANT | `prisma/__tests__/seed-system-roles.test.ts` (S1: skipDuplicates), `app/api/organizations/__tests__/route.test.ts` (S2: webhook createMany with 6 payloads), `features/shared/__tests__/require-permission.test.ts` PR2.1-b (S3: empty matrix → inline seed → re-read) |
| CR.2 | S1, S2, S3 | COMPLIANT | `features/organizations/__tests__/roles.service.test.ts` (S1: SYSTEM_ROLE_IMMUTABLE on PATCH, S2: SYSTEM_ROLE_IMMUTABLE on DELETE), `components/settings/__tests__/roles-list-client.test.tsx` (S3: no Edit/Delete for system rows) |
| CR.3 | S1, S2, S3 | COMPLIANT | `features/organizations/__tests__/roles.service.test.ts` (S1: snapshot of template matrix, S2: independence proven by separate in-memory copy), `app/api/organizations/[orgSlug]/roles/__tests__/route.test.ts` (S3: 403 on unauthorized POST) |
| CR.4 | S1, S2, S3 | PARTIAL | `features/organizations/__tests__/roles.validation.test.ts` (S1: slugify derivation), `app/api/organizations/[orgSlug]/roles/__tests__/route.test.ts` (S2: 409 SLUG_TAKEN), S3 only DB-layer proven via `@@unique` constraint test — no route-level cross-org test |
| CR.5 | S1, S2, S3 | COMPLIANT | `features/organizations/__tests__/roles.service.test.ts` (S1: matrix update via repo.update, S2: canPost toggle via PATCH, S3: revalidateOrgMatrix called after update), `app/api/organizations/[orgSlug]/roles/[roleSlug]/__tests__/route.test.ts` (HTTP layer) |
| CR.6 | S1, S2 | COMPLIANT | `features/organizations/__tests__/roles.service.test.ts` tests A–E (S1: SELF_LOCK_GUARD when stripping members.write from own role, S2: different role not blocked), `app/api/organizations/[orgSlug]/roles/[roleSlug]/__tests__/self-lock-integration.test.ts` (end-to-end wiring: α SELF_LOCK_GUARD, β legitimate edit passes) |
| CR.7 | S1, S2 | COMPLIANT | `features/organizations/__tests__/roles.service.test.ts` (S1: 409 ROLE_HAS_MEMBERS when members>0, S2: delete succeeds + revalidate when members=0), `app/api/organizations/[orgSlug]/roles/[roleSlug]/__tests__/route.test.ts` (HTTP 409) |
| CR.8 | S1, S2 | COMPLIANT | `features/organizations/__tests__/members.validation.test.ts` (S1: known slug with exists=true → parseAsync resolves, S2: unknown slug with exists=false → ZodError 422) |
| P.2mod | S1, S2, S3, S4, S5 | COMPLIANT | `features/shared/__tests__/permissions.test.ts` PR2.2 (a–d): (a) contador reads reports via system snapshot, (b) unknown role → false, (c) custom role with journal.write=true in mock matrix → true, (d) TTL mock triggers reload |
| P.3mod | S1, S2, S3, S4 | COMPLIANT | `features/shared/__tests__/require-permission.test.ts`: (S1: cobrador→journal/write→403, S2: contador→sales/read→pass, S3: auxiliar→sales/write→pass, S4: signature frozen contract + `getMatrix` called via cache) |
| P.5 | S1, S2 | COMPLIANT | `features/shared/__tests__/permissions.cache.test.ts` (a–g): cache miss/hit, TTL=60s, (d) revalidateOrgMatrix evicts only target org (P.5-S1: explicit invalidation on PATCH; P.5-S2: no cross-org contamination) |
| P.6 | S1, S2 | COMPLIANT | `features/sale/__tests__/sale-canpost-async.test.ts` (sale branch), `features/purchase/__tests__/purchase-canpost-async.test.ts` (purchase branch), `features/accounting/__tests__/journal-canpost-async.test.ts` (journal branch); `features/shared/__tests__/permissions.smoke.test.ts` PR8.3: sync 2-param removed, canPost is async-only |
| R.1mod | S1, S2, S3, S4 | COMPLIANT | `features/shared/__tests__/permissions.types.test.ts` (Role = string, SYSTEM_ROLES tuple, isSystemRole), `features/organizations/__tests__/members.validation.test.ts` (S1: cobrador/auxiliar accepted, S2: owner rejected 422, S3: custom facturador accepted, S4: unknown cajero rejected) |
| R.3mod | S1, S2, S3 | COMPLIANT | `features/organizations/__tests__/members.service.test.ts` + `members.validation.contract.test.ts` (S1: admin role change succeeds, S2: self-role change blocked, S3: custom role assigned via buildAddMemberSchema async refine) |
| R.4 | S1, S2 | COMPLIANT | `app/api/organizations/[orgSlug]/roles/__tests__/route.test.ts` (a: 200 + 6 system roles, b: member → 403), `app/api/organizations/[orgSlug]/roles/[roleSlug]/__tests__/route.test.ts` (GET single, PATCH, DELETE 5 endpoints) |
| U.1mod | S1, S2, S3, S4 | COMPLIANT | `components/common/__tests__/gated.test.tsx`: S1 (contador+journal.write → renders), S2 (cobrador no sales.write → hidden), S3 (null snapshot → no render / no flash), S4 (custom facturador with journal.write=true → renders) |
| U.2mod | S1, S2, S3 | COMPLIANT | `components/common/__tests__/use-can-access.test.tsx`: S1 (auxiliar/sales.write → true), S2 (null snapshot → false), S3 (snapshot update reflected) |
| U.4mod | S1, S2 | COMPLIANT | `components/settings/__tests__/role-picker.test.tsx`: T7.2-1 (6 options exactly — 5 system no-owner + 1 custom), T7.2-2 (owner not in list), T7.2-3 (facturador in list) |
| U.5 | S1, S2, S3, S4 | COMPLIANT | `components/settings/__tests__/roles-list-client.test.tsx` (S1: system rows no Edit/Delete, S2: custom row has Edit+Delete), `components/settings/__tests__/role-create-dialog.test.tsx` (S3: template required), `components/settings/__tests__/role-delete-dialog.test.tsx` (S4: confirmation before DELETE call) |

---

## Deviations

All tracked deviations from the tasks file are resolved:

1. **D.7 misread (PR3.3)** — journal.service.ts was incorrectly excluded from canPost migration in design D.7. Resolved in PR3.3: journal.service.ts migrated to async canPost, task added, all 4 journal async tests green.

2. **PR2.2 sync 3-param overload** — apply agent noted `canAccess` kept a sync 3-param shim. Resolved in PR8.2: sync overload removed; `permissions.smoke.test.ts` PR8.2 asserts 3-param call now returns Promise (not boolean).

3. **PR8.3 canPost sync 2-param** — apply agent noted `canPost` had a sync 2-param overload. Resolved in PR8.3: sync overload removed; `permissions.smoke.test.ts` PR8.3 asserts 2-param call returns Promise.

4. **PR5.3 self-lock wiring gap** — PR5.2 only mocked the service. Resolved in PR5.3: E2E integration test with real RolesService + fake repo verifies the route-local Map closure delivers callerRoleSlug correctly.

No deviations remain open.

---

## Risks for Archive Phase

1. **`RolesListClient` stale state (W-1)** — The client component's `roles` state will not auto-update when `router.refresh()` re-delivers new props from the server. This is a UX correctness issue but not a data integrity issue. Archive phase should note this as a known gap for a follow-up PR. The fix is a one-line `useEffect` in `roles-list-client.tsx`.

2. **CR.4-S3 cross-org isolation** — Tested at DB layer only (Prisma unique constraint). No route-level integration test. Low risk: the DB constraint is the authoritative guard. Worth noting for the archive trail.

3. **Multi-instance cache drift (D.12)** — Documented as ACCEPTABLE in the design. Up to 60s stale on other instances. Not a blocker; noted for operational awareness.
