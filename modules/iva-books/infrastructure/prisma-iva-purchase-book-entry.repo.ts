import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import { TASA_IVA } from "../domain/compute-iva-totals";
import {
  IvaPurchaseBookEntry,
  type IvaPurchaseBookEntryProps,
} from "../domain/iva-purchase-book-entry.entity";
import type { IvaPurchaseBookEntryRepository } from "../domain/ports/iva-purchase-book-entry-repository.port";
import { parseIvaBookStatus } from "../domain/value-objects/iva-book-status";
import { IvaCalcResult } from "../domain/value-objects/iva-calc-result";

type DbClient = Pick<PrismaClient, "ivaPurchaseBook">;

type IvaPurchaseBookRow = Prisma.IvaPurchaseBookGetPayload<Record<string, never>>;

/**
 * Tx-aware Prisma repository for `IvaPurchaseBookEntry` aggregate. Hydrate
 * full (12 Decimal → MonetaryAmount + IvaCalcResult VO reconstruct +
 * tipoCompra raw int + status VO + header pass-through). Persist legacy
 * parity: `dfIva = entry.calcResult.ivaAmount.value` y `tasaIva = TASA_IVA
 * = 0.13` (mirror legacy `iva-books.service.ts:63-64`, fidelidad regla #1).
 *
 * Mirror simétrico de `PrismaIvaSalesBookEntryRepo` con diffs:
 * - `nitProveedor` (no `nitCliente`)
 * - `tipoCompra: number` raw int (no `estadoSIN` VO)
 * - `findByPurchaseIdTx` (no `findBySaleIdTx`)
 *
 * Constructor flexible mirror A1 purchase-hex (`db: DbClient = prisma`):
 * tx-bound dentro de `IvaBookUnitOfWork.run` callback, default `prisma`
 * para tests no-tx.
 */
export class PrismaIvaPurchaseBookEntryRepo
  implements IvaPurchaseBookEntryRepository
{
  constructor(private readonly db: DbClient = prisma) {}

  async findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<IvaPurchaseBookEntry | null> {
    const row = await this.db.ivaPurchaseBook.findFirst({
      where: { id, organizationId },
    });
    return row ? hydrateFromRow(row) : null;
  }

  async findByPurchaseIdTx(
    organizationId: string,
    purchaseId: string,
  ): Promise<IvaPurchaseBookEntry | null> {
    const row = await this.db.ivaPurchaseBook.findFirst({
      where: { purchaseId, organizationId },
    });
    return row ? hydrateFromRow(row) : null;
  }

  async saveTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry> {
    await this.db.ivaPurchaseBook.create({ data: toCreateInput(entry) });
    return entry;
  }

  async updateTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry> {
    await this.db.ivaPurchaseBook.update({
      where: { id: entry.id },
      data: toUpdateData(entry),
    });
    return entry;
  }
}

function hydrateFromRow(row: IvaPurchaseBookRow): IvaPurchaseBookEntry {
  const props: IvaPurchaseBookEntryProps = {
    id: row.id,
    organizationId: row.organizationId,
    fiscalPeriodId: row.fiscalPeriodId,
    purchaseId: row.purchaseId,
    fechaFactura: row.fechaFactura,
    nitProveedor: row.nitProveedor,
    razonSocial: row.razonSocial,
    numeroFactura: row.numeroFactura,
    codigoAutorizacion: row.codigoAutorizacion,
    codigoControl: row.codigoControl,
    tipoCompra: row.tipoCompra,
    notes: row.notes,
    inputs: {
      importeTotal: MonetaryAmount.of(row.importeTotal.toString()),
      importeIce: MonetaryAmount.of(row.importeIce.toString()),
      importeIehd: MonetaryAmount.of(row.importeIehd.toString()),
      importeIpj: MonetaryAmount.of(row.importeIpj.toString()),
      tasas: MonetaryAmount.of(row.tasas.toString()),
      otrosNoSujetos: MonetaryAmount.of(row.otrosNoSujetos.toString()),
      exentos: MonetaryAmount.of(row.exentos.toString()),
      tasaCero: MonetaryAmount.of(row.tasaCero.toString()),
      codigoDescuentoAdicional: MonetaryAmount.of(
        row.codigoDescuentoAdicional.toString(),
      ),
      importeGiftCard: MonetaryAmount.of(row.importeGiftCard.toString()),
    },
    calcResult: IvaCalcResult.of({
      subtotal: MonetaryAmount.of(row.subtotal.toString()),
      baseImponible: MonetaryAmount.of(row.baseIvaSujetoCf.toString()),
      ivaAmount: MonetaryAmount.of(row.dfCfIva.toString()),
    }),
    status: parseIvaBookStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return IvaPurchaseBookEntry.fromPersistence(props);
}

function toCreateInput(
  entry: IvaPurchaseBookEntry,
): Prisma.IvaPurchaseBookUncheckedCreateInput {
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    fiscalPeriodId: entry.fiscalPeriodId,
    purchaseId: entry.purchaseId,
    fechaFactura: entry.fechaFactura,
    nitProveedor: entry.nitProveedor,
    razonSocial: entry.razonSocial,
    numeroFactura: entry.numeroFactura,
    codigoAutorizacion: entry.codigoAutorizacion,
    codigoControl: entry.codigoControl,
    importeTotal: new Prisma.Decimal(entry.inputs.importeTotal.value),
    importeIce: new Prisma.Decimal(entry.inputs.importeIce.value),
    importeIehd: new Prisma.Decimal(entry.inputs.importeIehd.value),
    importeIpj: new Prisma.Decimal(entry.inputs.importeIpj.value),
    tasas: new Prisma.Decimal(entry.inputs.tasas.value),
    otrosNoSujetos: new Prisma.Decimal(entry.inputs.otrosNoSujetos.value),
    exentos: new Prisma.Decimal(entry.inputs.exentos.value),
    tasaCero: new Prisma.Decimal(entry.inputs.tasaCero.value),
    subtotal: new Prisma.Decimal(entry.calcResult.subtotal.value),
    dfIva: new Prisma.Decimal(entry.calcResult.ivaAmount.value),
    codigoDescuentoAdicional: new Prisma.Decimal(
      entry.inputs.codigoDescuentoAdicional.value,
    ),
    importeGiftCard: new Prisma.Decimal(entry.inputs.importeGiftCard.value),
    baseIvaSujetoCf: new Prisma.Decimal(entry.calcResult.baseImponible.value),
    dfCfIva: new Prisma.Decimal(entry.calcResult.ivaAmount.value),
    tasaIva: new Prisma.Decimal(TASA_IVA),
    tipoCompra: entry.tipoCompra,
    status: entry.status,
    notes: entry.notes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function toUpdateData(
  entry: IvaPurchaseBookEntry,
): Prisma.IvaPurchaseBookUncheckedUpdateInput {
  return {
    purchaseId: entry.purchaseId,
    fechaFactura: entry.fechaFactura,
    nitProveedor: entry.nitProveedor,
    razonSocial: entry.razonSocial,
    numeroFactura: entry.numeroFactura,
    codigoAutorizacion: entry.codigoAutorizacion,
    codigoControl: entry.codigoControl,
    importeTotal: new Prisma.Decimal(entry.inputs.importeTotal.value),
    importeIce: new Prisma.Decimal(entry.inputs.importeIce.value),
    importeIehd: new Prisma.Decimal(entry.inputs.importeIehd.value),
    importeIpj: new Prisma.Decimal(entry.inputs.importeIpj.value),
    tasas: new Prisma.Decimal(entry.inputs.tasas.value),
    otrosNoSujetos: new Prisma.Decimal(entry.inputs.otrosNoSujetos.value),
    exentos: new Prisma.Decimal(entry.inputs.exentos.value),
    tasaCero: new Prisma.Decimal(entry.inputs.tasaCero.value),
    subtotal: new Prisma.Decimal(entry.calcResult.subtotal.value),
    dfIva: new Prisma.Decimal(entry.calcResult.ivaAmount.value),
    codigoDescuentoAdicional: new Prisma.Decimal(
      entry.inputs.codigoDescuentoAdicional.value,
    ),
    importeGiftCard: new Prisma.Decimal(entry.inputs.importeGiftCard.value),
    baseIvaSujetoCf: new Prisma.Decimal(entry.calcResult.baseImponible.value),
    dfCfIva: new Prisma.Decimal(entry.calcResult.ivaAmount.value),
    tasaIva: new Prisma.Decimal(TASA_IVA),
    tipoCompra: entry.tipoCompra,
    status: entry.status,
    notes: entry.notes,
  };
}
