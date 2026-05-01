import type { IvaBookService } from "@/modules/iva-books/application/iva-book.service";
import type { IvaBookScope } from "@/modules/iva-books/application/iva-book-unit-of-work";
import { Prisma } from "@/generated/prisma/client";
import type { IvaBookForEntry } from "@/modules/sale/domain/build-sale-entry-lines";
import type { IvaBookRegenNotifierPort } from "@/modules/sale/domain/ports/iva-book-regen-notifier.port";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * Hybrid tx-aware bridge: delegates `recomputeFromSaleCascade` a hex
 * `IvaBookService` (POC #11.0c A4-c C2 GREEN cutover), then narrows el
 * recomputed row a `IvaBookForEntry` via post-call findFirst (mirror
 * `extractIvaBookForEntry:132-137`).
 *
 * §13 emergente E-5.b (POC #11.0a A3 Ciclo 5c): drift contract real — port
 * `recomputeFromSale` retorna `IvaBookForEntry | null`, hex
 * `recomputeFromSaleCascade(input, scope): Promise<void>` retorna void.
 * Híbrida (NO Opción β puro) porque hex SÍ tiene el método tx-aware via
 * scope param F-α (POC #11.0c A4-b C1) — preservar es asimetría justificada
 * vs ausencia método legacy en D-1/D-2.
 *
 * Post-call findFirst SIN status filter — paridad bit-exact con hex
 * `recomputeFromSaleCascade` (que tampoco filtra, mirror legacy
 * `iva-books.service.ts:565`). **POC #11.0c A4-c C2 GREEN P2 (α) lockeada
 * Marco**: minimal blast radius, mirror legacy bit-exact preserved post-
 * cutover hex. Adapter NO inventa "defensive" filter; legacy bug latente
 * (mutate VOIDED) se arregla en POC dedicado, no via mejora unilateral del
 * adapter. Precedente Ciclo 3 getNextSequenceNumber.
 *
 * **POC #11.0c A4-c C1 cycle-break (Opción α lockeada Marco)**: ctor
 * recibe `ivaServiceFactory: () => IvaBookService` (callback) — preparación
 * pre-cutover C2 contra recursión TDZ `makeSaleService → makeIvaBookService
 * → makeSaleService`. Single-instance via memoización en iva comp-root
 * (P4 (ii) lockeada Marco — cumple intent Opción α single-instance).
 *
 * **POC #11.0c A4-c C2 GREEN P1 (b) scopeFactory injection lockeada Marco**:
 * ctor recibe `ivaScopeFactory: (tx, correlationId) => IvaBookScope` —
 * closure construido por iva root (`makeIvaScopeFactory`) cierra sobre
 * prisma adapters iva-side. CERO cross-module concrete imports en sale
 * infrastructure (§17 preservado). Body invoca factory(tx, correlationId)
 * para construir scope tx-bound al momento del cascade hex call.
 *
 * Retirada §5.5 — POC #11.0c cuando IVA-hex se subscribe a sale event o
 * lee de projected snapshot.
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

  async recomputeFromSale(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null> {
    const scope = this.ivaScopeFactory(this.tx, this.correlationId);
    await this.ivaServiceFactory().recomputeFromSaleCascade(
      {
        organizationId,
        saleId,
        newTotal: MonetaryAmount.of(newTotal),
      },
      scope,
    );
    const recomputed = await this.tx.ivaSalesBook.findFirst({
      where: { saleId, organizationId },
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
