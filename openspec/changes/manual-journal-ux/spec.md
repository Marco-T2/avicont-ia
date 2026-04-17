# Spec: manual-journal-ux

## Change: `manual-journal-ux`

## Overview

Expone a nivel de UX la distinción entre asientos manuales y auto-generados en el Libro Diario: badge de origen, filtro Manual/Auto, desbloqueo de edición POSTED manual, fix de fecha con drift TZ, y un guard API que impide anular directamente un asiento auto-generado (protegiendo la integridad Sale/Purchase↔JE).

## Domains — 5 dominios, 9 REQs, 22 escenarios en total

---

## Domain: journal-entry-edit-page

### REQ-A.1 — POSTED manuales navegan a /edit; POSTED automáticos son bloqueados; período OPEN requerido

El guard de ruta en `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx` DEBE aceptar entradas con `status=POSTED` **y** `sourceType=null` (manual) **y** período en estado `OPEN`. DEBE rechazar entradas con `sourceType` en `{"sale", "purchase", "dispatch", "payment"}` (auto-generadas) redirigiendo al detalle.

**Regla de período**: cualquier asiento (DRAFT o POSTED manual) cuyo período esté `CLOSED` es inmutable — el `/edit` devuelve 404 (notFound). Esta es la misma regla que se aplica a ventas y compras.

Condición completa de editabilidad:
```ts
const period = periods.find((p) => p.id === entry.periodId);
const isEditable =
  (entry.status === "DRAFT" || (entry.status === "POSTED" && entry.sourceType === null))
  && period?.status === "OPEN";

if (!isEditable) {
  // period closed or auto-entry → redirect; VOIDED → redirect
  // if period not found → notFound()
}
```

**Escenarios:**

- **S-A1.1**: Entrada DRAFT + `sourceType=null` + período OPEN → `/edit` renderiza el formulario de edición.
- **S-A1.2**: Entrada POSTED + `sourceType=null` (manual) + período OPEN → `/edit` renderiza el formulario de edición.
- **S-A1.3**: Entrada POSTED + `sourceType="sale"` (auto) → redirige al detalle (sin importar período).
- **S-A1.4**: Entrada POSTED + `sourceType="purchase"` (auto) → redirige al detalle.
- **S-A1.5**: Entrada VOIDED + `sourceType=null` → redirige al detalle (no se edita VOIDED).
- **S-A1.6** *(PR7)*: Entrada DRAFT + `sourceType=null` + período CLOSED → notFound (immutable).
- **S-A1.7** *(PR7)*: Entrada POSTED + `sourceType=null` (manual) + período CLOSED → notFound (immutable).

**Notas de implementación:**
- El test es un page-level unit test. Se mockean `requireAuth`, `requireOrgAccess`, `journalService.getById`, y se verifica si se llama a `redirect()` / `notFound()` o si se renderiza `JournalEntryForm`.
- Para S-A1.2 el formulario recibe el entry serializado — el test debe incluir el prop `editEntry`.

### REQ-A.2 — Botón "Editar" en detalle sigue la regla de período + origen *(PR7)*

El botón "Editar" en `components/accounting/journal-entry-detail.tsx` DEBE mostrarse únicamente cuando:
- `(status === "DRAFT" || (status === "POSTED" && sourceType === null))` **Y**
- `periodStatus === "OPEN"`

Para esto el componente DEBE recibir un prop `periodStatus: string` desde la página padre.

| Status | Origen | Estado período | Botón Editar |
|--------|--------|----------------|--------------|
| DRAFT | manual | OPEN | visible |
| POSTED | manual | OPEN | visible |
| POSTED | auto (sale/etc.) | OPEN | oculto |
| DRAFT | manual | CLOSED | oculto |
| POSTED | manual | CLOSED | oculto |
| VOIDED | any | any | oculto |

**Escenarios:**

- **S-A2.1**: DRAFT + `sourceType=null` + `periodStatus="OPEN"` → botón "Editar" renderizado con link a `/edit`.
- **S-A2.2**: POSTED + `sourceType=null` + `periodStatus="OPEN"` → botón "Editar" renderizado.
- **S-A2.3**: POSTED + `sourceType="sale"` + `periodStatus="OPEN"` → botón "Editar" NO renderizado.
- **S-A2.4**: DRAFT + `sourceType=null` + `periodStatus="CLOSED"` → botón "Editar" NO renderizado.
- **S-A2.5**: POSTED + `sourceType=null` + `periodStatus="CLOSED"` → botón "Editar" NO renderizado.
- **S-A2.6**: VOIDED + `sourceType=null` + `periodStatus="OPEN"` → botón "Editar" NO renderizado.

**Notas de implementación:**
- El test es un page-level unit test. Se mockean `requireAuth`, `requireOrgAccess`, `journalService.getById`, y se verifica si se llama a `redirect()` o si se renderiza `JournalEntryForm`.
- Para S-A1.2 el formulario recibe el entry serializado — el test debe incluir el prop `editEntry`.

---

## Domain: journal-entry-origin-badge

### REQ-B.1 — La lista muestra un badge de origen por fila

`journal-entry-list.tsx` DEBE renderizar en cada fila un badge con el label derivado de `sourceType` según el mapeo canónico (REQ-B.3). El badge DEBE estar presente incluso si no hay filtro de origen activo.

**Escenarios:**

- **S-B1.1**: Entrada con `sourceType=null` → badge "Manual" visible en la fila.
- **S-B1.2**: Entrada con `sourceType="sale"` → badge "Generado por Venta" visible en la fila.
- **S-B1.3**: Entrada con `sourceType="purchase"` → badge "Generado por Compra" visible en la fila.
- **S-B1.4**: Entrada con `sourceType="dispatch"` → badge "Generado por Despacho" visible en la fila.
- **S-B1.5**: Entrada con `sourceType="payment"` → badge "Generado por Pago" visible en la fila.

### REQ-B.2 — El detalle muestra badge de origen

`journal-entry-detail.tsx` DEBE renderizar un badge de origen en el bloque de metadatos del encabezado, con el mismo label que en la lista (REQ-B.3).

**Escenarios:**

- **S-B2.1**: Detalle con `sourceType=null` → badge "Manual" visible en la sección de metadatos.
- **S-B2.2**: Detalle con `sourceType="sale"` → badge "Generado por Venta" visible.

### REQ-B.3 — El mapeo de labels es canónico y centralizado

El helper `sourceTypeLabel(sourceType: string | null): string` DEBE residir en `features/accounting/journal.ui.ts` (archivo nuevo) y producir exactamente:

| `sourceType` | Label |
|---|---|
| `null` | `"Manual"` |
| `"sale"` | `"Generado por Venta"` |
| `"purchase"` | `"Generado por Compra"` |
| `"dispatch"` | `"Generado por Despacho"` |
| `"payment"` | `"Generado por Pago"` |
| cualquier otro string | `"Origen desconocido"` |

**Escenarios:**

- **S-B3.1**: `sourceTypeLabel(null)` → `"Manual"`.
- **S-B3.2**: `sourceTypeLabel("sale")` → `"Generado por Venta"`.
- **S-B3.3**: `sourceTypeLabel("purchase")` → `"Generado por Compra"`.
- **S-B3.4**: `sourceTypeLabel("dispatch")` → `"Generado por Despacho"`.
- **S-B3.5**: `sourceTypeLabel("payment")` → `"Generado por Pago"`.
- **S-B3.6**: `sourceTypeLabel("unknown_future_type")` → `"Origen desconocido"`.

---

## Domain: journal-entry-origin-filter

### REQ-C.1 — La lista soporta filtro Manual/Auto

`journal-entry-list.tsx` DEBE mostrar un control "Origen" (Select) con opciones:
- `"all"` → "Todos los orígenes" (sin filtro, omite el parámetro de URL)
- `"manual"` → "Manual" → query con `sourceType IS NULL`
- `"auto"` → "Automático" → query con `sourceType IS NOT NULL`

El filtro DEBE componerse con los filtros existentes (periodId, voucherTypeId, status) sin borrarlos. El valor activo DEBE reflejarse en la URL como `?origin=manual` o `?origin=auto`.

El `JournalFilters` de `journal.types.ts` DEBE extenderse con `origin?: "manual" | "auto"`. El repositorio DEBE traducir `origin` a la condición SQL correspondiente.

**Escenarios:**

- **S-C1.1**: Filtro "Manual" seleccionado → URL contiene `origin=manual`, solo se muestran entradas con `sourceType=null`.
- **S-C1.2**: Filtro "Automático" seleccionado → URL contiene `origin=auto`, solo se muestran entradas con `sourceType IS NOT NULL`.
- **S-C1.3**: Filtro "Todos los orígenes" seleccionado → URL no contiene parámetro `origin`, se muestran todas las entradas.
- **S-C1.4**: Filtro `origin=manual` combinado con `periodId` activo → solo entradas manuales del período seleccionado.
- **S-C1.5**: Control "Origen" muestra el valor activo al cargar la página con `?origin=auto` en la URL.

---

## Domain: journal-entry-display-date

### REQ-D.1 — La lista renderiza fechas con `formatDateBO`

`journal-entry-list.tsx` DEBE reemplazar la función local `formatDate` (que usa `new Date(x).toLocaleDateString("es-BO", ...)`) por `formatDateBO` importada de `@/lib/date-utils`.

### REQ-D.2 — El detalle renderiza fechas con `formatDateBO`

`journal-entry-detail.tsx` DEBE reemplazar la función local `formatDate` (que usa `new Date(x).toLocaleDateString("es-BO", ...)`) por `formatDateBO` importada de `@/lib/date-utils`.

**Escenarios compartidos (aplican a ambos REQs):**

- **S-D.1**: Entrada con `date = "2026-04-17T00:00:00.000Z"` (UTC-midnight, legacy row) → la fecha renderizada ES `"17/04/2026"`, NO `"16/04/2026"`.

  Instrucción de test:
  ```ts
  vi.useFakeTimers();
  vi.setSystemTime("2026-04-18T01:00:00.000Z"); // 21:00 hora Bolivia (UTC-4)
  // render con date = "2026-04-17T00:00:00.000Z"
  expect(screen.getByText("17/04/2026")).toBeInTheDocument();
  vi.useRealTimers();
  ```

- **S-D.2**: Entrada con `date = "2026-04-17T12:00:00.000Z"` (UTC-noon) → la fecha renderizada ES `"17/04/2026"`.
- **S-D.3**: Entrada con `date = null` o `date = undefined` → la fecha renderizada ES `""` (sin crash).

---

## Domain: journal-entry-void-guard

### REQ-E.1 — `transitionStatus` rechaza el void directo de asientos auto-generados vía API pública

Cuando `entry.sourceType !== null` y `targetStatus === "VOIDED"`, `JournalService.transitionStatus` DEBE lanzar `ValidationError` con código `AUTO_ENTRY_VOID_FORBIDDEN`. La constante DEBE exportarse desde `features/shared/errors.ts`.

El mensaje de error DEBE indicar el documento origen que debe anularse primero (ej: `"Este asiento fue generado automáticamente. Para anularlo, anulá el documento de origen (Venta, Compra, Despacho o Pago)"`).

La ruta `PATCH /api/organizations/[orgSlug]/journal/[entryId]/status` DEBE devolver HTTP 422 con el código `AUTO_ENTRY_VOID_FORBIDDEN` cuando el guard se activa.

### REQ-E.2 — Las cascadas internas siguen funcionando sin rechazo

Los métodos de servicio que hacen cascade de void al JE desde el documento origen (`SaleService`, `PurchaseService`, `DispatchService`, `PaymentService`, u otros) DEBEN poder anular el JE sin activar el guard de REQ-E.1.

El mecanismo exacto (parámetro `allowAutoVoid`, método interno separado, u otro) lo decide la fase de design. El spec exige únicamente que la propiedad se cumpla: un cascade interno legítimo no produce `AUTO_ENTRY_VOID_FORBIDDEN`.

**Escenarios:**

- **S-E1.1**: `transitionStatus(orgId, autoEntryId, "VOIDED", userId)` donde `entry.sourceType="sale"` → lanza `ValidationError` con `code=AUTO_ENTRY_VOID_FORBIDDEN`.
- **S-E1.2**: `transitionStatus(orgId, autoEntryId, "VOIDED", userId)` donde `entry.sourceType="purchase"` → misma respuesta que S-E1.1.
- **S-E1.3**: `transitionStatus(orgId, manualEntryId, "VOIDED", userId)` donde `entry.sourceType=null` → void ejecutado sin error (continúa con lógica existente).
- **S-E1.4**: `transitionStatus(orgId, autoEntryId, "POSTED", userId)` donde `entry.sourceType="sale"` → NO lanza `AUTO_ENTRY_VOID_FORBIDDEN` (el guard solo aplica a VOIDED).
- **S-E2.1**: Cascade interno (`SaleService.void` → `JournalService.[método interno]`) con `entry.sourceType="sale"` → JE queda VOIDED sin error.

---

## Files Modified (estimated)

- `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx` — relajar guard de status + período gate (PR7)
- `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx` — pasar `periodStatus` al componente detalle (PR7)
- `components/accounting/journal-entry-detail.tsx` — badge Origen, reemplazar `formatDate` por `formatDateBO`, botón Editar con period-gate (PR7)
- `components/accounting/journal-entry-list.tsx` — badge Origen, filtro Origen, reemplazar `formatDate` por `formatDateBO`
- `features/accounting/journal.types.ts` — agregar `origin?: "manual" | "auto"` a `JournalFilters`
- `features/accounting/journal.service.ts` — guard en `transitionStatus`
- `features/accounting/journal.repository.ts` — traducir `origin` a condición SQL
- `features/accounting/journal.ui.ts` — nuevo archivo con helper `sourceTypeLabel`
- `features/shared/errors.ts` — nueva constante `AUTO_ENTRY_VOID_FORBIDDEN`
- Test files correspondientes (por dominio, ver lista en per-domain specs)

## Success Criteria

- Cero regresiones en tests de journal existentes.
- Todos los 5 dominios cubiertos por al menos un ciclo RED→GREEN por REQ.
- Flujo manual verificable: crear asiento CT → ver en lista con badge "Manual" → abrir detalle con badge "Manual" → abrir `/edit` y guardar → saldos recalculados atómicamente.
- `POST /api/organizations/[orgSlug]/journal/[entryId]/status` con body `{targetStatus: "VOIDED"}` sobre un JE auto-generado retorna HTTP 422 con código `AUTO_ENTRY_VOID_FORBIDDEN`.
- Cascade interno `SaleService.void → JE.void` sigue funcionando.
