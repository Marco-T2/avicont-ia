# Exploration: audit-operation-card-grouping

**Date**: 2026-04-26
**Status**: COMPLETE — ready for proposal

## Context

El usuario reporta que el listado de auditoría es confuso: una sola modificación de Asiento Contable se renderiza como **3 filas separadas** ("Asientos contables / Línea de asiento / Línea de asiento"), sin comunicar visualmente que pertenecen a una misma operación.

## Current State

### Write path (Postgres triggers)

`audit_trigger_fn()` (migración `20260424123854_audit_insert_coverage_completion`) emite **una fila de `audit_logs` por cada cambio atómico de tabla**:

- 1 trigger sobre `journal_entries` (cabecera) — emite UPDATE/STATUS_CHANGE/DELETE/CREATE.
- 1 trigger sobre `journal_lines` (detalle) — emite por cada línea afectada.

**Hallazgo crítico** (`features/accounting/journal.service.ts:307-424` + repository): cuando se actualiza un asiento, el repo ejecuta `journalEntry.update + journalLine.deleteMany + journalLine.createMany`. **Las líneas NO se hacen UPDATE — se borran y recrean con IDs nuevos**. Cada edición genera N filas DELETE + M filas CREATE en `audit_logs`, no UPDATEs.

Implicación: las líneas no tienen identidad estable entre versiones. La unidad de auditoría útil es el voucher entero, no la línea individual.

### Read path (UI actual)

- Schema: `AuditLog` tiene `correlationId String?` indexado, pero solo `monthly-close.service.ts` lo pasa. Resto de services lo omiten.
- `features/audit/audit.service.ts:81-105 → groupByVoucher()` ya agrupa por `${parentVoucherType}:${parentVoucherId}` resolviendo padre vía CASE sobre JSONB FK (`audit.repository.ts:56-101`).
- API `/audit` retorna `{ groups: AuditGroup[], nextCursor }` — el contrato es agrupado.
- `components/audit/audit-event-list.tsx:186-241` muestra hasta 3 eventos colapsados con expansión, pero **trata cada evento atómico como ítem visual de igual peso**, perdiendo la noción de "operación".

### Specs OpenSpec existentes

- `openspec/specs/audit-module/spec.md` — REQ-AUDIT.1..10, define el read path. **Es la capability que se modifica**.
- `openspec/specs/audit-log/spec.md` — write path (triggers, correlationId). **No se modifica**.
- Open follow-up declarado en spec: "Filtro por correlationId en UI" (audit-module spec.md línea 430).

### Tests

Cobertura en `features/audit/__tests__/`: classifier, repository, service, validation, tenant-isolation, feature-boundaries. **No hay tests RTL** para `components/audit/audit-event-list.tsx`.

## Approaches Evaluated

### Opción 1 — Card de Operación (LOW effort) — refactor del listado en cliente

Refactor de `audit-event-list.tsx` para que cada `AuditGroup` se renderice como **una sola card de operación** (no como N filas atómicas).

### Opción 2 — UX + correlationId end-to-end (MEDIUM effort)

Opción 1 + propagar `correlationId` desde 5+ services (journal/sale/purchase/payment/dispatch). `groupByVoucher` prioriza `correlationId` → `parentVoucherType:parentVoucherId` (fallback). Cierra follow-up del spec.

### Opción 3 — UX + correlationId + diff agregado a nivel operación (HIGH effort)

Opción 2 + resumen "Cabecera: X campos modificados. Líneas: 5 reemplazadas, 3 cuentas distintas".

### Opción 4 — Colapsar en schema/triggers (DESCARTADA)

Una sola fila por operación a nivel DB. Rompe REQ-AUDIT.2 (historial atómico por entidad).

### Opción 5 — In-place diff overlay sobre detail view (DESCARTADA)

Renderizar el comprobante en su vista habitual con celdas anotadas `después / ~~antes~~`. **Descartada por el delete+recreate de líneas**: requiere matching heurístico (por accountId/orden/monto) entre líneas viejas y nuevas; en contabilidad las heurísticas son problemáticas (inventan cambios o pierden cambios reales).

## Recommendation

**Opción 1 ajustada — Card de Operación con resumen agregado para líneas, diff viewer reusado para cabecera**.

Aprovecha la realidad técnica: las líneas son volátiles, la cabecera sí tiene historia confiable (UPDATE genuino).

**Render por grupo**:

```
┌─ Modificación de Asiento #123 ─────────────────────┐
│  Usuario: Juan Pérez · 2026-04-26 14:32            │
│  Origen: Manual · Estado: Borrador → Contabilizado │
│                                                    │
│  Cambios:                                          │
│  • Cabecera: descripción modificada (ver detalle)  │
│  • Líneas: 5 reemplazadas (3 cuentas distintas)    │
│                                                    │
│  [Ver versión actual del asiento →]                │
└────────────────────────────────────────────────────┘
```

- **Header de la card**: tipo de operación inferido + voucher number + usuario + timestamp + clasificación directa/indirecta + (si aplica) transición de status agregada.
- **Cuerpo**:
  - Cabecera: lista de campos modificados → reusa `<AuditDiffViewer>` actual (oldValues/newValues confiables porque la cabecera SÍ es UPDATE).
  - Líneas: contador agregado de CREATE/DELETE/UPDATE. NO listar eventos atómicos individualmente.
- **CTA**: link a `/{orgSlug}/accounting/journal/{entryId}` (vista actual del asiento, sin overlay).

## Affected Areas

| Path | Impact |
|------|--------|
| `components/audit/audit-event-list.tsx` | Modified — render del grupo como card de operación |
| `features/audit/audit.service.ts:81-105` | Modified — opcional precomputar resumen agregado server-side |
| `features/audit/audit.types.ts` | Modified — agregar tipo `AuditGroupSummary` o similar |
| `components/audit/__tests__/audit-event-list.test.tsx` | New — tests RTL del nuevo render |
| `openspec/specs/audit-module/spec.md` | Modified — delta sobre REQ-AUDIT.1 (formaliza render como operation card) |

## Out of Scope

- Cambios en triggers, write path, schema, o RBAC.
- Propagación de `correlationId` (Opción 2) — diferido. Se considerará si aparecen casos cross-voucher reales.
- Diff agregado server-side por línea (Opción 3) — diferido.
- Cobertura de operation card para sales/purchases/payments/dispatches — el patrón se establece para journal_entries primero; otros vouchers pueden adoptarlo después si valida bien.
- Inline diff sobre detail view (Opción 5) — descartado por el delete+recreate de líneas.

## Risks

- **R1**: Heurística de "header vs detail" debe ser explícita. Centralizar en helper testable usando `entityType ∈ {journal_entries, sales, purchases, payments, dispatches}` vs detail entities.
- **R2**: Eventos huérfanos sin `parentVoucherId` (ej. `fiscal_periods`) — validar comportamiento actual de `groupByVoucher` antes del refactor.
- **R3**: No hay tests RTL de `audit-event-list`. El refactor obliga a agregarlos como parte del change para evitar regresión silenciosa.

## Ready for Proposal

**Sí**. Capabilities: `audit-module` modificada (delta sobre REQ-AUDIT.1). Sin nuevas capabilities. Sin cambios al spec `audit-log`.
