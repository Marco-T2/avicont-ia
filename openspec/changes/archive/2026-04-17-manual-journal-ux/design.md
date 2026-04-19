# Design: manual-journal-ux

**Change**: `manual-journal-ux`
**Date**: 2026-04-17
**Status**: Final
**Reads**: proposal (`openspec/changes/manual-journal-ux/proposal.md`, engram #671), spec (`openspec/changes/manual-journal-ux/spec.md`), exploration (`openspec/changes/manual-journal-ux/exploration.md`).

---

## Technical Approach

El cambio es aditivo y de bajo riesgo: cinco dominios UX (edit-page guard, badge origen, filtro origen, display-date, void-guard) que comparten el mismo modelo de datos ya existente. No hay migración de schema, no se toca `JournalService.updateEntry` ni `AutoEntryGenerator`. El spec ya fija el mapeo de labels y la condición del guard.

El descubrimiento arquitectónico clave de la fase de design — después de auditar los cascadas internos — es que **ningún servicio origen (Sale / Purchase / Dispatch / Payment) pasa por `JournalService.transitionStatus` para anular su JE derivado**. Todos usan `tx.journalEntry.update({ data: { status: "VOIDED" } })` directo dentro de su propia transacción (ver `sale.service.ts:1141-1144`, `purchase.service.ts:1299-1303`, `dispatch.service.ts:1031-1035`, `payment.service.ts:528-532`). Eso significa que agregar un guard en `transitionStatus` NO rompe cascadas — no hay cascada que entre por ese camino. Este hallazgo simplifica D.1: no necesitamos un método interno nuevo ni un flag, basta con reforzar el punto de entrada público (la API route `PATCH /api/organizations/[orgSlug]/journal/[entryId]/status` es su único caller) y documentar la convención.

El resto son cambios mecánicos: helper puro `sourceTypeLabel()`, badge en dos componentes, filtro Select con traducción a condición Prisma en el repositorio, swap de `toLocaleDateString` → `formatDateBO` (mismo patrón que `fix-comprobante-date-tz` PR4). Cada dominio es independiente y se puede implementar en paralelo.

---

## Decisions

### D.1 — Guard mechanism: **(a) guard único en `transitionStatus`, sin split ni flag**

**Decision:** Agregar el guard directamente en `JournalService.transitionStatus` sin crear un método interno separado ni un parámetro `allowAutoVoid`. El guard se activa cuando `entry.sourceType !== null && targetStatus === "VOIDED"`.

**Rationale:** La fase de proposal asumió que las cascadas (`SaleService.void` → JE void, etc.) pasaban por `transitionStatus`, lo que habría justificado las opciones (a)=split o (b)=flag. Auditoría real del código (ver D.7 abajo): **ningún cascade interno pasa por ese método**. Todos los services origen anulan el JE con `tx.journalEntry.update` directo + `balancesService.applyVoid(tx, ...)` dentro de su propia transacción. El único caller externo de `transitionStatus` es la ruta API `PATCH /journal/[entryId]/status`.

Beneficios vs (a) split:
- No duplicamos la firma pública → menos superficie que mantener.
- No agregamos un "método interno" que en la práctica nadie invoca hoy (riesgo de código muerto).
- Si en el futuro un cascade necesita pasar por el service, se puede extender con flag o método interno sin breaking change.

Beneficios vs (b) flag:
- Un flag `opts.allowAutoVoid` es un vector para abuso (cualquiera puede pasarlo).
- Los callers internos no existen → agregar un flag sin usuario real es YAGNI.

Trade-off aceptado: si mañana se refactoriza `SaleService.void` para que invoque `journalService.transitionStatus` en lugar de `tx.journalEntry.update` directo, habrá que decidir entonces entre (a), (b), o extender esta decisión. La convención queda documentada en el comentario del guard y en AGENTS.md (no tocado en este change — queda para el siguiente si la convención se formaliza).

**Code shape:**
```ts
// features/accounting/journal.service.ts — transitionStatus, antes del switch VALID_TRANSITIONS
async transitionStatus(
  organizationId: string,
  id: string,
  targetStatus: JournalEntryStatus,
  userId: string,
  role?: string,
  justification?: string,
): Promise<JournalEntryWithLines> {
  const entry = await this.repo.findById(organizationId, id);
  if (!entry) throw new NotFoundError("Asiento contable");

  // GUARD: no permitir anular directamente un JE auto-generado desde el Libro Diario.
  // Los services origen (Sale/Purchase/Dispatch/Payment) anulan su JE derivado
  // directamente vía tx.journalEntry.update dentro de su propia transacción —
  // NO pasan por este método. Si en el futuro algún cascade necesita pasar por aquí,
  // extender con método interno o flag explícito.
  if (entry.sourceType !== null && targetStatus === "VOIDED") {
    throw new ValidationError(
      "Este asiento fue generado automáticamente. Para anularlo, anulá el documento de origen (Venta, Compra, Despacho o Pago).",
      AUTO_ENTRY_VOID_FORBIDDEN,
    );
  }

  if (entry.status === "VOIDED") { /* ... existing code ... */ }
  // ... resto del método sin cambios
}
```

Orden del guard: ANTES de `if (entry.status === "VOIDED")`, para que el error específico de auto-entry le gane al genérico de "ya está anulado" cuando ambos aplican.

---

### D.2 — `sourceTypeLabel()` placement: **(a) `features/accounting/journal.ui.ts` (nuevo archivo, dominio)**

**Decision:** Crear `features/accounting/journal.ui.ts` con la función pura `sourceTypeLabel(sourceType: string | null): string`. Agregar también un `SOURCE_TYPE_BADGE` map con className para colocar colores del badge de forma canónica si la UI lo consume en el futuro.

**Rationale:**
- **Colocación por dominio**: el helper vive junto al modelo que lo produce (`JournalEntry.sourceType`). Si mañana se agrega `"inventory"` como sourceType, el helper se toca junto al auto-entry-generator — single source of truth local.
- **Discoverabilidad**: un dev que entra a `features/accounting/` encuentra `journal.ui.ts` como pieza hermana de `journal.service.ts` / `journal.types.ts`. No hay que saber que existe un `lib/labels/` aparte.
- **i18n future-proofing**: si más adelante se introduce i18n real (react-intl, next-intl), el archivo `journal.ui.ts` se traslada completo al sistema de traducciones. Poner el helper en `lib/labels/journal-labels.ts` hoy anticipa una arquitectura que no existe y que probablemente tendrá estructura propia (keys + catálogos), no un archivo flat.
- **Reuse**: list + detail lo consumen hoy. Futuros consumidores (reportes, dashboard hub, auditoría) están todos bajo `accounting/` → la ruta es vecina.

**Code shape:**
```ts
// features/accounting/journal.ui.ts — NEW FILE

/**
 * Label canónico del origen de un asiento contable.
 *
 * sourceType es un string libre hoy (no enum). Casos conocidos:
 * - null → asiento manual (traspaso, ajuste, apertura, cierre)
 * - "sale" | "purchase" | "dispatch" | "payment" → auto-generado
 *
 * Un string desconocido devuelve "Origen desconocido" para que la UI
 * no crashee si se agrega un nuevo source sin actualizar el mapeo.
 */
export function sourceTypeLabel(sourceType: string | null): string {
  switch (sourceType) {
    case null:
      return "Manual";
    case "sale":
      return "Generado por Venta";
    case "purchase":
      return "Generado por Compra";
    case "dispatch":
      return "Generado por Despacho";
    case "payment":
      return "Generado por Pago";
    default:
      return "Origen desconocido";
  }
}

/** Clase Tailwind opcional para distinguir visualmente Manual vs Auto. */
export function sourceTypeBadgeClassName(sourceType: string | null): string {
  return sourceType === null
    ? "bg-blue-100 text-blue-800"
    : "bg-slate-100 text-slate-700";
}
```

Sin export default — named exports, tree-shakeable.

---

### D.3 — Edit page guard relajation

**Decision:** Relajar el guard de `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx:45` para permitir POSTED manuales y bloquear POSTED auto.

**Current code (verbatim):**
```tsx
// app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx:44-47
  // Only DRAFT entries can be edited
  if (entry.status !== "DRAFT") {
    redirect(`/${orgSlug}/accounting/journal/${entryId}`);
  }
```

**Proposed change:**
```tsx
  // Editable: DRAFT (cualquier origen) o POSTED manual (sourceType === null).
  // VOIDED siempre redirige. POSTED auto-generado siempre redirige — editar desde el documento origen.
  const isEditable =
    entry.status === "DRAFT" ||
    (entry.status === "POSTED" && entry.sourceType === null);

  if (!isEditable) {
    redirect(`/${orgSlug}/accounting/journal/${entryId}`);
  }
```

El path `entry.status === "VOIDED"` queda cubierto (entra al redirect). El path `entry.status === "LOCKED"` también redirige (LOCKED no es editable sin justification que la página no pide). El estado ya se obtiene de `journalService.getById` que incluye `sourceType` en el modelo Prisma — no hace falta cambiar el fetch.

Nota defensiva: `entry.sourceType` es `String?` en Prisma; se serializa como `null | string` al cliente. El strict-equality contra `null` es intencional: evita que `""` (si alguien inserta vacío a mano) se trate como manual.

---

### D.4 — `JournalFilters.origin`

**Type change (`features/accounting/journal.types.ts`):**
```ts
export interface JournalFilters {
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
  voucherTypeId?: string;
  status?: JournalEntryStatus;
  origin?: "manual" | "auto";    // ← NEW; "all" equivale a omitir
}
```

No se incluye `"all"` como valor de la interfaz porque "all" = sin filtro = omitir el campo. La UI lo convierte a `undefined`.

**Repository query (`features/accounting/journal.repository.ts:47` area):**
```ts
// Dentro de findAll(), junto a los otros traducciones de filters:
if (filters?.origin === "manual") {
  where.sourceType = null;
} else if (filters?.origin === "auto") {
  where.sourceType = { not: null };
}
// undefined → no se agrega condición; todos los asientos
```

Prisma traduce `{ not: null }` a `IS NOT NULL` en SQL. No se agrega índice en este change (ver Risks en proposal — volumen esperado < 100k).

**Page/Server component (`app/(dashboard)/[orgSlug]/accounting/journal/page.tsx`):**
Agregar parse del searchParam `origin`:
```ts
if (sp.origin === "manual" || sp.origin === "auto") {
  filters.origin = sp.origin;
}
```
Y pasarlo al prop `filters` del list.

**UI control (`components/accounting/journal-entry-list.tsx`):**
Agregar un `<Select>` sibling al de "Estado", con:
```tsx
<div className="space-y-1">
  <Label className="text-sm">Origen</Label>
  <Select
    value={filters.origin ?? "all"}
    onValueChange={(v) => applyFilter("origin", v)}
  >
    <SelectTrigger className="w-48">
      <SelectValue placeholder="Todos los orígenes" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos los orígenes</SelectItem>
      <SelectItem value="manual">Manual</SelectItem>
      <SelectItem value="auto">Automático</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Extender `JournalEntryListProps.filters` para incluir `origin?: "manual" | "auto"`. Extender `applyFilter` para preservar `origin` como preserva los demás filtros, y extender `hasFilters` para incluirlo.

---

### D.5 — Display-date swap

**Call sites:**
- `components/accounting/journal-entry-list.tsx:27-33` — función local `formatDate` que usa `toLocaleDateString("es-BO", ...)`. Consumo en línea 269.
- `components/accounting/journal-entry-detail.tsx:32-38` — función local `formatDate` idéntica. Consumo en líneas 190 y 210.

**Change:**
Ambos componentes eliminan la función local `formatDate` y agregan:
```ts
import { formatDateBO } from "@/lib/date-utils";
```
Cada call site `formatDate(x)` se sustituye por `formatDateBO(x)`.

**Comportamiento:**
- `formatDateBO` retorna `"DD/MM/YYYY"` con zero-pad (ej. `"17/04/2026"`). Esto DIFIERE del formato actual de `list` (`"17 abr 2026"` usando `month: "short"`) y de `detail` (`"17 de abril de 2026"` usando `month: "long"`).
- **Decisión explícita**: unificar a `DD/MM/YYYY` en ambos. Razón: `formatDateBO` es la única fuente segura TZ-stable, y mantener dos formatos diferentes dentro del mismo feature (list vs detail) no aporta — la fecha corta numérica es estándar en Bolivia para documentos contables.
- Alternativa rechazada: agregar un `formatDateBOLong` con mes en texto — scope creep; si se necesita en el futuro se abre un change separado.

**Test migration:**
Tests existentes que asserten strings como `"17 abr 2026"` o `"17 de abril de 2026"` deben actualizarse a `"17/04/2026"`. Buscar el string literal "abr" / "abril" en archivos `components/accounting/**/*.test.tsx`. Hoy no existen tests para `journal-entry-list.tsx` ni `journal-entry-detail.tsx` (verificado con glob: solo `journal-entry-form-today-default.test.tsx`), por lo que los tests para el fix son nuevos (REQ-D.1 y REQ-D.2 S-D.1/S-D.2/S-D.3).

---

### D.6 — `AUTO_ENTRY_VOID_FORBIDDEN`

**Error code definition (`features/shared/errors.ts`):**
Agregar constante al bloque "Asientos Contables" (junto a `ENTRY_SYSTEM_GENERATED_IMMUTABLE`, línea 104):

```ts
// Asientos Contables — guard contra void directo de auto-entries
export const AUTO_ENTRY_VOID_FORBIDDEN = "AUTO_ENTRY_VOID_FORBIDDEN";
```

**Uso (`features/accounting/journal.service.ts`):**
Agregar al import barrel existente (línea 1-19 del service) el nuevo código:

```ts
import {
  // ... existentes
  AUTO_ENTRY_VOID_FORBIDDEN,
} from "@/features/shared/errors";
```

**HTTP mapping:** `ValidationError` (statusCode 422) + `handleError` en `features/shared/middleware.ts:32-50` ya produce automáticamente:
```json
{ "error": "Este asiento fue generado automáticamente...", "code": "AUTO_ENTRY_VOID_FORBIDDEN" }
```
con status 422. Sin cambios adicionales en la route ni en middleware.

---

### D.7 — Internal cascade audit

Auditoría exhaustiva de todos los callsites donde un JE pasa a VOIDED. Grep aplicado: `transitionStatus\s*\(` y `tx.journalEntry.update.*VOIDED`.

**Call sites de `JournalService.transitionStatus`:**

| File:line | Caller | Tipo | Action |
|---|---|---|---|
| `features/accounting/journal.service.ts:545` | (definición) | — | guard agregado |
| `app/api/organizations/[orgSlug]/journal/[entryId]/status/route.ts:29` | PATCH route | API boundary | pasa por el guard — correcto |

**Call sites de void cascade directo (NO pasan por `transitionStatus`):**

| File:line | Caller | Tipo | Action |
|---|---|---|---|
| `features/sale/sale.service.ts:1141-1144` | `SaleService.void` (`voidTx`) | Cascade interno | NO cambia — usa `tx.journalEntry.update` directo + `balancesService.applyVoid(tx, ...)` |
| `features/purchase/purchase.service.ts:1299-1303` | `PurchaseService.void` | Cascade interno | NO cambia |
| `features/dispatch/dispatch.service.ts:1031-1035` | `DispatchService.void` | Cascade interno | NO cambia |
| `features/payment/payment.service.ts:528-532` | `PaymentService.void` | Cascade interno | NO cambia |

**Conclusión:** la fase de proposal asumió incorrectamente que los cascades pasaban por `JournalService.transitionStatus`. En realidad, cada servicio origen actualiza el JE directo con `tx.journalEntry.update` dentro de su propia transacción y aplica los balances con `balancesService.applyVoid(tx, journalEntry)`. Esto hace el guard trivial: NINGÚN caller interno necesita ser modificado. Solo el caller API externo pasa por `transitionStatus` y ahí queremos el guard.

**Implicación para tests:** los integration tests existentes de `SaleService.void`, `PurchaseService.void`, etc. NO deberían romper porque no tocan el método modificado. Validar igual en `sdd-verify`.

---

## Files Modified (final list)

### Código fuente

| File | Change |
|---|---|
| `features/accounting/journal.ui.ts` | **NEW** — helper `sourceTypeLabel` + `sourceTypeBadgeClassName` |
| `features/accounting/journal.types.ts` | add `origin?: "manual" \| "auto"` a `JournalFilters` |
| `features/accounting/journal.repository.ts` | traducir `filters.origin` → `where.sourceType` en `findAll` |
| `features/accounting/journal.service.ts` | guard `AUTO_ENTRY_VOID_FORBIDDEN` en `transitionStatus`; import del nuevo código |
| `features/shared/errors.ts` | nueva constante `AUTO_ENTRY_VOID_FORBIDDEN` |
| `app/(dashboard)/[orgSlug]/accounting/journal/page.tsx` | parse `sp.origin`, pass a filters y al prop `filters` del list |
| `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx:45-47` | relajar guard (D.3) |
| `components/accounting/journal-entry-list.tsx` | columna Origen + badge; filtro Origen Select; import+uso `formatDateBO`; extender type `JournalEntry` para incluir `sourceType` y `JournalEntryListProps.filters.origin` |
| `components/accounting/journal-entry-detail.tsx` | badge Origen en metadatos; import+uso `formatDateBO`; extender type `entry` para incluir `sourceType` |

### Tests (nuevos o actualizados)

| File | Domain | Type |
|---|---|---|
| `features/accounting/__tests__/journal.ui.test.ts` | REQ-B.3 | NEW unit — sourceTypeLabel |
| `features/accounting/__tests__/journal.service.void-guard.test.ts` | REQ-E.1 | NEW integration — transitionStatus guard (S-E1.1..S-E1.4) |
| `features/sale/__tests__/sale.service.void-cascade.test.ts` (o existente) | REQ-E.2 / S-E2.1 | verify que cascade interno no rompe (follow-up si ya existe un test de void) |
| `features/accounting/__tests__/journal.repository.origin-filter.test.ts` | REQ-C.1 | NEW integration — findAll con origin=manual/auto |
| `components/accounting/__tests__/journal-entry-list.test.tsx` | REQ-B.1 + REQ-C.1 UI + REQ-D.1 | NEW component |
| `components/accounting/__tests__/journal-entry-detail.test.tsx` | REQ-B.2 + REQ-D.2 | NEW component |
| `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.tsx` | REQ-A.1 | NEW page-level |

---

## API/Contract Signatures (final)

### Public service API (ya existente, reforzada)

```ts
// JournalService.transitionStatus — firma SIN cambio; añade guard interno.
async transitionStatus(
  organizationId: string,
  id: string,
  targetStatus: JournalEntryStatus,
  userId: string,
  role?: string,
  justification?: string,
): Promise<JournalEntryWithLines>
```
Nuevo comportamiento: lanza `ValidationError` con `code=AUTO_ENTRY_VOID_FORBIDDEN` cuando `entry.sourceType !== null && targetStatus === "VOIDED"`.

### New pure function

```ts
// features/accounting/journal.ui.ts
export function sourceTypeLabel(sourceType: string | null): string;
export function sourceTypeBadgeClassName(sourceType: string | null): string;
```

### Type extension

```ts
// features/accounting/journal.types.ts — JournalFilters
export interface JournalFilters {
  /* existing fields */
  origin?: "manual" | "auto";   // NEW
}
```

### New error code

```ts
// features/shared/errors.ts
export const AUTO_ENTRY_VOID_FORBIDDEN = "AUTO_ENTRY_VOID_FORBIDDEN";
```

---

## Test Strategy

TDD por dominio. Cada REQ tiene al menos un ciclo RED→GREEN.

### Unit

- **`journal.ui.test.ts`** — `sourceTypeLabel(null | "sale" | "purchase" | "dispatch" | "payment" | "unknown_xxx")` → mapeo canónico (S-B3.1..S-B3.6).

### Integration (service + repository con DB real vía Prisma testing)

- **`journal.service.void-guard.test.ts`**:
  - S-E1.1: `transitionStatus(org, je, "VOIDED")` con `sourceType="sale"` → throws `ValidationError.code === AUTO_ENTRY_VOID_FORBIDDEN`.
  - S-E1.2: idem con `sourceType="purchase"`.
  - S-E1.3: idem con `sourceType=null` → NO throws (continúa flujo normal).
  - S-E1.4: `transitionStatus(..., "POSTED")` con `sourceType="sale"` → NO throws (guard solo aplica a VOIDED).
- **`journal.repository.origin-filter.test.ts`**:
  - seed 1 manual + 1 auto; `findAll(org, { origin: "manual" })` → 1 resultado con `sourceType=null`.
  - `findAll(org, { origin: "auto" })` → 1 con `sourceType !== null`.
  - `findAll(org, {})` → 2 resultados.
  - composición: `findAll(org, { origin: "manual", periodId })` respeta ambos.
- **Cascade cover (REQ-E.2 / S-E2.1)** — si ya existe un integration test de `SaleService.void` que verifica que el JE queda VOIDED, basta. Si no, agregar uno que `createAndPost` una sale, llame `saleService.void(org, saleId, userId)`, y verifique que el JE vinculado queda `status=VOIDED` sin error.

### Component (@testing-library/react)

- **`journal-entry-list.test.tsx`**:
  - S-B1.1..S-B1.5 (5 casos): render con fixture de `sourceType`, assert badge label.
  - S-C1.5: render con `filters.origin="auto"` → `<Select>` muestra valor "Automático".
  - S-D.1/S-D.2/S-D.3: render con `date` UTC-midnight/UTC-noon/null, assert output `formatDateBO`.
- **`journal-entry-detail.test.tsx`**:
  - S-B2.1/S-B2.2: badge de origen Manual / Generado por Venta.
  - S-D.1/S-D.2/S-D.3: mismo patrón que list.

### Page-level (Server Component unit test con mocks)

- **`edit/__tests__/page.test.tsx`**:
  - mock `requireAuth`, `requireOrgAccess`, `journalService.getById`.
  - S-A1.1: DRAFT + sourceType=null → componente renderiza `JournalEntryForm`.
  - S-A1.2: POSTED + sourceType=null → renderiza form (con `editEntry` prop populated).
  - S-A1.3: POSTED + sourceType="sale" → `redirect()` called con `/${orgSlug}/accounting/journal/${entryId}`.
  - S-A1.4: POSTED + sourceType="purchase" → redirect (mismo).
  - S-A1.5: VOIDED + sourceType=null → redirect.

### Cobertura final por REQ

| REQ | Cobertura |
|---|---|
| REQ-A.1 | page test (5 escenarios) |
| REQ-B.1 | list component (5 escenarios) |
| REQ-B.2 | detail component (2 escenarios) |
| REQ-B.3 | unit `sourceTypeLabel` (6 escenarios) |
| REQ-C.1 | repository integration (4 casos) + list UI (1 caso) |
| REQ-D.1 | list component (3 escenarios compartidos) |
| REQ-D.2 | detail component (3 escenarios compartidos) |
| REQ-E.1 | service integration (4 escenarios) |
| REQ-E.2 | service integration cascade (1 escenario) |

---

## Risks

- **Pre-existing bug (no fix en este change)**: la route `status/route.ts:29` llama `transitionStatus(orgId, entryId, status, user.id, justification)` — pasa `justification` como 5º argumento pero la firma es `(orgId, id, targetStatus, userId, role?, justification?)`. `justification` termina en `role`. Esto afecta el path LOCKED→VOIDED (que exige validateLockedEdit), no el nuevo guard de auto-entries (que dispara antes). Queda como deferred fix (sugerir un change `fix-journal-status-route-args` separado).
- **`sourceType` en fixtures de test**: los tests existentes del modelo `JournalEntry` pueden no setear `sourceType`. Al serializar vía `JSON.parse(JSON.stringify(entry))` el campo aparece como `null` por default Prisma — OK. Validar en cada test nuevo que el fixture incluye `sourceType` explícito.
- **`formatDateBO` cambio de formato visual**: pasar de `"17 abr 2026"` a `"17/04/2026"` es un cambio visible para el usuario final. Si el PO prefiere mantener el formato largo, agregar `formatDateBOLong` es otro scope. Design decide: unificación a `DD/MM/YYYY`.

---

## Skill Resolution

Project Standards auto-resolved (cached from skill-registry): Next.js 16.2.1 App Router — read `node_modules/next/dist/docs/` before citing APIs; Prisma 7.5.0; TS 5.9.3 strict; React 19.2.4; Vitest; conventional commits sin AI attribution; testing con @testing-library/react para componentes client; page-level testing con mocks de `requireAuth/requireOrgAccess`.
