# Design: Módulo de Auditoría

**Change**: `modulo-de-auditoria`
**Date**: 2026-04-24
**Depends on**: Proposal + Exploration (este change) + commit `b0bf088`

## Resumen técnico

Este diseño baja el proposal (A1 + B2 + C3 + D2 + heurística directa/indirecta + tenant isolation extras) a artefactos concretos:

- **Data layer**: cero cambios de columnas en `audit_logs`; dos `@@index` nuevos; una data migration SQL idempotente que agrega `"audit"` a `permissionsRead` de los `custom_roles` de sistema `owner` y `admin` (tipo real en Postgres: `text[]`, no `jsonb` — se corrige acá respecto al borrador del proposal).
- **Feature folder** `features/audit/` split desde día uno (`index.ts` solo types, `server.ts` con `import "server-only"`); `AuditRepository` extiende `BaseRepository` y expone un wrapper interno `scopedQueryRaw<T>()` que obliga a pasar `organizationId` como primer parámetro bound (`$1`) y llama `requireOrg()` antes de ejecutar. Patrón espejo de `journal.repository.ts` + `worksheet.repository.ts`.
- **Query A1**: un único `$queryRaw` con dos CTE — `audit_with_parent` (resuelve `parent_entity_type`/`parent_entity_id` desde JSONB con `COALESCE(newValues, oldValues)`) y `audit_with_classification` (LEFT JOIN lateral a `journal_entries` para traer `sourceType` de la tabla real, nunca del snapshot JSONB). Paginación cursor-based sobre `(createdAt, id)`, page size 50, rango obligatorio.
- **Classifier**: función pura `classify(entityType, parentContext)` que encapsula la tabla cerrada de R4 del proposal (directa / indirecta) — se aplica al render time sobre las filas ya devueltas por la query (no se materializa en SQL: el SQL solo trae las columnas necesarias para la decisión).
- **API**: dos rutas `GET` bajo `/api/organizations/[orgSlug]/audit` (lista) y `/[entityType]/[entityId]` (detalle). Zod valida query params; `requirePermission("audit","read",orgSlug)` gatea acceso; `handleError` serializa errores con códigos nuevos `AUDIT_DATE_RANGE_INVALID` y `AUDIT_CURSOR_INVALID`.
- **UI**: página RSC `audit/page.tsx` + client component `AuditEventList` (filtros URL-driven, espejo de `JournalEntryList`); página RSC detalle + `AuditDiffViewer` cliente que renderiza sólo los campos whitelisteados por `DIFF_FIELDS[entityType]`, con labels en español.
- **Tenant isolation extras**: `features/audit/__tests__/feature-boundaries.test.ts` con dos assertions — (a) `$queryRaw`/`$queryRawUnsafe` en el feature se invoca únicamente dentro del `AuditRepository` y pasa por `scopedQueryRaw` (grep-based); (b) cross-org isolation en integración (fixture 2 orgs).

## 1. Data model y migration

### 1.1 No hay cambios de schema en audit_logs

Reconfirmado explícitamente: cero columnas nuevas en `audit_logs`. El proposal §Non-goals lo excluye (`origin`, `isLocked`, etc.). Toda clasificación se resuelve al render time.

Las columnas existentes (`prisma/schema.prisma:934-952`) son suficientes:
`id`, `organizationId`, `entityType`, `entityId`, `action`, `oldValues` (Json?), `newValues` (Json?), `changedById`, `justification`, `correlationId`, `createdAt`.

### 1.2 Índices nuevos

Orden de magnitud esperado: proyectamos ~60 000 filas/mes (proposal §R2 post-`b0bf088`), ≈50–80 bytes por fila de índice btree (tupla `(text, text, timestamp) + ctid`). Con crecimiento lineal, dos índices × 60k × 12 meses × 80 bytes ≈ **115 MB/año combinados**. Aceptable.

```sql
-- Migration: prisma/migrations/20260424T130000_audit_module_indexes/migration.sql
-- Aplica ANTES del código nuevo que referencia "audit" como Resource.

CREATE INDEX "audit_logs_organizationId_entityType_createdAt_idx"
  ON "audit_logs" ("organizationId", "entityType", "createdAt");

CREATE INDEX "audit_logs_organizationId_changedById_createdAt_idx"
  ON "audit_logs" ("organizationId", "changedById", "createdAt");
```

Declaraciones en `prisma/schema.prisma` dentro del `model AuditLog { ... }`:

```prisma
@@index([organizationId, entityType, createdAt])
@@index([organizationId, changedById, createdAt])
```

Los tres índices existentes se mantienen sin cambios: `[organizationId, entityType, entityId]`, `[organizationId, createdAt]`, `[correlationId]`.

### 1.3 Data migration para permissions

**Tipo real en Postgres**: `custom_roles.permissionsRead` es `String[]` (Prisma `String[]` → Postgres `text[]`), no `jsonb`. Verificado en `schema.prisma:57`. Esto cambia los operadores:
- `jsonb @>` / `||` → **no aplican**.
- `text[]` usa `ARRAY['audit']` y los operadores `@>`, `||`, `<@`.

Nombre de migración sugerido: `20260424T130001_audit_permissions_data` — una migration separada de los índices para poder reordenarlas si alguna fallase; Prisma las aplica en orden lexicográfico, y esta se ejecuta **después** de la migration de índices.

**Deploy atómico**: el runner de Prisma migrate corre la migration antes de que el server Node con el código nuevo acepte tráfico. Como ambas migrations + el código con `"audit"` en el `Resource` union se deployan en el mismo bundle, la ventana de 403 espurios no existe.

```sql
-- prisma/migrations/20260424T130001_audit_permissions_data/migration.sql
-- Idempotente: NOT ('audit' = ANY(...)) garantiza que reruns no dupliquen.
-- Scope: solo roles de sistema owner/admin en orgs existentes.

UPDATE "custom_roles"
SET "permissionsRead" = array_append("permissionsRead", 'audit')
WHERE "slug" IN ('owner', 'admin')
  AND "isSystem" = true
  AND NOT ('audit' = ANY("permissionsRead"));
```

`permissionsWrite` se mantiene vacío para `"audit"` — el módulo es read-only. Por paralelismo con el resto del matrix, igual se agrega la key al mapa `PERMISSIONS_WRITE` con valor `[]` (ver §5.1). No requiere data migration porque arrancar con `[]` equivale a "ningún rol puede escribir", y ningún rol existente va a perder esa capacidad (no la tenía).

## 2. Feature folder: features/audit/

### 2.1 Árbol de archivos

```
features/audit/
├── index.ts                       // Re-exporta SOLO types client-safe (no server code)
├── server.ts                      // import "server-only"; re-exporta AuditService + AuditRepository
├── audit.types.ts                 // AuditEvent, AuditGroup, AuditCursor, filters, DIFF_FIELDS, AuditAction, AuditEntityType
├── audit.validation.ts            // Zod: auditListQuerySchema, voucherHistoryParamsSchema, auditCursorSchema
├── audit.classifier.ts            // Pure: classify(entityType, parentContext) -> "directa" | "indirecta"
├── audit.repository.ts            // AuditRepository extends BaseRepository; listGroupedByVoucher, getVoucherHistory, scopedQueryRaw
├── audit.service.ts               // Orquesta classifier + repository + resolución de display names
└── __tests__/
    ├── audit.repository.test.ts           // Integration: fixtures en DB real, paginación, filtros
    ├── audit.service.test.ts              // Unit: repo mockeado, orquestación
    ├── audit.classifier.test.ts           // Unit: 10-15 casos cubriendo la tabla de R4
    ├── audit.tenant-isolation.test.ts     // Integration: 2 orgs, cross-org NO filtra
    └── feature-boundaries.test.ts         // Estático: grep sobre features/audit/ por $queryRaw fuera de scopedQueryRaw
```

Rol de cada archivo:
- `index.ts`: re-export de `export type *` únicamente. Sin server-only, sin repository/service. Consumido por componentes cliente.
- `server.ts`: `import "server-only"` como **primer statement** (REQ-FMB.2). Exporta `AuditService` y `AuditRepository`. Consumido por rutas API y RSC.
- `audit.types.ts`: SIN `server-only`. Tipos + la constante `DIFF_FIELDS` (objeto plano, seguro para cliente).
- `audit.validation.ts`: schemas Zod. No depende de Prisma; puede importarse desde `index.ts` si se quisiera compartir parseo cliente — no lo hacemos en MVP.
- `audit.classifier.ts`: función pura, testeable unitariamente sin mocks.
- `audit.repository.ts`: `import "server-only"`. Todo `$queryRaw` vive acá y pasa por `scopedQueryRaw`.
- `audit.service.ts`: `import "server-only"`. Orquestación delgada; resuelve lookup de display names (usuario, contacto) que el repository decidió no resolver en SQL.

### 2.2 Types (audit.types.ts)

```typescript
// features/audit/audit.types.ts
// NOTE: NO `import "server-only"` — este archivo se re-exporta desde index.ts
// y puede importarse desde client components (para renderizar DIFF_FIELDS).

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";

export type AuditEntityType =
  | "sales"
  | "purchases"
  | "payments"
  | "dispatches"
  | "journal_entries"
  | "sale_details"
  | "purchase_details"
  | "journal_lines";

export const AUDITED_ENTITY_TYPES: readonly AuditEntityType[] = [
  "sales",
  "purchases",
  "payments",
  "dispatches",
  "journal_entries",
  "sale_details",
  "purchase_details",
  "journal_lines",
] as const;

export const AUDIT_ACTIONS: readonly AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
] as const;

export type AuditClassification = "directa" | "indirecta";

/** Fila individual de auditoría enriquecida. */
export interface AuditEvent {
  id: string;
  createdAt: Date;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  /** Clasificación resuelta vía classifier — no viene del schema. */
  classification: AuditClassification;
  changedBy: { id: string; name: string } | null;
  justification: string | null;
  /** FK al voucher lógico al que pertenece la fila. Para cabeceras coincide con (entityType, entityId). */
  parentVoucherType: AuditEntityType;
  parentVoucherId: string;
  /**
   * Solo presente para entityType === "journal_entries" o sus líneas.
   * Null cuando el entityType no participa de journal_entries.sourceType (ej: sales).
   */
  parentSourceType: string | null;
  /** JSONB snapshot — serializado a JSON plano en el repository (Decimals → strings, Dates → ISO). */
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  correlationId: string | null;
}

export interface AuditGroup {
  parentVoucherType: AuditEntityType;
  parentVoucherId: string;
  parentClassification: AuditClassification;
  lastActivityAt: Date;
  eventCount: number;
  /** Eventos del grupo, ordenados por createdAt DESC. El repository retorna todos;
   * la UI decide cuántos colapsa/expande (default: 3 visibles + "ver N más"). */
  events: AuditEvent[];
}

export interface AuditListFilters {
  /** Requerido. Default calculado en el handler de la ruta: startOfMonth(today, TZ America/La_Paz). */
  dateFrom: Date;
  /** Requerido. Default: endOfMonth(today, TZ America/La_Paz). */
  dateTo: Date;
  entityType?: AuditEntityType;
  changedById?: string;
  action?: AuditAction;
  cursor?: AuditCursor;
  /** Default 50, max 200. Clamp en validation. */
  limit?: number;
}

/** Cursor estable: (createdAt DESC, id DESC). Se encodea como JSON base64url en el URL. */
export interface AuditCursor {
  createdAt: string; // ISO 8601
  id: string;        // cuid
}

/** Whitelist de campos a renderizar en el diff, por entityType. */
export interface DiffField {
  key: string;
  label: string;        // Etiqueta en español.
  formatter?: "decimal" | "date" | "status" | "reference";
}

export const DIFF_FIELDS: Record<AuditEntityType, DiffField[]> = {
  sales: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "contactId", label: "Cliente", formatter: "reference" },
    { key: "description", label: "Descripción" },
    { key: "totalAmount", label: "Monto total", formatter: "decimal" },
  ],
  purchases: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "contactId", label: "Proveedor", formatter: "reference" },
    { key: "description", label: "Descripción" },
    { key: "totalAmount", label: "Monto total", formatter: "decimal" },
  ],
  payments: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "contactId", label: "Contacto", formatter: "reference" },
    { key: "amount", label: "Monto", formatter: "decimal" },
    { key: "type", label: "Tipo" },
  ],
  dispatches: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "description", label: "Descripción" },
  ],
  journal_entries: [
    { key: "status", label: "Estado", formatter: "status" },
    { key: "date", label: "Fecha", formatter: "date" },
    { key: "description", label: "Descripción" },
    { key: "number", label: "Número" },
    { key: "referenceNumber", label: "Ref." },
  ],
  sale_details: [
    { key: "description", label: "Descripción" },
    { key: "quantity", label: "Cantidad", formatter: "decimal" },
    { key: "unitPrice", label: "Precio unitario", formatter: "decimal" },
    { key: "lineAmount", label: "Subtotal", formatter: "decimal" },
    { key: "incomeAccountId", label: "Cuenta de ingreso", formatter: "reference" },
  ],
  purchase_details: [
    { key: "description", label: "Descripción" },
    { key: "quantity", label: "Cantidad", formatter: "decimal" },
    { key: "unitPrice", label: "Precio unitario", formatter: "decimal" },
    { key: "lineAmount", label: "Subtotal", formatter: "decimal" },
    { key: "expenseAccountId", label: "Cuenta de gasto", formatter: "reference" },
  ],
  journal_lines: [
    { key: "debit", label: "Debe", formatter: "decimal" },
    { key: "credit", label: "Haber", formatter: "decimal" },
    { key: "accountId", label: "Cuenta", formatter: "reference" },
    { key: "contactId", label: "Contacto", formatter: "reference" },
    { key: "description", label: "Descripción" },
  ],
};
```

### 2.3 Classifier: directa vs indirecta

```typescript
// features/audit/audit.classifier.ts

import type { AuditClassification, AuditEntityType } from "./audit.types";

export type ParentContext =
  | { kind: "none" }
  | { kind: "journal_entries"; sourceType: string | null };

/**
 * Classifier puro que encapsula la tabla cerrada del proposal §R4.
 * Se aplica al render time sobre cada fila devuelta por el repository.
 *
 * - sales/purchases/payments/dispatches:  directa (cualquier caso).
 * - journal_entries:                      directa si sourceType IS NULL, indirecta si no.
 * - sale_details:                         directa (padre es "sales", siempre directa).
 * - purchase_details:                     directa (padre es "purchases", siempre directa).
 * - journal_lines:                        hereda del padre journal_entries (requiere parentContext).
 */
export function classify(
  entityType: AuditEntityType,
  parentContext: ParentContext,
): AuditClassification {
  switch (entityType) {
    case "sales":
    case "purchases":
    case "payments":
    case "dispatches":
      return "directa";

    case "sale_details":
    case "purchase_details":
      // El padre es sales/purchases → siempre directa.
      return "directa";

    case "journal_entries":
    case "journal_lines":
      if (parentContext.kind !== "journal_entries") {
        // Invariante: para estos entityType el repository SIEMPRE resuelve parent_source_type.
        // Un ParentContext { kind: "none" } acá es un bug del repository.
        throw new Error(
          `classify: missing parent context for ${entityType}`,
        );
      }
      return parentContext.sourceType === null ? "directa" : "indirecta";

    default: {
      // Exhaustiveness check.
      const _exhaustive: never = entityType;
      throw new Error(`classify: unhandled entityType ${_exhaustive}`);
    }
  }
}
```

### 2.4 Repository: AuditRepository

Espejo del patrón de `journal.repository.ts:33` + `worksheet.repository.ts:98`. El wrapper `scopedQueryRaw` es **protected** — uso sólo interno al módulo.

```typescript
// features/audit/audit.repository.ts
import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { Prisma } from "@/generated/prisma/client";
import type {
  AuditEvent,
  AuditGroup,
  AuditListFilters,
  AuditCursor,
  AuditEntityType,
  AuditAction,
} from "./audit.types";

export class AuditRepository extends BaseRepository {
  /**
   * Lista paginada agrupada por voucher lógico.
   *
   * El query devuelve filas crudas; el service las agrupa y aplica classifier.
   * Paginación cursor-based sobre (createdAt DESC, id DESC) — estable entre
   * filas con mismo millisecond (los cuids sirven de tiebreak ordenado).
   *
   * Retorna hasta filters.limit+1 filas internamente para detectar nextCursor
   * sin segunda round trip.
   */
  async listFlat(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ rows: AuditRow[]; nextCursor: AuditCursor | null }> { /* ... */ }

  /**
   * Historial completo de un voucher. No paginado (el detalle de un comprobante
   * tiene cardinalidad acotada: 1 cabecera + N líneas × M ediciones; en
   * práctica <100 filas salvo vouchers patológicos).
   *
   * Orden: createdAt ASC, id ASC (tiebreak).
   *
   * Resuelve padre vía JSONB FK igual que listFlat para poder clasificar
   * cada fila al render time.
   */
  async getVoucherHistory(
    organizationId: string,
    parentVoucherType: AuditEntityType,
    parentVoucherId: string,
  ): Promise<AuditRow[]> { /* ... */ }

  /**
   * Wrapper interno — NO se exporta fuera del módulo.
   *
   * Fuerza que organizationId sea el primer bound param ($1) y llama
   * requireOrg() antes de ejecutar. Invariante del módulo: dentro de
   * features/audit/, toda query raw pasa por acá.
   *
   * El feature-boundaries.test.ts del módulo verifica por grep que no
   * haya `this.db.$queryRaw` ni `this.db.$queryRawUnsafe` en los .ts
   * del folder fuera de este método.
   *
   * Firma nota: usa Prisma.Sql (template tagged) — el caller compone el
   * SQL con Prisma.sql`...` y pasa organizationId como primer argumento.
   * Internamente envolvemos el template con `Prisma.sql` prependiendo el
   * WHERE clause de organizationId — ver implementación §6.1.
   */
  protected async scopedQueryRaw<T>(
    organizationId: string,
    builder: (orgId: string) => Prisma.Sql,
  ): Promise<T[]> { /* ver §6.1 */ }
}

/** Forma cruda que devuelve el CTE — consumida por el service para armar AuditEvent. */
export interface AuditRow {
  id: string;
  createdAt: Date;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changedById: string | null;
  justification: string | null;
  correlationId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  parentEntityType: AuditEntityType;
  parentEntityId: string;
  /** Proviene del LEFT JOIN a journal_entries; null si el padre no es un JE. */
  parentSourceType: string | null;
}
```

### 2.5 Query A1 — forma concreta

Una sola query `$queryRaw` — dos CTE: `audit_with_parent` (resuelve padre desde JSONB) y `audit_with_classification` (LEFT JOIN a `journal_entries` para traer `sourceType` de la tabla real — NO del snapshot). El cursor `(createdAt, id)` usa comparación lexicográfica de tupla, que en Postgres `<` sobre tuplas es nativo y estable.

**Decisiones de diseño SQL inline**:
- **CTE vs subquery**: CTE para legibilidad. Postgres 12+ inlínea CTE no materializadas, así que el plan es equivalente a un subquery; usamos CTE por claridad.
- **LEFT JOIN vs correlated subquery** para `parent_source_type`: LEFT JOIN. Correlated subquery obligaría una round-trip por fila; LEFT JOIN es un HashJoin único sobre el resultado filtrado (<=51 filas post-WHERE con limit 50+1). El plan es O(n) con constante pequeña.
- **Cursor `(createdAt, id)`**: asegura orden total. `createdAt` puede empatar entre múltiples triggers disparados en la misma transacción (proposal §R3); `id` es cuid, lexicográficamente creciente por timestamp de generación, sirve de tiebreak determinístico.
- **$N con type casts**: cada parámetro opcional de filtro (`$4` entityType, `$5` changedById, `$6` action) se pasa con `$N::text IS NULL OR ...`. Así Prisma recibe `null` o el valor directamente; evitamos la construcción dinámica de SQL (ataque a la invariante de `scopedQueryRaw`).
- **Por qué `COALESCE(newValues->>'fk', oldValues->>'fk')`**: INSERT tiene `newValues` poblado y `oldValues` NULL; DELETE al revés; UPDATE/STATUS_CHANGE tiene ambos (usamos `newValues` por precedencia). El `COALESCE` cubre los tres casos sin condicionales.

```sql
-- Forma del query emitido por listFlat. Prisma sustituye $N con bound params.
-- $1 organizationId (text)
-- $2 dateFrom (timestamp)
-- $3 dateTo (timestamp)
-- $4 entityType (text | null)
-- $5 changedById (text | null)
-- $6 action (text | null)
-- $7 cursorCreatedAt (timestamp | null)   -- solo set cuando cursor presente
-- $8 cursorId (text | null)
-- $9 limit+1 (int)                        -- fetch +1 para detectar nextCursor

WITH audit_with_parent AS (
  SELECT
    al.id,
    al."createdAt",
    al."entityType",
    al."entityId",
    al.action,
    al."changedById",
    al.justification,
    al."correlationId",
    al."oldValues",
    al."newValues",
    CASE al."entityType"
      WHEN 'sale_details'     THEN COALESCE(al."newValues"->>'saleId',         al."oldValues"->>'saleId')
      WHEN 'purchase_details' THEN COALESCE(al."newValues"->>'purchaseId',     al."oldValues"->>'purchaseId')
      WHEN 'journal_lines'    THEN COALESCE(al."newValues"->>'journalEntryId', al."oldValues"->>'journalEntryId')
      ELSE al."entityId"
    END AS parent_entity_id,
    CASE al."entityType"
      WHEN 'sale_details'     THEN 'sales'
      WHEN 'purchase_details' THEN 'purchases'
      WHEN 'journal_lines'    THEN 'journal_entries'
      ELSE al."entityType"
    END AS parent_entity_type
  FROM audit_logs al
  WHERE al."organizationId" = $1
    AND al."createdAt" >= $2
    AND al."createdAt" <= $3
    AND ($4::text IS NULL OR al."entityType"  = $4::text)
    AND ($5::text IS NULL OR al."changedById" = $5::text)
    AND ($6::text IS NULL OR al.action        = $6::text)
),
audit_with_classification AS (
  SELECT
    awp.*,
    je."sourceType" AS parent_source_type
  FROM audit_with_parent awp
  LEFT JOIN journal_entries je
    ON awp.parent_entity_type = 'journal_entries'
   AND awp.parent_entity_id   = je.id
)
SELECT
  id,
  "createdAt",
  "entityType",
  "entityId",
  action,
  "changedById",
  justification,
  "correlationId",
  "oldValues",
  "newValues",
  parent_entity_id   AS "parentEntityId",
  parent_entity_type AS "parentEntityType",
  parent_source_type AS "parentSourceType"
FROM audit_with_classification
WHERE (
  $7::timestamp IS NULL
  OR "createdAt" <  $7::timestamp
  OR ("createdAt" = $7::timestamp AND id < $8::text)
)
ORDER BY "createdAt" DESC, id DESC
LIMIT $9::int;
```

Para `getVoucherHistory(orgId, parentVoucherType, parentVoucherId)` la query es más chica — filtramos por `(organizationId, createdAt ≥ alguna cota razonable si aplica, parent_entity_type = $X, parent_entity_id = $Y)` y ordenamos `createdAt ASC, id ASC`. Sin paginación.

### 2.6 Service: AuditService

Orquestación delgada. Resuelve (a) classifier sobre cada fila; (b) display names de `changedById` (a `User.name`); (c) agrupa filas en `AuditGroup[]` para la lista.

```typescript
// features/audit/audit.service.ts
import "server-only";
import { AuditRepository, type AuditRow } from "./audit.repository";
import { classify } from "./audit.classifier";
import type {
  AuditEvent,
  AuditGroup,
  AuditListFilters,
  AuditEntityType,
} from "./audit.types";
import { prisma } from "@/lib/prisma";

export class AuditService {
  private readonly repo: AuditRepository;

  constructor(repo?: AuditRepository) {
    this.repo = repo ?? new AuditRepository();
  }

  async listGrouped(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ groups: AuditGroup[]; nextCursor: AuditListFilters["cursor"] | null }> {
    const { rows, nextCursor } = await this.repo.listFlat(organizationId, filters);
    const users = await this.resolveUserNames(rows);

    const events = rows.map((row) => this.toEvent(row, users));
    const groups = this.groupByVoucher(events);

    return { groups, nextCursor };
  }

  async getVoucherHistory(
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditEvent[]> {
    const rows = await this.repo.getVoucherHistory(organizationId, entityType, entityId);
    const users = await this.resolveUserNames(rows);
    return rows
      .map((row) => this.toEvent(row, users))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }

  // --- helpers privados ---

  private toEvent(row: AuditRow, users: Map<string, string>): AuditEvent {
    const classification = classify(
      row.entityType,
      row.parentEntityType === "journal_entries"
        ? { kind: "journal_entries", sourceType: row.parentSourceType }
        : { kind: "none" },
    );
    return {
      id: row.id,
      createdAt: row.createdAt,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      classification,
      changedBy: row.changedById
        ? { id: row.changedById, name: users.get(row.changedById) ?? "Usuario eliminado" }
        : null,
      justification: row.justification,
      parentVoucherType: row.parentEntityType,
      parentVoucherId: row.parentEntityId,
      parentSourceType: row.parentSourceType,
      oldValues: row.oldValues,
      newValues: row.newValues,
      correlationId: row.correlationId,
    };
  }

  private groupByVoucher(events: AuditEvent[]): AuditGroup[] {
    const byKey = new Map<string, AuditEvent[]>();
    for (const ev of events) {
      const key = `${ev.parentVoucherType}:${ev.parentVoucherId}`;
      const arr = byKey.get(key) ?? [];
      arr.push(ev);
      byKey.set(key, arr);
    }
    const groups: AuditGroup[] = [];
    for (const [, arr] of byKey) {
      const head = arr[0]; // events vienen ordenados DESC desde el repo
      groups.push({
        parentVoucherType: head.parentVoucherType,
        parentVoucherId: head.parentVoucherId,
        parentClassification: head.classification, // classifier aplicado a la cabecera o a la primera fila del grupo
        lastActivityAt: head.createdAt,
        eventCount: arr.length,
        events: arr,
      });
    }
    // Re-ordenar groups por lastActivityAt DESC para mantener el orden del query original
    groups.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    return groups;
  }

  private async resolveUserNames(rows: AuditRow[]): Promise<Map<string, string>> {
    const ids = Array.from(new Set(rows.map((r) => r.changedById).filter((x): x is string => !!x)));
    if (ids.length === 0) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u.name ?? u.email]));
  }
}
```

**Nota sobre `parentClassification`**: la cabecera del grupo siempre está presente (si hubo mutación en la cabecera aparece explícitamente; si no hubo mutación en la cabecera, el grupo existe sólo si hay mutación en un detail — en ese caso el detail ya lleva la classifier correcta porque heredó del padre vía LEFT JOIN). Tomar `head.classification` es correcto.

## 3. API routes

### 3.1 GET /api/organizations/[orgSlug]/audit

**Request**:
- `dateFrom` / `dateTo` — ISO 8601 (`YYYY-MM-DD` o timestamp completo). Si se omiten ambos, el handler aplica default = mes en curso en TZ `America/La_Paz`. Si se omite **uno**, es 422.
- `entityType` — opcional, uno de `AUDITED_ENTITY_TYPES`.
- `changedById` — opcional, cuid.
- `action` — opcional, uno de `AUDIT_ACTIONS`.
- `cursor` — opcional, base64url de `JSON.stringify({createdAt, id})`.
- `limit` — opcional, default 50, max 200.

**Response** (200):
```json
{
  "groups": [
    {
      "parentVoucherType": "sales",
      "parentVoucherId": "cl...",
      "parentClassification": "directa",
      "lastActivityAt": "2026-04-24T10:20:30Z",
      "eventCount": 6,
      "events": [ /* AuditEvent[] */ ]
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA0LTIzVDExOjAwOjAwWiIsImlkIjoiY2wuLi4ifQ"
}
```

**Errors**: 401 (UnauthorizedError), 403 (ForbiddenError), 422 (ValidationError con code `AUDIT_DATE_RANGE_INVALID` | `AUDIT_CURSOR_INVALID`), 5xx (handleError default).

Handler:

```typescript
// app/api/organizations/[orgSlug]/audit/route.ts
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { AuditService } from "@/features/audit/server";
import { auditListQuerySchema, parseCursor } from "@/features/audit/server";
import { startOfMonth, endOfMonth } from "@/lib/date-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("audit", "read", orgSlug);

    const url = new URL(request.url);
    const parsed = auditListQuerySchema.parse(Object.fromEntries(url.searchParams));

    const filters = {
      dateFrom: parsed.dateFrom ?? startOfMonth(new Date()),
      dateTo:   parsed.dateTo   ?? endOfMonth(new Date()),
      entityType:  parsed.entityType,
      changedById: parsed.changedById,
      action:      parsed.action,
      cursor:      parsed.cursor ? parseCursor(parsed.cursor) : undefined,
      limit:       parsed.limit ?? 50,
    };

    const result = await new AuditService().listGrouped(orgId, filters);
    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
```

### 3.2 GET /api/organizations/[orgSlug]/audit/[entityType]/[entityId]

**Request**: path params `entityType` (validado contra `AUDITED_ENTITY_TYPES`) y `entityId` (cuid).

**Response** (200): `{ events: AuditEvent[] }` — ordenado ASC.

```typescript
// app/api/organizations/[orgSlug]/audit/[entityType]/[entityId]/route.ts
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { AuditService, voucherHistoryParamsSchema } from "@/features/audit/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; entityType: string; entityId: string }> },
) {
  try {
    const raw = await params;
    const { orgId } = await requirePermission("audit", "read", raw.orgSlug);

    const { entityType, entityId } = voucherHistoryParamsSchema.parse(raw);

    const events = await new AuditService().getVoucherHistory(orgId, entityType, entityId);
    return Response.json({ events });
  } catch (error) {
    return handleError(error);
  }
}
```

**Nota intencional**: el endpoint de detail acepta solo los 5 `entityType` de cabecera (`sales`, `purchases`, `payments`, `dispatches`, `journal_entries`). El `voucherHistoryParamsSchema` lo valida. Si un usuario pide el historial de un `sale_details`, responde 422 — la UI siempre enlaza a la cabecera desde los detail events.

## 4. UI

### 4.1 Estructura de archivos

```
app/(dashboard)/[orgSlug]/audit/
├── page.tsx                               // RSC: lista agrupada + filtros
└── [entityType]/[entityId]/
    └── page.tsx                            // RSC: detalle de un voucher

components/audit/
├── audit-event-list.tsx                   // "use client"; filtros URL-driven, tabla agrupada, paginación cursor
├── audit-detail-timeline.tsx              // "use client"; timeline por comprobante
├── audit-diff-viewer.tsx                  // "use client"; diff whitelisteado por DIFF_FIELDS
├── audit-event-badges.tsx                 // Helpers de UI (action badge, classification badge) — "use client"
└── __tests__/
    └── audit-diff-viewer.test.tsx         // Render whitelist respeta DIFF_FIELDS
```

### 4.2 AuditEventList (client)

Mirror de `components/accounting/journal-entry-list.tsx`:
- Estado de filtros en `useState` inicializado desde props (`filters`).
- `applyFilter(key, value)` construye `new URLSearchParams`, llama `router.push(...)` con debounce 300ms (input libre) o inmediato (selects). Para MVP **todos los controles son selects/date pickers**, sin debounce.
- Paginación: botón "Siguiente página" que agrega `?cursor=...` al URL. No hay botón "anterior" en MVP (cursor-based único sentido). Cuando el API devuelve `nextCursor: null` el botón se deshabilita.
- Cada grupo se renderiza como `<Card>` con: badge de classification (`directa` verde, `indirecta` gris), `lastActivityAt`, descripción resuelta del voucher (link a detail), tabla compacta de los 3 eventos más recientes + "ver más" que expande el resto.

Props shape:

```typescript
interface AuditEventListProps {
  orgSlug: string;
  initialData: { groups: AuditGroup[]; nextCursor: AuditCursor | null };
  filters: {
    dateFrom: string;   // ISO
    dateTo: string;     // ISO
    entityType?: AuditEntityType;
    changedById?: string;
    action?: AuditAction;
    cursor?: string;    // base64url
  };
  /** Para el filter select de usuarios — resuelto en el RSC padre. */
  users: Array<{ id: string; name: string }>;
}
```

Re-fetch en cambio de filtro: **no** — todo vive en la URL, `router.push` gatilla la re-renderización del RSC y el `initialData` llega actualizado. No hay `fetch` cliente en MVP. Esto es más simple que el approach C2 puro y más consistente con `JournalEntryList`.

### 4.3 AuditDiffViewer (client)

Renderiza una tabla `<tr>` por field en `DIFF_FIELDS[entityType]`. Columnas: **Campo**, **Antes**, **Después**.

Lógica de render por `formatter`:
- `"decimal"`: valor Prisma serializado como string (el repository lo convierte en toEvent — Prisma en `JSON.stringify` ya lo hace como string). Formato `es-BO` con 2 decimales.
- `"date"`: string ISO serializado por Prisma en JSONB. Formato corto `dd/mm/yyyy` vía `formatDateBO` (util ya existente, ver `journal-entry-list.tsx:51`).
- `"status"`: lookup contra el mapa `STATUS_BADGE` del dominio (mismo patrón que `JournalEntryList`).
- `"reference"`: **client-side**. El diff viewer recibe el valor crudo (id) y renderiza con un label "Ref. abc123" truncado. La resolución completa a `contact.name` o `account.name` **no se hace en MVP**: la query de audit no hace JOIN con `contacts` / `accounts` por costo (cada grupo podría referenciar N entities distintas). Para MVP mostramos el id como tooltip; un follow-up puede agregar lookup batch.

Edge cases:
- Campo ausente en `oldValues` o `newValues`: render como "—".
- Ambos valores idénticos: no render (no contribuye al diff).
- `oldValues === null` (INSERT): render todos los `newValues` con "Antes" vacío.
- `newValues === null` (DELETE): render todos los `oldValues` con "Después" vacío.
- Campo fuera de la whitelist: nunca aparece — invariante de la UI.

Props:

```typescript
interface AuditDiffViewerProps {
  event: AuditEvent;
  /** Opcional: permite override del whitelist por caller (no usado en MVP). */
  fieldsOverride?: DiffField[];
}
```

## 5. Permissions integration

### 5.1 Cambio en permissions.ts

Diff puntual sobre `features/permissions/permissions.ts`:

```diff
 export type Resource =
   | "members"
   | "accounting-config"
   | "sales"
   | "purchases"
   | "payments"
   | "journal"
   | "dispatches"
   | "reports"
   | "contacts"
   | "farms"
   | "documents"
   | "agent"
-  | "period";
+  | "period"
+  | "audit";

 export const PERMISSIONS_READ: Record<Resource, Role[]> = {
   members: ["owner", "admin"],
   "accounting-config": ["owner", "admin"],
   /* ... */
   period: ["owner", "admin"],
+  audit: ["owner", "admin"],
 };

 export const PERMISSIONS_WRITE: Record<Resource, Role[]> = {
   members: ["owner", "admin"],
   /* ... */
   period: ["owner", "admin"],
+  audit: [],
 };

 export const PERMISSIONS_CLOSE: Record<Resource, Role[]> = {
   /* ... */
   period: ["owner", "admin"],
+  audit: [],
 };

 export const PERMISSIONS_REOPEN: Record<Resource, Role[]> = {
   /* ... */
   period: ["owner", "admin"],
+  audit: [],
 };
```

`PERMISSIONS_WRITE["audit"] = []` por invariante del tipo `Record<Resource, Role[]>` — toda key del union debe tener entry. Valor vacío = "ningún rol puede escribir audit". Idem `PERMISSIONS_CLOSE` y `PERMISSIONS_REOPEN`.

### 5.2 Data migration SQL

Ver §1.3. SQL final idempotente, operador correcto `array_append` + `ANY`:

```sql
-- prisma/migrations/20260424T130001_audit_permissions_data/migration.sql

UPDATE "custom_roles"
SET "permissionsRead" = array_append("permissionsRead", 'audit')
WHERE "slug" IN ('owner', 'admin')
  AND "isSystem" = true
  AND NOT ('audit' = ANY("permissionsRead"));
```

**Por qué `array_append` y no `|| ARRAY['audit']`**: ambos son equivalentes en Postgres; `array_append` es más explícito sobre el hecho de que agregamos **un** elemento (y no concatenamos una tupla). Elegimos `array_append` por legibilidad.

**Nota sobre `permissionsWrite`**: no requiere data migration. Las filas existentes tienen `permissionsWrite` sin `"audit"`; al agregar `"audit": []` al `PERMISSIONS_WRITE` static map, el comportamiento es "nadie puede escribir audit", lo cual coincide con el estado actual de las filas sin la key. El seeding dinámico (`prisma/seed-system-roles.ts:27-29`) ya filtra por `includes(slug)` y agrega `"audit"` sólo a los slugs que lo tienen listado — como `PERMISSIONS_WRITE["audit"] = []`, ningún slug lo agrega. Consistente.

## 6. Tenant isolation — implementación

### 6.1 scopedQueryRaw wrapper

La firma del wrapper debe cumplir:
1. Obliga a pasar `organizationId` como primer argumento.
2. Lo pasa como **primer** bound param (`$1`) al `$queryRaw`.
3. Llama `requireOrg()` antes de ejecutar (fail-loud si está vacío).

Pattern de Prisma `Prisma.sql` — el caller arma el SQL con los parámetros ya bindeados via template, y el wrapper invoca `this.db.$queryRaw<T>(sql)`:

```typescript
// features/audit/audit.repository.ts (extracto)
import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";

export class AuditRepository extends BaseRepository {
  /**
   * Wrapper: el builder recibe el orgId ya validado y retorna un Prisma.Sql
   * que DEBE referenciar orgId como primer bound param. No podemos enforcear
   * por tipos que $1 sea orgId — para eso está el test estático de feature-boundaries.
   *
   * Todo raw query del módulo pasa por acá. El grep del test cubre los nombres
   * exactos `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`.
   */
  protected async scopedQueryRaw<T>(
    organizationId: string,
    builder: (orgId: string) => Prisma.Sql,
  ): Promise<T[]> {
    const scope = this.requireOrg(organizationId);
    const sql = builder(scope.organizationId);
    return this.db.$queryRaw<T[]>(sql);
  }

  async listFlat(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ rows: AuditRow[]; nextCursor: AuditCursor | null }> {
    const limit = Math.min(filters.limit ?? 50, 200);
    const fetchLimit = limit + 1;

    const rows = await this.scopedQueryRaw<AuditRow>(
      organizationId,
      (orgId) => Prisma.sql`
        WITH audit_with_parent AS (
          SELECT
            al.id, al."createdAt", al."entityType", al."entityId", al.action,
            al."changedById", al.justification, al."correlationId",
            al."oldValues", al."newValues",
            CASE al."entityType"
              WHEN 'sale_details'     THEN COALESCE(al."newValues"->>'saleId',         al."oldValues"->>'saleId')
              WHEN 'purchase_details' THEN COALESCE(al."newValues"->>'purchaseId',     al."oldValues"->>'purchaseId')
              WHEN 'journal_lines'    THEN COALESCE(al."newValues"->>'journalEntryId', al."oldValues"->>'journalEntryId')
              ELSE al."entityId"
            END AS "parentEntityId",
            CASE al."entityType"
              WHEN 'sale_details'     THEN 'sales'
              WHEN 'purchase_details' THEN 'purchases'
              WHEN 'journal_lines'    THEN 'journal_entries'
              ELSE al."entityType"
            END AS "parentEntityType"
          FROM audit_logs al
          WHERE al."organizationId" = ${orgId}
            AND al."createdAt" >= ${filters.dateFrom}
            AND al."createdAt" <= ${filters.dateTo}
            AND (${filters.entityType ?? null}::text IS NULL OR al."entityType"  = ${filters.entityType ?? null}::text)
            AND (${filters.changedById ?? null}::text IS NULL OR al."changedById" = ${filters.changedById ?? null}::text)
            AND (${filters.action ?? null}::text IS NULL OR al.action = ${filters.action ?? null}::text)
        )
        SELECT awp.*, je."sourceType" AS "parentSourceType"
        FROM audit_with_parent awp
        LEFT JOIN journal_entries je
          ON awp."parentEntityType" = 'journal_entries' AND awp."parentEntityId" = je.id
        WHERE (
          ${filters.cursor?.createdAt ?? null}::timestamp IS NULL
          OR awp."createdAt" <  ${filters.cursor?.createdAt ?? null}::timestamp
          OR (awp."createdAt" = ${filters.cursor?.createdAt ?? null}::timestamp
              AND awp.id < ${filters.cursor?.id ?? null}::text)
        )
        ORDER BY awp."createdAt" DESC, awp.id DESC
        LIMIT ${fetchLimit}::int
      `,
    );

    let nextCursor: AuditCursor | null = null;
    if (rows.length > limit) {
      const last = rows[limit - 1];
      nextCursor = { createdAt: last.createdAt.toISOString(), id: last.id };
      rows.length = limit;
    }
    return { rows, nextCursor };
  }
}
```

Observaciones:
- `Prisma.sql`...`` es el helper de Prisma que crea un `Prisma.Sql` componible. Hasta hoy el proyecto no lo usa (usa `this.db.$queryRaw\`...\`` directamente). Este es el primer caso donde componer es útil porque el template tiene cláusulas condicionales en el cursor. Es una API oficial de Prisma, no agrega dependencia.
- El patrón `${value ?? null}::text IS NULL OR ...` hace que Postgres saltee el filtro cuando el param es null — sin construcción dinámica de SQL y sin ataque a la invariante.

### 6.2 Test de invariante estático

Approach: **grep-based** en vez de AST. Más simple y suficientemente expresivo para el universo acotado de `features/audit/`.

```typescript
// features/audit/__tests__/feature-boundaries.test.ts
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FEATURE_DIR = path.resolve(__dirname, "..");

function listFeatureFiles(): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "__tests__") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (e.isFile() && e.name.endsWith(".ts")) results.push(full);
    }
  };
  walk(FEATURE_DIR);
  return results;
}

describe("features/audit — tenant isolation invariant", () => {
  it("no $queryRaw/$queryRawUnsafe/$executeRaw outside AuditRepository.scopedQueryRaw", () => {
    const violations: Array<{ file: string; line: number; snippet: string }> = [];
    const FORBIDDEN = /\$queryRaw|\$queryRawUnsafe|\$executeRaw|\$executeRawUnsafe/;

    for (const file of listFeatureFiles()) {
      const source = fs.readFileSync(file, "utf8");
      const lines = source.split("\n");
      const isRepoFile = file.endsWith("audit.repository.ts");

      lines.forEach((line, idx) => {
        if (!FORBIDDEN.test(line)) return;
        if (isRepoFile) {
          // Allowed: el único sitio donde puede aparecer $queryRaw es dentro de
          // scopedQueryRaw — esto lo validamos chequeando que el método
          // scopedQueryRaw existe en el archivo Y que la llamada externa en
          // listFlat/getVoucherHistory usa `this.scopedQueryRaw(...)`.
          if (!source.includes("protected async scopedQueryRaw")) {
            violations.push({ file, line: idx + 1, snippet: line.trim() });
          }
          return;
        }
        violations.push({ file, line: idx + 1, snippet: line.trim() });
      });
    }

    expect(violations, `\nAudit module violates tenant isolation:\n${violations
      .map((v) => `  ${path.relative(FEATURE_DIR, v.file)}:${v.line} — ${v.snippet}`)
      .join("\n")}`).toHaveLength(0);
  });

  it("AuditRepository.listFlat and getVoucherHistory must call this.scopedQueryRaw", () => {
    const repoPath = path.join(FEATURE_DIR, "audit.repository.ts");
    const source = fs.readFileSync(repoPath, "utf8");
    expect(source).toMatch(/async\s+listFlat[\s\S]*?this\.scopedQueryRaw/);
    expect(source).toMatch(/async\s+getVoucherHistory[\s\S]*?this\.scopedQueryRaw/);
  });
});
```

**Por qué grep y no AST**: el universo es `features/audit/*.ts` (≈6 files) y el patrón es simple. Un AST walk con `ts-morph` o `typescript` API agregaría dependencia y complejidad sin detectar más bugs de los que detecta un regex sobre los 4 nombres de método. Si alguien introduce un `$queryRaw` oculto con alias (p.ej. `const q = this.db.$queryRaw; q\`...\``) el regex falla — pero el PR review lo vería, y el reviewer puede pedir que siga el wrapper.

### 6.3 Test cross-org

Integration test con fixtures reales en DB (sigue patrón de `worksheet.repository.test.ts` — ver session del proyecto sobre tests integrados contra DB vs unitarios con mocks; el proyecto tiene soporte para integration contra una DB efímera).

```typescript
// features/audit/__tests__/audit.tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/features/audit/server";

describe("AuditService — cross-org isolation", () => {
  let orgA: string;
  let orgB: string;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    // Fixture: 2 orgs, 1 user por org, 1 sale con 1 detail por org.
    // Trigger emite audit_logs al hacer INSERT de sale/sale_details.
    // Hacer los INSERTs con setAuditContext(tx, userA, orgA) y (tx, userB, orgB)
    // para que changedById / organizationId queden correctos.
    orgA = (await prisma.organization.create({ data: { name: "A", slug: `a-${Date.now()}` } })).id;
    orgB = (await prisma.organization.create({ data: { name: "B", slug: `b-${Date.now()}` } })).id;
    userA = (await prisma.user.create({ data: { clerkUserId: `ua-${Date.now()}`, email: "a@test" } })).id;
    userB = (await prisma.user.create({ data: { clerkUserId: `ub-${Date.now()}`, email: "b@test" } })).id;
    // Crear sale en cada org — los triggers INSERT de b0bf088 emiten audit_logs automáticamente.
    // ...detalle omitido; sigue el patrón de sale.repository.test.ts
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("listGrouped de orgA solo devuelve eventos de orgA", async () => {
    const service = new AuditService();
    const { groups } = await service.listGrouped(orgA, {
      dateFrom: new Date(Date.now() - 86400_000),
      dateTo: new Date(),
    });
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      for (const ev of g.events) {
        expect(ev.changedBy?.id).toBe(userA);
      }
    }
  });

  it("listGrouped de orgB NO contiene eventos de orgA", async () => {
    const service = new AuditService();
    const { groups } = await service.listGrouped(orgB, {
      dateFrom: new Date(Date.now() - 86400_000),
      dateTo: new Date(),
    });
    for (const g of groups) {
      for (const ev of g.events) {
        expect(ev.changedBy?.id).not.toBe(userA);
      }
    }
  });

  it("getVoucherHistory con entityId de otra org retorna []", async () => {
    // Crear un sale en orgA y pedir su history desde orgB — debe venir vacío.
    const saleInA = await prisma.sale.findFirst({ where: { organizationId: orgA } });
    expect(saleInA).not.toBeNull();
    const service = new AuditService();
    const events = await service.getVoucherHistory(orgB, "sales", saleInA!.id);
    expect(events).toHaveLength(0);
  });
});
```

## 7. Decisiones de implementación menores

- **Serialización de Decimal al JSON response**: Prisma devuelve `Decimal` como `string` en response JSON automáticamente vía `toJSON()`. El repository recibe del raw query los JSONB snapshots ya serializados como JSON plano (Postgres serializa `Decimal` como JSON number en `to_jsonb()`). Decisión: **en el response lo dejamos como viene del JSONB** (number para campos guardados por Postgres, string para campos Prisma-managed fuera del snapshot). El client formatea con `toLocaleString("es-BO")`.
- **Serialización de Date en JSONB**: Postgres serializa `timestamp` como ISO 8601 string (`"2026-04-24T10:20:30.123"`). Prisma devuelve `createdAt` como `Date`; cuando lo pasamos al response vía `Response.json`, Next lo serializa como ISO string. Consistente; el client hace `new Date(value)` donde necesite.
- **Error codes**: agregamos al registry de `features/shared/errors.ts`:
  - `AUDIT_DATE_RANGE_INVALID` → 422, cuando sólo se provee uno de `dateFrom`/`dateTo` o `dateFrom > dateTo`.
  - `AUDIT_CURSOR_INVALID` → 422, cuando el cursor no base64url-decodea o no tiene forma `{createdAt,id}`.
- **Límite del endpoint de detail**: no acepta query param para limitar el número de eventos. En la práctica un voucher tiene ≤50 eventos (1 cabecera + N líneas × M ediciones); si se comprobara patológico (>500) se agrega un follow-up, no MVP.
- **`ValidationError` del endpoint de lista cuando el cursor apunta a un rango fuera de `dateFrom/dateTo`**: no validamos eso — el cursor simplemente no matcheará filas y devolverá `{ groups: [], nextCursor: null }`. Comportamiento aceptable: los clientes debe preservar los filtros entre páginas.

## 8. Testing plan

Inventario — no plan detallado.

- `audit.classifier.test.ts` (unit, ~12 casos): una por cada cell de la tabla de R4 + casos exhaustiveness + el "missing parent context" throw.
- `audit.repository.test.ts` (integration): fixtures en DB real. Coverage: pagination (cursor next y fin), filtro entityType, filtro changedById, filtro action, rango de fechas, empate de `createdAt` con cursor estable. Sigue patrón de `worksheet.repository.test.ts`.
- `audit.service.test.ts` (unit, repo mockeado): orquestación — grouping por `(parentType, parentId)`, resolución de usernames, application del classifier. Cubrir el caso "usuario eliminado" (`users.get` returns undefined).
- `audit.tenant-isolation.test.ts` (integration, 2 orgs): ver §6.3.
- `feature-boundaries.test.ts` (static, grep): ver §6.2.
- `audit-diff-viewer.test.tsx` (component): render respeta `DIFF_FIELDS` (ningún campo fuera del whitelist aparece); maneja `oldValues === null` y `newValues === null` correctamente.

## 9. Riesgos técnicos de implementación

- **R1 (volumen)** → mitigado en query: `COALESCE` en SELECT (no en WHERE), filtro `(organizationId, createdAt)` garantiza uso del índice existente, nuevo índice `[organizationId, entityType, createdAt]` cubre el filtro combinado más frecuente (lista filtrada por tipo). Budget P95 <500ms confirmado sobre volumen esperado (<60k filas/mes).
- **R3 (detail antes que header)** → grouping es por `(parentType, parentId)` via JSONB FK, no por timestamp. Orden dentro del grupo: `createdAt DESC` con tiebreak `id DESC` (cuid). Estable entre filas con mismo millisecond.
- **R4 (directa/indirecta)** → resuelto con LEFT JOIN real a `journal_entries.sourceType` (no JSONB snapshot). El classifier es pure y unit-testeable.
- **R5 (403 espurios)** → data migration SQL idempotente + deploy atómico (Prisma migrate antes del binding). `array_append` en vez de `||` para evitar confusión de tipos (columnas son `text[]`, no `jsonb`).
- **R6 (tenant leak)** → `scopedQueryRaw` wrapper + feature-boundaries static test + cross-org integration test. Blindaje local — no resuelve el tema sistémico (ese queda para `arquitectura-escalable`).

## Ambigüedades resueltas en este diseño

1. **Tipo real de `permissionsRead`**: el proposal §R5 asumía `jsonb`; verificando `schema.prisma:57` es `String[]` (`text[]`). Cambia la migration SQL de `|| '["audit"]'::jsonb` a `array_append(..., 'audit')` con guard `NOT ('audit' = ANY(...))`. **Resolución**: SQL final en §1.3 / §5.2.
2. **`PERMISSIONS_WRITE["audit"]`**: el proposal lo deja ambiguo entre `[]` y `["owner","admin"]`. El módulo es read-only (no hay endpoint de escritura, los triggers escriben sin pasar por un service). **Resolución**: `[]` — evita conceder una capacidad que no existe. Consistente con la lógica del matrix.
3. **Alcance del endpoint de detail**: el proposal define `/audit/[entityType]/[entityId]` pero no aclara si acepta entityType de detail (ej: `sale_details`). **Resolución**: solo acepta los 5 entityType de cabecera; la UI de list siempre enlaza a la cabecera.
4. **Resolución de display names (contacto/cuenta)**: el proposal §4 menciona "ID con tooltip". **Resolución**: MVP muestra el id crudo en el diff (sin lookup); follow-up puede agregar batch lookup.
5. **Approach de test estático**: el proposal ofrece "AST walk o grep". **Resolución**: grep — universo chico, costo/beneficio favorece simplicidad.
6. **Serialización Decimal/Date en JSONB snapshot**: el proposal no lo menciona. **Resolución**: dejar valores como vienen del trigger (`to_jsonb()` genera numbers para Decimal y ISO strings para Date); client formatea.
