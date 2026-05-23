import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type {
  ReceivablesPort,
  ReceivableStatusValue,
  ReceivableGlosaMeta,
} from "../../domain/ports/receivables.port";
import { makeReceivablesService } from "@/modules/receivables/presentation/server";

/**
 * Adapter wrapping the receivables module's application service. The service
 * exposes `applyAllocation` / `revertAllocation` (Fase B) tx-aware use cases —
 * we just translate the call. Status reads use a bare Prisma query in lieu of
 * a dedicated `findStatusByIdTx` on the receivables repo (kept narrow to
 * avoid scope creep into receivables in this POC).
 */
export class LegacyReceivablesAdapter implements ReceivablesPort {
  private readonly service = makeReceivablesService();

  async getStatusByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<ReceivableStatusValue | null> {
    const row = await (tx as Prisma.TransactionClient).accountsReceivable.findFirst(
      {
        where: { id, organizationId },
        select: { status: true },
      },
    );
    return (row?.status as ReceivableStatusValue | undefined) ?? null;
  }

  async getContactIdByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<string | null> {
    const row = await (tx as Prisma.TransactionClient).accountsReceivable.findFirst(
      {
        where: { id, organizationId },
        select: { contactId: true },
      },
    );
    return row?.contactId ?? null;
  }

  async applyAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    await this.service.applyAllocation(tx, organizationId, id, amount);
  }

  async revertAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    await this.service.revertAllocation(tx, organizationId, id, amount);
  }

  /**
   * Resolves per-AR metadata for the COBRO glosa builder (REQ-GE-2 LOOKUP-B).
   * Reads denormalised `sourceTypeCode` directly from AccountsReceivable and
   * JOINs to Sale/Dispatch via `sourceId` to obtain `referenceNumber` +
   * `sourceDate`. Orphan rows (source-doc deleted) silently omitted from the
   * result — the builder falls back to "DOC-<refNo>" for NULL sourceTypeCode,
   * and the caller relies on `findGlosaMetaTx` being orphan-tolerant.
   *
   * Implementation note: Prisma client casts to TransactionClient; uses
   * `findMany` with WHERE id IN [...] for batching. Sale/Dispatch joins are
   * separate findMany calls keyed by sourceId — keeps query plans simple and
   * avoids relying on a polymorphic relation that does not exist in the
   * schema (AccountsReceivable.sourceType discriminates "sale" vs "dispatch"
   * but there is no FK).
   */
  async findGlosaMetaTx(
    tx: unknown,
    organizationId: string,
    arIds: string[],
  ): Promise<ReceivableGlosaMeta[]> {
    if (arIds.length === 0) return [];
    const client = tx as Prisma.TransactionClient;
    const ars = await client.accountsReceivable.findMany({
      where: { id: { in: arIds }, organizationId },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        sourceTypeCode: true,
      },
    });

    const saleIds = ars
      .filter((a) => a.sourceType === "sale" && a.sourceId)
      .map((a) => a.sourceId as string);
    const dispatchIds = ars
      .filter((a) => a.sourceType === "dispatch" && a.sourceId)
      .map((a) => a.sourceId as string);

    const [sales, dispatches] = await Promise.all([
      saleIds.length === 0
        ? Promise.resolve([])
        : client.sale.findMany({
            where: { id: { in: saleIds }, organizationId },
            select: { id: true, referenceNumber: true, date: true },
          }),
      dispatchIds.length === 0
        ? Promise.resolve([])
        : client.dispatch.findMany({
            where: { id: { in: dispatchIds }, organizationId },
            select: { id: true, referenceNumber: true, date: true },
          }),
    ]);
    const saleById = new Map(sales.map((s) => [s.id, s]));
    const dispatchById = new Map(dispatches.map((d) => [d.id, d]));

    const out: ReceivableGlosaMeta[] = [];
    for (const ar of ars) {
      if (!ar.sourceId) continue;
      let row: { referenceNumber: number | null; date: Date } | undefined;
      if (ar.sourceType === "sale") row = saleById.get(ar.sourceId);
      else if (ar.sourceType === "dispatch") row = dispatchById.get(ar.sourceId);
      if (!row) continue;
      out.push({
        id: ar.id,
        sourceTypeCode: ar.sourceTypeCode ?? null,
        referenceNumber: String(row.referenceNumber ?? ""),
        sourceDate: row.date,
      });
    }
    return out;
  }
}
