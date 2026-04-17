# Domain Spec: journal-entry-origin-filter

## Change: `manual-journal-ux`

## Context

El componente `journal-entry-list.tsx` ya tiene filtros de Período, Tipo de Comprobante y Estado, con estado persistido en URL. La función `applyFilter` construye un `URLSearchParams` desde el estado actual de filtros. Se extiende ese mecanismo con un nuevo parámetro `origin`.

La página server-component `journal/page.tsx` lee los filtros de URL y los pasa al service. El `JournalRepository` construye la query de Prisma. Toda la cadena necesita soportar `origin`.

---

## REQ-C.1 — La lista soporta filtro Manual/Auto

### Cambios requeridos

**`features/accounting/journal.types.ts`:**
```ts
export interface JournalFilters {
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
  voucherTypeId?: string;
  status?: JournalEntryStatus;
  origin?: "manual" | "auto";   // NUEVO
}
```

**`features/accounting/journal.repository.ts`** — traducir `origin` a condición Prisma:
```ts
if (filters.origin === "manual")  where.sourceType = null;
if (filters.origin === "auto")    where.sourceType = { not: null };
```

**`components/accounting/journal-entry-list.tsx`:**
- Agregar `origin?: string` a la interfaz `filters` del prop
- Renderizar un `<Select>` con label "Origen" y opciones `all / manual / auto`
- `applyFilter` debe preservar `origin` al aplicar otros filtros, igual que preserva `periodId`

**`app/(dashboard)/[orgSlug]/accounting/journal/page.tsx`:**
- Leer `searchParams.origin` y pasarlo al service como `filters.origin`

### Escenarios

- **S-C1.1**: Usuario selecciona "Manual" → URL resulta `?origin=manual` (otros filtros activos se conservan). La lista muestra únicamente entradas con `sourceType=null`.
- **S-C1.2**: Usuario selecciona "Automático" → URL resulta `?origin=auto`. La lista muestra únicamente entradas con `sourceType IS NOT NULL`.
- **S-C1.3**: Usuario selecciona "Todos los orígenes" (`value="all"`) → el parámetro `origin` es eliminado de la URL. La lista muestra todas las entradas.
- **S-C1.4**: Filtro `origin=manual` activo con `periodId` también activo → solo entradas manuales del período. La query Prisma tiene `AND [sourceType=null, periodId=..., ...]`.
- **S-C1.5**: La página carga con URL `?origin=auto&periodId=X` → el `<Select>` de Origen muestra "Automático" seleccionado, el `<Select>` de Período muestra el período X seleccionado.

---

## Test Files

- `features/accounting/__tests__/journal.repository.origin-filter.test.ts` — unit tests para la condición SQL (S-C1.1, S-C1.2, S-C1.3, S-C1.4 a nivel de query builder)
- `components/accounting/__tests__/journal-entry-list.test.tsx` — test de render para S-C1.5 (estado del Select con prop `filters.origin="auto"`)
