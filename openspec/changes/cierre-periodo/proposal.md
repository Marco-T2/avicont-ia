# Proposal: cierre-periodo (revised)

## Intent

Unificar el cierre de período contable en un único servicio canónico `MonthlyCloseService`, cerrando un agujero de seguridad actualmente activo en el flujo legacy y alineando el modelo `FiscalPeriod` con la semántica real del negocio (cierre **mensual plano**, no anual). Esta propuesta agrega invariantes contables duras (DEBE = HABER por período), extiende la infraestructura de AuditLog con correlación transaccional y justificación obligatoria diferenciada para ediciones de documentos LOCKED, y deprecar el método `FiscalPeriodsService.close` que hoy cierra períodos sin bloquear dispatches ni payments POSTED.

## Problem

### Dos flujos paralelos con garantías incompatibles

En `avicont-ia` coexisten HOY dos implementaciones de "cierre de período" sobre el mismo modelo `FiscalPeriod`:

1. **Flujo LEGACY (ACTIVO, INSEGURO)** — `features/fiscal-periods/fiscal-periods.service.ts#close` + `PATCH /api/organizations/[orgSlug]/periods/[periodId]` + `components/accounting/period-close-dialog.tsx` (expuesto desde `settings/periods/page.tsx`). Valida únicamente que no queden `JournalEntry` en `DRAFT`, y flippea `FiscalPeriodStatus` a `CLOSED` con un `UPDATE` simple. **No valida DRAFT de `Dispatch` ni `Payment`. No lockea ninguno de los POSTED.**
2. **Flujo NUEVO** — `features/monthly-close/monthly-close.service.ts#close` + `POST /api/organizations/[orgSlug]/monthly-close` + `components/settings/monthly-close-panel.tsx`. Valida `DRAFT` en las tres entidades (`dispatch`, `payment`, `journalEntry`), bloquea atómicamente los `POSTED → LOCKED` de las tres, y recién después flippea el período a `CLOSED`, todo en una transacción única con `setAuditContext`.

El flujo legacy NO ES deuda técnica pasiva — **es un agujero de seguridad activo**. Un admin con `accounting-config:write` puede cerrar un período por el PATCH legacy y dejar los `Dispatch` y `Payment` en `POSTED` (no `LOCKED`). Cualquier consumidor futuro que asuma "período cerrado ⇒ documentos lockeados" leerá datos inconsistentes; cualquier política de edición que se apoye en el flag `LOCKED` (en lugar del gate `validatePeriodOpen`) queda sorteable. La deprecación del legacy es **prioridad máxima, paralela con la construcción de tests**.

### El modelo `FiscalPeriod` está mal nombrado Y mal dimensionado

`FiscalPeriod` hoy es `@@unique([organizationId, year])` — un único período anual `OPEN` por organización. El feature se llama `monthly-close` y la documentación lo describe como "mes contable", pero la tabla no tiene columna `month` y solo admite cierre anual. Para soportar cierre mensual real (el workflow que el negocio contable espera: cerrar enero, después febrero, etc.) el modelo debe cambiar. El entity jerárquico `FiscalYear` (que agruparía meses dentro de una gestión) **se defiere explícitamente a un cambio SDD futuro** (`cierre-de-gestion-anual`); esta propuesta adopta el modelo más simple posible: `FiscalPeriod` plano mensual.

### Ausencia total de cobertura

- No existe `openspec/specs/monthly-close/spec.md` ni `openspec/specs/fiscal-periods/spec.md`.
- `MonthlyCloseService` y `FiscalPeriodsService.close` no tienen tests unitarios ni de integración. El único test en `monthly-close/` cubre RBAC de la página.
- Cualquier refactor es ciego.

### Invariante contable ausente

Hoy se puede cerrar un período aunque los `JournalEntry` del período **no cuadren** (suma de débitos ≠ suma de créditos). El sistema registra el cierre; la contabilidad queda rota. No hay validación de partida doble a nivel de período.

## Proposed Solution

**Opción 1 — Unificar sobre `MonthlyCloseService` canónico y DEPRECAR el flujo legacy.** El servicio se mantiene con el nombre `MonthlyCloseService` (más preciso ahora que el modelo pasa a ser mensual plano). La decisión incluye cinco ejes obligatorios:

### 1. Cambio de modelo: `FiscalPeriod` anual → mensual plano

- Reemplazar `@@unique([organizationId, year])` por `@@unique([organizationId, year, month])`.
- `month` es un `Int` en rango 1-12 (calendario, no contable offseteado).
- Se permiten múltiples `FiscalPeriod` `OPEN` por organización dentro del mismo año (uno por mes no cerrado).
- El entity jerárquico `FiscalYear` (agrupador de meses por gestión) **se defiere** a un cambio SDD posterior cuando se aborde el cierre de gestión anual con asientos de refundición.

### 2. Invariante DEBE = HABER por período (obligatoria)

Antes de permitir el cierre, `MonthlyCloseService.close` DEBE validar que la suma de débitos y la suma de créditos de los `JournalEntry` posteados en el período son iguales. Si no cuadran, el cierre se rechaza con un error explícito (`PERIOD_NOT_BALANCED`) indicando los totales y la diferencia. **No es nice-to-have; es invariante contable dura.**

### 3. Extensiones de infraestructura AuditLog

Cinco adiciones concretas, listadas aquí porque cada una toca schema/trigger/helper y debe aparecer auditable en Scope/Impact:

1. **Nuevo trigger sobre `fiscal_periods`** — el evento de cierre queda con su propia fila de auditoría (un ancla auditable por close), no solo inferido por agregación de STATUS_CHANGE hijas.
2. **Nuevo trigger sobre `purchases`** — paridad con `sales`. **NOTA EXPLÍCITA AL REVIEWER**: este cambio es adicional al alcance original de cierre; se incluye porque la ausencia del trigger es un gap de auditabilidad comparable al hueco en `fiscal_periods`, y cerrarlo en la misma migración evita otra migración trigger-only en las próximas semanas.
3. **Nueva columna `correlationId: String?` sobre `AuditLog`** con índice. Se genera como UUID al inicio de `MonthlyCloseService.close()`, se propaga vía una nueva variable de sesión `app.correlation_id` (paralelamente a `app.current_user_id` y `app.audit_justification`), y cada fila que el trigger emita durante esa transacción lleva el mismo `correlationId`. Esto permite reconstruir "todo lo que pasó en ese cierre" con una query exacta, reemplazando la idea frágil de usar `justification` free-text como anchor de correlación.
4. **Extensión del trigger `audit_trigger_fn()`** — debe leer también `app.correlation_id` vía `current_setting(..., true)` y persistirlo en la nueva columna.
5. **Extensión del helper `setAuditContext`** — firma pasa a `setAuditContext(tx, userId, justification?, correlationId?)`; `correlationId` es opcional para no romper los call sites actuales.

### 4. Enforcement de justificación en capa de servicio

Editar un documento `LOCKED` REQUIERE `justification` no vacía, con mínimos **diferenciados por estado del período**:

- Documento LOCKED en período con status `OPEN` (mes corriente — escenario "ajuste de último minuto"): `justification.length >= 10`.
- Documento LOCKED en período con status `CLOSED` (mes pasado — escenario "edita algo cerrado, caso serio"): `justification.length >= 50`.

Si falta o es muy corta, el servicio lanza `LOCKED_EDIT_REQUIRES_JUSTIFICATION` con el mínimo requerido en el mensaje. La validación vive en capa de servicio (tiene acceso al rol, al estado del período y puede devolver errores útiles); el trigger DB permanece como mecanismo pasivo de persistencia.

### 5. Deprecación del flujo legacy

- `FiscalPeriodsService.close` se ELIMINA del service (no se marca @deprecated-esperando-migración — se borra; es un agujero activo).
- `PATCH /api/organizations/[orgSlug]/periods/[periodId]` pierde la acción de cierre (se recorta o se elimina si solo servía para eso).
- El consumidor UI (`components/accounting/period-close-dialog.tsx` desde `settings/periods/page.tsx`) se migra a invocar el endpoint canónico del flujo nuevo (`POST /api/organizations/[orgSlug]/monthly-close` o path ajustado según spec).
- Cobertura TDD obligatoria antes de tocar `MonthlyCloseService`: tests unitarios (mocks de repo) e integración (Prisma) que capturen el comportamiento actual, después refactor.

## Scope

### In scope

- **Model change**: `prisma/schema.prisma` — `FiscalPeriod` pasa a `@@unique([organizationId, year, month])`, campo `month Int` agregado.
- **Invariante DEBE = HABER**: nueva función en `MonthlyCloseService` o en un helper contable, invocada como precondición de `close`.
- **AuditLog extensions (todo listado, no esparcido):**
  - Columna nueva `correlationId: String?` + índice sobre `AuditLog`.
  - Trigger nuevo sobre `fiscal_periods`.
  - **Trigger nuevo sobre `purchases` (paridad con `sales` — explícitamente incluido, no colado).**
  - Extensión de `audit_trigger_fn()` para leer `app.correlation_id`.
  - Extensión de `setAuditContext` con parámetro opcional `correlationId`.
- **Service-layer enforcement**: validación de `justification` mínima diferenciada (10 / 50) al editar documentos LOCKED, con error `LOCKED_EDIT_REQUIRES_JUSTIFICATION`.
- **`MonthlyCloseService.close`**: genera UUID de correlación, lo setea en session var, lo propaga al `setAuditContext`.
- **Deprecación**: `FiscalPeriodsService.close` eliminado; `PATCH /periods/[periodId]` recortado; UI `period-close-dialog.tsx` migrada al endpoint canónico.
- **Specs nuevas**: `openspec/specs/monthly-close/spec.md` (canónica) + delta spec de `audit-log` si existe, o nueva `openspec/specs/audit-log/spec.md` cubriendo `correlationId` + justificación.
- **Tests nuevos**: unitarios + integración Prisma de `MonthlyCloseService`, tests de route handler, tests del trigger extendido, tests de la validación de `justification`.

### Out of scope

- **Cierre de Gestión anual** (entity jerárquico `FiscalYear`, asientos de refundición/cierre, cierre contra resultado acumulado) — cambio SDD futuro.
- **Enforcement a nivel DB de `justification`** (ej. CHECK constraint validando `current_setting('app.audit_justification')` según contexto) — alta complejidad, bajo ROI para equipo chico; se deja como deuda visible.
- **Flujo de reapertura de período** (`CLOSED → OPEN`) — si se necesita, propuesta aparte.
- **Migración retroactiva de documentos en períodos ya cerrados por el flujo legacy** — los datos de desarrollo se destruyen en la migración; no aplica.
- **Refactor de `FiscalPeriodStatus` enum** — se mantiene `OPEN | CLOSED`.

## Migration strategy

**Migración destructiva justificada**: la base de datos está en desarrollo con aproximadamente 10 registros de prueba descartables. No hay datos reales ni productivos. En ese contexto, una migración destructiva es **preferible** a una migración stepwise:

- No hay riesgo de pérdida de información productiva.
- Un backfill stepwise ("asignar `month = 12` por defecto a períodos existentes, después permitir nuevos con month real") introduce complejidad accidental sin beneficio — los registros existentes no reflejan meses reales, son datos de prueba.
- La migración Prisma hace `DROP` efectivo del constraint anterior y recrea con el nuevo shape. Se documenta en el archivo de migración que es destructiva y se asume base de desarrollo.

**Explícitamente**: esta propuesta NO es aplicable tal cual a una base con datos reales. Si más adelante hay deploy a producción con data real antes de aplicar este cambio, la estrategia debe replanificarse (backfill de `month` o window de downtime).

## Impact

### Archivos / features afectados

```
prisma/
  schema.prisma                                      # EDIT — FiscalPeriod + AuditLog.correlationId
  migrations/<timestamp>_cierre_periodo/
    migration.sql                                    # NEW — destructiva + triggers nuevos + correlationId
features/
  monthly-close/
    monthly-close.service.ts                         # EDIT — DEBE=HABER, correlationId, justificación
    monthly-close.repository.ts                      # EDIT si corresponde (query por month)
    monthly-close.types.ts                           # EDIT (tipos month-aware)
    __tests__/                                       # NEW — TDD obligatorio
  fiscal-periods/
    fiscal-periods.service.ts                        # EDIT — eliminar close()
    fiscal-periods.validation.ts                     # EDIT — eliminar closeFiscalPeriodSchema si aplica
  shared/
    audit-context.ts                                 # EDIT — agregar correlationId opcional
    errors.ts                                        # EDIT — agregar PERIOD_NOT_BALANCED, LOCKED_EDIT_REQUIRES_JUSTIFICATION
    document-lifecycle.service.ts                    # EDIT — enforcement de justificación diferenciada
app/
  api/organizations/[orgSlug]/
    monthly-close/route.ts                           # EDIT — propagar correlationId, payload de justificación
    monthly-close/summary/route.ts                   # EDIT si aplica (month en params)
    periods/[periodId]/route.ts                      # EDIT — recortar PATCH de cierre
  (dashboard)/[orgSlug]/
    accounting/monthly-close/page.tsx                # EDIT — UI month-aware
    settings/periods/page.tsx                        # EDIT — migrar al endpoint canónico
components/
  settings/monthly-close-panel.tsx                   # EDIT — input de justification, selector de mes
  accounting/period-list.tsx                         # EDIT — mostrar month + migrar CTA
  accounting/period-close-dialog.tsx                 # EDIT — apuntar al endpoint canónico + input justification
openspec/specs/
  monthly-close/spec.md                              # NEW
  audit-log/spec.md                                  # NEW o DELTA (correlationId + justificación)
```

### Nueva migración Prisma

- Destructiva sobre `fiscal_periods` (cambio de unique).
- Agrega columna `correlationId` con índice en `audit_log`.
- Extiende función `audit_trigger_fn()` para leer `app.correlation_id`.
- Crea triggers `audit_trigger` sobre `fiscal_periods` y `purchases`.

### Breaking schema changes

- `FiscalPeriod` — cualquier código que asuma un único período OPEN por año se rompe. Se debe auditar usages de `findFirst({ where: { status: OPEN } })` y actualizar a query con `month`.
- `AuditLog` — código que construye `AuditLog` manualmente (fuera del trigger) debe incluir `correlationId` si aplica (o dejarlo `null`).
- `setAuditContext` — firma con un parámetro más; todos los call sites siguen compilando porque es opcional, pero se recomienda pasar `correlationId` en operaciones críticas.

### Breaking API changes

- `PATCH /api/organizations/[orgSlug]/periods/[periodId]` con payload de cierre deja de funcionar. Impacto interno; sin clientes externos documentados.
- `POST /api/organizations/[orgSlug]/monthly-close` — payload pasa a requerir `month` además de `year` (y opcionalmente `justification` para forzar el cierre con notas de contexto).

## Risks

### Riesgo 1 — No hay tests en ninguno de los dos flujos hoy

**Qué**: `MonthlyCloseService` y `FiscalPeriodsService.close` no tienen tests. Cualquier cambio al flujo nuevo — y la introducción de DEBE=HABER, correlationId, justificación, y el cambio de modelo — es ciego. Una regresión en `close` corrompe datos contables no-reversibles.

**Mitigación**: Strict TDD obligatorio y ORDEN explícito: primero escribir tests que capturen el comportamiento actual del flujo nuevo (unitarios con mocks + integración contra Prisma con sqlite o testcontainer), con la suite pasando en verde. Después agregar tests para el comportamiento NUEVO (DEBE=HABER, correlationId, justificación, month en el modelo). Recién después modificar el código. El refactor y el cambio de modelo quedan protegidos por la suite. Verify phase bloquea el merge si baja la cobertura.

### Riesgo 2 — La migración destructiva no tiene rollback

**Qué**: La migración destructiva borra los `FiscalPeriod` actuales (y por cascada los `JournalEntry` asociados) para recrear con el shape mensual plano. Una vez aplicada localmente o en un entorno compartido de desarrollo, no hay vuelta atrás por migración; habría que restaurar desde backup manual.

**Mitigación**: (a) Documentar explícitamente en el header del archivo de migración que es destructiva y asume base de desarrollo. (b) Coordinar con el usuario ANTES de aplicar que no hay data importante. (c) Recomendar `pg_dump` previo del schema `public` antes del `prisma migrate deploy`, como ritual operativo para este cambio específico. (d) La spec de la migración debe incluir un smoke test post-migración que verifique el nuevo shape.

### Riesgo 3 — Propagación de `correlationId` a través de transacciones anidadas

**Qué**: `app.correlation_id` se setea vía `SET LOCAL` dentro de una transacción. Si `MonthlyCloseService.close` invoca internamente otro servicio que abre su propia transacción anidada (savepoint o transacción separada con Prisma `$transaction` dentro de un callback de `$transaction`), la variable de sesión puede no estar visible — el trigger leería `null` y se perdería la correlación para esas filas.

**Mitigación**: (a) Auditar antes del apply que toda la operación de cierre corre en una única transacción Prisma (un solo `$transaction` que envuelve todo). (b) Test de integración específico: invocar `close()` sobre data real, después consultar `AuditLog` y verificar que TODAS las filas emitidas durante la transacción llevan el mismo `correlationId`. (c) Documentar en el diseño la regla: "cualquier nueva llamada dentro de `close` debe reutilizar `tx`, no abrir transacción nueva".

## Operational constraints

### Regla de equipo obligatoria: nunca UPDATE directo sobre tablas auditadas

**El enforcement app-side de `justification` NO es defensa en profundidad contra UPDATEs directos por SQL.** Un script de mantenimiento, una migración ad-hoc, un fix manual por consola — todo eso bypass del servicio y del trigger registra la fila con `justification = null` sin queja. La DB no tiene CHECK constraint que obligue justificación.

**Regla formal del equipo, incluida en esta propuesta:**

> Nunca ejecutar `UPDATE` (ni `DELETE` ni `INSERT`) directo contra tablas con trigger de auditoría (`dispatches`, `payments`, `journal_entries`, `sales`, `purchases`, `fiscal_periods`). Todas las mutaciones pasan por la capa de servicio correspondiente. Scripts de mantenimiento deben llamar a los services como cualquier otro cliente.

Esto se documenta en `CLAUDE.md` del proyecto y en el spec de audit-log cuando se escriba.

### Deuda visible: enforcement DB-level fuera de scope

Un CHECK constraint a nivel DB sobre `current_setting('app.audit_justification', true)` según rol/contexto daría defensa en profundidad real. **Está explícitamente fuera de alcance** en esta propuesta porque:

- Alta complejidad: requeriría postgres functions con lógica de negocio (leer rol, leer estado del período, aplicar mínimos diferenciados).
- Bajo ROI: equipo chico, todas las mutaciones pasan hoy por services, la superficie de ataque real es scripts ad-hoc que ya están bajo review humano.
- Mantener simetría con la regla de equipo; si la regla se viola con frecuencia, reabrir como nuevo SDD.

Se deja asentado como deuda técnica reconocida, no como gap olvidado.

## Open Questions

La mayoría de las preguntas del draft original fueron resueltas por el usuario en esta iteración:

**Resueltas:**
- ~~Naming del feature~~ → `MonthlyCloseService` se mantiene; el modelo ahora SÍ es mensual, así que el nombre es correcto.
- ~~Path API canónico~~ → `monthly-close` se mantiene (alineado con el service).
- ~~Variantes (mensual/anual)~~ → solo mensual plano en este cambio; gestión anual es SDD futuro.
- ~~Destructiva vs stepwise~~ → destructiva, dev-only data.
- ~~DEBE=HABER opcional o mandatorio~~ → mandatorio, invariante contable dura.
- ~~AuditLog solo vía trigger o con ancla explícita~~ → trigger nuevo sobre `fiscal_periods` + `correlationId` + trigger de paridad sobre `purchases`.
- ~~Enforcement de justificación app-side o DB-side~~ → app-side con mínimos diferenciados; DB-side fuera de scope.
- ~~Migración retroactiva de documentos~~ → no aplica, dev data se destruye.

**Remanentes (a resolver en sdd-spec / sdd-design):**

1. **Permiso RBAC del cierre**: ¿se unifica bajo `reports:write` (como el flujo nuevo hoy) o se crea un permiso nuevo específico `period:close`? El flujo legacy usa `accounting-config:write` — dependiendo de qué se elija, hay que auditar la matriz RBAC antes del apply.
2. **Bloqueo de `Purchase` y `Sale`**: hoy `MonthlyCloseService.close` lockea `dispatch`, `payment`, `journalEntry`. Agregar el trigger sobre `purchases` abre la pregunta: ¿también se lockean `Purchase` y `Sale` como documentos en el close? La exploración no confirmó si están cubiertas indirectamente (vía su `journalEntry` asociado) o si quedan huérfanas. Decidir en spec.
3. **Idempotencia del POST**: si el cliente reintenta un cierre que ya completó, ¿`PERIOD_ALREADY_CLOSED` es aceptable, o se implementa handshake idempotente (token de ejecución)? Relevante para UI con retry automático.
4. **Evento de dominio post-close**: ¿se emite `FiscalPeriodClosed` además del `setAuditContext`? Si `migracion-backend-dedicado` o notificaciones futuras lo consumen, conviene decidirlo ahora; si no hay consumidores claros, YAGNI.
5. **UI de `correlationId`**: ¿se expone al usuario (ej. en vista de auditoría tipo "ver todo lo que pasó en este cierre")? Si sí, necesita endpoint de query por `correlationId` + página. Si no, queda como herramienta interna de debugging. Impacta scope de specs/tasks.
