import type { IvaBookService } from "@/modules/iva-books/application/iva-book.service";
import type { IvaBookScope } from "@/modules/iva-books/application/iva-book-unit-of-work";
import { Prisma } from "@/generated/prisma/client";
import type { IvaBookForEntry } from "@/modules/purchase/domain/build-purchase-entry-lines";
import type { IvaBookRegenNotifierPort } from "@/modules/purchase/domain/ports/iva-book-regen-notifier.port";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * Hybrid tx-aware bridge: delegates `recomputeFromPurchaseCascade` a hex
 * `IvaBookService` (POC #11.0c A4-c C2 GREEN cutover), then narrows el
 * recomputed row a `IvaBookForEntry` via post-call findFirst (mirror
 * `extractIvaBookForEntry purchase.service.ts:233-238`).
 *
 * §13 emergente E-5.b-purchase (POC #11.0b A3 Ciclo 5c): drift contract
 * real — port `recomputeFromPurchase` retorna `IvaBookForEntry | null`, hex
 * `recomputeFromPurchaseCascade(input, scope): Promise<void>` retorna void.
 * Híbrida (NO Opción β puro) porque hex SÍ tiene el método tx-aware via
 * scope param F-α (POC #11.0c A4-b C2) — preservar es asimetría justificada
 * vs ausencia método legacy en 5a/5b.
 *
 * Post-call findFirst SIN status filter — paridad bit-exact con hex
 * `recomputeFromPurchaseCascade` (que tampoco filtra, mirror legacy
 * `iva-books.service.ts:624`). **POC #11.0c A4-c C2 GREEN P2 (α) lockeada
 * Marco** (precedente sale 5c (b) POC #11.0a A5 β Ciclo 1 + Ciclo 3
 * getNextSequenceNumber): adapter NO inventa "defensive" filter; legacy
 * bug latente (mutate VOIDED) se arregla en POC dedicado.
 *
 * **POC #11.0c A4-c C1 cycle-break mirror sale (Opción α lockeada Marco)**:
 * ctor recibe `ivaServiceFactory: () => IvaBookService` (callback) —
 * preparación pre-cutover C2 contra recursión TDZ `makePurchaseService →
 * makeIvaBookService → makePurchaseService`. Single-instance via
 * memoización en iva comp-root (P4 (ii) lockeada Marco).
 *
 * **POC #11.0c A4-c C2 GREEN P1 (b) scopeFactory injection lockeada Marco**:
 * ctor recibe `ivaScopeFactory: (tx, correlationId) => IvaBookScope` —
 * closure construido por iva root (`makeIvaScopeFactory`) cierra sobre
 * prisma adapters iva-side. CERO cross-module concrete imports en purchase
 * infrastructure (§17 preservado). Body invoca factory(tx, correlationId)
 * para construir scope tx-bound al momento del cascade hex call.
 *
 * Retirada §5.5 — POC #11.0c cuando IVA-hex se subscribe a purchase event
 * o lee de projected snapshot.
 */
export class PrismaIvaBookRegenNotifierAdapter implements IvaBookRegenNotifierPort {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly correlationId: string,
    private readonly ivaServiceFactory: () => IvaBookService,
    private readonly ivaScopeFactory: (
      tx: Prisma.TransactionClient,
      correlationId: string,
    ) => IvaBookScope,
  ) {}

  async recomputeFromPurchase(
    organizationId: string,
    purchaseId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null> {
    const scope = this.ivaScopeFactory(this.tx, this.correlationId);
    await this.ivaServiceFactory().recomputeFromPurchaseCascade(
      {
        organizationId,
        purchaseId,
        newTotal: MonetaryAmount.of(newTotal),
      },
      scope,
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
