-- simplify-lot-identifier (apply-directo, post retire-farm-collapse-to-lot).
-- Marco-locked simplification: lot identifier reduces to "{farmName} - DD/MM/YYYY"
-- derived at runtime via Lot.entity.displayName getter. The legacy `name`
-- column (free-text label) + `barnNumber` (UI artifact) are dropped wholesale.
-- The new DB-level @@unique([organizationId, farmName, startDate]) replaces
-- the application-side LotNameDuplicate guard ("nunca 2 del mismo" per
-- Marco verbatim).
--
-- DB was just `migrate reset --force` by Marco — no backfill needed for the
-- dropped columns (data loss IS the point of the simplification).

-- 1. Drop legacy columns
ALTER TABLE "chicken_lots" DROP COLUMN "name";
ALTER TABLE "chicken_lots" DROP COLUMN "barnNumber";

-- 2. DB-level uniqueness for (orgId, farmName, startDate) — replaces
--    LotNameDuplicate application-side check.
CREATE UNIQUE INDEX "chicken_lots_organizationId_farmName_startDate_key"
  ON "chicken_lots"("organizationId", "farmName", "startDate");
