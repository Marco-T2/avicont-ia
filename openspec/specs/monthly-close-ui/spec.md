# Spec: monthly-close-ui

**Capability:** `monthly-close-ui`
**Date:** 2026-04-22
**Type:** New canonical capability — UI contracts for monthly-close reconciliation

---

## Overview

The monthly-close surface is now single and consolidated: `/accounting/monthly-close` is the sole surface that performs the close ritual. `/settings/periods` administers period metadata only; the close action from that surface delegates via explicit navigation. Permission gates align to the `period` resource. The legacy modal dialog at `/settings/periods` is retired. Post-close workflows surface the `correlationId` for audit-trail navigation.

---

## REQ-1 — Dialog Retirement and Navigation Replacement

`components/accounting/period-close-dialog.tsx` MUST be deleted. After deletion, `components/accounting/period-list.tsx` MUST NOT import or render `PeriodCloseDialog`. The "Cerrar" row action for OPEN periods in `period-list.tsx` MUST become a navigation link to `/${orgSlug}/accounting/monthly-close?periodId=<id>` (using `next/link` or equivalent). No production caller of `PeriodCloseDialog` MAY remain after the change; test callers MUST either be deleted alongside the component or ported to assert the new navigation behavior.

**Retirement completeness gate:** REQ-1 is considered complete ONLY when a fresh grep for `PeriodCloseDialog`, `period-close-dialog`, and the import path `components/accounting/period-close-dialog` yields zero live-code hits (archive-scoped documentation excluded).

### Scenario REQ-1a — Navigation replaces modal (happy path)

- GIVEN a user with `period:read` is on `/settings/periods`
- WHEN they click the "Cerrar" row action for an OPEN period with id `p-01`
- THEN the browser navigates to `/${orgSlug}/accounting/monthly-close?periodId=p-01`
- AND no modal opens

### Scenario REQ-1b — No stale dialog import

- GIVEN the change has been applied
- WHEN a search for `PeriodCloseDialog` is run across all `.ts` and `.tsx` files outside `openspec/`
- THEN zero matches are found
- **Failure mode:** at least one match found — the retirement is incomplete

---

## REQ-2 — Query-Parameter Pre-selection on `/accounting/monthly-close`

When `/accounting/monthly-close` receives a `?periodId=<id>` query parameter, the `MonthlyClosePanel` MUST pre-select the period dropdown to that value — IF the id matches an OPEN period belonging to the org. If the id is absent, invalid, belongs to a different org, or matches a non-OPEN period, the panel MUST fall back to no pre-selection (current behavior). The period list used for validation MUST be the server-resolved list already passed to the panel; no additional server round-trip is required for the validation itself.

### Scenario REQ-2a — Valid OPEN period pre-selected

- GIVEN the org has an OPEN period with id `p-01`
- WHEN a user navigates to `/${orgSlug}/accounting/monthly-close?periodId=p-01`
- THEN the period dropdown renders with `p-01` pre-selected
- AND the summary fetch fires automatically for `p-01`

### Scenario REQ-2b — Absent or unmatched periodId falls back

- GIVEN a user navigates to `/${orgSlug}/accounting/monthly-close?periodId=unknown-id`
- WHEN the page renders
- THEN the period dropdown shows no pre-selected value (default placeholder)
- AND no summary fetch fires on page load

### Scenario REQ-2c — Cross-org or CLOSED period id ignored

- GIVEN `periodId=p-foreign` belongs to a different org (or is CLOSED)
- WHEN a user navigates to `/${orgSlug}/accounting/monthly-close?periodId=p-foreign`
- THEN the panel falls back to no pre-selection
- AND no data from the foreign period is loaded

---

## REQ-3 — CorrelationId Entry Point After Successful Close

After `MonthlyClosePanel.handleClose()` receives a success response from `POST /monthly-close`, the returned `correlationId` MUST be surfaced with an actionable entry point to `/${orgSlug}/accounting/monthly-close/close-event?correlationId=<id>`. "Actionable" means the user can navigate to the close-event page without typing the URL manually (e.g., a clickable link, toast with an action button, or inline CTA). The existing post-close behavior (summary refresh / router.refresh) MUST continue alongside the new entry point.

The implemented shape (per design phase OQ#1 resolution): a sonner v2.0.7 toast with `{ action: { label: "Ver registro", onClick: () => router.push(...) } }`.

### Scenario REQ-3a — CorrelationId link surfaced after close

- GIVEN a user completes the close ritual and `POST /monthly-close` returns `{ correlationId: "evt-01" }`
- WHEN the success handler runs
- THEN an actionable link to `/${orgSlug}/accounting/monthly-close/close-event?correlationId=evt-01` is visible to the user
- AND the summary view refreshes to reflect the CLOSED state

### Scenario REQ-3b — CorrelationId link is navigable

- GIVEN the correlationId entry point is displayed
- WHEN the user activates it (clicks link / toast action button)
- THEN the browser navigates to `/${orgSlug}/accounting/monthly-close/close-event?correlationId=evt-01`

---

## REQ-4 — Page Permission Gates Aligned to `period` Resource

The following pages MUST gate on `requirePermission("period", "read", orgSlug)`. Any user whose role is NOT in `PERMISSIONS_READ["period"]` (i.e., not `owner` or `admin`) MUST be redirected away without rendering page content.

| Page path (under `app/(dashboard)/[orgSlug]/`) | Before | After |
|---|---|---|
| `accounting/monthly-close/page.tsx` | `journal:read` | `period:read` |
| `accounting/monthly-close/close-event/page.tsx` | `journal:read` | `period:read` |
| `settings/periods/page.tsx` | `accounting-config:write` | `period:read` |

After F-08 removes the close dialog from `/settings/periods`, no close-action gate is needed on that page; `period:read` covers the listing view. The create-fiscal-year and edit-OPEN-period-metadata action handlers on `/settings/periods` (via `FiscalPeriodsService`) MUST gate on `requirePermission("period", "write", orgSlug)` at the API layer.

### Scenario REQ-4f — settings/periods create/edit gates on period:write

- GIVEN F-12 has extended `PERMISSIONS_WRITE["period"]` to `["owner","admin"]`
- AND a user with role `admin` submits a create-fiscal-year or edit-OPEN-period-metadata request on `/settings/periods`
- WHEN the API handler runs
- THEN `requirePermission("period", "write", orgSlug)` resolves successfully
- AND the request proceeds through domain logic

### Scenario REQ-4g — contador blocked from settings/periods write actions

- GIVEN a user with role `contador` (lacks `period:write` after F-12)
- WHEN they submit a create-fiscal-year or edit-metadata request
- THEN the API returns 403 ForbiddenError
- **Failure mode:** request proceeds (handler still gates on `accounting-config:write` or no gate)

### Scenario REQ-4a — contador blocked from monthly-close page

- GIVEN a user with role `contador` (has `journal:read`, lacks `period:read`)
- WHEN they navigate to `/${orgSlug}/accounting/monthly-close`
- THEN the page redirects to `/${orgSlug}` without rendering
- **Failure mode:** page renders (gate still uses `journal:read`)

### Scenario REQ-4b — admin accesses monthly-close page

- GIVEN a user with role `admin` (has `period:read`)
- WHEN they navigate to `/${orgSlug}/accounting/monthly-close`
- THEN the page renders the `MonthlyClosePanel`

### Scenario REQ-4c — contador blocked from close-event page

- GIVEN a user with role `contador`
- WHEN they navigate to `/${orgSlug}/accounting/monthly-close/close-event?correlationId=evt-01`
- THEN the page redirects to `/${orgSlug}` without rendering
- **Failure mode:** page renders (gate still uses `journal:read`)

### Scenario REQ-4d — admin accesses settings/periods page

- GIVEN a user with role `admin` (has `period:read`)
- WHEN they navigate to `/${orgSlug}/settings/periods`
- THEN the page renders the period list
- AND no close-action dialog is rendered (F-08 complete)

### Scenario REQ-4e — RBAC tests updated for all three pages

- GIVEN the RBAC test files for `accounting/monthly-close`, `close-event`, and `settings/periods`
- WHEN they run after the change
- THEN all assertions use `period:read` as the expected gate (not `journal:read` or `accounting-config:write`)

---

## REQ-5 — Nav Entry Resource Aligned to `period`

`components/sidebar/modules/registry.ts` MUST declare the "Cierre Mensual" nav entry with `resource: "period"`. Sidebar visibility logic (via `ActiveModuleNav` or equivalent) MUST show the entry only to users whose role is in `PERMISSIONS_READ["period"]`.

**Retirement completeness gate:** REQ-5 is complete when no reference to `resource: "journal"` appears on the "Cierre Mensual" entry in `registry.ts`.

### Scenario REQ-5a — contador does not see nav entry

- GIVEN a user with role `contador` (has `journal:read`, lacks `period:read`)
- WHEN the sidebar renders
- THEN the "Cierre Mensual" nav item is NOT visible

### Scenario REQ-5b — admin sees nav entry

- GIVEN a user with role `admin` (has `period:read`)
- WHEN the sidebar renders
- THEN the "Cierre Mensual" nav item is visible

---

## REQ-6 — Component Relocation: `monthly-close-panel`

`components/settings/monthly-close-panel.tsx` MUST be moved to `components/accounting/monthly-close-panel.tsx`. The import in `app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx` MUST be updated. The associated test file MUST relocate from `components/settings/__tests__/` to `components/accounting/__tests__/`. No stale import path referencing `components/settings/monthly-close-panel` MAY remain in production or test code.

**Retirement completeness gate (Rule 3):** Before the move, a grep for `monthly-close-panel` and `components/settings/monthly-close-panel` is run; every hit is classified as RESIDUAL, TEST, or CONSUMER and updated in the same commit.

### Scenario REQ-6a — No stale import remains

- GIVEN the move has been applied
- WHEN a search for `components/settings/monthly-close-panel` is run across all source files
- THEN zero matches are found
- **Failure mode:** at least one live-code match found

---

## REQ-7 — `LEGACY_CLOSE_REMOVED` Error Code Registered

`features/shared/errors.ts` MUST export `export const LEGACY_CLOSE_REMOVED = "LEGACY_CLOSE_REMOVED"`. `app/api/organizations/[orgSlug]/periods/[periodId]/route.ts` MUST import this constant and use it in the 410 response body; the raw string literal `"LEGACY_CLOSE_REMOVED"` MUST NOT remain in production code.

### Scenario REQ-7a — Constant used at callsite

- GIVEN the change has been applied
- WHEN a search for the raw string literal `"LEGACY_CLOSE_REMOVED"` is run across production files (excluding `errors.ts` where the constant is declared)
- THEN zero matches are found

---

## REQ-8 — `INSUFFICIENT_PERMISSION` Removed from `CloseErrorCode`

`CloseErrorCode` in `features/monthly-close/monthly-close.types.ts` MUST NOT include `"INSUFFICIENT_PERMISSION"`. No production code emits this code; permission denials flow through `ForbiddenError` with code `"FORBIDDEN"`. Any test asserting on `"INSUFFICIENT_PERMISSION"` MUST be updated or removed.

### Scenario REQ-8a — Union is clean after removal

- GIVEN the change has been applied
- WHEN a search for `INSUFFICIENT_PERMISSION` is run across non-test production files
- THEN zero matches are found (the value never appears outside tests or documentation)

---

## REQ-9 — `FiscalPeriodsRepository.updateStatus` Deleted

`FiscalPeriodsRepository.updateStatus` MUST be deleted. No caller MAY remain in production or test code. If any test used this method for setup (direct status mutation), that test MUST be migrated to use `MonthlyCloseService.close` or a direct Prisma call.

**Retirement completeness gate (Rule 3):** Before deletion, a grep for `updateStatus` within the `fiscal-periods` scope is run and each hit classified as RESIDUAL, TEST-to-migrate, or CONSUMER.

### Scenario REQ-9a — No caller remains

- GIVEN the method has been deleted
- WHEN a search for `updateStatus` is run within `features/fiscal-periods/` and any importer
- THEN zero matches are found
- **Failure mode:** at least one match found — caller was not updated

---

## Constraints and Non-goals

- This spec does NOT modify any requirement in `openspec/specs/monthly-period-close/spec.md`.
- The `close` action gate on `POST /monthly-close` (`period:close`) is unchanged and out of scope.
- The reopen flow and retroactive editing of CLOSED periods are out of scope.
- `ACTIVE_PERIOD_ALREADY_EXISTS` — verified grep-clean at proposal time; no task needed.
