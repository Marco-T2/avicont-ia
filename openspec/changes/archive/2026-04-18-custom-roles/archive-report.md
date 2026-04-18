# Archive Report: custom-roles

**Archive Date**: 2026-04-18
**Change**: custom-roles
**Archive Location**: openspec/changes/archive/2026-04-18-custom-roles/
**Final Verdict**: PASS (38/38 scenarios COMPLIANT, 1498/1498 tests, tsc clean)

## Summary

This change delivered a complete DB-per-org RBAC matrix system with 6 immutable system roles per organization, custom role CRUD with permission matrix editing, async facades with server-only boundary enforcement, and a full CRUD UI hub at `/settings/roles` for admin management. The implementation spans 10 sequential PRs with zero backward compatibility breaks and establishes the foundation for granular per-role, per-resource access control.

## Specs Synced to Main Specs

- **NEW**: `openspec/specs/rbac-custom-roles/spec.md` (CR.1–CR.8)
- **MODIFIED**: `openspec/specs/rbac-permissions-matrix/spec.md` (P.2mod, P.3mod, P.5, P.6)
- **MODIFIED**: `openspec/specs/rbac-roles/spec.md` (R.1mod, R.3mod, R.4)
- **MODIFIED**: `openspec/specs/rbac-ui-gating/spec.md` (U.1mod, U.2mod, U.4mod, U.5)

## PRs Shipped (10 total)

- **PR1** — Foundation: CustomRole schema + cache + types (5 tasks)
- **PR2** — requirePermission + canAccess → DB matrix (2 tasks)
- **PR3** — Service canPost migration (sale + purchase + journal) (3 tasks)
- **PR4** — Roles CRUD service + repo + validation (3 tasks)
- **PR5** — Roles API routes + self-lock E2E (3 tasks)
- **PR6** — Members async role validation (2 tasks)
- **PR7** — UI CRUD hub /settings/roles (5 tasks)
- **PR8.1** — syncOrganization webhook seeds system roles
- **PR8.2** — Cleanup: removed POST_ALLOWED_ROLES, sync canAccess, static schemas, VITEST guard
- **PR8.3** — Dropped dead sync 2-param canPost overload

## Post-Verify Fixes (manual testing gap closure)

- **c838c3b** — fix: ensureOrgSeeded auto-seeds empty orgs on layout render (D.6 completeness)
- **0206ef9** — fix: server-only split of async canAccess/canPost (unblocks client import of SYSTEM_ROLES; resolves Turbopack `dns` bundling error)

## Verify Gap Closure (W-1/W-2/W-3)

- **8401846** — fix: RolesListClient state sync, RoleEditDrawer key remount, cross-org slug route test

## Final Metrics

- Tests: 1498 passing / 0 failing (153 test files)
- TSC: clean
- Scenarios: 38/38 COMPLIANT

## Deviations — Final State

All tracked deviations from engram topic `sdd/custom-roles/deviations` are RESOLVED:

1. **Dual-signature canAccess** — Removed in PR8.2 (sync 3-param); contract test proves async-only signature.
2. **VITEST env guard in cache** — Removed in PR8.2; cache is clean.
3. **Sync 2-param canPost overload** — Removed in PR8.3; smoke test proves async-only.
4. **POST_ALLOWED_ROLES static export** — Unexported in PR8.2; services now consult matrix via cache.
5. **Dynamic import leaking cache to client** — Server-only split (commit 0206ef9) isolates async cache from browser.

## Follow-ups (tracked in engram, NOT part of this change)

- `next-session/sidebar-granular-gating` — Refactor sidebar to gate children individually. User encountered limitation with custom `chofer` role: parent Contabilidad group gates on `journal.read` only, preventing visibility of Cobros y Pagos child for roles with payment access but no journal access.
- **A11y**: `DialogContent` instances in `role-create-dialog.tsx`, `role-edit-drawer.tsx`, `role-delete-dialog.tsx` need `<DialogDescription>` children (Radix warning). Small, include in separate a11y-sweep change or next change.
- **D.12 accepted**: Cross-instance cache drift up to 60s in multi-instance prod deployments. Documented as acceptable; operational awareness recommended.
