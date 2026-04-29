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
 * Retirada §5.5 — POC #11.0c cuando IVA-hex se subscribe a sale event o
 * lee de projected snapshot.
 */
export class PrismaIvaBookRegenNotifierAdapter implements IvaBookRegenNotifierPort {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly legacyService: IvaBooksService,
  ) {}

  async recomputeFromSale(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null> {
    await this.legacyService.recomputeFromSaleCascade(
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
