/**
 * ContactsLedgerDashboardPort — read-side port for the contact dashboard
 * surface (CxC/CxP). Returns one row per contact with aggregated open
 * balance + the date of the most-recent journal movement affecting that
 * contact (used for the "Fecha último movimiento" column).
 *
 * Spec REQ "Contact Dashboard" (CxC/CxP) — REQ "API Contract — Contact
 * Balances". Design D5: new port (one extra Prisma query MAX(JournalEntry.
 * date) GROUP BY contactId), method lives on ContactBalancesService.
 *
 * DEC-1 boundary contract:
 *   - openBalance: Decimal string (Prisma.Decimal → string at adapter).
 *   - lastMovementDate: ISO 8601 string (UTC) | null. Null when the
 *     contact has CxC/CxP rows but no journal entry has materialized yet
 *     (edge case — only when includeZeroBalance=true surfaces a contact
 *     with no movements at all).
 */

export type ContactType = "CLIENTE" | "PROVEEDOR";

export interface ContactDashboardRow {
  contactId: string;
  name: string;
  lastMovementDate: string | null;
  openBalance: string;
}

export interface ContactsDashboardListOptions {
  includeZeroBalance?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "openBalance" | "name" | "lastMovementDate";
  direction?: "asc" | "desc";
}

export interface ContactsDashboardPaginatedResult {
  items: ContactDashboardRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContactsLedgerDashboardPort {
  listContactsWithOpenBalance(
    organizationId: string,
    type: ContactType,
    options?: ContactsDashboardListOptions,
  ): Promise<ContactsDashboardPaginatedResult>;
}
