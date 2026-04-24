# Audit Module Specification

**Status**: Active
**Source change**: `2026-04-24-modulo-de-auditoria` (archived)
**Depends on**: spec `feature-module-boundaries`, spec `rbac-permissions-matrix`, spec `audit-log` (trigger infrastructure)

## Purpose

El módulo de auditoría expone la ruta de **lectura** sobre la tabla `audit_logs` (poblada por los triggers del spec `audit-log`) a usuarios administradores. Cubre dos endpoints HTTP (lista agrupada por comprobante + detalle por comprobante), el classifier `directa`/`indirecta`, blindajes de tenant isolation locales al módulo, la integración del resource `"audit"` en la matriz RBAC, dos índices compuestos sobre `audit_logs`, y el diff viewer cliente con whitelist por `entityType`. El feature folder `features/audit/` cumple el spec `feature-module-boundaries` (split-native).

## Scope

Cobertura: dos endpoints (lista agrupada por comprobante y detalle por comprobante), classifier cerrado directa/indirecta, blindajes de tenant isolation locales al módulo, el alta del resource `"audit"` en la matriz RBAC, la data migration idempotente que propagó el permiso a orgs existentes (one-shot histórico), dos índices nuevos en `audit_logs`, y el diff viewer con whitelist por `entityType`.

Trazabilidad: cada REQ mapea uno-a-uno a un Acceptance criterion del proposal original (ver tabla al final).

---

## Requirements

### Requirement: REQ-AUDIT.1 — Read endpoint: lista paginada por rango de fechas

El sistema MUST exponer `GET /api/organizations/[orgSlug]/audit` que retorna eventos de `audit_logs` **agrupados por comprobante** (`parent_type`, `parent_id`) para la org del slug, filtrables por `dateFrom`, `dateTo`, `entityType`, `changedById`, `action`, con paginación **cursor-based** sobre `(createdAt DESC, id DESC)` y page size fijo de **50** filas.

El rango de fechas es obligatorio; si el cliente no envía `dateFrom`/`dateTo`, el server resuelve el default a **mes en curso** (`dateFrom = startOfMonth(today)`, `dateTo = endOfMonth(today)`).

#### Scenario: A1-S1 — default mes en curso

- GIVEN una sesión autenticada de usuario con rol `admin` en org `alpha` y `today = 2026-04-15`
- WHEN llama `GET /api/organizations/alpha/audit` sin parámetros de fecha
- THEN el server resuelve `dateFrom = 2026-04-01T00:00:00` y `dateTo = 2026-04-30T23:59:59.999`
- AND la respuesta contiene sólo filas de `audit_logs` de org `alpha` dentro de ese rango

#### Scenario: A1-S2 — paginación cursor-based 50 filas

- GIVEN existen 75 filas en el rango de fechas para org `alpha`
- WHEN el cliente hace `GET /api/organizations/alpha/audit?limit=50`
- THEN recibe las primeras 50 filas ordenadas por `createdAt DESC, id DESC` y un `nextCursor` no nulo
- AND al invocar `GET /api/organizations/alpha/audit?cursor=<nextCursor>&limit=50` recibe las 25 restantes con `nextCursor = null`

#### Scenario: A1-S3 — tie-break estable por id

- GIVEN dos filas con exactamente el mismo `createdAt` en org `alpha` dentro del rango
- WHEN se paginan con cursor
- THEN el orden entre ellas queda determinado por `id DESC` (cuid lexicográfico descendente) y nunca se duplica ni omite filas entre páginas consecutivas

#### Scenario: A1-S4 — filtros combinables

- GIVEN un admin de org `alpha`
- WHEN llama `GET /api/organizations/alpha/audit?entityType=sales&changedById=usr_123&action=UPDATE`
- THEN la respuesta contiene sólo filas con `entityType = 'sales'` AND `changedById = 'usr_123'` AND `action = 'UPDATE'` dentro del rango de fechas default

#### Scenario: A1-S5 — validación de input inválido

- GIVEN un admin de org `alpha`
- WHEN llama `GET /api/organizations/alpha/audit?limit=500` (excede el máximo de 50)
- THEN responde 400 con código `VALIDATION_ERROR`
- AND la respuesta cita el campo `limit`

#### Scenario: A1-S6 — resultado vacío

- GIVEN no existen filas de audit en el rango para org `alpha`
- WHEN el admin llama `GET /api/organizations/alpha/audit`
- THEN responde 200 con `{ rows: [], nextCursor: null }`

---

### Requirement: REQ-AUDIT.2 — Detail endpoint: historial por comprobante

El sistema MUST exponer `GET /api/organizations/[orgSlug]/audit/[entityType]/[entityId]` que retorna el timeline completo de un comprobante — cabecera y líneas asociadas — ordenado por `createdAt ASC` con desempate por `id ASC`. La respuesta incluye todas las filas de `audit_logs` cuya `entityId` sea el comprobante o cuyo padre (vía JSONB FK) resuelva al mismo `(entityType, entityId)`.

#### Scenario: A2-S1 — timeline completo incluye líneas

- GIVEN un comprobante `sale` con id `sal_001` en org `alpha` que tuvo un INSERT de cabecera, un UPDATE de cabecera, y un INSERT en `sale_details`
- WHEN el admin llama `GET /api/organizations/alpha/audit/sales/sal_001`
- THEN la respuesta contiene las 3 filas (`entityType` ∈ {`sales`, `sale_details`}) ordenadas por `createdAt ASC`
- AND cada fila de `sale_details` se incluye porque `newValues->>'saleId' = 'sal_001'` OR `oldValues->>'saleId' = 'sal_001'`

#### Scenario: A2-S2 — orden ASC con tie-break id

- GIVEN dos filas del timeline con el mismo `createdAt`
- WHEN se renderizan
- THEN el orden entre ellas queda determinado por `id ASC`

#### Scenario: A2-S3 — entityType no auditado

- GIVEN un admin llama `GET /api/organizations/alpha/audit/accounts_receivable/ar_001`
- WHEN el parámetro `entityType` no pertenece al conjunto de tablas auditadas (`sales`, `purchases`, `payments`, `dispatches`, `journal_entries`)
- THEN responde 400 con código `VALIDATION_ERROR`

#### Scenario: A2-S4 — comprobante inexistente

- GIVEN no existen filas de audit para `(entityType='sales', entityId='sal_missing')` en org `alpha`
- WHEN el admin llama `GET /api/organizations/alpha/audit/sales/sal_missing`
- THEN responde 200 con `{ rows: [] }` (no 404 — ausencia de audit ≠ ausencia del recurso)

---

### Requirement: REQ-AUDIT.3 — Classifier directa/indirecta

El sistema MUST clasificar cada fila de audit como `"directa"` o `"indirecta"` siguiendo la heurística cerrada del proposal §Architectural decisions. La clasificación se resuelve en **query/render time**, sin columnas nuevas en `audit_logs`. Para líneas (`sale_details`, `purchase_details`, `journal_lines`) el `sourceType` del padre se obtiene por `LEFT JOIN` lateral / subquery sobre la tabla real (no por `newValues->>'sourceType'` del JSONB).

Heurística (única fuente de verdad):

| `entityType`                                        | Condición                    | Clasificación              |
|----------------------------------------------------|------------------------------|---------------------------|
| `sales`, `purchases`, `payments`, `dispatches`     | (cualquiera)                 | directa                   |
| `journal_entries`                                   | `sourceType IS NULL`         | directa (asiento manual)  |
| `journal_entries`                                   | `sourceType IS NOT NULL`     | indirecta                 |
| `sale_details`                                      | hereda del `sales` padre     | hereda del padre          |
| `purchase_details`                                  | hereda del `purchases` padre | hereda del padre          |
| `journal_lines`                                     | hereda del `journal_entries` padre | hereda del padre  |

#### Scenario: A3-S1 — sales siempre directa

- GIVEN una fila de audit con `entityType = 'sales'` y `action ∈ {INSERT, UPDATE, DELETE, STATUS_CHANGE}`
- WHEN el classifier la evalúa
- THEN retorna `"directa"`

#### Scenario: A3-S2 — journal_entries manual → directa

- GIVEN una fila con `entityType = 'journal_entries'` cuyo `journal_entries.sourceType IS NULL` (asiento manual)
- WHEN el classifier la evalúa
- THEN retorna `"directa"`

#### Scenario: A3-S3 — journal_entries reflejo → indirecta

- GIVEN una fila con `entityType = 'journal_entries'` cuyo `journal_entries.sourceType = 'sale'`
- WHEN el classifier la evalúa
- THEN retorna `"indirecta"`

#### Scenario: A3-S4 — sale_details hereda de sales (directa)

- GIVEN una fila con `entityType = 'sale_details'`, `newValues->>'saleId' = 'sal_001'`, y `sales.id = 'sal_001'` existe en la org
- WHEN el classifier la evalúa
- THEN retorna `"directa"` (hereda de `sales`)

#### Scenario: A3-S5 — journal_lines hereda de journal_entries indirecta

- GIVEN una fila con `entityType = 'journal_lines'`, `newValues->>'journalEntryId' = 'je_001'`, y `journal_entries.id = 'je_001'` tiene `sourceType = 'purchase'`
- WHEN el classifier la evalúa
- THEN retorna `"indirecta"`

#### Scenario: A3-S6 — purchase_details hereda de purchases (directa)

- GIVEN una fila con `entityType = 'purchase_details'`, `newValues->>'purchaseId' = 'pur_001'`, y `purchases.id = 'pur_001'` existe
- WHEN el classifier la evalúa
- THEN retorna `"directa"`

#### Scenario: A3-S7 — herencia se lee de tabla real no de JSONB

- GIVEN una fila `journal_lines` cuyo `newValues->>'sourceType'` JSONB serializa `null` AND cuyo `journal_entries.sourceType` real (en la tabla) es `'sale'`
- WHEN el classifier resuelve la herencia
- THEN usa el valor de `journal_entries.sourceType` (la tabla) y retorna `"indirecta"` — nunca consulta `newValues->>'sourceType'`

---

### Requirement: REQ-AUDIT.4 — Tenant isolation cross-org

El sistema MUST garantizar que un usuario miembro de org A no pueda leer filas de audit de org B en ninguno de los dos endpoints. El enforcement se apoya en dos capas: (a) `requireOrg(orgSlug)` en todos los métodos del repository; (b) wrapper `scopedQueryRaw` que fuerza `organizationId` como primer bound param. Ambos endpoints responden 403 si el `orgSlug` de la URL no pertenece a una org del usuario.

#### Scenario: A4-S1 — usuario de A consulta slug de B → 403

- GIVEN un usuario autenticado miembro de org `alpha` (no miembro de `beta`)
- WHEN llama `GET /api/organizations/beta/audit`
- THEN responde 403 con código `FORBIDDEN` (derivado de `requirePermission`/`requireOrg`)

#### Scenario: A4-S2 — fixture dos orgs, lista sólo devuelve la propia

- GIVEN dos orgs `alpha` y `beta` cada una con ≥1 fila de `audit_logs`
- AND un usuario admin sólo de `alpha`
- WHEN llama `GET /api/organizations/alpha/audit`
- THEN la respuesta contiene sólo filas con `organizationId = 'alpha'`
- AND no contiene ninguna fila con `organizationId = 'beta'` (verificable por assertion explícita sobre cada row)

#### Scenario: A4-S3 — detail no filtra cross-org ni con id válido de la otra org

- GIVEN una fila de audit `(entityType='sales', entityId='sal_beta_001')` existe sólo en org `beta`
- AND un usuario admin sólo de `alpha`
- WHEN llama `GET /api/organizations/alpha/audit/sales/sal_beta_001`
- THEN responde 200 con `{ rows: [] }` — el `requireOrg` filtra por `organizationId = 'alpha'` y no expone la existencia del recurso de `beta`

---

### Requirement: REQ-AUDIT.5 — Invariante estático `$queryRaw` con `organizationId` bound

Dentro de `features/audit/` no MAY existir ninguna llamada a `$queryRaw` o `$queryRawUnsafe` que no reciba `organizationId` como **primer parámetro bound** (placeholder Prisma). La invariante se verifica por test estático (AST walk o grep estructurado) en la suite de feature-boundaries.

#### Scenario: A5-S1 — suite estática detecta `$queryRaw` sin `organizationId`

- GIVEN un archivo en `features/audit/` contiene `prisma.$queryRaw\`SELECT ... FROM audit_logs WHERE ...\`` donde el primer bound param no es `organizationId`
- WHEN `pnpm test` corre la suite de feature-boundaries
- THEN el test falla con mensaje referenciando el archivo y la línea ofensiva

#### Scenario: A5-S2 — suite estática pasa cuando `organizationId` es primer bound

- GIVEN todo `$queryRaw` en `features/audit/` recibe `organizationId` como primer `${orgId}` placeholder
- WHEN `pnpm test` corre la suite
- THEN el test pasa para `features/audit/`

#### Scenario: A5-S3 — `$queryRawUnsafe` también es observado

- GIVEN un archivo usa `prisma.$queryRawUnsafe(sqlString, orgId, ...rest)` donde `orgId` no es el primer arg
- WHEN la suite estática se ejecuta
- THEN el test falla también para `$queryRawUnsafe`

---

### Requirement: REQ-AUDIT.6 — Permisos `audit:read` (owner/admin)

Ambos endpoints (lista y detalle) MUST llamar `requirePermission("audit", "read", orgSlug)`. El resource `"audit"` se agrega al tipo `Resource` y a `PERMISSIONS_READ` con valor `["owner", "admin"]`. `PERMISSIONS_WRITE["audit"] = ["owner", "admin"]` se incluye por consistencia con el resto del matrix aunque hoy no haya endpoints de escritura (forward-compat para mutaciones administrativas futuras como purge/export). Cualquier rol que no esté en la matriz para `(audit, read)` recibe 403.

#### Scenario: A6-S1 — admin lee OK

- GIVEN un usuario con rol `admin` en org `alpha`
- WHEN llama `GET /api/organizations/alpha/audit`
- THEN responde 200

#### Scenario: A6-S2 — owner lee OK

- GIVEN un usuario con rol `owner` en org `alpha`
- WHEN llama `GET /api/organizations/alpha/audit`
- THEN responde 200

#### Scenario: A6-S3 — contador → 403

- GIVEN un usuario con rol `contador` en org `alpha`
- WHEN llama `GET /api/organizations/alpha/audit`
- THEN responde 403 con código `FORBIDDEN`

#### Scenario: A6-S4 — member → 403 en detalle también

- GIVEN un usuario con rol `member` en org `alpha`
- WHEN llama `GET /api/organizations/alpha/audit/sales/sal_001`
- THEN responde 403 con código `FORBIDDEN`

#### Scenario: A6-S5 — Resource type incluye "audit"

- GIVEN el export del tipo `Resource` en `features/permissions/permissions.ts`
- WHEN se inspecciona en tiempo de compilación
- THEN contiene el literal `"audit"`
- AND `PERMISSIONS_READ["audit"]` es `["owner", "admin"]`

---

### Requirement: REQ-AUDIT.7 — Data migration idempotente de permiso "audit"

La migration del módulo MUST incluir una data migration SQL que agrega `"audit"` al JSON array `permissionsRead` de los `custom_roles` con `slug IN ('owner', 'admin')` para toda org existente. La sentencia MUST ser idempotente — re-ejecutarla no duplica ni corrompe el array. Idempotencia se logra con el guard `NOT (permissionsRead @> '"audit"'::jsonb)` en el `WHERE`.

#### Scenario: A7-S1 — migration añade "audit" a orgs sin él

- GIVEN una org existente cuyos `custom_roles` con slug `owner`/`admin` tienen `permissionsRead = ["sales", "purchases", ...]` (sin `"audit"`)
- WHEN `prisma migrate deploy` aplica la data migration
- THEN `permissionsRead` para esos roles ahora contiene `"audit"`
- AND el resto del array queda intacto

#### Scenario: A7-S2 — re-ejecutar la migration es no-op

- GIVEN la data migration ya corrió una vez y todos los `custom_roles` owner/admin ya tienen `"audit"`
- WHEN la misma sentencia SQL se ejecuta por segunda vez
- THEN ninguna fila se actualiza (el `WHERE NOT (permissionsRead @> '"audit"'::jsonb)` filtra todo)
- AND no se duplican entradas en los arrays

#### Scenario: A7-S3 — orgs nuevas reciben "audit" vía seed, no vía data migration

- GIVEN se crea una nueva org post-deploy (`ensureOrgSeeded`)
- WHEN los system roles se siembran dinámicamente desde el matrix
- THEN el rol `admin` y `owner` de esa org nacen con `"audit"` en `permissionsRead` (derivado del matrix actualizado)
- AND la data migration NO corre para orgs nuevas (sólo aplicó una vez, al deploy)

#### Scenario: A7-S4 — roles no owner/admin no son tocados

- GIVEN una org existente con custom roles `facturador` y `auxiliar`
- WHEN la data migration corre
- THEN el `permissionsRead` de esos roles queda sin cambios (la migration tiene `WHERE slug IN ('owner', 'admin')`)

---

### Requirement: REQ-AUDIT.8 — Nuevos índices en `audit_logs`

La migration del módulo MUST crear exactamente dos nuevos índices sobre `audit_logs`, ambos compuestos con `organizationId` como primera columna para cubrir los planes de query del módulo:

- `@@index([organizationId, entityType, createdAt])`
- `@@index([organizationId, changedById, createdAt])`

Ambos se usan tanto para `ORDER BY createdAt DESC` (lista) como para `ASC` (detalle), gracias a la bidireccionalidad de btree.

#### Scenario: A8-S1 — índices existen post-migrate

- GIVEN la migration del módulo se aplicó en un ambiente de prueba
- WHEN se ejecuta `\d audit_logs` en psql
- THEN la salida lista los dos índices compuestos con las columnas en el orden especificado

#### Scenario: A8-S2 — EXPLAIN usa el índice para lista filtrada por entityType

- GIVEN una query `SELECT ... FROM audit_logs WHERE "organizationId" = $1 AND "entityType" = 'sales' AND "createdAt" BETWEEN $2 AND $3 ORDER BY "createdAt" DESC LIMIT 50`
- WHEN se ejecuta `EXPLAIN` sobre ella
- THEN el plan usa `audit_logs_organizationId_entityType_createdAt_idx` (index scan, no seq scan)

#### Scenario: A8-S3 — EXPLAIN usa el índice para filtro por changedById

- GIVEN una query `SELECT ... FROM audit_logs WHERE "organizationId" = $1 AND "changedById" = $2 AND "createdAt" BETWEEN $3 AND $4 ORDER BY "createdAt" DESC`
- WHEN se ejecuta `EXPLAIN`
- THEN el plan usa `audit_logs_organizationId_changedById_createdAt_idx`

---

### Requirement: REQ-AUDIT.9 — UI diff viewer con whitelist por `entityType`

El componente `AuditDiffViewer` MUST renderizar, para cada fila con `oldValues` y `newValues` presentes, **únicamente los campos incluidos en `DIFF_FIELDS[entityType]`** — un mapa estático definido en `features/audit/audit.types.ts` con ~5 campos por tabla. Cada campo se muestra con su **label en español**. Campos fuera de la whitelist no se renderizan, incluso si están presentes en el JSONB.

#### Scenario: A9-S1 — sólo whitelist se renderiza

- GIVEN `DIFF_FIELDS['sales'] = ['totalAmount', 'customerId', 'issueDate', 'status', 'invoiceNumber']`
- AND una fila con `newValues` que contiene `totalAmount`, `customerId`, `internalNotes`, `createdBy`
- WHEN `AuditDiffViewer` renderiza la fila
- THEN muestra sólo `totalAmount` y `customerId`
- AND NO muestra `internalNotes` ni `createdBy`

#### Scenario: A9-S2 — labels en español

- GIVEN `DIFF_FIELDS['sales']` incluye `totalAmount` con label `"Monto total"`
- WHEN el viewer renderiza
- THEN el campo se muestra con el texto `"Monto total"` (no `"totalAmount"`)

#### Scenario: A9-S3 — cambio de valor es destacado

- GIVEN `oldValues.totalAmount = 1000` y `newValues.totalAmount = 1500`
- WHEN el viewer renderiza
- THEN muestra ambos valores con una indicación visual de cambio (ej. `1000 → 1500`)

#### Scenario: A9-S4 — campo ausente en una de las dos versiones

- GIVEN `oldValues.status = 'DRAFT'` y `newValues.status` está ausente (key no presente)
- WHEN el viewer renderiza
- THEN muestra `DRAFT → (ausente)` o equivalente inequívoco, sin crashear

#### Scenario: A9-S5 — entityType sin entrada en DIFF_FIELDS

- GIVEN un `entityType` para el cual `DIFF_FIELDS` no tiene entrada
- WHEN el viewer intenta renderizar
- THEN no renderiza ningún campo del JSONB (fallback seguro: whitelist vacía)

---

### Requirement: REQ-AUDIT.10 — Feature module boundaries (split-native)

`features/audit/` MUST nacer cumpliendo REQ-FMB.1, REQ-FMB.2 y REQ-FMB.3 del spec `feature-module-boundaries`. En particular:

- Expone exactamente `index.ts` (client-safe, sólo tipos/constantes) y `server.ts` (con `import "server-only"` como primer statement).
- Todo `*.repository.ts` y `*.service.ts` del feature carga `import "server-only"` como primer statement.
- `index.ts` NO re-exporta símbolos con nombre terminando en `Repository` o `Service`.
- Consumidores server-side importan desde `@/features/audit/server`; consumidores client-side importan desde `@/features/audit`.

#### Scenario: A10-S1 — ambos barrels existen

- GIVEN el feature folder `features/audit/` post-merge
- WHEN se lista su contenido
- THEN existen `features/audit/index.ts` y `features/audit/server.ts`

#### Scenario: A10-S2 — server.ts y repository llevan server-only

- GIVEN `features/audit/server.ts` y `features/audit/audit.repository.ts`
- WHEN se inspecciona el primer statement ejecutable de cada uno
- THEN es `import "server-only"`

#### Scenario: A10-S3 — index.ts no re-exporta símbolos server

- GIVEN `features/audit/index.ts`
- WHEN la suite `__tests__/feature-boundaries.test.ts` inspecciona sus exports
- THEN ningún identificador exportado cumple el regex `/(Repository|Service)$/`
- AND el test pasa para `features/audit/`

#### Scenario: A10-S4 — API routes importan desde /server

- GIVEN `app/api/organizations/[orgSlug]/audit/route.ts`
- WHEN se inspeccionan sus imports
- THEN el `AuditService` se importa desde `@/features/audit/server` (nunca desde `@/features/audit`)

#### Scenario: A10-S5 — client components no importan desde /server

- GIVEN `components/audit/audit-event-list.tsx` con directiva `"use client"`
- WHEN se inspeccionan sus imports
- THEN ninguno apunta a `@/features/audit/server`
- AND ESLint (`no-restricted-imports`) no reporta errores

---

## Error Code Registry (new for this change)

| Code | HTTP | Origin | Meaning |
|---|---|---|---|
| `FORBIDDEN` | 403 | `requirePermission`/`requireOrg` | Rol no tiene `audit:read` o usuario no es miembro de la org del slug |
| `VALIDATION_ERROR` | 400 | Zod en route | `dateFrom`/`dateTo`/`entityType`/`action`/`cursor`/`limit` inválidos |

Sin códigos nuevos exclusivos del módulo — se reutilizan los del stack de permisos y validación.

---

## Traceability — Acceptance criteria → REQ

| # | Acceptance criterion (proposal) | REQ |
|---|---------------------------------|-----|
| 1 | `GET /audit` retorna eventos agrupados, cursor-based, 50 filas, con filtros `dateFrom/dateTo/entityType/changedById/action` | REQ-AUDIT.1 |
| 2 | `GET /audit/[entityType]/[entityId]` retorna timeline `createdAt ASC` con tie-break `id` | REQ-AUDIT.2 |
| 3 | Ambas rutas responden 403 para rol sin `audit:read` | REQ-AUDIT.6 |
| 4 | Cross-org isolation: user de A no ve B, 403 en slug ajeno | REQ-AUDIT.4 |
| 5 | Invariante estático `$queryRaw` con `organizationId` como primer bound | REQ-AUDIT.5 |
| 6 | Classifier directa/indirecta matches heurística cerrada | REQ-AUDIT.3 |
| 7 | UI diff viewer sólo whitelist por `entityType`, labels en español | REQ-AUDIT.9 |
| 8 | Data migration idempotente añade `"audit"` a owner/admin de orgs existentes | REQ-AUDIT.7 |
| 9 | Dos índices nuevos existen post-migrate | REQ-AUDIT.8 |
| 10 | `features/audit/` cumple REQ-FMB.1 / .2 / .3 | REQ-AUDIT.10 |
| 11 | `__tests__/feature-boundaries.test.ts` queda verde para `features/audit/` | REQ-AUDIT.10 (scenario A10-S3) |

Cobertura: 11/11 Acceptance criteria mapean a ≥1 REQ. El criterion #11 se cubre dentro de REQ-AUDIT.10 (mismo invariante).

---

## Out of Scope (no speccable en este change)

| Item | Referencia |
|------|------------|
| Extensión de `correlationId` a sale/purchase/payment/dispatch services | Proposal — Non-goals / Open follow-ups |
| Auditoría de `accounts_receivable` / `accounts_payable` | Proposal — Non-goals |
| RLS + Prisma middleware (tenant isolation sistémico) | Proposal — Non-goals; pertenece a `arquitectura-escalable` |
| Export PDF / XLSX del trail | Proposal — Non-goals |
| Nuevas columnas en `audit_logs` (`origin`, `isLocked`, …) | Proposal — Non-goals |
| Trigger INSERT en `fiscal_periods` | Proposal — Non-goals (ADR-002) |
| Filtro por `correlationId` en la UI | Proposal — Open follow-ups |
