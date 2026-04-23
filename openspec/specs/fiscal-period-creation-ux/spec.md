# Delta — fiscal-period-creation-ux

**Change**: `fiscal-period-form-ux`
**Capability**: `fiscal-period-creation-ux` (NEW — no canonical spec exists for this surface)
**Date**: 2026-04-23
**Type**: Full new capability spec (no existing `openspec/specs/fiscal-period-creation-ux/` to delta against)

## Preamble

No canonical spec covers the `PeriodCreateDialog` UX. This is therefore a FULL spec for the new `fiscal-period-creation-ux` capability, not a delta. The backend (`FiscalPeriodsService`, schema, validation) is unchanged; all requirements are pure UI behavior.

User-facing strings follow **voseo Rioplatense** Spanish.

---

## Requirements

### REQ-1 — Guidance Textual: Placeholder Mensual + Microcopia

The `name` field placeholder MUST read `"Ej: Abril 2026"`.

The dialog MUST render a microcopia line below the dialog title: `"Un período fiscal representa un mes contable. Cerrás uno por mes."`.

#### Scenario UX-T01 — Placeholder y microcopia presentes en el DOM

- GIVEN el `PeriodCreateDialog` se monta con `open=true`
- WHEN el componente renderiza
- THEN el input `name` tiene `placeholder="Ej: Abril 2026"`
- AND el texto `"Un período fiscal representa un mes contable. Cerrás uno por mes."` está presente en el DOM

---

### REQ-2 — Campo Mes con Autocompletado de Fechas y Nombre

The dialog MUST render a `<Select>` of 12 months (Enero–Diciembre) positioned before the date fields.

When a month is selected (combined with the current `year` value):

- `startDate` MUST autocomplete to the first calendar day of that month (`YYYY-MM-01`).
- `endDate` MUST autocomplete to the last calendar day of that month (`YYYY-MM-DD`, accounting for leap years).
- `name` MUST autocomplete to `"<MesES> <year>"` (e.g., `"Abril 2026"`).

Fields `startDate`, `endDate`, and `name` MUST remain manually editable after autocomplete; a manual edit MUST override the autocompleted value and the autocompletion MUST NOT overwrite it on subsequent renders.

#### Scenario UX-T02 — Selección de mes autocompleta fechas

- GIVEN el dialog está abierto con `year=2026`
- WHEN el usuario selecciona `mes=Abril` en el Select
- THEN `startDate` es `"2026-04-01"`
- AND `endDate` es `"2026-04-30"`

#### Scenario UX-T03 — Selección de mes autocompleta nombre

- GIVEN el dialog está abierto con `year=2026`
- WHEN el usuario selecciona `mes=Abril` en el Select
- THEN el campo `name` muestra `"Abril 2026"`

#### Scenario UX-T04 — Edición manual posterior no es sobreescrita

- GIVEN el usuario seleccionó `mes=Abril` (autocomplete aplicado)
- WHEN el usuario edita manualmente `startDate` a `"2026-04-05"`
- THEN `startDate` retiene `"2026-04-05"` (el override manual gana)
- AND cambios posteriores al año/mes NO sobreescriben `startDate`

---

### REQ-3 — Shortcut "Crear los 12 meses del año"

The dialog MUST render a secondary button labeled `"Crear los 12 meses de {año}"`.

When clicked, the handler MUST issue 12 sequential creation requests — one per month (Enero=1 through Diciembre=12) — for the selected `year`, each with:
- `startDate` = first day of the month
- `endDate` = last day of the month
- `name` = `"<MesES> <year>"`

Requests returning `409 FISCAL_PERIOD_MONTH_EXISTS` MUST be treated as **already exists** (not a failure). After all 12 requests settle, the handler MUST surface a summary: how many periods were created and how many already existed. The dialog MUST close on completion.

**OQ-1 resolution (deferred to design):** Atomic transaction vs. 12 individual requests is forwarded to `sdd-design`. This spec mandates the observable behavior (12 periods, duplicate tolerance, summary) without prescribing the transport strategy.

#### Scenario UX-T07 — Botón emite creación para los 12 meses

- GIVEN el dialog está abierto con `year=2026` y el fetch está mockeado para retornar 201
- WHEN el usuario hace click en `"Crear los 12 meses de 2026"`
- THEN se emiten exactamente 12 requests con `month` de 1 a 12 y fechas correctas para cada mes

#### Scenario UX-T08 — Tolerancia a duplicados existentes

- GIVEN 3 meses ya existen (retornan 409 con código `FISCAL_PERIOD_MONTH_EXISTS`)
- WHEN el usuario hace click en el botón batch
- THEN los 9 restantes se crean correctamente
- AND el handler muestra un resumen: `"9 períodos creados, 3 ya existían"`
- AND el dialog se cierra al finalizar

---

### REQ-4 — Warning Soft en Rango Cross-Month

When `startDate` and `endDate` are both populated and the date range does NOT correspond to exactly one calendar month (i.e., `startDate.month !== endDate.month` OR `startDate.day !== 1` OR `endDate !== lastDayOf(startDate.month)`), the dialog MUST display a non-blocking warning banner.

Warning text (resolved from OQ-2): `"Este período abarca más de un mes. Al cerrarlo, se bloquearán todos los comprobantes del período a la vez. ¿Es lo que querés?"`

The warning MUST NOT disable the submit button or prevent form submission.

**OQ-2 resolution**: Warning is fixed text (no dynamic "N months" count) — keeps it simple and testable; dynamic impact preview forwarded to design as optional enhancement.

**OQ-3 resolution**: Microcopia uses "período mensual" framing (`"Un período fiscal representa un mes contable."`) — preserves openness for non-monthly edge cases while guiding toward the monthly default.

This warning is the **first line of defense**. The server-side guard (REQ-5) is the second line. If the user dismisses the warning and submits, the server returns 400 with `FISCAL_PERIOD_NOT_MONTHLY`; the client MUST display the resulting error message from `AppError.details`.

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

### REQ-5 — Server-side monthly-shape invariant

`FiscalPeriodsService.create()` MUST reject any request where the computed `(startDate, endDate)` pair does not cover exactly one UTC calendar month.

This check MUST run after the existing `INVALID_DATE_RANGE` guard and before the month uniqueness pre-check.

On violation, the service MUST throw a `ValidationError` with code `FISCAL_PERIOD_NOT_MONTHLY` and message `"El período debe corresponder a exactamente un mes calendario."` This error MUST surface as HTTP 400 at `POST /api/organizations/[orgSlug]/periods`, with `AppError.details` populated so the UI can display the specific validation failure.

Acceptance criteria:
- AC-5.1: `startDate.getUTCDate() === 1`
- AC-5.2: `endDate` equals last UTC day of `startDate`'s month
- AC-5.3: On violation, throw `ValidationError(FISCAL_PERIOD_NOT_MONTHLY)`
- AC-5.4: Spanish voseo message: `"El período debe corresponder a exactamente un mes calendario."`
- AC-5.5: HTTP 400 at `POST /api/organizations/[orgSlug]/periods`
- AC-5.6: `AppError.details` populated for UI display (shape: `{ startDate: ISO, endDate: ISO }`)

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
- THEN the response is 400 — `new Date('2025-02-29')` silently rolls to 2025-03-01; guard catches the mismatch and throws `FISCAL_PERIOD_NOT_MONTHLY`

#### Scenario ME-T08 — Valid monthly shape accepted (regression)

- GIVEN a POST body with `startDate=2026-04-01` and `endDate=2026-04-30`
- WHEN the service processes the request
- THEN the response is 201 OK

#### Scenario ME-T09 — Existing test suites pass (no regression)

- GIVEN the existing test suite in `fiscal-periods.service.multiplicity.test.ts`
- WHEN the full test suite runs after implementing REQ-5
- THEN all prior scenarios continue to pass

---

## Open Questions Forwarded to Design

| # | Question | Status |
|---|----------|--------|
| OQ-1 | Batch: atomic transaction vs. 12 individual requests; partial failure handling | **Forwarded to sdd-design** |
| OQ-4 | `MONTH_NAMES_ES` placement — currently `private const` inside `server-only` service; client needs the same list | **Forwarded to sdd-design** |

---

## Constraints

- The backend is a partner to the UX enforcement: a server-side guard layer exists at `FiscalPeriodsService.create()` (REQ-5). The earlier "Backend MUST NOT be modified" constraint was a scoping decision for the original Option A (UI-only) and was superseded by the `fiscal-period-monthly-enforcement` change.
- The `@@unique([organizationId, year, month])` constraint on `FiscalPeriod` is the source of truth for duplicate detection.
- `PERMISSIONS_WRITE["period"] = ["owner", "admin"]` — the create action is already gated correctly at the API layer; no permission changes in scope.
- User-facing strings follow voseo Rioplatense Spanish.
- `FISCAL_PERIOD_NOT_MONTHLY` MUST be the sole error code for REQ-5 violations. No shadow codes.
- Error-code precedence: `INVALID_DATE_RANGE` fires before `FISCAL_PERIOD_NOT_MONTHLY` (existing guard runs first).
- `lastDayOfUTCMonth` helper MUST use `new Date(Date.UTC(year, month, 0))` pattern or equivalent that correctly returns Feb 29 in leap years.
