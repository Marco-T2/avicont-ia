# Exploration: timestamptz-migration

**Fecha**: 2026-04-26
**Cambio**: `timestamptz-migration`
**Estado**: completo — listo para `sdd-propose`

---

## 1. Estado actual confirmado

### Inventario completo de columnas DateTime (`prisma/schema.prisma`, verificado hoy)

> Regla de clasificación aplicada:
> - **TIMESTAMP-AFFECTED**: columna que representa un instante real en el tiempo (audit, createdAt, updatedAt, rate-limit bucket, etc.) → DEBE migrar.
> - **DATE-CALENDAR-NOON**: fecha de comprobante ya persistida como UTC-noon via `toNoonUtc()` → NO migra (el patrón UTC-noon funciona correctamente y es inmune al bug de TZ).
> - **DATE-CALENDAR-LEGACY**: fecha de comprobante en columnas nullable/opcionales cuyo patrón de escritura hay que verificar.
> - **AMBIGUA**: requiere decisión humana.

| # | Modelo | Campo | Línea (aprox.) | Tipo en schema | Categoría | Justificación |
|---|--------|-------|----------------|---------------|-----------|---------------|
| 1 | Organization | createdAt | 18 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación de la org |
| 2 | CustomRole | createdAt | 60 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 3 | CustomRole | updatedAt | 61 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de última modificación |
| 4 | OrganizationMember | deactivatedAt | 74 | DateTime? | AMBIGUA | Fecha de desactivación; si se usa como "fecha efectiva" calendario → DATE-CALENDAR-NOON. Si se usa como instante de log → TIMESTAMP-AFFECTED. Verificar cómo se escribe. |
| 5 | User | createdAt | 89 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 6 | Document | createdAt | 121 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 7 | ChatMessage | createdAt | 150 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de chat; indexado en `(sessionId, createdAt)` → crítico para orden |
| 8 | AgentRateLimit | windowStart | 166 | DateTime | TIMESTAMP-AFFECTED | Bucket de hora UTC; `floorToHour()` usa setUTCMinutes/setUTCHours — ya trabaja en UTC. Migración es inocua pero correcta. |
| 9 | AgentRateLimit | updatedAt | 168 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 10 | Farm | createdAt | ~200 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 11 | Farm | updatedAt | ~201 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 12 | ChickenLot | startDate | 216 | DateTime | DATE-CALENDAR-NOON | Fecha de inicio del lote — mostrado como fecha calendario con `toLocaleDateString("es-BO")` en `farm-detail-client.tsx` y `lot-detail-client.tsx`. Se escribe vía form → confirmar que usa `toNoonUtc()` antes de persistir. Si no usa `toNoonUtc()`, es AMBIGUA. |
| 13 | ChickenLot | endDate | 217 | DateTime? | DATE-CALENDAR-NOON | Igual que startDate — fecha de cierre del lote. Mismo caveat. |
| 14 | ChickenLot | createdAt | 220 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 15 | ChickenLot | updatedAt | 221 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 16 | Expense | date | 239 | DateTime | DATE-CALENDAR-NOON | Fecha de gasto — mostrado como calendario. Verificar que usa `toNoonUtc()` al escribir. |
| 17 | Expense | createdAt | 242 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 18 | MortalityLog | date | 257 | DateTime | DATE-CALENDAR-NOON | Fecha de mortalidad — mostrado como calendario. |
| 19 | MortalityLog | createdAt | 261 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 20 | JournalEntry | date | 362 | DateTime | DATE-CALENDAR-NOON | Fecha del asiento contable — `toNoonUtc()` confirmado vía `journal.dates.ts`. |
| 21 | JournalEntry | createdAt | 375 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 22 | JournalEntry | updatedAt | 376 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 23 | FiscalPeriod | startDate | 424 | DateTime | DATE-CALENDAR-NOON | Límite del período contable — `assertMonthlyShape` usa `.getUTCDate()/.getUTCMonth()` → trabaja en UTC. Se escribe como UTC-midnight o UTC-noon. NO representa un instante. |
| 24 | FiscalPeriod | endDate | 425 | DateTime | DATE-CALENDAR-NOON | Igual que startDate. |
| 25 | FiscalPeriod | closedAt | 426 | DateTime? | TIMESTAMP-AFFECTED | Instante en que se cerró el período — lógica de close/reopen lo escribe con `new Date()`. |
| 26 | FiscalPeriod | createdAt | 429 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 27 | FiscalPeriod | updatedAt | 430 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 28 | Contact | createdAt | ~578 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 29 | Contact | updatedAt | ~579 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 30 | AccountsReceivable | dueDate | 604 | DateTime | AMBIGUA | Fecha de vencimiento — conceptualmente es "fecha calendario" (día en que vence), pero se escribe vía Zod `z.coerce.date()`. Si el form la pasa como "YYYY-MM-DD" y luego el server la persiste directamente sin `toNoonUtc()`, puede haberse almacenado como UTC-midnight. Verificar `receivables.repository.ts` línea 66. |
| 31 | AccountsReceivable | createdAt | 611 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 32 | AccountsReceivable | updatedAt | 612 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 33 | AccountsPayable | dueDate | 629 | DateTime | AMBIGUA | Mismo caso que AccountsReceivable.dueDate |
| 34 | AccountsPayable | createdAt | 639 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 35 | AccountsPayable | updatedAt | 640 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 36 | OrgSettings | createdAt | 675 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 37 | OrgSettings | updatedAt | 676 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 38 | Dispatch | date | 689 | DateTime | DATE-CALENDAR-NOON | Fecha del despacho. `dispatch.service.ts` usa `input.date.getTime()` para cálculo de dueDate — si la fecha viene de `toNoonUtc()`, es correcto. |
| 39 | Dispatch | createdAt | 706 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 40 | Dispatch | updatedAt | 707 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 41 | ProductType | createdAt | ~753 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 42 | ProductType | updatedAt | ~754 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 43 | Payment | date | 770 | DateTime | DATE-CALENDAR-NOON | Fecha del pago — `payment-form.tsx` usa `.toISOString().split("T")[0]` para mostrarla → indica que se espera UTC-noon. |
| 44 | Payment | createdAt | 781 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 45 | Payment | updatedAt | 782 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 46 | OperationalDocType | createdAt | ~806 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 47 | OperationalDocType | updatedAt | ~807 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 48 | Purchase | date | 821 | DateTime | DATE-CALENDAR-NOON | Fecha de la compra. `purchase.service.ts` usa `purchase.date.getTime()` → UTC-noon invariante. |
| 49 | Purchase | createdAt | 840 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 50 | Purchase | updatedAt | 841 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 51 | PurchaseDetail | fecha | 867 | DateTime? | DATE-CALENDAR-NOON | Fecha de flete por línea. Campo nullable. Mismo patrón que fechas de comprobante. |
| 52 | Sale | date | 914 | DateTime | DATE-CALENDAR-NOON | Fecha de la venta. `sale.service.ts` usa `sale.date.getTime()`. Confirmado UTC-noon. |
| 53 | Sale | createdAt | 924 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 54 | Sale | updatedAt | 925 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 55 | AuditLog | createdAt | 970 | DateTime @default(now()) | TIMESTAMP-AFFECTED | **Instante crítico** — indexado, usado en cursor pagination, comparado en range queries. Es el epicentro del bug confirmado. |
| 56 | IvaPurchaseBook | fechaFactura | 988 | DateTime | DATE-CALENDAR-NOON | `iva-books.repository.ts:202` usa `toNoonUtc(input.fechaFactura)` explícitamente. La columna puede haber sido escrita como UTC-noon. Leer vía `.toISOString().slice(0,10)`. NO migra. |
| 57 | IvaPurchaseBook | createdAt | 1012 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 58 | IvaPurchaseBook | updatedAt | 1013 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 59 | IvaSalesBook | fechaFactura | 1028 | DateTime | DATE-CALENDAR-NOON | Igual que IvaPurchaseBook.fechaFactura — usa `toNoonUtc()`. NO migra. |
| 60 | IvaSalesBook | createdAt | 1052 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 61 | IvaSalesBook | updatedAt | 1053 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 62 | OrgProfile | createdAt | 1097 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 63 | OrgProfile | updatedAt | 1098 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |
| 64 | DocumentSignatureConfig | createdAt | 1110 | DateTime @default(now()) | TIMESTAMP-AFFECTED | Instante de creación |
| 65 | DocumentSignatureConfig | updatedAt | 1111 | DateTime @updatedAt | TIMESTAMP-AFFECTED | Instante de modificación |

### Resumen del inventario

| Categoría | Cantidad | Acción |
|-----------|----------|--------|
| TIMESTAMP-AFFECTED | **43** | Migrar a TIMESTAMPTZ(3) + USING AT TIME ZONE |
| DATE-CALENDAR-NOON | **14** | No migrar (ya correctas) |
| AMBIGUA | **3** | Decisión humana (ver §5) |

> **Nota sobre las 43 TIMESTAMP-AFFECTED**: incluye todos los `createdAt` generados por `CURRENT_TIMESTAMP` en el server-side (DB defaults vía `NOW()`) y todos los `updatedAt` manejados por Prisma con `@updatedAt`. Ambos tipos tienen el mismo bug TZ confirmado en diagnóstico previo.

---

## 2. Opciones técnicas

### Opción A — Migración única: un ALTER por columna TIMESTAMP-AFFECTED (APROBADA)

**Descripción**: Un único archivo de migración Prisma con ~43 sentencias `ALTER TABLE ... ALTER COLUMN ... TYPE TIMESTAMPTZ(3) USING "col" AT TIME ZONE 'America/La_Paz'`. El schema Prisma actualiza cada campo con `@db.Timestamptz(3)`.

**Proceso**:
1. Editar `schema.prisma`: agregar `@db.Timestamptz(3)` a todos los campos TIMESTAMP-AFFECTED.
2. `prisma migrate dev --create-only --name timestamptz_migration` → genera el SQL base.
3. Editar el SQL generado para agregar la cláusula `USING "<col>" AT TIME ZONE 'America/La_Paz'` en cada ALTER (Prisma NO la genera automáticamente — ver §3 riesgo R1).
4. `prisma migrate dev` (sin `--create-only`) aplica la migración editada.

**Ventajas**:
- Atómico — una transacción, rollback total si falla.
- Un solo paso de revisión y aprobación.
- El backfill histórico se incluye en el ALTER mismo.
- Alineado con lo aprobado por el usuario.

**Desventajas**:
- Genera lock sobre todas las tablas simultáneamente (en un solo ALTER por tabla, Postgres hace full-table lock por la duración del ALTER). En producción con tabla grande podría causar downtime.
- Error en una tabla obliga a revisar todas.

**Veredicto**: correcto para el entorno actual (DB de volumen pequeño, no hay concurrent heavy writers en producción).

---

### Opción B — Migración por batch (audit_logs primero, resto después)

**Descripción**: Dividir en 2-3 migraciones. Primera migración: `audit_logs.createdAt` (epicentro del bug visible). Segunda: resto de tablas de alta frecuencia. Tercera: tablas de baja frecuencia.

**Ventajas**:
- Riesgo reducido en cada paso — es más fácil verificar.
- Permite validar el comportamiento post-migración en producción antes de comprometer todo.

**Desventajas**:
- Estado intermedio inconsistente: `audit_logs.createdAt` ya es correcto pero `JournalEntry.createdAt` todavía muestra -4h. Confuso.
- Más archivos de migración = más surface de review.
- El bug sigue existiendo en producción hasta que se completa el lote final.

**Veredicto**: descartada — el estado intermedio es peor que el estado buggy completo. La Opción A es preferible.

---

### Opción C — No migrar schema; corregir en el cliente

**Descripción**: Mantener `TIMESTAMP(3)`, agregar `+4h` en `formatDateTimeBO` / `formatTimeBO` para compensar el offset introducido por node-postgres.

**Por qué se descarta**:
1. Es un hack de compensación, no una corrección. La fuente de datos sigue siendo incorrecta.
2. Cualquier consulta server-side que compare timestamps con `NOW()` (ej. rate limiter, audit range queries) o que serialice a ISO string para APIs externas emitiría instantes UTC falsos.
3. El cursor de paginación del audit (`createdAt.toISOString()`) quedaría mal serializado.
4. Cuando la DB migre a UTC o node-postgres cambie su comportamiento, habría que deshacer el hack.

**Veredicto**: descartada definitivamente.

---

### Opción D — Cambiar TZ de sesión de Postgres a UTC

**Descripción**: Modificar `postgresql.conf` para que `TimeZone = UTC` en la sesión (o agregar `options=-c timezone=UTC` en la DATABASE_URL).

**Ventajas**:
- Sin migración de datos.
- Corrección instantánea.

**Desventajas**:
- Requiere acceso a la configuración del servidor PostgreSQL (o URL de conexión), que puede no estar disponible en producción.
- Los datos históricos ya almacenados como naive-BO-local seguirían siendo interpretados incorrectamente si el TZ cambia. node-postgres leería los mismos bytes pero los asignaría diferente → bug diferente, no corrección.
- **NO resuelve el problema de los datos ya almacenados**. Las filas existentes tienen naive timestamps que dicen "20:18:00" y significan BO-local. Si el session TZ pasa a UTC, node-postgres los leerá como `20:18:00 UTC` → siguen siendo incorrectos (ahora +4h en lugar de -4h).

**Veredicto**: no es una solución. Solo sería un band-aid para filas nuevas, con datos históricos aún corruptos en otra dirección.

---

## 3. Riesgos identificados

### R1 (CRÍTICO): Prisma NO genera `USING ... AT TIME ZONE` automáticamente

**Verificación**: La migración que genera `prisma migrate dev --create-only` al cambiar `DateTime` a `DateTime @db.Timestamptz(3)` produce:

```sql
ALTER TABLE "foo" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);
```

Postgres ejecuta eso con el casting implícito `TIMESTAMP → TIMESTAMPTZ`, que **asume UTC** para los bytes existentes. Pero los bytes son naive BO-local (America/La_Paz), no UTC. El casting implícito rompe los datos.

La cláusula correcta es:
```sql
ALTER TABLE "foo"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
```

**Acción requerida**: el archivo SQL generado por `--create-only` DEBE editarse manualmente antes de aplicar. Ningún ALTER debe quedar sin su `USING ... AT TIME ZONE`.

**Nota sobre el proceso `--create-only`**: este es el proceso establecido en el proyecto para migraciones con SQL custom. Hay precedente en `cierre-periodo` y `voucher-types` donde se editó el SQL antes de aplicar. Ver `openspec/changes/archive/2026-04-21-cierre-periodo/design.md`.

---

### R2 (ALTO): El trigger de auditoría `audit_trigger_fn()` usa `NOW()` — no se rompe, pero su semántica cambia

**Hallazgo**: la función `audit_trigger_fn()` en `20260406010241_monthly_close_audit_trail/migration.sql` hace:

```sql
INSERT INTO audit_logs (..., "createdAt")
VALUES (..., NOW());
```

`NOW()` en Postgres retorna un `timestamp with time zone` (TIMESTAMPTZ). Actualmente, como la columna `createdAt` es `TIMESTAMP(3)`, Postgres hace un casting implícito que convierte el `TIMESTAMPTZ` al timezone de sesión (`America/La_Paz`) y lo almacena como naive-BO-local.

Después de la migración a `TIMESTAMPTZ(3)`, `NOW()` se almacenará directamente como el instante UTC correcto. **Esto es exactamente lo que queremos** — no es un riesgo de regresión, es la corrección.

**Acción requerida**: ninguna. El trigger sigue funcionando.

---

### R3 (MEDIO): Cursor pagination del audit usa `::timestamp` cast — puede romperse post-migración

**Hallazgo**: `audit.repository.ts` línea 95:

```sql
WHERE (
  ${cursorCreatedAt}::timestamp IS NULL
  OR awp."createdAt" < ${cursorCreatedAt}::timestamp
  ...
)
```

El cursor se serializa como `last.createdAt.toISOString()` (línea 107). Una vez migrada la columna a `TIMESTAMPTZ(3)`, el cast `::timestamp` en el WHERE hace un "at local time" (sin TZ) sobre el valor de la columna. Esto puede producir comparaciones incorrectas porque `::timestamp` en Postgres descarta la información de TZ.

**El cast correcto después de la migración debería ser `::timestamptz`**, no `::timestamp`.

**Acción requerida**: la migración debe incluir un patch en `audit.repository.ts` para cambiar el cast del cursor de `::timestamp` a `::timestamptz`.

---

### R4 (BAJO): `startOfMonth` y `endOfMonth` en `date-utils.ts` usan local getters

**Hallazgo**: `startOfMonth` usa `new Date(date.getFullYear(), date.getMonth(), 1, ...)` — getters de TZ local. El código asume `TZ=America/La_Paz` en el proceso server-side.

Actualmente, el env del test tiene `TZ=America/La_Paz` y hay un comment explícito en `date-utils.ts` que documenta la dependencia. Esto no cambia con la migración TIMESTAMPTZ — sigue siendo válido. **No es un riesgo de la migración, pero es una deuda técnica a documentar.**

---

### R5 (BAJO): `deactivatedAt` en `OrganizationMember` — semántica desconocida

**Hallazgo**: la columna es `DateTime?` sin `@default(now())` y sin `@updatedAt`. No se encontró código en `features/` que la escriba (solo el migration que la crea). Si es un "fecha de desactivación que el usuario eligió" → DATE-CALENDAR-NOON. Si es "instante en que se desactivó el sistema" → TIMESTAMP-AFFECTED.

**Acción requerida**: decisión humana (ver §5, decisión #1).

---

### R6 (BAJO): `dueDate` en AccountsReceivable/AccountsPayable — escritura sin `toNoonUtc()`

**Hallazgo**: `receivables.repository.ts` línea 66 persiste `dueDate: data.dueDate` directamente. Los filtros de rangos hacen `gte`/`lte` sobre `dueDate`. Si el `dueDate` se pasó desde el form como una Date UTC-midnight, la comparación es correcta. Si se pasó como naive-local, hay un bug latente.

En el contexto del bug TZ actual, el `dueDate` leído de la DB por Prisma también viene con el mismo error (+4h), así que las comparaciones relativas siguen siendo consistentes en el estado buggy actual. Post-migración, si `dueDate` NO migra (porque es DATE-CALENDAR-NOON) pero `createdAt` SÍ migra, las comparaciones mixtas seguirán siendo correctas porque son columnas de naturaleza diferente.

**Conclusión**: el `dueDate` NO debe migrar a TIMESTAMPTZ — es una fecha-vencimiento calendario. Pero debe verificarse que se persiste consistentemente como UTC-noon (la única inconsistencia es si se compara con `createdAt` en alguna query — no se encontró evidencia de eso).

---

### R7 (BAJO): `fechaFactura` en IvaPurchaseBook/IvaSalesBook — ya usa `toNoonUtc()`

**Confirmado**: `iva-books.repository.ts:202` hace `fechaFactura: toNoonUtc(input.fechaFactura)`. Leer vía `.toISOString().slice(0,10)`. Este campo NO debe migrar.

---

### R8 (INFO): AgentRateLimit.windowStart — `floorToHour()` ya trabaja en UTC

**Confirmado**: `rate-limit.repository.ts` implementa `floorToHour` como `out.setUTCMinutes(0, 0, 0)` — usa UTC puro. La columna `windowStart` almacena instantes UTC-hour. Aunque es TIMESTAMP-AFFECTED (debe migrar para corrección formal), el comportamiento en la práctica es correcto porque los buckets ya son UTC-aligned.

Post-migración, el cambio es transparente — los valores son correctos antes y después.

---

## 4. Dependencias y blockers

### 4.1 Código que asume el comportamiento buggy actual

**Búsqueda realizada**: `formatDateBO`, `formatDateTimeBO`, `formatTimeBO`, `new Date(`, `Intl.DateTimeFormat`, comparaciones `.getTime()`.

**Resultado**: NO se encontró código que compense el bug sumando +4h. El código de display (`formatDateTimeBO`, `formatTimeBO`) ya aplica correctamente `Intl.DateTimeFormat` con `timeZone: "America/La_Paz"` — lo que significa que **cuando la fuente sea UTC real post-migración, los displays mostrarán la hora correcta automáticamente**.

**Excepción identificada**: el cursor cast `::timestamp` en `audit.repository.ts` (ver R3).

### 4.2 APIs externas que se rompen

No se identificaron APIs externas que reciban timestamps en formato dependiente del bug. Los serializers usan `.toISOString()` (producen UTC Z-suffix) y los consumidores son internos.

**Caso especial**: `purchase.service.ts:94` y `sale.service.ts:93` hacen `alloc.payment.date.toISOString().split("T")[0]` para obtener la fecha del pago como string. Como `payment.date` es DATE-CALENDAR-NOON (no migra), esto sigue siendo correcto post-migración.

### 4.3 Seed data / fixtures

**Tests**: los mocks en `__tests__/` usan `new Date("2026-04-24T12:00:00Z")` para `createdAt` (UTC-noon explícito) o `new Date()` para campos decorativos. Los tests de `date-utils.test.ts` operan con timestamps UTC reales — serán correctos post-migración.

**No hay seed data** (no se encontró `prisma/seed.ts` ni scripts de seeding con timestamps hardcoded).

### 4.4 Queries con comparaciones date-range sobre TIMESTAMP-AFFECTED

El audit `listFlat` hace comparaciones `createdAt >= dateFrom AND createdAt <= dateTo` donde `dateFrom`/`dateTo` vienen de `startOfMonth`/`endOfMonth` (que usan TZ local). Post-migración, Postgres comparará `TIMESTAMPTZ` con un `Date` de Node.js — esto es correcto porque Prisma envía el instante UTC del `Date`.

La única cuestión es el cursor cast (R3).

### 4.5 Triggers de Postgres con NOW() o columnas timestamp

**Inventario completo de triggers** (de `20260406010241_monthly_close_audit_trail/migration.sql` y `20260424123854_audit_insert_coverage_completion/migration.sql`):

- `audit_dispatches` → escribe en `audit_logs.createdAt` con `NOW()`
- `audit_payments` → igual
- `audit_journal_entries` → igual
- Triggers adicionales sobre `sales`, `purchases`, `sale_details`, `purchase_details`, `journal_lines`, `fiscal_periods` → todos usan la misma función `audit_trigger_fn()` con `NOW()`

**Post-migración**: todos correctos automáticamente — `NOW()` devuelve TIMESTAMPTZ, y la columna receptora también será TIMESTAMPTZ.

---

## 5. Decisiones abiertas para el usuario

### Decisión 1: `OrganizationMember.deactivatedAt` — ¿instante o fecha-calendario?

**Pregunta**: ¿`deactivatedAt` representa el instante exacto en que se desactivó un miembro (timestamp de log) o la fecha en que "entra en efecto" la desactivación (fecha operacional)?

**Contexto**: la columna fue agregada por `20260403223611_add_member_soft_delete/migration.sql` como `TIMESTAMP(3)` nullable sin default. No se encontró código en `features/` que la escriba (puede estar en un handler de API).

**Recomendación**: si es un log de "cuándo sucedió", migrar a TIMESTAMPTZ (TIMESTAMP-AFFECTED). Si es "fecha de desactivación configurada por admin" (similar a `Sale.date`), excluir.

**Impacto si se decide al revés**: si es instante y no migra, el display de `deactivatedAt` (si existe en la UI) seguirá mostrando -4h. Si es fecha-calendario y se migra incorrectamente con `USING AT TIME ZONE 'America/La_Paz'`, los valores se verán +4h adelantados (el USING asume que el dato es naive BO-local, pero si eran noon-UTC podría causar confusión — aunque matemáticamente solo sería UTC-noon convertido a TIMESTAMPTZ real).

---

### Decisión 2: `AccountsReceivable.dueDate` y `AccountsPayable.dueDate` — ¿migrar?

**Pregunta**: ¿`dueDate` se persiste como UTC-noon (como `Sale.date`) o como UTC-midnight (legacy)?

**Contexto**: `receivables.repository.ts:66` hace `dueDate: data.dueDate` directamente sin llamar `toNoonUtc()`. El `data.dueDate` viene de Zod `z.coerce.date()`. Si el form envía `"2026-05-15"` como string, `z.coerce.date()` lo convierte a `new Date("2026-05-15")` que es UTC-midnight.

**Recomendación**: NO migrar `dueDate` a TIMESTAMPTZ — es una fecha-vencimiento calendario. Pero en la fase apply, agregar `toNoonUtc()` en `receivables.repository.ts` al persistir para normalizar a UTC-noon. Esto es independiente de esta migración.

**Impacto si se migra**: si se hace `USING "dueDate" AT TIME ZONE 'America/La_Paz'`, los dueDates almacenados como UTC-midnight `2026-05-15T00:00:00` se interpretarán como "BO-local midnight" → convertidos a `2026-05-15T04:00:00Z`. Luego al leer con `.toISOString().split("T")[0]` saldrá `2026-05-15` (correcto). Pero si se almacenaron como UTC-noon `2026-05-15T12:00:00`, el USING interpretará eso como "BO-local 12:00" → `2026-05-15T16:00:00Z` → `.split("T")[0]` = `2026-05-15` (correcto igual). El resultado es el mismo en ambos casos de entrada — no es peligroso, pero tampoco es necesario.

---

### Decisión 3: ChickenLot.startDate / endDate, Expense.date, MortalityLog.date — verificar escritura

**Pregunta**: ¿estos campos se persisten via `toNoonUtc()` o directamente?

**Contexto**: `farm-detail-client.tsx:138` hace `new Date(lot.startDate).toLocaleDateString("es-BO")` sin usar `formatDateBO` — esto sugiere que o bien se confía en la TZ local (inconsistente) o la columna ya viene como UTC-noon y el `toLocaleDateString` da el día correcto en ambiente BO. Si `startDate` NO usa `toNoonUtc()` y se persistió como UTC-midnight, el display podría mostrar un día antes en la UI.

**Recomendación**: verificar el service/repository de `ChickenLot`, `Expense`, `MortalityLog` para confirmar si usan `toNoonUtc()` antes de persistir. Si no lo hacen y estos son campos DATE-CALENDAR, agregarlos al migration de normalización (fuera de scope de timestamptz-migration) y NO migrarlos a TIMESTAMPTZ.

**Impacto**: si se migran incorrectamente como TIMESTAMP-AFFECTED con `USING AT TIME ZONE 'America/La_Paz'`, una fecha `2026-01-15T00:00:00` (UTC-midnight, que es `2026-01-14T20:00:00 BO-local`) quedaría almacenada como `2026-01-14T20:00:00Z` → al leer con `.slice(0,10)` daría `2026-01-14` (¡un día antes!).

---

### Decisión 4 (OPERACIONAL): ¿Snapshot de la DB antes de aplicar?

**Pregunta**: ¿hacemos un `pg_dump` antes de aplicar la migración en producción?

**Recomendación**: SÍ, siempre para migraciones que modifiquen tipos de columna con USING. El USING con AT TIME ZONE es un backfill destructivo — no reversible sin restaurar backup. Hay precedente en el proyecto (`cierre-periodo/design.md:109`).

---

### Decisión 5: ¿Corregir el cast `::timestamp` en `audit.repository.ts` como parte de esta migración?

**Pregunta**: el cursor de paginación del audit usa `::timestamp` en el WHERE. Post-migración, debería cambiarse a `::timestamptz`. ¿Este fix va dentro del scope de `timestamptz-migration` o es un task separado?

**Recomendación**: incluirlo en el mismo PR/migración como tarea atómica. El cursor broken después de la migración es un bug funcional en el módulo de audit (la pantalla `/audit` paginará mal). No tiene sentido migrar sin incluir este fix.

---

## Notas adicionales

### Sobre Prisma y `@db.Timestamptz(3)`

La anotación Prisma es `@db.Timestamptz(3)` (con mayúscula T, de la librería `@prisma/client`). Esta produce `TIMESTAMPTZ(3)` en el SQL. node-postgres lee `TIMESTAMPTZ` (OID 1184) respetando el timezone de sesión y devuelve un `Date` en UTC real — exactamente el comportamiento correcto.

### Sobre la DB de producción

No se encontraron docs que confirmen el TZ de la DB de producción. Se asume `America/La_Paz` (igual que local) basado en el diagnóstico previo. Esto debe confirmarse antes de aplicar la migración en producción.

### Sobre los `toLocaleDateString` en exporters

Los exporters de trial balance, equity statement, worksheet, etc. usan `d.toLocaleDateString("es-BO")` sobre fechas que son `FiscalPeriod.startDate/endDate` (DATE-CALENDAR-NOON, no migran) o fechas de asiento (DATE-CALENDAR-NOON). Post-migración, estos exporters siguen correctos porque esas columnas no cambian.

### Sobre el proceso TZ del server

`lib/date-utils.ts` comenta: "On the server, this depends on the process TZ — prefer a different helper if a server-side default is ever needed; or ensure TZ=America/La_Paz is set in the server environment." Post-migración, `startOfMonth`/`endOfMonth` siguen dependiendo de `TZ=America/La_Paz` en el proceso. Esto es correcto y no cambia con la migración.
