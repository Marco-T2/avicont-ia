-- M-D — Backfill historical JournalEntry.operationalDocTypeId per
-- (sourceType, sourceId).
--
-- Orphan tolerance (I-5): LEFT JOINs on every upstream source so JEs whose
-- sourceId no longer resolves (e.g. hard-deleted Sale) stay NULL. The
-- migration NEVER throws on missing data; warn-level logging happens at the
-- application layer via the integration suite (Phase 5).
--
-- Mappings (locked per design D-table):
--   sale       → SALE_DOCUMENT_TYPE_CODE 'VG' (Sale has no type enum)
--   purchase   → purchaseTypeToCode(p.purchaseType): FLETE/POLLO_FAENADO/COMPRA_GENERAL/SERVICIO → FL/PF/CG/SV
--   dispatch   → dispatchTypeToCode(d.dispatchType): NOTA_DESPACHO/BOLETA_CERRADA → ND/BC
--   payment    → Payment.operationalDocTypeId DIRECT (no lookup needed; Payment already carries the FK)
--
-- sourceType=NULL (manual entries) and any unknown sourceType are NOT touched
-- (the WHERE filter restricts to the four known discriminators).
--
-- Guard: WHERE je."operationalDocTypeId" IS NULL — never overwrite a value
-- already set by Payment side or by an admin via API/UI between M-B and M-D.

UPDATE "journal_entries" AS je
SET "operationalDocTypeId" = sub.odt_id
FROM (
  -- Sale branch: fixed VG code per SALE_DOCUMENT_TYPE_CODE
  SELECT
    je."id" AS je_id,
    odt."id" AS odt_id
  FROM "journal_entries" je
  LEFT JOIN "sales" s
    ON s."id" = je."sourceId" AND s."organizationId" = je."organizationId"
  LEFT JOIN "operational_doc_types" odt
    ON odt."organizationId" = je."organizationId"
   AND odt."code"           = 'VG'
  WHERE je."sourceType" = 'sale'
    AND s."id" IS NOT NULL

  UNION ALL

  -- Purchase branch: purchaseTypeToCode
  SELECT
    je."id" AS je_id,
    odt."id" AS odt_id
  FROM "journal_entries" je
  LEFT JOIN "purchases" p
    ON p."id" = je."sourceId" AND p."organizationId" = je."organizationId"
  LEFT JOIN "operational_doc_types" odt
    ON odt."organizationId" = je."organizationId"
   AND odt."code"           = CASE p."purchaseType"
        WHEN 'FLETE'           THEN 'FL'
        WHEN 'POLLO_FAENADO'   THEN 'PF'
        WHEN 'COMPRA_GENERAL'  THEN 'CG'
        WHEN 'SERVICIO'        THEN 'SV'
      END
  WHERE je."sourceType" = 'purchase'
    AND p."id" IS NOT NULL

  UNION ALL

  -- Dispatch branch: dispatchTypeToCode
  SELECT
    je."id" AS je_id,
    odt."id" AS odt_id
  FROM "journal_entries" je
  LEFT JOIN "dispatches" d
    ON d."id" = je."sourceId" AND d."organizationId" = je."organizationId"
  LEFT JOIN "operational_doc_types" odt
    ON odt."organizationId" = je."organizationId"
   AND odt."code"           = CASE d."dispatchType"
        WHEN 'NOTA_DESPACHO'   THEN 'ND'
        WHEN 'BOLETA_CERRADA'  THEN 'BC'
      END
  WHERE je."sourceType" = 'dispatch'
    AND d."id" IS NOT NULL

  UNION ALL

  -- Payment branch: read Payment.operationalDocTypeId DIRECT (no code lookup)
  SELECT
    je."id"                  AS je_id,
    p."operationalDocTypeId" AS odt_id
  FROM "journal_entries" je
  LEFT JOIN "payments" p
    ON p."id" = je."sourceId" AND p."organizationId" = je."organizationId"
  WHERE je."sourceType" = 'payment'
    AND p."id" IS NOT NULL
) AS sub
WHERE je."id" = sub.je_id
  AND sub.odt_id IS NOT NULL
  AND je."operationalDocTypeId" IS NULL;
