# Capability: persistence-timezone

**Status**: Active
**Source change**: `timestamptz-migration` (archived)

## Purpose

Todos los campos `DateTime` de Prisma que representan instantes en el tiempo DEBEN almacenarse como `TIMESTAMPTZ(3)` en PostgreSQL. Esta capacidad cubre el contrato de almacenamiento de instantes, la preservación semántica de datos históricos durante la migración, y la categorización explícita del SQL que distingue dos orígenes de datos distintos.

## Contexto

El sistema almacenaba todos los campos `DateTime` de Prisma como `TIMESTAMP(3)` (sin timezone). node-postgres escribe un `Date` de JavaScript en una columna `TIMESTAMP` usando el timezone de sesión de Postgres (`America/La_Paz`, UTC-4): el valor queda almacenado como naive-local. Al leerlo, node-postgres lo asigna a UTC directamente, produciendo una discrepancia de **4 horas hacia atrás** respecto al instante real.

La migración lleva las 65 columnas `DateTime` del schema a `TIMESTAMPTZ(3)`. El SQL de migración requiere dos cláusulas `USING` distintas según la semántica del dato almacenado:

| Categoría | Columnas | Cláusula USING |
|-----------|----------|----------------|
| **TIMESTAMP-AFFECTED** | 49 columnas (todos los `createdAt`, `updatedAt`, `closedAt`, `windowStart`, `deactivatedAt`) | `USING "col" AT TIME ZONE 'America/La_Paz'` |
| **UTC-NOON** | 16 columnas (`Sale.date`, `Purchase.date`, `Dispatch.date`, `Payment.date`, `JournalEntry.date`, `FiscalPeriod.startDate/endDate`, `ChickenLot.startDate/endDate`, `Expense.date`, `MortalityLog.date`, `PurchaseDetail.fecha`, `IvaPurchaseBook.fechaFactura`, `IvaSalesBook.fechaFactura`, `AccountsReceivable.dueDate`, `AccountsPayable.dueDate`) | `USING "col" AT TIME ZONE 'UTC'` |

> **Nota**: la lista exhaustiva de las 65 columnas con su categoría está en `openspec/changes/archive/timestamptz-migration/design.md` (Inventario columna-por-columna — Tabla canónica). Esa tabla es la fuente canónica para la generación del SQL.

> **Nota sobre la categoría UTC-NOON**: el scope final decidido migra las 65 columnas sin exenciones. Las columnas que en la exploración se catalogaron como DATE-CALENDAR-NOON/AMBIGUA se migran igualmente a TIMESTAMPTZ, usando `USING "col" AT TIME ZONE 'UTC'` para preservar su semántica UTC-noon sin alterarla.

---

## Requirements

### REQ-TZ.1 — Todas las columnas DateTime del schema se almacenan como TIMESTAMPTZ(3)

Todas las columnas declaradas como `DateTime` (o `DateTime?`) en `prisma/schema.prisma` DEBEN mapearse a `TIMESTAMPTZ(3)` en PostgreSQL. Ninguna columna `DateTime` del schema puede quedar como `TIMESTAMP(3)` (sin timezone) post-migración.

#### Scenarios

##### S1 — `createdAt` de cualquier modelo se persiste como instante UTC absoluto
- **Given** un modelo con columna `createdAt @default(now())`
- **When** se inserta una nueva fila
- **Then** la columna se almacena como `TIMESTAMPTZ(3)` y representa el instante UTC real del momento de inserción, sin ambigüedad de zona horaria

##### S2 — `updatedAt` refleja el instante UTC real de la última modificación
- **Given** un modelo con columna `updatedAt @updatedAt`
- **When** se actualiza cualquier campo de la fila
- **Then** `updatedAt` se actualiza a un valor `TIMESTAMPTZ(3)` que representa el instante UTC real de la modificación

##### S3 — Re-render correcto en timezone del cliente
- **Given** una fila almacenada con `createdAt` como `TIMESTAMPTZ(3)` representando un instante UTC real
- **When** se lee desde el cliente y se formatea con `formatDateTimeBO` (que usa `Intl.DateTimeFormat` con `timeZone: "America/La_Paz"`)
- **Then** la hora mostrada coincide con la hora real del evento en `America/La_Paz` (UTC-4), sin discrepancia de 4 horas

##### S4 — Inspección directa de la columna en PostgreSQL muestra TIMESTAMPTZ
- **Given** la migración `timestamptz_migration` ha sido aplicada
- **When** se ejecuta `\d <table_name>` en psql para cualquier tabla que contenía columnas `DateTime`
- **Then** cada columna `DateTime` aparece con tipo `timestamp(3) with time zone` (equivalente a `TIMESTAMPTZ(3)`) y ninguna aparece como `timestamp without time zone`

##### S5 — node-postgres lee TIMESTAMPTZ correctamente como UTC
- **Given** una fila cuya columna `createdAt` fue almacenada con el instante `2026-04-27T16:30:00Z` (UTC)
- **When** Prisma/node-postgres la lee y la devuelve como `Date` de JavaScript
- **Then** `createdAt.toISOString()` retorna `"2026-04-27T16:30:00.000Z"` (el instante UTC real, sin shift de 4 horas)

---

### REQ-TZ.2 — La migración SQL preserva la semántica de los datos históricos

El archivo SQL de migración DEBE usar la cláusula `USING ... AT TIME ZONE` correcta para cada columna según su categoría de origen. Ningún `ALTER TABLE ... ALTER COLUMN ... TYPE TIMESTAMPTZ(3)` puede quedar sin su cláusula `USING`.

La distinción es invariante: aplicar `AT TIME ZONE 'America/La_Paz'` sobre datos UTC-noon les restaría 4 horas y corrompería los valores; aplicar `AT TIME ZONE 'UTC'` sobre datos naive BO-local los trataría como UTC y también los corrompería.

#### Scenarios

##### S1 — Dato naive BO-local (TIMESTAMP-AFFECTED) queda en el instante UTC correcto
- **Given** una columna `createdAt` con valor naive `2026-04-27T20:30:00` (sin timezone, almacenado cuando la sesión era `America/La_Paz`) que representa el instante real `2026-04-28T00:30:00Z` (UTC)
- **When** se aplica `ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'America/La_Paz'`
- **Then** el valor migrado se almacena como `2026-04-28T00:30:00.000+00` (UTC real) y al leerlo con node-postgres, `createdAt.toISOString()` retorna `"2026-04-28T00:30:00.000Z"`

##### S2 — Dato UTC-noon (UTC-NOON) no sufre shift horario
- **Given** una columna `date` con valor `2026-04-27T12:00:00` (sin timezone, almacenado via `toNoonUtc()` como UTC-noon)
- **When** se aplica `ALTER COLUMN "date" TYPE TIMESTAMPTZ(3) USING "date" AT TIME ZONE 'UTC'`
- **Then** el valor migrado se almacena como `2026-04-27T12:00:00.000+00` (UTC, sin modificación) y al leerlo, `date.toISOString()` retorna `"2026-04-27T12:00:00.000Z"` — idéntico al valor original

##### S3 — Casting implícito de Postgres NO debe aplicarse
- **Given** el SQL generado por `prisma migrate dev --create-only` para una columna `DateTime`
- **When** se inspecciona el archivo SQL antes de aplicar
- **Then** NO existe ningún `ALTER COLUMN ... TYPE TIMESTAMPTZ(3)` sin su cláusula `USING` — el casting implícito `TIMESTAMP → TIMESTAMPTZ` que Postgres aplica por default (que asume UTC) es incorrecto para datos naive BO-local y está prohibido en esta migración

##### S4 — La migración es atómica: fallo de un ALTER revierte todo
- **Given** el archivo SQL de migración contiene `N` sentencias `ALTER TABLE`
- **When** cualquiera de ellas falla durante `prisma migrate dev`
- **Then** toda la migración hace rollback completo — ninguna tabla queda parcialmente migrada

---

### REQ-TZ.3 — El SQL de migración categoriza explícitamente cada columna

El archivo SQL de migración generado DEBE distinguir visualmente y estructuralmente las dos categorías de `USING`. La categorización DEBE ser verificable por inspección directa del archivo SQL — no implícita ni ambigua.

#### Scenarios

##### S1 — Columnas TIMESTAMP-AFFECTED usan `AT TIME ZONE 'America/La_Paz'`
- **Given** el archivo SQL de migración `timestamptz_migration`
- **When** se grep por `AT TIME ZONE 'America/La_Paz'`
- **Then** se obtienen exactamente los `ALTER` correspondientes a las 49 columnas TIMESTAMP-AFFECTED — no más, no menos

##### S2 — Columnas UTC-NOON usan `AT TIME ZONE 'UTC'`
- **Given** el archivo SQL de migración `timestamptz_migration`
- **When** se grep por `AT TIME ZONE 'UTC'`
- **Then** se obtienen exactamente los `ALTER` correspondientes a las 16 columnas UTC-NOON — no más, no menos

##### S3 — Ningún ALTER carece de cláusula USING
- **Given** el archivo SQL de migración
- **When** se cuenta el total de `ALTER COLUMN ... TYPE TIMESTAMPTZ`
- **Then** el total es exactamente 65 y cada uno contiene exactamente una cláusula `USING`

---

### REQ-TZ.4 — El schema Prisma refleja `@db.Timestamptz(3)` en los 65 campos

`prisma/schema.prisma` DEBE agregar la anotación `@db.Timestamptz(3)` a cada campo `DateTime` (y `DateTime?`). Esta anotación es el contrato Prisma que garantiza que `prisma migrate dev` genere `TIMESTAMPTZ(3)` en futuros cambios y que el cliente Prisma interprete correctamente el OID `1184` de PostgreSQL.

#### Scenarios

##### S1 — `@db.Timestamptz(3)` presente en cada campo DateTime
- **Given** `prisma/schema.prisma` post-cambio
- **When** se grep por `DateTime` en el schema
- **Then** cada ocurrencia es `DateTime @db.Timestamptz(3)` o `DateTime? @db.Timestamptz(3)` — ninguna queda sin la anotación `@db`

##### S2 — `prisma generate` no produce errores de tipo
- **Given** el schema con los 65 campos anotados con `@db.Timestamptz(3)`
- **When** se ejecuta `prisma generate`
- **Then** el comando termina con exit code 0 y el cliente generado tipa los campos como `Date` de JavaScript

##### S3 — Nuevas escrituras post-migración se almacenan correctamente
- **Given** el schema migrado y la DB con columnas `TIMESTAMPTZ(3)`
- **When** se crea una nueva entidad (ej. `prisma.sale.create(...)`) con `date: new Date("2026-05-01T12:00:00Z")`
- **Then** el valor se almacena en la columna `TIMESTAMPTZ(3)` como `2026-05-01T12:00:00.000+00` y al leerlo con Prisma retorna `new Date("2026-05-01T12:00:00.000Z")`

---

### REQ-TZ.5 — El trigger `audit_trigger_fn()` no requiere modificación

Los triggers PostgreSQL existentes que usan `NOW()` para poblar `audit_logs.createdAt` DEBEN seguir funcionando sin cambios de código. La migración a `TIMESTAMPTZ(3)` en la columna receptora es suficiente para que `NOW()` (que retorna `TIMESTAMPTZ` nativo) se almacene correctamente.

#### Scenarios

##### S1 — INSERT via trigger post-migración almacena instante UTC real
- **Given** la columna `audit_logs.createdAt` ha sido migrada a `TIMESTAMPTZ(3)`
- **When** un trigger `audit_trigger_fn()` se dispara por una mutación en `sales`
- **Then** la fila de `audit_logs` insertada tiene `createdAt` como un instante `TIMESTAMPTZ` que representa el momento UTC real de la operación

##### S2 — El mismo `audit_trigger_fn()` funciona sin cambios de código SQL
- **Given** la función `audit_trigger_fn()` en las migraciones anteriores usa `NOW()` para `createdAt`
- **When** se aplica la migración `timestamptz_migration` (sin tocar las funciones trigger)
- **Then** `audit_trigger_fn()` sigue compilando y ejecutándose sin error — no se requieren cambios en la definición de la función

---

### REQ-TZ.6 — `session_timezone` forzado a `UTC` en el adapter Prisma

El adapter `@prisma/adapter-pg` DEBE configurarse para que cada conexión del pool inicialice `session_timezone='UTC'`. Esta invariante es **crítica para la correctness de las escrituras y lecturas de TIMESTAMPTZ desde código JS**: el adapter `@prisma/adapter-pg@7.7.0` y versiones similares descartan información de zona horaria en ambas direcciones del wire (escritura: `formatDateTime` envía string naive sin sufijo `Z` ni `+00`; lectura: `normalize_timestamptz` reemplaza el offset real por `+00:00` mediante regex). Con `session_timezone` distinto de `UTC`, esos comportamientos producen un shift sistemático del instante real igual al offset de la zona de sesión.

Esta invariante NO es decorativa — su ausencia reintroduce los bugs originales del SDD aunque las columnas sean `TIMESTAMPTZ` y el adapter no haya cambiado.

#### Scenarios

##### S1 — `lib/prisma.ts` configura el adapter con `options: '-c timezone=UTC'`
- **Given** el archivo `lib/prisma.ts` instancia `new PrismaPg({ ... })`
- **When** se inspecciona el constructor del adapter
- **Then** las opciones del pool incluyen `options: '-c timezone=UTC'` (o equivalente como `?options=-c%20timezone=UTC` en `DATABASE_URL`) para forzar `session_timezone='UTC'` en cada conexión inicializada

##### S2 — `SHOW TimeZone` retorna `UTC` en cualquier conexión Prisma
- **Given** una operación cualquiera contra la DB vía Prisma (`prisma.$queryRaw`, `prisma.X.findMany`, etc.)
- **When** se ejecuta `SHOW TimeZone` en la misma sesión
- **Then** el resultado es `UTC`

##### S3 — Nuevas escrituras desde código JS preservan el instante UTC real
- **Given** la config del adapter con `options: '-c timezone=UTC'` aplicada
- **When** se ejecuta `prisma.X.create({ data: { dateField: new Date("2026-04-27T06:00:00.000Z") } })` con cualquier modelo que tenga columna TIMESTAMPTZ
- **Then** la columna almacena `2026-04-27 06:00:00.000+00` (UTC real, sin shift de +4h)
- **AND** el comportamiento se aplica también a `@updatedAt` (que internamente usa `new Date()` en JS) — los UPDATE preservan el instante real

##### S4 — Lecturas desde código JS reconstruyen el instante UTC real
- **Given** la columna almacena `2026-04-27 06:00:00.000+00` (UTC real)
- **When** Prisma la lee y la entrega como `Date` JS
- **Then** `date.toISOString()` retorna `"2026-04-27T06:00:00.000Z"` (sin shift de -4h del adapter `normalize_timestamptz`)
- **AND** `formatDateTimeBO(date)` muestra la hora correcta en `America/La_Paz` (= `02:00` el 27/04)

##### S5 — Reversión del adapter config reintroduce los bugs (verificación negativa, NO testear)
- **Given** la config del adapter SIN `options: '-c timezone=UTC'` y `session_timezone` de la DB en cualquier valor distinto de UTC (ej. `'America/La_Paz'`)
- **When** se ejecuta `prisma.X.create({ data: { dateField: new Date("...Z") } })`
- **Then** el dato almacenado sufre un shift sistemático igual al offset de la zona de sesión (ej. +4h con La_Paz)
- **AND** las lecturas posteriores producen Date 4h antes del instante real
- **Nota**: este scenario documenta la condición de regresión. NO debe convertirse en un test automatizado — la fix es la invariante S1, no un test que reproduzca el bug

---

## Out of Scope

| Item | Justificación |
|------|---------------|
| Cambio del TZ a nivel de DB con `ALTER DATABASE ... SET timezone` | No se aplica a nivel de servidor; el cambio se hace a nivel de adapter Prisma vía `options: '-c timezone=UTC'` (REQ-TZ.6). Esto contiene el alcance al pool de conexiones de la app sin afectar otros consumidores (CLI psql, scripts externos, futuros servicios) |
| Refactor de `toNoonUtc()` | La función sigue siendo válida para nuevas escrituras de fechas calendario |
| Normalización de `dueDate` en `receivables.repository.ts` (agregar `toNoonUtc()`) | Deuda técnica separada; no es parte de la migración de tipo |
| Eliminación del patrón UTC-noon | Cambio de semántica que requiere su propio SDD |
| Tests de integración contra PostgreSQL real | Cambio de infraestructura de testing fuera del scope |
| Seed data con timestamps | No existe `prisma/seed.ts` actualmente |
| Resolución de `TZ=America/La_Paz` en el proceso server-side (`startOfMonth`/`endOfMonth`) | Deuda técnica separada documentada en `lib/date-utils.ts` |
