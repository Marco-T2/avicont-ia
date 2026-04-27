# Design: timestamptz-migration

**Fecha**: 2026-04-27
**Cambio**: `timestamptz-migration`
**Estado**: listo para `sdd-tasks`

---

## Pre-design verification — grep `deactivatedAt`

### Comandos ejecutados

```bash
grep -rn "deactivatedAt" \
  --include="*.ts" --include="*.tsx" --include="*.prisma" --include="*.sql" --include="*.json" \
  /path/to/avicont-ia | grep -v node_modules | grep -v .next | grep -v __tests__
```

### Hallazgos

#### Writes / sets de valor (no-null)

| Archivo | Línea | Tipo de write |
|---------|-------|---------------|
| `features/organizations/organizations.repository.ts` | 175 | `data: { deactivatedAt: new Date() }` — instante de desactivación |
| `features/ai-agent/__tests__/agent-context.repository.test.ts` | 167 | `data: { deactivatedAt: new Date() }` — test, no producción |

**Total writes de valor no-null (producción)**: 1 — en `organizations.repository.ts:175` dentro de `deactivateMember()`.

#### Reseteos a null

| Archivo | Línea | Semántica |
|---------|-------|-----------|
| `features/organizations/organizations.repository.ts` | 189 | `data: { deactivatedAt: null, role }` — reactivación |

#### Lecturas / filtros

Todos los demás usos son `deactivatedAt: null` en cláusulas WHERE (filtrado de miembros activos), sin escritura de valor temporal. Son correctos post-migración sin cambios.

#### En seeds

`scripts/seed-audit-fixtures.ts:39` usa `deactivatedAt: null` como filtro en una query, no como valor escrito. No hay ningún seed que setee un valor de fecha en `deactivatedAt`.

#### En migraciones

`prisma/migrations/20260403223611_add_member_soft_delete/migration.sql:2` — solo agrega la columna como `TIMESTAMP(3)` nullable, sin setear valores.

### Semántica confirmada

`deactivatedAt` se escribe con `new Date()` (instante en que se ejecuta la operación de desactivación) — es un **timestamp de log del sistema**, no una fecha operacional configurada por el usuario. Semántica: "en qué instante exacto se desactivó este miembro".

### Conclusión

La decisión del usuario de tratar `deactivatedAt` como **TIMESTAMP-AFFECTED** con `USING "deactivatedAt" AT TIME ZONE 'America/La_Paz'` es **CORRECTA**. El dato es naive BO-local (escrito con `new Date()` en un proceso con `TZ=America/La_Paz`), y debe reinterpretarse como instante UTC real. No hay evidencia de contradicción.

---

## Reconciliación de conteo: 60 vs 65 columnas

La exploration.md lista una tabla con 65 entradas pero su resumen declara 43+14+3=60. El schema actual tiene **65 campos DateTime**. La discrepancia se explica porque la tabla del exploration sí incluye las 65, pero el resumen no las cuenta a todas correctamente (probablemente porque se redactó antes de que se agregaran algunos modelos).

**Decisión del design**: la fuente canónica es el schema actual. Este design cataloga las **65 columnas** y el SQL de migración debe tener exactamente 65 `ALTER COLUMN`. El split correcto (post decisiones humanas) es:

- **TIMESTAMP-AFFECTED**: 49 columnas → `USING "col" AT TIME ZONE 'America/La_Paz'`
- **UTC-NOON**: 16 columnas → `USING "col" AT TIME ZONE 'UTC'`
- **Total**: 65

Las 5 columnas adicionales respecto al conteo original del exploration (todas TIMESTAMP-AFFECTED) son:
1. `User.createdAt` (estaba en la tabla pero no en el resumen)
2. `OrgProfile.createdAt`
3. `OrgProfile.updatedAt`
4. `DocumentSignatureConfig.createdAt`
5. `DocumentSignatureConfig.updatedAt`

---

## Inventario columna-por-columna — Tabla canónica

> Esta tabla es la **fuente canónica** para la generación del SQL. Cualquier discrepancia entre esta tabla y el SQL de migración es un error crítico.

| # | Modelo | Campo | Línea schema.prisma | Categoría USING | Justificación |
|---|--------|-------|---------------------|-----------------|---------------|
| 1 | Organization | createdAt | 18 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación vía `NOW()` del server |
| 2 | CustomRole | createdAt | 60 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 3 | CustomRole | updatedAt | 61 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de última modificación |
| 4 | OrganizationMember | deactivatedAt | 74 | TIMESTAMP-AFFECTED | Escrito con `new Date()` en `deactivateMember()` (organizations.repository.ts:175) — instante de log del sistema. Ver Pre-design verification arriba. |
| 5 | User | createdAt | 89 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 6 | Document | createdAt | 121 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 7 | ChatMessage | createdAt | 150 | TIMESTAMP-AFFECTED | `@default(now())` — indexado en `(sessionId, createdAt)` — crítico para orden |
| 8 | AgentRateLimit | windowStart | 166 | TIMESTAMP-AFFECTED | `floorToHour()` usa `setUTCMinutes(0,0,0)` — trabaja en UTC, pero el valor raw almacenado es aun naive BO-local por el bug de TZ de sesión. Migrar es inocuo y correcto. |
| 9 | AgentRateLimit | updatedAt | 168 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 10 | Farm | createdAt | 200 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 11 | Farm | updatedAt | 201 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 12 | ChickenLot | startDate | 216 | UTC-NOON | Fecha de inicio del lote — mostrado con `toLocaleDateString("es-BO")`, decisión humana: tratar como UTC-noon (uniforme). `USING AT TIME ZONE 'UTC'` preserva sin modificación. |
| 13 | ChickenLot | endDate | 217 | UTC-NOON | Fecha de cierre del lote — misma semántica que startDate. |
| 14 | ChickenLot | createdAt | 221 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 15 | ChickenLot | updatedAt | 222 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 16 | Expense | date | 238 | UTC-NOON | Fecha de gasto — mostrado como calendario. Decisión humana: migrar como UTC-NOON. |
| 17 | Expense | createdAt | 242 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 18 | MortalityLog | date | 257 | UTC-NOON | Fecha de mortalidad — mostrado como calendario. Decisión humana: migrar como UTC-NOON. |
| 19 | MortalityLog | createdAt | 261 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 20 | JournalEntry | date | 362 | UTC-NOON | Fecha del asiento contable — `toNoonUtc()` confirmado vía `journal.dates.ts`. |
| 21 | JournalEntry | createdAt | 374 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 22 | JournalEntry | updatedAt | 375 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 23 | FiscalPeriod | startDate | 422 | UTC-NOON | Límite del período contable — `assertMonthlyShape` usa `.getUTCDate()/.getUTCMonth()` → trabaja en UTC. |
| 24 | FiscalPeriod | endDate | 423 | UTC-NOON | Igual que startDate — fecha de cierre del período. |
| 25 | FiscalPeriod | closedAt | 425 | TIMESTAMP-AFFECTED | Instante en que se cerró el período — se escribe con `new Date()` vía lógica de close/reopen. |
| 26 | FiscalPeriod | createdAt | 428 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 27 | FiscalPeriod | updatedAt | 429 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 28 | Contact | createdAt | 578 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 29 | Contact | updatedAt | 579 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 30 | AccountsReceivable | dueDate | 604 | UTC-NOON | Fecha de vencimiento — decisión humana: migrar como UTC-NOON (schema uniforme). `USING AT TIME ZONE 'UTC'` preserva el dato sin shift. |
| 31 | AccountsReceivable | createdAt | 610 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 32 | AccountsReceivable | updatedAt | 611 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 33 | AccountsPayable | dueDate | 633 | UTC-NOON | Fecha de vencimiento — misma semántica y decisión que AccountsReceivable.dueDate. |
| 34 | AccountsPayable | createdAt | 639 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 35 | AccountsPayable | updatedAt | 640 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 36 | OrgSettings | createdAt | 675 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 37 | OrgSettings | updatedAt | 676 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 38 | Dispatch | date | 689 | UTC-NOON | Fecha del despacho — `dispatch.service.ts` usa `input.date.getTime()` para cálculo de dueDate. Decisión humana: UTC-NOON. |
| 39 | Dispatch | createdAt | 707 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 40 | Dispatch | updatedAt | 708 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 41 | ProductType | createdAt | 754 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 42 | ProductType | updatedAt | 755 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 43 | Payment | date | 770 | UTC-NOON | Fecha del pago — `payment-form.tsx` usa `.toISOString().split("T")[0]` → espera UTC-noon. |
| 44 | Payment | createdAt | 781 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 45 | Payment | updatedAt | 782 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 46 | OperationalDocType | createdAt | 804 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 47 | OperationalDocType | updatedAt | 805 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 48 | Purchase | date | 821 | UTC-NOON | Fecha de la compra — `purchase.service.ts` usa `purchase.date.getTime()`. Confirmado UTC-noon. |
| 49 | Purchase | createdAt | 842 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 50 | Purchase | updatedAt | 843 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 51 | PurchaseDetail | fecha | 867 | UTC-NOON | Fecha de flete por línea — campo nullable. Mismo patrón que otras fechas de comprobante. |
| 52 | Sale | date | 915 | UTC-NOON | Fecha de la venta — `sale.service.ts` usa `sale.date.getTime()`. Confirmado UTC-noon. |
| 53 | Sale | createdAt | 925 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 54 | Sale | updatedAt | 926 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 55 | AuditLog | createdAt | 970 | TIMESTAMP-AFFECTED | **Epicentro del bug** — indexado, usado en cursor pagination, comparado en range queries. |
| 56 | IvaPurchaseBook | fechaFactura | 988 | UTC-NOON | `iva-books.repository.ts:202` usa `toNoonUtc(input.fechaFactura)` explícitamente. |
| 57 | IvaPurchaseBook | createdAt | 1012 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 58 | IvaPurchaseBook | updatedAt | 1013 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 59 | IvaSalesBook | fechaFactura | 1028 | UTC-NOON | Igual que IvaPurchaseBook.fechaFactura — usa `toNoonUtc()`. |
| 60 | IvaSalesBook | createdAt | 1052 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 61 | IvaSalesBook | updatedAt | 1053 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 62 | OrgProfile | createdAt | 1097 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 63 | OrgProfile | updatedAt | 1098 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |
| 64 | DocumentSignatureConfig | createdAt | 1110 | TIMESTAMP-AFFECTED | `@default(now())` — instante de creación |
| 65 | DocumentSignatureConfig | updatedAt | 1111 | TIMESTAMP-AFFECTED | `@updatedAt` — instante de modificación |

### Resumen del inventario canónico

| Categoría USING | Count | Columnas representativas |
|-----------------|-------|--------------------------|
| TIMESTAMP-AFFECTED (`AT TIME ZONE 'America/La_Paz'`) | **49** | Todos los `createdAt`, `updatedAt`, `closedAt`, `windowStart`, `deactivatedAt` |
| UTC-NOON (`AT TIME ZONE 'UTC'`) | **16** | `Sale.date`, `Purchase.date`, `JournalEntry.date`, `FiscalPeriod.startDate/endDate`, `ChickenLot.startDate/endDate`, `Expense.date`, `MortalityLog.date`, `Dispatch.date`, `Payment.date`, `PurchaseDetail.fecha`, `AccountsReceivable.dueDate`, `AccountsPayable.dueDate`, `IvaPurchaseBook.fechaFactura`, `IvaSalesBook.fechaFactura` |
| **TOTAL** | **65** | |

> **IMPORTANTE**: La exploration.md y la proposal.md citaban "60 columnas" por un error en el resumen del explore (las filas de OrgProfile y DocumentSignatureConfig y User.createdAt no se sumaron correctamente). El schema actual tiene 65 campos DateTime. El SQL debe tener exactamente **65 ALTER COLUMN**. Esta tabla es la fuente canónica — `sdd-apply` la usa directamente para generar el SQL.

---

## Estrategia de generación y edición del SQL

### Paso 1 — Editar `schema.prisma`

Agregar `@db.Timestamptz(3)` a cada uno de los 65 campos `DateTime`. Regla mecánica:

```prisma
# Antes:
createdAt  DateTime @default(now())
updatedAt  DateTime @updatedAt
date       DateTime
endDate    DateTime?

# Después:
createdAt  DateTime @db.Timestamptz(3) @default(now())
updatedAt  DateTime @db.Timestamptz(3) @updatedAt
date       DateTime @db.Timestamptz(3)
endDate    DateTime? @db.Timestamptz(3)
```

La anotación siempre va después del tipo (`DateTime`) y antes de los modificadores (`@default`, `@updatedAt`). Para campos nullable (`DateTime?`) la anotación también aplica: `DateTime? @db.Timestamptz(3)`.

**Verificación post-edición del schema**:
```bash
grep "DateTime" prisma/schema.prisma | grep -v "@db.Timestamptz"
# Resultado esperado: 0 líneas (todas las columnas DateTime deben tener @db.Timestamptz(3))
```

### Paso 2 — Generar el SQL base

```bash
pnpm prisma migrate dev --create-only --name timestamptz_migration
```

Esto crea `prisma/migrations/<timestamp>_timestamptz_migration/migration.sql` con 65 sentencias de la forma:

```sql
ALTER TABLE "organization_members" ALTER COLUMN "deactivatedAt" TYPE TIMESTAMPTZ(3);
```

El SQL generado es **incorrecto** para las 49 columnas TIMESTAMP-AFFECTED: Postgres aplica un casting implícito `TIMESTAMP → TIMESTAMPTZ` que asume UTC, pero los datos son naive BO-local. Este paso solo genera la base — NO aplicar todavía.

**Nombre tentativo de migración**: `<timestamp>_timestamptz_migration`
(donde `<timestamp>` se autogenera al correr `--create-only`, ej. `20260427120000_timestamptz_migration`)

### Paso 3 — Editar el SQL generado

Abrir el archivo `.sql` generado y agregar la cláusula `USING` correcta en cada `ALTER COLUMN`.

#### Template para columnas TIMESTAMP-AFFECTED (49 columnas)

```sql
ALTER TABLE "<table_name>"
  ALTER COLUMN "<column_name>" TYPE TIMESTAMPTZ(3)
  USING "<column_name>" AT TIME ZONE 'America/La_Paz';
```

#### Template para columnas UTC-NOON (16 columnas)

```sql
ALTER TABLE "<table_name>"
  ALTER COLUMN "<column_name>" TYPE TIMESTAMPTZ(3)
  USING "<column_name>" AT TIME ZONE 'UTC';
```

#### Estructura recomendada del archivo SQL

El archivo DEBE estar organizado por tabla, con comentarios de categoría para facilitar revisión:

```sql
-- ============================================================
-- TIMESTAMP-AFFECTED: datos naive BO-local → USING 'America/La_Paz'
-- (49 columnas — representan instantes reales en el tiempo)
-- ============================================================

-- organizations
ALTER TABLE "organizations"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- custom_roles
ALTER TABLE "custom_roles"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "custom_roles"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- ... (resto de columnas TIMESTAMP-AFFECTED)

-- ============================================================
-- UTC-NOON: datos ya en UTC vía toNoonUtc() → USING 'UTC'
-- (16 columnas — representan fechas calendario como TIMESTAMPTZ)
-- ============================================================

-- chicken_lots
ALTER TABLE "chicken_lots"
  ALTER COLUMN "startDate" TYPE TIMESTAMPTZ(3)
  USING "startDate" AT TIME ZONE 'UTC';
ALTER TABLE "chicken_lots"
  ALTER COLUMN "endDate" TYPE TIMESTAMPTZ(3)
  USING "endDate" AT TIME ZONE 'UTC';

-- ... (resto de columnas UTC-NOON)
```

#### Mapeo tabla SQL → modelo Prisma

| Modelo Prisma | Tabla SQL (@@map) |
|---------------|-------------------|
| Organization | `organizations` |
| CustomRole | `custom_roles` |
| OrganizationMember | `organization_members` |
| User | `users` |
| Document | `documents` |
| ChatMessage | `chat_messages` |
| AgentRateLimit | `agent_rate_limits` |
| Farm | `farms` |
| ChickenLot | `chicken_lots` |
| Expense | `expenses` |
| MortalityLog | `mortality_logs` |
| JournalEntry | `journal_entries` |
| FiscalPeriod | `fiscal_periods` |
| Contact | `contacts` |
| AccountsReceivable | `accounts_receivable` |
| AccountsPayable | `accounts_payable` |
| OrgSettings | `org_settings` |
| Dispatch | `dispatches` |
| ProductType | `product_types` |
| Payment | `payments` |
| OperationalDocType | `operational_doc_types` |
| Purchase | `purchases` |
| PurchaseDetail | `purchase_details` |
| Sale | `sales` |
| AuditLog | `audit_logs` |
| IvaPurchaseBook | `iva_purchase_books` |
| IvaSalesBook | `iva_sales_books` |
| OrgProfile | `org_profile` |
| DocumentSignatureConfig | `document_signature_configs` |

> **Nota**: los nombres exactos de las tablas SQL se pueden verificar con los decoradores `@@map()` en `schema.prisma`. Si alguna tabla no tiene `@@map`, Prisma usa el nombre en snake_case plural por default.

### Paso 4 — Verificación del SQL antes de aplicar (ver sección Pre-apply)

### Paso 5 — Aplicar la migración

```bash
pnpm prisma migrate dev
```

Sin `--create-only`. Prisma aplica el archivo `.sql` editado. PostgreSQL ejecuta todos los ALTER en una única transacción implícita por archivo de migración.

---

## Fix del cursor en `audit.repository.ts`

### Líneas exactas a cambiar

**Archivo**: `features/audit/audit.repository.ts`

**Líneas 95-97** (verificado en el archivo actual):

```typescript
// ANTES (incorrecto post-migración):
${cursorCreatedAt}::timestamp IS NULL
OR awp."createdAt" <  ${cursorCreatedAt}::timestamp
OR (awp."createdAt" = ${cursorCreatedAt}::timestamp AND awp.id < ${cursorId}::text)

// DESPUÉS (correcto con TIMESTAMPTZ):
${cursorCreatedAt}::timestamptz IS NULL
OR awp."createdAt" <  ${cursorCreatedAt}::timestamptz
OR (awp."createdAt" = ${cursorCreatedAt}::timestamptz AND awp.id < ${cursorId}::text)
```

**Cambio**: reemplazar `::timestamp` por `::timestamptz` en las 3 ocurrencias dentro del bloque WHERE de la función `listFlat`.

### Por qué este cambio es necesario

El cursor se serializa como `last.createdAt.toISOString()` (línea 107 del mismo archivo) — produce un string ISO-8601 con sufijo Z (UTC). Con la columna como `TIMESTAMPTZ(3)`, el cast `::timestamp` descartaría la información de timezone del string antes de la comparación, produciendo comparaciones incorrectas en rangos que crucen la medianoche UTC (`04:00:00Z` = medianoche BO-local).

### Cambios adicionales requeridos

**No se requieren cambios** en:
- Tipos TypeScript: el tipo de `cursorCreatedAt` es `string | null` — sigue siendo un string ISO, solo cambia el cast SQL.
- `AuditCursor` interface: sigue siendo `{ createdAt: string; id: string }`.
- Helpers que generan el cursor: `nextCursor = { createdAt: last.createdAt.toISOString(), id: last.id }` (línea 107) — correcto, produce ISO-Z.
- `getVoucherHistory` en el mismo repositorio: no usa cursor pagination, no necesita cambio.

### Inclusión en el PR

Este fix va en el mismo commit que la migración SQL, o como un commit separado previo dentro del mismo PR. Orden recomendado:

1. **Commit A**: editar `schema.prisma` (agregar `@db.Timestamptz(3)`)
2. **Commit B**: agregar la migración SQL editada manualmente
3. **Commit C**: fix `::timestamp` → `::timestamptz` en `audit.repository.ts`

Alternativamente, commits A+B pueden unificarse. Lo importante: los 3 cambios van en el mismo PR.

---

## Plan de verificación pre-apply

Antes de ejecutar `pnpm prisma migrate dev` (sin `--create-only`):

### 1. Verificación del schema.prisma

```bash
# Todos los DateTime deben tener @db.Timestamptz(3) — resultado esperado: 0 líneas
grep "DateTime" prisma/schema.prisma | grep -v "@db.Timestamptz(3)"

# Contar que son exactamente 65
grep "DateTime" prisma/schema.prisma | grep "@db.Timestamptz(3)" | wc -l
# Esperado: 65
```

### 2. Inspección visual del SQL editado

Checklist para el archivo `.sql` antes de aplicar:

- [ ] **Total de ALTER COLUMN**: exactamente 65
  ```bash
  grep -c "ALTER COLUMN" prisma/migrations/*_timestamptz_migration/migration.sql
  # Esperado: 65
  ```
- [ ] **Ningún ALTER sin USING**: cero ocurrencias de `TYPE TIMESTAMPTZ` sin `USING`
  ```bash
  grep "TYPE TIMESTAMPTZ" prisma/migrations/*_timestamptz_migration/migration.sql | grep -v "USING"
  # Esperado: 0 líneas
  ```
- [ ] **Count USING La_Paz**: exactamente 49
  ```bash
  grep -c "AT TIME ZONE 'America/La_Paz'" prisma/migrations/*_timestamptz_migration/migration.sql
  # Esperado: 49
  ```
- [ ] **Count USING UTC**: exactamente 16
  ```bash
  grep -c "AT TIME ZONE 'UTC'" prisma/migrations/*_timestamptz_migration/migration.sql
  # Esperado: 16
  ```
- [ ] **Suma**: 49 + 16 = 65 ✓
- [ ] **Revisión visual de las 16 UTC-NOON**: confirmar que ninguna columna TIMESTAMP-AFFECTED está listada en la sección UTC.
- [ ] **Revisión visual de las 49 TIMESTAMP-AFFECTED**: confirmar que ninguna columna UTC-NOON está en la sección BO-local.

### 3. Dry-run

Prisma no soporta un dry-run formal de `migrate dev`. Las alternativas disponibles:

- **`pnpm prisma migrate diff`**: genera el diff entre el schema actual y el SQL de migración, sin aplicarlo. Permite verificar que Prisma reconoce el migration file correctamente.
  ```bash
  pnpm prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --script
  ```
- **Verificación en DB de test local**: antes de aplicar en la DB principal, se puede aplicar en una DB de test vacía con `DATABASE_URL=<test_db> pnpm prisma migrate dev`. Como la base solo tiene datos de ejemplo, el riesgo de pérdida es bajo, pero tener una DB auxiliar es una buena práctica.

---

## Plan de verificación post-apply

Una vez ejecutado `pnpm prisma migrate dev` exitosamente:

### 1. Verificar el tipo de cada columna en PostgreSQL

```sql
-- Verificar tipo de columna en una tabla representativa:
SELECT column_name, data_type, datetime_precision
FROM information_schema.columns
WHERE table_name = 'audit_logs'
  AND column_name = 'createdAt';
-- Esperado: data_type = 'timestamp with time zone', datetime_precision = 3

-- Script completo para verificar todas las tablas:
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE data_type = 'timestamp without time zone'
  AND table_schema = 'public';
-- Esperado: 0 filas (ninguna columna debe quedar como TIMESTAMP sin TZ)
```

El `\d audit_logs` en psql también muestra el tipo directamente.

### 2. Verificar corrección de un timestamp histórico

Si existen filas insertadas en la DB de desarrollo antes de la migración:

```sql
-- Supongamos que existe una fila de audit con un createdAt conocido.
-- Antes de migrar: el valor naive almacenado era, por ej., '2026-04-26T22:30:00' (BO-local 22:30).
-- Después de migrar con USING 'America/La_Paz': debe ser '2026-04-27T02:30:00Z' (22:30 BO = 02:30 UTC del día siguiente).
-- La consulta:
SELECT id, "createdAt", "createdAt" AT TIME ZONE 'America/La_Paz' AS "createdAt_local"
FROM audit_logs
ORDER BY "createdAt" DESC
LIMIT 5;
-- La columna "createdAt_local" debe mostrar la hora correcta en BO (la que el usuario vio en pantalla antes de migrar).
```

Para un timestamp de referencia conocido (ej. creado hoy a las 18:30 BO-local):
- Antes de migrar (con TIMESTAMP): se leía como `2026-04-26T18:30:00.000Z` (UTC falso, -4h del instante real)
- Después de migrar (con TIMESTAMPTZ): debe leerse como `2026-04-26T22:30:00.000Z` (UTC real)
- `AT TIME ZONE 'America/La_Paz'` sobre el valor migrado debe dar `2026-04-26T18:30:00` BO ✓

### 3. Smoke test del módulo audit en la UI

1. Navegar a `/[orgSlug]/audit` en la app local.
2. Verificar que la página carga sin errores (no 500).
3. Verificar que las cards de auditoría muestran hora (no solo fecha) y que la hora coincide con la hora real del evento en Bolivia.
4. Navegar entre páginas (scroll down o cargar más) para verificar que la paginación cursor-based funciona sin duplicados ni filas faltantes.
5. Verificar que un rango de fechas que cruza la medianoche local (ej. 23:50 a 00:10) devuelve todas las filas en orden correcto.

### 4. Tests y type-check

```bash
pnpm tsc --noEmit
# Esperado: 0 errores

pnpm test
# Esperado: todos los tests en verde (los mocks de tests usan new Date("...Z") — correctos con TIMESTAMPTZ)
```

Los tests unitarios del módulo audit (si usan mocks con timestamps UTC) deben seguir pasando sin cambios porque la interfaz TypeScript (`Date`) no cambia — solo cambia el tipo de columna en la DB.

---

## Riesgos técnicos y mitigaciones (design level)

### R-D1 (CRÍTICO) — Atomicidad del ALTER de 65 columnas en PostgreSQL

**Riesgo**: ¿Es atómica la migración? ¿Qué pasa si un ALTER falla a mitad?

**Análisis**: Prisma ejecuta el archivo SQL de migración dentro de una transacción implícita de PostgreSQL. PostgreSQL soporta DDL transaccional — un `ALTER TABLE ... ALTER COLUMN TYPE` puede hacer rollback. Si cualquier ALTER falla (ej. violación de constraint, tipo incompatible, falta de extensión), **toda la transacción hace rollback** y ninguna tabla queda parcialmente migrada.

**Mitigación**:
- El checklist pre-apply (verificar que todos los ALTERs tienen USING) reduce el riesgo de fallo por casting incorrecto.
- Si la migración falla, el estado de la DB es el anterior (sin cambios). Se puede corregir el SQL y reintentar.
- Prisma registra la migración como aplicada solo si el SQL termina con éxito.

**Trade-off**: la atomicidad es la razón por la que se eligió la opción de migración única (vs. batch). El único costo es que un error en cualquiera de las 65 columnas revierte todo — lo que implica que el SQL debe estar correcto antes de aplicar.

---

### R-D2 (ALTO) — Table lock en producción futura

**Riesgo**: PostgreSQL adquiere un `ACCESS EXCLUSIVE` lock por tabla durante un `ALTER COLUMN ... TYPE`. Con 65 columnas en 29 tablas, si la tabla tiene muchas filas (ej. `audit_logs` con millones de registros), el ALTER puede durar segundos o minutos, bloqueando lecturas y escrituras concurrentes.

**Mitigación para entorno actual (desarrollo)**:
- La DB de desarrollo tiene volumen pequeño. El riesgo de downtime es negligible.
- No hay usuarios concurrentes durante la migración.

**Para producción futura (documentar en PR)**:
- Evaluar `pg_repack` o `ALTER TABLE ... RENAME COLUMN` + columna shadow para migraciones online.
- Considerar una ventana de mantenimiento.
- El PR debe incluir una nota explícita advirtiendo que este approach (ALTER directo) no es adecuado para producción con tablas de alto volumen.

---

### R-D3 (MEDIO) — Conexiones abiertas durante el ALTER

**Riesgo**: conexiones activas de la app (Next.js con Prisma connection pool) que tienen transacciones abiertas pueden impedir que el `ALTER TABLE` adquiera su lock, resultando en una espera indefinida (deadlock potencial o timeout).

**Mitigación**:
- Aplicar la migración con la app parada (o con el pool de conexiones drenado).
- En desarrollo: cerrar el servidor de Next.js antes de correr `pnpm prisma migrate dev`.
- Prisma migrate dev lanza el servidor de migraciones directamente contra la DB — no va por el pool de la app.

---

### R-D4 (BAJO) — El nombre de tabla `org_settings` podría diferir

**Riesgo**: `OrgSettings` no tiene `@@map` visible en el schema read (líneas 675-676). Si el nombre de tabla generado por Prisma difiere de `org_settings`, el SQL editado manualmente fallaría al referenciar la tabla incorrecta.

**Mitigación**: antes de editar el SQL, verificar los nombres de tabla en el SQL generado por Prisma. El SQL autogenerado siempre usa los nombres correctos — solo hay que transcribirlos al editar.

---

### R-D5 (BAJO) — `PurchaseDetail.fecha` es nullable (`DateTime?`)

**Riesgo**: una columna `TIMESTAMP(3) NULL` que contiene valores NULL. El `ALTER ... TYPE TIMESTAMPTZ(3) USING "fecha" AT TIME ZONE 'UTC'` en PostgreSQL trata los NULL como NULL — la conversión es segura. Sin embargo, si existe algún registro con un valor naive que no sea UTC-noon, el `USING 'UTC'` lo preservaría tal cual (interpretándolo como UTC), lo que podría ser incorrecto.

**Mitigación**: dado que la decisión humana es tratar toda esta columna como UTC-NOON (decisión de uniformidad de schema), el riesgo es aceptado. Si en el futuro se determina que algunos valores de `fecha` eran naive BO-local, se requeriría una migración de corrección separada.

---

## Decisiones de diseño abiertas

Ninguna. Todas las ambigüedades del explore fueron resueltas por el usuario y son vinculantes. El grep de `deactivatedAt` confirmó que la decisión humana es correcta.

---

## Apéndice — Tabla de verificación SQL completa

Para uso en la revisión final del `.sql` editado, esta es la lista completa de (tabla, columna, USING):

### TIMESTAMP-AFFECTED (49) — `AT TIME ZONE 'America/La_Paz'`

| Tabla SQL | Columna |
|-----------|---------|
| organizations | createdAt |
| custom_roles | createdAt |
| custom_roles | updatedAt |
| organization_members | deactivatedAt |
| users | createdAt |
| documents | createdAt |
| chat_messages | createdAt |
| agent_rate_limits | windowStart |
| agent_rate_limits | updatedAt |
| farms | createdAt |
| farms | updatedAt |
| chicken_lots | createdAt |
| chicken_lots | updatedAt |
| expenses | createdAt |
| mortality_logs | createdAt |
| journal_entries | createdAt |
| journal_entries | updatedAt |
| fiscal_periods | closedAt |
| fiscal_periods | createdAt |
| fiscal_periods | updatedAt |
| contacts | createdAt |
| contacts | updatedAt |
| accounts_receivable | createdAt |
| accounts_receivable | updatedAt |
| accounts_payable | createdAt |
| accounts_payable | updatedAt |
| org_settings | createdAt |
| org_settings | updatedAt |
| dispatches | createdAt |
| dispatches | updatedAt |
| product_types | createdAt |
| product_types | updatedAt |
| payments | createdAt |
| payments | updatedAt |
| operational_doc_types | createdAt |
| operational_doc_types | updatedAt |
| purchases | createdAt |
| purchases | updatedAt |
| sales | createdAt |
| sales | updatedAt |
| audit_logs | createdAt |
| iva_purchase_books | createdAt |
| iva_purchase_books | updatedAt |
| iva_sales_books | createdAt |
| iva_sales_books | updatedAt |
| org_profile | createdAt |
| org_profile | updatedAt |
| document_signature_configs | createdAt |
| document_signature_configs | updatedAt |

### UTC-NOON (16) — `AT TIME ZONE 'UTC'`

| Tabla SQL | Columna |
|-----------|---------|
| chicken_lots | startDate |
| chicken_lots | endDate |
| expenses | date |
| mortality_logs | date |
| journal_entries | date |
| fiscal_periods | startDate |
| fiscal_periods | endDate |
| accounts_receivable | dueDate |
| accounts_payable | dueDate |
| dispatches | date |
| payments | date |
| purchases | date |
| purchase_details | fecha |
| sales | date |
| iva_purchase_books | fechaFactura |
| iva_sales_books | fechaFactura |

> **Nota final**: `purchase_details` tiene `fecha` como `DateTime?` (nullable). La cláusula `USING "fecha" AT TIME ZONE 'UTC'` en PostgreSQL maneja NULL correctamente (NULL permanece NULL).
