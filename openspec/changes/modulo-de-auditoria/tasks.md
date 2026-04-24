# Tasks: Módulo de Auditoría

**Change**: `modulo-de-auditoria`
**Date**: 2026-04-24
**Total tasks**: 30
**Depends on**: spec.md + design.md

## Resumen de layers

| Layer | Tasks     | Concepto                                |
|-------|-----------|-----------------------------------------|
| 1     | T01–T04   | Schema + Prisma migrations              |
| 2     | T05–T17   | Feature folder primitives (TDD-ordered) |
| 3     | T18–T19   | API routes                              |
| 4     | T20–T26   | UI components                           |
| 5     | T27–T28   | Tests UI                                |
| 6     | T29–T30   | Verificación manual                     |

---

## Checklist

### Layer 1 — Schema + Prisma

- [x] **T01** — Agregar `"audit"` al matrix de permissions en `features/permissions/permissions.ts`
  - **REQs**: REQ-AUDIT.6
  - **Archivos**: `features/permissions/permissions.ts` (modify)
  - **Depende de**: —
  - **Test**: compile check (TypeScript — el tipo `Resource` es un union exhaustivo y `PERMISSIONS_READ` / `PERMISSIONS_WRITE` / `PERMISSIONS_CLOSE` / `PERMISSIONS_REOPEN` son `Record<Resource, Role[]>`; si falta una key el compilador falla)
  - **Detalle**: añadir `| "audit"` al type `Resource`; añadir `audit: ["owner", "admin"]` a `PERMISSIONS_READ`; añadir `audit: []` a `PERMISSIONS_WRITE`, `PERMISSIONS_CLOSE` y `PERMISSIONS_REOPEN`. Ver design §5.1 para el diff exacto.

- [x] **T02** — Agregar los 2 índices nuevos al `prisma/schema.prisma` en `model AuditLog`
  - **REQs**: REQ-AUDIT.8
  - **Archivos**: `prisma/schema.prisma` (modify)
  - **Depende de**: —
  - **Test**: compile check (`npx prisma validate`)
  - **Detalle**: añadir `@@index([organizationId, entityType, createdAt])` y `@@index([organizationId, changedById, createdAt])` dentro del bloque `model AuditLog`. Los 3 índices existentes (`[organizationId, entityType, entityId]`, `[organizationId, createdAt]`, `[correlationId]`) se mantienen intactos.

- [x] **T03** — Crear migration Prisma para los índices (SQL raw)
  - **REQs**: REQ-AUDIT.8
  - **Archivos**: `prisma/migrations/20260424T130000_audit_module_indexes/migration.sql` (new)
  - **Depende de**: T02
  - **Test**: verificación manual (T29) — `\d audit_logs` post-migrate muestra los 2 nuevos índices
  - **Detalle**: SQL con `CREATE INDEX "audit_logs_organizationId_entityType_createdAt_idx" ON "audit_logs" ("organizationId", "entityType", "createdAt")` y `CREATE INDEX "audit_logs_organizationId_changedById_createdAt_idx" ON "audit_logs" ("organizationId", "changedById", "createdAt")`. Ver design §1.2.

- [x] **T04** — Crear migration Prisma para la data migration de permissions
  - **REQs**: REQ-AUDIT.7
  - **Archivos**: `prisma/migrations/20260424T130001_audit_permissions_data/migration.sql` (new)
  - **Depende de**: T01
  - **Test**: verificación manual (T30) — SELECT post-migrate confirma que owner/admin tienen `"audit"` en `permissionsRead`
  - **Detalle**: SQL idempotente: `UPDATE "custom_roles" SET "permissionsRead" = array_append("permissionsRead", 'audit') WHERE "slug" IN ('owner', 'admin') AND "isSystem" = true AND NOT ('audit' = ANY("permissionsRead"))`. El tipo real de `permissionsRead` es `text[]` (no `jsonb`) — usar `array_append` + `ANY`. Ver design §1.3 y §5.2.
  - **Rule application**: REQ-AUDIT.7 exige idempotencia por guard `NOT ('audit' = ANY(...))` — operador `text[]`, no `jsonb @>`. El proposal §R5 usaba `jsonb`; el design §1.3 lo corrigió tras verificar `schema.prisma:57`. Cross-ref: design §5.2 es la única fuente de verdad del SQL final.

---

### Layer 2 — Feature folder primitives (TDD-ordered)

> Nota de orden TDD: para cada archivo de producción con comportamiento testeable, el test RED precede al archivo de producción. Types-only, barrels y Zod schemas son declaraciones — no llevan TDD.

- [x] **T05** — Crear `features/audit/audit.types.ts` con todos los tipos y constantes
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.2, REQ-AUDIT.3, REQ-AUDIT.9, REQ-AUDIT.10
  - **Archivos**: `features/audit/audit.types.ts` (new)
  - **Depende de**: —
  - **Test**: compile check (sin comportamiento — solo tipos y constantes)
  - **Detalle**: exportar `AuditAction`, `AuditEntityType`, `AUDITED_ENTITY_TYPES`, `AUDIT_ACTIONS`, `AuditClassification`, `AuditEvent`, `AuditGroup`, `AuditListFilters`, `AuditCursor`, `DiffField`, `DIFF_FIELDS`. Sin `import "server-only"` (client-safe). Ver design §2.2 para el código completo incluyendo `DIFF_FIELDS` con los ~5 campos por `entityType`.
  - **TDD**: N/A (declarations only)

- [x] **T06** — Crear `features/audit/audit.validation.ts` con Zod schemas
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.2
  - **Archivos**: `features/audit/audit.validation.ts` (new)
  - **Depende de**: T05
  - **Test**: compile check (Zod schemas son declaraciones sin lógica de negocio propia)
  - **Detalle**: exportar `auditListQuerySchema` (valida `dateFrom`, `dateTo`, `entityType` contra `AUDITED_ENTITY_TYPES`, `changedById`, `action` contra `AUDIT_ACTIONS`, `cursor` como string base64url, `limit` int 1–200 default 50), `voucherHistoryParamsSchema` (valida `entityType` contra los 5 tipos de cabecera únicamente: `sales`, `purchases`, `payments`, `dispatches`, `journal_entries`), y helper `parseCursor(raw: string): AuditCursor` (base64url decode + JSON.parse; lanza `ValidationError` con code `AUDIT_CURSOR_INVALID` si falla).
  - **TDD**: N/A (declarations only)

- [x] **T07** — Crear test RED para `features/audit/audit.classifier.ts`
  - **REQs**: REQ-AUDIT.3
  - **Archivos**: `features/audit/__tests__/audit.classifier.test.ts` (new)
  - **Depende de**: T05
  - **Test**: RED — los tests deben FALLAR (archivo de producción no existe aún). Failure esperado: `Cannot find module '../audit.classifier'`
  - **Detalle**: escribir 12–15 casos cubriendo toda la tabla de R4: (1) `sales` → directa, (2) `purchases` → directa, (3) `payments` → directa, (4) `dispatches` → directa, (5) `journal_entries` con `sourceType = null` → directa, (6) `journal_entries` con `sourceType = 'sale'` → indirecta, (7) `sale_details` → directa, (8) `purchase_details` → directa, (9) `journal_lines` con padre `sourceType = null` → directa, (10) `journal_lines` con padre `sourceType = 'purchase'` → indirecta, (11) `journal_entries` sin `parentContext` → throw, (12) `journal_lines` sin `parentContext` → throw, (13) exhaustiveness: `entityType` inválido → throw. Scenarios A3-S1 a A3-S7 deben estar cubiertos.

- [x] **T08** — Crear `features/audit/audit.classifier.ts` (GREEN para T07)
  - **REQs**: REQ-AUDIT.3
  - **Archivos**: `features/audit/audit.classifier.ts` (new)
  - **Depende de**: T07
  - **Test**: T07 debe pasar (GREEN). Compile check adicional.
  - **TDD pair**: T07 → T08
  - **Detalle**: implementar `classify(entityType: AuditEntityType, parentContext: ParentContext): AuditClassification` con la lógica exacta del design §2.3. `ParentContext` es `{ kind: "none" } | { kind: "journal_entries"; sourceType: string | null }`. Sin `import "server-only"` (función pura, puede importarse desde tests y desde service).

- [x] **T09a** — Crear test RED para `AuditRepository` — skeleton + `scopedQueryRaw`
  - **REQs**: REQ-AUDIT.4, REQ-AUDIT.5
  - **Archivos**: `features/audit/__tests__/audit.repository.test.ts` (new, partial)
  - **Depende de**: T05, T06, T08
  - **Test**: RED — failure esperado: `Cannot find module '../audit.repository'`
  - **Detalle**: escribir los casos de: (a) `scopedQueryRaw` llama `requireOrg()` antes de ejecutar — si `organizationId` es vacío lanza; (b) `listFlat` retorna `nextCursor = null` cuando hay ≤ limit filas; (c) `listFlat` retorna `nextCursor` poblado cuando hay > limit filas; (d) filtros opcionales (`entityType`, `changedById`, `action`) reducen el resultado; (e) paginación cursor es estable entre páginas (no duplicados ni omisiones). Tests de integración contra DB real siguiendo patrón `worksheet.repository.test.ts`.

- [x] **T09b** — Crear test RED para `AuditRepository` — `getVoucherHistory`
  - **REQs**: REQ-AUDIT.2, REQ-AUDIT.4
  - **Archivos**: `features/audit/__tests__/audit.repository.test.ts` (extend)
  - **Depende de**: T09a
  - **Test**: RED — los casos de `getVoucherHistory` deben fallar junto con los de T09a
  - **Detalle**: casos: (a) retorna timeline `createdAt ASC, id ASC` incluyendo detail rows cuyo padre FK resuelve al mismo `(entityType, entityId)`; (b) retorna `[]` cuando no existen filas para el par; (c) cross-org: retorna `[]` cuando `entityId` es de otra org.

- [x] **T10** — Crear `features/audit/audit.repository.ts` (GREEN para T09a + T09b)
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.2, REQ-AUDIT.4, REQ-AUDIT.5
  - **Archivos**: `features/audit/audit.repository.ts` (new)
  - **Depende de**: T09b
  - **Test**: T09a + T09b deben pasar (GREEN). Compile check.
  - **TDD pair**: T09a+T09b → T10
  - **Detalle**: `import "server-only"` como primer statement. `AuditRepository extends BaseRepository`. Métodos: `listFlat(organizationId, filters)`, `getVoucherHistory(organizationId, parentVoucherType, parentVoucherId)`, `protected async scopedQueryRaw<T>(organizationId, builder)`. Exportar también `interface AuditRow`. Implementar el query de 2 CTE (design §2.5 y §6.1) usando `Prisma.sql` template — primer uso del helper en el proyecto. Ver design §6.1 para el código completo de `listFlat` con cursor y límite. `getVoucherHistory` usa un query análogo con `ORDER BY createdAt ASC, id ASC` y sin paginación.

- [x] **T11a** — Crear test RED para `AuditService` — orquestación y agrupación
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.3
  - **Archivos**: `features/audit/__tests__/audit.service.test.ts` (new)
  - **Depende de**: T08, T10
  - **Test**: RED — failure esperado: `Cannot find module '../audit.service'`
  - **Detalle**: unit tests con `AuditRepository` mockeado. Casos: (a) `listGrouped` agrupa filas por `(parentVoucherType, parentVoucherId)` correctamente; (b) aplica `classify` a cada fila; (c) resuelve `changedBy.name` desde lookup de usuarios; (d) caso "usuario eliminado" — `users.get` retorna undefined → `changedBy.name = "Usuario eliminado"`; (e) `nextCursor` se propaga desde repo al resultado; (f) orden de groups por `lastActivityAt DESC`.

- [x] **T11b** — Crear test RED para `AuditService` — `getVoucherHistory`
  - **REQs**: REQ-AUDIT.2, REQ-AUDIT.3
  - **Archivos**: `features/audit/__tests__/audit.service.test.ts` (extend)
  - **Depende de**: T11a
  - **Test**: RED — casos de `getVoucherHistory` deben fallar junto con T11a
  - **Detalle**: casos: (a) retorna eventos `createdAt ASC` con tie-break `id ASC`; (b) aplica classifier a cada evento; (c) retorna `[]` para comprobante sin filas de audit.

- [x] **T12** — Crear `features/audit/audit.service.ts` (GREEN para T11a + T11b)
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.2, REQ-AUDIT.3
  - **Archivos**: `features/audit/audit.service.ts` (new)
  - **Depende de**: T11b
  - **Test**: T11a + T11b deben pasar (GREEN). Compile check.
  - **TDD pair**: T11a+T11b → T12
  - **Detalle**: `import "server-only"` como primer statement. `AuditService` con constructor que acepta `repo?: AuditRepository` (injection para tests). Métodos: `listGrouped(organizationId, filters)`, `getVoucherHistory(organizationId, entityType, entityId)`. Helpers privados: `toEvent(row, users)`, `groupByVoucher(events)`, `resolveUserNames(rows)`. Ver design §2.6 para el código completo incluyendo la lógica de `groupByVoucher` y resolución de `parentClassification`.

- [x] **T13** — Crear test RED para tenant isolation cross-org
  - **REQs**: REQ-AUDIT.4
  - **Archivos**: `features/audit/__tests__/audit.tenant-isolation.test.ts` (new)
  - **Depende de**: T12
  - **Test**: RED — failure esperado mientras el servicio no existe; se vuelve GREEN en T12 si T12 ya está mergeado, o aquí si se escribe antes
  - **Detalle**: integration test con DB real, 2 orgs. Casos: (a) `listGrouped(orgA)` solo devuelve eventos de orgA; (b) `listGrouped(orgB)` no contiene eventos de orgA (assertion explícita sobre cada row); (c) `getVoucherHistory(orgB, 'sales', saleIdDeOrgA)` retorna `[]`. Fixtures: crear 2 orgs + 1 user por org + 1 sale por org (triggers INSERT emiten audit_logs). Cleanup en `afterAll`. Ver design §6.3 para el código de referencia.

- [x] **T14** — Crear test RED para invariante estático `$queryRaw`
  - **REQs**: REQ-AUDIT.5, REQ-AUDIT.10
  - **Archivos**: `features/audit/__tests__/feature-boundaries.test.ts` (new)
  - **Depende de**: T10
  - **Test**: RED — al menos la aserción `"listFlat must call this.scopedQueryRaw"` debe fallar si el skeleton de `audit.repository.ts` aún no tiene la implementación completa; la aserción grep también debe fallar si hay `$queryRaw` directo fuera del wrapper
  - **Detalle**: dos assertions grep-based: (1) ningún `$queryRaw` / `$queryRawUnsafe` / `$executeRaw` / `$executeRawUnsafe` en `features/audit/*.ts` (excluyendo `__tests__/`) fuera del método `scopedQueryRaw` en `audit.repository.ts`; (2) `listFlat` y `getVoucherHistory` en `audit.repository.ts` llaman `this.scopedQueryRaw`. Ver design §6.2 para el código completo del test. Este test también cubre REQ-AUDIT.10 scenario A10-S3 (index.ts no re-exporta Repository/Service) — agregar una tercera aserción que inspecciona `index.ts` exports.

- [x] **T15** — Crear `features/audit/index.ts` y `features/audit/server.ts` (GREEN para T14 parcialmente)
  - **REQs**: REQ-AUDIT.10
  - **Archivos**: `features/audit/index.ts` (new), `features/audit/server.ts` (new)
  - **Depende de**: T12, T14
  - **Test**: T14 aserción sobre barrels debe pasar (GREEN). Compile check.
  - **TDD pair**: T14 → T15 (parcial — la aserción grep de `$queryRaw` ya pasó en T10)
  - **Rule application**: REQ-FMB.1 (split-native) — `index.ts` re-exporta `export type *` desde `audit.types.ts` únicamente; sin símbolos que terminen en `Repository` o `Service`. `server.ts` tiene `import "server-only"` como **primer statement** (REQ-FMB.2), luego `export { AuditService } from "./audit.service"` y `export { AuditRepository } from "./audit.repository"`. También re-exportar `parseCursor` y `voucherHistoryParamsSchema` desde `server.ts` (los routes los importan desde acá per design §3.1).
  - **Detalle**: `index.ts` — `export type { AuditEvent, AuditGroup, AuditListFilters, AuditCursor, AuditAction, AuditEntityType, AuditClassification, DiffField } from "./audit.types"; export { DIFF_FIELDS, AUDITED_ENTITY_TYPES, AUDIT_ACTIONS } from "./audit.types"`. Constantes (`DIFF_FIELDS`, etc.) son client-safe (objetos planos). `server.ts` — primer statement `import "server-only"`, luego re-exports de service, repository, parseCursor y voucherHistoryParamsSchema.

---

### Layer 3 — API routes

- [x] **T16** — Crear `app/api/organizations/[orgSlug]/audit/route.ts` (GET lista)
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.4, REQ-AUDIT.6
  - **Archivos**: `app/api/organizations/[orgSlug]/audit/route.ts` (new)
  - **Depende de**: T15
  - **Test**: compile check. La cobertura funcional viene de T13 (cross-org) + T12 (service) + T07 (classifier). No se escribe test de ruta aislado — la integración está cubierta por los tests del service layer.
  - **Detalle**: handler `GET(request, { params })` que hace `await params` (Next.js 16 API con `params` como Promise), llama `requirePermission("audit", "read", orgSlug)`, parsea query params con `auditListQuerySchema`, calcula default de fecha (`startOfMonth`/`endOfMonth`) cuando `dateFrom`/`dateTo` están ausentes, instancia `new AuditService()` y llama `listGrouped`, retorna `Response.json(result)`. Wrapar en `try/catch` → `handleError(error)`. Importar `AuditService`, `auditListQuerySchema`, `parseCursor` desde `@/features/audit/server`. Ver design §3.1 para el handler completo. Agregar `AUDIT_DATE_RANGE_INVALID` (422) a `features/shared/errors.ts` si no existe.

- [x] **T17** — Agregar códigos de error `AUDIT_DATE_RANGE_INVALID` y `AUDIT_CURSOR_INVALID` a `features/shared/errors.ts`
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.2
  - **Archivos**: `features/shared/errors.ts` (modify)
  - **Depende de**: —
  - **Test**: compile check
  - **Nota**: se separa de T16 para poder shippear como commit previo independiente y mantener el diff limpio.

- [x] **T18** — Crear `app/api/organizations/[orgSlug]/audit/[entityType]/[entityId]/route.ts` (GET detalle)
  - **REQs**: REQ-AUDIT.2, REQ-AUDIT.4, REQ-AUDIT.6
  - **Archivos**: `app/api/organizations/[orgSlug]/audit/[entityType]/[entityId]/route.ts` (new)
  - **Depende de**: T15, T17
  - **Test**: compile check. Cobertura funcional viene de T13 y T12.
  - **Detalle**: handler `GET(_request, { params })`, llama `requirePermission("audit", "read", orgSlug)`, valida `{ entityType, entityId }` con `voucherHistoryParamsSchema` (solo 5 tipos de cabecera — si `entityType` no está en el set responde 400 `VALIDATION_ERROR`), instancia `new AuditService()` y llama `getVoucherHistory`, retorna `Response.json({ events })`. Ver design §3.2.

---

### Layer 4 — UI components

- [x] **T19** — Crear `components/audit/audit-event-badges.tsx`
  - **REQs**: REQ-AUDIT.3, REQ-AUDIT.9
  - **Archivos**: `components/audit/audit-event-badges.tsx` (new)
  - **Depende de**: T05
  - **Test**: compile check (helpers visuales simples — badge `directa` verde, `indirecta` gris, action badge)
  - **Detalle**: `"use client"` directiva. Exportar `ClassificationBadge({ classification }: { classification: AuditClassification })` y `ActionBadge({ action }: { action: AuditAction })`. Seguir el patrón de badges existentes en el proyecto (ver `components/accounting/`).

- [x] **T20** — Crear `app/(dashboard)/[orgSlug]/audit/page.tsx` (RSC lista)
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.6
  - **Archivos**: `app/(dashboard)/[orgSlug]/audit/page.tsx` (new)
  - **Depende de**: T16, T19
  - **Test**: compile check (RSC — sin comportamiento propio; delega en `AuditEventList`)
  - **Detalle**: RSC. Leer `searchParams` (Next.js 16 — `searchParams` es una Promise, hacer `await searchParams`). Llamar `requirePermission("audit", "read", orgSlug)`. Llamar `new AuditService().listGrouped(...)` con los filtros del URL. Resolver lista de usuarios de la org para el filter select (`prisma.membership.findMany` o equivalente). Pasar `initialData`, `filters` y `users` al client component `<AuditEventList>`. Aplicar `startOfMonth`/`endOfMonth` como defaults si fechas ausentes.

- [x] **T21** — Crear `app/(dashboard)/[orgSlug]/audit/[entityType]/[entityId]/page.tsx` (RSC detalle)
  - **REQs**: REQ-AUDIT.2, REQ-AUDIT.6
  - **Archivos**: `app/(dashboard)/[orgSlug]/audit/[entityType]/[entityId]/page.tsx` (new)
  - **Depende de**: T18, T19
  - **Test**: compile check
  - **Detalle**: RSC. Llama `requirePermission("audit", "read", orgSlug)`. Valida `entityType` contra los 5 tipos de cabecera (redirigir a 404 o lanzar si inválido). Llama `new AuditService().getVoucherHistory(orgId, entityType, entityId)`. Pasa `events` a `<AuditDetailTimeline>`.

- [x] **T22** — Crear `components/audit/audit-diff-viewer.tsx` (client diff whitelisteado)
  - **REQs**: REQ-AUDIT.9
  - **Archivos**: `components/audit/audit-diff-viewer.tsx` (new)
  - **Depende de**: T05, T19
  - **Test**: ver T27 (test RED que precede esta implementación — ver nota abajo)
  - **Nota TDD**: se escribe T27 (test RED) antes de T22 (GREEN). Se agrupa acá en la layer de UI para visibilidad, pero T27 debe ejecutarse primero.
  - **TDD pair**: T27 → T22
  - **Detalle**: `"use client"`. Props: `{ event: AuditEvent; fieldsOverride?: DiffField[] }`. Renderiza tabla con columnas **Campo** / **Antes** / **Después**, una fila por cada campo en `DIFF_FIELDS[event.entityType] ?? []`. Formateadores: `"decimal"` → `toLocaleString("es-BO", { minimumFractionDigits: 2 })`; `"date"` → `formatDateBO(value)`; `"status"` → lookup `STATUS_BADGE`; `"reference"` → mostrar id con `"Ref. "` prefix. Edge cases: campo ausente → "—"; valores iguales → no renderizar la fila; `oldValues = null` (INSERT) → columna "Antes" vacía; `newValues = null` (DELETE) → columna "Después" vacía; `entityType` sin entrada en `DIFF_FIELDS` → no renderizar nada (fallback seguro). Ver design §4.3.

- [x] **T23** — Crear `components/audit/audit-event-list.tsx` (client lista con filtros)
  - **REQs**: REQ-AUDIT.1, REQ-AUDIT.6
  - **Archivos**: `components/audit/audit-event-list.tsx` (new)
  - **Depende de**: T05, T19, T22
  - **Test**: compile check (lógica de navegación URL — no tiene comportamiento puro testeable en unit; cobertura viene de E2E/integración futura)
  - **Detalle**: `"use client"`. Props shape definida en design §4.2. Filtros URL-driven: `dateFrom`, `dateTo`, `entityType` (select), `changedById` (select con `users` prop), `action` (select). Cambio de filtro → `router.push(newUrl)` (inmediato, sin debounce — todos son selects/date pickers en MVP). Paginación: botón "Siguiente página" → agrega `?cursor=...` al URL; se deshabilita cuando `nextCursor === null`. Cada grupo se renderiza como `<Card>` con `ClassificationBadge`, `lastActivityAt`, 3 eventos colapsados + "ver N más". Espejo de `JournalEntryList` (ver `components/accounting/journal-entry-list.tsx`). Importar tipos desde `@/features/audit` (client-safe barrel).

- [x] **T24** — Crear `components/audit/audit-detail-timeline.tsx` (client timeline de detalle)
  - **REQs**: REQ-AUDIT.2, REQ-AUDIT.9
  - **Archivos**: `components/audit/audit-detail-timeline.tsx` (new)
  - **Depende de**: T05, T19, T22
  - **Test**: compile check
  - **Detalle**: `"use client"`. Props: `{ events: AuditEvent[] }`. Renderiza timeline vertical con `createdAt`, `action`, `changedBy.name`, `classification`, y `<AuditDiffViewer event={ev} />` por cada evento. Importar desde `@/features/audit` (no desde `@/features/audit/server`).

---

### Layer 5 — Tests UI

- [x] **T27** — Crear test RED para `AuditDiffViewer`
  - **REQs**: REQ-AUDIT.9
  - **Archivos**: `components/audit/__tests__/audit-diff-viewer.test.tsx` (new)
  - **Depende de**: T05
  - **Test**: RED — failure esperado: `Cannot find module '../audit-diff-viewer'`
  - **Nota de orden**: este test debe crearse ANTES que T22 (aunque figure en Layer 5). La dependencia de T22 en T27 está declarada explícitamente.
  - **Detalle**: casos: (a) sólo campos de `DIFF_FIELDS['sales']` se renderizan — `internalNotes` y `createdBy` no aparecen; (b) labels en español — `totalAmount` se muestra como "Monto total"; (c) campo con valor cambiado muestra antes y después; (d) `oldValues = null` (INSERT) → columna "Antes" vacía, no crash; (e) `newValues = null` (DELETE) → columna "Después" vacía, no crash; (f) campo presente en `oldValues` pero ausente en `newValues` → muestra "—" en "Después"; (g) `entityType` sin entrada en `DIFF_FIELDS` → no renderiza nada (wrapper vacío). Usar `@testing-library/react`.

- [x] **T28** — Verificar que T14 (`feature-boundaries.test.ts`) pasa verde con la implementación completa
  - **REQs**: REQ-AUDIT.5, REQ-AUDIT.10
  - **Archivos**: `features/audit/__tests__/feature-boundaries.test.ts` (ya creado en T14 — verificación)
  - **Depende de**: T10, T15
  - **Test**: `pnpm test features/audit/__tests__/feature-boundaries.test.ts` — debe pasar GREEN tras completar T10 y T15
  - **Detalle**: confirmar que: (1) no hay `$queryRaw` directo fuera de `scopedQueryRaw`; (2) `listFlat` y `getVoucherHistory` llaman `this.scopedQueryRaw`; (3) `index.ts` no re-exporta símbolos terminados en `Repository` o `Service`. Si algún assert falla en este punto, corregir el archivo de producción correspondiente antes de continuar.

---

### Layer 6 — Verificación manual

- [x] **T29** — Verificar índices post-migrate con `\d audit_logs`
  - **REQs**: REQ-AUDIT.8
  - **Archivos**: — (verificación manual, no toca archivos)
  - **Depende de**: T03
  - **Test**: manual psql — `\d audit_logs` debe listar `audit_logs_organizationId_entityType_createdAt_idx` y `audit_logs_organizationId_changedById_createdAt_idx`
  - **Detalle**: ejecutar en el ambiente de desarrollo tras `prisma migrate dev`. Confirmar que los 3 índices previos también siguen presentes.

- [x] **T30** — Verificar data migration de permissions con SELECT post-migrate
  - **REQs**: REQ-AUDIT.7
  - **Archivos**: — (verificación manual, no toca archivos)
  - **Depende de**: T04
  - **Test**: manual psql — `SELECT slug, "permissionsRead" FROM custom_roles WHERE slug IN ('owner', 'admin') AND "isSystem" = true` — debe mostrar `'audit'` en el array para todas las filas. Re-ejecutar el UPDATE para confirmar idempotencia (0 rows updated).
  - **Detalle**: confirmar que roles `facturador`, `auxiliar`, etc. no fueron tocados.

---

## Gaps y tareas no anticipadas en spec/design

> Las siguientes son tareas necesarias para la implementación que el spec/design no listan explícitamente pero se descubren al mapear archivos a tareas:

1. **T17** (agregar error codes a `features/shared/errors.ts`) — el design menciona los códigos `AUDIT_DATE_RANGE_INVALID` y `AUDIT_CURSOR_INVALID` en §7 pero no los incluye en ningún task. Se agrega como tarea separada antes de T16 para mantener el diff de la route limpio.

2. **`audit-event-badges.tsx`** (T19) — el design §4.1 lista `audit-event-badges.tsx` como archivo del componente folder pero no define una tarea para él. Se agrega como tarea independiente porque es un dependency de `AuditEventList` y `AuditDetailTimeline`.

3. **`formatDateBO`** — el design §4.3 referencia `formatDateBO` como util ya existente (ver `journal-entry-list.tsx:51`). Se asume que el util ya existe; si no existe, deberá crearse como subtask de T22. No se agrega tarea por ser condicional.

4. **`STATUS_BADGE`** — el design §4.3 referencia `STATUS_BADGE`. Verificar que existe para cada `entityType` relevante antes de T22.

5. **`startOfMonth` / `endOfMonth`** en `lib/date-utils` — referenciados en el handler de T16 y en la RSC de T20. Verificar que estos helpers existen y aceptan TZ `America/La_Paz`; si no, agregarlos como subtask de T16.
