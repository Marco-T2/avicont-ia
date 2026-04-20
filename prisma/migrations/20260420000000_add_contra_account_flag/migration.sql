-- Add contra-account flag column with default false so existing rows auto-populate.
-- Contra-accounts carry nature OPPOSITE to their type's default (e.g. an ACTIVO-typed
-- Depreciación Acumulada with nature=ACREEDORA represents a REDUCER within its section).
--
-- This migration only adds the column. The data backfill runs in a separate Node
-- script at ./backfill.ts (invoked via `npx tsx`). See migration convention
-- established in 20260413203509_add_account_subtype/.
ALTER TABLE "accounts" ADD COLUMN "isContraAccount" BOOLEAN NOT NULL DEFAULT false;
