-- Perf: add index on journal_lines.contactId
--
-- Driver: contacts-ledger dashboard (CxC/CxP) issues
--   `WHERE contactId IN (...) GROUP BY contactId`
-- (Q2 saldo + Q3 lastMovementDate). Without this index Postgres falls
-- back to a sequential scan on journal_lines, which becomes the cost
-- floor of every dashboard load as the table grows.
--
-- See: modules/contact-balances/infrastructure/
--      prisma-contacts-ledger-dashboard.adapter.ts (TODO line 49).

-- CreateIndex
CREATE INDEX "journal_lines_contactId_idx" ON "journal_lines"("contactId");
