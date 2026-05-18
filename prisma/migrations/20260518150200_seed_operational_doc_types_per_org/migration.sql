-- M-C — Seed the 10 canonical OperationalDocType rows for every existing
-- organization. `findFirst + skip` semantics via INSERT ... WHERE NOT EXISTS
-- (Postgres equivalent) so any pre-existing rows with the same (orgId, code)
-- (e.g. an `RC` created via the Payment admin UI) are left untouched per
-- spec I-4 — name/direction/isActive preserved.
--
-- The same catalog is invoked from prisma/seed.ts and from the
-- OperationalDocTypeSeedPort wired in OrganizationsService for any NEW org
-- created post-deploy. This migration covers EXISTING orgs only.
--
-- Codes are UI/PDF abbreviations (NOT SIN fiscal codes — that is scoped to
-- a future change). Direction reuses the M-A extended enum.

INSERT INTO "operational_doc_types" (
  "id", "organizationId", "code", "name", "direction", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  -- cuid-shaped sentinel id; Prisma reassigns no constraints on insert.
  'odt_' || o."id" || '_' || v."code"            AS "id",
  o."id"                                          AS "organizationId",
  v."code"                                        AS "code",
  v."name"                                        AS "name",
  v."direction"::"OperationalDocDirection"        AS "direction",
  true                                            AS "isActive",
  NOW()                                           AS "createdAt",
  NOW()                                           AS "updatedAt"
FROM "organizations" o
CROSS JOIN (
  VALUES
    ('VG', 'Venta de Gestión',   'VENTA'),
    ('ND', 'Nota de Despacho',   'DESPACHO'),
    ('BC', 'Boleta Cerrada',     'DESPACHO'),
    ('FL', 'Flete',              'COMPRA'),
    ('PF', 'Pollo Faenado',      'COMPRA'),
    ('CG', 'Compra General',     'COMPRA'),
    ('SV', 'Servicio',           'COMPRA'),
    ('RC', 'Recibo de Cobranza', 'COBRO'),
    ('RI', 'Recibo de Ingreso',  'COBRO'),
    ('RE', 'Recibo de Egreso',   'PAGO')
) AS v("code", "name", "direction")
WHERE NOT EXISTS (
  SELECT 1
  FROM "operational_doc_types" existing
  WHERE existing."organizationId" = o."id"
    AND existing."code"           = v."code"
);
