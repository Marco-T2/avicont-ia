-- ============================================================
-- Migración: audit_insert_coverage_completion
-- Fecha: 2026-04-24
-- ADR: docs/adr/002-audit-insert-coverage-completion.md
--
-- Objetivo: cerrar la brecha sistémica de cobertura INSERT en la
-- infraestructura de auditoría.
--
-- Cambios incluidos:
--   1. Reemplaza audit_trigger_fn() para cubrir INSERT (emite action='CREATE'),
--      con resolución condicional de organizationId para tablas de detalle
--      (journal_lines, purchase_details, sale_details) y fallback a la var de
--      sesión app.current_organization_id ante CASCADE DELETE del padre.
--   2. Para las 5 tablas cabecera (sales, purchases, dispatches, payments,
--      journal_entries): DROP + recreación del trigger como
--      AFTER INSERT OR UPDATE OR DELETE (estrategia a — trigger único por tabla).
--   3. Nuevos triggers AFTER INSERT OR UPDATE OR DELETE para las 3 tablas de
--      detalle: sale_details, purchase_details, journal_lines.
--   4. fiscal_periods NO recibe trigger INSERT (ver ADR §Justificación).
--
-- Estrategia de trigger (a): se elimina el trigger existente AFTER UPDATE OR
-- DELETE y se recrea como AFTER INSERT OR UPDATE OR DELETE. Un trigger único
-- por tabla es más fácil de razonar, mantener y monitorear que dos triggers
-- con solapamiento de nombre.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Función de auditoría (CREATE OR REPLACE — idempotente)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS TRIGGER AS $$
DECLARE
  v_action        TEXT;
  v_user_id       TEXT;
  v_justification TEXT;
  v_correlation_id TEXT;
  v_org_id        TEXT;
  v_old_json      JSONB;
  v_new_json      JSONB;
BEGIN
  -- Leer vars de sesión establecidas por setAuditContext()
  v_user_id        := current_setting('app.current_user_id', true);
  v_justification  := current_setting('app.audit_justification', true);
  v_correlation_id := current_setting('app.correlation_id', true);
  IF v_correlation_id = '' THEN
    v_correlation_id := NULL;
  END IF;

  -- ── Determinar acción y snapshots ────────────────────────
  IF TG_OP = 'INSERT' THEN
    v_action   := 'CREATE';
    v_old_json := NULL;
    v_new_json := to_jsonb(NEW);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Materializar snapshots una sola vez — explícito > memoización implícita.
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    -- STATUS_CHANGE vía introspección JSONB: self-adaptive.
    -- Tablas con columna status → compara valores reales.
    -- Tablas sin columna status (líneas de detalle) → ambos lados son NULL,
    -- "IS DISTINCT FROM" = false → cae a UPDATE. Sin hardcodeo por tabla.
    IF (v_old_json->>'status') IS DISTINCT FROM (v_new_json->>'status') THEN
      v_action := 'STATUS_CHANGE';
    ELSE
      v_action := 'UPDATE';
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action   := 'DELETE';
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
  END IF;

  -- ── Resolver organizationId ───────────────────────────────
  --
  -- Las tablas de detalle (journal_lines, purchase_details, sale_details)
  -- no tienen columna organizationId propia; se obtiene desde el padre.
  -- Si el lookup retorna NULL (ej.: CASCADE DELETE del padre ya borrado),
  -- se cae al fallback de sesión app.current_organization_id.
  -- Si también es NULL/vacío, la excepción es deliberada: es preferible
  -- fallar en voz alta a insertar una fila de auditoría con org vacío.

  CASE TG_TABLE_NAME
    WHEN 'journal_lines' THEN
      SELECT "organizationId"
        INTO v_org_id
        FROM journal_entries
       WHERE id = COALESCE(NEW."journalEntryId", OLD."journalEntryId");

    WHEN 'purchase_details' THEN
      SELECT "organizationId"
        INTO v_org_id
        FROM purchases
       WHERE id = COALESCE(NEW."purchaseId", OLD."purchaseId");

    WHEN 'sale_details' THEN
      SELECT "organizationId"
        INTO v_org_id
        FROM sales
       WHERE id = COALESCE(NEW."saleId", OLD."saleId");

    ELSE
      v_org_id := COALESCE(NEW."organizationId", OLD."organizationId");
  END CASE;

  -- Fallback a la var de sesión cuando el lookup de detalle no encuentra padre
  -- (ocurre durante DELETE en CASCADE cuando el padre ya fue eliminado primero)
  IF v_org_id IS NULL OR v_org_id = '' THEN
    v_org_id := current_setting('app.current_organization_id', true);
    IF v_org_id = '' THEN
      v_org_id := NULL;
    END IF;
  END IF;

  IF v_org_id IS NULL OR v_org_id = '' THEN
    RAISE EXCEPTION
      'audit_trigger_fn: organizationId no resuelto para tabla % (op=%, entity=%)',
      TG_TABLE_NAME,
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  END IF;

  -- ── Insertar fila de auditoría ────────────────────────────
  INSERT INTO audit_logs (
    id,
    "organizationId",
    "entityType",
    "entityId",
    action,
    "oldValues",
    "newValues",
    "changedById",
    justification,
    "correlationId",
    "createdAt"
  ) VALUES (
    gen_random_uuid()::text,
    v_org_id,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_action,
    v_old_json,
    v_new_json,
    v_user_id,
    v_justification,
    v_correlation_id,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────────────────────────
-- 2. Cabeceras: reemplazar triggers UPDATE/DELETE por INSERT/UPDATE/DELETE
--    Estrategia (a): DROP + recrear como trigger único.
-- ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_dispatches ON dispatches;
CREATE TRIGGER audit_dispatches
  AFTER INSERT OR UPDATE OR DELETE ON dispatches
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_payments ON payments;
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_journal_entries ON journal_entries;
CREATE TRIGGER audit_journal_entries
  AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_sales ON sales;
CREATE TRIGGER audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_purchases ON purchases;
CREATE TRIGGER audit_purchases
  AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();


-- ─────────────────────────────────────────────────────────────
-- 3. Tablas de detalle: triggers nuevos (sin triggers previos)
-- ─────────────────────────────────────────────────────────────

CREATE TRIGGER audit_journal_lines
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_purchase_details
  AFTER INSERT OR UPDATE OR DELETE ON purchase_details
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_sale_details
  AFTER INSERT OR UPDATE OR DELETE ON sale_details
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();


-- ─────────────────────────────────────────────────────────────
-- 4. fiscal_periods: sin cambios (solo UPDATE/DELETE — ver ADR)
-- ─────────────────────────────────────────────────────────────
-- El trigger audit_fiscal_periods existente (AFTER UPDATE OR DELETE)
-- se conserva sin modificación.
