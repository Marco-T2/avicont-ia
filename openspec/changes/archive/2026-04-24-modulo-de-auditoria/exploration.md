# Exploración: Módulo de Auditoría

**Change**: `modulo-de-auditoria`
**Date**: 2026-04-24
**Post-commit**: b0bf088 (audit_insert_coverage_completion)

---

## Section 1 — Current State

### 1.1 Audit Infrastructure (post b0bf088)

`audit_logs` table (`prisma/schema.prisma:934-952`) has:
- `id`, `organizationId`, `entityType`, `entityId`, `action`, `oldValues` (Json?), `newValues` (Json?), `changedById`, `justification`, `correlationId`, `createdAt`
- Indexes: `(organizationId, entityType, entityId)`, `(organizationId, createdAt)`, `(correlationId)`

Triggers (all `AFTER INSERT OR UPDATE OR DELETE` unless noted):
- Header tables: `sales`, `purchases`, `journal_entries`, `dispatches`, `payments`
- Detail tables: `sale_details`, `purchase_details`, `journal_lines`
- `fiscal_periods`: `AFTER UPDATE OR DELETE` only (ADR-002)

`accounts_receivable` is NOT audited — confirmed by grep across all migrations.

`action` values: `'CREATE'`, `'UPDATE'`, `'DELETE'`, `'STATUS_CHANGE'` (JSONB-driven: `v_old_json->>'status' IS DISTINCT FROM v_new_json->>'status'`).

`setAuditContext` (`features/shared/audit-context.ts`) is called in:
- `monthly-close.service.ts` — only place that passes a `correlationId`
- `sale.service.ts`, `purchase.service.ts`, `payment.service.ts`, `dispatch.service.ts`, `journal.service.ts` — all call with `(tx, userId, orgId)` only; NO `correlationId`

**Implication**: when a sale is POSTed, audit rows for `sales` (UPDATE/STATUS_CHANGE), `journal_entries` (CREATE), `journal_lines` (CREATE × N) are emitted WITHOUT a `correlationId`. They can only be linked by timestamp proximity + `entityId` chain.

### 1.2 Existing Reads of audit_logs

Two existing consumers:
1. `app/api/organizations/[orgSlug]/monthly-close/audit-trail/route.ts` — GET by `correlationId`, `requirePermission("period","read")`, returns raw rows.
2. `app/(dashboard)/[orgSlug]/accounting/monthly-close/close-event/page.tsx` — RSC, same query, groups by `entityType`, renders as plain `<ul>` with action + timestamp only. No JSONB diff display.

No feature folder exists yet for audit. No `features/audit/` directory.

### 1.3 Permissions Model

Defined in `features/permissions/permissions.ts` and backed by `custom_roles` table via `features/permissions/permissions.cache.ts`.

`Resource` type (`permissions.ts:21-34`) lists: `"members"`, `"accounting-config"`, `"sales"`, `"purchases"`, `"payments"`, `"journal"`, `"dispatches"`, `"reports"`, `"contacts"`, `"farms"`, `"documents"`, `"agent"`, `"period"`. **No `"audit"` resource yet.**

`Action` type: `"read" | "write" | "close" | "reopen"`.

System roles: `owner`, `admin`, `contador`, `cobrador`, `member`. Roles stored in `custom_roles` table per org. The cache (`permissions.cache.ts`) loads `customRole.findMany` and builds a `Map<slug, {permissionsRead, permissionsWrite, canPost, canClose, canReopen}>` per org.

Admin-only resources today: `members` and `accounting-config` are both restricted to `["owner", "admin"]` for read AND write (`permissions.ts:41-73`).

**How a new admin-only resource works**: add `"audit"` to the `Resource` type, add entries in `PERMISSIONS_READ` and `PERMISSIONS_WRITE` restricted to `["owner","admin"]`, then call `requirePermission("audit","read",orgSlug)` in routes. The `ensureOrgSeeded` fallback seeds system roles from these static maps, so new resources are automatically picked up for new orgs.

### 1.4 Existing Read-Only List UI Patterns

The canonical pattern (observed in `sales/page.tsx`, `journal/page.tsx`):
1. RSC page `await params` → `requirePermission(resource, "read", orgSlug)` wrapped in `try/catch { redirect }`.
2. Call service `.list(orgId, filters)` where `filters` come from `searchParams`.
3. Pass `JSON.parse(JSON.stringify(data))` (serialization) to a `"use client"` list component.
4. Client component holds filter state in local `useState`, updates URL via `router.push` with `new URLSearchParams`.

Best example for audit: `journal/page.tsx` + `journal-entry-list.tsx` — it has multi-filter (period, voucherType, status, origin) + URL-driven filter state + per-row actions dropdown.

### 1.5 Raw SQL / JSONB Patterns

Raw SQL is used in `features/accounting/trial-balance/trial-balance.repository.ts:60` and `features/accounting/worksheet/worksheet.repository.ts:105` for aggregation queries using Prisma tagged template literals (`this.db.$queryRaw<T[]>\`...\``).

For the audit module, JSONB filtering (e.g. `newValues->>'sourceType'`) would require `$queryRaw` or Prisma's `JsonNullableFilter` with `path` operator. Prisma 6.x supports JSON `path` filters: `{ newValues: { path: ["sourceType"], not: null } }`. However, for cross-row grouping by parent FK (e.g. `newValues->>'journalEntryId'`), `$queryRaw` is the right tool.

### 1.6 TanStack Table

`@tanstack/react-table ^8.21.3` is installed and used in `components/financial-statements/statement-table.tsx`. It is NOT used in `sale-list.tsx` or `journal-entry-list.tsx` — those use plain `<table>` + `<tr>` with filter state. Either approach is valid; TanStack adds column sorting capability.

---

## Section 2 — Affected Areas

### New files (to create)

```
features/audit/
  audit.types.ts          — AuditLogRow, AuditFilters, VoucherGroup, DiffEntry types
  audit.validation.ts     — auditListQuerySchema (dateFrom, dateTo, entityType, changedById, action)
  audit.repository.ts     — AuditRepository extends BaseRepository; listGrouped(), getVoucherHistory()
  audit.service.ts        — AuditService; thin orchestration, resolves parent display names
  server.ts               — `import "server-only"; export { AuditService } from "./audit.service"`
  index.ts                — re-exports types only (client-safe)

app/api/organizations/[orgSlug]/audit/
  route.ts                — GET /audit?dateFrom&dateTo&entityType&changedById&action&page&limit
  [entityType]/[entityId]/
    route.ts              — GET /audit/:entityType/:entityId (voucher history)

app/(dashboard)/[orgSlug]/audit/
  page.tsx                — RSC list page (admin-only gate)
  [entityType]/[entityId]/
    page.tsx              — RSC detail/history page

components/audit/
  audit-event-list.tsx    — "use client"; list with filters + grouped rows
  audit-detail.tsx        — "use client"; history timeline + diff viewer
  audit-diff-viewer.tsx   — "use client"; side-by-side diff render (whitelisted fields)
```

### Existing files requiring minor changes

```
features/permissions/permissions.ts:21-34   — add "audit" to Resource union
features/permissions/permissions.ts:40-73   — add "audit" to PERMISSIONS_READ/WRITE restricted to ["owner","admin"]
```

No changes needed to schema, triggers, or `setAuditContext`.

---

## Section 3 — Approaches

### A. Grouping-by-Voucher Strategy

The challenge: a single user action (e.g. POST a sale) emits audit rows across `sales`, `journal_entries`, `journal_lines` (N rows). With no `correlationId`, these rows share only:
- `changedById` (same user)
- `createdAt` within milliseconds of each other
- JSONB FK chains: `journal_lines.newValues->>'journalEntryId'` → `journal_entries.entityId`; `sale_details.newValues->>'saleId'` → `sales.entityId`

**A1 — Resolve parent at query time (SQL JOIN/subquery on JSONB keys)**

```sql
SELECT
  al.*,
  COALESCE(
    CASE al."entityType"
      WHEN 'journal_lines' THEN al."newValues"->>'journalEntryId'
      WHEN 'purchase_details' THEN al."newValues"->>'purchaseId'
      WHEN 'sale_details' THEN al."newValues"->>'saleId'
      ELSE al."entityId"
    END,
    al."entityId"
  ) AS parent_id,
  CASE al."entityType"
    WHEN 'journal_lines' THEN 'journal_entries'
    WHEN 'purchase_details' THEN 'purchases'
    WHEN 'sale_details' THEN 'sales'
    ELSE al."entityType"
  END AS parent_type
FROM audit_logs al
WHERE al."organizationId" = $1
  AND al."createdAt" BETWEEN $2 AND $3
ORDER BY al."createdAt" DESC
```

Group in application layer by `(parent_type, parent_id)`. This gives all audit rows per logical voucher.

- Pros: single round trip, all resolution happens in one query, indexes `(organizationId, createdAt)` used.
- Cons: JSONB `->>'key'` extraction in SQL is not index-supported; for old/null rows (DELETE where `newValues` is null) must fall back to `oldValues`. Extra CASE logic for nullability.
- Effort: Medium

**A2 — Broad fetch + group in memory**

Fetch `findMany` with Prisma, group in Node.js. Simpler code, but loads all rows before pagination can be applied, which breaks for large datasets.

- Pros: no raw SQL, easy to read and test.
- Cons: cannot paginate grouped results correctly (page 1 of "voucher groups" ≠ page 1 of raw rows). At 9× volume post-b0bf088 this becomes a problem.
- Effort: Low (but wrong at scale)

**A3 — Materialized view or denormalized column**

Add `parentEntityType` + `parentEntityId` columns (or a computed MV) populated by a separate migration or application write.

- Pros: fast indexed queries, no JSONB parsing.
- Cons: schema change (explicitly out of scope), requires backfill, adds complexity.
- Effort: High

**Recommendation A**: A1. Single `$queryRaw` with CASE-based parent resolution. Pagination is applied at the SQL level (`LIMIT/OFFSET`). The JSONB extraction is in the SELECT (not WHERE), so it doesn't block index use on `(organizationId, createdAt)`.

---

### B. Permissions Gate

**B1 — Clerk org role check (admin vs member)**

Bypass the matrix entirely; check `session.orgRole === 'admin' | 'owner'` via Clerk's JWT claims.

- Pros: zero code change to permissions system.
- Cons: diverges from the project's RBAC pattern; custom roles (cobrador, contador) can't be granted audit access later without code change; inconsistent with every other resource in the project.
- Effort: Low

**B2 — Custom role matrix key (`"audit"` resource)**

Add `"audit"` to `Resource` in `permissions.ts`. Seed in `PERMISSIONS_READ: { audit: ["owner","admin"] }`. Call `requirePermission("audit","read",orgSlug)`.

- Pros: fully consistent with the project's RBAC; future expansion (e.g. grant `contador` read access) is a seed/migration, not a code change; `ensureOrgSeeded` picks it up automatically for new orgs.
- Cons: existing orgs need their `custom_roles` rows updated (seeding is idempotent, but adding a new resource to an existing org's permission set requires a migration or re-seed).
- Effort: Low-Medium (need a data migration to add `"audit"` to `permissionsRead` for `owner` and `admin` rows)

**B3 — Hybrid: Clerk role for MVP, matrix key planned**

Gate on Clerk org role now, document the upgrade path.

- Pros: fastest to ship.
- Cons: creates tech debt and two code paths.
- Effort: Low

**Recommendation B**: B2. The matrix approach is the project's established pattern. Adding `"audit"` to `Resource` and seeding defaults is a one-time, low-risk change. The `ensureOrgSeeded` fallback handles new orgs. Existing orgs need a data migration that adds `"audit"` to `permissionsRead` for `owner` and `admin` `custom_roles` rows.

---

### C. UI Architecture

**C1 — Pure RSC with Prisma inline**

Like `close-event/page.tsx` today: RSC fetches from Prisma directly, renders HTML, no client component needed.

- Pros: simplest, no hydration, fast TTFB.
- Cons: no interactivity — filter changes require full navigation. No expandable diff viewer. OK for a plain list; bad for a diff viewer that toggles field visibility.
- Effort: Low

**C2 — Full client components + fetch from API**

Like `sale-list.tsx`: RSC page passes initial data; `"use client"` component holds all filter state, re-fetches on change.

- Pros: responsive filters, diff toggles.
- Cons: doubles data fetch (initial + re-fetch), more boilerplate.
- Effort: Medium

**C3 — Hybrid: RSC for list, client for diff viewer**

List page is RSC (reads data on server, passes to client shell for filter UI). Detail page has an RSC outer shell + a client `AuditDiffViewer` component for interactive diff rendering (expand/collapse fields).

- Pros: matches the `journal/page.tsx` + `JournalEntryList` split already used in the project. Best perf/interactivity balance.
- Cons: slightly more files.
- Effort: Medium

**Recommendation C**: C3. Mirrors the established pattern exactly.

---

### D. JSONB Diff Rendering

`oldValues` and `newValues` are full `to_jsonb(ROW)` snapshots — they include ALL columns of the entity row, including internal fields (`id`, `organizationId`, `createdAt`, `updatedAt`, FK ids). Rendering everything is noisy.

**D1 — Recursive diff on entire JSONB blob**

Compute `Object.keys(newValues).reduce(...)` comparing old/new for every key.

- Pros: zero maintenance, catches all changes.
- Cons: extremely noisy for users (e.g. `updatedAt` always differs). Not user-readable.
- Effort: Low

**D2 — Whitelist of relevant fields per entityType**

Define a config map:
```ts
const DIFF_FIELDS: Record<string, string[]> = {
  sales:            ["status", "total", "date", "contactId", "description"],
  purchases:        ["status", "total", "date", "contactId", "description"],
  journal_entries:  ["status", "date", "description", "number"],
  journal_lines:    ["debit", "credit", "accountId"],
  sale_details:     ["quantity", "unitPrice", "total", "productTypeId"],
  purchase_details: ["quantity", "unitPrice", "total", "productTypeId"],
  payments:         ["status", "amount", "date", "type"],
  dispatches:       ["status", "date", "description"],
  fiscal_periods:   ["status", "name"],
};
```

Render only whitelisted fields, label with Spanish names.

- Pros: clean, user-focused display; labels can be in Spanish.
- Cons: requires upfront definition per table; fields added to schema in future won't appear until DIFF_FIELDS is updated.
- Effort: Medium (one-time config, then zero maintenance if schema is stable)

**D3 — Third-party library (jsondiffpatch, etc.)**

- Pros: handles nested diffs, arrays, visual formatting out of box.
- Cons: no such library installed today; adds a dependency; still produces noisy output without whitelisting; JSONB blobs have no stable schema annotation.
- Effort: Low (install) + Medium (integrate) + High (noise reduction)

**Recommendation D**: D2. The project's Bolivian accounting domain has stable, known fields. A whitelist is the correct professional-UI approach. The config object lives in `audit.types.ts` and can be extended.

---

## Section 4 — Recommendation

**Combined path: A1 + B2 + C3 + D2**

- **A1** (SQL CASE-based parent resolution): single `$queryRaw` with `COALESCE(newValues->>'parentFK', oldValues->>'parentFK')` handles both INSERT (newValues) and DELETE (oldValues). Pagination applied in SQL.
- **B2** (matrix resource `"audit"`): adds `"audit"` to `Resource`, seeds `["owner","admin"]` for read, consistent with every other resource. A small data migration updates existing org custom_roles rows.
- **C3** (RSC list + client diff viewer): mirrors `journal/page.tsx` + `JournalEntryList`. The diff viewer (`AuditDiffViewer`) is a client component that receives pre-serialized `oldValues`/`newValues` and renders the whitelisted diff.
- **D2** (whitelist per entityType): user-facing diff is filtered to ~5 business fields per table, labeled in Spanish. The config is a static map in `audit.types.ts`.

This combination uses NO new dependencies, NO schema changes, NO new data logic — it adds a feature folder + UI on top of the existing audit infrastructure exactly the way every other feature in this project is structured.

---

## Section 5 — Risks

### R1 — Performance: JSONB extraction + volume — DECISIONES CERRADAS

Post-b0bf088, cada mutación de cabecera emite 1 fila cabecera + N filas detalle. Una venta con 5 líneas emite ~6 filas por operación. Con operaciones frecuentes, `audit_logs` crece ~6-9× más rápido que pre-b0bf088.

**Decisiones acordadas**:

| Dimensión | Decisión |
|-----------|----------|
| **Rango default al entrar** | Mes en curso (alineado con el período fiscal: `date >= startOfMonth(today)`, `date <= endOfMonth(today)`) |
| **Paginación** | Cursor-based (cursor por `createdAt` + `id` para desempate estable) |
| **Tamaño de página** | 50 filas |
| **Filtros MVP** | `dateFrom`/`dateTo` (obligatorio, default mes en curso) · `entityType` · `changedById` · `action` |

**Índices existentes** (schema.prisma:948-950):
- `[organizationId, entityType, entityId]`
- `[organizationId, createdAt]` — cubre el caso default (lista por rango de fechas)
- `[correlationId]`

**Índices nuevos a agregar en la migration del módulo**:

```prisma
@@index([organizationId, entityType, createdAt])   // lista filtrada por tipo de entidad
@@index([organizationId, changedById, createdAt])  // lista filtrada por usuario
```

El btree de Postgres es bidireccional, no hace falta `DESC` explícito. Ambos cubren filtros con `ORDER BY createdAt DESC` y paginación cursor-based. Estimación de espacio: ~50 bytes/fila × volumen proyectado — manejable.

**Nota de naming**: los campos reales son `entityType` (no `tableName`) y `changedById` (no `userId`). Los triggers setean `entityType = TG_TABLE_NAME` y `changedById = current_setting('app.current_user_id')`.

**Sobre el JSONB extraction** (A1 grouping query): `newValues->>'journalEntryId'` vive en la cláusula SELECT, no en el WHERE. Postgres filtra primero por `createdAt` range (usando el índice) y después evalúa el `COALESCE` del SELECT contra el subset ya reducido. No requiere índice GIN sobre JSONB para el MVP.

### R2 — JSONB size per row

`to_jsonb(ROW)` on a `journal_entries` row includes ~15-20 columns (including the `referenceNumber`, `voucherTypeId`, FK ids). On `journal_lines` it includes `debit`, `credit`, `accountId`, FK columns. Estimated size per row: 300-800 bytes. At 10,000 monthly transactions × 6 rows/tx = 60,000 rows/month × 600 bytes average = ~36 MB/month. Manageable; no partitioning needed for MVP.

**Note**: `oldValues` for INSERT rows and `newValues` for DELETE rows are NULL (by trigger design), halving storage for CREATE/DELETE events.

### R3 — Grouping correctness: detail before header

Postgres triggers fire in row-insertion order within a transaction. For a `sale.service.ts` POST operation, the typical order is:
1. `journal_entries` INSERT → `journal_lines` INSERT × N → `sales` UPDATE (status to POSTED).

So detail audit rows may have `createdAt` values equal to or slightly earlier than the header's `STATUS_CHANGE` row. Within the same millisecond, ordering is non-deterministic.

**This does NOT break grouping** because grouping is by `(parent_type, parent_id)` computed from the JSONB FK, NOT by timestamp. All rows for a given sale already share the same parent FK chain regardless of insertion order. Timeline display on the detail page should order by `createdAt ASC` with tiebreak on `id` (cuid, lexicographically ordered by insertion).

### R4 — directa vs indirecta: heurística cerrada

Heurística definitiva, sin zona gris:

| entityType | Condición | Clasificación |
|------------|-----------|---------------|
| `sales`, `purchases`, `payments`, `dispatches` | (cualquiera) | **directa** |
| `journal_entries` | `sourceType IS NULL` | **directa** (asiento manual) |
| `journal_entries` | `sourceType IS NOT NULL` | **indirecta** (reflejo de un documento de dominio que lo originó) |
| `sale_details`, `purchase_details`, `journal_lines` | depende del padre | **hereda del padre** |

**Herencia para líneas**: una `journal_line` cuyo padre `journal_entry` es MANUAL es **directa** (edición directa de un asiento manual). Una `journal_line` cuyo padre es SYSTEM-generated es **indirecta**. La herencia se resuelve buscando el padre vía el JSONB FK:

- `sale_details.newValues->>'saleId'` → lookup a `sales` (siempre directa, por tabla).
- `purchase_details.newValues->>'purchaseId'` → lookup a `purchases` (siempre directa, por tabla).
- `journal_lines.newValues->>'journalEntryId'` → lookup al JE padre y aplicar la regla de `sourceType`.

**Implementación**: resolver al render time en la query de la UI. El repository puede hacer el lookup con un `LEFT JOIN` lateral o un subquery que traiga `parent_sourceType` como columna calculada. Ver Approach A1 en §Section 3 para el query pattern concreto.

**Por qué no usar `newValues->>'sourceType'` directamente para JE manuales**: una columna nullable en Postgres se serializa como `null` JSON (no como ausencia de key). `->>` devuelve el string `"null"` o SQL `NULL` según la variante de Postgres — inconsistente entre versiones. La resolución por `sourceType IS NULL` en la tabla real (no en el JSONB snapshot) es más robusta y barata.

### R5 — Permissions org-scoped — DECISIONES CERRADAS

MVP gates on `requirePermission("audit","read")` = `["owner","admin"]`. El módulo depende de dos mecanismos del proyecto:

**1. Tenant scoping por convención (no middleware)**

`features/shared/base.repository.ts:7-13` expone `requireOrg(organizationId)` que devuelve un objeto spread-able. **No intercepta queries** — cada método del repository tiene que invocarlo manualmente. Ejemplo canónico en `sale.repository.ts:117-127`:

```typescript
async findById(organizationId: string, id: string, tx?) {
  const scope = this.requireOrg(organizationId);
  return db.sale.findFirst({ where: { id, ...scope }, include });
}
```

Si el developer se olvida del spread, **el query corre sin filtro y hay tenant leak**. Riesgo conocido documentado en session previa: *"Tenant scope es por disciplina, no invariante DB. RLS + Prisma middleware lo convertiría en invariante (Approach D en arquitectura-escalable)"*. Fuera de scope de este módulo — se atiende a nivel sistema en otro change.

**2. Seeding dinámico vs. roles ya populados**

`prisma/seed-system-roles.ts:27-29` lee `PERMISSIONS_READ` **dinámicamente** cuando construye payloads:

```typescript
const permissionsRead = (Object.keys(PERMISSIONS_READ) as Resource[]).filter(
  (resource) => PERMISSIONS_READ[resource].includes(slug),
);
```

| Caso | Efecto de agregar `"audit"` al matrix |
|------|---------------------------------------|
| **Orgs nuevas post-deploy** | ✅ Automático — `buildSystemRolePayloads` lo incluye al seedear. |
| **Orgs existentes** | ❌ No-op — `ensureOrgSeeded` solo seedea si `roles.size === 0` (`permissions.cache.ts:194`) y `createMany({skipDuplicates:true})` no actualiza filas existentes. |

**Consecuencia**: requiere **data migration obligatoria** para orgs existentes. SQL sugerido (pendiente confirmar tipo `permissionsRead` con `\d custom_roles` — `jsonb` esperado):

```sql
UPDATE custom_roles
SET "permissionsRead" = "permissionsRead" || '["audit"]'::jsonb
WHERE slug IN ('owner', 'admin')
  AND NOT ("permissionsRead" @> '"audit"'::jsonb);
```

**Deploy atómico — obligatorio**: la migration de datos + el deploy del código con `"audit"` en el matrix + las APIs/UI nuevas deben ir **juntos** en el mismo deploy. Prisma migrate corre antes de que el server arranque con el código nuevo, garantizando atomicidad. Si se desacoplaran, habría una ventana donde `requirePermission("audit","read")` daría 403 espurios para orgs existentes (los roles aún no tienen `"audit"` en `permissionsRead`).

### R6 — Precauciones extra de tenant isolation (específicas para este módulo)

Porque este módulo **va a usar `$queryRaw` por el JOIN lateral** (approach A1), y porque el tenant scoping del proyecto es por disciplina (no invariante DB), se agregan dos blindajes específicos para el módulo. No resuelven el tema sistémico — eso queda para `arquitectura-escalable` (RLS + Prisma middleware).

**Requisito 1 — Tests explícitos de tenant isolation**

Tests de feature-boundaries del módulo (junto a los REQ-FMB existentes) que validen:

a) **Isolation cross-org**: dado audits de org A y org B, un usuario autenticado como miembro de A **solo ve audits de A**. Verificar en test de integración (con fixture de 2 orgs y ≥1 audit row en cada una) que `GET /api/organizations/{orgA}/audit` no devuelve filas de B y viceversa. Cubrir tanto la lista como el detail endpoint.

b) **Invariante sobre raw queries**: auditar el código del `AuditRepository` para confirmar que **`organizationId` aparece hardcodeado en el WHERE server-side** de toda query raw. El valor **nunca** viene del input del usuario sin pasar por `requireOrg()` del scope del request. Un test estático (grep o AST-walk en la suite de boundaries) puede validar que toda invocación de `$queryRaw`/`$queryRawUnsafe` dentro de `features/audit/` recibe `organizationId` como parámetro bound.

**Requisito 2 — Wrapper de `$queryRaw` interno al módulo**

Agregar al `AuditRepository` (o a un helper privado de `features/audit/`) un wrapper que fuerce pasar `organizationId` explícitamente y llame a `requireOrg()` internamente antes de ejecutar la query raw. Firma sugerida:

```typescript
// features/audit/audit.repository.ts
protected async scopedQueryRaw<T>(
  organizationId: string,
  template: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const scope = this.requireOrg(organizationId);
  // Inject scope.organizationId as first bound param; template must reference it as $1.
  return this.db.$queryRaw<T[]>(template, scope.organizationId, ...values);
}
```

Todo método del repository que requiera raw SQL (A1 grouping query, el JOIN lateral para resolver `parent_sourceType`, etc.) **debe** usar este wrapper. El wrapper hace imposible (dentro del módulo) ejecutar un `$queryRaw` sin pasar `organizationId` explícitamente — blinda al developer ante olvidos.

Este wrapper **no pretende resolver el tema sistémico**. No es RLS, no es un middleware global. Solo protege **este módulo** que es el único que va a abusar de raw queries. Otros features siguen con el patrón actual (requireOrg + Prisma Client, sin wrappers especiales).

---

## Section 6 — Ready for Proposal

**Yes.** Las dos preguntas técnicas pendientes quedaron cerradas:

- **Paginación / performance**: mes en curso default, cursor-based, 50 filas, 2 índices nuevos `[organizationId, entityType, createdAt]` + `[organizationId, changedById, createdAt]` a agregar en la migration del módulo (R1).
- **Permisos org-scoped**: `requireOrg` por convención + data migration obligatoria para orgs existentes + deploy atómico (migration de datos + código juntos). Tenant isolation reforzado con tests explícitos + wrapper de `$queryRaw` interno al módulo (R5 + R6).

El módulo agrega `features/audit/` + 2 API routes + 2 UI pages + 1 data migration + 2 índices, con una mutación aditiva al matrix de permissions. Sin cambios de schema, sin dependencias nuevas. La decisión no-trivial sigue siendo la grouping strategy (A1 con date range filter obligatorio y la heurística directa/indirecta cerrada en R4).

---

## Appendix: Concrete Question Answers

**Q1 — Is there an `audit.read` or `admin.*` in the permissions system today?**
No. `Resource` has 13 entries; `"audit"` is not among them. Admin is expressed via `PERMISSIONS_READ["members"] = ["owner","admin"]` etc. No wildcard glob support.

**Q2 — Pattern for admin-only API route?**
`requirePermission("members","read",orgSlug)` at `app/api/organizations/[orgSlug]/members/route.ts:14-16`. Wrap in try/catch, return `handleError(error)`. The `"members"` resource seeds to `["owner","admin"]` for read.

**Q3 — Reusable data grid with filters+pagination?**
No dedicated reusable DataTable component. Each feature has its own list component. `JournalEntryList` (`components/accounting/journal-entry-list.tsx`) is the most complete example: URL-driven filters, plain HTML `<table>`, client-side filter state. `@tanstack/react-table` is available but only used in `statement-table.tsx` for hierarchical tree rendering.

**Q4 — Any existing place that reads `audit_logs` today?**
Two places (both monthly-close-specific):
- `app/api/organizations/[orgSlug]/monthly-close/audit-trail/route.ts:23`
- `app/(dashboard)/[orgSlug]/accounting/monthly-close/close-event/page.tsx:55`
No feature folder; both query Prisma directly without a repository layer.

**Q5 — Minimum viable filter set for list view?**
Propose: `dateFrom` (required, default today-30d), `dateTo` (default today), `entityType` (optional, multi-select of the 9 audited tables), `changedById` (optional, select from org members), `action` (optional: CREATE/UPDATE/DELETE/STATUS_CHANGE). Skip `correlationId` as a user-facing filter for MVP — it's a technical identifier.

**Q6 — "Sale was POSTed" — how to group all emitted rows?**
Without `correlationId` on sale/purchase/journal operations, the heuristic for MVP:
- **Detail-to-parent resolution** via JSONB FK (A1): `sale_details` rows link to `sales.entityId`; `journal_lines` rows link to `journal_entries.entityId`; the JE itself links to the sale via `journal_entries.newValues->>'sourceId'` (or via the live `sales` table if needed).
- **For the LIST view**: group by resolved `(parent_type, parent_id)` — each "card" represents one voucher with a badge showing the latest action.
- **For the DETAIL view**: show ALL audit rows for the voucher, ordered by `createdAt ASC`, including detail-table rows, so the user can trace field-level changes.

`correlationId` would allow grouping the JE + sale rows as a single logical event, but since it's not set today for sale/purchase operations, the MVP must rely on the FK chain. The JE linked to a sale always has `sourceId = sale.id` in `newValues`, so the join is `journal_entries.newValues->>'sourceId' = sales.entityId`. This is a JSONB lookup in the detail view — acceptable for per-voucher queries.

**Note on correlationId extension**: extending `setAuditContext` to pass a `correlationId` in `sale.service.ts`, `purchase.service.ts`, etc. would collapse all audit rows from one POST into a single `correlationId` group, enabling instant list-view grouping without JSONB FK traversal. This is the clean long-term solution but is explicitly deferred to a follow-up change per scope agreement.

---

## File Locations Summary

| Path | Role |
|------|------|
| `prisma/schema.prisma:934-952` | AuditLog model |
| `prisma/migrations/20260424123854_audit_insert_coverage_completion/migration.sql` | Trigger definitions |
| `features/shared/audit-context.ts` | setAuditContext helper |
| `features/permissions/permissions.ts:21-34` | Resource type (needs `"audit"`) |
| `features/permissions/permissions.ts:40-73` | PERMISSIONS_READ/WRITE (needs `"audit"`) |
| `features/permissions/permissions.server.ts` | requirePermission gate |
| `features/permissions/permissions.cache.ts` | Matrix cache + ensureOrgSeeded |
| `app/(dashboard)/[orgSlug]/accounting/monthly-close/close-event/page.tsx` | Existing audit RSC pattern |
| `app/api/organizations/[orgSlug]/monthly-close/audit-trail/route.ts` | Existing audit API pattern |
| `components/accounting/journal-entry-list.tsx` | Filter+list UI pattern to mirror |
| `app/(dashboard)/[orgSlug]/accounting/journal/page.tsx` | RSC page pattern to mirror |
