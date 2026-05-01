import type { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { Prisma } from "@/generated/prisma/client";
import type { IvaBookForEntry } from "@/modules/purchase/domain/build-purchase-entry-lines";
import type { IvaBookRegenNotifierPort } from "@/modules/purchase/domain/ports/iva-book-regen-notifier.port";

/**
 * Hybrid tx-aware bridge: delegates `recomputeFromPurchaseCascade` to legacy
 * `IvaBooksService` (preserva regla #1 fidelidad — calcTotales + Decimal
 * mutation in-tx), then narrows the recomputed row to `IvaBookForEntry`
 * via post-call findFirst (mirror `extractIvaBookForEntry
 * purchase.service.ts:233-238`).
 *
 * §13 emergente E-5.b-purchase (POC #11.0b A3 Ciclo 5c): drift contract real
 * — port `recomputeFromPurchase` retorna `IvaBookForEntry | null`, legacy
 * `recomputeFromPurchaseCascade iva-books.service.ts:618` retorna void.
 * Híbrida (NO Opción β puro como 5a/5b) porque legacy SÍ tiene el método
 * tx-aware con la lógica de cálculo IVA — preservar es asimetría justificada
 * vs ausencia método legacy en 5a/5b.
 *
 * Post-call findFirst SIN status filter — paridad bit-exact con legacy
 * `recomputeFromPurchaseCascade:624` (que tampoco filtra). Decisión Marco
 * locked (precedente sale 5c (b) POC #11.0a A5 β Ciclo 1 + Ciclo 3
 * getNextSequenceNumber): adapter NO inventa "defensive" filter; legacy
 * bug latente (mutate VOIDED) se arregla en POC dedicado, no via mejora
 * unilateral del adapter.
 *
 * **POC #11.0c A4-c C1 cycle-break mirror sale (Opción α lockeada Marco)**:
 * ctor recibe `ivaServiceFactory: () => IvaBooksService` (callback) en
 * lugar de instance resolved — preparación pre-cutover C2 contra recursión
 * TDZ `makePurchaseService → makeIvaBookService → makePurchaseService`.
 * Body delegate sigue legacy 4-arg en C1; C2 cuts ctor type a hex +
 * delegate hex `(input, scope)`. Single-instance via memoización en iva
 * comp-root (paridad POC #10).
 *
 * Retirada §5.5 — POC #11.0c cuando IVA-hex se subscribe a purchase event
 * o lee de projected snapshot.
 */
export class PrismaIvaBookRegenNotifierAdapter implements IvaBookRegenNotifierPort {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly ivaServiceFactory: () => IvaBooksService,
  ) {}

  async recomputeFromPurchase(
    organizationId: string,
    purchaseId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null> {
    await this.ivaServiceFactory().recomputeFromPurchaseCascade(
      this.tx,
      organizationId,
      purchaseId,
      new Prisma.Decimal(newTotal),
    );
    const recomputed = await this.tx.ivaPurchaseBook.findFirst({
      where: { purchaseId, organizationId },
    });
    if (!recomputed) return null;
    return {
      baseIvaSujetoCf: Number(recomputed.baseIvaSujetoCf),
      dfCfIva: Number(recomputed.dfCfIva),
      importeTotal: Number(recomputed.importeTotal),
      exentos: Number(recomputed.exentos ?? 0),
    };
  }
}
