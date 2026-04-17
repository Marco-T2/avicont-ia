# Domain Spec: journal-entry-void-guard

## Change: `manual-journal-ux`

## Context

Hoy `JournalService.transitionStatus` no verifica `sourceType` antes de ejecutar POSTED→VOIDED. Esto permite que un usuario anule directamente desde el Libro Diario un asiento auto-generado (sourceType="sale", "purchase", "dispatch", "payment"), dejando el documento origen (Venta, Compra, Despacho, Pago) en estado POSTED sin asiento activo — un estado de datos inconsistente y sin forma de detectar.

El guard debe vivir en el camino público (API) y NO en el camino interno de cascadas (SaleService, PurchaseService, etc.), que ya hacen lo correcto invocando la anulación en el orden correcto.

---

## REQ-E.1 — `transitionStatus` rechaza el void directo de asientos auto-generados vía API pública

### Nueva constante en `features/shared/errors.ts`

```ts
export const AUTO_ENTRY_VOID_FORBIDDEN = "AUTO_ENTRY_VOID_FORBIDDEN";
```

### Guard en `JournalService.transitionStatus`

Agregar ANTES de la lógica de transición existente, en el bloque que verifica el targetStatus:

```ts
if (targetStatus === "VOIDED" && entry.sourceType !== null) {
  throw new ValidationError(
    "Este asiento fue generado automáticamente. Para anularlo, anulá el documento de origen (Venta, Compra, Despacho o Pago).",
    AUTO_ENTRY_VOID_FORBIDDEN,
  );
}
```

### Propagación HTTP

La ruta `app/api/organizations/[orgSlug]/journal/[entryId]/status/route.ts` ya maneja `ValidationError` → HTTP 422. Verificar que el campo `code` del cuerpo de la respuesta incluya el error code (patrón existente en otros handlers).

---

## REQ-E.2 — Las cascadas internas siguen funcionando sin rechazo

Los servicios `SaleService`, `PurchaseService`, `DispatchService`, `PaymentService` realizan cascadas de anulación sobre sus JE. Estas cascadas DEBEN poder ejecutarse sin activar el guard de REQ-E.1.

### Mecanismo (a decidir en design — dos opciones válidas)

**Opción A — parámetro explícito:**
```ts
async transitionStatus(
  organizationId: string,
  id: string,
  targetStatus: JournalEntryStatus,
  userId: string,
  role?: string,
  justification?: string,
  options?: { allowAutoVoid?: boolean },  // NUEVO
): Promise<JournalEntryWithLines>
```
El guard solo aplica si `options?.allowAutoVoid !== true`.

**Opción B — método interno separado:**
```ts
// Público (API boundary)
async transitionStatus(...): Promise<JournalEntryWithLines>

// Interno (cascadas)
async transitionStatusInternal(...): Promise<JournalEntryWithLines> // sin guard
```

La fase de design elige. El spec exige que la propiedad se cumpla: el cascade interno no produce `AUTO_ENTRY_VOID_FORBIDDEN`.

---

## Escenarios

### S-E1.1 — Void directo de JE con sourceType="sale" → rechazado

```ts
// entry.sourceType = "sale", entry.status = "POSTED"
await expect(
  service.transitionStatus(orgId, entryId, "VOIDED", userId)
).rejects.toMatchObject({ code: "AUTO_ENTRY_VOID_FORBIDDEN" });
```

### S-E1.2 — Void directo de JE con sourceType="purchase" → rechazado

Mismo resultado que S-E1.1 con `sourceType = "purchase"`.

### S-E1.3 — Void de JE manual (sourceType=null) → permitido

```ts
// entry.sourceType = null, entry.status = "POSTED"
await expect(
  service.transitionStatus(orgId, entryId, "VOIDED", userId)
).resolves.toMatchObject({ status: "VOIDED" });
```

### S-E1.4 — Transición POSTED→LOCKED de JE auto → NO activa el guard

```ts
// entry.sourceType = "sale", targetStatus = "LOCKED"
// El guard solo aplica cuando targetStatus === "VOIDED"
await expect(
  service.transitionStatus(orgId, entryId, "LOCKED", userId)
).resolves.toMatchObject({ status: "LOCKED" });
```

### S-E2.1 — Cascade interno SaleService.void → JE queda VOIDED sin error

```ts
// SaleService invoca la ruta interna (opción A con allowAutoVoid:true, u opción B con método interno)
// Resultado esperado: el JE con sourceType="sale" queda en status="VOIDED"
// sin lanzar AUTO_ENTRY_VOID_FORBIDDEN
```

---

## Test Files

- `features/accounting/__tests__/journal.service.void-guard.test.ts` — unit tests para S-E1.x
  - Mockear `repo.findById` para retornar el entry con el sourceType adecuado
  - Verificar que `ValidationError` tiene `code = AUTO_ENTRY_VOID_FORBIDDEN`
- `features/accounting/__tests__/journal.service.cascade-void.test.ts` — test para S-E2.1
  - Verifica que el mecanismo de cascade (sea opción A u opción B) no lanza el guard
