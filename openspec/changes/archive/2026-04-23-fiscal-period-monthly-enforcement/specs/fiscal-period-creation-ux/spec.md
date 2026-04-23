# Delta: fiscal-period-creation-ux → [fiscal-period-monthly-enforcement]

**Change**: `fiscal-period-monthly-enforcement`
**Capability**: `fiscal-period-creation-ux` (DELTA — canonical at `openspec/specs/fiscal-period-creation-ux/spec.md`)
**Date**: 2026-04-23

**Supersedes**: `openspec/specs/fiscal-period-creation-ux/spec.md` §Constraints — constraint "Backend (`FiscalPeriodsService`, validation schema, Prisma schema) MUST NOT be modified" is **lifted**. That constraint was a scoping decision for the original Option A (UI-only), not an architectural invariant. This change adopts Option B.2 (service-level guard). See proposal for full rationale.

---

## ADDED Requirements

### REQ-5 — Server-side monthly-shape invariant

`FiscalPeriodsService.create()` MUST reject any request where the computed `(startDate, endDate)` pair does not cover exactly one UTC calendar month.

This check MUST run after the existing `INVALID_DATE_RANGE` guard and before the month uniqueness pre-check.

On violation, the service MUST throw a `ValidationError` with code `FISCAL_PERIOD_NOT_MONTHLY` and message `"El período debe corresponder a exactamente un mes calendario."` This error MUST surface as HTTP 400 at `POST /api/organizations/[orgSlug]/periods`, with `AppError.details` populated so the UI can display the specific validation failure.

#### Scenario ME-T01 — Annual period rejected

- GIVEN a POST body with `startDate=2026-01-01` and `endDate=2026-12-31`
- WHEN `FiscalPeriodsService.create()` processes the request
- THEN the response is 400 with code `FISCAL_PERIOD_NOT_MONTHLY`

#### Scenario ME-T02 — Start not on first of month rejected

- GIVEN a POST body with `startDate=2026-01-15` and `endDate=2026-01-31`
- WHEN the service processes the request
- THEN the response is 400 with code `FISCAL_PERIOD_NOT_MONTHLY`

#### Scenario ME-T03 — End not last day of month rejected

- GIVEN a POST body with `startDate=2026-01-01` and `endDate=2026-01-30`
- WHEN the service processes the request
- THEN the response is 400 with code `FISCAL_PERIOD_NOT_MONTHLY`

#### Scenario ME-T04 — Leap year February accepted

- GIVEN a POST body with `startDate=2024-02-01` and `endDate=2024-02-29`
- WHEN the service processes the request (2024 is a leap year)
- THEN the response is 201 OK

#### Scenario ME-T05 — Non-leap February 2026 accepted

- GIVEN a POST body with `startDate=2026-02-01` and `endDate=2026-02-28`
- WHEN the service processes the request (2026 is not a leap year)
- THEN the response is 201 OK

#### Scenario ME-T06 — Non-leap February 2025 accepted

- GIVEN a POST body with `startDate=2025-02-01` and `endDate=2025-02-28`
- WHEN the service processes the request (2025 is not a leap year)
- THEN the response is 201 OK

#### Scenario ME-T07 — Invalid date Feb 29 in non-leap year

- GIVEN a POST body with `startDate=2025-02-01` and `endDate=2025-02-29`
- WHEN the service processes the request
- THEN the response is 400 — exact code depends on whether Zod schema rejects the invalid date before service validation (to be confirmed in design); `FISCAL_PERIOD_NOT_MONTHLY` is the expected code if it reaches service level

#### Scenario ME-T08 — Valid monthly shape accepted (regression)

- GIVEN a POST body with `startDate=2026-04-01` and `endDate=2026-04-30`
- WHEN the service processes the request
- THEN the response is 201 OK

#### Scenario ME-T09 — Existing test suites pass (no regression)

- GIVEN the existing test suite in `fiscal-periods.service.multiplicity.test.ts`
- WHEN the full test suite runs after implementing REQ-5
- THEN all prior scenarios continue to pass

---

## MODIFIED Requirements

### REQ-4 — Warning Soft en Rango Cross-Month

When `startDate` and `endDate` are both populated and the date range does NOT correspond to exactly one calendar month (i.e., `startDate.month !== endDate.month` OR `startDate.day !== 1` OR `endDate !== lastDayOf(startDate.month)`), the dialog MUST display a non-blocking warning banner.

Warning text: `"Este período abarca más de un mes. Al cerrarlo, se bloquearán todos los comprobantes del período a la vez. ¿Es lo que querés?"`

The warning MUST NOT disable the submit button or prevent form submission.

This warning is the **first line of defense**. The server-side guard (REQ-5) is the second line. If the user dismisses the warning and submits, the server returns 400 with `FISCAL_PERIOD_NOT_MONTHLY`; the client MUST display the resulting error message from `AppError.details`.

(Previously: warning was sole defense — no server-side rejection existed. REQ-5 now acts as authoritative enforcer; REQ-4 remains UX guidance layer.)

#### Scenario UX-T05 — Warning visible con rango cross-month

- GIVEN `startDate="2026-01-01"` y `endDate="2026-12-31"` están ingresados
- WHEN el componente renderiza
- THEN el banner `"Este período abarca más de un mes..."` es visible en el DOM

#### Scenario UX-T06 — Warning no bloquea el submit

- GIVEN el warning cross-month está visible
- AND los campos requeridos (`name`, `startDate`, `endDate`) están completos
- WHEN el usuario intenta hacer submit
- THEN el botón `"Crear Período"` está habilitado
- AND el form puede ser enviado

#### Scenario UX-T10 — Server rejection surfaces Spanish-voseo message

- GIVEN el usuario ignoró el warning y envió un rango cross-month
- WHEN el servidor responde 400 con código `FISCAL_PERIOD_NOT_MONTHLY`
- THEN el cliente muestra el mensaje `"El período debe corresponder a exactamente un mes calendario."`
- AND no se muestra stack trace ni mensaje técnico

---

## REMOVED Constraints

### Constraint — "Backend MUST NOT be modified"

(Reason: Lifted by this change. The constraint was a scoping decision for Option A (UI-only). Option B.2 — service-level guard — supersedes it. Rationale documented in `openspec/changes/fiscal-period-monthly-enforcement/proposal.md`.)

---

## Constraints (added by this delta)

- `FISCAL_PERIOD_NOT_MONTHLY` MUST be the sole error code for REQ-5 violations. No shadow codes.
- Error-code precedence: if `INVALID_DATE_RANGE` (endDate <= startDate) would also apply, `INVALID_DATE_RANGE` is reported first (existing guard runs before REQ-5 guard).
- `lastDayOfUTCMonth` helper MUST use `new Date(Date.UTC(year, month, 0))` pattern or equivalent that correctly returns Feb 29 in leap years. Direct unit test required.
- `month` column derivation is unchanged: server derives from `startDate.getUTCMonth() + 1`.
- No schema migration. No data migration.

---

## Test Strategy

| Suite | Coverage |
|-------|----------|
| `fiscal-periods.service.monthly-shape.test.ts` (new) | ME-T01 through ME-T09 |
| `lastDayOfUTCMonth` unit test (new) | Jan, Feb-leap, Feb-non-leap, Apr, Dec |
| `fiscal-periods.service.multiplicity.test.ts` (existing) | Regression — must pass unchanged |

---

## Open Questions → Forwarded to Design

| # | Question |
|---|---------|
| OQ-1 | `lastDayOfUTCMonth()` helper placement: `features/fiscal-periods/month-helpers.ts` vs. inline vs. `lib/dates.ts` |
| OQ-2 | Error-code precedence ordering confirmed in Constraints above; design confirms implementation guard ordering |
| OQ-3 | `FISCAL_PERIOD_NOT_MONTHLY` constant location: `features/shared/errors.ts` (project pattern) vs. feature-local |
| OQ-4 | Does `FiscalPeriodsService` have an `update()` method? If yes, does REQ-5 guard apply? Design decides. |
| OQ-5 | Test file organization: single new file `monthly-shape.test.ts` vs. append to `multiplicity.test.ts` |

---

## Out of Scope (inherited from proposal)

- DB-level `CHECK` constraint (B.3) — blocked by 16+ test suites using annual-period fixtures
- Data migration of existing non-monthly rows
- `UPDATE` path guard applicability — forwarded to design (OQ-4)
- Test-fixture cleanup (`sdd/test-fixtures-realistic-periods` backlog)
