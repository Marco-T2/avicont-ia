import type { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { Prisma } from "@/generated/prisma/client";
import type { IvaBookForEntry } from "@/modules/sale/domain/build-sale-entry-lines";
import type { IvaBookRegenNotifierPort } from "@/modules/sale/domain/ports/iva-book-regen-notifier.port";

/**
 * Hybrid tx-aware bridge: delegates `recomputeFromSaleCascade` to legacy
 * `IvaBooksService` (preserva regla #1 fidelidad — calcTotales + Decimal
 * mutation in-tx), then narrows the recomputed row to `IvaBookForEntry`
 * via post-call findFirst (mirror `extractIvaBookForEntry:132-137`).
 *
 * §13 emergente E-5.b (POC #11.0a A3 Ciclo 5c): drift contract real — port
 * `recomputeFromSale` retorna `IvaBookForEntry | null`, legacy retorna void.
 * Híbrida (NO Opción β puro como 5a/5b) porque legacy SÍ tiene el método
 * tx-aware con la lógica de cálculo IVA — preservar es asimetría justificada
 * vs ausencia método legacy en D-1/D-2.
 *
 * Post-call findFirst SIN status filter — paridad bit-exact con legacy
 * `recomputeFromSaleCascade:565` (que tampoco filtra). Decisión Marco POC
 * #11.0a A5 β Ciclo 1 (b): adapter NO inventa "defensive" filter; legacy
 * bug latente (mutate VOIDED) se arregla en POC dedicado, no via mejora
 * unilateral del adapter. Precedente Ciclo 3 getNextSequenceNumber.
 *
 * **POC #11.0c A4-c C1 cycle-break (Opción α lockeada Marco)**: ctor
 * recibe `ivaServiceFactory: () => IvaBooksService` (callback) en lugar
 * de instance resolved — preparación pre-cutover C2 contra recursión TDZ
 * `makeSaleService → makeIvaBookService → makeSaleService`. Body delegate
 * sigue legacy 4-arg en C1; C2 cuts ctor type a hex `IvaBookService` +
 * delegate hex `(input, scope)`. Single-instance via memoización en iva
 * comp-root (paridad POC #10).
 *
 * Retirada §5.5 — POC #11.0c cuando IVA-hex se subscribe a sale event o
 * lee de projected snapshot.
 */
export class PrismaIvaBookRegenNotifierAdapter implements IvaBookRegenNotifierPort {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly ivaServiceFactory: () => IvaBooksService,
  ) {}

  async recomputeFromSale(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null> {
    await this.ivaServiceFactory().recomputeFromSaleCascade(
      this.tx,
      organizationId,
      saleId,
      new Prisma.Decimal(newTotal),
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
