import "server-only";

import { TASA_IVA } from "@/modules/iva-books/presentation/server";
import type { IvaPurchaseBookDTO } from "@/modules/iva-books/presentation/server";
import { Prisma } from "@/generated/prisma/client";
import type { IvaPurchaseBookEntry } from "@/modules/iva-books/domain/iva-purchase-book-entry.entity";

/**
 * Mapper hex domain entity → legacy DTO bridge para legacy XLSX exporter.
 *
 * **POC #11.0c A4-c C2 GREEN P3 lockeada Marco** — necesario porque hex
 * `IvaBookService.listPurchasesByPeriod` retorna `IvaPurchaseBookEntry[]`
 * (domain), pero `exportIvaBookExcel(kind, entries: IvaPurchaseBookDTO[],
 * periodLabel)` legacy obliga DTO. Mirror simétrico sale mapper byte-equivalent
 * salvo asimetrías declaradas: `purchaseId` (vs saleId), `nitProveedor`
 * (vs nitCliente), `tipoCompra: number` (vs estadoSIN sale-only). Bridge
 * transforma 4 conversion types (Date→string, null→undefined, MonetaryAmount→
 * Prisma.Decimal, IvaCalcResult flatten + renames + tasaIva injection).
 *
 * Per-row + batch wrapper (P3.1 lock). Separate file per kind (P3.2 lock):
 * sale tiene estadoSIN sale-only; purchase tiene tipoCompra purchase-only —
 * type-overload con union types frágiles, separate files cleaner. Location
 * archivo dedicado app/api per route (P3.3 lock A4-c #2 preserved).
 *
 * `TASA_IVA` constante INJECTADA — NO existe en `IvaCalcResult` VO,
 * importado del legacy `iva-books.service.ts:18` (P3.4 lock, single source
 * of truth hasta retirement final del legacy class).
 */

const D = (n: number): Prisma.Decimal => new Prisma.Decimal(n);

export function entityToDto(entry: IvaPurchaseBookEntry): IvaPurchaseBookDTO {
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    fiscalPeriodId: entry.fiscalPeriodId,
    purchaseId: entry.purchaseId ?? undefined,
    fechaFactura: entry.fechaFactura.toISOString().split("T")[0],
    nitProveedor: entry.nitProveedor,
    razonSocial: entry.razonSocial,
    numeroFactura: entry.numeroFactura,
    codigoAutorizacion: entry.codigoAutorizacion,
    codigoControl: entry.codigoControl,
    tipoCompra: entry.tipoCompra,
    notes: entry.notes ?? undefined,
    importeTotal: D(entry.inputs.importeTotal.value),
    importeIce: D(entry.inputs.importeIce.value),
    importeIehd: D(entry.inputs.importeIehd.value),
    importeIpj: D(entry.inputs.importeIpj.value),
    tasas: D(entry.inputs.tasas.value),
    otrosNoSujetos: D(entry.inputs.otrosNoSujetos.value),
    exentos: D(entry.inputs.exentos.value),
    tasaCero: D(entry.inputs.tasaCero.value),
    codigoDescuentoAdicional: D(entry.inputs.codigoDescuentoAdicional.value),
    importeGiftCard: D(entry.inputs.importeGiftCard.value),
    subtotal: D(entry.calcResult.subtotal.value),
    baseIvaSujetoCf: D(entry.calcResult.baseImponible.value),
    dfCfIva: D(entry.calcResult.ivaAmount.value),
    dfIva: D(entry.calcResult.ivaAmount.value),
    tasaIva: TASA_IVA,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function entriesToDto(
  entries: IvaPurchaseBookEntry[],
): IvaPurchaseBookDTO[] {
  return entries.map(entityToDto);
}
