# Tasks: aportes-capital-fila-tipada

**Change**: `aportes-capital-fila-tipada`
**Date**: 2026-04-21
**Phase**: sdd-tasks
**Mode**: Strict TDD — each batch RED → GREEN → commit

## Legend
- [ ] pending  ·  [x] done
- Each batch ends with a commit using conventional commits (`feat(eepn):`, `test(eepn):`, `refactor(eepn):`, etc.)
- NEVER use `--no-verify`. If a hook fails, fix the root cause.

---

## Batch 1 — Seed: 3 nuevos voucher types (CP, CL, CV)

**Spec**: `voucher-type-seed` REQ-D.1-S5, REQ-D.1-S6, REQ-D.2
**Files**: `prisma/seeds/voucher-types.seed.ts`, `prisma/seeds/__tests__/voucher-types.seed.test.ts`

- [ ] **T01-RED** — Extender `voucher-types.seed.test.ts` con casos D.1-S5 (CP/CL/CV presentes con isActive=true) y D.1-S6 (org con 8 types recibe los 3 nuevos sin mutar los existentes). Run tests → FAIL.
- [ ] **T01-GREEN** — Agregar las 3 entries al array de standard types en `voucher-types.seed.ts` (CP/prefix P, CL/prefix L, CV/prefix V con descripciones del spec). Run tests → PASS.
- [ ] **T01-COMMIT** — `test(voucher-types): cover patrimony codes CP/CL/CV seed + idempotency` + `feat(voucher-types): add patrimony voucher types (CP, CL, CV)`.

## Batch 2 — Migration: backfill para orgs existentes

**Spec**: `voucher-type-seed` REQ-D.2
**Files**: `prisma/seeds/backfill-patrimony-voucher-types.ts`, `prisma/seeds/__tests__/backfill-patrimony-voucher-types.test.ts`

- [ ] **T02-RED** — Crear test que: (a) crea org con los 8 types legacy manualmente, corre backfill, verifica 11 types y IDs originales intactos; (b) corre backfill 2x y verifica 0 rows adicionales. Run → FAIL (script no existe).
- [ ] **T02-GREEN** — Crear `backfill-patrimony-voucher-types.ts` que itera `prisma.organization.findMany()` y llama `seedVoucherTypes(orgId)` (upsert idempotente). Run → PASS.
- [ ] **T02-COMMIT** — `test(seed): cover backfill-patrimony-voucher-types idempotency` + `feat(seed): add backfill script for patrimony voucher types`.

## Batch 3 — Types: extender `RowKey` + `TypedPatrimonyMovements`

**Spec**: `equity-statement-typed-movements` REQ-1, REQ-2
**Files**: `features/accounting/equity-statement/equity-statement.types.ts`, `__tests__/equity-statement.types.test.ts` (opcional — compile-time check suele bastar)

- [ ] **T03-RED** — Agregar test de tipo (expect-type o fixture que instancia `BuildEquityStatementInput` con `typedMovements`). `npx tsc --noEmit` → FAIL.
- [ ] **T03-GREEN** — Extender `RowKey` con `APORTE_CAPITAL | CONSTITUCION_RESERVA | DISTRIBUCION_DIVIDENDO`; exportar `PatrimonyVoucherCode` + `TypedPatrimonyMovements`; agregar campo `typedMovements` a `BuildEquityStatementInput`. `tsc --noEmit` → PASS.
- [ ] **T03-COMMIT** — `feat(eepn): extend RowKey + TypedPatrimonyMovements contract`.

## Batch 4 — Repository: `getTypedPatrimonyMovements`

**Spec**: `equity-statement-typed-movements` REQ-1 (query layer)
**Files**: `features/accounting/equity-statement/equity-statement.repository.ts`, `__tests__/equity-statement.repository.test.ts`

- [ ] **T04-RED** — Agregar 4 casos: (a) entry CP POSTED en rango con línea 3.1.1 devuelve `Map("CP" → Map(accountId → +200000))`; (b) entry DRAFT excluido; (c) scoping por `organizationId`; (d) entry fuera de rango excluido. Run → FAIL (método no existe).
- [ ] **T04-GREEN** — Implementar `getTypedPatrimonyMovements(orgId, dateFrom, dateTo)` con `prisma.journalLine.groupBy` filtrado por `journalEntry.status=POSTED`, `journalEntry.organizationId`, `journalEntry.date BETWEEN`, `journalEntry.voucherType.code IN ('CP','CL','CV')` y `account.code LIKE '3.%'`. Retornar `Map<PatrimonyVoucherCode, Map<accountId, Decimal>>` con `delta = Σ(credit - debit)` para cuentas ACREEDORA. Run → PASS.
- [ ] **T04-COMMIT** — `test(eepn): cover getTypedPatrimonyMovements query` + `feat(eepn): add typed patrimony movements repository method`.

## Batch 5 — Builder: emisión de filas tipadas + invariante + bypass proyección

**Spec**: `equity-statement-typed-movements` REQ-1, REQ-2, REQ-3, REQ-4, REQ-5
**Files**: `features/accounting/equity-statement/equity-statement.builder.ts`, `__tests__/equity-statement.builder.test.ts`

- [x] **T05-RED** — Agregar fixtures de `typedMovements` construidos a mano y tests:
  - REQ-1-S1: CP 200k a 3.1.1 → fila `APORTE_CAPITAL` con 200k en `CAPITAL_SOCIAL`.
  - REQ-1-S2: `typedMovements` vacío → 3 filas v1.
  - REQ-2-S1: CP+CL+CV + resultado → orden `SALDO_INICIAL, APORTE_CAPITAL, CONSTITUCION_RESERVA, DISTRIBUCION_DIVIDENDO, RESULTADO_EJERCICIO, SALDO_FINAL`.
  - REQ-2-S2: solo CP → 4 filas.
  - REQ-3-S1: CP 200k tipado → `imbalanced=false`.
  - REQ-3-S2: 200k sin voucher tipado (delta huérfano) → `imbalanced=true`, delta=200k.
  - REQ-4: CV débito a 3.4 por 50k → fila `DISTRIBUCION_DIVIDENDO` con −50k en `RESULTADOS_ACUMULADOS`.
  - REQ-5: CV presente + `preliminary=true` → `SALDO_FINAL[RA]` NO proyecta `periodResult`.
  Run → FAIL.
- [x] **T05-GREEN** — Implementar en `buildEquityStatement`:
  1. Construir mapa `account.id → ColumnKey` reutilizando `COLUMN_MAP`.
  2. Para cada `(code, accountMap)` en `typedMovements`: sumar por columna; si alguna celda ≠ 0 → emitir fila según `TYPED_ROW_CONFIG` con labels y order.
  3. Insertar filas tipadas entre `SALDO_INICIAL` y `RESULTADO_EJERCICIO`, respetando `order`.
  4. Recalcular `imbalanced` = `SALDO_FINAL[col] ≠ SALDO_INICIAL + Σ(typedRows[col]) + RESULTADO_EJERCICIO[col]` (tolerancia 0.01).
  5. Si existe fila `DISTRIBUCION_DIVIDENDO` con movimiento en `RESULTADOS_ACUMULADOS`, omitir proyección de `periodResult` en `SALDO_FINAL[RA]` (deja valor ledger).
  Run → PASS.
- [x] **T05-COMMIT** — `test(eepn): cover typed rows, canonical order, imbalance recalc, projection bypass` + `feat(eepn): emit typed patrimony rows in builder`.

## Batch 6 — Service: orquestar `typedMovements`

**Spec**: wiring → REQ-1, REQ-5 end-to-end
**Files**: `features/accounting/equity-statement/equity-statement.service.ts`, `__tests__/equity-statement.service.test.ts`

- [ ] **T06-RED** — Test con mock repo que verifica que `service.build()` invoca `repo.getTypedPatrimonyMovements(orgId, dateFrom, dateTo)` y pasa el Map al builder. Run → FAIL.
- [ ] **T06-GREEN** — Agregar la llamada en `build()` entre los fetchs de balances; pasar al `buildEquityStatement({ ..., typedMovements })`. Run → PASS.
- [ ] **T06-COMMIT** — `test(eepn): cover service wiring for typed movements` + `feat(eepn): wire typed patrimony movements into service`.

## Batch 7 — Exporters: iterar por `row.key`, no por índice

**Spec**: REQ-6
**Files**:
- `features/accounting/equity-statement/exporters/equity-statement-pdf.exporter.ts` + tests
- `features/accounting/equity-statement/exporters/equity-statement-xlsx.exporter.ts` + tests

- [ ] **T07-RED** — Tests smoke:
  - PDF: statement con 5 filas → 5 filas renderizadas; solo la fila `SALDO_FINAL` tiene `bold: true`.
  - XLSX: 5 filas en sheet; solo `SALDO_FINAL` tiene `font.bold=true` y `border.top`.
  Run → FAIL (actualmente `idx === 2` marca como fila final la del medio).
- [ ] **T07-GREEN** — Reemplazar `idx === 2` por `row.key === "SALDO_FINAL"` en ambos exporters. Iterar `statement.rows.forEach(...)` sin asunción de cardinalidad. Run → PASS.
- [ ] **T07-COMMIT** — `test(eepn-exporters): cover N-row rendering + SALDO_FINAL styling` + `refactor(eepn-exporters): key-based row detection`.

## Batch 8 — UI: verificar `equity-statement-view.tsx`

**Spec**: REQ-6 (UI parity)
**Files**: `components/accounting/equity-statement-view.tsx`, tests existentes

- [ ] **T08-VERIFY** — Confirmar que el componente ya usa `row.key === "SALDO_FINAL"` (ya estaba así en v1). Si algún test asume 3 filas, actualizarlo a fixtures con 5 filas tipadas. Run → PASS.
- [ ] **T08-COMMIT** — `test(eepn-ui): cover typed rows render` (solo si hubo cambios — si no, skip commit).

## Batch 9 — Integration test: CP end-to-end

**Spec**: REQ-1 + REQ-3 en contexto real
**Files**: `features/accounting/equity-statement/__tests__/equity-statement.integration.test.ts`

- [ ] **T09-RED** — Test con real Prisma test DB:
  1. Seed org + voucher types (incluido CP).
  2. Crear JournalEntry POSTED con voucherType=CP, line debe 1.1.1 200k / credit 3.1.1 200k.
  3. Llamar `equityStatementService.build()`.
  4. Assert: `response.rows` contiene fila `APORTE_CAPITAL` con 200k en `CAPITAL_SOCIAL`; `response.imbalanced === false`.
  Run → FAIL si falta cualquier pieza.
- [ ] **T09-GREEN** — Asegurar que todos los batches previos están integrados. Run → PASS.
- [ ] **T09-COMMIT** — `test(eepn-integration): cover CP entry end-to-end typed row`.

## Batch 10 — Smoke suite + type-check final

- [ ] **T10-CHECK** — Run `npx tsc --noEmit` → 0 errores en `features/accounting/equity-statement/**` y `prisma/seeds/**`.
- [ ] **T10-TESTS** — Run full `npx vitest run` → verde.
- [ ] **T10-EXPORTER-SIGNATURE** — Smoke: generar PDF+XLSX de un EEPN con 5 filas, verificar file signatures (`%PDF-1.` y `PK\x03\x04`).
- [ ] **T10-COMMIT** — Solo si hay correcciones: `fix(eepn): ...`; si todo estaba verde desde T09, no hay commit adicional.

---

## Rollout (post-merge)

1. Deploy código.
2. Correr `pnpm tsx prisma/seeds/backfill-patrimony-voucher-types.ts` una vez contra prod.
3. Verificar por SQL: `SELECT organization_id, COUNT(*) FROM voucher_type_cfg WHERE code IN ('CP','CL','CV') GROUP BY organization_id` → 3 por org.
4. Anunciar a contadores: "Nuevos comprobantes CP/CL/CV disponibles para aportes de capital, reservas y distribuciones".

## Definition of Done

- [ ] Todos los batches T01-T10 completados con commits individuales.
- [ ] `npx tsc --noEmit` 0 errors.
- [ ] `npx vitest run` verde end-to-end.
- [ ] Test de integración CP pasa contra Prisma test DB.
- [ ] Backfill script probado con 2 fixtures de orgs (una con 8 types, una vacía).
- [ ] Success criteria del proposal chequeados manualmente en dev server:
  - [ ] Asiento CP 200k → fila tipada, sin banner imbalanced.
  - [ ] EEPN sin typed entries → idéntico a v1 (3 filas).
