# Exploration: fiscal-period-monthly-enforcement

**Status**: EXPLORATION — no commitment to implement
**Date**: 2026-04-23
**Reopen context**: Option A (UX guidance) just shipped as `fiscal-period-form-ux`; operator reopening Option B proactively — NOT from a second incident.

---

## 1. Current Schema State

### FiscalPeriod model (`prisma/schema.prisma` lines 396–424)

```
year           Int               // non-nullable
month          Int               // non-nullable; comment: "1..12 — calendar month (CHECK constraint in migration)"
startDate      DateTime
endDate        DateTime
@@unique([organizationId, year, month])
```

**There is NO `FiscalPeriodGranularity` enum.** The only period-related enum is `FiscalPeriodStatus { OPEN | CLOSED }`.

### DB-level constraints from migration `20260422004238_cierre_periodo`

```sql
CONSTRAINT "fiscal_periods_month_check" CHECK ("month" BETWEEN 1 AND 12)
```

A `CHECK ("month" BETWEEN 1 AND 12)` already exists at the DB level. No CHECK on `startDate`/`endDate` alignment.

The `@@unique([organizationId, year, month])` index name in Prisma maps to:
`"fiscal_periods_organizationId_year_month_key"` — this name is hard-coded as a **trip-wire string** in both `fiscal-periods.service.ts` (P2002 catch) and `fiscal-periods.service.multiplicity.test.ts`. Any migration that renames this index MUST update both locations.

### How `month` is derived at creation

In `fiscal-periods.repository.ts:56`:
```typescript
month: data.startDate.getUTCMonth() + 1,
```

The `month` column is **not accepted from the API input** — it is derived server-side from `startDate`. The Zod schema (`fiscal-periods.validation.ts`) does NOT include `month` — the API body only takes `{ name, year, startDate, endDate }`.

**Critical implication**: A user can still create a period where `startDate = 2026-01-01` and `endDate = 2026-12-31`. The `month` column will be `1` (January), derived from `startDate`. The period passes the `@@unique` constraint and the `CHECK (month BETWEEN 1 AND 12)` constraint. There is **no validation that `endDate` matches the end of month `month`**.

### Existing implicit invariant

`month` tells you which month `startDate` falls in — but `endDate` can be anything. The existing constraint only prevents two periods starting in the same calendar month for the same org+year. It does NOT prevent a period that spans multiple months.

---

## 2. Consumers

| Consumer | Location | Assumes monthly? | Failure mode on non-monthly period |
|----------|----------|-------------------|------------------------------------|
| `MonthlyCloseService.close()` | `features/monthly-close/monthly-close.service.ts` | No — uses `periodId` FK, does not inspect date range | Silent wrongness: closes an annual period as if it were a month; all 12 months of data get locked at once |
| `MonthlyCloseService.getSummary()` | same file | No | Same: reports annual summary as "one month close" |
| `FinancialStatementsService` | `features/accounting/financial-statements/financial-statements.service.ts` | Uses `period.startDate` / `period.endDate` as date range bounds | Correct range behavior but annual range produces a 12-month statement labeled as "one period" — confusing but not broken |
| `WorksheetService` | `features/accounting/worksheet/worksheet.service.ts` | Uses `period.startDate` / `period.endDate` for intersection | Same: annual range, annual worksheet |
| `BalanceSourceResolver` | `features/accounting/financial-statements/balance-source.resolver.ts:75` | Checks `period.status === "CLOSED" && isSameDay(params.date, period.endDate)` | If `endDate = 2026-12-31`, snapshot lookup is correct at year-end but wrong for mid-year dates |
| `FiscalPeriodsService.create()` | service pre-check + P2002 catch | Assumes month derives from `startDate.getUTCMonth() + 1` — allows any `endDate` | Allows creation of multi-month periods silently |
| `period-list.tsx` | `components/accounting/period-list.tsx:82–87` | Renders `period.year` + `formatDate(period.startDate)` + `formatDate(period.endDate)` | Displays annual date range — user can see the anomaly but no error |
| `monthly-close-panel.tsx` | `components/accounting/monthly-close-panel.tsx` | Uses `period.name` only for display | Non-monthly name (e.g., "Gestión 2026") shown — confusing but not broken |
| `IvaPurchaseBook` / `IvaSalesBook` | schema + iva-books feature | Uses `fiscalPeriodId` FK for grouping | Groups 12 months of invoices under one annual IVA book — regulatory problem (Bolivian tax authority expects monthly IVA books) |
| `JournalEntry` | All journal operations use `periodId` FK | No date-range assumption | No runtime error; LOCKED state affects all entries in the annual period at once |
| Dispatch / Payment / Purchase / Sale | Each references `periodId` | No date-range assumption | All 12 months of operational data locked at annual close |

**Most dangerous consumer for regulatory compliance**: `IvaPurchaseBook` / `IvaSalesBook` — Bolivian SIN expects monthly IVA books. An annual `fiscalPeriodId` on an IVA book creates a regulatory antipattern (all-year invoices under one monthly IVA period entry).

**Loudest failure**: The MonthlyCloseEngine does NOT check `startDate.month === endDate.month`. The close succeeds for an annual period but produces nonsensical audit state (one correlationId locking an entire year's data).

---

## 3. Enforcement Options

### Option B.1 — Zod refinement in `fiscal-periods.validation.ts`

**Mechanism**: Add `.refine()` to `createFiscalPeriodSchema`:
- `startDate.getUTCDate() === 1` (starts on first of month)
- `endDate` equals last day of the same UTC month as `startDate`
- Optionally: `endDate.getUTCMonth() === startDate.getUTCMonth()`

**Error UX**: 400 validation error at POST `/api/organizations/[orgSlug]/periods`; client shows Zod error message (currently handled via `handleError`). Message can be: `"El período debe corresponder a exactamente un mes calendario."`.

**Reversibility**: Very high — remove the `.refine()` clauses, no migration needed.

**Migration cost**: Zero schema migration. Existing data unaffected. If production orgs have annual periods already, THEY ARE NOT BLOCKED from using the existing records — only new creation is blocked.

**Breaking consumers**: None — validation runs at creation, not at read. Existing annual periods survive. The batch "Crear los 12 meses" button already creates correctly-shaped periods; REQ-3 in the UX spec mandates first-of-month start / last-of-month end per month, so the batch button is fully compatible.

**Escape hatch**: A quarterly or fiscal-transition period (e.g., Oct–Dec as a 3-month bridging period) would be rejected. No known legitimate non-monthly use case exists in this repo's domain (Bolivian SME accounting), but this is the main risk.

**Canonical location**: `features/fiscal-periods/fiscal-periods.validation.ts` — currently only 17 lines. This is where other input-contract validations live (name length, year range).

---

### Option B.2 — Service-level guard in `fiscal-periods.service.ts`

**Mechanism**: In `create()`, between the `endDate <= startDate` guard (line 42) and the month uniqueness pre-check (line 54), add:
```
if (startDate.getUTCDate() !== 1 || endDate !== lastDayOfUTCMonth(startDate)) {
  throw new ValidationError("...", FISCAL_PERIOD_NOT_MONTHLY)
}
```

**Canonical location**: `features/fiscal-periods/fiscal-periods.service.ts` — where other business rule violations are thrown (`INVALID_DATE_RANGE`).

**Error UX**: Same 400 → `FISCAL_PERIOD_NOT_MONTHLY` code (new error constant needed in `features/shared/errors.ts`).

**Reversibility**: Very high — same as B.1, no migration.

**Migration cost**: Zero.

**Breaking consumers**: None on existing data.

**Comparison with B.1**: B.1 (Zod) runs before the service; catches at the HTTP boundary. B.2 (service) runs after parse; catches at the domain boundary. For this project, validation of date-range semantics is **split** — structural shape belongs to Zod (`createFiscalPeriodSchema`), but business invariants belong to the service. The F-01 antipattern catalog entry (`features/shared/errors.ts` includes `INVALID_DATE_RANGE`) shows that date-range semantic validation (`endDate <= startDate`) lives in the **service** (line 42). Following that pattern, B.2 is more canonical for this repo.

**Escape hatch**: Same risk as B.1.

---

### Option B.3 — Prisma `@@check` / DB-level CHECK constraint

**Mechanism**: Add a migration with:
```sql
ALTER TABLE "fiscal_periods"
  ADD CONSTRAINT "fiscal_periods_monthly_check"
  CHECK (
    EXTRACT(DAY FROM "startDate") = 1
    AND "month" = EXTRACT(MONTH FROM "startDate")
    AND "endDate" = DATE_TRUNC('month', "startDate") + INTERVAL '1 month' - INTERVAL '1 day'
  );
```

Note: PostgreSQL `EXTRACT` on `TIMESTAMP(3)` (stored in UTC) returns UTC values — consistent with how `month` is already derived (`getUTCMonth()`).

**Reversibility**: Low — requires a new migration to drop. If future orgs have annual periods in production, the migration will FAIL unless those rows are cleaned first (or the constraint is `NOT VALID` deferred).

**Migration cost**: Medium — must verify existing production data satisfies the constraint before migration runs. The `NOT VALID` flag can defer validation to `VALIDATE CONSTRAINT`, allowing gradual cleanup.

**Breaking consumers**: Any future caller that bypasses the service (e.g., a raw Prisma call, a seed script, a migration) is blocked at the DB level. Strongest guarantee.

**Error UX**: Prisma throws `PrismaClientKnownRequestError P2002` (or `P0001`/`P2023` depending on constraint type). Must be caught in service and mapped to a user-facing error — similar to the P2002 trip-wire already in `fiscal-periods.service.ts`.

**Escape hatch**: Hardest to escape — requires a migration + constraint drop to allow quarterly periods.

**Key risk**: PostgreSQL interval arithmetic for "last day of month" is non-trivial (e.g., Feb 28/29). The `DATE_TRUNC + 1 month - 1 day` idiom is correct but should be verified against leap year data.

---

### Option B.4 — Drop `startDate`/`endDate`, use only `year` + `month`

**Mechanism**: Remove `startDate` and `endDate` from the `FiscalPeriod` model. Derive them on-the-fly in any consumer that needs date bounds.

**Reversibility**: Very low — destructive migration, breaks all existing consumers. All 8+ FK tables' queries that JOIN on `period.startDate`/`period.endDate` must be rewritten.

**Migration cost**: Very high. From the consumer inventory:
- `FinancialStatementsService`: reads `period.startDate` / `period.endDate` directly
- `WorksheetService`: same
- `BalanceSourceResolver`: reads `period.endDate` for snapshot check
- `period-list.tsx`: renders `period.startDate` / `period.endDate`
- `features/accounting/iva-books` tests: use `startDate`/`endDate` in fixtures

**Breaking consumers**: All of the above + IVA books test fixtures (which already encode annual date ranges as anti-pattern data — a separate cleanup obligation).

**Error UX**: N/A — no validation; monthly shape is structural.

**Escape hatch**: None — monthly shape is permanent.

**Assessment**: High value long-term (eliminates the antipattern class permanently) but high disruption. Not warranted while Option A is still in its first week. Revisit if Option B.2 is insufficient AND the schema reaches v2.

---

### Option B.5 — Introduce `PeriodGranularity` enum

**Mechanism**: Add `enum PeriodGranularity { MONTHLY QUARTERLY ANNUAL }` to schema. Add `granularity PeriodGranularity @default(MONTHLY)` to `FiscalPeriod`. Consumers gate behavior on enum.

**Reversibility**: Medium — schema migration needed to add column, but the column is additive (nullable or with default). Dropping it later requires another migration.

**Migration cost**: Medium — one migration to add the column + backfill. Existing rows get `MONTHLY` default, which matches the intended shape.

**Breaking consumers**: None immediately — additive change. Future consumers that gate behavior on `granularity` would need the enum.

**Error UX**: Requires form UI to expose the granularity choice. Currently the UX spec explicitly says "Un período fiscal representa un mes contable" — adding a granularity selector would contradict this framing.

**Escape hatch**: Built-in — `QUARTERLY` and `ANNUAL` values explicitly supported. IVA books and MonthlyCloseEngine would need conditional logic per granularity.

**Assessment**: Highest complexity, highest flexibility. Only justified if there is a confirmed product requirement for non-monthly periods (quarterly close, fiscal year close). No such requirement exists in this repo today.

---

## 4. Detection — How "Second Incident" Would Surface

### Active detection channels (currently)

1. **UX path**: Operator or user sees "Gestión 2026" instead of "Abril 2026" in the period list — this is now harder with the UX fix (REQ-1 microcopia, monthly Select).
2. **Close attempt failure**: MonthlyCloseEngine runs on an annual period → succeeds (does not fail!) but locks all 12 months of data at once. The user would see the correlationId toast and `CLOSED` badge — confusing but no error.
3. **IVA book anomaly**: An IVA book entry for the entire year would appear under a single "Enero 2026" period ID — detectable when printing monthly IVA reports.

### There is NO active telemetry or log for "period shape anomalies".

### Audit query the operator can run TODAY

```sql
SELECT
  id,
  "organizationId",
  name,
  year,
  month,
  "startDate",
  "endDate",
  EXTRACT(DAY FROM "startDate") AS start_day,
  EXTRACT(MONTH FROM "endDate") AS end_month,
  DATE_TRUNC('month', "startDate") + INTERVAL '1 month' - INTERVAL '1 day' AS expected_end
FROM fiscal_periods
WHERE
  EXTRACT(DAY FROM "startDate") != 1
  OR EXTRACT(MONTH FROM "endDate") != EXTRACT(MONTH FROM "startDate")
  OR "endDate" != DATE_TRUNC('month', "startDate") + INTERVAL '1 month' - INTERVAL '1 day';
```

This query returns all periods that are NOT exactly one calendar month. Zero rows = no latent annual-period problem in production today. Non-zero rows = the antipattern exists and Option A may already have failed.

### Signal escalation path

1. Operator runs the audit query → zero rows → stay in Option A watch mode.
2. Operator runs the audit query → non-zero rows → escalate to Option B.2 immediately.
3. Support ticket referencing "all months closed at once" → escalate to Option B.2 immediately.
4. MonthlyCloseEngine produces a `PERIOD_ALREADY_CLOSED` error for a period the user "just created" → investigate period shape.

---

## 5. Prior Art

### `2026-04-22-monthly-close-ui-reconciliation`

**Key decisions established**:
- `PERMISSIONS_WRITE["period"] = ["owner", "admin"]` — established in this change (F-12, commit `63b21f9`). Previous value was `[]` with no justification. Now ratified.
- `PERMISSIONS_CLOSE["period"] = ["owner", "admin"]` and `PERMISSIONS_REOPEN["period"] = ["owner", "admin"]` — same matrix.
- The canonical close surface is `/accounting/monthly-close` (not `/settings/periods`).
- Rule 7 draft: "architectural invariant collision elevation" — when a proposal collides with an existing constraint, escalate rather than silently resolve.

**Relevant invariant**: The `monthly-close-ui-reconciliation` change explicitly retired the old `period-close-dialog.tsx` and wired the close flow through the dedicated monthly-close page. Any enforcement that adds error states at period-creation time MUST consider the UX flow at `/accounting/monthly-close` and the batch button at `/settings/periods`.

### `2026-04-22-fiscal-period-monthly-create`

This is the archived change that introduced the `@@unique([organizationId, year, month])` constraint and the `month` column. The `cierie_periodo` migration (`20260422004238`) is the artifact. The `findByYearAndMonth` pre-check and P2002 trip-wire in the service are from this change.

**Key insight**: This change ALREADY established monthly granularity as the DB schema assumption. The `year+month` unique constraint ALREADY treats each row as one month. What's missing is the validation that `startDate` and `endDate` actually cover exactly that month.

### `2026-04-23-fiscal-period-form-ux`

**Canonical spec**: `openspec/specs/fiscal-period-creation-ux/spec.md`
**Non-negotiable from this spec** (Constraints section):
- "Backend (`FiscalPeriodsService`, validation schema, Prisma schema) MUST NOT be modified." — This was the Option A constraint. Option B explicitly supersedes this constraint.
- `@@unique([organizationId, year, month])` is the source of truth for duplicate detection (this remains true for any Option B variant).
- `PERMISSIONS_WRITE["period"] = ["owner", "admin"]` — stays.

### Antipattern Catalog (engram #964)

Item **F-01** directly names this pattern:
> "F-01 scar: period uniqueness via only one mechanism — needs both DB constraint AND service-level guard on (organizationId, year, month)"

The catalog entry was written about the `year+month` uniqueness. The next layer (date-range alignment) is the F-01 corollary: the system has the uniqueness guard but lacks the date-range alignment guard.

### IVA Book test fixtures — latent antipattern in test data

`features/accounting/iva-books/__tests__/iva-books.repository.test.ts` (lines 67–70, 272–275) creates `FiscalPeriod` fixtures with:
```typescript
year: 2025, month: 1,
startDate: new Date("2025-01-01"),
endDate: new Date("2025-12-31"),  // ← annual range, not monthly!
```

This is the antipattern baked into test fixtures. If Option B.3 (DB-level CHECK) were applied in the test database, these tests would FAIL at fixture creation. This is a **hidden dependency** that Option B.3 would surface — and would require cleanup.

---

## 6. Non-Negotiables

Any future proposal MUST respect:

1. **Existing 12-monthly-period orgs must not break** — any enforcement is creation-only; existing rows must remain accessible and closeable regardless of shape.

2. **`fiscal-period-creation-ux` canonical spec remains valid or is explicitly superseded** — The constraint "Backend MUST NOT be modified" in the spec is an Option A constraint. If Option B is implemented, the spec MUST be updated to reflect the new Zod/service validation behavior. Specifically, the soft warning (REQ-4) would change from a non-blocking warning to an error — or both would coexist (error from backend, warning gone from frontend since the shape is enforced).

3. **RBAC matrix stays at `["owner", "admin"]`** — `PERMISSIONS_WRITE["period"]`, `PERMISSIONS_CLOSE["period"]`, `PERMISSIONS_REOPEN["period"]` all remain `["owner", "admin"]`. Any enforcement change does not touch permissions.

4. **`MONTH_NAMES_ES` isomorphic location** — `features/fiscal-periods/month-names.ts` (no `"server-only"` import, safe for client and server). Any validation error message referencing a month name MUST use this module. The service already does (`MONTH_NAMES_ES[month - 1]` in `fiscal-periods.service.ts:61,85`).

5. **Trip-wire string must stay consistent** — The index name `"fiscal_periods_organizationId_year_month_key"` appears in `fiscal-periods.service.ts` AND `fiscal-periods.service.multiplicity.test.ts`. Do not rename without updating both.

6. **IVA book test fixtures must be cleaned before Option B.3** — The annual-period test fixtures in `iva-books.repository.test.ts` would violate a DB-level CHECK constraint. This is a prerequisite cleanup, not a blocker for B.1 or B.2.

7. **`createFiscalPeriodInput` does NOT include `month`** — The type `CreateFiscalPeriodInput` in `fiscal-periods.types.ts` has `{ name, year, startDate, endDate, createdById }`. The `month` column is always derived server-side from `startDate`. Adding month to the input type would break the existing derivation pattern.

---

## 7. Recommendation (explore-phase only, not binding)

**Recommended option**: **B.2 (service-level guard)**, canonically placed in `fiscal-periods.service.ts` between the `INVALID_DATE_RANGE` guard and the month uniqueness pre-check.

**Rationale**: B.1 (Zod) is structurally valid but mixes date-range semantics (business rule) with schema shape validation (type contract) — the F-01 antipattern catalog entry shows this project separates those concerns. B.2 follows the existing pattern (`INVALID_DATE_RANGE` in service, not Zod). B.3 (DB CHECK) adds durability but creates a test-fixture cleanup obligation and requires a migration. B.4 and B.5 are over-engineered for the current risk level.

**Trigger condition**: Implement B.2 when EITHER:
- The audit query (Section 4) returns non-zero rows in production, OR
- A second incident of "annual period confusion" is reported (the original reopen criterion from 2026-04-22).

**What this buys**: A single `.refine()`-equivalent block in the service would eliminate the antipattern permanently at the creation boundary, without any migration, without breaking existing orgs, without touching the UI, and without conflicting with the batch button (which already creates correctly-shaped periods).

---

## Appendix: Files for a Future Proposal

| File | Change needed |
|------|---------------|
| `features/fiscal-periods/fiscal-periods.service.ts` | Add monthly-shape guard after `endDate <= startDate` check |
| `features/shared/errors.ts` | Add `FISCAL_PERIOD_NOT_MONTHLY` error code constant |
| `features/fiscal-periods/fiscal-periods.validation.ts` | Optional: if B.1 chosen instead of B.2 |
| `openspec/specs/fiscal-period-creation-ux/spec.md` | Update to reflect REQ-4 soft warning becomes hard error |
| `features/accounting/iva-books/__tests__/iva-books.repository.test.ts` | Clean annual-period fixtures (lines 70, 275) — prerequisite for B.3 only |
