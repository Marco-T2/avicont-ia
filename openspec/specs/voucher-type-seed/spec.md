# Spec: voucher-type-seed

**Change**: `voucher-types`
**Domain**: `voucher-type-seed`

## Overview

Expand `seedVoucherTypes(organizationId)` from 8 to 11 standard Bolivian voucher types. The 3 new types (CP, CL, CV) are for direct patrimony movements to support EEPN v2 typed rows. Remove the `VoucherTypeCode` enum import and switch to plain string codes. All types include a `prefix` value for the correlative display format. The function must be idempotent. A migration script adds the 3 new types to existing organizations.

---

## REQ-D.1 — 11 tipos estándar por organización

`seedVoucherTypes(organizationId)` creates all 11 standard types with correct codes, names, and prefixes.

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
| CP | Comprobante de Aporte de Capital | P | Registra aportes de socios al capital (cuentas 3.1.x y 3.2.1) |
| CL | Comprobante de Constitución de Reserva | L | Registra constitución o liberación de reservas (cuentas 3.3.x) |
| CV | Comprobante de Distribución a Socios | V | Registra retiros, dividendos o distribución de utilidades acumuladas (cuentas 3.4.x / 3.5.x) |

### Scenarios

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | D.1-S1 | Fresh org | `seedVoucherTypes` on an org with zero voucher types → exactly 11 rows created |
| S2 | D.1-S2 | Idempotent on re-run | Running `seedVoucherTypes` a second time on the same org → 0 additional rows; all 11 existing rows are unchanged |
| S3 | D.1-S3 | Prefixes populated | Every seeded row has a non-empty `prefix` matching the table above |
| S4 | D.1-S4 | No `VoucherTypeCode` import | The seed file does not import `VoucherTypeCode` from `generated/prisma/client`; it uses plain string literals |
| S5 | D.1-S5 | Patrimony codes present | After seed, `findFirst({code:'CP'})`, `code:'CL'`, `code:'CV'` all return rows with isActive=true |
| S6 | D.1-S6 | Migration backfill | Running the migration on an org with the original 8 types adds the 3 patrimony types without modifying the existing 8 |

**Test file**: `prisma/seeds/__tests__/voucher-types.seed.test.ts`

---

## REQ-D.2 — Migration para organizaciones existentes

Un script de migration MUST agregar los 3 nuevos voucher types (`CP`, `CL`, `CV`) a toda organización activa que no los tenga, preservando la integridad de los 8 types existentes.

### Scenarios

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | D.2-S1 | Org existente recibe los 3 types | Org con los 8 voucher types originales → migration `backfill-patrimony-voucher-types` → org termina con 11 types, los 8 originales intactos |
| S2 | D.2-S2 | Org nueva tras migration | Migration ya corrió → nueva org via `onOrgCreate` → org recibe directamente los 11 types |
| S3 | D.2-S3 | Migration idempotente | Migration corrió una vez → corre una segunda vez → 0 rows adicionales, no hay errores |

**Test file**: `prisma/seeds/__tests__/backfill-patrimony-voucher-types.test.ts`

---

## Constraints

- Idempotency: use `upsert` on `{ organizationId, code }` (not insert-if-not-exists loop) for atomic correctness
- `prefix` must be set on every row — a seeded row with `prefix = null` is a defect
- The existing 8 types (CI, CE, CD, CT, CA, CN, CM, CB) must have the same `name` and `description` after the change (no naming regression)
- Patrimony types (CP, CL, CV) must be seeded with `isActive: true` by default
- Migration script must be idempotent (safe to re-run)
