-- Migration: chart-of-accounts 4-level hierarchy + org_settings phantom code fix
--
-- WHY: The seed (prisma/seeds/chart-of-accounts.ts) uses upsert({ update: {} }),
-- which is idempotent on CREATE but NEVER updates isDetail on existing rows.
-- The seed therefore only covers FUTURE orgs. This migration brings EXISTING
-- orgs to the same 4-level shape and corrects the phantom account codes that
-- org_settings was pointing at.
--
-- All three blocks are idempotent: re-running this migration is a no-op.

-- ── Block 1: demote the 5 former level-3 leaves to parent nodes ──────────────
-- Idempotent: setting isDetail=false again is a no-op.
UPDATE "accounts"
SET "isDetail" = false
WHERE "code" IN ('1.1.1', '1.1.2', '1.1.3', '1.1.4', '2.1.1');

-- ── Block 2: insert the 8 level-4 leaves, one set per organization ───────────
-- parentId / organizationId / type / nature / subtype are resolved by JOINing
-- each leaf definition against its parent account, PER ORG. This does NOT
-- assume a single org or any fixed id.
-- ON CONFLICT (organizationId, code) DO NOTHING makes the INSERT idempotent.
INSERT INTO "accounts" (
  "id", "code", "name", "type", "nature", "subtype",
  "parentId", "level", "isDetail", "requiresContact",
  "organizationId", "isActive", "isContraAccount"
)
SELECT
  gen_random_uuid()::text,
  leaf."code",
  leaf."name",
  parent."type",
  parent."nature",
  parent."subtype",
  parent."id",
  4,
  true,
  parent."requiresContact",
  parent."organizationId",
  true,
  false
FROM (
  VALUES
    ('1.1.1', '1.1.1.1', 'Caja General M/N'),
    ('1.1.1', '1.1.1.2', 'Caja General M/E'),
    ('1.1.2', '1.1.2.1', 'Caja Chica Administración'),
    ('1.1.3', '1.1.3.1', 'Banco 1 M/N'),
    ('1.1.3', '1.1.3.2', 'Banco 2 M/N'),
    ('1.1.3', '1.1.3.3', 'Banco 3 M/E'),
    ('1.1.4', '1.1.4.1', 'CxC Comerciales'),
    ('2.1.1', '2.1.1.1', 'CxP Comerciales')
) AS leaf("parentCode", "code", "name")
JOIN "accounts" parent ON parent."code" = leaf."parentCode"
ON CONFLICT ("organizationId", "code") DO NOTHING;

-- ── Block 3: correct phantom account codes in org_settings ──────────────────
-- bancoAccountCode: 1.1.2.1 (Caja Chica typo) → 1.1.3.1 (Banco 1 M/N).
-- fleteExpenseAccountCode: 5.1.3 (Medicamentos bug) → 5.1.9 (Fletes y Transporte).
-- Guarded by WHERE on the old value, so re-running is a no-op.
UPDATE "org_settings"
SET "bancoAccountCode" = '1.1.3.1'
WHERE "bancoAccountCode" = '1.1.2.1';

UPDATE "org_settings"
SET "fleteExpenseAccountCode" = '5.1.9'
WHERE "fleteExpenseAccountCode" = '5.1.3';
