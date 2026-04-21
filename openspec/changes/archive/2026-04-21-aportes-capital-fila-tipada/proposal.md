# Proposal: Aportes de Capital — Filas Tipadas en EEPN

**Change**: `aportes-capital-fila-tipada`
**Date**: 2026-04-21
**Phase**: sdd-propose
**Prior**: `sdd/aportes-capital-fila-tipada/explore`, EEPN v1 archive (`sdd/estado-evolucion-patrimonio-neto/*`)

## Intent

EEPN v1 solo muestra 3 filas (inicial / resultado / cierre). Movimientos directos al patrimonio (aportes de capital a 3.1.x, constitución de reserva legal a 3.3.x, distribuciones a socios) se pierden dentro del saldo de cierre y solo aparecen como bandera `imbalanced: true` con un delta numérico sin clasificación. El contador ve "Diferencia sin clasificar Bs. 200.000" pero no sabe si fue aporte, retiro o reserva. V2 debe exponer estos movimientos como filas tipadas.

## Scope

### In Scope
- Seed 3 VoucherTypeCfg nuevos: `APORTE_CAPITAL`, `CONSTITUCION_RESERVA_LEGAL`, `DISTRIBUCION_DIVIDENDO`.
- Extender `RowKey` + builder para emitir hasta 3 filas tipadas condicionales (solo si hay movimiento).
- Repository extendido con un query que agrupe JournalLines por voucherTypeCode y columna F-605.
- Exporters PDF/XLSX + UI actualizados para iterar N filas en vez de 3 hardcoded.
- Remover proyección preliminar de `periodResult` en `SALDO_FINAL[RA]` cuando hay filas tipadas que explican el delta (imbalance real pasa a ser raro).

### Out of Scope
- Overlay heurístico por account-code delta (Approach B) — deferred a v2.1.
- Autocálculo de reserva legal (5% utilidad hasta 20% capital).
- Migración masiva de entries históricos para reclasificar al nuevo voucher-type.
- Hints/wizard en el form de journal-entry.

## Capabilities

### New Capabilities
- `equity-statement-typed-movements`: Clasificación y emisión de filas tipadas en el EEPN basada en VoucherTypeCfg code. Define scenarios para cada tipo de movimiento, interacción con la invariante intra-statement, y criterio de visibilidad condicional.

### Modified Capabilities
- `voucher-type-seed`: Agregar 3 códigos nuevos al seed default que corre en `onOrgCreate` + migration para orgs existentes.

## Approach

Approach A (voucher-type driven) de la exploración. El `EquityStatementRepository` agregará un segundo query que agrupa JournalLine POSTED del período por `(voucherType.code, account.code mapeado a ColumnKey)`. El builder consume ese mapa y emite una `EquityRow` por cada tipo con movimiento no-cero. Filas van entre `RESULTADO_EJERCICIO` y `SALDO_FINAL` en orden fijo: aportes → reservas → distribuciones. Entries sin voucher-type tipado quedan invisibles pero el `imbalanced` banner existente los surface como canary.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/seed-voucher-types.ts` | Modified | Agrega 3 voucher types |
| `features/accounting/equity-statement/equity-statement.types.ts` | Modified | Extiende `RowKey` con tipos nuevos |
| `features/accounting/equity-statement/equity-statement.repository.ts` | Modified | Nuevo método `getTypedMovementsByVoucherType` |
| `features/accounting/equity-statement/equity-statement.builder.ts` | Modified | Emite filas tipadas, recalcula `imbalanceDelta` |
| `features/accounting/equity-statement/exporters/*.ts` | Modified | Iteración por `row.key` no `idx` |
| `components/accounting/equity-statement-view.tsx` | Minor | Ya usa row.key — verificar |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Contador no usa voucher tipado | Med | Imbalance banner existente los surface |
| Orgs existentes sin seed | Med | Migration script que crea los 3 types para todas las orgs activas |
| Tests v1 rompen (asumen 3 filas) | High | Actualizar a usar `row.key` |
| Cierre manual interfiere con agregación | Low | Query filtra por `date <= dateTo`; cierre suele ser dateTo+1 |

## Rollback Plan

Revert a los commits del change. El seed migration es reversible (DELETE FROM VoucherTypeCfg WHERE code IN (...)). Los filas tipadas son aditivas: sin ellas el EEPN vuelve a 3 filas.

## Dependencies

- `VoucherTypeCfg` (shipped 2026-04-17).
- EEPN v1 (shipped 2026-04-21, archived engram #865).

## Success Criteria

- [ ] Un asiento con voucher type `APORTE_CAPITAL` por Bs. 200k a cuenta 3.1.x produce una fila `"Aportes de capital del período"` con Bs. 200k en columna `CAPITAL_SOCIAL` y el banner `imbalanced` NO aparece.
- [ ] Sin movimientos tipados, el EEPN sigue siendo idéntico a v1 (3 filas).
- [ ] Orgs existentes reciben los nuevos voucher types tras la migration sin intervención manual.
- [ ] Suite completa verde; 0 type errors en EEPN scope.
