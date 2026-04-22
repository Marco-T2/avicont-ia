# Residual Debt Audit — cierre-periodo

> **Context:** Residual debt audit for `monthly-close-ui-reconciliation` exploration. See `exploration.md` for current status of the parent change.

Generated: 2026-04-21

## Method

Compared the archived SDD artifacts (`design.md`, `proposal.md`, `tasks.md`) against the actual
codebase using targeted grep and file inspection. Checked every deliverable promise in the design and
proposal for presence in the code; verified 10 selected tasks by locating their output files; then ran
the nine investigative patterns (A through K) across `app/`, `components/`, `features/`, and
`prisma/` — reading source files rather than relying solely on search output. Evidence cited is
file:line from the running codebase at the time of this audit.

---

## Findings (by severity)

### Severity: HIGH — functional bugs or broken invariants

---

**F-01 — `FiscalPeriodsService.create` blocks creation of a second period in the same year (wrong invariant after model change)**

- **Evidence**: `features/fiscal-periods/fiscal-periods.service.ts:48` — `this.repo.findByYear(organizationId, input.year)` + `features/fiscal-periods/fiscal-periods.repository.ts:24-29` — `findByYear` queries `WHERE year = $year` with no `month` filter; if any period exists for that year, creation is blocked.
- **Why it's debt**: The design explicitly changed the unique constraint from `(organizationId, year)` to `(organizationId, year, month)` to support one period per calendar month per org. The service guard was never updated: it still calls `findByYear` which matches ANY period in that year, not just the same `(year, month)`. After the migration, the DB would allow a second period for month=2 of the same year — but the service rejects it first with `FISCAL_PERIOD_YEAR_EXISTS`. The UI cannot create more than one period per year despite the schema now allowing 12.
- **Impact if unfixed**: A 12-month accounting cycle is impossible. The first period created for 2026 permanently blocks all subsequent months of 2026 at the service layer, making the new `@@unique([organizationId, year, month])` schema change dead weight.
- **Suggested fix scope**: Replace `findByYear` call in `create()` with a `findByYearAndMonth` check (that includes `month` derived from `input.startDate`). Also remove the `findOpenPeriod` + `ACTIVE_PERIOD_ALREADY_EXISTS` guard (see F-02).

---

**F-02 — `FiscalPeriodsService.create` still enforces "one OPEN period at a time" — incompatible with monthly model**

- **Evidence**: `features/fiscal-periods/fiscal-periods.service.ts:56-60` — `findOpenPeriod` returns the first `OPEN` period found; if any exists, creation throws `ACTIVE_PERIOD_ALREADY_EXISTS`.
- **Why it's debt**: The proposal explicitly states: "Se permiten múltiples `FiscalPeriod` OPEN por organización dentro del mismo año (uno por mes no cerrado)." The single-open-period guard contradicts this. An org running months in parallel (e.g., January OPEN while February is being created) is blocked by this guard.
- **Impact if unfixed**: The monthly-close workflow breaks the moment a second period is needed alongside an open one. Accountants cannot onboard a new month without closing the previous one first — a hard workflow constraint the business did not request.
- **Suggested fix scope**: Remove the `findOpenPeriod` / `ACTIVE_PERIOD_ALREADY_EXISTS` block from `create()`. Uniqueness is now enforced at the DB level by `@@unique([organizationId, year, month])`.

---

**F-03 — `countDraftDocuments` does not check `Sale` and `Purchase` drafts, but the service locks them**

- **Evidence**: `features/monthly-close/monthly-close.repository.ts:44-63` — `countDraftDocuments` returns `{ dispatches, payments, journalEntries }` only; no `Sale` or `Purchase` count. `features/monthly-close/monthly-close.service.ts:114-132` — service checks only `dispatches + payments + journalEntries`; if all are zero it proceeds into the TX and locks sales/purchases. `features/monthly-close/monthly-close.repository.ts:159-190` — `lockSales` and `lockPurchases` transition POSTED → LOCKED.
- **Why it's debt**: REQ-4 (spec line 49) states "The presence of any document in DRAFT status — across `Dispatch`, `Payment`, or `JournalEntry`" blocks the close. That wording was written before T15 added Sale/Purchase locking (REQ-5). But the design §"Lock order" and T29 both confirm Sale and Purchase are first-class locked documents. A DRAFT Sale or Purchase that slips through the draft check and gets encountered during `lockSales`/`lockPurchases` would simply be skipped (the lock query filters by `status = 'POSTED'`), leaving a DRAFT Sale locked into a CLOSED period without an audit trail for the fact it wasn't locked.
- **Impact if unfixed**: A period can close with DRAFT Sales or Purchases remaining in it. Those DRAFTs are invisible to the audit trail, not locked, and not checked by `countDraftDocuments`. The "no drafts" invariant is silently incomplete for two of the five document types.
- **Suggested fix scope**: Extend `countDraftDocuments` to include `sale` and `purchase` counts and add them to the total check in `close()`. Update the type to `{ dispatches; payments; journalEntries; sales; purchases }`.

---

### Severity: MEDIUM — integration gaps, permission drift

---

**F-04 — `MonthlyClosePanel` does not link to the Close Event Viewer after a successful close**

- **Evidence**: `components/settings/monthly-close-panel.tsx:114-143` — `handleClose()` on success calls `router.refresh()` and `fetchSummary(selectedPeriodId)`. There is no navigation to `/accounting/monthly-close/close-event?correlationId=<id>` nor any display of the returned `correlationId`. The `CloseResult` type includes `correlationId: string` (`features/monthly-close/monthly-close.types.ts:12`) and the route returns it (`app/api/organizations/[orgSlug]/monthly-close/route.ts:30`), but the panel discards it.
- **Why it's debt**: The design explicitly states (§"UI for correlationId"): `"Período cerrado. 147 documentos bloqueados. Ver evento de auditoría →"`. That link is the intended entry point to the Close Event Viewer — the one page whose absence was already flagged. This is the missing link.
- **Impact if unfixed**: The Close Event Viewer page (`close-event/page.tsx`) is unreachable via any UI surface. The entire audit trail feature delivered in Phase 9 is a dead page.
- **Suggested fix scope**: After a successful `handleClose()`, capture the `correlationId` from the response and either (a) display a toast with "Ver evento de auditoría →" that links to `/${orgSlug}/accounting/monthly-close/close-event?correlationId=${id}`, or (b) navigate directly to that page.

---

**F-05 — `monthly-close/page.tsx` and `close-event/page.tsx` are gated by `journal:read` instead of `period:read`**

- **Evidence**: `app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx:17` — `requirePermission("journal", "read", orgSlug)`. `app/(dashboard)/[orgSlug]/accounting/monthly-close/close-event/page.tsx:38` — same `requirePermission("journal", "read", orgSlug)`.
- **Why it's debt**: The spec (REQ-6) created a dedicated `period` resource for all period-close operations. The design §"RBAC" states period:close is the gate for the close action. The `period` resource also has a `read` matrix entry (`PERMISSIONS_READ["period"] = ["owner", "admin"]`). Both pages are about the period-close domain — they should gate on `period:read`. Using `journal:read` grants access to any user who can read journal entries, which includes `contador` — a role that cannot close periods.
- **Impact if unfixed**: A `contador` can access the monthly-close page and the close-event viewer, but cannot perform the close action (`period:close` grants only `owner`/`admin`). This is inconsistent: the UI is visible but the action is blocked. More critically, if `period:read` is ever tightened further, `journal:read` pages would not be affected. Permission separation is violated.
- **Suggested fix scope**: Change both page guards to `requirePermission("period", "read", orgSlug)`.

---

**F-06 — `LEGACY_CLOSE_REMOVED` error code is hard-coded as a string literal, not a registered constant**

- **Evidence**: `app/api/organizations/[orgSlug]/periods/[periodId]/route.ts:35` — `code: "LEGACY_CLOSE_REMOVED"` as a raw string literal. `features/shared/errors.ts` — no `LEGACY_CLOSE_REMOVED` constant is exported anywhere in the file.
- **Why it's debt**: Every other error code in this codebase is exported from `features/shared/errors.ts` and imported by consumers (see e.g. `PERIOD_NOT_FOUND`, `PERIOD_UNBALANCED`). This one is a hard-coded string with no registry entry, making it invisible to anyone grepping for error codes, impossible to rename safely, and untested via the constant name.
- **Impact if unfixed**: If a future client needs to handle `LEGACY_CLOSE_REMOVED`, they must know the magic string. Any typo in future code silently uses a different string. The error code registry in `errors.ts` is incomplete.
- **Suggested fix scope**: Export `export const LEGACY_CLOSE_REMOVED = "LEGACY_CLOSE_REMOVED"` from `errors.ts`; import and use it in the route handler.

---

**F-07 — `Cierre Mensual` nav item is gated by `journal` resource — inconsistent with the new `period` resource**

- **Evidence**: `components/sidebar/modules/registry.ts:111-114` — the "Cierre Mensual" nav item has `resource: "journal"`, meaning `ActiveModuleNav` will show it to any user whose role has `journal:read` (including `contador`), not just users with `period:read`.
- **Why it's debt**: The `period` resource was specifically introduced to separate close-operation access from journal-read access. The nav item should be gated by `period:read` so the sidebar reflects the same permission model as the page. Currently a user who can read journals but has been denied period access would still see the "Cierre Mensual" menu entry and navigate to a page that immediately redirects them away.
- **Impact if unfixed**: The sidebar nav permission model is inconsistent with the page-level permission model. UX confusion: users see a menu item they cannot use.
- **Suggested fix scope**: Change the `resource` field for the "Cierre Mensual" nav item in `registry.ts:113` from `"journal"` to `"period"`.

---

**F-08 — `PeriodCloseDialog` (legacy) calls the new canonical endpoint but still lives in the codebase and still surfaces a degraded close UX**

- **Evidence**: `components/accounting/period-close-dialog.tsx` — file exists and is 119 lines. `components/accounting/period-list.tsx:10` — imports and uses `PeriodCloseDialog`. `components/accounting/period-list.tsx:131` — renders `<PeriodCloseDialog ...>`. The dialog now calls `POST /api/organizations/${orgSlug}/monthly-close` (canonical endpoint) but it has no balance check display, no DEBE=HABER warning, no draft count summary.
- **Why it's debt**: Already known, included here only for completeness per the audit template. Design §"Deprecation path" step 3 explicitly states "delete `components/accounting/period-close-dialog.tsx` if no longer referenced." T53 task note says the dialog was "migrated to the canonical endpoint" in T55 but not deleted. The `period-list.tsx` page still exposes this dialog as the close action from `settings/periods`.
- **Impact if unfixed**: Two parallel close UIs exist: the rich `MonthlyClosePanel` (with balance check, draft warning) and this dialog (no checks, direct close). An admin closing from `settings/periods` bypasses all pre-flight UX warnings — they may close an unbalanced period thinking they went through the correct flow.
- **Suggested fix scope**: Delete `period-close-dialog.tsx`. Update `period-list.tsx` to remove the `PeriodCloseDialog` import and the "Cerrar" button action, or replace it with a link to `/${orgSlug}/accounting/monthly-close`.

---

### Severity: LOW — documentation drift, dead constants, cosmetic

---

**F-09 — `INSUFFICIENT_PERMISSION` is listed in `CloseErrorCode` union but is never thrown by any production code**

- **Evidence**: `features/monthly-close/monthly-close.types.ts:27` — `| "INSUFFICIENT_PERMISSION"` is part of `CloseErrorCode`. Grepping the entire codebase for `INSUFFICIENT_PERMISSION` in non-test production code returns zero hits. The permission check is enforced by `requirePermission` which throws `ForbiddenError` with code `"FORBIDDEN"` (`features/shared/errors.ts:22-25`).
- **Why it's debt**: The type union documents a code that the system never actually emits. Any client checking `error.code === "INSUFFICIENT_PERMISSION"` will never match; the real code is `"FORBIDDEN"`. The union is misleading documentation.
- **Impact if unfixed**: Low — tests currently assert on HTTP 403 status rather than the code string. But the type is a contract; future clients reading it will implement a branch that never fires.
- **Suggested fix scope**: Remove `"INSUFFICIENT_PERMISSION"` from `CloseErrorCode` union, or add a comment that the actual emitted code is `"FORBIDDEN"` (from `ForbiddenError`). Cross-reference `features/shared/errors.ts:23`.

---

**F-10 — `FiscalPeriodsRepository.updateStatus` is a leftover method with no remaining callers**

- **Evidence**: `features/fiscal-periods/fiscal-periods.repository.ts:63-74` — `updateStatus(organizationId, id, status)` method exists. Grepping all `.ts`/`.tsx` files outside `__tests__` for `updateStatus` in the `fiscal-periods` context yields zero hits — no production code imports or calls this method. The legacy `FiscalPeriodsService.close` that would have called it was deleted in T53.
- **Why it's debt**: Dead code. The method was presumably used by the deleted `close()` service method. Its continued presence adds surface area to a repository class that now has a cleaner canonical close path via `MonthlyCloseService`.
- **Impact if unfixed**: No runtime impact. The method is a maintenance liability and a misleading signal: it implies there's a code path that updates `FiscalPeriod.status` directly, which violates the audit-trigger operational rule.
- **Suggested fix scope**: Delete `FiscalPeriodsRepository.updateStatus`. If the method's SQL is needed for tests, those tests should use `MonthlyCloseService.close` or raw Prisma calls in test setup.

---

**F-11 — `close-event/page.tsx` is gated by `journal:read` while the API route it conceptually wraps (`audit-trail/route.ts`) is correctly gated by `period:read`**

- **Evidence**: `app/(dashboard)/[orgSlug]/accounting/monthly-close/close-event/page.tsx:38` — `requirePermission("journal", "read", orgSlug)`. `app/api/organizations/[orgSlug]/monthly-close/audit-trail/route.ts:11` — `requirePermission("period", "read", orgSlug)`. (Note: this finding partially overlaps with F-05 which covers both monthly-close pages together; cited separately here because the API/page split creates an inconsistency even within the close-event feature itself.)
- **Why it's debt**: The API endpoint that serves the close-event data uses `period:read`. The page that renders that data uses `journal:read`. A user with `journal:read` but without `period:read` can load the page — then the API call will fail with 403. The page has no error handling for a 403 from the audit-trail API (it queries Prisma directly, bypassing the API entirely — but the inconsistency in the gate resource remains a documentation and future-maintenance hazard).
- **Impact if unfixed**: Low at runtime (the page queries Prisma directly server-side, bypassing the API). High as a pattern: if the page is ever refactored to call the API route client-side, the permission mismatch will cause silent failures.
- **Suggested fix scope**: Align page gate to `period:read` (covered by F-05 fix).

---

## Items checked and clean

The following patterns were investigated and found to be correctly implemented:

| Pattern | Verdict |
|---|---|
| **A. Features without entry point** | `close-event/page.tsx` exists and is routable — the lack of entry point is in `MonthlyClosePanel` not linking to it (captured as F-04). The page itself is correctly structured. |
| **B. Endpoints added but never called** | `audit-trail/route.ts` and `monthly-close/summary/route.ts` are called by `MonthlyClosePanel` (summary) and `close-event/page.tsx` (directly via Prisma, so audit-trail route is dead from the page but exists for API clients). |
| **C. `FiscalPeriodsService.close` deletion** | Confirmed deleted — `fiscal-periods.service.ts` has no `close()` method. |
| **D. Legacy PATCH route returns 410** | `app/api/organizations/[orgSlug]/periods/[periodId]/route.ts:32-40` — PATCH with `status: 'CLOSED'` returns 410 with correct body. No further business logic follows the return. |
| **E. Permission drift on close route** | `monthly-close/route.ts:16` correctly calls `requirePermission("period", "close", orgSlug)`. The `PERMISSIONS_CLOSE` matrix correctly grants only `["owner", "admin"]` for `period`. |
| **F. `PERIOD_UNBALANCED` constant** | Exported from `errors.ts:64` and thrown in `monthly-close.service.ts:150`. In use. |
| **F. `LOCKED_EDIT_REQUIRES_JUSTIFICATION` constant** | Exported from `errors.ts:151`. Thrown by `document-lifecycle.service.ts`. In use. |
| **F. `PERIOD_HAS_DRAFT_ENTRIES` constant** | Exported from `errors.ts:60`. Thrown in `monthly-close.service.ts:124`. In use. |
| **G. Migration correctness** | `prisma/migrations/20260422004238_cierre_periodo/migration.sql` — all 8 FKs recreated, `correlationId` column added with index, `audit_trigger_fn()` replaced, `audit_fiscal_periods` and `audit_purchases` triggers created. |
| **G. `correlationId` index consumed by production code** | `close-event/page.tsx:55-58` and `audit-trail/route.ts:24` both query `prisma.auditLog.findMany({ where: { correlationId } })`, which uses the index. |
| **H. Tests asserting old legacy PATCH success** | `periods/[periodId]/__tests__/route.test.ts` asserts 410 Gone — no test expects the legacy PATCH to succeed. |
| **I. Documentation drift — service comments** | `monthly-close.service.ts` comments reference `markPeriodClosed` (the current name). No stale `closePeriod` references in production comments. |
| **J. Nav config covers `/accounting/monthly-close`** | `components/sidebar/modules/registry.ts:111-114` — "Cierre Mensual" is in the nav. (Resource gate is wrong — F-07 — but the entry exists.) |
| **K. `period:write` empty matrix** | `PERMISSIONS_WRITE["period"] = []` is intentional per the design comment "not directly writable — use close/reopen actions instead". No violation. |
| **K. `period:read` has roles** | `PERMISSIONS_READ["period"] = ["owner", "admin"]` — not empty, correctly populated. |

---

## Recommended scoping

### Include in `monthly-close-ui-reconciliation`

- **F-04** — Link from `MonthlyClosePanel` to Close Event Viewer after close (direct fix for the already-known dead-UI issue)
- **F-05** — Change `monthly-close/page.tsx` and `close-event/page.tsx` permission gate from `journal:read` to `period:read`
- **F-07** — Change `registry.ts` "Cierre Mensual" nav resource from `"journal"` to `"period"`
- **F-08** — Delete `period-close-dialog.tsx` and clean up `period-list.tsx` (already-known debt, include here to close it)
- **F-11** — Covered by F-05 fix

### Separate small fixes (do not block reconciliation)

- **F-06** — Register `LEGACY_CLOSE_REMOVED` constant in `errors.ts` (one-line change, no test risk)
- **F-09** — Remove `"INSUFFICIENT_PERMISSION"` from `CloseErrorCode` union or add clarifying comment
- **F-10** — Delete `FiscalPeriodsRepository.updateStatus` dead method

### High priority but separate SDD change

- **F-01** + **F-02** — `FiscalPeriodsService.create` broken invariants (one-period-per-year guard and one-open-period guard). These are functional bugs introduced by the model change in cierre-periodo. They touch the fiscal-period creation flow which has its own test suite and will need RED tests before touching service code. Recommend a mini SDD change: `fiscal-period-monthly-create`.
- **F-03** — `countDraftDocuments` missing Sale/Purchase coverage. This is a spec gap (REQ-4 predates T15's decision to lock Sales/Purchases). Needs spec update + RED test + service/repo change. Include in `fiscal-period-monthly-create` or as a standalone task.
