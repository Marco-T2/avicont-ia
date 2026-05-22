-- mobile-bearer-cors Phase — dispatch_client_id_idempotency
-- Adds optional clientId to dispatches for mobile offline idempotency (change C).
-- A unique index scoped to (organizationId, clientId) ensures a mobile client
-- UUID can only produce one dispatch per org.
-- Postgres treats each NULL as distinct in a unique index, so web dispatches
-- (clientId = NULL) are never affected by this constraint.

-- Step 1: Add nullable clientId column
ALTER TABLE "dispatches" ADD COLUMN "clientId" TEXT;

-- Step 2: Create unique index — NULLs do not collide in Postgres
CREATE UNIQUE INDEX "dispatches_organizationId_clientId_key"
  ON "dispatches"("organizationId", "clientId");
