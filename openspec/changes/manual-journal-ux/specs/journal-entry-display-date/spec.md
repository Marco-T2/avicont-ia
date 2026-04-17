# Domain Spec: journal-entry-display-date

## Change: `manual-journal-ux`

## Context

Tanto `journal-entry-list.tsx` como `journal-entry-detail.tsx` definen una función local `formatDate` que usa `new Date(x).toLocaleDateString("es-BO", ...)`. Esto produce drift de TZ: una fecha almacenada como `"2026-04-17T00:00:00.000Z"` (UTC-midnight, filas legacy) se muestra como `"16/04/2026"` en Bolivia (UTC-4) porque la conversión retrocede 4 horas.

`formatDateBO` de `@/lib/date-utils` resuelve esto parseando directamente el prefijo ISO (`value.slice(0, 10)`) sin instanciar un `Date`, eliminando cualquier conversión de TZ.

Este fix cierra el ítem diferido REVISIÓN D.5 del change `fix-comprobante-date-tz`.

---

## REQ-D.1 — La lista renderiza fechas con `formatDateBO`

`journal-entry-list.tsx` DEBE:
1. Eliminar la función local `formatDate`.
2. Importar `formatDateBO` desde `@/lib/date-utils`.
3. Reemplazar cada llamada a `formatDate(entry.date)` por `formatDateBO(entry.date)`.

---

## REQ-D.2 — El detalle renderiza fechas con `formatDateBO`

`journal-entry-detail.tsx` DEBE aplicar el mismo reemplazo que REQ-D.1.

---

## Escenarios (aplican a ambos REQs)

### S-D.1 — UTC-midnight (fila legacy) NO retrocede un día

**Input:** `entry.date = "2026-04-17T00:00:00.000Z"`

**Setup de test (patrón obligatorio para este escenario):**
```ts
vi.useFakeTimers();
vi.setSystemTime("2026-04-18T01:00:00.000Z"); // 21:00 hora Bolivia (UTC-4)
// render componente con entry.date = "2026-04-17T00:00:00.000Z"
expect(screen.getByText(/17\/04\/2026/)).toBeInTheDocument();
// NOT "16/04/2026"
vi.useRealTimers();
```

**¿Por qué usar `vi.setSystemTime`?** Hace explícito que el test es consciente del ambiente TZ y no depende de la TZ del runner. `formatDateBO` ignora el reloj del sistema, pero el test documenta el escenario exacto que fallaría con `toLocaleDateString`.

### S-D.2 — UTC-noon renderiza correctamente

**Input:** `entry.date = "2026-04-17T12:00:00.000Z"`

**Assertion:** el texto `"17/04/2026"` está presente en el componente renderizado.

### S-D.3 — Fecha nula o indefinida no produce crash

**Input:** `entry.date = null` o `entry.date = undefined`

**Assertion:** el componente renderiza sin lanzar excepción; el slot de fecha muestra `""` o equivalente vacío.

---

## Test Files

- `components/accounting/__tests__/journal-entry-list.test.tsx` — S-D.1, S-D.2, S-D.3 para el componente lista
- `components/accounting/__tests__/journal-entry-detail.test.tsx` — S-D.1, S-D.2, S-D.3 para el componente detalle

**Nota:** Si ya existen assertions de fecha en esos test files que afirman formatos `toLocaleDateString` (ej: "abr.", "17 de abr."), DEBEN actualizarse para afirmar el formato `"DD/MM/YYYY"` que produce `formatDateBO`.
