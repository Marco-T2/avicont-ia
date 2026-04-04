-- CreateIndex
CREATE INDEX "accounts_parentId_idx" ON "accounts"("parentId");

-- CreateIndex
CREATE INDEX "chicken_lots_organizationId_idx" ON "chicken_lots"("organizationId");

-- CreateIndex
CREATE INDEX "chicken_lots_farmId_idx" ON "chicken_lots"("farmId");

-- CreateIndex
CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");

-- CreateIndex
CREATE INDEX "documents_userId_idx" ON "documents"("userId");

-- CreateIndex
CREATE INDEX "expenses_organizationId_idx" ON "expenses"("organizationId");

-- CreateIndex
CREATE INDEX "expenses_lotId_idx" ON "expenses"("lotId");

-- CreateIndex
CREATE INDEX "expenses_createdById_idx" ON "expenses"("createdById");

-- CreateIndex
CREATE INDEX "farms_organizationId_idx" ON "farms"("organizationId");

-- CreateIndex
CREATE INDEX "farms_memberId_idx" ON "farms"("memberId");

-- CreateIndex
CREATE INDEX "journal_entries_createdById_idx" ON "journal_entries"("createdById");

-- CreateIndex
CREATE INDEX "journal_lines_journalEntryId_idx" ON "journal_lines"("journalEntryId");

-- CreateIndex
CREATE INDEX "journal_lines_accountId_idx" ON "journal_lines"("accountId");

-- CreateIndex
CREATE INDEX "mortality_logs_organizationId_idx" ON "mortality_logs"("organizationId");

-- CreateIndex
CREATE INDEX "mortality_logs_lotId_idx" ON "mortality_logs"("lotId");

-- CreateIndex
CREATE INDEX "mortality_logs_createdById_idx" ON "mortality_logs"("createdById");
