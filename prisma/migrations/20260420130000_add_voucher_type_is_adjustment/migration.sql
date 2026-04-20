-- Add isAdjustment flag on voucher_types. Adjustment vouchers (comprobantes de
-- ajuste, code CJ in the standard LatAm catalog) register period-end corrections:
-- depreciation, amortization, provisions, and accruals. The 12-column worksheet
-- report needs this flag to split the Ajustes column from regular Diario entries.
--
-- Additive with DEFAULT false so existing rows keep the "not an adjustment"
-- default. The UPDATE backfills any pre-existing CJ rows (seed had not yet
-- included CJ, but some orgs already created it manually).
ALTER TABLE "voucher_types" ADD COLUMN "isAdjustment" BOOLEAN NOT NULL DEFAULT false;

UPDATE "voucher_types" SET "isAdjustment" = true WHERE "code" = 'CJ';
