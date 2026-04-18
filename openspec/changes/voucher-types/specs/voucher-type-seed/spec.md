# Spec: voucher-type-seed

**Change**: `voucher-types`
**Domain**: `voucher-type-seed`

## Overview

Expand `seedVoucherTypes(organizationId)` from 5 to 8 standard Bolivian voucher types. Remove the `VoucherTypeCode` enum import and switch to plain string codes. All 8 types include a `prefix` value for the correlative display format. The function must be idempotent.

---

## REQ-D.1 — 8 tipos estándar por organización

`seedVoucherTypes(organizationId)` creates all 8 standard types with correct codes, names, and prefixes.

### Standard Types Table

| Code | Name | Prefix | Description |
|------|------|--------|-------------|
| CI | Comprobante de Ingreso | I | Registra entrada de dinero (cobros, ventas) |
| CE | Comprobante de Egreso | E | Registra salida de dinero (pagos, compras) |
| CD | Comprobante de Diario | D | Registra ajustes, depreciaciones, provisiones |
| CT | Comprobante de Traspaso | T | Registra movimientos entre cuentas propias |
| CA | Comprobante de Apertura | A | Registra asiento de apertura del periodo |
| CN | Comprobante de Nómina | N | Registra liquidación y pago de sueldos |
| CM | Comprobante de Depreciación | M | Registra depreciación y amortización de activos |
| CB | Comprobante Bancario | B | Registra conciliación y movimientos bancarios |

### Scenarios

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | D.1-S1 | Fresh org | `seedVoucherTypes` on an org with zero voucher types → exactly 8 rows created |
| S2 | D.1-S2 | Idempotent on re-run | Running `seedVoucherTypes` a second time on the same org → 0 additional rows; all 8 existing rows are unchanged |
| S3 | D.1-S3 | Prefixes populated | Every seeded row has a non-empty `prefix` matching the table above |
| S4 | D.1-S4 | No `VoucherTypeCode` import | The seed file does not import `VoucherTypeCode` from `generated/prisma/client`; it uses plain string literals |

**Test file**: `prisma/seeds/__tests__/voucher-types.seed.test.ts`

---

## Constraints

- Idempotency: use `upsert` on `{ organizationId, code }` (not insert-if-not-exists loop) for atomic correctness
- `prefix` must be set on every row — a seeded row with `prefix = null` is a defect
- The existing 5 types (CI, CE, CD, CT, CA) must have the same `name` and `description` as before migration (no naming regression)
- New types (CN, CM, CB) must be seeded with `isActive: true` by default
