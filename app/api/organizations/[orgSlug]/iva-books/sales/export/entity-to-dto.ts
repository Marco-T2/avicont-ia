import "server-only";

import { TASA_IVA } from "@/features/accounting/iva-books/iva-books.service";
import type { IvaSalesBookDTO } from "@/features/accounting/iva-books/iva-books.types";
import { Prisma } from "@/generated/prisma/client";
import type { IvaSalesBookEntry } from "@/modules/iva-books/domain/iva-sales-book-entry.entity";

/**
 * Mapper hex domain entity → legacy DTO bridge para legacy XLSX exporter.
 *
 * **POC #11.0c A4-c C2 GREEN P3 lockeada Marco** — necesario porque hex
 * `IvaBookService.listSalesByPeriod` retorna `IvaSalesBookEntry[]` (domain),
 * pero `exportIvaBookExcel(kind, entries: IvaSalesBookDTO[], periodLabel)`
 * legacy obliga DTO. Bridge transforma 4 conversion types:
 *
 *   1. `Date → string` (ISO YYYY-MM-DD via `.toISOString().split('T')[0]`)
 *   2. `string | null → string?` (`?? undefined` para saleId/notes)
 *   3. `MonetaryAmount → Prisma.Decimal` (10 inputs + 4 calcResult derivados)
 *   4. `IvaCalcResult flatten + renames`: `baseImponible → baseIvaSujetoCf`,
 *      `ivaAmount → {dfCfIva, dfIva}` (DTO duplica ivaAmount en 2 campos),
 *      `tasaIva` constante INJECTADA — NO existe en `IvaCalcResult` VO,
 *      `TASA_IVA` importado del legacy `iva-books.service.ts:18` (P3.4 lock,
 *      single source of truth hasta retirement final del legacy class).
 *
 * Per-row + batch wrapper (P3.1 lock): `entityToDto(entry)` per-row
 * unit-testable, `entriesToDto(entries[])` batch composable. Separate
 * file per kind (P3.2 lock) — purchase mirror tiene asimetrías
 * (nitProveedor + tipoCompra, NO estadoSIN) que NO encajan en type-overload
 * sin union types frágiles.
 *
 * Location archivo dedicado app/api per route (P3.3 lock A4-c #2 preserved).
 */

const D = (n: number): Prisma.Decimal => new Prisma.Decimal(n);

export function entityToDto(entry: IvaSalesBookEntry): IvaSalesBookDTO {
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    fiscalPeriodId: entry.fiscalPeriodId,
    saleId: entry.saleId ?? undefined,
    fechaFactura: entry.fechaFactura.toISOString().split("T")[0],
    nitCliente: entry.nitCliente,
    razonSocial: entry.razonSocial,
    numeroFactura: entry.numeroFactura,
    codigoAutorizacion: entry.codigoAutorizacion,
    codigoControl: entry.codigoControl,
    estadoSIN: entry.estadoSIN,
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

export function entriesToDto(entries: IvaSalesBookEntry[]): IvaSalesBookDTO[] {
  return entries.map(entityToDto);
}
