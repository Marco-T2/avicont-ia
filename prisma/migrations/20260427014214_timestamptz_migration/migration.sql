-- ============================================================
-- TIMESTAMP-AFFECTED: datos naive BO-local → USING 'America/La_Paz'
-- (49 columnas — representan instantes reales en el tiempo)
-- ============================================================

-- accounts_payable
ALTER TABLE "accounts_payable"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "accounts_payable"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- accounts_receivable
ALTER TABLE "accounts_receivable"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "accounts_receivable"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- agent_rate_limits
ALTER TABLE "agent_rate_limits"
  ALTER COLUMN "windowStart" TYPE TIMESTAMPTZ(3)
  USING "windowStart" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "agent_rate_limits"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- audit_logs
ALTER TABLE "audit_logs"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- chat_messages
ALTER TABLE "chat_messages"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- chicken_lots
ALTER TABLE "chicken_lots"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "chicken_lots"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- contacts
ALTER TABLE "contacts"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "contacts"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- custom_roles
ALTER TABLE "custom_roles"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "custom_roles"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- dispatches
ALTER TABLE "dispatches"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "dispatches"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- document_signature_config
ALTER TABLE "document_signature_config"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "document_signature_config"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- documents
ALTER TABLE "documents"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- expenses
ALTER TABLE "expenses"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- farms
ALTER TABLE "farms"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "farms"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- fiscal_periods
ALTER TABLE "fiscal_periods"
  ALTER COLUMN "closedAt" TYPE TIMESTAMPTZ(3)
  USING "closedAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "fiscal_periods"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "fiscal_periods"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- iva_purchase_books
ALTER TABLE "iva_purchase_books"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "iva_purchase_books"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- iva_sales_books
ALTER TABLE "iva_sales_books"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "iva_sales_books"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- journal_entries
ALTER TABLE "journal_entries"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "journal_entries"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- mortality_logs
ALTER TABLE "mortality_logs"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- operational_doc_types
ALTER TABLE "operational_doc_types"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "operational_doc_types"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- org_profile
ALTER TABLE "org_profile"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "org_profile"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- org_settings
ALTER TABLE "org_settings"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "org_settings"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- organization_members
ALTER TABLE "organization_members"
  ALTER COLUMN "deactivatedAt" TYPE TIMESTAMPTZ(3)
  USING "deactivatedAt" AT TIME ZONE 'America/La_Paz';

-- organizations
ALTER TABLE "organizations"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- payments
ALTER TABLE "payments"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "payments"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- product_types
ALTER TABLE "product_types"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "product_types"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- purchases
ALTER TABLE "purchases"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "purchases"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- sales
ALTER TABLE "sales"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';
ALTER TABLE "sales"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3)
  USING "updatedAt" AT TIME ZONE 'America/La_Paz';

-- users
ALTER TABLE "users"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'America/La_Paz';

-- ============================================================
-- UTC-NOON: datos ya en UTC vía toNoonUtc() → USING 'UTC'
-- (16 columnas — representan fechas calendario como TIMESTAMPTZ)
-- ============================================================

-- accounts_payable
ALTER TABLE "accounts_payable"
  ALTER COLUMN "dueDate" TYPE TIMESTAMPTZ(3)
  USING "dueDate" AT TIME ZONE 'UTC';

-- accounts_receivable
ALTER TABLE "accounts_receivable"
  ALTER COLUMN "dueDate" TYPE TIMESTAMPTZ(3)
  USING "dueDate" AT TIME ZONE 'UTC';

-- chicken_lots
ALTER TABLE "chicken_lots"
  ALTER COLUMN "startDate" TYPE TIMESTAMPTZ(3)
  USING "startDate" AT TIME ZONE 'UTC';
ALTER TABLE "chicken_lots"
  ALTER COLUMN "endDate" TYPE TIMESTAMPTZ(3)
  USING "endDate" AT TIME ZONE 'UTC';

-- dispatches
ALTER TABLE "dispatches"
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3)
  USING "date" AT TIME ZONE 'UTC';

-- expenses
ALTER TABLE "expenses"
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3)
  USING "date" AT TIME ZONE 'UTC';

-- fiscal_periods
ALTER TABLE "fiscal_periods"
  ALTER COLUMN "startDate" TYPE TIMESTAMPTZ(3)
  USING "startDate" AT TIME ZONE 'UTC';
ALTER TABLE "fiscal_periods"
  ALTER COLUMN "endDate" TYPE TIMESTAMPTZ(3)
  USING "endDate" AT TIME ZONE 'UTC';

-- iva_purchase_books
ALTER TABLE "iva_purchase_books"
  ALTER COLUMN "fechaFactura" TYPE TIMESTAMPTZ(3)
  USING "fechaFactura" AT TIME ZONE 'UTC';

-- iva_sales_books
ALTER TABLE "iva_sales_books"
  ALTER COLUMN "fechaFactura" TYPE TIMESTAMPTZ(3)
  USING "fechaFactura" AT TIME ZONE 'UTC';

-- journal_entries
ALTER TABLE "journal_entries"
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3)
  USING "date" AT TIME ZONE 'UTC';

-- mortality_logs
ALTER TABLE "mortality_logs"
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3)
  USING "date" AT TIME ZONE 'UTC';

-- payments
ALTER TABLE "payments"
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3)
  USING "date" AT TIME ZONE 'UTC';

-- purchase_details
ALTER TABLE "purchase_details"
  ALTER COLUMN "fecha" TYPE TIMESTAMPTZ(3)
  USING "fecha" AT TIME ZONE 'UTC';

-- purchases
ALTER TABLE "purchases"
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3)
  USING "date" AT TIME ZONE 'UTC';

-- sales
ALTER TABLE "sales"
  ALTER COLUMN "date" TYPE TIMESTAMPTZ(3)
  USING "date" AT TIME ZONE 'UTC';
