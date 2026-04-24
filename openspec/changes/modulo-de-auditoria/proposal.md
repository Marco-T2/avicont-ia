# Proposal: Módulo de Auditoría

**Change**: `modulo-de-auditoria`
**Status**: Proposed
**Date**: 2026-04-24
**Author**: Marco
**Depends on**: commit `b0bf088` (cobertura INSERT en `audit_trigger_fn` + triggers en líneas de detalle — ver `docs/adr/002-audit-insert-coverage-completion.md`)

## Intent

Dar a los administradores de una organización una bitácora de auditoría **consultable desde la UI**: un listado agrupado por comprobante con filtros por fecha, tipo de entidad, usuario y acción, y una vista de detalle por comprobante con el historial completo y diff a nivel de campo (cabecera + líneas). Hoy `audit_logs` se escribe desde triggers pero no existe ruta de lectura salvo la vista acotada de cierre de periodo; el módulo cierra esa brecha sin tocar schema ni lógica de escritura.

## Problem

El commit `b0bf088` completó la cobertura de escritura en `audit_logs` (INSERT en cabeceras + triggers en `sale_details`, `purchase_details`, `journal_lines`). Como consecuencia, la tabla recibe el universo completo de mutaciones de comprobantes, pero **no hay camino de lectura desde la aplicación**. Las dos únicas lecturas existentes son específicas del flujo de cierre mensual (`app/api/organizations/[orgSlug]/monthly-close/audit-trail/route.ts` y la RSC `close-event/page.tsx`): leen por `correlationId` y no exponen grouping por comprobante, diff de campos ni filtros administrativos.

En consecuencia, un administrador que hoy necesite responder "¿quién editó esta venta, cuándo y qué cambió?" sólo puede hacerlo vía SQL directo sobre `audit_logs`. Esto es inaceptable operacionalmente (escala mal con el volumen post-`b0bf088`, ~6–9× más filas por comprobante) y genera un riesgo de cumplimiento: el Código de Comercio boliviano (Art. 36–65) y las resoluciones de SIN sobre trazabilidad de libros exigen que la organización pueda demostrar el historial de cambios de sus comprobantes contables. Tener la data sin ruta de lectura formal es equivalente, a efectos prácticos de auditoría, a no tenerla.

El módulo resuelve esto con un feature folder `features/audit/` + 2 API routes + 2 páginas RSC + 2 índices + una data migration de permisos. Sin nuevas columnas, sin middleware global, sin dependencias nuevas.

## Goals

- Un administrador puede listar eventos de auditoría agrupados por comprobante para un rango de fechas (default: mes en curso) con paginación cursor-based de 50 filas.
- Un administrador puede abrir el detalle de un comprobante y ver su timeline completo (cabecera + líneas), ordenado por `createdAt ASC` con desempate por `id`.
- La UI distingue **directa** (edición del documento de dominio) vs **indirecta** (reflejo en `journal_entries` cuando un `sale/purchase/payment/dispatch` fue modificado), con heurística cerrada en este proposal.
- La UI renderiza diffs por campo con whitelist de ~5 campos relevantes por `entityType`, etiquetados en español.
- Backend refuerza el tenant isolation del módulo con tests explícitos + wrapper interno de `$queryRaw` (no sistémico, sólo este módulo).
- Cero dependencias nuevas, cero cambios de schema salvo 2 índices en `audit_logs`, cero modificaciones a triggers o `setAuditContext`.

## Non-goals

Los siguientes puntos son separables y quedan fuera de este change:

- **Extensión de `correlationId`** a los servicios de venta / compra / pago / despacho (hoy sólo `monthly-close.service.ts` lo emite). Simplifica el grouping pero es un change separado; el MVP resuelve con el FK chain vía JSONB.
- **Auditoría de `accounts_receivable` / `accounts_payable`**: la exploración confirmó que estas tablas no están auditadas. Es una brecha real pero separable.
- **RLS + Prisma middleware para tenant isolation sistémico**: pertenece al change `arquitectura-escalable`. Este módulo agrega blindajes **locales** (tests + wrapper), no resuelve el problema a nivel proyecto.
- **Export PDF / XLSX** del trail de auditoría: futuro, fuera del MVP.
- **Nuevas columnas en `audit_logs`** (por ejemplo `origin` enum, `isLocked` bool): el usuario pidió explícitamente no mover data logic; todas las clasificaciones se resuelven en query/render time.
- **Trigger INSERT en `fiscal_periods`**: justificado fuera en ADR-002 (naturaleza operacional, no comercial).

## Architectural decisions

Todas las decisiones quedan cerradas por la exploración (ver `openspec/changes/modulo-de-auditoria/exploration.md`). Se listan acá para referencia del spec/design/tasks:

**A1 — Grouping-by-voucher vía `$queryRaw` con resolución de padre por JSONB FK.** Un único query con `CASE al.entityType` resuelve `parent_type` y `parent_id` usando `COALESCE(newValues->>'parentFK', oldValues->>'parentFK')` para cubrir INSERT (newValues) y DELETE (oldValues). El rango de fechas es obligatorio y filtra por índice `(organizationId, createdAt)` antes de evaluar el `COALESCE` del SELECT. Ver exploración §3.A y §5.R1.

**B2 — Resource `"audit"` en el matrix de permissions.** Se agrega `"audit"` al tipo `Resource` y a `PERMISSIONS_READ`/`PERMISSIONS_WRITE` con valor `["owner","admin"]`. Todas las rutas llaman `requirePermission("audit","read",orgSlug)`. Consistente con el resto del proyecto (RBAC matrix-driven), y `ensureOrgSeeded` cubre orgs nuevas automáticamente. Ver exploración §3.B.

**C3 — RSC shell + client components para filtros y diff viewer.** La página de listado es RSC con un client component para el estado de filtros (URL-driven, como `journal/page.tsx` + `journal-entry-list.tsx`); la página de detalle es RSC + `AuditDiffViewer` client para renderizar el diff por campo. Ver exploración §3.C.

**D2 — Whitelist de ~5 campos por `entityType` para el diff.** Mapa estático `DIFF_FIELDS` en `audit.types.ts` con los campos relevantes por tabla, etiquetados en español. No se usa librería de diff externa (el diff es sobre la whitelist, no sobre el JSONB completo). Ver exploración §3.D.

**Directa vs indirecta — heurística cerrada (R4).** Tabla final:

| `entityType`                                      | Condición                 | Clasificación          |
|---------------------------------------------------|---------------------------|------------------------|
| `sales`, `purchases`, `payments`, `dispatches`    | (cualquiera)              | directa                |
| `journal_entries`                                 | `sourceType IS NULL`      | directa (asiento manual) |
| `journal_entries`                                 | `sourceType IS NOT NULL`  | indirecta              |
| `sale_details`, `purchase_details`, `journal_lines` | depende del padre        | hereda del padre       |

La herencia para líneas se resuelve a render time en la query del repository mediante `LEFT JOIN` lateral o subquery que trae el `sourceType` del padre como columna calculada — **no** se lee `newValues->>'sourceType'` del JSONB snapshot (una columna SQL NULL se serializa como JSON `null` vs ausencia de key de manera inconsistente entre versiones de Postgres). Ver exploración §5.R4.

**Paginación / performance (R1).**
- Rango default al entrar: **mes en curso** (`date >= startOfMonth(today)`, `<= endOfMonth(today)`).
- Paginación: **cursor-based** sobre `(createdAt, id)` para desempate estable.
- Tamaño de página: **50 filas**.
- Filtros MVP: `dateFrom` / `dateTo` (obligatorios, default mes en curso) · `entityType` · `changedById` · `action`.
- Dos índices nuevos en la migration del módulo:
  - `@@index([organizationId, entityType, createdAt])`
  - `@@index([organizationId, changedById, createdAt])`

Ambos cubren `ORDER BY createdAt DESC` con paginación cursor-based (btree Postgres es bidireccional). Ver exploración §5.R1.

**Permissions org-scoped (R5).**
- `requireOrg` en todos los métodos del `AuditRepository` (convención del proyecto).
- Data migration obligatoria para orgs existentes: `UPDATE custom_roles SET permissionsRead = permissionsRead || '["audit"]'::jsonb WHERE slug IN ('owner','admin') AND NOT (permissionsRead @> '"audit"'::jsonb)`.
- Deploy atómico: Prisma migrate deploy corre la data migration antes de que el server nuevo (con `"audit"` en el matrix) acepte tráfico. Sin esto habría 403 espurios para orgs existentes.

Ver exploración §5.R5.

**Tenant isolation extras — sólo para este módulo (R6).**
- Tests explícitos de feature-boundaries: (a) aislamiento cross-org en lista y detalle; (b) invariante estático de que todo `$queryRaw` dentro de `features/audit/` recibe `organizationId` como bound param (AST walk o grep).
- Wrapper `scopedQueryRaw` en `AuditRepository` que fuerza `organizationId` como primer parámetro bound y llama `requireOrg()` antes de ejecutar. No es RLS, no es middleware global; blindaje local al único módulo que abusa de `$queryRaw`.

Ver exploración §5.R6.

## Scope

### In

- **Feature folder** `features/audit/` con:
  - `audit.types.ts` (tipos + `DIFF_FIELDS` whitelist)
  - `audit.validation.ts` (`auditListQuerySchema`, `voucherHistoryParamsSchema`)
  - `audit.repository.ts` (extends `BaseRepository`; `listGrouped`, `getVoucherHistory`, wrapper `scopedQueryRaw`)
  - `audit.service.ts` (orquestación delgada; resuelve display names de padres)
  - `server.ts` (`import "server-only"; export { AuditService } from "./audit.service"`) — cumple REQ-FMB.1 / REQ-FMB.2 del spec `feature-module-boundaries`.
  - `index.ts` (re-export sólo de tipos client-safe) — cumple REQ-FMB.3.
- **API routes**:
  - `app/api/organizations/[orgSlug]/audit/route.ts` (GET lista agrupada).
  - `app/api/organizations/[orgSlug]/audit/[entityType]/[entityId]/route.ts` (GET detalle por comprobante).
- **UI pages**:
  - `app/(dashboard)/[orgSlug]/audit/page.tsx` (RSC + client filter shell).
  - `app/(dashboard)/[orgSlug]/audit/[entityType]/[entityId]/page.tsx` (RSC + client diff viewer).
- **Components**:
  - `components/audit/audit-event-list.tsx` ("use client"; lista con filtros).
  - `components/audit/audit-detail.tsx` ("use client"; timeline).
  - `components/audit/audit-diff-viewer.tsx` ("use client"; diff por campo sobre whitelist).
- **Permissions**:
  - `features/permissions/permissions.ts`: agregar `"audit"` a `Resource`, a `PERMISSIONS_READ` y a `PERMISSIONS_WRITE` con valor `["owner","admin"]`.
- **Prisma migration** del módulo con:
  - `@@index([organizationId, entityType, createdAt])` sobre `audit_logs`.
  - `@@index([organizationId, changedById, createdAt])` sobre `audit_logs`.
  - **Data migration** SQL idempotente que agrega `"audit"` a `permissionsRead` de `custom_roles` con `slug IN ('owner','admin')` para orgs existentes.
- **Tests**:
  - Unit: classifier directa/indirecta (con cobertura de la herencia para `sale_details`/`purchase_details`/`journal_lines`).
  - Integration: cross-org isolation (2 orgs con ≥1 audit row cada una; usuario de A nunca ve filas de B en lista ni detalle).
  - Static/AST: invariante de `$queryRaw` dentro de `features/audit/` con `organizationId` como primer bound param.
  - Integration: permissions gate (403 para usuario sin `audit:read`).

### Out

Ver Non-goals. En particular:
- Extender `correlationId` a servicios de venta/compra/pago/despacho.
- Auditoría de `accounts_receivable` / `accounts_payable`.
- RLS / Prisma middleware sistémico.
- Export PDF / XLSX.
- Cualquier nueva columna en `audit_logs` (`origin`, `isLocked`, etc.).
- Trigger INSERT en `fiscal_periods`.

## Acceptance criteria

- `GET /api/organizations/[orgSlug]/audit?dateFrom=...&dateTo=...&entityType=...&changedById=...&action=...&cursor=...&limit=50` retorna eventos agrupados por comprobante con paginación cursor-based (page size 50).
- `GET /api/organizations/[orgSlug]/audit/[entityType]/[entityId]` retorna el timeline completo del comprobante, ordenado `createdAt ASC` con desempate por `id`.
- Ambas rutas retornan **403** para un usuario autenticado cuya rol no tiene `"audit"` en `permissionsRead`.
- **Cross-org isolation**: un usuario miembro de org A que consulta las rutas con `orgSlug` de B obtiene 403; con `orgSlug` de A obtiene sólo filas de A (verificado con fixture de 2 orgs y ≥1 audit row en cada una, tanto en lista como en detalle).
- **Invariante estático**: no existe `$queryRaw`/`$queryRawUnsafe` dentro de `features/audit/` que no reciba `organizationId` como primer parámetro bound (verificado por test AST o grep en la suite de feature-boundaries).
- La clasificación **directa / indirecta** coincide con la heurística cerrada en este proposal, para todos los `entityType` auditados (verificado por unit tests del classifier, incluidos los casos de herencia para `sale_details`, `purchase_details`, `journal_lines`).
- **UI diff viewer**: para cada evento con `oldValues` + `newValues`, sólo se renderizan los campos whitelisted por `DIFF_FIELDS[entityType]`; los labels están en español; campos fuera de la whitelist no aparecen.
- **Data migration aplicada**: para cada org existente, los `custom_roles` con `slug IN ('owner','admin')` tienen `"audit"` dentro de `permissionsRead` (verificable con `SELECT` post-migrate). La migration es idempotente (`NOT (permissionsRead @> '"audit"'::jsonb)`).
- Los **dos índices nuevos** (`[organizationId, entityType, createdAt]` y `[organizationId, changedById, createdAt]`) existen en `audit_logs` post-migrate (verificable via `\d audit_logs`).
- `features/audit/` expone exactamente `index.ts` (client-safe) y `server.ts` (con `import "server-only"` como primer statement), cumpliendo REQ-FMB.1 / REQ-FMB.2 / REQ-FMB.3 del spec `feature-module-boundaries`.
- El test de feature-boundaries (`__tests__/feature-boundaries.test.ts`) queda verde para `features/audit/`.

## Risks and mitigations

- **R1 — Volumen post-b0bf088 (~6-9× filas por comprobante)**: mitigado con rango de fechas obligatorio + cursor-based pagination + 2 índices nuevos. El `COALESCE(newValues->>'parentFK', oldValues->>'parentFK')` vive en el SELECT, no en el WHERE, así no bloquea el uso del índice `(organizationId, createdAt)`.
- **R3 — Grouping cuando detail audit rows llegan antes o con mismo `createdAt` que la cabecera**: no afecta el grouping (se agrupa por `(parent_type, parent_id)` resuelto por JSONB FK, no por timestamp); el timeline en detalle ordena por `createdAt ASC` con tiebreak `id` (cuid).
- **R4 — directa/indirecta inconsistente si se leyera `newValues->>'sourceType'` directo**: mitigado resolviendo la herencia por `LEFT JOIN`/subquery sobre la tabla real `journal_entries`, no sobre el JSONB snapshot.
- **R5 — 403 espurios para orgs existentes si el deploy no es atómico**: mitigado con deploy atómico (Prisma migrate corre la data migration antes de que el server nuevo acepte tráfico); la migration es idempotente.
- **R6 — `$queryRaw` sin `organizationId` (tenant leak)**: mitigado con wrapper interno `scopedQueryRaw` + tests estáticos de la invariante + tests de integración cross-org. Blindaje local al módulo, no sistémico.

## Dependencies

- **Commit `b0bf088`** (merged): cobertura canónica de triggers INSERT/UPDATE/DELETE/STATUS_CHANGE en las 8 tablas auditadas (`sales`, `purchases`, `journal_entries`, `dispatches`, `payments`, `sale_details`, `purchase_details`, `journal_lines`). Documentado en `docs/adr/002-audit-insert-coverage-completion.md`.
- **Prisma schema activo** con `audit_logs` y sus 3 índices existentes (`[organizationId, entityType, entityId]`, `[organizationId, createdAt]`, `[correlationId]`).
- **Subsistema `features/permissions/`**: `Resource`/`Action` types, `PERMISSIONS_READ`/`PERMISSIONS_WRITE` matrix, `requirePermission`, cache + `ensureOrgSeeded`, `prisma/seed-system-roles.ts` que lee dinámicamente el matrix.
- **Patrón RSC + client shell** establecido en `app/(dashboard)/[orgSlug]/accounting/journal/page.tsx` + `components/accounting/journal-entry-list.tsx` (a espejar para lista de auditoría).
- **Spec `feature-module-boundaries`** (`openspec/specs/feature-module-boundaries/spec.md`): `features/audit/` debe cumplir REQ-FMB.1 / .2 / .3 desde su creación (nace split).

## Open follow-ups (separable)

- **Extensión de `correlationId`** a servicios de venta/compra/pago/despacho: colapsa todas las filas de audit de un POST bajo un mismo `correlationId` y reemplaza el grouping por JSONB FK con un simple `GROUP BY correlationId`. Cleanest long-term.
- **Auditoría de `accounts_receivable` / `accounts_payable`**: agregar triggers y entradas en `DIFF_FIELDS`.
- **Tenant isolation sistémico (RLS + Prisma middleware)**: pertenece al change `arquitectura-escalable`.
- **Export PDF / XLSX** del trail de auditoría desde la UI del módulo.
- **Filtro por `correlationId`** en la UI (una vez que más servicios lo emitan — hoy sólo lo usa `monthly-close`).

## Success signal

A 30 días del release: al menos un administrador por organización activa ha abierto la UI de auditoría, cero bug reports de tenant leak (ninguna org ve filas de otra), y las consultas de soporte del tipo "¿quién modificó esta venta / este asiento?" caen efectivamente a cero porque la respuesta está autoservida en `/audit`. Confirmación adicional: la query de lista con rango "mes en curso" retorna en P95 < 500 ms con el volumen proyectado post-`b0bf088`.
