# Domain Spec: journal-entry-edit-page

## Change: `manual-journal-ux`

## Context

El guard actual en `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx` (línea 45) es:

```ts
if (entry.status !== "DRAFT") {
  redirect(`/${orgSlug}/accounting/journal/${entryId}`);
}
```

Esto bloquea la edición de CUALQUIER asiento POSTED, incluso los manuales, aunque `JournalService.updateEntry` ya ejecuta `updatePostedManualEntryTx` correctamente para entradas POSTED con `sourceType=null`.

## REQ-A.1 — POSTED manuales navegan a /edit; POSTED automáticos son bloqueados; período OPEN requerido (enmienda PR7)

El guard DEBE aceptar exactamente:
1. `status === "DRAFT"` **y** `period.status === "OPEN"`
2. `status === "POSTED"` **y** `sourceType === null` **y** `period.status === "OPEN"`

Todo lo demás DEBE redirigir al detalle o devolver notFound:
- `sourceType !== null` (auto-generado) → `redirect(detalle)`
- `status === "VOIDED"` → `redirect(detalle)`
- `period.status === "CLOSED"` → `notFound()` (período cerrado = inmutable)
- período no encontrado → `notFound()`

```ts
// en EditJournalEntryPage, DESPUÉS de cargar periods:
const period = periods.find((p) => p.id === entry.periodId);
if (!period) notFound();

const isEditable =
  (entry.status === "DRAFT" || (entry.status === "POSTED" && entry.sourceType === null))
  && period.status === "OPEN";

if (!isEditable) {
  redirect(`/${orgSlug}/accounting/journal/${entryId}`);
}
```

**Nota**: el campo `entry.sourceType` debe estar disponible en el tipo retornado por `journalService.getById`. Verificar que `JournalEntryWithLines` exponga `sourceType: string | null`.

---

## REQ-A.2 — Botón "Editar" en detalle sigue la regla de período + origen (PR7)

El componente `JournalEntryDetail` DEBE recibir un nuevo prop `periodStatus: string` desde la página padre `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx`.

El botón "Editar" DEBE renderizarse únicamente cuando:
```ts
const canEdit =
  (entry.status === "DRAFT" || (entry.status === "POSTED" && !entry.sourceType))
  && periodStatus === "OPEN";
```

La página padre obtiene `periodStatus` del `period` que ya busca para `periodName`:
```ts
const period = periods.find((p) => p.id === entry.periodId);
// ... pasar period?.status ?? "CLOSED" como periodStatus
```

---

## Scenarios

### S-A1.1 — DRAFT manual + período OPEN → /edit renderiza el formulario

**Setup:**
- `entry.status = "DRAFT"`, `entry.sourceType = null`, `period.status = "OPEN"`

**Assertion:**
- `redirect()` NO se invoca, `notFound()` NO se invoca
- El componente `<JournalEntryForm>` es renderizado con el prop `editEntry` conteniendo el `id` de la entrada

### S-A1.2 — POSTED manual (sourceType=null) + período OPEN → /edit renderiza el formulario

**Setup:**
- `entry.status = "POSTED"`, `entry.sourceType = null`, `period.status = "OPEN"`

**Assertion:**
- `redirect()` NO se invoca
- `<JournalEntryForm>` es renderizado con `editEntry.id` correcto

### S-A1.3 — POSTED auto (sourceType="sale") → redirige al detalle

**Setup:**
- `entry.status = "POSTED"`, `entry.sourceType = "sale"`, `period.status = "OPEN"`

**Assertion:**
- `redirect("/${orgSlug}/accounting/journal/${entryId}")` es invocado
- `<JournalEntryForm>` NO es renderizado

### S-A1.4 — POSTED auto (sourceType="purchase") → redirige al detalle

**Setup:**
- `entry.status = "POSTED"`, `entry.sourceType = "purchase"`, `period.status = "OPEN"`

**Assertion:**
- `redirect(...)` es invocado

### S-A1.5 — VOIDED manual → redirige al detalle

**Setup:**
- `entry.status = "VOIDED"`, `entry.sourceType = null`, `period.status = "OPEN"`

**Assertion:**
- `redirect(...)` es invocado (los VOIDED no se editan, sin importar origen)

### S-A1.6 (PR7) — DRAFT manual + período CLOSED → notFound

**Setup:**
- `entry.status = "DRAFT"`, `entry.sourceType = null`, `period.status = "CLOSED"`

**Assertion:**
- `notFound()` es invocado (o `redirect()`) — el período cerrado hace el asiento inmutable

### S-A1.7 (PR7) — POSTED manual + período CLOSED → notFound

**Setup:**
- `entry.status = "POSTED"`, `entry.sourceType = null`, `period.status = "CLOSED"`

**Assertion:**
- `notFound()` es invocado

---

## Test File

`app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.tsx`

**Pattern recomendado:**
```ts
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/features/shared", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user-1" }),
  requireOrgAccess: vi.fn().mockResolvedValue("org-1"),
}));
vi.mock("@/features/accounting", () => ({
  JournalService: vi.fn().mockImplementation(() => ({
    getById: vi.fn().mockResolvedValue(mockEntry),
  })),
  AccountsService: vi.fn().mockImplementation(() => ({ list: vi.fn().mockResolvedValue([]) })),
}));
// ... etc.
```
