# Proposal: Card de Operación en el listado de Auditoría

## Intent

El listado de `/[orgSlug]/audit` renderiza cada fila atómica de `audit_logs` como un ítem visual de igual peso, lo que produce salidas confusas — una sola modificación de Asiento Contable aparece como 3+ filas separadas ("Asientos contables / Línea de asiento / Línea de asiento"). El cambio refactoriza el componente cliente para que cada `AuditGroup` (ya entregado por el backend) se renderice como una sola **card de operación** con cabecera diferenciada y resumen agregado de líneas, comunicando visualmente que pertenecen a una misma operación contable.

## Scope

### In Scope

- Refactor de `components/audit/audit-event-list.tsx` para renderizar cada `AuditGroup` como una card de operación (no como N ítems atómicos).
- Helper de agregación que distingue eventos de **cabecera** (`entityType ∈ {journal_entries, sales, purchases, payments, dispatches}`) vs eventos de **detail** (`entityType ∈ {journal_lines, sale_details, purchase_details}`).
- Resumen agregado de líneas por grupo: contador CREATE/DELETE/UPDATE, sin listar eventos atómicos individuales.
- Reuso de `<AuditDiffViewer>` existente para el diff de cabecera (sólo cabecera tiene UPDATE genuino).
- CTA en cada card hacia el detail del comprobante (`/[orgSlug]/accounting/journal/{entryId}` u homólogo).
- Suite RTL nueva en `components/audit/__tests__/audit-event-list.test.tsx` (cobertura previa inexistente).
- Delta en `openspec/specs/audit-module/spec.md` formalizando el render como operation card sobre REQ-AUDIT.1.

### Out of Scope

- Cambios en triggers, write path, schema o RBAC — la unidad de cambio es UI-only.
- Propagación de `correlationId` desde sale/purchase/payment/dispatch services (Opción 2 de la exploration) — diferida; se considerará si aparecen casos cross-voucher reales.
- Diff agregado server-side por línea (Opción 3) — diferido.
- Inline diff overlay sobre detail view (Opción 5) — descartado por el `delete+recreate` de `journal_lines` en `journal.service.ts:307-424`, que rompe la identidad por línea y obliga a matching heurístico.
- Adopción del patrón en sales/purchases/payments/dispatches — el patrón se establece para `journal_entries` primero; extender después si valida bien.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `audit-module`: delta sobre **REQ-AUDIT.1** (lista paginada por rango de fechas). El requirement actual define agrupación por comprobante y paginación cursor-based; el delta formaliza el contrato de **render** en la UI (operation card por grupo, separación cabecera vs detail, resumen agregado de líneas, CTA al detail). No modifica el contrato HTTP, el classifier, ni el grouping server-side ya cubiertos por REQ-AUDIT.1..10.

## Approach

Adoptar la **Opción 1 ajustada** de la exploration — Card de Operación con resumen agregado para líneas y diff viewer reusado para cabecera. El backend ya entrega `AuditGroup[]` agrupado por `(parentVoucherType, parentVoucherId)` vía `groupByVoucher()` (`features/audit/audit.service.ts:81-105`); el cambio vive en el componente cliente que consume ese contrato. Se centraliza la heurística "header vs detail" en un helper testable basado en el conjunto cerrado de `entityType` ya presente en el spec. La cabecera del grupo conserva el diff por campo (oldValues/newValues son confiables porque la cabecera SÍ se hace UPDATE), y las líneas se reportan con un contador agregado, evitando heurísticas de matching imposibles dado el `delete+recreate` de líneas.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/audit/audit-event-list.tsx` | Modified | Render del grupo como card de operación (header + body resumido + CTA). |
| `features/audit/audit.service.ts` | Modified (optional) | Posible precomputo server-side del resumen agregado (CREATE/DELETE/UPDATE counts); si no, se calcula en cliente. |
| `features/audit/audit.types.ts` | Modified | Nuevo tipo `AuditGroupSummary` con contadores de cabecera/líneas y metadatos del grupo. |
| `components/audit/__tests__/audit-event-list.test.tsx` | New | Suite RTL: render de card, expansión, distinción header vs detail, manejo de eventos huérfanos sin `parentVoucherId`. |
| `openspec/specs/audit-module/spec.md` | Modified | Delta sobre REQ-AUDIT.1 — contrato de render UI (operation card). |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Heurística "header vs detail" inconsistente entre el componente y futuros consumers | Med | Helper centralizado y testable, con `entityType ∈ {journal_entries, sales, purchases, payments, dispatches}` como única fuente de verdad — deriva del classifier ya cerrado en REQ-AUDIT.3. |
| Eventos huérfanos sin `parentVoucherId` (ej. `fiscal_periods` futuras) que no encajan en una operation card | Low | Validar comportamiento actual de `groupByVoucher()` antes del refactor; mantener fallback de render para grupos huérfanos (card minimalista sin CTA). |
| Falta de tests RTL previos en `audit-event-list` — riesgo de regresión silenciosa | Med | La suite RTL se agrega como parte del change, no se difiere. |

## Rollback Plan

El cambio es UI-only sin migraciones de schema, triggers, RBAC ni APIs. El revert se ejecuta con `git revert` del commit del refactor del componente (y del commit del spec delta, si fue separado). La data en `audit_logs`, el contrato HTTP y el grouping server-side permanecen intactos durante todo el ciclo, por lo que el revert no requiere coordinación con base de datos ni con consumers externos.

## Dependencies

- Ninguna a nivel runtime — no requiere cambios de schema, triggers, RBAC ni APIs.
- **Constraint Next.js 16.x**: aplica al design phase y al apply phase. Antes de escribir código del componente cliente, consultar `node_modules/next/dist/docs/` por convenciones vigentes (RSC vs client boundaries, `use client`, fetch caching). El proposal en sí no escribe código.

## Success Criteria

- [ ] Una modificación de Asiento Contable se renderiza como **una sola card** en `/[orgSlug]/audit`, no como 3+ ítems separados.
- [ ] El cuerpo de la card muestra cabecera (vía `AuditDiffViewer`) + resumen agregado de líneas (contador CREATE/DELETE/UPDATE).
- [ ] La card incluye CTA al detail del comprobante.
- [ ] Tests RTL cubren: render del card, expansión, distinción header vs detail, eventos huérfanos sin `parentVoucherId`.
- [ ] Type check (`pnpm exec tsc --noEmit`) limpio.
- [ ] Test suite existente (`pnpm vitest run`) verde.
