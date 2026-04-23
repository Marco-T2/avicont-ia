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

---

## Open Questions Forwarded to Design

| # | Question | Status |
|---|----------|--------|
| OQ-1 | Batch: atomic transaction vs. 12 individual requests; partial failure handling | **Forwarded to sdd-design** |
| OQ-4 | `MONTH_NAMES_ES` placement — currently `private const` inside `server-only` service; client needs the same list | **Forwarded to sdd-design** |

---

## Constraints

- Backend (`FiscalPeriodsService`, validation schema, Prisma schema) MUST NOT be modified.
- The `@@unique([organizationId, year, month])` constraint on `FiscalPeriod` is the source of truth for duplicate detection.
- `PERMISSIONS_WRITE["period"] = ["owner", "admin"]` — the create action is already gated correctly at the API layer; no permission changes in scope.
- User-facing strings follow voseo Rioplatense Spanish.
