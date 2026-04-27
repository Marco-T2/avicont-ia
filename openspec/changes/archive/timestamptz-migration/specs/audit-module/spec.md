# Delta: audit-module

**Change**: `timestamptz-migration`
**Capacity**: `audit-module`
**Decision**: MODIFIED — La capacidad ya existe en `openspec/specs/audit-module/spec.md` (archivada del cambio `2026-04-24-modulo-de-auditoria`). Este delta modifica `REQ-AUDIT.1` para que el comportamiento de paginación cursor-based sea correcto con columnas `TIMESTAMPTZ(3)`. El fix del cast `::timestamp` → `::timestamptz` en `audit.repository.ts` es el mecanismo de implementación; el REQ modificado describe el contrato observable.

---

## Contexto del cambio

El cursor de paginación en `audit.repository.ts` serializa el cursor como `last.createdAt.toISOString()` (un string ISO-8601 con sufijo Z, representando UTC). La cláusula WHERE compara:

```sql
awp."createdAt" < ${cursorCreatedAt}::timestamp
```

Con la columna `createdAt` como `TIMESTAMP(3)` (sin timezone), el cast `::timestamp` era compatible porque ambos lados eran naive. Post-migración a `TIMESTAMPTZ(3)`, el comportamiento real (verificado empíricamente contra Postgres) es:

1. El cast `::timestamp` descarta el sufijo `Z` del string ISO. El cursor `'2026-04-27T04:00:00.000Z'::timestamp` produce el TIMESTAMP naive `2026-04-27T04:00:00.000` (sin TZ).
2. Postgres compara `timestamptz_col < timestamp_value` coerce-ando el TIMESTAMP a TIMESTAMPTZ usando `current_setting('TimeZone')` (la sesión de Postgres corre en `America/La_Paz`).
3. El cursor `04:00:00` naive se interpreta como `04:00 BO-local` = **`08:00:00Z`** efectivos para la comparación.
4. La comparación queda `awp."createdAt" < '2026-04-27T08:00:00Z'` en lugar de `< '2026-04-27T04:00:00Z'`.

**Failure mode**: el shift de +4h **expande el rango** efectivo de la comparación. Filas con `createdAt` entre `04:00Z` y `08:00Z` (que NO deberían estar antes del cursor) son incluidas incorrectamente. En una paginación cursor-based, esto produce **filas duplicadas** entre páginas adyacentes (una fila en el rango shifted aparece tanto en la página de "antes del cursor" como en la página que la generó como cursor).

El fix es cambiar el cast a `::timestamptz`, que preserva el sufijo `Z` del string ISO y produce comparación UTC-to-UTC sin depender de `session_timezone`.

---

## Requirements MODIFIED

### REQ-AUDIT.1 — Read endpoint: lista paginada por rango de fechas *(modificado)*

> **Base**: ver `openspec/specs/audit-module/spec.md` REQ-AUDIT.1 para el contrato completo (endpoint, filtros, page size 50, defaults de fecha).

**Modificación**: el cursor de paginación DEBE comparar la columna `audit_logs.createdAt` (`TIMESTAMPTZ(3)` post-migración) usando un cast `::timestamptz` (no `::timestamp`). La comparación DEBE preservar la información de timezone del cursor serializado para garantizar orden estable en cualquier rango de fechas, incluyendo rangos que crucen la medianoche local.

#### Scenarios añadidos

##### A1-S7 — descripción del invariante (consolidado en A1-S8 a nivel de test)
> **CONSOLIDADO**: este scenario describe el invariante general "cursor ISO-Z se compara UTC-to-UTC sin shift expansivo", pero **no genera un test diferencial independiente**. Al intentar materializarlo como test (sembrar una fila en el "rango shifted" `[cursor, cursor+4h]`), colapsa geométricamente con A1-S8: una fila más reciente que el cursor en orden DESC ya fue entregada en una página previa, por lo que el bug se manifiesta como **duplicación cross-page**, no como "filas extra en la página posterior". El fenómeno físico es el mismo desde el punto de vista del WHERE clause, pero el ángulo testeable diferencial es el de A1-S8. Se preserva A1-S7 aquí solo como descripción del invariante para reviewers que busquen el principio antes que el assertion concreto.

- **Invariante**: la comparación del cursor con `audit_logs.createdAt` (TIMESTAMPTZ post-migración) DEBE preservar el sufijo `Z` del string ISO y producir comparación UTC-to-UTC, sin coerción del cursor a `session_timezone`. El fix `::timestamptz` lo garantiza.
- **Test diferencial correspondiente**: ver A1-S8 (manifestación cross-page del fenómeno) y A1-S9 (verificación negativa con cursor sintetizado).

##### A1-S8 — paginación cross-medianoche sin duplicados (con `::timestamptz`)
- **Given** existen filas de audit_logs con `createdAt` que cruzan la medianoche UTC, incluyendo al menos una fila en el "rango shifted" (entre el instante del cursor y `cursor + 4h`)
- **When** se pagina sobre ese rango con cursor-based pagination usando `::timestamptz`
- **Then** todas las filas aparecen exactamente una vez en orden `createdAt DESC`
- **AND** las filas del rango shifted aparecen sólo en su página correcta (la de "después del cursor"), NO duplicadas en la página anterior (esto es lo que el bug `::timestamp` haría: incluirlas en ambas páginas porque el cursor efectivo se desplaza +4h)

##### A1-S9 — cast `::timestamp` produce shift expansivo de +4h (verificación negativa, comportamiento que el fix elimina)
- **Given** la columna `audit_logs.createdAt` es `TIMESTAMPTZ(3)`
- **AND** la sesión de Postgres corre con `TimeZone = 'America/La_Paz'` (UTC-4)
- **AND** existe una fila con `createdAt = '2026-04-27T06:00:00.000Z'` (en el "rango shifted" entre `04:00Z` y `08:00Z`)
- **When** se compara usando `::timestamp` (comportamiento incorrecto — este scenario documenta el bug que el fix corrige) con cursor `'2026-04-27T04:00:00.000Z'`
- **Then** Postgres descarta el sufijo `Z` del string ISO y obtiene el TIMESTAMP naive `2026-04-27T04:00:00.000`
- **AND** al comparar `timestamptz_col < timestamp_value`, Postgres coerce el TIMESTAMP a TIMESTAMPTZ usando `session_timezone = 'America/La_Paz'`, transformando el cursor en `'2026-04-27T08:00:00.000Z'` efectivo
- **AND** la fila `06:00Z` (que NO debería estar antes del cursor `04:00Z`) **es incluida incorrectamente** en el resultado porque `06:00Z < 08:00Z` evalúa true
- **AND** en una paginación multi-página, esa misma fila puede aparecer **duplicada** en páginas adyacentes (en la página actual via el cursor shifted, y en una página posterior via su cursor real)

> **Nota**: los Scenarios A1-S8 y A1-S9 documentan el bug observado empíricamente — el shift es **expansivo** (incluye filas extra) y produce **duplicados**, no omisiones. El fix `::timestamptz` preserva el sufijo `Z` y elimina la coerción por session_timezone, garantizando comparación UTC-to-UTC.
>
> **Tests diferenciales (2, no 3)**: solo A1-S8 y A1-S9 generan tests diferenciales independientes. A1-S7 quedó consolidado en A1-S8 (ver nota en A1-S7 arriba). Los tests deben sembrar al menos una fila en el rango shifted `[cursor, cursor+4h]` y verificar `.not.toContain()` (A1-S9) o ausencia de duplicación cross-page (A1-S8).
>
> **Estado de implementación de los tests A1-S8 y A1-S9**: NO IMPLEMENTADOS en este SDD. Razón técnica: el cambio incluye fix del adapter Prisma (`options: '-c timezone=UTC'` en commit `6fe4eef`) que fuerza `session_timezone='UTC'` en cada conexión del pool. Bajo session UTC, los casts `::timestamp` y `::timestamptz` producen resultados idénticos en comparaciones contra TIMESTAMPTZ — los tests serían no-diferenciales (pasarían tanto con `::timestamp` como con `::timestamptz`). Reproducir el bug requeriría infraestructura de test que permita cambiar `session_timezone` (ej. `SET LOCAL timezone='America/La_Paz'` dentro de transacción de test) — complejidad desproporcionada para un fix de 3 líneas ya protegido por la config del adapter. Si en el futuro se observa regresión en cursor pagination del audit, este scenario sirve como guía para escribir el test diferencial bajo el contexto adecuado (session no-UTC).

---

## Requirements NO modificados

Los siguientes REQs de `audit-module` quedan sin cambios en este delta:

| REQ | Estado | Justificación |
|-----|--------|---------------|
| REQ-AUDIT.2 | Sin cambio | El detail endpoint ordena por `createdAt ASC` sin cursor — no se ve afectado por el tipo de columna |
| REQ-AUDIT.3 | Sin cambio | El classifier directa/indirecta no depende del tipo de columna |
| REQ-AUDIT.4 | Sin cambio | Tenant isolation no depende del tipo de columna |
| REQ-AUDIT.5 | Sin cambio | Invariante `$queryRaw` con `organizationId` como primer bound no depende del tipo |
| REQ-AUDIT.6 | Sin cambio | Permisos no dependen del tipo de columna |
| REQ-AUDIT.7 | Sin cambio | Data migration de permiso "audit" no depende del tipo de columna |
| REQ-AUDIT.8 | Sin cambio | Los índices `[organizationId, entityType, createdAt]` y `[organizationId, changedById, createdAt]` funcionan correctamente con `TIMESTAMPTZ` — btree es agnóstico al tipo de timezone |
| REQ-AUDIT.9 | Sin cambio | UI diff viewer no depende del tipo de columna |
| REQ-AUDIT.10 | Sin cambio | Feature module boundaries no dependen del tipo de columna |

---

## Traceability — Proposal → REQs MODIFIED

| Sección del proposal | REQ modificado |
|---------------------|----------------|
| Intent — cursor `::timestamp` produce paginación incorrecta post-migración | REQ-AUDIT.1 (A1-S7, A1-S8, A1-S9) |
| Scope — fix de cursor en `audit.repository.ts` es atómico con la migración | REQ-AUDIT.1 (modificación) |
| R3 (exploration) — cursor pagination del audit usa `::timestamp` cast | REQ-AUDIT.1 (A1-S9) |
| Decisión 5 (decisions engram) — fix `::timestamp` → `::timestamptz` en mismo PR | REQ-AUDIT.1 |
