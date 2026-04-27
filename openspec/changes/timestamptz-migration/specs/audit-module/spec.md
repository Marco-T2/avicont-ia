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

Con la columna `createdAt` como `TIMESTAMP(3)` (sin timezone), el cast `::timestamp` era compatible porque ambos lados eran naive. Post-migración a `TIMESTAMPTZ(3)`, el cast `::timestamp` descarta la información de timezone del string ISO-8601 antes de la comparación, produciendo comparaciones incorrectas en rangos que crucen la medianoche local (`America/La_Paz`). El fix es cambiar el cast a `::timestamptz`.

---

## Requirements MODIFIED

### REQ-AUDIT.1 — Read endpoint: lista paginada por rango de fechas *(modificado)*

> **Base**: ver `openspec/specs/audit-module/spec.md` REQ-AUDIT.1 para el contrato completo (endpoint, filtros, page size 50, defaults de fecha).

**Modificación**: el cursor de paginación DEBE comparar la columna `audit_logs.createdAt` (`TIMESTAMPTZ(3)` post-migración) usando un cast `::timestamptz` (no `::timestamp`). La comparación DEBE preservar la información de timezone del cursor serializado para garantizar orden estable en cualquier rango de fechas, incluyendo rangos que crucen la medianoche local.

#### Scenarios añadidos

##### A1-S7 — cursor serializado en UTC se compara correctamente con columna TIMESTAMPTZ
- **Given** la columna `audit_logs.createdAt` es `TIMESTAMPTZ(3)`
- **AND** el cursor se serializa como `last.createdAt.toISOString()` (ej. `"2026-04-27T04:00:00.000Z"` — que corresponde a la medianoche de `2026-04-27` en `America/La_Paz`)
- **When** el endpoint recibe ese cursor y construye la cláusula WHERE
- **Then** la comparación se realiza como `awp."createdAt" < '2026-04-27T04:00:00.000Z'::timestamptz`
- **AND** el resultado incluye exactamente las filas con `createdAt < 2026-04-27T04:00:00Z` (UTC) sin omisiones ni duplicados

##### A1-S8 — paginación cross-medianoche mantiene orden estable con TIMESTAMPTZ
- **Given** existen filas de audit_logs con `createdAt` en el rango `2026-04-26T23:50:00Z` a `2026-04-27T00:10:00Z` (UTC), que en `America/La_Paz` corresponden al rango `19:50:00` del 26 al `20:10:00` del 26 — es decir, cruzan la medianoche UTC pero NO la medianoche local
- **When** se pagina sobre ese rango con cursor-based pagination usando `::timestamptz`
- **Then** todas las filas aparecen exactamente una vez, en orden `createdAt DESC`, sin duplicados ni omisiones entre páginas consecutivas

##### A1-S9 — cast `::timestamp` produce resultado incorrecto (verificación negativa)
- **Given** la columna `audit_logs.createdAt` es `TIMESTAMPTZ(3)` y existe una fila con `createdAt = '2026-04-27T04:00:00.000+00'`
- **When** se compara usando `::timestamp` en lugar de `::timestamptz` (comportamiento incorrecto — este scenario documenta el bug que se corrige)
- **Then** Postgres convierte el string ISO al timezone de sesión antes de comparar, produciendo un offset de -4h que hace que la comparación evalúe contra `2026-04-27T00:00:00` local en lugar del instante UTC correcto — resultado: filas pueden duplicarse o perderse entre páginas

> **Nota**: el Scenario A1-S9 documenta el comportamiento incorrecto para referencia y para que el test de regresión pueda verificar que el bug NO reproduce con el fix aplicado.

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
