import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { FINALIZED_JE_STATUSES } from "@/modules/accounting/shared/infrastructure/journal-status.sql";
import {
  makeOrgSettingsService,
  type OrgSettingsService,
} from "@/modules/org-settings/presentation/server";
import type {
  ContactsLedgerDashboardPort,
  ContactType,
  ContactsDashboardListOptions,
  ContactsDashboardPaginatedResult,
  ContactDashboardRow,
} from "../domain/ports/contacts-ledger-dashboard.port";

type DbClient = Pick<PrismaClient, "contact" | "journalLine">;

/**
 * PrismaContactsLedgerDashboardAdapter — implements
 * ContactsLedgerDashboardPort backed by Prisma (design D5).
 *
 * Strategy (3 queries):
 *   Q1 — contacts.findMany(orgId, type, isActive=true) → seed list.
 *   Q2 — journalLine.groupBy({contactId}, _sum:{debit, credit}, where:
 *        contactId IN seed + account.code = control account (CxC for
 *        CLIENTE, CxP for PROVEEDOR) + journalEntry.organizationId +
 *        journalEntry.status="POSTED"). openBalance = sum(debit) -
 *        sum(credit) para CLIENTE (cuenta activo deudora); inverso para
 *        PROVEEDOR (cuenta pasivo acreedora).
 *   Q3 — journalLine.findMany(orgId via journalEntry, contactId IN seed)
 *        select journalEntry.date — reduced client-side to MAX per
 *        contactId.
 *
 * Q2 deriva del LIBRO MAYOR CONTABLE (no de los auxiliares CxC/CxP) para
 * que el "Total Bs" del dashboard coincida con el running balance del
 * libro mayor por contacto. Si solo sumamos AR/AP.balance, los asientos
 * manuales sin auxiliar (sourceType=null) no se contarían y el dashboard
 * diverge del detalle. Bug-fix post-QA: dashboard mostraba 2.500 cuando
 * el libro mayor terminaba en 2.964 por una fila "Ajuste - Sin auxiliar".
 *
 * DEC-1 boundary: all monetary `Prisma.Decimal` are stringified at the
 * adapter boundary (no Decimal objects leak into the application layer).
 *
 * Sort/pagination: applied AFTER the join+reduce — necessary because the
 * sort key `openBalance` is computed (not a column on contacts), and
 * `lastMovementDate` derives from a related table.
 *
 * TODO (perf): `JournalLine.contactId` lacks an explicit (organizationId,
 * contactId) index (organizationId lives on JournalEntry, not JournalLine).
 * Para large datasets considerar índice compuesto via futura migration.
 */
export class PrismaContactsLedgerDashboardAdapter
  implements ContactsLedgerDashboardPort
{
  constructor(
    private readonly db: DbClient = prisma,
    private readonly orgSettings: OrgSettingsService = makeOrgSettingsService(),
  ) {}

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

    // Q2 — aggregate open balance per contact desde el LIBRO MAYOR CONTABLE
    // (no desde AR/AP). Lee el código de la cuenta de control (CxC para
    // CLIENTE, CxP para PROVEEDOR) de OrgSettings y filtra journalLine por
    // ese account.code + JE.status="POSTED" (mismo invariante que el libro
    // mayor por contacto). openBalance es debit-credit para CLIENTE
    // (activo, saldo deudor) e inverso para PROVEEDOR (pasivo, acreedor).
    const settings = (
      await this.orgSettings.getOrCreate(organizationId)
    ).toSnapshot();
    const controlAccountCode =
      type === "CLIENTE" ? settings.cxcAccountCode : settings.cxpAccountCode;

    const openByContact = new Map<string, string>();
    const sums = await this.db.journalLine.groupBy({
      by: ["contactId"],
      where: {
        contactId: { in: contactIds },
        account: { code: controlAccountCode },
        journalEntry: {
          organizationId,
          status: { in: [...FINALIZED_JE_STATUSES] },
        },
      },
      _sum: { debit: true, credit: true },
    });
    for (const r of sums) {
      if (!r.contactId) continue;
      const debit = Number(r._sum.debit?.toString() ?? "0");
      const credit = Number(r._sum.credit?.toString() ?? "0");
      const balance = type === "CLIENTE" ? debit - credit : credit - debit;
      openByContact.set(r.contactId, balance.toFixed(2));
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
