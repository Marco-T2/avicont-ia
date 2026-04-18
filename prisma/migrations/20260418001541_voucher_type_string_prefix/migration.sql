-- Migration: voucher_type_string_prefix
-- Design ref: openspec/changes/voucher-types/design.md — D.2, D.3, D.9
--
-- Purpose: remove the VoucherTypeCode enum, convert code to TEXT, add a prefix column.
-- FK safety: journal_entries.voucher_type_id is a FK to voucher_types.id (cuid),
-- NOT to the enum. No JournalEntry row is updated — zero orphans by construction.
--
-- Rollback note: the `down` migration drops prefix, re-casts code to the enum,
-- drops non-original codes. Rolling back AFTER creating CN/CM/CB rows is destructive.

-- Step 1: add prefix column (nullable so we can backfill)
ALTER TABLE "voucher_types" ADD COLUMN "prefix" TEXT;

-- Step 2: backfill prefix for the 5 pre-existing codes
UPDATE "voucher_types" SET "prefix" = 'I' WHERE "code"::text = 'CI';
UPDATE "voucher_types" SET "prefix" = 'E' WHERE "code"::text = 'CE';
UPDATE "voucher_types" SET "prefix" = 'D' WHERE "code"::text = 'CD';
UPDATE "voucher_types" SET "prefix" = 'T' WHERE "code"::text = 'CT';
UPDATE "voucher_types" SET "prefix" = 'A' WHERE "code"::text = 'CA';

-- Step 3: enforce NOT NULL on prefix
ALTER TABLE "voucher_types" ALTER COLUMN "prefix" SET NOT NULL;

-- Step 4: convert code column from enum to TEXT (values preserved verbatim)
ALTER TABLE "voucher_types" ALTER COLUMN "code" TYPE TEXT USING "code"::text;

-- Step 5: drop the enum type (no more column references it)
DROP TYPE "VoucherTypeCode";
