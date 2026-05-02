import type { Prisma } from "@/generated/prisma/client";
import type { IvaBookVoidCascadePort } from "@/modules/purchase/domain/ports/iva-book-void-cascade.port";

/**
 * Prisma-direct void-cascade writer: marks the linked `iva_purchase_books`
 * row as VOIDED when the purchase is voided. Mirror exacto legacy
 * `voidCascadeTx purchase.service.ts:1361-1367` (regla #1 fidelidad
 * bit-exact). Skip-update branch when row not found or already VOIDED.
 *
 * §13 emergente E-5.a-purchase (POC #11.0b A3 Ciclo 5b): Opción β Prisma
 * directo, NO wrap-thin shim — `IvaBooksService.markVoidedFromPurchase` no
 * existe (legacy escribe `tx.ivaPurchaseBook.update` directo en cascade
 * purchase-side). Retirada §5.5 — POC #11.0c. (Legacy `IvaBooksService`
 * deleted POC siguiente A2-C3, engram `poc-siguiente/a2/c3/closed` — adapter
 * Prisma directo permanece como implementación final hex.)
 *
 * Paridad regla #1: `findUnique({where:{purchaseId}})` SIN filter
 * `organizationId` (mirror legacy bit-exact `:1361`). `_organizationId`
 * queda anotado como D1 drift candidate auditoría POC #11.0b end (mirror
 * sale 5b D1 label).
 */
export class PrismaIvaBookVoidCascadeAdapter implements IvaBookVoidCascadePort {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async markVoidedFromPurchase(
    _organizationId: string,
    purchaseId: string,
  ): Promise<void> {
    const ivaBook = await this.tx.ivaPurchaseBook.findUnique({
      where: { purchaseId },
    });
    if (ivaBook && ivaBook.status !== "VOIDED") {
      await this.tx.ivaPurchaseBook.update({
        where: { id: ivaBook.id },
        data: { status: "VOIDED" },
      });
    }
  }
}
