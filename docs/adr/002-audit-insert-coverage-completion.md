# ADR-002: Cobertura de INSERT en la infraestructura de auditoría

**Estado**: Aceptado
**Fecha**: 2026-04-24
**Decisores**: Marco

## Contexto

La infraestructura canónica de auditoría escribe a `audit_logs` mediante
triggers de Postgres (`audit_trigger_fn`). El schema documentaba cuatro
valores posibles para el campo `action`: `"CREATE"`, `"UPDATE"`, `"DELETE"`,
`"STATUS_CHANGE"`. Sin embargo, el branch `TG_OP = 'INSERT'` nunca existió en
la función: `"CREATE"` era un valor aspiracional, no emitido.

La brecha tenía tres dimensiones:

1. **Acción INSERT no auditada en ninguna tabla cabecera**. Toda creación de
   `sales`, `purchases`, `dispatches`, `payments` y `journal_entries` pasaba
   sin dejar rastro en `audit_logs`. El audit trail empezaba en el primer
   UPDATE posterior.

2. **Tres tablas de detalle sin ningún trigger**. `sale_details`,
   `purchase_details` y `journal_lines` no tenían triggers de ningún tipo
   (INSERT, UPDATE ni DELETE). Mutaciones de líneas de comprobante eran
   totalmente invisibles para el sistema de auditoría.

3. **Inconsistencia documental**. El comentario en `AuditLog.entityType`
   (`prisma/schema.prisma:937`) listaba un subconjunto desactualizado de
   entidades. El comentario en `action` confirmaba `"CREATE"` como real
   cuando no lo era.

El hallazgo emergió durante la revisión de la infraestructura de auditoría
post-cierre de periodo (ver ADR-001 y migraciones previas).

## Decisión

Se activa la cobertura completa de INSERT de la siguiente forma:

- **Branch INSERT** en `audit_trigger_fn()` que emite `action = 'CREATE'`,
  `old_values = NULL`, `new_values = snapshot de NEW`. Esto alinea la
  implementación con la documentación pre-existente del schema.

- **Triggers completos** (`AFTER INSERT OR UPDATE OR DELETE`) para las 5
  tablas cabecera: `sales`, `purchases`, `dispatches`, `payments`,
  `journal_entries`. Los triggers previos (`AFTER UPDATE OR DELETE`) se
  eliminan y reemplazan por un trigger único (estrategia a — ver §Decisiones
  de implementación).

- **Triggers completos** (`AFTER INSERT OR UPDATE OR DELETE`) para las 3
  tablas de detalle que hoy no tienen ningún trigger: `sale_details`,
  `purchase_details`, `journal_lines`.

- **`fiscal_periods` no recibe trigger INSERT** (ver §Exclusión de
  fiscal_periods).

- **`setAuditContext` extiende su firma** para aceptar `organizationId` como
  tercer parámetro requerido y emite `SET LOCAL app.current_organization_id`.
  Esta var de sesión sirve como fallback para la resolución de `organizationId`
  en tablas de detalle cuando el padre ya fue eliminado antes que la línea
  (ordering de CASCADE DELETE).

## Decisiones de implementación

### Estrategia de trigger (a): DROP + recrear

Se optó por eliminar cada trigger existente y recrearlo con el evento
extendido en lugar de añadir un segundo trigger con nombre distinto
(`audit_<table>_insert`).

**Justificación**: un trigger único por tabla es más fácil de razonar,
de monitorear en `pg_triggers` y de mantener en futuras migraciones. La
alternativa (b) habría producido dos triggers por tabla cabecera con ciclos
de vida desacoplados, mayor riesgo de olvidar sincronizarlos y mayor ruido
en los planes de ejecución.

### Resolución de organizationId para tablas de detalle

Las tablas `journal_lines`, `purchase_details` y `sale_details` no tienen
columna `organizationId` propia. La función resuelve el valor con un `SELECT`
al padre correspondiente via `CASE TG_TABLE_NAME`.

Orden de resolución:

1. Lookup al padre (`journal_entries`, `purchases`, `sales`).
2. Si el lookup retorna NULL — posible bajo CASCADE DELETE cuando el padre ya
   fue eliminado antes que las líneas — se usa la var de sesión
   `app.current_organization_id`, que `setAuditContext()` establece a partir
   de esta migración.
3. Si ambos son NULL/vacío, la función lanza `RAISE EXCEPTION` de forma
   deliberada. Es preferible un error ruidoso a insertar una fila de auditoría
   con `organizationId` vacío, lo que violaría la FK y la integridad del
   historial.

### Detección de STATUS_CHANGE vía introspección JSONB

El branch `UPDATE` determina si la acción es `UPDATE` o `STATUS_CHANGE`
comparando la columna `status`. Dado que 3 de las tablas bajo trigger
(`journal_lines`, `purchase_details`, `sale_details`) **no tienen columna
`status`**, un acceso directo `OLD.status IS DISTINCT FROM NEW.status`
reventaría en runtime con `column "status" does not exist`.

Se resuelve con introspección JSONB:

```sql
v_old_json := to_jsonb(OLD);
v_new_json := to_jsonb(NEW);

IF (v_old_json->>'status') IS DISTINCT FROM (v_new_json->>'status') THEN
  v_action := 'STATUS_CHANGE';
ELSE
  v_action := 'UPDATE';
END IF;
```

**Justificación**:

1. **Self-adaptive**. Una tabla que tiene `status` registra `STATUS_CHANGE`
   cuando corresponde. Una tabla que no, cae a `UPDATE` limpio (`->>'status'`
   devuelve `NULL` en ambos lados; `IS DISTINCT FROM` sobre dos `NULL` es
   `false`). Cero configuración por tabla.

2. **Evita deuda técnica**. La alternativa (hardcodear
   `TG_TABLE_NAME IN ('dispatches', 'payments', ...)`) obligaría a actualizar
   la función cada vez que una tabla nueva con `status` entre al audit, y un
   olvido haría perder `STATUS_CHANGE` silenciosamente.

3. **Materialización explícita**. `to_jsonb(OLD/NEW)` se computa una sola
   vez al inicio del branch, en vez de confiar en la memoización implícita
   de Postgres. Legibilidad y predictibilidad sobre optimización oportunista.

### Firma de setAuditContext

```typescript
setAuditContext(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,   // nuevo, requerido
  justification?: string,
  correlationId?: string,
): Promise<void>
```

La firma es posicional para mantener consistencia con el estilo del codebase.
`organizationId` es requerido porque todas las operaciones de dominio ya lo
tienen disponible en su contexto (`requireOrg`).

## Exclusión de fiscal_periods del trigger INSERT

`fiscal_periods` se mantiene con `AFTER UPDATE OR DELETE` únicamente.

**Justificación**:

1. **Naturaleza operacional, no comercial**. `fiscal_periods` contiene 12 rows
   por año calendario. La creación de un periodo no es un comprobante
   económico; es una operación de configuración administrativa.

2. **El evento auditable real es el cierre/reapertura**, que ya queda
   registrado por el trigger UPDATE existente con `action = 'STATUS_CHANGE'`
   y `correlationId` propagado desde `MonthlyCloseService`.

3. **Ruido desproporcionado**. Auditar INSERTs de periodos fiscales aportaría
   rows de bajo valor informativo y desproporcionaría la ratio de señal/ruido
   del historial de auditoría.

## Consecuencias

**Positivas**:

- El campo `action = 'CREATE'` en `audit_logs` pasa de aspiracional a real.
  El historial de auditoría es completo desde la creación de cada comprobante.
- Las líneas de comprobante (`sale_details`, `purchase_details`,
  `journal_lines`) quedan bajo cobertura de auditoría completa por primera vez.
- La inconsistencia documental en `prisma/schema.prisma` queda saneada.
- El fallback `app.current_organization_id` hace la función robusta frente al
  ordering no determinístico de CASCADE DELETE en Postgres.

**Negativas / riesgos aceptados**:

- **Volumen de `audit_logs`**. Los INSERTs de líneas incrementan el tamaño de
  la tabla. Estimación conservadora: con 4 líneas promedio por comprobante y 3
  tablas de detalle con 3 eventos cada una (INSERT al crear, UPDATE al editar,
  DELETE al anular), la multiplicación es ~9× por comprobante vs. el estado
  anterior. Manejable dado el volumen de operaciones de una PyME boliviana
  y los índices existentes en `audit_logs`.

- **Breaking change en `setAuditContext`**. Todos los call sites deben
  actualizarse. Está cubierto en esta misma migración/commit.

- **Ausencia de tests de integración contra Postgres real**. La función
  `audit_trigger_fn` y los nuevos triggers no tienen tests de integración
  automatizados que ejecuten contra una instancia de Postgres. La validación
  es post-merge vía psql o sesión de dev: verificar que INSERTs en tablas
  cabecera y de detalle produzcan rows en `audit_logs` con `action = 'CREATE'`
  y `organizationId` correcto. Esta deuda técnica queda identificada.

## Pendiente: correlationId en tablas de detalle

El módulo `correlationId` existe hoy para operaciones de cierre/reapertura
(emitido por `MonthlyCloseService`). Su extensión a otras operaciones de
dominio (creación de comprobantes, anulaciones en cascada) se abordará en un
`sdd-explore` separado. No bloquea esta decisión.

## Referencias

- Migración del mecanismo canónico de audit (triggers base):
  `prisma/migrations/20260406010241_monthly_close_audit_trail/migration.sql`
- Migración que añadió correlationId y triggers de fiscal_periods/purchases:
  `prisma/migrations/20260422004238_cierre_periodo/migration.sql`
- Esta migración:
  `prisma/migrations/20260424123854_audit_insert_coverage_completion/migration.sql`
- Helper de auditoría: `features/shared/audit-context.ts`
- ADR-001 (eliminación de audit log de imbalance):
  `docs/adr/001-eliminacion-audit-log-imbalance.md`
