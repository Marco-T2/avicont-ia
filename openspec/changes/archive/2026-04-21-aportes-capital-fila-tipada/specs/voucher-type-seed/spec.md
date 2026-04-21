# Delta for voucher-type-seed

## MODIFIED Requirements

### REQ-D.1 — 8 11 tipos estándar por organización

`seedVoucherTypes(organizationId)` creates all 11 standard types with correct codes, names, and prefixes.
(Previously: 8 types — this delta adds `CP`, `CL`, `CV` for movimientos directos al patrimonio para soportar EEPN v2 filas tipadas.)

#### Standard Types Table

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
| **CP** | **Comprobante de Aporte de Capital** | **P** | **Registra aportes de socios al capital (cuentas 3.1.x y 3.2.1)** |
| **CL** | **Comprobante de Constitución de Reserva** | **L** | **Registra constitución o liberación de reservas (cuentas 3.3.x)** |
| **CV** | **Comprobante de Distribución a Socios** | **V** | **Registra retiros, dividendos o distribución de utilidades acumuladas (cuentas 3.4.x / 3.5.x)** |

#### Scenarios

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | D.1-S1 | Fresh org | `seedVoucherTypes` on an org with zero voucher types → exactly 11 rows created |
| S2 | D.1-S2 | Idempotent on re-run | Running `seedVoucherTypes` a second time → 0 additional rows; all 11 existing rows unchanged |
| S3 | D.1-S3 | Prefixes populated | Every seeded row has a non-empty `prefix` matching the table above |
| S4 | D.1-S4 | No `VoucherTypeCode` import | Seed file uses plain string literals, no enum import |
| **S5** | **D.1-S5** | **Patrimony codes present** | **After seed, `findFirst({code:'CP'})`, `code:'CL'`, `code:'CV'` all return rows with isActive=true** |
| **S6** | **D.1-S6** | **Migration backfill** | **Running the migration on an org with the original 8 types adds the 3 patrimony types without modifying the existing 8** |

**Test file**: `prisma/seeds/__tests__/voucher-types.seed.test.ts`

## ADDED Requirements

### REQ-D.2 — Migration para organizaciones existentes

Un script de migration MUST agregar los 3 nuevos voucher types (`CP`, `CL`, `CV`) a toda organización activa que no los tenga, preservando la integridad de los 8 types existentes.

#### Scenario: Org existente recibe los 3 types

- GIVEN una organización con los 8 voucher types originales seeded
- WHEN corre la migration `backfill-patrimony-voucher-types`
- THEN la org termina con 11 voucher types, los 8 originales intactos (mismo id, name, prefix)

#### Scenario: Org nueva tras migration

- GIVEN migration ya corrió
- WHEN se crea una nueva organización via `onOrgCreate` que dispara `seedVoucherTypes`
- THEN la org recibe directamente los 11 types (sin necesidad de re-correr la migration)

#### Scenario: Migration idempotente

- GIVEN migration ya corrió una vez
- WHEN corre una segunda vez
- THEN 0 rows adicionales, no hay errores
