-- SDD retire-farm-collapse-to-lot F5-final (T31): destructive migration.
-- Cero prod data per Marco lock — no backfill needed.
--
-- 1. Drop legacy farmId FK + column from chicken_lots
-- 2. Make farmName + memberId NOT NULL (additive F1 left them nullable)
-- 3. Drop farms table (Farm aggregate retired entirely)
-- 4. Simplify LotStatus enum to ACTIVE | INACTIVE (drop CLOSED + SOLD)

-- Step 1 — drop legacy farmId FK + column + index from chicken_lots
ALTER TABLE "chicken_lots" DROP CONSTRAINT IF EXISTS "chicken_lots_farmId_fkey";
DROP INDEX IF EXISTS "chicken_lots_farmId_idx";
ALTER TABLE "chicken_lots" DROP COLUMN "farmId";

-- Step 2 — tighten farmName + memberId to NOT NULL
ALTER TABLE "chicken_lots" ALTER COLUMN "farmName" SET NOT NULL;
ALTER TABLE "chicken_lots" ALTER COLUMN "memberId" SET NOT NULL;

-- Step 3 — drop farms table (FK from chicken_lots already removed; Farm model
-- has no other inverse relations than Organization + OrganizationMember,
-- and DropTable cascades the remaining constraints automatically)
DROP TABLE IF EXISTS "farms";

-- Step 4 — simplify LotStatus enum: ACTIVE | INACTIVE (drop CLOSED + SOLD)
-- Postgres requires recreating the enum: rename old → create new → cast
-- column → drop old.
ALTER TYPE "LotStatus" RENAME TO "LotStatus_old";
CREATE TYPE "LotStatus" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "chicken_lots"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "LotStatus" USING (
    CASE "status"::text
      WHEN 'ACTIVE' THEN 'ACTIVE'::"LotStatus"
      ELSE 'INACTIVE'::"LotStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"LotStatus";
DROP TYPE "LotStatus_old";
