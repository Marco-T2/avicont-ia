# Tasks: timestamptz-migration

**Change**: `timestamptz-migration`
**Fecha**: 2026-04-26
**Estado**: listo para `sdd-apply`
**Fuente canónica**: `design.md` (tabla canónica líneas 81-147, 65 columnas)

---

## Resumen ejecutivo

Este cambio migra 65 columnas `DateTime` de Prisma de `TIMESTAMP(3)` a `TIMESTAMPTZ(3)` en PostgreSQL, corrigiendo un bug de -4 horas causado por naive-local storage. Incluye un fix atómico del cast `::timestamp` → `::timestamptz` en el cursor de paginación de `audit.repository.ts`.

**Conteo canónico (NO RE-DEBATIR)**:
- **Total**: 65 columnas `DateTime`
- **TIMESTAMP-AFFECTED** (`USING "col" AT TIME ZONE 'America/La_Paz'`): 48 columnas
- **UTC-NOON** (`USING "col" AT TIME ZONE 'UTC'`): 17 columnas

---

## Fase 1 — Preparación del schema Prisma

> **Pre-condición**: ninguna. Esta fase es el punto de entrada del cambio.
>
> **Modo de ejecución recomendado**: detener el servidor Next.js antes de comenzar para evitar conexiones activas durante la migración (ver R-D3 en design.md).

---

### T-1: Agregar `@db.Timestamptz(3)` a las 65 columnas `DateTime` en `prisma/schema.prisma`

**Qué hacer**: Editar `prisma/schema.prisma` y agregar la anotación `@db.Timestamptz(3)` a cada uno de los 65 campos `DateTime` y `DateTime?`, siguiendo la regla mecánica del design:

```
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

**Regla**: la anotación `@db.Timestamptz(3)` va siempre:
- Después del tipo (`DateTime` o `DateTime?`)
- Antes de cualquier otro modificador (`@default`, `@updatedAt`, `@map`)

**Lista completa de (modelo, campo, línea schema.prisma)** — usar la tabla canónica de `design.md` líneas 81-147:

| Modelo | Campo | Línea aprox. | Categoría |
|--------|-------|-------------|-----------|
| Organization | createdAt | 18 | TIMESTAMP-AFFECTED |
| CustomRole | createdAt | 60 | TIMESTAMP-AFFECTED |
| CustomRole | updatedAt | 61 | TIMESTAMP-AFFECTED |
| OrganizationMember | deactivatedAt | 74 | TIMESTAMP-AFFECTED |
| User | createdAt | 89 | TIMESTAMP-AFFECTED |
| Document | createdAt | 121 | TIMESTAMP-AFFECTED |
| ChatMessage | createdAt | 150 | TIMESTAMP-AFFECTED |
| AgentRateLimit | windowStart | 166 | TIMESTAMP-AFFECTED |
| AgentRateLimit | updatedAt | 168 | TIMESTAMP-AFFECTED |
| Farm | createdAt | 200 | TIMESTAMP-AFFECTED |
| Farm | updatedAt | 201 | TIMESTAMP-AFFECTED |
| ChickenLot | startDate | 216 | UTC-NOON |
| ChickenLot | endDate | 217 | UTC-NOON |
| ChickenLot | createdAt | 221 | TIMESTAMP-AFFECTED |
| ChickenLot | updatedAt | 222 | TIMESTAMP-AFFECTED |
| Expense | date | 238 | UTC-NOON |
| Expense | createdAt | 242 | TIMESTAMP-AFFECTED |
| MortalityLog | date | 257 | UTC-NOON |
| MortalityLog | createdAt | 261 | TIMESTAMP-AFFECTED |
| JournalEntry | date | 362 | UTC-NOON |
| JournalEntry | createdAt | 374 | TIMESTAMP-AFFECTED |
| JournalEntry | updatedAt | 375 | TIMESTAMP-AFFECTED |
| FiscalPeriod | startDate | 422 | UTC-NOON |
| FiscalPeriod | endDate | 423 | UTC-NOON |
| FiscalPeriod | closedAt | 425 | TIMESTAMP-AFFECTED |
| FiscalPeriod | createdAt | 428 | TIMESTAMP-AFFECTED |
| FiscalPeriod | updatedAt | 429 | TIMESTAMP-AFFECTED |
| Contact | createdAt | 578 | TIMESTAMP-AFFECTED |
| Contact | updatedAt | 579 | TIMESTAMP-AFFECTED |
| AccountsReceivable | dueDate | 604 | UTC-NOON |
| AccountsReceivable | createdAt | 610 | TIMESTAMP-AFFECTED |
| AccountsReceivable | updatedAt | 611 | TIMESTAMP-AFFECTED |
| AccountsPayable | dueDate | 633 | UTC-NOON |
| AccountsPayable | createdAt | 639 | TIMESTAMP-AFFECTED |
| AccountsPayable | updatedAt | 640 | TIMESTAMP-AFFECTED |
| OrgSettings | createdAt | 675 | TIMESTAMP-AFFECTED |
| OrgSettings | updatedAt | 676 | TIMESTAMP-AFFECTED |
| Dispatch | date | 689 | UTC-NOON |
| Dispatch | createdAt | 707 | TIMESTAMP-AFFECTED |
| Dispatch | updatedAt | 708 | TIMESTAMP-AFFECTED |
| ProductType | createdAt | 754 | TIMESTAMP-AFFECTED |
| ProductType | updatedAt | 755 | TIMESTAMP-AFFECTED |
| Payment | date | 770 | UTC-NOON |
| Payment | createdAt | 781 | TIMESTAMP-AFFECTED |
| Payment | updatedAt | 782 | TIMESTAMP-AFFECTED |
| OperationalDocType | createdAt | 804 | TIMESTAMP-AFFECTED |
| OperationalDocType | updatedAt | 805 | TIMESTAMP-AFFECTED |
| Purchase | date | 821 | UTC-NOON |
| Purchase | createdAt | 842 | TIMESTAMP-AFFECTED |
| Purchase | updatedAt | 843 | TIMESTAMP-AFFECTED |
| PurchaseDetail | fecha | 867 | UTC-NOON |
| Sale | date | 915 | UTC-NOON |
| Sale | createdAt | 925 | TIMESTAMP-AFFECTED |
| Sale | updatedAt | 926 | TIMESTAMP-AFFECTED |
| AuditLog | createdAt | 970 | TIMESTAMP-AFFECTED |
| IvaPurchaseBook | fechaFactura | 988 | UTC-NOON |
| IvaPurchaseBook | createdAt | 1012 | TIMESTAMP-AFFECTED |
| IvaPurchaseBook | updatedAt | 1013 | TIMESTAMP-AFFECTED |
| IvaSalesBook | fechaFactura | 1028 | UTC-NOON |
| IvaSalesBook | createdAt | 1052 | TIMESTAMP-AFFECTED |
| IvaSalesBook | updatedAt | 1053 | TIMESTAMP-AFFECTED |
| OrgProfile | createdAt | 1097 | TIMESTAMP-AFFECTED |
| OrgProfile | updatedAt | 1098 | TIMESTAMP-AFFECTED |
| DocumentSignatureConfig | createdAt | 1110 | TIMESTAMP-AFFECTED |
| DocumentSignatureConfig | updatedAt | 1111 | TIMESTAMP-AFFECTED |

**Archivo afectado**: `prisma/schema.prisma`

**Verificación de completion**: ver T-2 a continuación.

---

### T-2: Verificar que ningún campo `DateTime` queda sin `@db.Timestamptz(3)`

**Qué hacer**: Después de editar el schema, ejecutar los siguientes greps de verificación:

```bash
# Grep 1 — Ningún DateTime sin la anotación (resultado esperado: 0 líneas)
grep "DateTime" prisma/schema.prisma | grep -v "@db.Timestamptz"
# Esperado: 0 líneas

# Grep 2 — Contar que son exactamente 65 los annotados
grep "DateTime" prisma/schema.prisma | grep "@db.Timestamptz(3)" | wc -l
# Esperado: 65
```

**Criterio de completion**:
- El primer grep devuelve `0 líneas` (o salida vacía)
- El segundo grep devuelve `65`
- Si cualquiera falla, T-3 NO se ejecuta: volver a T-1 y corregir las omisiones

---

### Commit A: schema Prisma

```
feat(prisma): annotate DateTime fields with @db.Timestamptz(3)

Adds @db.Timestamptz(3) to all 65 DateTime columns in schema.prisma.
This makes the Prisma contract explicit: every temporal column maps
to TIMESTAMPTZ(3) in PostgreSQL. No migration is applied yet.
```

---

## Fase 2 — Generación y edición del SQL de migración

> **Pre-condición**: T-2 completado con los 2 greps reportando OK (0 líneas sin anotación, 65 anotadas).

---

### T-3: Generar el SQL base con `prisma migrate dev --create-only`

**Qué hacer**: Ejecutar el siguiente comando para que Prisma genere el archivo SQL sin aplicarlo:

```bash
pnpm prisma migrate dev --create-only --name timestamptz_migration
```

**Resultado esperado**:
- Se crea el directorio `prisma/migrations/<timestamp>_timestamptz_migration/`
- Dentro hay un `migration.sql` con exactamente 65 sentencias de la forma:
  ```sql
  ALTER TABLE "<table_name>" ALTER COLUMN "<col_name>" TYPE TIMESTAMPTZ(3);
  ```
- **El SQL generado es INCORRECTO** — Prisma genera los ALTER sin cláusula `USING`. NO aplicar todavía.
- El timestamp del directorio se autogenera (ej. `20260427120000_timestamptz_migration`)

**Criterio de completion**: el archivo `prisma/migrations/*_timestamptz_migration/migration.sql` existe y se puede abrir.

**Nota**: si Prisma reporta "no hay cambios pendientes", verificar que T-1/T-2 fueron completados y que el schema fue guardado correctamente. Verificar también que `PRISMA_CLIENT_NO_RETRY=1` no está interfiriendo.

---

### T-4: Editar el SQL — agregar `USING AT TIME ZONE 'America/La_Paz'` a las 48 columnas TIMESTAMP-AFFECTED

**Qué hacer**: Abrir `prisma/migrations/*_timestamptz_migration/migration.sql` y reescribir cada `ALTER COLUMN` de las 48 columnas TIMESTAMP-AFFECTED para que tenga el formato correcto:

```sql
ALTER TABLE "<table_name>"
  ALTER COLUMN "<column_name>" TYPE TIMESTAMPTZ(3)
  USING "<column_name>" AT TIME ZONE 'America/La_Paz';
```

**Lista completa de las 48 columnas TIMESTAMP-AFFECTED** (tabla SQL → columna):

```
organizations            → createdAt
custom_roles             → createdAt, updatedAt
organization_members     → deactivatedAt
users                    → createdAt
documents                → createdAt
chat_messages            → createdAt
agent_rate_limits        → windowStart, updatedAt
farms                    → createdAt, updatedAt
chicken_lots             → createdAt, updatedAt
expenses                 → createdAt
mortality_logs           → createdAt
journal_entries          → createdAt, updatedAt
fiscal_periods           → closedAt, createdAt, updatedAt
contacts                 → createdAt, updatedAt
accounts_receivable      → createdAt, updatedAt
accounts_payable         → createdAt, updatedAt
org_settings             → createdAt, updatedAt
dispatches               → createdAt, updatedAt
product_types            → createdAt, updatedAt
payments                 → createdAt, updatedAt
operational_doc_types    → createdAt, updatedAt
purchases                → createdAt, updatedAt
sales                    → createdAt, updatedAt
audit_logs               → createdAt
iva_purchase_books       → createdAt, updatedAt
iva_sales_books          → createdAt, updatedAt
org_profile              → createdAt, updatedAt
document_signature_configs → createdAt, updatedAt
```

**Referencia de nombres de tabla**: ver tabla "Mapeo tabla SQL → modelo Prisma" en `design.md`.

**Verificación de completion**: ver T-7 (gate bloqueante de Fase 3).

---

### T-5: Editar el SQL — agregar `USING AT TIME ZONE 'UTC'` a las 17 columnas UTC-NOON

**Qué hacer**: En el mismo archivo `migration.sql`, reescribir cada `ALTER COLUMN` de las 17 columnas UTC-NOON:

```sql
ALTER TABLE "<table_name>"
  ALTER COLUMN "<column_name>" TYPE TIMESTAMPTZ(3)
  USING "<column_name>" AT TIME ZONE 'UTC';
```

**Lista completa de las 17 columnas UTC-NOON** (tabla SQL → columna):

```
chicken_lots          → startDate, endDate
expenses              → date
mortality_logs        → date
journal_entries       → date
fiscal_periods        → startDate, endDate
accounts_receivable   → dueDate
accounts_payable      → dueDate
dispatches            → date
payments              → date
purchases             → date
purchase_details      → fecha   ← nullable (DateTime?); USING maneja NULL correctamente
sales                 → date
iva_purchase_books    → fechaFactura
iva_sales_books       → fechaFactura
```

**Nota sobre `purchase_details.fecha`**: es `DateTime?` (nullable). La cláusula `USING "fecha" AT TIME ZONE 'UTC'` en PostgreSQL trata NULL como NULL — la conversión es segura.

**Verificación de completion**: ver T-9 y T-10 (gates bloqueantes de Fase 3).

---

### T-6: Reorganizar el SQL con estructura por sección y comentarios de categoría

**Qué hacer**: Reorganizar el contenido del `migration.sql` editado para que quede con la siguiente estructura de secciones (facilita revisión visual y reduce riesgo de confundir categorías):

```sql
-- ============================================================
-- TIMESTAMP-AFFECTED: datos naive BO-local → USING 'America/La_Paz'
-- (48 columnas — representan instantes reales en el tiempo)
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

-- ... (resto de columnas TIMESTAMP-AFFECTED, una tabla por bloque con comentario)

-- ============================================================
-- UTC-NOON: datos ya en UTC vía toNoonUtc() → USING 'UTC'
-- (17 columnas — representan fechas calendario como TIMESTAMPTZ)
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

**Criterio de completion**: el archivo editado tiene las dos secciones con comentarios de encabezado, y cada tabla tiene un comentario `-- <table_name>` antes de sus ALTER.

---

## Fase 3 — GATE BLOQUEANTE pre-apply (4 greps obligatorios)

> **INVARIANTE**: Los cuatro greps de esta fase son condición necesaria y suficiente para autorizar la ejecución de T-11.
>
> **La fase 4 (T-11) NO puede marcarse `completed` ni ejecutarse si cualquiera de los greps T-7, T-8, T-9 o T-10 no reporta el resultado esperado.**
>
> Si algún grep falla: DETENER, no ejecutar T-11, investigar la discrepancia en el SQL editado, corregirla, y volver a correr los 4 greps desde T-7.

---

### T-7: Grep #1 — Total de `ALTER COLUMN` debe ser exactamente 65 (BLOQUEANTE)

**Comando exacto**:
```bash
grep -c "ALTER COLUMN" prisma/migrations/*_timestamptz_migration/migration.sql
```

**Resultado esperado**: `65`

> **BLOQUEANTE** — Si este grep reporta cualquier número distinto de `65`, NO ejecutar T-11. El SQL tiene columnas faltantes (< 65) o duplicadas (> 65). Investigar y corregir antes de continuar.

**Criterio de completion**: el comando imprime `65` y termina con exit code 0.

---

### T-8: Grep #2 — Ningún `ALTER COLUMN` sin cláusula `USING` (BLOQUEANTE)

**Comando exacto**:
```bash
grep "TYPE TIMESTAMPTZ" prisma/migrations/*_timestamptz_migration/migration.sql | grep -v "USING"
```

**Resultado esperado**: `0 líneas` (salida vacía — el comando no imprime nada)

> **BLOQUEANTE** — Si este grep imprime cualquier línea, existe al menos un `ALTER COLUMN ... TYPE TIMESTAMPTZ` sin su cláusula `USING`. Esas líneas permiten el casting implícito de Postgres que asume UTC, lo cual corrompería los datos naive BO-local. NO ejecutar T-11. Agregar la cláusula `USING` correcta a cada línea reportada.

**Criterio de completion**: el comando no produce output (salida vacía), exit code 1 es aceptable (grep devuelve 1 cuando no hay matches).

---

### T-9: Grep #3 — Count `USING 'America/La_Paz'` debe ser exactamente 48 (BLOQUEANTE)

**Comando exacto**:
```bash
grep -c "AT TIME ZONE 'America/La_Paz'" prisma/migrations/*_timestamptz_migration/migration.sql
```

**Resultado esperado**: `48`

> **BLOQUEANTE** — Si este grep reporta cualquier número distinto de `48`, la distribución de cláusulas TIMESTAMP-AFFECTED está incorrecta. Puede significar que alguna columna TIMESTAMP-AFFECTED quedó con `USING 'UTC'` (error grave: corrompería datos) o viceversa. NO ejecutar T-11. Auditar las 48 columnas contra la lista canónica de T-4.

**Criterio de completion**: el comando imprime `48` y termina con exit code 0.

---

### T-10: Grep #4 — Count `USING 'UTC'` debe ser exactamente 17 (BLOQUEANTE)

**Comando exacto**:
```bash
grep -c "AT TIME ZONE 'UTC'" prisma/migrations/*_timestamptz_migration/migration.sql
```

**Resultado esperado**: `17`

> **BLOQUEANTE** — Si este grep reporta cualquier número distinto de `17`, la distribución de cláusulas UTC-NOON está incorrecta. NO ejecutar T-11. Auditar las 17 columnas contra la lista canónica de T-5.

**Verificación cruzada adicional** (suma): los resultados de T-9 y T-10 deben sumar 65. Si `48 + 17 ≠ 65`, hay un error de conteo que debe resolverse antes de continuar.

**Criterio de completion**: el comando imprime `17` y termina con exit code 0, y la suma con T-9 es 65.

---

## Fase 4 — Aplicación de la migración

> **PRE-CONDICIÓN BLOQUEANTE**: Fase 3 completada con los 4 greps reportando OK:
> - T-7: `65`
> - T-8: `0 líneas` (salida vacía)
> - T-9: `48`
> - T-10: `17`
>
> **Sin esta pre-condición, T-11 NO se ejecuta bajo ninguna circunstancia.**
>
> También recomendado: servidor Next.js detenido para evitar conexiones activas que puedan competir por el lock de ALTER TABLE (ver R-D3 en design.md).

---

### T-11: Aplicar la migración con `prisma migrate dev`

**Qué hacer**: Ejecutar la migración sin `--create-only`:

```bash
pnpm prisma migrate dev
```

**Resultado esperado**:
- Prisma detecta el archivo `.sql` pendiente y lo aplica
- PostgreSQL ejecuta los 65 `ALTER TABLE ... ALTER COLUMN` en una única transacción
- Prisma reporta `Your database is now in sync with your schema.`
- No hay errores de tipo, lock timeout, ni rollback

**Si la migración falla**:
- PostgreSQL hace rollback completo — ninguna tabla queda parcialmente migrada (atomicidad garantizada por DDL transaccional de Postgres, ver R-D1 en design.md)
- Inspeccionar el error: si es de tipo `could not find operator` o `invalid input syntax`, revisar la cláusula `USING` del ALTER que falló
- NO re-ejecutar hasta corregir el SQL

**Criterio de completion**: `pnpm prisma migrate dev` termina con exit code 0 y mensaje de sincronización.

---

### Commit B: migración SQL

```
feat(db): migrate DateTime columns to TIMESTAMPTZ(3)

Applies timestamptz_migration: 65 ALTER TABLE statements converting
all DateTime columns from TIMESTAMP(3) to TIMESTAMPTZ(3).

- 48 TIMESTAMP-AFFECTED columns use USING AT TIME ZONE 'America/La_Paz'
  (naive BO-local data → correct UTC instant)
- 17 UTC-NOON columns use USING AT TIME ZONE 'UTC'
  (dates stored as UTC-noon via toNoonUtc() → preserved without shift)

Fixes a -4h display bug caused by node-postgres misreading naive-local
timestamps as UTC.
```

---

## Fase 5 — Test de regresión TDD para el cursor audit (RED → GREEN)

> **Pre-condición**: Fase 4 completada (migración aplicada, DB en TIMESTAMPTZ). Fase 6 (fix del código) viene DESPUÉS de esta fase — el test se escribe primero en RED, luego se aplica el fix en Fase 6.
>
> **Justificación TDD**: el fix en `audit.repository.ts` es un cambio de comportamiento verificable. Se escribe el test que documenta el comportamiento correcto ANTES del fix, se verifica que falla (RED) por la razón correcta (cast incorrecto), y luego el fix lo pone en GREEN.

---

### T-12: Escribir tests de regresión para el cursor `::timestamptz` (RED — deben fallar antes del fix)

**Qué hacer**: Agregar un nuevo bloque `describe` al final del archivo `features/audit/__tests__/audit.repository.test.ts` con los siguientes tests que cubren los scenarios A1-S7, A1-S8, y A1-S9 de la spec `audit-module`:

**Tests a agregar**:

```typescript
describe("AuditRepository.listFlat — cursor timestamptz cross-medianoche (A1-S7, A1-S8, A1-S9)", () => {
  /**
   * A1-S7: cursor serializado en UTC (ISO Z) compara correctamente con columna TIMESTAMPTZ.
   *
   * Setup: 3 filas con createdAt en UTC — una antes y dos después de un cursor fijo.
   * El cursor apunta a 2026-04-27T04:00:00.000Z (medianoche BO-local).
   * La página 2 debe devolver exactamente las filas anteriores al cursor, sin shift.
   */
  it("cursor ISO-Z compara correctamente con TIMESTAMPTZ — no hay shift de 4h (A1-S7)", async () => {
    // Timestamps fijos en UTC — simula un rango cross-medianoche UTC
    const tBefore1 = new Date("2026-04-27T03:50:00.000Z"); // antes del cursor
    const tBefore2 = new Date("2026-04-27T03:55:00.000Z"); // antes del cursor
    const tAfter   = new Date("2026-04-27T04:05:00.000Z"); // después del cursor (primera página)

    await seedAuditRows([
      {
        id: "cursor-after-1",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tz_after",
        action: "CREATE",
        changedById: userAId,
        createdAt: tAfter,
      },
      {
        id: "cursor-before-1",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tz_before1",
        action: "CREATE",
        changedById: userAId,
        createdAt: tBefore2,
      },
      {
        id: "cursor-before-2",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_tz_before2",
        action: "CREATE",
        changedById: userAId,
        createdAt: tBefore1,
      },
    ]);

    const repo = new AuditRepository();

    // Página 1: trae la fila más reciente (tAfter)
    const page1 = await repo.listFlat(orgAId, {
      dateFrom: new Date("2026-04-27T00:00:00.000Z"),
      dateTo:   new Date("2026-04-27T23:59:59.999Z"),
      limit: 1,
    });

    expect(page1.rows).toHaveLength(1);
    expect(page1.rows[0].id).toBe("cursor-after-1");
    expect(page1.nextCursor).not.toBeNull();

    // El cursor codifica el instante UTC real de tAfter
    const cursorTs = new Date(page1.nextCursor!.createdAt);
    expect(cursorTs.toISOString()).toBe(tAfter.toISOString());

    // Página 2: debe traer las 2 filas anteriores al cursor sin shift
    const page2 = await repo.listFlat(orgAId, {
      dateFrom: new Date("2026-04-27T00:00:00.000Z"),
      dateTo:   new Date("2026-04-27T23:59:59.999Z"),
      limit: 10,
      cursor: page1.nextCursor!,
    });

    // Con ::timestamp (bug): el cursor ISO-Z pierde timezone y Postgres lo trata
    // como local, produciendo un shift de +4h → las filas "antes" quedan fuera del rango.
    // Con ::timestamptz (fix): la comparación es UTC-to-UTC, resultado correcto.
    expect(page2.rows).toHaveLength(2);
    const page2Ids = page2.rows.map((r: AuditRow) => r.id);
    expect(page2Ids).toContain("cursor-before-1");
    expect(page2Ids).toContain("cursor-before-2");
    expect(page2Ids).not.toContain("cursor-after-1");
  });

  /**
   * A1-S8: paginación cross-medianoche UTC mantiene orden estable.
   *
   * Filas que cruzan la medianoche UTC (00:00:00Z) deben aparecer exactamente
   * una vez y en orden DESC. Con ::timestamp, la medianoche UTC equivale a
   * 20:00 BO-local, donde el shift puede causar duplicados o pérdidas.
   */
  it("paginación cross-medianoche UTC — todas las filas aparecen exactamente una vez (A1-S8)", async () => {
    const rows: { id: string; createdAt: Date }[] = [
      { id: "cm-1", createdAt: new Date("2026-04-26T23:50:00.000Z") },
      { id: "cm-2", createdAt: new Date("2026-04-26T23:55:00.000Z") },
      { id: "cm-3", createdAt: new Date("2026-04-27T00:05:00.000Z") },
      { id: "cm-4", createdAt: new Date("2026-04-27T00:10:00.000Z") },
    ];

    await seedAuditRows(
      rows.map((r) => ({
        id: r.id,
        organizationId: orgAId,
        entityType: "sales",
        entityId: `sale_cm_${r.id}`,
        action: "CREATE",
        changedById: userAId,
        createdAt: r.createdAt,
      })),
    );

    const repo = new AuditRepository();
    const allIds: string[] = [];

    // Paginar de a 1 para forzar múltiples cursors
    let cursor = null;
    for (let page = 0; page < 5; page++) {
      const result = await repo.listFlat(orgAId, {
        dateFrom: new Date("2026-04-26T23:00:00.000Z"),
        dateTo:   new Date("2026-04-27T01:00:00.000Z"),
        limit: 1,
        cursor: cursor ?? undefined,
      });
      if (result.rows.length === 0) break;
      allIds.push(...result.rows.map((r: AuditRow) => r.id));
      cursor = result.nextCursor;
      if (!cursor) break;
    }

    // Todas las 4 filas deben aparecer exactamente una vez
    expect(allIds).toHaveLength(4);
    expect(new Set(allIds).size).toBe(4); // sin duplicados
    for (const r of rows) {
      expect(allIds).toContain(r.id);
    }

    // Orden DESC: cm-4 > cm-3 > cm-2 > cm-1
    expect(allIds[0]).toBe("cm-4");
    expect(allIds[1]).toBe("cm-3");
    expect(allIds[2]).toBe("cm-2");
    expect(allIds[3]).toBe("cm-1");
  });

  /**
   * A1-S9 — Verificación negativa: documenta que el bug ::timestamp NO reproduce con el fix.
   *
   * Con la columna TIMESTAMPTZ y el cast correcto ::timestamptz, el cursor
   * '2026-04-27T04:00:00.000Z' (medianoche BO) compara correctamente.
   * Con ::timestamp (bug), Postgres ignoraría el Z y trataría el valor como
   * local, causando un offset de +4h (compararía contra las 08:00 UTC en lugar
   * de las 04:00 UTC), produciendo duplicados o filas faltantes.
   *
   * Este test verifica que el comportamiento correcto está presente (no replica el bug).
   */
  it("::timestamp bug NO reproduce — medianoche BO-local como cursor no produce offset (A1-S9)", async () => {
    // Medianoche BO-local = 04:00:00Z UTC
    const midnightBO = new Date("2026-04-27T04:00:00.000Z");
    const justBefore = new Date("2026-04-27T03:59:59.000Z"); // 23:59:59 BO del día anterior
    const justAfter  = new Date("2026-04-27T04:00:01.000Z"); // 00:00:01 BO del día nuevo

    await seedAuditRows([
      {
        id: "midnight-before",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_mn_before",
        action: "CREATE",
        changedById: userAId,
        createdAt: justBefore,
      },
      {
        id: "midnight-exact",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_mn_exact",
        action: "CREATE",
        changedById: userAId,
        createdAt: midnightBO,
      },
      {
        id: "midnight-after",
        organizationId: orgAId,
        entityType: "sales",
        entityId: "sale_mn_after",
        action: "CREATE",
        changedById: userAId,
        createdAt: justAfter,
      },
    ]);

    const repo = new AuditRepository();

    // Construir cursor manualmente que apunta a midnightBO
    const cursorAtMidnight = {
      createdAt: midnightBO.toISOString(), // "2026-04-27T04:00:00.000Z"
      id: "midnight-exact",
    };

    const result = await repo.listFlat(orgAId, {
      dateFrom: new Date("2026-04-26T00:00:00.000Z"),
      dateTo:   new Date("2026-04-28T00:00:00.000Z"),
      limit: 10,
      cursor: cursorAtMidnight,
    });

    // Con el fix (::timestamptz): la comparación evalúa < 04:00:00Z
    // Solo debe aparecer justBefore (03:59:59Z).
    // Con el bug (::timestamp): Postgres ignoraría el Z, aplicaría offset de -4h,
    // y la comparación fallaría — justBefore podría desaparecer del resultado.
    expect(result.rows.map((r: AuditRow) => r.id)).toContain("midnight-before");
    expect(result.rows.map((r: AuditRow) => r.id)).not.toContain("midnight-exact");
    expect(result.rows.map((r: AuditRow) => r.id)).not.toContain("midnight-after");
  });
});
```

**Archivo afectado**: `features/audit/__tests__/audit.repository.test.ts`

**Verificación RED (antes del fix en T-13)**:
```bash
pnpm test features/audit/__tests__/audit.repository.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|✗|cursor timestamptz"
# Esperado: los 3 tests del bloque "cursor timestamptz cross-medianoche" DEBEN fallar
# con error de assertion (resultado incorrecto) — no con error de compilación.
# El failure mode esperado: la paginación cross-medianoche devuelve filas incorrectas
# porque ::timestamp descarta el timezone del cursor ISO-Z.
```

**Criterio de completion (RED)**: los 3 tests del bloque `cursor timestamptz cross-medianoche` fallan (assertion error, no compile error), y los tests existentes siguen en verde.

> **Nota**: si los tests pasan en RED antes del fix, puede significar que la DB aún tiene columnas TIMESTAMP o que el test no está cubriendo el comportamiento diferencial. En ese caso, verificar con psql que `audit_logs.createdAt` es efectivamente `timestamp with time zone` post-migración.

---

## Fase 6 — Fix del cursor en `audit.repository.ts`

> **Pre-condición**: T-12 completado y verificado en RED (los 3 tests fallan con la razón correcta).

---

### T-13: Cambiar `::timestamp` → `::timestamptz` en `audit.repository.ts` líneas 95-97

**Archivo**: `features/audit/audit.repository.ts`

**Qué hacer**: Reemplazar las 3 ocurrencias de `::timestamp` en el bloque WHERE de `listFlat` (líneas 95-97):

```typescript
// ANTES (incorrecto post-migración — líneas 95-97):
${cursorCreatedAt}::timestamp IS NULL
OR awp."createdAt" <  ${cursorCreatedAt}::timestamp
OR (awp."createdAt" = ${cursorCreatedAt}::timestamp AND awp.id < ${cursorId}::text)

// DESPUÉS (correcto con TIMESTAMPTZ):
${cursorCreatedAt}::timestamptz IS NULL
OR awp."createdAt" <  ${cursorCreatedAt}::timestamptz
OR (awp."createdAt" = ${cursorCreatedAt}::timestamptz AND awp.id < ${cursorId}::text)
```

**Cambio**: exactamente 3 reemplazos de `::timestamp` por `::timestamptz`. No se tocan otros archivos.

**No requieren cambios** (confirmado en design.md):
- Tipos TypeScript (`cursorCreatedAt` sigue siendo `string | null`)
- `AuditCursor` interface (sigue siendo `{ createdAt: string; id: string }`)
- `nextCursor = { createdAt: last.createdAt.toISOString(), id: last.id }` (línea 107) — correcto
- `getVoucherHistory` — no usa cursor pagination

**Verificación GREEN**:
```bash
pnpm test features/audit/__tests__/audit.repository.test.ts --reporter=verbose 2>&1 | grep -E "PASS|✓|cursor timestamptz|FAIL"
# Esperado: los 3 tests del bloque "cursor timestamptz cross-medianoche" pasan (GREEN)
# y los tests previos siguen en verde.
```

**Criterio de completion**: todos los tests de `audit.repository.test.ts` pasan en verde, incluyendo los 3 nuevos del bloque A1-S7/A1-S8/A1-S9.

---

### Commit C: fix del cursor audit

```
fix(audit): cast cursor as timestamptz for correct pagination

Replaces ::timestamp with ::timestamptz in the listFlat cursor WHERE
clause (audit.repository.ts:95-97).

With TIMESTAMPTZ(3) columns, ::timestamp discards the timezone from
the ISO-Z cursor string before comparison, causing a -4h offset at
Bolivia midnight boundaries (04:00:00Z = 00:00 BO-local). The correct
cast ::timestamptz preserves timezone semantics and produces accurate
comparisons.

Regression tests: A1-S7, A1-S8, A1-S9 (audit-module delta spec).
```

---

## Fase 7 — Verificación post-apply

> **Pre-condición**: Fases 4, 5, 6 completadas. Migración aplicada, tests en verde.

---

### T-14: Verificación de tipo de columnas en PostgreSQL (SQL directo)

**Qué hacer**: Ejecutar las siguientes queries en psql o en un cliente SQL conectado a la DB de desarrollo:

```sql
-- Query 1: verificar que NO quedan columnas TIMESTAMP sin timezone
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE data_type = 'timestamp without time zone'
  AND table_schema = 'public';
-- Esperado: 0 filas

-- Query 2: contar columnas TIMESTAMPTZ en las tablas del schema
SELECT COUNT(*) AS timestamptz_count
FROM information_schema.columns
WHERE data_type = 'timestamp with time zone'
  AND table_schema = 'public'
  AND table_name IN (
    'organizations','custom_roles','organization_members','users','documents',
    'chat_messages','agent_rate_limits','farms','chicken_lots','expenses',
    'mortality_logs','journal_entries','fiscal_periods','contacts',
    'accounts_receivable','accounts_payable','org_settings','dispatches',
    'product_types','payments','operational_doc_types','purchases',
    'purchase_details','sales','audit_logs','iva_purchase_books',
    'iva_sales_books','org_profile','document_signature_configs'
  );
-- Esperado: 65
```

**Criterio de completion**: Query 1 devuelve 0 filas, Query 2 devuelve 65.

---

### T-15: Smoke test del módulo audit en la UI

**Qué hacer**: Con el servidor Next.js corriendo (`pnpm dev`), verificar manualmente:

1. Navegar a `/[orgSlug]/audit` — la página carga sin errores 500
2. Las cards de auditoría muestran hora visible (no solo fecha) que coincide con la hora real en Bolivia
3. Paginación: hacer scroll o cargar más páginas — verificar que no hay duplicados ni filas faltantes
4. Verificar un rango de fechas que cruce la medianoche local (ej. 23:50 a 00:10) — todas las filas aparecen en orden correcto

**Criterio de completion**: ningún error en consola relacionado con timezone, la hora mostrada en las cards coincide con el instante real de la operación en `America/La_Paz`.

---

### T-16: TypeScript type-check en verde

**Comando exacto**:
```bash
pnpm tsc --noEmit
```

**Resultado esperado**: exit code 0, 0 errores TypeScript.

**Criterio de completion**: el comando termina con exit code 0.

> **Nota**: el cambio `::timestamp` → `::timestamptz` es en un string SQL dentro de `Prisma.sql` — no afecta tipos TypeScript. El comando debe pasar sin cambios adicionales. Si hay errores, investigar si son pre-existentes o introducidos por el cambio.

---

### T-17: Ejecutar suite de tests completa

**Comando exacto**:
```bash
pnpm test
```

**Resultado esperado**: todos los tests en verde (exit code 0).

**Criterio de completion**: `pnpm test` termina con exit code 0. Si algún test falla, investigar si es pre-existente o introducido por el cambio.

> **Nota**: los tests unitarios del módulo audit usan mocks con timestamps en formato UTC (ej. `new Date("...Z")`). Son correctos con TIMESTAMPTZ — la interfaz TypeScript (`Date`) no cambia, solo el tipo de columna en la DB.

---

## Fase 8 — Documentación en PR

> **Pre-condición**: Fases 1-7 completadas. Esta fase se ejecuta al abrir el PR.

---

### T-18: PR description incluye nota operativa sobre ausencia de pg_dump

**Qué hacer**: En la descripción del PR, incluir la siguiente nota (o equivalente) en una sección "Notas operativas":

```markdown
## Notas operativas

### Ausencia de pg_dump previo

Esta migración se aplicó **SIN** `pg_dump` previo porque la base de datos
de desarrollo solo contiene datos de ejemplo generados para testing —
no hay datos de usuarios reales ni información productiva en riesgo.

**ESTE CRITERIO NO APLICA A PRODUCCIÓN.**

Futuras migraciones que modifiquen tipos de columnas en tablas con datos
productivos **REQUIEREN** backup previo con `pg_dump` antes de ejecutar
`prisma migrate dev`. La atomicidad de PostgreSQL (rollback en caso de
fallo) no reemplaza al backup — protege contra errores de ejecución, no
contra errores de lógica en la cláusula `USING`.

### Riesgo de lock en producción (R-D2)

`ALTER TABLE ... ALTER COLUMN TYPE` adquiere `ACCESS EXCLUSIVE` lock por
tabla. Para tablas de alto volumen (ej. `audit_logs` con millones de filas),
este approach de ALTER directo **no es adecuado para producción** sin una
ventana de mantenimiento o una estrategia de migración online (pg_repack,
columna shadow). Documentar y evaluar antes de ejecutar en producción.
```

**Criterio de completion**: el PR abierto incluye esta nota en su descripción.

---

## Resumen de commits en el PR

| Commit | Fase | Descripción |
|--------|------|-------------|
| **Commit A** | Fase 1 | `feat(prisma): annotate DateTime fields with @db.Timestamptz(3)` |
| **Commit B** | Fase 4 | `feat(db): migrate DateTime columns to TIMESTAMPTZ(3)` |
| **Commit C** | Fase 6 | `fix(audit): cast cursor as timestamptz for correct pagination` |

> **Nota**: los tests de Fase 5 (T-12) pueden commitearse junto con Commit C o antes, como commit separado. Si se separan:
> ```
> test(audit): add regression tests for cursor timestamptz (A1-S7, A1-S8, A1-S9)
> ```

---

## Mapa de dependencias entre tareas

```
T-1 → T-2 → [T-2 OK?] → T-3 → T-4 → T-5 → T-6
                                              ↓
                                T-7 → T-8 → T-9 → T-10
                                              ↓
                                        [4 greps OK?]
                                              ↓ SÍ
                                    T-11 (Commit A+B)
                                              ↓
                                   T-12 (RED) → T-13 (GREEN, Commit C)
                                              ↓
                                T-14 → T-15 → T-16 → T-17
                                              ↓
                                            T-18
```

---

## Checklist de completion por fase

| Fase | Tareas | Gate |
|------|--------|------|
| Fase 1 — Schema Prisma | T-1, T-2 | T-2: 0 líneas sin anotación, 65 anotadas |
| Fase 2 — Generación SQL | T-3, T-4, T-5, T-6 | SQL editado con USING en todos los ALTER |
| Fase 3 — Gate pre-apply | T-7, T-8, T-9, T-10 | **BLOQUEANTE**: 65 / 0 líneas / 48 / 17 |
| Fase 4 — Apply | T-11 | `pnpm prisma migrate dev` con exit code 0 |
| Fase 5 — Tests TDD (RED) | T-12 | 3 tests nuevos fallan en RED (razón correcta) |
| Fase 6 — Fix cursor | T-13 | Tests pasan en GREEN |
| Fase 7 — Verificación | T-14, T-15, T-16, T-17 | tsc y pnpm test en verde, DB verified |
| Fase 8 — PR doc | T-18 | PR incluye nota operativa pg_dump |
