# Exploration: aportes-capital-fila-tipada

**Change**: `aportes-capital-fila-tipada`
**Date**: 2026-04-21
**Phase**: sdd-explore
**Status**: COMPLETE
**Prior**: `sdd/estado-evolucion-patrimonio-neto/*` (EEPN v1 archive #864, #865)

---

## Current State (EEPN v1)

EEPN v1 muestra exactamente 3 filas: `SALDO_INICIAL` → `RESULTADO_EJERCICIO` → `SALDO_FINAL`. Todo el P&L del período fluye enteramente a `RESULTADOS_ACUMULADOS` (3.4/3.5). Los **movimientos directos al patrimonio** (aportes de capital a 3.1.x, constitución de reservas a 3.3.x, distribuciones a socios) NO son surfaceados como filas separadas — aparecen solamente como una bandera `imbalanced: true` con un `imbalanceDelta` numérico cuando `SALDO_FINAL ≠ SALDO_INICIAL + RESULTADO_EJERCICIO`. El builder detecta el gap pero no clasifica ni explica qué movió dónde.

Evidencia: `features/accounting/equity-statement/equity-statement.builder.ts:140-147`.

---

## Affected Areas

| File | Why |
|------|-----|
| `features/accounting/equity-statement/equity-statement.builder.ts` | `COLUMN_MAP` hardcodea la estructura F-605; `buildEquityStatement()` no tiene lógica para detectar/clasificar movimientos tipados. |
| `features/accounting/equity-statement/equity-statement.types.ts` | `RowKey` enum está fijo en `"SALDO_INICIAL" \| "RESULTADO_EJERCICIO" \| "SALDO_FINAL"`. Necesita extenderse. |
| `features/accounting/equity-statement/equity-statement.repository.ts` | `getPatrimonioBalancesAt()` agrega saldos por cuenta pero NO trae metadata de `JournalEntry` (voucherTypeId, sourceType). La v2 necesita este join. |
| `features/accounting/equity-statement/equity-statement.service.ts` | Orquestador: necesitará cargar data adicional de movimientos clasificados. |
| `prisma/schema.prisma` — `JournalEntry` | Ya tiene `voucherTypeId` FK (relación a `VoucherTypeCfg`) y campos `sourceType`/`sourceId`. **Metadata disponible para tagging.** |
| `prisma/schema.prisma` — `VoucherTypeCfg` | Tabla configurable (NO enum) desde el change 2026-04-17. Seed actual incluye CN (Nómina), CM (Depreciación). Ideal para seedear nuevos tipos. |
| Exporters PDF/XLSX | Deben renderizar N filas (no 3) — el bucle actual itera `statement.rows.length` pero hay lógica `idx === 2` hardcodeada para detectar `SALDO_FINAL`. Debe reemplazarse por `row.key === "SALDO_FINAL"`. |
| UI: `components/accounting/equity-statement-view.tsx` | Ya usa `row.key === "SALDO_FINAL"` (línea 120) — correcto. Solo necesitará renderizar las nuevas filas sin cambios mayores. |
| Archive referencia: `openspec/changes/archive/2026-04-17-voucher-types/` | Patrón para seedear nuevos `VoucherTypeCfg`. |

---

## Approaches

### Approach A — Voucher-Type Driven
Tagear movimientos al patrimonio vía códigos de voucher dedicados (ej. `APORTE_CAPITAL`, `CONSTITUCION_RESERVA`, `DISTRIBUCION_DIVIDENDO`). El builder inspecciona `voucherTypeCode` de cada `JournalEntry` en el período y clasifica.

- **Pros**: Metadata semántica clara; `VoucherTypeCfg` ya existe; builder puro; reutiliza patrón del módulo voucher-types; extensible sin migraciones.
- **Cons**: Depende de disciplina del contador (debe elegir el voucher correcto); entries legacy sin voucher-type no detectados.
- **Effort**: **Medium** (2–3 días)

### Approach B — Account-Code + Delta Heuristic
Comparar `finalBalance − initialBalance` por cuenta de patrimonio. Cualquier delta no explicado por el periodResult → clasificado como movimiento tipado por columna.

- **Pros**: Sin cambios de schema/UX; automático; retroactivo.
- **Cons**: No distingue semántica (200k en 3.1.x = aporte, o ajuste, o reclasificación); colisión con asientos de cierre; label genérico ("Otros movimientos"); heurística frágil.
- **Effort**: **Low** (1–1.5 días)

### Approach C — JournalEntry Classification Field
Agregar enum `patrimonyMovementKind` directamente a `JournalEntry`. Contador selecciona al crear el asiento.

- **Pros**: Explicit, no ambigüedad, enforzable por validación.
- **Cons**: Requiere migration + UI condicional + backfill; mayor mantenimiento; redundante si los voucher-types ya capturan la intención.
- **Effort**: **High** (4–5 días)

### Approach D — Hybrid (A preferred, B fallback)
Voucher-type primero; si no hay match, usar delta heuristic como canary.

- **Pros**: Máxima cobertura; degradación graciosa para entries legacy.
- **Cons**: Dos paths de clasificación que pueden driftear; testing matrix explota; UI ambigüa (fila "inferida" vs "clasificada").
- **Effort**: **Very High** (5–7 días)

---

## Recommendation

**→ Approach A (Voucher-Type Driven)**

Razones:
1. `VoucherTypeCfg` **ya existe** y es configurable (2026-04-17).
2. Separa clean intent semántico (voucher type) de heurística de saldos — consistente con cómo el Income Statement clasifica via `AccountSubtype`.
3. Extensible: agregar nuevos tipos = seed, no migration.
4. El `imbalanced` existente sigue siendo canary útil para detectar entries sin voucher-type correcto (fallback implícito).
5. Si en v2.1 descubrimos que legacy entries quedan invisibles, se puede agregar Approach B como overlay opcional sin breaking change.

**Scope para v2.0 (este change)**:
- Seedear 3 `VoucherTypeCfg`: `APORTE_CAPITAL`, `CONSTITUCION_RESERVA_LEGAL`, `DISTRIBUCION_DIVIDENDO`.
- Extender `RowKey` con las filas tipadas correspondientes.
- Extender `EquityStatementRepository` para cargar `voucherTypeCode` por `JournalEntry`.
- Extender builder para agregar movimientos tipados por columna F-605.
- Retirar la proyección preliminar de `periodResult` en `RESULTADOS_ACUMULADOS` si el asiento de cierre está presente — o documentar que sigue aplicando porque el cierre se hace manualmente.
- Tests + edge cases (entries sin voucher-type caen en la bandera `imbalanced` existente).
- PDF/XLSX/UI renderizan N filas.

**Fuera de scope (v2.1+)**:
- Approach B como overlay para entries legacy.
- Autocálculo de reserva legal (5% utilidad hasta 20% capital).
- Reclasificación histórica masiva de entries existentes.
- Hints de UI en el form de journal entry.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Contador usa "Manual Journal" genérico en vez de `APORTE_CAPITAL`, movimiento invisible como fila tipada | Medium | El imbalance banner existente es el canary (ya implementado en v1). Doc para contador: "Si el banner aparece, asignaste mal el voucher". |
| Colisión con asiento de cierre (cierre mueve 3.4 en fecha ≤ dateTo) | Low | El asiento de cierre se genera típicamente en dateTo+1 (día siguiente al cierre). Query filtra por `date ≤ dateTo`. Documentar en spec. |
| Nuevos tipos de voucher seeding requiere org-creation updating | Medium | Verificar que `onOrgCreate` handler existente seedee los voucher-types base. Si no, agregarlo en este change. |
| Entries sin classification field (pre-cambio) quedan como "untyped" y suman al imbalance | Expected | Comportamiento aceptable — el banner los surface. Migration retroactiva fuera de scope. |
| Enum `RowKey` extensible rompe tests existentes que asumen exactamente 3 filas | High | Actualizar tests v1 a usar `row.key === "SALDO_FINAL"` en vez de `idx === 2`; varios ya lo hacen. |

---

## Ready for Proposal

**Sí** — con la recomendación Approach A y scope v2.0 definido arriba. Pendientes de decidir en `sdd-propose`:
- Orden y etiquetas exactas de las filas tipadas.
- ¿Se muestra una fila por tipo siempre, o solo cuando tiene movimiento?
- ¿El change incluye un asistente/migración para reclasificar entries existentes, o se limita a nuevos entries?
