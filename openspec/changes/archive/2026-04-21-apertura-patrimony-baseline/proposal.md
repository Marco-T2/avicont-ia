# Proposal: apertura-patrimony-baseline

**Change**: apertura-patrimony-baseline
**Date**: 2026-04-21
**Risk Level**: Low

---

## Intent

Production bug (abril 2026, empresa recién constituida): el asiento CA (Apertura / Constitución) dispara falsamente la banda `imbalanced` en el EEPN v2 porque entra en `finalBalances` pero NO es explicado por `SALDO_INICIAL` (no hay período previo: `getPatrimonioBalancesAt(dayBefore)` = vacío) ni por las filas tipadas (CA ∉ `{CP,CL,CV}`). El EEPN muestra Bs. 200.000 de "diferencia patrimonial sin clasificar" sobre un patrimonio que sí cuadra contra el ledger.

Solución: tratar CA como ESTADO de apertura que se fusiona en `SALDO_INICIAL` antes del chequeo de invariante, sin emitir fila ni contaminar F-605.

---

## Scope

### In Scope

- Nuevo método de repositorio `getAperturaPatrimonyDelta(orgId, dateFrom, dateTo)` — agrega CA POSTED sobre cuentas PATRIMONIO dentro de `[dateFrom, dateTo]`.
- Campo opcional `aperturaBaseline?: Map<string, Decimal>` en `BuildEquityStatementInput`.
- Merge aditivo en `initialByColumn` ANTES del invariant check dentro del builder.
- Wiring en `EquityStatementService.generate()` (un slot extra en `Promise.all`).
- Tests TDD: repo, builder, service, integration.

### Out of Scope

- CA como fila tipada del EEPN (RECHAZADO por el equipo — no contaminar F-605 ni el contrato de filas).
- Generación de "período previo ficticio" para absorber la apertura (RECHAZADO — rompe invariantes cross-period).
- Cambios a `voucher-type-seed` (CA ya está sembrado).
- Cambios al schema Prisma o a `RowKey` / `ColumnKey`.
- Feature flag o rollout gradual (cambio retrocompatible — campo opcional).

---

## Capabilities

### Modified Capabilities

- **`equity-statement-typed-movements`** — Añade requisitos para el merge de CA en `SALDO_INICIAL` y la no-emisión de fila. El invariante de REQ-3 se mantiene estructuralmente, pero pasa a consumir un `initialByColumn` que incluye la apertura. Misma capability porque el conocimiento de "cómo se arma `SALDO_INICIAL` y por qué cierra el invariante" pertenece a un solo lugar.

### New Capabilities

Ninguna. Fragmentar en una capability nueva `patrimony-apertura-baseline` dispersaría la lógica del invariante.

---

## Approach

Añadir un método dedicado de repositorio que devuelve el delta de CA dentro del período, exponerlo vía un campo opcional en el input del builder y fusionarlo en `initialByColumn` antes del invariant check. CA queda como estado de apertura, no como movimiento.

---

## Affected Areas

| Path | Reason |
|------|--------|
| `features/accounting/equity-statement/equity-statement.repository.ts` | Nuevo método `getAperturaPatrimonyDelta` |
| `features/accounting/equity-statement/equity-statement.builder.ts` | Merge de `aperturaBaseline` en `initialByColumn` pre-invariante |
| `features/accounting/equity-statement/equity-statement.types.ts` | Campo opcional en `BuildEquityStatementInput` |
| `features/accounting/equity-statement/equity-statement.service.ts` | Un slot extra en `Promise.all` |
| `features/accounting/equity-statement/__tests__/*` | Fixtures nuevas: repo, builder, service, integration |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Double-count de CA en períodos N+1 | Query con `je.date >= dateFrom AND <= dateTo` — CA de períodos anteriores queda fuera del rango y ya está absorbida por `getPatrimonioBalancesAt(dayBefore)`. |
| CA toca cuentas no-PATRIMONIO | Query filtra `a.type = 'PATRIMONIO'` (mismo criterio que `getPatrimonioBalancesAt`). |
| Múltiples CA en el período | `SUM` agrega correctamente. |
| Tests existentes del builder rompen | `aperturaBaseline` es opcional — 34 tests actuales pasan sin cambios. |
| Rollout inadvertido en clientes con CA histórico | Retrocompatible: en períodos con prior-state, el delta fusionado es no-negativo y ya se reflejaba vía `getPatrimonioBalancesAt(dayBefore)` — el guard de rango impide contaminar. |

---

## Rollback Plan

1. Revert merge en builder (`aperturaBaseline` pasa a ignorarse).
2. Revert wiring del service (quitar slot del `Promise.all`).
3. Revert método de repo.

Sin feature flag: campo opcional + lógica aditiva = rollback por revert de commits sin migración de datos.

---

## Dependencies

Ninguna. CA ya está sembrado en `voucher-type-seed`. Sin cambios de schema.

---

## Success Criteria

- Banda `imbalanced` desaparece en el EEPN de la empresa de prueba (abril 2026, sólo CA).
- Los 34 tests existentes del builder siguen en verde.
- Nueva fixture de builder: con `aperturaBaseline` presente → `SALDO_INICIAL` lo absorbe → `imbalanced=false`.
- Nueva fixture de repo: CA POSTED sobre PATRIMONIO dentro del rango → delta correcto; fuera del rango → mapa vacío.
- Nueva fixture de integración: período N+1 de la misma empresa no hace double-count del CA de N.
- `SALDO_FINAL` y filas tipadas (REQ-1/REQ-2/REQ-4/REQ-6) siguen intactos.
