-- ============================================================
-- Migración: audit_permissions_data
-- Fecha: 2026-04-24
-- Change: openspec/changes/modulo-de-auditoria (REQ-AUDIT.7)
--
-- Objetivo: propagar el nuevo permiso "audit" a los system roles
-- owner y admin de orgs ya existentes. Nuevas orgs lo reciben vía
-- seed dinámico (prisma/seed-system-roles.ts) — esta data migration
-- aplica una sola vez al deploy.
--
-- Idempotencia: el guard NOT ('audit' = ANY("permissionsRead"))
-- asegura que reruns (incluido shadow DB / diff) no dupliquen.
--
-- Scope: solo roles isSystem=true con slug en ('owner','admin').
-- Los custom roles y los system roles de otras categorías quedan
-- sin cambios.
--
-- Tipo de columna: permissionsRead es text[] (Prisma String[]),
-- NO jsonb — por eso array_append + ANY (no || / @>).
-- ============================================================

UPDATE "custom_roles"
SET "permissionsRead" = array_append("permissionsRead", 'audit')
WHERE "slug" IN ('owner', 'admin')
  AND "isSystem" = true
  AND NOT ('audit' = ANY("permissionsRead"));
