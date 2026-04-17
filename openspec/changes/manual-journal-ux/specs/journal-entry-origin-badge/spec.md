# Domain Spec: journal-entry-origin-badge

## Change: `manual-journal-ux`

## Context

Actualmente `journal-entry-list.tsx` y `journal-entry-detail.tsx` no exponen el campo `sourceType` visualmente. El contador no puede distinguir a simple vista un asiento manual de uno auto-generado.

El helper centralizador `sourceTypeLabel` debe vivir en `features/accounting/journal.ui.ts` (archivo nuevo) para evitar duplicación entre list y detail.

---

## REQ-B.1 — La lista muestra un badge de origen por fila

`journal-entry-list.tsx` DEBE importar `sourceTypeLabel` de `@/features/accounting/journal.ui` y renderizar un `<Badge>` en cada fila de la tabla con el label correspondiente al `sourceType` de la entrada.

**Requisito de datos:** el tipo `JournalEntry` local del componente DEBE incluir `sourceType: string | null`.

### Escenarios

- **S-B1.1**: Entrada con `sourceType=null` → `<Badge>Manual</Badge>` presente en la fila.
- **S-B1.2**: Entrada con `sourceType="sale"` → `<Badge>Generado por Venta</Badge>` presente.
- **S-B1.3**: Entrada con `sourceType="purchase"` → `<Badge>Generado por Compra</Badge>` presente.
- **S-B1.4**: Entrada con `sourceType="dispatch"` → `<Badge>Generado por Despacho</Badge>` presente.
- **S-B1.5**: Entrada con `sourceType="payment"` → `<Badge>Generado por Pago</Badge>` presente.

---

## REQ-B.2 — El detalle muestra badge de origen

`journal-entry-detail.tsx` DEBE renderizar un `<Badge>` con el label de origen en el bloque de metadatos del encabezado (junto a estado, fecha, etc.).

### Escenarios

- **S-B2.1**: Detalle con `sourceType=null` → `<Badge>Manual</Badge>` visible en metadatos.
- **S-B2.2**: Detalle con `sourceType="sale"` → `<Badge>Generado por Venta</Badge>` visible.

---

## REQ-B.3 — El mapeo de labels es canónico y centralizado

El helper `sourceTypeLabel(sourceType: string | null): string` DEBE residir en `features/accounting/journal.ui.ts`.

### Tabla de mapeo canónico

| `sourceType`    | Label retornado          |
|-----------------|--------------------------|
| `null`          | `"Manual"`               |
| `"sale"`        | `"Generado por Venta"`   |
| `"purchase"`    | `"Generado por Compra"`  |
| `"dispatch"`    | `"Generado por Despacho"`|
| `"payment"`     | `"Generado por Pago"`    |
| cualquier otro  | `"Generado automáticamente"`   |

### Escenarios

- **S-B3.1**: `sourceTypeLabel(null)` → `"Manual"`.
- **S-B3.2**: `sourceTypeLabel("sale")` → `"Generado por Venta"`.
- **S-B3.3**: `sourceTypeLabel("purchase")` → `"Generado por Compra"`.
- **S-B3.4**: `sourceTypeLabel("dispatch")` → `"Generado por Despacho"`.
- **S-B3.5**: `sourceTypeLabel("payment")` → `"Generado por Pago"`.
- **S-B3.6**: `sourceTypeLabel("unknown_future_type")` → `"Generado automáticamente"`.

---

## Test Files

- `features/accounting/__tests__/journal.ui.test.ts` — unit tests para `sourceTypeLabel` (S-B3.x), sin render
- `components/accounting/__tests__/journal-entry-list.test.tsx` — tests de render para S-B1.x
- `components/accounting/__tests__/journal-entry-detail.test.tsx` — tests de render para S-B2.x
