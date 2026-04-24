# ADR-001: Eliminación del audit log de detección de imbalance en generación de estados financieros

**Estado**: Aceptado
**Fecha**: 2026-04-24
**Decisores**: Marco

## Contexto

El repositorio `FinancialStatementsRepository` incluía un método
`writeImbalanceAuditLog` que se invocaba desde el servicio de generación
del Balance General cada vez que se detectaba incumplimiento de la ecuación
contable (Activo ≠ Pasivo + Patrimonio, tolerancia ±0.01 BOB).

La llamada se ejecutaba con patrón fire-and-forget (sin `await`, con `.catch()`
silencioso) fuera de cualquier transacción de dominio. Esto la hacía
inconsistente con el resto del sistema, donde toda la trazabilidad se escribe
a `audit_logs` mediante triggers de Postgres (`audit_trigger_fn`) dentro de la
misma transacción que el cambio de dominio, garantizando atomicidad.

El hallazgo original (Audit H #5) planteaba cómo endurecer esa llamada
(`await` + throw, `await` + warning estructurado, outbox, etc.).

## Decisión

Se elimina `writeImbalanceAuditLog` y su invocación. La detección de imbalance
no se persiste en `audit_logs`.

## Justificación

1. **Redundancia compliance**. La trazabilidad del hecho económico que causa
   el imbalance (un comprobante mal registrado) ya está cubierta por los
   triggers sobre las tablas de dominio (`journal_entries`, `dispatches`,
   `payments`, `sales`, `purchases`, `fiscal_periods`). El imbalance es un
   síntoma derivable, no un evento primario.

2. **Inconsistencia arquitectónica**. Era el único write explícito a
   `audit_logs` fuera de una transacción de dominio en todo el codebase.
   Mantenerlo obligaba a convivir con dos mecanismos de audit con garantías
   distintas, erosionando el invariante del sistema.

3. **Ausencia de requerimiento normativo**. El Código de Comercio boliviano
   (Art. 36-65), las resoluciones del SIN sobre libros fiscales, NIC/NIIF
   para PyMES y la Ley 843 no exigen registrar detecciones intermedias de
   inconsistencia durante la generación de reportes preliminares. Exigen
   trazabilidad de comprobantes, inmutabilidad post-cierre, validación al
   cerrar, e identificación del responsable — todo lo cual está cubierto
   por otros mecanismos.

4. **Visibilidad al usuario preservada**. La respuesta del endpoint incluye
   `imbalanced: true` e `imbalanceDelta`, y los exports (PDF/Excel) renderizan
   banner rojo. El contador ve la inconsistencia y puede investigarla
   navegando a los comprobantes del periodo, los cuales sí tienen audit trail
   completo.

5. **Invariante real en cierre**. La validación estricta de partida doble se
   ejecuta en el proceso de cierre mensual
   (`monthly-close.service.ts:192` — `if (!balance.debit.eq(balance.credit)) throw`).
   Un periodo no puede cerrarse descuadrado. Ese es el evento auditable real
   y queda registrado automáticamente por el trigger al mutar la row de
   `fiscal_periods`.

## Reemplazo

La detección de imbalance se reporta únicamente mediante:

- Flags en el response (`imbalanced`, `imbalanceDelta`) — sin cambios.
- Banner visual en exports — sin cambios.
- Logging estructurado operacional vía `logStructured` con
  `event: "balance_sheet_imbalanced"`, `orgId`, `delta`, `asOfDate` — para
  observabilidad y alertas, no para compliance.

## Consecuencias

**Positivas**:

- Unicidad del mecanismo de audit: 100% vía triggers de Postgres.
- Eliminación del bug de fire-and-forget sin introducir `await`+throw ni
  warning silencioso en el service.
- Menor ruido en `audit_logs`: desaparecen las N rows por re-generación del
  mismo balance.
- Se establece el patrón de logging estructurado (`lib/logging/structured.ts`)
  con manejo explícito de `Prisma.Decimal` y `Date` para futuros call-sites.

**Negativas / riesgos aceptados**:

- Si en el futuro se necesita reconstruir "cuándo se vio por primera vez
  un imbalance en periodo X", solo se podrá inferir por los timestamps
  de los comprobantes involucrados, no por un evento discreto de detección.
  Se considera aceptable.

## Notas de limpieza

- El comentario `// Audit log si la primera columna está desbalanceada (REQ-6, D10)`
  en `financial-statements.service.ts` era una **referencia colgante**: REQ-6
  y D10 no aparecen en ningún canonical spec de `openspec/specs/**` relacionado
  con financial-statements. Desaparece con este refactor.
- Las rows históricas con `action = "IMBALANCE_DETECTED"` en `audit_logs`
  quedan en la tabla. Como `action` es `String` (no enum de Postgres), no hay
  constraint que limpiar. Una limpieza cosmética (`DELETE FROM audit_logs
  WHERE action = 'IMBALANCE_DETECTED'`) es opcional y debe ir en un commit
  separado si se decide hacerla.

## No cubierto por este ADR

La auditoría de **emisión oficial de estados financieros** (cuándo un
usuario descarga/exporta un EEFF para presentar a un tercero) queda
identificada como gap pendiente. Se abordará en un ADR separado mediante
una entidad `FinancialStatementExport`. No bloquea esta decisión.

## Referencias

- Migración del mecanismo canónico de audit (triggers):
  `prisma/migrations/20260406010241_monthly_close_audit_trail/migration.sql`
- Servicio del agente IA (confirma que no escribe directo a DB):
  `features/ai-agent/agent.service.ts:37`
- Pre-check de partida doble en cierre:
  `features/monthly-close/monthly-close.service.ts:192`
- Helper de logging estructurado: `lib/logging/structured.ts`
