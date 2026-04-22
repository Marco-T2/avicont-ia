# Proposal — fiscal-period-monthly-create

**Severity**: CRITICAL (silent data corruption + core invariant break)
**Status**: Proposed
**Date**: 2026-04-21

---

## Resumen

Reparar los tres defectos del cambio archivado `cierre-periodo` (2026-04-21) que bloquean el flujo end-to-end del modelo mensual y permiten corrupción silenciosa de períodos cerrados. Los defectos son:

1. **CRITICAL-01** — `FiscalPeriodsService.create` rechaza cualquier segundo período en el mismo año (el modelo mensual queda inutilizable más allá del primer mes).
2. **CRITICAL-02** — Un guard de "único período OPEN" contradice la decisión explícita de la propuesta de `cierre-periodo` (múltiples OPEN dentro del año).
3. **CRITICAL-03** — `MonthlyCloseService.close` permite que `Sale` y `Purchase` en estado `DRAFT` queden dentro de un período `CLOSED`, sin bloqueo ni auditoría: corrupción silenciosa.

Este change bloquea el cambio en pausa `monthly-close-ui-reconciliation`: reconciliar la UI sobre un core roto no tiene sentido.

---

## Contexto

El change `cierre-periodo` (archivado 2026-04-21) entregó el modelo mensual de períodos fiscales: migró el schema a `FiscalPeriod.month` con `@@unique([organizationId, year, month])`, añadió la ruta canónica `MonthlyCloseService.close` con cascada de locking (Dispatch → Payment → JournalEntry → Sale → Purchase), permiso dedicado `period:close`, `correlationId` de auditoría, y 2650 tests verdes.

Después del archive, una auditoría de deuda residual (ver `openspec/changes/monthly-close-ui-reconciliation/residual-debt-audit.md`, findings F-01, F-02, F-03; también en engram vía `sdd/monthly-close-ui-reconciliation/residual-debt-audit`) descubrió tres defectos funcionales que la suite no detectó porque los fixtures usan estado limpio. El servicio de creación todavía razona como si el modelo fuera anual, y la lista de entidades verificadas contra DRAFT en `close()` quedó sincronizada con el estado pre-Sale/Purchase del conteo pero desincronizada con la cascada de locking que SÍ cubre esas dos entidades.

La reconciliación de UI (`monthly-close-ui-reconciliation`) fue explorada pero está **pausada** hasta resolver estos defectos de core. El foco de esta propuesta es exclusivamente la semántica del servicio de creación de períodos y la integridad del guard de drafts al cerrar — nada de UI, nada de permisos, nada de legacy cleanup.

---

## Defectos a resolver

### CRITICAL-01 — `FiscalPeriodsService.create` bloquea segundo período en el mismo año

**Evidencia**:
- `features/fiscal-periods/fiscal-periods.service.ts:48` — `const existing = await this.repo.findByYear(organizationId, input.year);`
- `features/fiscal-periods/fiscal-periods.repository.ts:24-29` — `findByYear` consulta `WHERE year = $year` sin filtro por `month`.

**Efecto**: tras crear un período para enero 2026, cualquier intento de crear febrero/marzo/... 2026 falla con `FISCAL_PERIOD_YEAR_EXISTS`. El modelo mensual que entregó `cierre-periodo` (columna `month` + unique `(organizationId, year, month)`) queda inerte en la capa de servicio: se pueden cerrar a lo sumo 12 períodos de vida real si y solo si cada uno usa un año distinto, lo cual es absurdo.

**Dirección del fix**: la creación debe chequear unicidad por `(organizationId, year, month)`, derivando `month` de `input.startDate.getUTCMonth() + 1` (la misma lógica que el repositorio ya usa en `create`, ver `fiscal-periods.repository.ts:53`). El guard debe dejar que la DB sea la fuente de verdad: si la pre-verificación falla por race, el error `P2002` sobre `organizationId_year_month` debe mapearse al mismo `ConflictError` que expone el servicio.

---

### CRITICAL-02 — Guard `findOpenPeriod` contradice múltiples OPEN permitidos

**Evidencia**:
- `features/fiscal-periods/fiscal-periods.service.ts:56-60` — `const openPeriod = await this.repo.findOpenPeriod(organizationId); if (openPeriod) throw ConflictError(..., ACTIVE_PERIOD_ALREADY_EXISTS);`
- `features/fiscal-periods/fiscal-periods.repository.ts:32-37` — `findOpenPeriod` devuelve el primer `status = 'OPEN'` de la organización.
- `openspec/changes/archive/2026-04-21-cierre-periodo/proposal.md` declaró explícitamente: *"Se permiten múltiples `FiscalPeriod` OPEN por organización dentro del mismo año (uno por mes no cerrado)."*

**Efecto**: con enero 2026 aún OPEN, intentar crear febrero 2026 falla con `ACTIVE_PERIOD_ALREADY_EXISTS`. El ciclo real del contador — donde enero queda abierto para ajustes mientras febrero ya se está operando — es imposible.

**Dirección del fix**: eliminar el guard completo. El modelo mensual no requiere limitar a un OPEN por organización; la unicidad la garantiza ya el constraint `(organizationId, year, month)`. La constante `ACTIVE_PERIOD_ALREADY_EXISTS` puede quedar sin callers — auditar y, si es así, marcarla para retirar (la remoción real es decisión de la fase design/apply, no de esta propuesta).

---

### CRITICAL-03 — Corrupción silenciosa: DRAFT Sale/Purchase puede entrar en período CLOSED

**Evidencia**:
- `features/monthly-close/monthly-close.repository.ts:44-63` — `countDraftDocuments` devuelve `{ dispatches, payments, journalEntries }` únicamente. No cuenta Sale ni Purchase.
- `features/monthly-close/monthly-close.service.ts:114-132` — el guard de drafts suma `drafts.dispatches + drafts.payments + drafts.journalEntries` y construye el `details` del error con solo esas tres claves.
- `features/monthly-close/monthly-close.repository.ts:160-190` — `lockSales` y `lockPurchases` filtran por `status = 'POSTED'`, por lo que las filas DRAFT son silenciosamente omitidas por la cascada.

**Descripción del modo de corrupción (texto crítico — preservar en diseño y tests)**:

> "Un período puede cerrar con DRAFTs de Sale/Purchase dentro. Esos DRAFTs no son bloqueados, no son auditados, no son contados — quedan flotando editables con fechas dentro de un período CLOSED. Este es exactamente el modo de corrupción que todo el change `cierre-periodo` estaba diseñado para prevenir."

La falla es silenciosa: no hay error, no hay warning, la UI de resumen no los muestra (porque `getSummary` también cuenta solo dispatches/payments/journalEntries), el audit log no registra su existencia al cierre. Un auditor que confíe en el estado post-close recibe una vista falsa de la realidad del período.

**Dirección del fix**:
- Extender `countDraftDocuments` para contar también Sale y Purchase con `status = 'DRAFT'`.
- Actualizar el guard en `close()` para sumar las 5 entidades (total de drafts es la suma completa).
- Actualizar el payload `details` de `ValidationError(PERIOD_HAS_DRAFT_ENTRIES, ...)` para incluir `sales` y `purchases` junto a las tres claves actuales — **esto es un breaking change de contrato** (ver Riesgo y mitigación).
- Actualizar el mensaje user-facing para nombrar venta(s) y compra(s) cuando corresponda.
- Corregir REQ-4 en `openspec/specs/monthly-period-close/spec.md`: el spec publicado dice *"across `Dispatch`, `Payment`, or `JournalEntry`"* y omite Sale/Purchase. La cascada de locking REQ-5 ya incluye las cinco entidades — la omisión de REQ-4 es un bug del spec que acompañó al bug del código.

---

## Cambios propuestos

### Nivel servicio — `FiscalPeriodsService.create`

- Reemplazar la llamada a `findByYear` por una nueva `findByYearAndMonth(organizationId, year, month)`, derivando `month` de `input.startDate.getUTCMonth() + 1` (misma regla que el repositorio usa ya en `create`).
- Mapear la violación de unique constraint (`P2002` sobre `organizationId_year_month`) a `ConflictError` con un código nuevo `FISCAL_PERIOD_MONTH_EXISTS` (o el nombre canónico que se decida en la fase spec; lo que NO corresponde es seguir emitiendo `FISCAL_PERIOD_YEAR_EXISTS`, que miente sobre la cardinalidad real).
- Eliminar el guard `findOpenPeriod` y su throw asociado.
- Evaluar si la constante `ACTIVE_PERIOD_ALREADY_EXISTS` queda sin callers después del cambio; listar callers residuales para el design y decidir allí si se retira del registry de errores.

### Nivel repositorio — `FiscalPeriodsRepository`

- Agregar `findByYearAndMonth(organizationId, year, month): Promise<FiscalPeriod | null>`.
- Evaluar si `findByYear` sigue teniendo callers válidos (listados de calendario anual, UI, tests). Si no los tiene, marcar para retiro en el design; si los tiene, dejar en paz — esta propuesta NO retira el método mientras haya consumo legítimo.

### Nivel monthly-close — `countDraftDocuments` + `close()`

- Extender tipo de retorno de `countDraftDocuments` a `{ dispatches, payments, journalEntries, sales, purchases }`.
- Agregar dos `COUNT WHERE status = 'DRAFT'` (uno para `sale`, uno para `purchase`) al `Promise.all` existente.
- En `MonthlyCloseService.close`, sumar las cinco entidades al computar `totalDrafts` (hoy suma solo tres).
- Actualizar la construcción del mensaje user-facing para incluir `N venta(s)` y `M compra(s)` cuando `drafts.sales > 0` y `drafts.purchases > 0` respectivamente.
- Actualizar el payload `details` del `ValidationError(PERIOD_HAS_DRAFT_ENTRIES, ...)` para incluir las cinco claves (breaking change — ver Riesgo y mitigación).
- Opcional pero recomendado en design: alinear `getSummary` (`monthly-close.service.ts:39-80`) para exponer también drafts de Sale/Purchase, de modo que el endpoint `/summary` no mienta al UI. Decisión final en la fase design.

### Nivel spec — corrección retroactiva de REQ-4

- Actualizar `openspec/specs/monthly-period-close/spec.md` REQ-4 para enumerar las cinco entidades (`Dispatch`, `Payment`, `JournalEntry`, `Sale`, `Purchase`) en el texto del requisito y en los scenarios.
- Actualizar la forma del payload declarada en REQ-4 scenario 1: hoy dice `{ dispatches, payments, journalEntries }`; debe decir `{ dispatches, payments, journalEntries, sales, purchases }`.
- Agregar una nota explícita de corrección: *"REQ-4 original (shipped 2026-04-21) omitió Sale y Purchase pese a que REQ-5 ya las locketea. Corregido 2026-04-21 vía fiscal-period-monthly-create."*

---

## Tests de multiplicidad (requeridos)

Los fixtures con estado limpio fueron el punto ciego. Estos tests existen específicamente para cubrir el estado *después* del nuevo comportamiento habilitado — no estados vacíos.

### Creación — 2 tests

1. **F-01 multiplicidad** — "Crear segundo período en el mismo año":
   - Seed: `FiscalPeriod(year=2026, month=1, status=OPEN|CLOSED)` existente.
   - Acción: `FiscalPeriodsService.create` para `year=2026, month=2`.
   - Esperado: éxito. Persiste el segundo período; NO lanza `FISCAL_PERIOD_YEAR_EXISTS`.

2. **F-02 multiplicidad** — "Crear nuevo período con otro OPEN existente":
   - Seed: `FiscalPeriod(year=2026, month=1, status=OPEN)`.
   - Acción: `FiscalPeriodsService.create` para `year=2026, month=2`.
   - Esperado: éxito. NO lanza `ACTIVE_PERIOD_ALREADY_EXISTS`.

### Cierre — 5 tests, uno por cada tipo de documento

Cada uno es su propio `it()`. **Sin atajos** — nada de una única prueba parametrizada.

3. **F-03 Dispatch** — seed un solo `Dispatch` con `status = 'DRAFT'` dentro del período OPEN; `close()` debe lanzar `ValidationError(PERIOD_HAS_DRAFT_ENTRIES)` con `details.dispatches = 1` y el resto en cero.
4. **F-03 Payment** — ídem con un solo `Payment` DRAFT; assert `details.payments = 1`.
5. **F-03 JournalEntry** — ídem con un solo `JournalEntry` DRAFT; assert `details.journalEntries = 1`.
6. **F-03 Sale** — ídem con un solo `Sale` DRAFT; assert `details.sales = 1` (clave nueva del contrato).
7. **F-03 Purchase** — ídem con un solo `Purchase` DRAFT; assert `details.purchases = 1` (clave nueva del contrato).

Cada test debe verificar que tras el throw: (a) `period.status` sigue siendo `OPEN`, (b) la fila DRAFT no cambió de estado, (c) no se emitió audit de `STATUS_CHANGE` sobre el período.

---

## Lecciones aplicadas de `cierre-periodo`

> "Los fixtures de test con estado limpio fueron el punto ciego que permitió que estos bugs escaparan 2650 tests. El próximo cambio de schema que relaje un constraint (unique, cardinality, nullability) debe incluir explícitamente **tests de multiplicidad** — casos donde el nuevo estado habilitado por el cambio realmente ocurre."

En la práctica, para este proyecto:

- **Regla**: cuando una migración cambia un constraint de unicidad (ej. pasar de `unique(year)` a `unique(year, month)`), la suite de tests del cambio DEBE incluir al menos un escenario con dos filas que el nuevo constraint permite y el viejo prohibía.
- **Regla**: cuando un cambio añade una nueva entidad a una cascada de operaciones (ej. sumar Sale y Purchase al locking de cierre), la suite DEBE incluir un test por cada entidad en cada punto de verificación — conteo de drafts, locking, audit. Inferir cobertura por simetría con entidades previas es exactamente cómo se infiltró F-03.
- **Aplicación retroactiva**: los 7 tests de multiplicidad arriba son la implementación directa de esta lección sobre los defectos reales heredados de `cierre-periodo`.

---

## Out of scope (explícito)

Los siguientes findings del audit residual NO se tocan en este change. Cada uno tiene destino propio:

- **F-06** — constante `LEGACY_CLOSE_REMOVED` huérfana → destino: `monthly-close-ui-reconciliation`.
- **F-04 / F-05 / F-07 / F-08 / F-11** — reconciliación de navegación, UI del botón de cierre, permisos en páginas, surfaces de legacy vs canonical → destino: `monthly-close-ui-reconciliation` (reanudable después del merge de este change).
- **F-09** — miembro muerto `INSUFFICIENT_PERMISSION` en una union → destino: fix standalone pequeño.
- **F-10** — método muerto `updateStatus` → destino: fix standalone pequeño.

Tampoco se toca nada del UI, nada de migraciones de schema (el schema ya es correcto desde `cierre-periodo` Phase 1), nada de roles/permisos, nada de legacy `FiscalPeriodsService.close` (ya eliminado).

---

## Preguntas abiertas

1. **¿Nombre del nuevo código de error para unicidad mensual?** Candidatos: `FISCAL_PERIOD_MONTH_EXISTS`, `FISCAL_PERIOD_ALREADY_EXISTS` (genérico), reutilizar `FISCAL_PERIOD_YEAR_EXISTS` con mensaje actualizado (engañoso — descartar). Decisión en fase spec.
2. **¿`getSummary` debe exponer también drafts de Sale y Purchase?** No es parte del bug reportado en F-03 (el bug es en `close`), pero es el mismo contrato desalineado. Pinta natural resolverlo aquí para mantener coherencia — decisión en fase design.
3. **¿La constante `ACTIVE_PERIOD_ALREADY_EXISTS` y `findOpenPeriod` en el repo se retiran ya o se marcan como deprecated?** Depende de callers residuales en UI y tests. Inventario de callers en design.

---

## Riesgo y mitigación

- **Breaking change del contrato `PERIOD_HAS_DRAFT_ENTRIES.details`**: agregar `sales` y `purchases` al payload es una adición de claves, lo cual es técnicamente backward-compatible en lectores que hacen destructuring parcial. Pero cualquier consumidor que itere las claves del objeto o haga `Object.keys(details).length === 3` rompe. **Mitigación**: identificar todos los callers del payload (UI de error, tests, cualquier mapper en `features/shared/errors`) en la fase design; marcar explícitamente el cambio como breaking en el spec delta; tests de multiplicidad F-03 Sale y F-03 Purchase obligan a que los consumidores se actualicen.
- **Eliminar `ACTIVE_PERIOD_ALREADY_EXISTS`**: la constante está exportada desde `features/shared/errors`. Antes de borrarla, inventariar callers (tests, UI de mensaje de error, cualquier mapper). **Mitigación**: inventario obligatorio en design; si quedan callers no triviales, dejar la constante deprecated con comentario hasta un cleanup dedicado.
- **Mapeo de `P2002` a `ConflictError`**: si el servicio confía solo en la pre-verificación, una race condition puede filtrar un `PrismaClientKnownRequestError` crudo al caller. **Mitigación**: el design debe especificar explícitamente el wrapper try/catch alrededor de `repo.create` y el mapping a `ConflictError` con el código nuevo.
- **Regresión en calendarios / listas anuales**: si `findByYear` se usa en la UI para filtrar periodos por año (vista calendario), borrarlo rompe esa vista. **Mitigación**: inventario de callers antes de retirar; alternativamente, conservarlo y solo dejar de llamarlo desde `create`.

---

## Dependencias

- **Bloquea**: `monthly-close-ui-reconciliation` (pausado). La UI reconcilia sobre un core correcto; mientras F-01/F-02/F-03 vivan, la reconciliación es sobre arena movediza.
- **Depende de**: nada. El schema ya es correcto desde `cierre-periodo` Phase 1 (columna `month` + `@@unique([organizationId, year, month])`). Solo hay que corregir los guards de servicio y el conteo de drafts.

---

## Next phase

`sdd-spec` → formalizar REQs en `openspec/changes/fiscal-period-monthly-create/specs/` con dos deltas:

1. Delta sobre la canonical de `fiscal-periods` (o creación de ella si no existe) describiendo el nuevo contrato de `create` con unicidad mensual y sin guard de único OPEN.
2. Delta sobre `monthly-period-close` corrigiendo REQ-4 (cinco entidades en el guard de drafts y en el payload `details`).
