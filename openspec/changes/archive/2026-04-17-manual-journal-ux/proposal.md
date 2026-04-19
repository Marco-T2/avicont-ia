# Proposal: Manual journal entry UX + guard on auto-entry voids

**Change**: `manual-journal-ux`
**Date**: 2026-04-17
**Status**: Proposed
**Depends on exploration**: `sdd/explore/manual-journal-entries` (engram) / `openspec/explore/manual-journal-entries.md`

---

## Intent

El contador necesita operar el Libro Diario con la misma confianza con que usa Ventas o Compras: poder distinguir de un vistazo qué asientos creó él mismo (traspasos diarios, ajustes, apertura, cierre) de los que generó el sistema automáticamente, editar sus asientos POSTED cuando detecta un error, y filtrar rápido "solo los míos" vs "solo los del sistema". Hoy la capa de datos y servicio ya soporta todo eso correctamente, pero la UI no lo expone y la página de edición no lo permite.

Traducción técnica: hay un **gap exclusivamente de UX + una relajación de guard de ruta + un guard nuevo defensivo**. El modelo `JournalEntry` ya tiene `sourceType`/`sourceId` (ambos `String?`, `null` = manual). `JournalService.updateEntry` ya resuelve correctamente el caso POSTED manual vía `updatePostedManualEntryTx` (revierte saldos y reaplica atómicamente). `AutoEntryGenerator` siempre rellena `sourceType` en entries automáticos. Solo falta: mostrar el origen, filtrar por origen, desbloquear la página `/edit` para POSTED manuales, corregir un format-date heredado, y cerrar un riesgo pre-existente: hoy un usuario puede anular directamente un asiento auto-generado desde el Libro Diario y dejar la Venta/Compra/Despacho/Pago POSTED sin asiento activo.

---

## Scope

### In-scope

1. **Desbloquear edición de asientos POSTED manuales** — auditar `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx` y relajar el guard de `status === "DRAFT"` a `status === "DRAFT" || (status === "POSTED" && sourceType === null)`. El servicio ya hace lo correcto via `updatePostedManualEntryTx`; solo es una restricción de ruta obsoleta.

2. **Badge de origen en lista y detalle** — agregar una columna/celda "Origen" en `journal-entry-list.tsx` y un badge en `journal-entry-detail.tsx`. Mapeo derivado de `sourceType`:
   - `null` → `"Manual"` (variant neutro)
   - `"sale"` → `"Generado por Venta"`
   - `"purchase"` → `"Generado por Compra"`
   - `"dispatch"` → `"Generado por Despacho"`
   - `"payment"` → `"Generado por Pago"`

3. **Filtro Manual/Auto en la lista** — agregar un control de filtro (toggle o select) que traduzca a `sourceType IS NULL` vs `sourceType IS NOT NULL` a nivel query. Se compone con los filtros existentes (period, voucherType, status).

4. **Fix de display-date en journal-entry-list y journal-entry-detail** — cerrar el item diferido de la REVISIÓN D.5 de `fix-comprobante-date-tz`. Migrar `toLocaleDateString(...)` → `formatDateBO()` desde `@/lib/date-utils`. Actualizar los tests que afirman formatos de fecha en esos dos componentes.

5. **Guard en `transitionStatus` contra anular asientos auto-generados directamente** — cuando `entry.sourceType !== null` y la transición solicitada es `POSTED → VOIDED`, rechazar con un error tipado (`AUTO_ENTRY_VOID_FORBIDDEN` o similar) que guíe al usuario a anular el documento origen (Sale/Purchase/Dispatch/Payment), el cual en cascada anula su JE. El guard debe ser **additive y compatible con el camino interno**: las cascadas legítimas (cuando `Sale.void()` llama internamente al void de su JE) deben seguir funcionando.

### Out-of-scope (deliberate)

- **Plantillas / duplicar asiento** (Approach 2 de la exploración). Útil pero no crítico; se aborda en un change posterior (`journal-entry-templates`).
- **Workflows guiados de apertura / cierre de período**. Convención contable boliviana que merece su propio change cuando haya demanda real.
- **Cambios de schema**. `sourceType`/`sourceId` ya son nullable strings — suficiente. No introducir enum discriminador ahora.
- **Cambios en `JournalService.updateEntry`**. El servicio ya resuelve POSTED manual correctamente.
- **Reactivación de entries VOIDED**. Sigue siendo terminal; no se toca.
- **Campos nuevos en `JournalEntry`** (narración, adjuntos, etc.). Fuera de alcance.

---

## Why

### Lo que se rompe o incomoda hoy

- **Ceguera visual**: en el Libro Diario, un traspaso diario (CT) creado por el contador luce idéntico a un asiento CI generado por un cobro. No hay forma visual de saber quién lo creó ni por qué.
- **Edición POSTED manual bloqueada en la ruta**: el servicio soporta editar asientos POSTED manuales, pero la página `/edit` probablemente rechaza cualquier status != DRAFT. El contador se topa con un callejón sin salida: el sistema le dice que no puede editar, cuando en realidad sí puede — el bloqueo es puramente de UI.
- **Riesgo latente de datos**: hoy nada impide que un usuario anule directamente un JE auto-generado desde el Libro Diario. Eso deja la Venta/Compra en POSTED con su JE en VOIDED — estado inconsistente. Es un bug dormido.
- **Fecha con desfase de TZ en lista y detalle**: `toLocaleDateString` aplica conversión UTC→local, causando asientos del 17/04 mostrados como 16/04. Ya se arregló en otros puntos (PR1-3 de `fix-comprobante-date-tz`); falta cerrar este caso.
- **Filtro débil**: el contador que quiere revisar "solo los ajustes que hice yo este mes" no tiene filtro directo — tiene que memorizar qué voucherTypes usa para manuales.

### Lo que mejora después

- El contador identifica al instante qué es suyo y qué es del sistema.
- Corregir un error en un traspaso diario ya posted toma 3 clics, sin workarounds.
- Anular un asiento auto-generado se vuelve imposible por el camino equivocado — el sistema lo redirige a anular el documento origen, manteniendo la integridad Sale↔JE 1:1.
- Las fechas en la lista y detalle del Libro Diario coinciden con las fechas reales de los asientos (no hay drift por TZ).
- El filtro Manual/Auto se compone naturalmente con period y voucherType para auditorías rápidas.

---

## Acceptance criteria

Estos criterios mapean a REQs en la fase de spec:

- **AC1**: Un asiento POSTED con `sourceType === null` puede abrirse en `/edit`, editarse y guardarse; los saldos de cuentas se recalculan atómicamente (vía `updatePostedManualEntryTx`).
- **AC2**: Un asiento POSTED con `sourceType !== null` **no** puede abrirse en `/edit`; la página muestra un mensaje claro de que debe editarse desde el documento origen.
- **AC3**: La lista `/accounting/journal` muestra una columna "Origen" con el badge apropiado para cada fila, derivado de `sourceType`.
- **AC4**: El detalle `/accounting/journal/[id]` muestra un badge de origen con el mismo mapeo que la lista.
- **AC5**: La lista permite filtrar por origen (Manual / Automático / Todos); el filtro se compone con period, voucherType y status existentes.
- **AC6**: Las fechas en la lista y detalle se renderizan con `formatDateBO()` y coinciden con la fecha stored en DB sin drift por TZ.
- **AC7**: Intentar transicionar un JE con `sourceType !== null` de POSTED a VOIDED vía API falla con un error tipado (`AUTO_ENTRY_VOID_FORBIDDEN` o nombre equivalente acordado en spec). El mensaje guía a anular el documento origen.
- **AC8**: Las cascadas internas legítimas — `SaleService.void()`, `PurchaseService.void()`, `DispatchService.void()`, `PaymentService.void()` invocando el void interno de su JE — **siguen funcionando sin rechazo**.

---

## Risks

- **Riesgo**: el guard de item #5, si se escribe como "rechazar siempre que sourceType !== null en POSTED→VOIDED", rompe las cascadas internas de Sale/Purchase/Dispatch/Payment.
  **Mitigación**: el guard se aplica en `JournalService.transitionStatus` (camino público API), y las cascadas invocan una ruta interna distinta (por ejemplo `transitionStatusInternal` sin guard, o el mismo `transitionStatus` con un parámetro explícito `allowAutoVoid: true` que solo el código del servicio origen setea). La fase de design decide la forma exacta — ambas son válidas; el spec exige solo que las cascadas no rompan (AC8).

- **Riesgo**: editar un asiento POSTED manual con `updatePostedManualEntryTx` puede fallar mid-transaction (p. ej. error de DB después de `applyVoid` antes de `applyPost`).
  **Mitigación**: Prisma `$transaction` garantiza rollback atómico. Agregar un integration test que simule fallo intermedio y verifique que el balance queda intacto.

- **Riesgo**: el filtro Manual/Auto a nivel SQL (`sourceType IS NULL`) aplicado sobre queries paginadas puede requerir un índice; hoy no hay índice en `sourceType`.
  **Mitigación**: medir volumen. Para volúmenes esperados (< 100k JE por org), un scan con los otros filtros (period + orgId) es suficiente. Si en el futuro se vuelve hotspot, agregar índice compuesto en un change separado. **No se agrega índice en este change**.

- **Riesgo**: copiar el patrón de `formatDateBO` en list/detail puede romper tests snapshot o assertions de fecha existentes.
  **Mitigación**: actualizar esos tests como parte del mismo change (mirror exacto de PR4 de `fix-comprobante-date-tz`).

- **Riesgo**: el mapa de `sourceType` a label está duplicado si se escribe inline en list y detail.
  **Mitigación**: extraer a un helper `sourceTypeLabel(sourceType)` en `features/accounting/journal.ui.ts` o un archivo de i18n de UI accounting. Fase de design lo decide.

---

## Dependencies

- **Related prior changes**:
  - `fix-comprobante-date-tz` (REVISIÓN D.5) — el item #4 de este change cierra explícitamente el deferred item "journal-entry-list + detail date formatting".
  - `iva-journal-integration` — estableció el patrón `sourceType="sale"` / `sourceType="purchase"` como fuente de verdad en auto-entries.
  - `sale-edit-cascade` (commit `64ed8c3`) — patrón de cascade donde Sale es source-of-truth y su JE derivado se reaplica; refuerza la regla de que editar/anular el JE auto directamente es incorrecto.

- **Code paths tocados**:
  - `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx` — guard de status relajado
  - `components/accounting/journal-entry-list.tsx` — columna Origen + filtro + `formatDateBO`
  - `components/accounting/journal-entry-detail.tsx` — badge Origen + `formatDateBO`
  - `features/accounting/journal.service.ts` — guard en `transitionStatus` (item #5)
  - `features/shared/errors.ts` — nuevo error tipado `AUTO_ENTRY_VOID_FORBIDDEN`
  - Tests correspondientes en `features/accounting/journal.service.test.ts` y `components/accounting/__tests__/`

- **No toca**:
  - `prisma/schema.prisma` (sin migración)
  - `features/shared/auto-entry-generator.ts` (ya pone sourceType correctamente)
  - `JournalService.updateEntry` ni `updatePostedManualEntryTx` (ya correctos)
