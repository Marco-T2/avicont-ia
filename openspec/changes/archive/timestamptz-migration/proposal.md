# Proposal: timestamptz-migration

**Fecha**: 2026-04-27
**Cambio**: `timestamptz-migration`
**Estado**: listo para `sdd-spec` y `sdd-design`

---

## Intent

El sistema almacena timestamps en columnas `TIMESTAMP(3)` (sin timezone). Cuando node-postgres escribe un valor `Date` de JavaScript en una columna `TIMESTAMP`, Postgres lo interpreta como hora local de la sesión (`America/La_Paz`, UTC-4). El valor queda almacenado sin información de timezone (naive). Al leerlo, node-postgres lo recibe como naive y lo asigna a UTC directamente — produciendo una discrepancia de **4 horas hacia atrás** respecto al instante real.

El impacto más visible es en el módulo de auditoría: `AuditLog.createdAt` registra cada operación contable con un timestamp 4 horas adelantado respecto a la hora real del usuario. El cursor de paginación del audit (`::timestamp` cast en `audit.repository.ts`) agrava el problema: comparar una columna TIMESTAMP con un cursor ISO-8601 produce resultados incorrectos en rangos de fecha que crucen la medianoche local, lo que significa que en producción ciertas páginas de auditoría omitirán registros o los duplicarán silenciosamente.

Más allá del audit, el mismo bug afecta a 49 columnas en distintos modelos: `createdAt`, `updatedAt`, `closedAt`, `windowStart`, `deactivatedAt`, y otras que representan instantes reales en el tiempo. Toda observabilidad, trazabilidad, y eventual exportación de datos queda distorsionada en 4 horas. La corrección es migrar todas esas columnas a `TIMESTAMPTZ(3)` con la cláusula `USING ... AT TIME ZONE 'America/La_Paz'` para reinterpretar correctamente los datos históricos.

Adicionalmente, el usuario ha decidido aprovechar este cambio para unificar el schema completo: las 16 columnas que actualmente usan el patrón UTC-noon (fechas de comprobantes escritas via `toNoonUtc()`) también migrarán a `TIMESTAMPTZ(3)`, usando `USING "col" AT TIME ZONE 'UTC'` para preservar su semántica sin alterarla. La justificación es pragmática: la base está en desarrollo sin datos productivos, y un schema uniforme elimina la ambigüedad de tener columnas `TIMESTAMP` con semánticas diferentes según el modelo.

---

## Scope

Lo que entra en este cambio:

- **Migración de schema**: las 65 columnas `DateTime` del `schema.prisma` pasan a `DateTime @db.Timestamptz(3)`. Sin exenciones.
- **Migración SQL manual**: un único archivo de migración Prisma (generado con `--create-only` y editado a mano) con dos categorías de cláusula `USING`:
  - `USING "col" AT TIME ZONE 'America/La_Paz'` para las 49 columnas TIMESTAMP-AFFECTED (datos naive BO-local).
  - `USING "col" AT TIME ZONE 'UTC'` para las 16 columnas UTC-noon (datos ya en UTC vía `toNoonUtc()`).
- **Fix de cursor en `audit.repository.ts`**: cambiar el cast `::timestamp` a `::timestamptz` en la cláusula WHERE de la paginación del audit. Este fix es atómico con la migración — sin él, el módulo de audit queda funcionalmente roto post-migración.
- **Documentación en el PR**: un párrafo explícito en el cuerpo del PR indicando que se omitió `pg_dump` porque la base sólo contiene datos de ejemplo, y que esta excepción NO aplica a futuras migraciones cuando haya datos productivos.

---

## Approach

La estrategia es una **migración única atómica con SQL editado manualmente**, siguiendo el proceso `--create-only` ya establecido en el proyecto (precedente en `cierre-periodo` y `voucher-types`).

**Paso 1 — Schema Prisma**: agregar `@db.Timestamptz(3)` a cada uno de los 65 campos `DateTime` en `prisma/schema.prisma`. Esto requiere que el datasource tenga activada la extensión `postgresqlExtensions` o que el provider soporte el tipo directamente — el proyecto ya usa `postgresql` como provider, y `@db.Timestamptz` es nativo de `prisma-client-js` con Postgres.

**Paso 2 — Generación del SQL base**: ejecutar `prisma migrate dev --create-only --name timestamptz_migration`. Prisma genera un archivo `.sql` con `ALTER TABLE ... ALTER COLUMN ... TYPE TIMESTAMPTZ(3)` para cada columna modificada. El SQL generado es incorrecto por defecto: Postgres aplica un casting implícito `TIMESTAMP → TIMESTAMPTZ` que asume UTC, pero los datos históricos son naive BO-local. Este es el riesgo R1 crítico identificado en el explore.

**Paso 3 — Edición manual del SQL**: agregar la cláusula `USING` correcta en cada ALTER. La clasificación de qué columnas usan `AT TIME ZONE 'America/La_Paz'` versus `AT TIME ZONE 'UTC'` se establece en el design y queda documentada en la tarea de implementación. Ningún ALTER puede quedar sin su `USING` — es la restricción más importante de esta migración.

**Paso 4 — Fix en `audit.repository.ts`**: cambiar el cast del cursor de `::timestamp` a `::timestamptz` en el mismo PR. Este fix es de una línea pero su ausencia sería un bug funcional silencioso en producción.

**Paso 5 — Aplicación**: `prisma migrate dev` (sin `--create-only`) aplica la migración editada en una transacción. Si algún ALTER falla, toda la migración hace rollback.

El approach es intencionalmente simple y conservador: una transacción, un PR, un punto de rollback. No hay pasos de backfill separados ni scripts auxiliares.

### Invariante técnico crítico (debe heredarse a design y tasks)

El SQL de migración requiere **dos cláusulas `USING` diferentes** aunque las 65 columnas terminen todas como `TIMESTAMPTZ(3)`:

| Categoría | Columnas | Cláusula USING | Razón |
|-----------|----------|----------------|-------|
| TIMESTAMP-AFFECTED | 49 (createdAt, updatedAt, closedAt, windowStart, deactivatedAt) | `USING "col" AT TIME ZONE 'America/La_Paz'` | Datos almacenados como naive BO-local; reinterpretar como instantes reales en BO-local |
| UTC-NOON | 16 (Sale.date, Purchase.date, Dispatch.date, Payment.date, JournalEntry.date, FiscalPeriod.startDate/endDate, ChickenLot.startDate/endDate, Expense.date, MortalityLog.date, PurchaseDetail.fecha, IvaPurchaseBook.fechaFactura, IvaSalesBook.fechaFactura, AccountsReceivable.dueDate, AccountsPayable.dueDate) | `USING "col" AT TIME ZONE 'UTC'` | Datos ya en UTC vía `toNoonUtc()`; preservar sin modificación |

Aplicar `AT TIME ZONE 'America/La_Paz'` sobre la categoría UTC-NOON restaría 4 horas a cada valor, rompiendo el patrón UTC-noon. Esta es la corrupción de datos más probable si el SQL se aplica sin clasificar columnas. El design y las tasks deben enumerar explícitamente qué columna va en qué categoría.

---

## Alternatives considered

| Opción | Descripción | Razón de descarte |
|--------|-------------|-------------------|
| **A (elegida)** | Migración única atómica con SQL editado manualmente | Correcta, atómica, alineada con el proceso del proyecto |
| **B — Migración por batch** | Dividir en 2-3 migraciones: audit_logs primero, luego resto | Estado intermedio inconsistente: audit correcto pero otros modelos aún con bug. Peor que el estado buggy uniforme. Descartada. |
| **C — Corrección en el cliente** | Mantener `TIMESTAMP(3)`, sumar +4h en `formatDateTimeBO` | Hack de compensación. La fuente sigue incorrecta. Queries server-side con `NOW()`, serialización ISO a APIs externas, y el cursor de audit siguen mal. Descartada definitivamente. |
| **D — Cambiar TZ de sesión de Postgres a UTC** | `postgresql.conf` `TimeZone = UTC` o `options=-c timezone=UTC` en DATABASE_URL | No corrige datos históricos: las filas existentes tienen naive-BO-local bytes que con TZ=UTC se leerían como UTC, produciendo un bug diferente (+4h en lugar de -4h). Sin migración de datos, el problema cambia de signo pero no se resuelve. Descartada. |
| **E — Scope parcial (sólo TIMESTAMP-AFFECTED, excluir UTC-NOON)** | Migrar sólo las 49 columnas TIMESTAMP-AFFECTED; dejar las 16 UTC-NOON como `TIMESTAMP(3)` | Técnicamente correcto dado que las UTC-NOON no presentan el bug. Descartado por decisión del usuario: base en desarrollo, sin datos productivos, se prefiere schema uniforme. Elimina ambigüedad para nuevos desarrolladores. |

---

## Out of scope

Los siguientes cambios NO forman parte de este cambio y no deben incluirse en el mismo PR:

- **Cambiar el timezone de sesión de Postgres** (`TimeZone = UTC` en `postgresql.conf` o DATABASE_URL). La sesión de Postgres puede continuar con cualquier TZ — `TIMESTAMPTZ` es inmune al timezone de sesión en lo que respecta al almacenamiento.
- **Refactor de `toNoonUtc()`**. La función sigue siendo válida para nuevas escrituras de fechas calendario. Su eventual eliminación o reemplazo es una decisión de arquitectura de aplicación independiente de la corrección del schema.
- **Normalización de escrituras de `dueDate`** (agregar `toNoonUtc()` en `receivables.repository.ts`). El explore identificó que `dueDate` se persiste sin `toNoonUtc()`, pero corregir eso es una tarea de normalización de datos, no de migración de tipo. Queda como deuda técnica documentada.
- **Eliminación del patrón UTC-noon**. Post-migración, columnas como `Sale.date` seguirán almacenando valores UTC-noon — ahora como `TIMESTAMPTZ` correctos. Migrar esas columnas a un tipo `DATE` nativo de Postgres es un cambio de semántica que requiere su propio SDD.
- **Resolución de `TZ=America/La_Paz` en el proceso server-side**. `lib/date-utils.ts` depende de la TZ del proceso para `startOfMonth`/`endOfMonth`. Esto no cambia con esta migración y es una deuda técnica separada.
- **Tests de integración contra Postgres real**. Los tests existentes usan mocks. Agregar tests de integración que ejecuten la migración en una DB de test es un cambio de infraestructura de testing fuera del scope de esta corrección.
- **Seed data / fixtures de timestamps**. No existe `prisma/seed.ts`. Si en el futuro se agrega, los timestamps deben ser UTC explícitos (`new Date("...Z")`).

---

## Operational notes

### Excepción al procedimiento de backup (pg_dump)

El proceso estándar del proyecto para migraciones con `USING ... AT TIME ZONE` es tomar un `pg_dump` previo (precedente en `cierre-periodo/design.md:109`). **Este cambio omite el `pg_dump` porque la base sólo contiene datos de ejemplo generados durante el desarrollo — no hay datos productivos en riesgo.**

> **ADVERTENCIA para el PR**: esta excepción es específica al estado actual del proyecto (base sin datos productivos). En cualquier migración futura que modifique tipos de columna con `USING`, el `pg_dump` es OBLIGATORIO si la base tiene datos reales. Esta excepción NO establece precedente para producción.

### Prerrequisitos para aplicar en producción futura

Cuando la base tenga datos productivos y se necesite una migración similar, los pasos adicionales serán:

1. `pg_dump -Fc -f backup_pre_migration.dump <database>` antes de cualquier ALTER.
2. Verificar que el TZ de la sesión de Postgres en producción sea `America/La_Paz` (o ajustar los USING si difiere).
3. Coordinar una ventana de mantenimiento: los ALTERs sobre tablas grandes (audit_logs con millones de filas) generan full-table lock por la duración del ALTER. En producción se necesitaría migraciones online (`pg_repack`, `ALTER COLUMN ... ADD CONSTRAINT ... NOT VALID`, etc.) — que están fuera del scope de este cambio.

---

## Open questions

Ninguna. Las 5 decisiones del explore fueron respondidas por el usuario y son vinculantes para este proposal.
