-- AlterEnum
ALTER TYPE "DispatchStatus" ADD VALUE 'LOCKED';

-- AlterEnum
ALTER TYPE "JournalEntryStatus" ADD VALUE 'LOCKED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'LOCKED';

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedById" TEXT,
    "justification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_entityType_entityId_idx" ON "audit_logs"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_user_id TEXT;
  v_justification TEXT;
  v_org_id TEXT;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  -- Read session variables (safe — returns NULL if not set)
  v_user_id := current_setting('app.current_user_id', true);
  v_justification := current_setting('app.audit_justification', true);

  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
    v_org_id := OLD."organizationId";
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detect status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'STATUS_CHANGE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_org_id := NEW."organizationId";
  END IF;

  INSERT INTO audit_logs (id, "organizationId", "entityType", "entityId", action, "oldValues", "newValues", "changedById", justification, "createdAt")
  VALUES (
    gen_random_uuid()::text,
    v_org_id,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_action,
    v_old_json,
    v_new_json,
    v_user_id,
    v_justification,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
CREATE TRIGGER audit_dispatches
  AFTER UPDATE OR DELETE ON dispatches
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_payments
  AFTER UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_journal_entries
  AFTER UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
