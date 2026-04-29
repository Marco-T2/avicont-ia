import type { PrismaClient } from "@/generated/prisma/client";
import type {
  IvaBookReaderPort,
  IvaBookSnapshot,
} from "@/modules/sale/domain/ports/iva-book-reader.port";

/**
 * Prisma-direct reader: hydrates `IvaBookSnapshot` from `iva_sales_books` by
 * `saleId` (@unique global). Filters non-ACTIVE rows (mirror legacy
 * `extractIvaBookForEntry:131`).
 *
 * §13 emergente E-5.d (POC #11.0a A3 Ciclo 5a): Opción β Prisma directo, NO
 * wrap-thin shim — legacy `IvaBooksService.findSaleById(orgId, id)` busca por
 * `IvaSalesBook.id`, no por `Sale.id`, y no existe método público
 * `findBySaleId`. Retirada §5.5 — POC #11.0c.
 *
 * Paridad regla #1: `findUnique({where:{saleId}})` SIN filter `organizationId`
 * (legacy `voidCascadeTx:1205` usa el mismo shape). `organizationId` queda
 * anotado como D2 drift candidate para auditoría POC #11.0a end.
 */
export class PrismaIvaBookReaderAdapter implements IvaBookReaderPort {
  constructor(private readonly db: Pick<PrismaClient, "ivaSalesBook">) {}

  async getActiveBookForSale(
    _organizationId: string,
    saleId: string,
  ): Promise<IvaBookSnapshot | null> {
    const row = await this.db.ivaSalesBook.findUnique({ where: { saleId } });
    if (!row || row.status !== "ACTIVE") return null;
    return {
      id: row.id,
      saleId: row.saleId!,
      ivaRate: Number(row.tasaIva),
      ivaAmount: Number(row.dfCfIva),
      netAmount: Number(row.baseIvaSujetoCf),
      exentos: Number(row.exentos ?? 0),
    };
  }
}
