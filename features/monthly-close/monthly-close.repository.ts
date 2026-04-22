import "server-only";
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
  // ── Contar entidades por estado en un período ──

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

  // ── Contar borradores por entidad en un período ──

  async countDraftDocuments(
    organizationId: string,
    periodId: string,
  ): Promise<{ dispatches: number; payments: number; journalEntries: number }> {
    const scope = this.requireOrg(organizationId);

    const [dispatches, payments, journalEntries] = await Promise.all([
      this.db.dispatch.count({
        where: { periodId, status: "DRAFT", ...scope },
      }),
      this.db.payment.count({
        where: { periodId, status: "DRAFT", ...scope },
      }),
      this.db.journalEntry.count({
        where: { periodId, status: "DRAFT", ...scope },
      }),
    ]);

    return { dispatches, payments, journalEntries };
  }

  // ── Bloquear despachos POSTED en un período ──

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

  // ── Bloquear pagos POSTED en un período ──

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

  // ── Bloquear asientos contables POSTED en un período ──

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

  // ── Resumen de asientos agrupados por tipo de comprobante ──

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

    // Agregar por tipo de comprobante
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

  // ── Cerrar el período fiscal ──

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
