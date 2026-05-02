import type { PrismaClient } from "@/generated/prisma/client";
import type {
  IvaBookReaderPort,
  IvaBookSnapshot,
} from "@/modules/purchase/domain/ports/iva-book-reader.port";

/**
 * Prisma-direct reader: hydrates `IvaBookSnapshot` from `iva_purchase_books`
 * by `purchaseId` (@unique global). Filters non-ACTIVE rows (mirror legacy
 * `extractIvaBookForEntry purchase.service.ts:232`).
 *
 * §13 emergente E-5.d-purchase (POC #11.0b A3 Ciclo 5a): Opción β Prisma
 * directo, NO wrap-thin shim — no existe método legacy análogo
 * `findByPurchaseId` en `IvaBooksRepository` (paralelo asimétrico sale 5a:
 * legacy `findSaleById` busca por `IvaSalesBook.id`, no por `Sale.id`).
 * Retirada §5.5 — POC #11.0c. (Legacy `IvaBooksService` y `IvaBooksRepository`
 * deleted POC siguiente A2-C3, engram `poc-siguiente/a2/c3/closed` — adapter
 * Prisma directo permanece como implementación final hex.)
 *
 * Paridad regla #1: `findUnique({where:{purchaseId}})` SIN filter
 * `organizationId` (legacy `voidCascadeTx purchase.service.ts:1361` usa el
 * mismo shape). `_organizationId` queda anotado como D2 drift candidate
 * para auditoría POC #11.0b end (mirror sale 5a D2 label).
 */
export class PrismaIvaBookReaderAdapter implements IvaBookReaderPort {
  constructor(private readonly db: Pick<PrismaClient, "ivaPurchaseBook">) {}

  async getActiveBookForPurchase(
    _organizationId: string,
    purchaseId: string,
  ): Promise<IvaBookSnapshot | null> {
    const row = await this.db.ivaPurchaseBook.findUnique({
      where: { purchaseId },
    });
    if (!row || row.status !== "ACTIVE") return null;
    return {
      id: row.id,
      purchaseId: row.purchaseId!,
      ivaRate: Number(row.tasaIva),
      ivaAmount: Number(row.dfCfIva),
      netAmount: Number(row.baseIvaSujetoCf),
      exentos: Number(row.exentos ?? 0),
    };
  }
}
