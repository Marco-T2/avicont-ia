-- M-A — extend OperationalDocDirection with 3 new values
-- Postgres requires one ALTER TYPE ADD VALUE per statement
-- Existing values: COBRO, PAGO, BOTH (preserved per I-7 invariant)

ALTER TYPE "OperationalDocDirection" ADD VALUE IF NOT EXISTS 'VENTA';
ALTER TYPE "OperationalDocDirection" ADD VALUE IF NOT EXISTS 'COMPRA';
ALTER TYPE "OperationalDocDirection" ADD VALUE IF NOT EXISTS 'DESPACHO';
