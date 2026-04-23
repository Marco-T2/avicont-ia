# Proposal — fiscal-period-form-ux

**Severity**: MEDIUM (UX guidance gap; enables operator misconfiguration that manifests as systemic confusion downstream)
**Status**: Proposed
**Date**: 2026-04-22

---

## Resumen

Reparar el gap de UX en el diálogo de creación de períodos fiscales (`PeriodCreateDialog`) que induce al usuario a crear UN período anual en lugar de 12 períodos mensuales. El motor de cierre mensual ya funciona correctamente end-to-end (verificado empíricamente 2026-04-22 con las 4 invariantes: Aislamiento, Coexistencia, Bloqueo efectivo, Trazabilidad) — pero la UI de creación no guía al usuario hacia la granularidad mensual que el modelo de datos ya espera y que el ciclo real del contador requiere.

El scope es **exclusivamente UX**: placeholder, guía textual, campo de mes, y botón "crear los 12 meses del año". No se agrega enforcement estructural (schema permite rangos arbitrarios por decisión de flexibilidad previa). El sistema sigue soportando períodos de granularidad custom para casos edge; simplemente deja de inducir la confusión anual como default.

---

## Contexto

El change archivado `fiscal-period-monthly-create` (2026-04-22) corrigió el motor: `FiscalPeriodsService.create` deriva `month` de `startDate.getUTCMonth() + 1`, el constraint `@@unique([organizationId, year, month])` garantiza un período por mes. El change archivado `cierre-periodo` (2026-04-21) entregó la cascada de locking mensual con `correlationId` de auditoría.

Durante la verificación E2E del flujo de cierre (2026-04-22, post-archive de `monthly-close-ui-reconciliation`), el usuario reportó empíricamente:

> "cree un comprobante en abril y otro en mayo D2605-000002... D2604-000001... Confirmar Cierre de Período... Se bloquearán 2 registro(s) contabilizados..."

Diagnóstico inicial: fallo del motor de cierre. Diagnóstico real tras investigación: el usuario tenía UN solo período fiscal "Gestión 2026" que cubría del 1 de enero al 31 de diciembre de 2026 — ambos comprobantes (abril y mayo) caían dentro del mismo período por su `periodId`, no por su fecha.

Quote del usuario (2026-04-22) que cerró la causa raíz:

> "si eso estaba mal, ya lo verifique, me hizo confundir el text ejmplo de creacion ej. Gestion 2026 y lo creee desde el 1ero de enero a diciembre es por eso que hagarraba ambos"

El placeholder del form (`"Ej: Gestión 2026"` en `period-create-dialog.tsx:88`) guió explícitamente al usuario hacia un período anual. Combinado con la ausencia total de un campo `mes` en el form y la ausencia de texto aclaratorio sobre el modelo mensual esperado, la UX es activa y confiablemente engañosa.

---

## Defecto a resolver

### UX-01 — Placeholder induce período anual

**Evidencia**:
- `components/accounting/period-create-dialog.tsx:88` — `placeholder="Ej: Gestión 2026"`
- Mismo archivo líneas 83-128 — el form tiene 4 campos: `name`, `year`, `startDate`, `endDate`. **No hay campo `mes`**, no hay texto de ayuda, no hay opción de generación batch.
- `features/fiscal-periods/fiscal-periods.validation.ts:3-15` — schema Zod acepta libremente `name, year, startDate, endDate`; no hay restricción a granularidad mensual.
- `features/fiscal-periods/fiscal-periods.service.ts:70` — `month = input.startDate.getUTCMonth() + 1` (derivación silenciosa; el usuario no ve que esto ocurre).

**Efecto (reproducido empíricamente)**: un usuario siguiendo el placeholder literalmente crea un único período por año. El motor de cierre trabaja correctamente sobre ese período único, pero el modelo mental del usuario ("cierre mensual") no matchea la realidad persistida ("período anual único"). Todos los vouchers del año caen en ese período por FK. Cierre de "abril" bloquea vouchers de mayo porque ambos comparten `periodId`.

**Modo de corrupción mental (texto crítico — preservar en spec y tasks)**:

> "El usuario cree que el sistema no funciona. El sistema funciona perfectamente — pero sobre un estado configurado distinto al que el usuario cree que configuró. La discrepancia nace en el momento de creación del período y se revela recién al primer intento de cierre, días o semanas después. Es una trampa temporal: la confusión está latente desde el día uno y solo se manifiesta cuando el operador intenta cosechar el beneficio del modelo mensual."

---

## Cambios propuestos

### UI — `PeriodCreateDialog` (`components/accounting/period-create-dialog.tsx`)

**Cambio 1 — Placeholder + label**:
- Cambiar placeholder de `"Ej: Gestión 2026"` a algo como `"Ej: Abril 2026"` (concreto, mensual, sugiere granularidad correcta).
- Agregar microcopia explicativa debajo del título del dialog: "Un período fiscal representa un mes contable. Cerrarás uno por mes." (decisión final del texto exacto en la fase spec).

**Cambio 2 — Campo mes explícito**:
- Agregar un `<Select>` de mes (enero–diciembre) antes de las fechas. La selección de mes + año autocompleta `startDate = primer día del mes` y `endDate = último día del mes`. Las fechas siguen siendo editables para respetar la flexibilidad existente (si alguien quiere un período custom puede sobrescribir, pero ya no es el camino default).
- El campo `name` se autocompleta como `"{MesEspañol} {año}"` (ej. "Abril 2026") cuando mes+año están seleccionados. Sigue editable.

**Cambio 3 — Shortcut "Crear 12 meses del año"**:
- Agregar un botón secundario en el dialog: "Crear los 12 meses de {año}". Al hacer click, emite 12 creaciones secuenciales (Enero a Diciembre) para el año seleccionado. Cierra el dialog con un toast de éxito ("12 períodos creados") o reporta cuáles fallaron (si algunos ya existían por `FISCAL_PERIOD_MONTH_EXISTS`).
- Este shortcut resuelve el caso real del contador que está arrancando el año y quiere los 12 meses listos de una.

### Validación opcional (soft warning, no enforcement)

**Cambio 4 — Warning cuando `startDate` y `endDate` cruzan meses**:
- Si el usuario edita manualmente las fechas y termina con un rango que NO es exactamente un mes calendario (`startDate.month !== endDate.month` O `startDate.day !== 1` O `endDate !== lastDayOf(startDate.month)`), mostrar un warning visual: "Este período abarca más de un mes. El cierre mensual bloqueará todos los vouchers de este período a la vez. ¿Es lo que querés?".
- El warning NO bloquea la submisión — es soft. Preserva flexibilidad para casos edge (períodos custom, años fiscales no-calendario) mientras guía al default mensual.

### API / Service / Schema — SIN CAMBIOS

- `createFiscalPeriodSchema` (validation) permanece igual. La UX guía; no agrega restricciones al contrato.
- `FiscalPeriodsService.create` permanece igual. La derivación de `month` sigue funcionando.
- `FiscalPeriod` schema permanece igual. No se agregan constraints de alineación a mes calendario.

Este es un change **puramente de frontend**. No toca backend, no toca schema, no toca permisos. El enforcement estructural (Opción B discutida con el usuario) queda explícitamente **out of scope** por decisión del usuario (2026-04-22).

---

## Tests requeridos

### UI component tests (vitest + RTL)

1. **UX-T01** — placeholder + microcopia presentes: render del dialog muestra placeholder mensual y microcopia explicativa en el DOM.
2. **UX-T02** — mes seleccionado autocompleta fechas: simular `select(mes=abril, año=2026)` debe setear `startDate="2026-04-01"` y `endDate="2026-04-30"`.
3. **UX-T03** — mes seleccionado autocompleta nombre: simular `select(mes=abril, año=2026)` debe setear `name="Abril 2026"`.
4. **UX-T04** — edit manual no rompe autocompletado: si usuario selecciona mes y luego edita manualmente `startDate`, el valor manual gana (uncontrolled override).
5. **UX-T05** — warning cross-month visible: si `startDate.month !== endDate.month`, el warning aparece en DOM; si son del mismo mes, no aparece.
6. **UX-T06** — warning NO bloquea submit: con warning visible, el botón "Crear Período" sigue habilitado (si los campos requeridos están).
7. **UX-T07** — botón "Crear 12 meses" emite 12 requests: mock `fetch`, click botón, assert 12 calls con `month` de 1 a 12 y fechas correctas.
8. **UX-T08** — botón "Crear 12 meses" tolera duplicados existentes: si alguna request retorna 409 por `FISCAL_PERIOD_MONTH_EXISTS`, el handler continúa con las restantes y reporta el resumen al usuario (cuántos creados, cuántos ya existían).

### Integration (opcional, decide design)

- Test e2e real contra DB creando los 12 meses via el shortcut — validar que todos caen correctamente con `month=1..12` en el constraint único.

---

## Out of scope (explícito)

Los siguientes temas relacionados NO se tocan en este change. Cada uno tiene destino propio:

- **Enforcement estructural de granularidad mensual** (Opción B del análisis): agregar constraint schema que exija `endDate = lastDayOf(startDate.month)` Y `startDate.day = 1`. Usuario descartó explícitamente 2026-04-22 ("la opción A - UX mejorar para evitar confuciones"). Si más adelante aparece evidencia de que la UX sola no alcanza (ej. un segundo incidente análogo con usuario avanzado), se reabre como `sdd/fiscal-period-monthly-enforcement`.
- **RBAC seed reconciliation gap**: `prisma/seed-system-roles.ts` usa `skipDuplicates: true` y no reconcilia cambios del matrix de permisos. Destino propio: `sdd/rbac/seed-reconciliation-gap` (backlog).
- **Date-aware `periodId` default en journal-entry-form**: el form de creación de asiento no preselecciona el período del mes de la fecha del comprobante. Destino propio: `sdd/journal-form/date-aware-period` (backlog).
- **Migración de orgs existentes con período anual**: si alguna org ya creó un período anual (como pasó con la org de prueba), no se migra automáticamente. Este change guía futuros usuarios; migración retroactiva es decisión operativa, no arquitectónica.

---

## Preguntas abiertas

1. **¿El shortcut "Crear 12 meses" crea los 12 en una única transacción o 12 requests individuales?** Una transacción es más limpia (atomicidad: todos o ninguno) pero requiere endpoint nuevo. 12 requests reutiliza el endpoint existente pero es más chatty y con failure mode parcial. **Decisión en fase design**.
2. **¿El warning de "cross-month" es texto fijo o incluye preview del impacto** (ej. "Este período abarca 3 meses. Al cerrarlo bloquearás TODOS los vouchers de esos 3 meses a la vez")? **Decisión en fase spec**.
3. **¿La microcopia general del dialog menciona explícitamente "cierre mensual" o solo "período mensual"?** El primero es más prescriptivo y alinea mejor al workflow; el segundo deja abierta la posibilidad de períodos no-mensuales. **Decisión en fase spec**.
4. **¿El autocompletado del `name` (ej. "Abril 2026") sigue `MONTH_NAMES_ES` que ya existe en el service, o duplica la lista en el componente cliente?** Compartir via feature module puede requerir leve refactor. **Decisión en fase design**.

---

## Riesgo y mitigación

- **Orgs existentes con período anual no se benefician**: este change no migra retroactivamente. **Mitigación**: documentar en el dialog un link "¿Ya tenés un período anual y querés cambiar?" que explica el proceso manual de migración (o lo ofrece como flujo guiado — decisión en design). Prioridad baja, no bloquea el change.
- **Usuarios con años fiscales no-calendario**: algunos negocios usan año fiscal julio–junio. La UX guiada a mes calendario puede fricccionar con ellos. **Mitigación**: el warning de cross-month y las fechas editables preservan la flexibilidad. Si aparece un caso real, se reabre como extensión.
- **Regresión: botón "Crear 12 meses" tiene failure mode parcial**: si fallan 3 de 12 requests (ej. 3 meses ya existían), el estado queda mezclado. **Mitigación**: handler debe reportar claramente cuántos creados y cuántos no (y por qué). El spec debe exigir test explícito de este caso (ver UX-T08).
- **Breaking change del form existente**: usuarios que ya conocen el form actual (y lo usan intencionalmente para crear períodos anuales o custom) van a ver cambios. **Mitigación**: dado que el contrato del backend no cambia (campos libres, fechas arbitrarias), la flexibilidad se preserva — solo el default guiado cambia. El warning soft informa en lugar de prohibir.

---

## Dependencias

- **Depende de**: nada. El motor de cierre mensual está verificado funcional end-to-end (commit 12f8a0c y verificación empírica 2026-04-22 con correlationId `d671a517-7147-4381-856b-f86fd907d59a`). El schema `FiscalPeriod` ya soporta monthly desde `cierre-periodo`.
- **Habilita (desbloquea)**: experiencia de onboarding contable correcta por default. Reduce el costo cognitivo del primer cierre mensual del año (que hoy requiere configuración manual de 12 períodos o sufrimiento post-hoc).
- **No bloquea**: ningún change actualmente en planning.

---

## Lecciones aplicadas

Este change nace directamente de una observación que cumple el patrón de la regla Rule 5 (low-cost verification asymmetry):

- **Costo de NO hacer la verificación empírica E2E**: el usuario habría quedado creyendo que el motor de cierre estaba roto, habríamos invertido sesiones en debugging en el lugar equivocado.
- **Costo de la verificación empírica**: ~2 horas de sesión + una migración SQL + un test throwaway.
- **Beneficio revelado**: gap UX localizado, accionable, con scope acotado.

La lección meta-operativa ya está capturada en memory como Rule 5 N=5. Este change es una aplicación directa: la verificación empírica NO solo validó el sistema, sino que **descubrió el gap real que ningún análisis arquitectónico previo había surfaceado**. El gap no estaba en el código de dominio — estaba en la puerta de entrada UX.

---

## Next phase

`sdd-spec` → formalizar REQs en `openspec/changes/fiscal-period-form-ux/specs/fiscal-period-creation-ux/spec.md` como delta sobre la capability UX de creación de períodos (si no existe canonical, crearla). Mínimo 4 REQs:

- REQ-1 — guidance textual (placeholder mensual + microcopia explicativa)
- REQ-2 — campo mes con autocompletado de fechas y nombre
- REQ-3 — shortcut "crear 12 meses del año"
- REQ-4 — warning soft en rango cross-month (no bloqueante)
