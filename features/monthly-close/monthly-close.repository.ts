import type { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";

type EntityType = "dispatch" | "payment" | "journalEntry";
type EntityStatus = "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";

interface VoucherTypeSummary {
  code: string;
  name: string;
  count: number;
  totalDebit: number;
}

export class MonthlyCloseRepository extends BaseRepository {
  // ── Count entities by status in a period ──

  async countByStatus(
    organizationId: string,
    periodId: string,
    entityType: EntityType,
    status: EntityStatus,
  ): Promise<number> {
    const scope = this.requireOrg(organizationId);

    switch (entityType) {
      case "dispatch":
        return this.db.dispatch.count({
          where: { periodId, status, ...scope },
        });
      case "payment":
        return this.db.payment.count({
          where: { periodId, status, ...scope },
        });
      case "journalEntry":
        return this.db.journalEntry.count({
          where: { periodId, status, ...scope },
        });
    }
  }

  // ── Lock POSTED dispatches in a period ──

  async lockDispatches(
    tx: Prisma.TransactionClient,
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const scope = this.requireOrg(organizationId);

    const result = await tx.dispatch.updateMany({
      where: { periodId, status: "POSTED", ...scope },
      data: { status: "LOCKED" },
    });

    return result.count;
  }

  // ── Lock POSTED payments in a period ──

  async lockPayments(
    tx: Prisma.TransactionClient,
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const scope = this.requireOrg(organizationId);

    const result = await tx.payment.updateMany({
      where: { periodId, status: "POSTED", ...scope },
      data: { status: "LOCKED" },
    });

    return result.count;
  }

  // ── Lock POSTED journal entries in a period ──

  async lockJournalEntries(
    tx: Prisma.TransactionClient,
    organizationId: string,
    periodId: string,
  ): Promise<number> {
    const scope = this.requireOrg(organizationId);

    const result = await tx.journalEntry.updateMany({
      where: { periodId, status: "POSTED", ...scope },
      data: { status: "LOCKED" },
    });

    return result.count;
  }

  // ── Journal summary grouped by voucher type ──

  async getJournalSummaryByVoucherType(
    organizationId: string,
    periodId: string,
  ): Promise<VoucherTypeSummary[]> {
    const scope = this.requireOrg(organizationId);

    const entries = await this.db.journalEntry.findMany({
      where: { periodId, status: "POSTED", ...scope },
      select: {
        voucherType: { select: { code: true, name: true } },
        lines: { select: { debit: true } },
      },
    });

    // Aggregate by voucher type
    const map = new Map<string, VoucherTypeSummary>();

    for (const entry of entries) {
      const key = entry.voucherType.code;
      const existing = map.get(key);
      const entryDebitTotal = entry.lines.reduce(
        (sum, line) => sum + Number(line.debit),
        0,
      );

      if (existing) {
        existing.count += 1;
        existing.totalDebit += entryDebitTotal;
      } else {
        map.set(key, {
          code: entry.voucherType.code,
          name: entry.voucherType.name,
          count: 1,
          totalDebit: entryDebitTotal,
        });
      }
    }

    return Array.from(map.values());
  }

  // ── Close the fiscal period ──

  async closePeriod(
    tx: Prisma.TransactionClient,
    organizationId: string,
    periodId: string,
  ): Promise<void> {
    const scope = this.requireOrg(organizationId);

    await tx.fiscalPeriod.update({
      where: { id: periodId, ...scope },
      data: { status: "CLOSED" },
    });
  }
}
