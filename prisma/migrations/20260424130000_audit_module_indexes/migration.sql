-- ============================================================
-- Migración: audit_module_indexes
-- Fecha: 2026-04-24
-- Change: openspec/changes/modulo-de-auditoria (REQ-AUDIT.8)
--
-- Objetivo: crear los 2 índices compuestos que cubren los planes
-- de query del módulo de auditoría (lista por rango de fechas y
-- detalle por comprobante).
--
-- Los 3 índices previos en audit_logs se mantienen sin cambios:
--   - audit_logs_organizationId_entityType_entityId_idx
--   - audit_logs_organizationId_createdAt_idx
--   - audit_logs_correlationId_idx
--
-- Plan de uso (btree bidireccional sirve ASC y DESC):
--   - (org, entityType, createdAt): lista filtrada por entityType.
--   - (org, changedById, createdAt): lista filtrada por autor.
-- ============================================================

CREATE INDEX "audit_logs_organizationId_entityType_createdAt_idx"
  ON "audit_logs" ("organizationId", "entityType", "createdAt");

CREATE INDEX "audit_logs_organizationId_changedById_createdAt_idx"
  ON "audit_logs" ("organizationId", "changedById", "createdAt");
