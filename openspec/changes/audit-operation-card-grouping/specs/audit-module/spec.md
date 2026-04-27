# Delta: audit-module — render UI como operation card

**Change**: `audit-operation-card-grouping`
**Capability afectada**: `audit-module`
**Decisión de modelado**: ADDED — REQ-AUDIT.1 cubre exclusivamente el contrato HTTP (endpoint, params, cursor, response shape). El render UI es un contrato complementario e independiente; no modifica ni extiende ningún scenario existente de A1-S1..A1-S6.

---

## ADDED Requirements

### Requirement: REQ-AUDIT.11 — Render UI del listado como card de operación

El componente cliente `AuditEventList` MUST renderizar cada `AuditGroup` del listado como una sola **card de operación**, nunca como N ítems atómicos de igual peso. Dentro de cada card, los eventos de la cabecera del comprobante (`entityType ∈ {journal_entries, sales, purchases, payments, dispatches}`) MUST distinguirse visualmente de los eventos de detalle (`entityType ∈ {journal_lines, sale_details, purchase_details}`). Los eventos de cabecera con `action = UPDATE` MUST mostrar el diff campo-a-campo vía `<AuditDiffViewer>`. Los eventos de detalle NO se listan individualmente — MUST reportarse como resumen agregado de contadores por acción (CREATE / DELETE / UPDATE). Cada card MUST incluir un CTA navegable al detail del comprobante.

El conjunto de `entityType` de cabecera y de detalle es cerrado y deriva del classifier ya definido en REQ-AUDIT.3. Un helper centralizado (`isHeaderEvent(entityType)`) MUST encapsular esta clasificación para todos los consumers.

Para eventos sin `parentVoucherId` (grupos huérfanos), el sistema SHALL renderizar una card minimalista sin CTA al detail.

#### Scenario: A11-S1 — Modificación de Asiento se renderiza como una sola card

- GIVEN un `AuditGroup` con `parentVoucherType = 'journal_entries'` que contiene 1 evento `journal_entries / UPDATE` y 3 eventos `journal_lines / DELETE` o `CREATE`
- WHEN `AuditEventList` renderiza ese grupo
- THEN el listado muestra exactamente **una** card para ese grupo, no 4 ítems separados
- AND el título de la card identifica el tipo de comprobante (`journal_entries`) y la acción principal

#### Scenario: A11-S2 — Distinción visual entre eventos de cabecera y de detalle

- GIVEN un `AuditGroup` con un evento `sales / UPDATE` (cabecera) y dos eventos `sale_details / CREATE` (detalle)
- WHEN la card renderiza el cuerpo del grupo
- THEN el evento `sales / UPDATE` se presenta en la sección de cabecera (con diff via `AuditDiffViewer`)
- AND los eventos `sale_details` se presentan en la sección de detalle (no como diff individual)
- AND ambas secciones son visualmente distinguibles

#### Scenario: A11-S3 — Resumen agregado de líneas como contador por acción

- GIVEN un `AuditGroup` con 5 eventos `journal_lines`: 2 `DELETE` y 3 `CREATE`
- WHEN la card renderiza la sección de detalle
- THEN muestra un resumen del estilo "2 líneas eliminadas · 3 líneas creadas"
- AND NO muestra una fila o ítem individual por cada uno de los 5 eventos de `journal_lines`

#### Scenario: A11-S4 — CTA al detail del comprobante

- GIVEN un `AuditGroup` con `parentVoucherId = 'je_001'` y `parentVoucherType = 'journal_entries'`
- WHEN la card renderiza
- THEN contiene un enlace o botón navegable hacia el detail del comprobante (ej. `/[orgSlug]/accounting/journal/je_001`)
- AND el CTA es visible sin necesidad de expandir la card

#### Scenario: A11-S5 — Evento huérfano sin parentVoucherId rinde card minimalista

- GIVEN un `AuditGroup` cuyo `parentVoucherId` es `null` o `undefined`
- WHEN `AuditEventList` renderiza el grupo
- THEN muestra una card minimalista con la información básica disponible (`entityType`, `action`, `createdAt`)
- AND la card NO incluye CTA al detail (no hay comprobante identificable)
- AND el componente no lanza error ni excepción en render

---

## Traceability

| Scenario | Acceptance criterion (proposal) |
|----------|----------------------------------|
| A11-S1 | Una modificación de Asiento se renderiza como una sola card |
| A11-S2 | El cuerpo muestra cabecera (AuditDiffViewer) + resumen de líneas |
| A11-S3 | Resumen de líneas es contador CREATE/DELETE/UPDATE, no lista atómica |
| A11-S4 | La card incluye CTA al detail del comprobante |
| A11-S5 | Tests RTL cubren eventos huérfanos sin parentVoucherId |

Cobertura: 5/5 acceptance criteria de render del proposal mapean a ≥1 scenario de REQ-AUDIT.11.
