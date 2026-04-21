# Design: aportes-capital-fila-tipada

**Change**: `aportes-capital-fila-tipada`
**Date**: 2026-04-21
**Phase**: sdd-design
**Prior**: proposal + spec (engram)

## Technical Approach

Approach A (voucher-type driven). El `EquityStatementRepository` gana un segundo método de agregación que agrupa `JournalLine` POSTED del período por `(voucherType.code, account.id)` filtrado a voucher codes de patrimonio (`CP`, `CL`, `CV`). El builder recibe ese mapa como nuevo input y emite filas tipadas condicionales, re-evaluando la invariante intra-statement para decidir `imbalanced`. Exporters y UI quedan neutrales al número de filas usando `row.key` en vez de índices.

## Architecture Decisions

### D1 — Clasificación: voucherType.code (no sourceType)
**Choice**: agrupar por `VoucherTypeCfg.code` (string configurable).
**Alternatives**: `JournalEntry.sourceType` (existente), enum nuevo en JournalEntry, heurística por account code.
**Rationale**: `sourceType` identifica ORIGEN del entry (manual/sale/purchase), no INTENCIÓN patrimonial. `voucherType.code` fue hecho configurable justamente para este tipo de clasificación semántica (archive 2026-04-17). Cero migrations.

### D2 — Filas condicionales (sin slots fijos)
**Choice**: emitir fila tipada solo si hay movimiento neto ≠ 0 en alguna columna.
**Alternatives**: siempre emitir las 3 filas tipadas (en cero si no hay movimiento).
**Rationale**: un EEPN limpio (sin aportes/reservas/distribuciones) debe verse idéntico a v1 — 3 filas. Filas en cero son ruido visual para el 90% de cooperativas pequeñas.

### D3 — Proyección preliminar se apaga cuando hay CV
**Choice**: si hay al menos una JournalLine de voucherType `CV` que toca 3.4.x/3.5.x, el builder deja `SALDO_FINAL[RA]` en su valor ledger (sin proyectar `periodResult`). Si no hay CV y `preliminary=true`, sigue proyectando como v1.
**Alternatives**: siempre proyectar; nunca proyectar.
**Rationale**: Si el contador ya registró una CV (distribución de utilidades acumuladas), esa fila ya mueve el RA; proyectar periodResult encima doble-contaría. Si no hay CV, v1 behavior aplica.

### D4 — Repository: un query extra, no un JOIN monstruo
**Choice**: método nuevo `getTypedPatrimonyMovements(orgId, dateFrom, dateTo)` retorna `Map<VoucherCode, Map<AccountId, Decimal>>`.
**Alternatives**: extender el query existente con voucherType info; hacer un mega-SELECT con 3 niveles de agrupación.
**Rationale**: Separación de concerns. El aggregate de balances totales no cambia. Un query nuevo, focalizado al período, es legible y testable independientemente.

### D5 — Migration: script idempotent una vez, no runtime check
**Choice**: Prisma seed runner `prisma/seeds/backfill-patrimony-voucher-types.ts` usando `upsert` sobre `(organizationId, code)`.
**Alternatives**: check-and-seed en cada request; runtime lazy-init.
**Rationale**: el mismo patrón del seed de voucher types (archive 2026-04-17). Reutiliza `seedVoucherTypes` o un derivado. Runtime checks agregan latencia a cada EEPN.

## Data Flow

```
Route (GET /equity-statement)
  │
  ▼
EquityStatementService.build()
  │
  ├─ repo.findPatrimonioAccounts(orgId)
  ├─ repo.getPatrimonioBalancesAt(orgId, dateFrom - 1d)   ──► initialBalances
  ├─ repo.getPatrimonioBalancesAt(orgId, dateTo)          ──► finalBalances
  ├─ repo.getTypedPatrimonyMovements(orgId, range)   [NEW]──► typedMovements
  ├─ buildIncomeStatement(...) → calculateRetainedEarnings ──► periodResult
  ├─ repo.isClosedPeriodMatch(...)                   ──► preliminary
  │
  ▼
buildEquityStatement({
  initialBalances, finalBalances, accounts,
  typedMovements,         [NEW]
  periodResult, dateFrom, dateTo, preliminary
})
  │
  ▼
[rows: SALDO_INICIAL, ...typedRows (solo si ≠0), RESULTADO, SALDO_FINAL]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/seeds/voucher-types.seed.ts` | Modify | +3 entries (CP, CL, CV) en el array standard types |
| `prisma/seeds/backfill-patrimony-voucher-types.ts` | Create | Script que corre `seedVoucherTypes` sobre toda org activa (idempotente vía upsert) |
| `features/accounting/equity-statement/equity-statement.types.ts` | Modify | Extender `RowKey`; agregar type `TypedPatrimonyMovements`; `BuildEquityStatementInput` recibe el nuevo mapa |
| `features/accounting/equity-statement/equity-statement.repository.ts` | Modify | Nuevo método `getTypedPatrimonyMovements` |
| `features/accounting/equity-statement/equity-statement.builder.ts` | Modify | Emisión condicional de filas tipadas; recálculo de `imbalanced`; bypass proyección si hay CV |
| `features/accounting/equity-statement/equity-statement.service.ts` | Modify | Cargar typedMovements y pasarlos al builder |
| `features/accounting/equity-statement/exporters/equity-statement-pdf.exporter.ts` | Modify | `idx === 2` → `row.key === "SALDO_FINAL"` |
| `features/accounting/equity-statement/exporters/equity-statement-xlsx.exporter.ts` | Modify | Mismo refactor + bold/borde condicional por key |
| `components/accounting/equity-statement-view.tsx` | Verify | Ya usa `row.key` — solo tests |

## Interfaces / Contracts

```ts
// equity-statement.types.ts
export type RowKey =
  | "SALDO_INICIAL"
  | "APORTE_CAPITAL"           // nuevo
  | "CONSTITUCION_RESERVA"     // nuevo
  | "DISTRIBUCION_DIVIDENDO"   // nuevo
  | "RESULTADO_EJERCICIO"
  | "SALDO_FINAL";

export type PatrimonyVoucherCode = "CP" | "CL" | "CV";

/** Movimientos tipados: code → (accountId → delta) */
export type TypedPatrimonyMovements = Map<
  PatrimonyVoucherCode,
  Map<string /* accountId */, Decimal>
>;

export type BuildEquityStatementInput = {
  initialBalances: Map<string, Decimal>;
  finalBalances: Map<string, Decimal>;
  accounts: EquityAccountMetadata[];
  typedMovements: TypedPatrimonyMovements;  // puede ser Map vacío
  periodResult: Decimal;
  dateFrom: Date;
  dateTo: Date;
  preliminary: boolean;
};
```

Mapa `PatrimonyVoucherCode → RowKey / label`:
```ts
const TYPED_ROW_CONFIG: Record<PatrimonyVoucherCode, { key: RowKey; label: string; order: number }> = {
  CP: { key: "APORTE_CAPITAL",         label: "Aportes de capital del período",  order: 1 },
  CL: { key: "CONSTITUCION_RESERVA",   label: "Constitución de reservas",        order: 2 },
  CV: { key: "DISTRIBUCION_DIVIDENDO", label: "Distribuciones a socios",          order: 3 },
};
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit (builder) | emisión condicional, orden canónico, recálculo imbalance, bypass proyección cuando hay CV | Tests puros con fixtures de `typedMovements` construidos a mano |
| Unit (repository) | query de agregación por voucher code, scoping org, filtro POSTED, rango exacto | SQLite in-memory / Prisma test DB |
| Unit (service) | orchestration: carga typedMovements y los pasa al builder | Mock repository |
| Integration | Entry end-to-end con voucherType CP produce fila tipada en response JSON | Seed + real Prisma |
| Smoke (exporters) | 5 filas renderizan correctamente en PDF y XLSX (bold solo en SALDO_FINAL) | Parse docDef + worksheet cells |
| Seed/Migration | Idempotencia, backfill a orgs existentes, nueva org recibe 11 types | Test con 2 orgs: una con 8, otra sin types |

## Migration / Rollout

1. Deploy code (nuevas voucher codes en seed + builder extension).
2. Correr `npx prisma db seed` o script custom `backfill-patrimony-voucher-types.ts` una vez contra prod.
3. Verificar: `SELECT code FROM voucher_type_cfg WHERE organization_id IN (...) AND code IN ('CP','CL','CV')` retorna 3 rows por org.
4. EEPN existentes siguen funcionando (filas tipadas simplemente ausentes hasta que el contador use los nuevos voucher types).

## Open Questions

Ninguna. Si el contador creó entries con voucher genérico antes del deploy, siguen cayendo en el imbalance banner v1 (comportamiento esperado, documentado).
