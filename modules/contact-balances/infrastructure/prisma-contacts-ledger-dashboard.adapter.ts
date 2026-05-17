import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  ContactsLedgerDashboardPort,
  ContactType,
  ContactsDashboardListOptions,
  ContactsDashboardPaginatedResult,
  ContactDashboardRow,
} from "../domain/ports/contacts-ledger-dashboard.port";

type DbClient = Pick<
  PrismaClient,
  "contact" | "accountsReceivable" | "accountsPayable" | "journalLine"
>;

/**
 * PrismaContactsLedgerDashboardAdapter — implements
 * ContactsLedgerDashboardPort backed by Prisma (design D5).
 *
 * Strategy (3 queries, in parallel where independent):
 *   Q1 — contacts.findMany(orgId, type, isActive=true) → seed list.
 *   Q2 — accountsReceivable.groupBy({contactId}, _sum:{balance}, where:
 *        organizationId+contactId IN seed + status IN [PENDING, PARTIAL])
 *        OR accountsPayable.groupBy(...) depending on `type`.
 *   Q3 — journalLine.findMany(orgId via journalEntry, contactId IN seed)
 *        select journalEntry.date — reduced client-side to MAX per
 *        contactId. Prisma `groupBy` on a related table column is not
 *        directly supported; we lift the rows and reduce (small N — bounded
 *        by total journal lines for these contacts, which is tractable for
 *        dashboard cardinality).
 *
 * DEC-1 boundary: all monetary `Prisma.Decimal` are stringified at the
 * adapter boundary (no Decimal objects leak into the application layer).
 *
 * Sort/pagination: applied AFTER the join+reduce — necessary because the
 * sort key `openBalance` is computed (not a column on contacts), and
 * `lastMovementDate` derives from a related table. For dashboard
 * cardinalities (typically <500 contacts per org) the in-memory sort is
 * acceptable. If contact counts grow, push the join+sort into a raw SQL
 * CTE.
 *
 * TODO (perf): `JournalLine.contactId` lacks an explicit (organizationId,
 * contactId) index (organizationId lives on JournalEntry, not JournalLine).
 * The Q3 reduce path scans all journal lines for the seed contacts; for
 * large datasets consider adding a composite index on
 * (journalEntry.organizationId, journalLine.contactId) via a future
 * migration. AR/AP tables already have `@@index([organizationId,
 * contactId])` (schema.prisma L651, L679).
 */
export class PrismaContactsLedgerDashboardAdapter
  implements ContactsLedgerDashboardPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async listContactsWithOpenBalance(
    organizationId: string,
    type: ContactType,
    options: ContactsDashboardListOptions = {},
  ): Promise<ContactsDashboardPaginatedResult> {
    const includeZeroBalance = options.includeZeroBalance ?? false;
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, options.pageSize ?? 20);
    const sort = options.sort ?? "openBalance";
    const direction = options.direction ?? "desc";

    // Q1 — seed contacts of this type for this org
    const contacts = await this.db.contact.findMany({
      where: { organizationId, type, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (contacts.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    const contactIds = contacts.map((c) => c.id);

    // Q2 — aggregate open balance per contact (CxC for CLIENTE, CxP for
    // PROVEEDOR). Status filter mirrors sister `aggregateOpen` (PENDING +
    // PARTIAL constitute "open").
    const openByContact = new Map<string, string>();
    if (type === "CLIENTE") {
      const rows = await this.db.accountsReceivable.groupBy({
        by: ["contactId"],
        where: {
          organizationId,
          contactId: { in: contactIds },
          status: { in: ["PENDING", "PARTIAL"] },
        },
        _sum: { balance: true },
      });
      for (const r of rows) {
        openByContact.set(r.contactId, r._sum.balance?.toString() ?? "0");
      }
    } else {
      const rows = await this.db.accountsPayable.groupBy({
        by: ["contactId"],
        where: {
          organizationId,
          contactId: { in: contactIds },
          status: { in: ["PENDING", "PARTIAL"] },
        },
        _sum: { balance: true },
      });
      for (const r of rows) {
        openByContact.set(r.contactId, r._sum.balance?.toString() ?? "0");
      }
    }

    // Q3 — latest journal entry date per contact. Reduce client-side
    // because Prisma groupBy does NOT support aggregating a related-table
    // column directly. Filter rows by JournalEntry.organizationId (lives
    // on JournalEntry, not on JournalLine).
    const lines = await this.db.journalLine.findMany({
      where: {
        contactId: { in: contactIds },
        journalEntry: { organizationId },
      },
      select: {
        contactId: true,
        journalEntry: { select: { date: true } },
      },
    });
    const lastDateByContact = new Map<string, Date>();
    for (const ln of lines) {
      if (!ln.contactId) continue;
      const d = ln.journalEntry.date;
      const prev = lastDateByContact.get(ln.contactId);
      if (!prev || d.getTime() > prev.getTime()) {
        lastDateByContact.set(ln.contactId, d);
      }
    }

    // Build rows. Default contacts with no AR/AP row → openBalance "0".
    let rows: ContactDashboardRow[] = contacts.map((c) => {
      const last = lastDateByContact.get(c.id) ?? null;
      return {
        contactId: c.id,
        name: c.name,
        lastMovementDate: last ? last.toISOString() : null,
        openBalance: openByContact.get(c.id) ?? "0",
      };
    });

    if (!includeZeroBalance) {
      rows = rows.filter((r) => parseFloat(r.openBalance) !== 0);
    }

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      if (sort === "openBalance") {
        cmp = parseFloat(a.openBalance) - parseFloat(b.openBalance);
      } else if (sort === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sort === "lastMovementDate") {
        const da = a.lastMovementDate ? Date.parse(a.lastMovementDate) : 0;
        const db = b.lastMovementDate ? Date.parse(b.lastMovementDate) : 0;
        cmp = da - db;
      }
      return direction === "asc" ? cmp : -cmp;
    });

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  }
}
