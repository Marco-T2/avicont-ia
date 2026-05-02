import type { Prisma } from "@/generated/prisma/client";
import type { IvaBookVoidCascadePort } from "@/modules/sale/domain/ports/iva-book-void-cascade.port";

/**
 * Prisma-direct void-cascade writer: marks the linked `iva_sales_books` row
 * as VOIDED when the sale is voided. Mirror exacto legacy
 * `voidCascadeTx:1205-1211` (regla #1 fidelidad bit-exact). Skip-update
 * branch when row not found or already VOIDED.
 *
 * §13 emergente E-5.a (POC #11.0a A3 Ciclo 5b): Opción β Prisma directo, NO
 * wrap-thin shim — `IvaBooksService.markVoidedFromSale` no existe. JSDoc del
 * port actualizada en mismo commit (piggyback). Retirada §5.5 — POC #11.0c.
 * (Legacy `IvaBooksService` deleted POC siguiente A2-C3, engram
 * `poc-siguiente/a2/c3/closed` — adapter Prisma directo permanece como
 * implementación final hex.)
 *
 * Paridad regla #1: `findUnique({where:{saleId}})` SIN filter
 * `organizationId` (mirror legacy bit-exact). `_organizationId` queda
 * anotado como D1 drift candidate auditoría POC #11.0a end.
 */
export class PrismaIvaBookVoidCascadeAdapter implements IvaBookVoidCascadePort {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async markVoidedFromSale(
    _organizationId: string,
    saleId: string,
  ): Promise<void> {
    const ivaBook = await this.tx.ivaSalesBook.findUnique({
      where: { saleId },
    });
    if (ivaBook && ivaBook.status !== "VOIDED") {
      await this.tx.ivaSalesBook.update({
        where: { id: ivaBook.id },
        data: { status: "VOIDED" },
      });
    }
  }
}
