import type { IvaSalesBookEntryInputs } from "../domain/iva-sales-book-entry.entity";
import { IvaSalesBookEntry } from "../domain/iva-sales-book-entry.entity";
import type { IvaPurchaseBookEntryInputs } from "../domain/iva-purchase-book-entry.entity";
import { IvaPurchaseBookEntry } from "../domain/iva-purchase-book-entry.entity";
import type { IvaSalesEstadoSIN } from "../domain/value-objects/iva-sales-estado-sin";
import { IvaBookFiscalPeriodClosed } from "../domain/errors/iva-book-errors";
import { computeIvaTotals } from "../domain/compute-iva-totals";
import type { IvaBookUnitOfWork } from "./iva-book-unit-of-work";
import type { FiscalPeriodReaderPort } from "../domain/ports/fiscal-period-reader.port";
import type { SaleReaderPort } from "../domain/ports/sale-reader.port";
import type { PurchaseReaderPort } from "../domain/ports/purchase-reader.port";
import type { SaleJournalRegenNotifierPort } from "../domain/ports/sale-journal-regen-notifier.port";
import type { PurchaseJournalRegenNotifierPort } from "../domain/ports/purchase-journal-regen-notifier.port";

export interface IvaBookServiceDeps {
  uow: IvaBookUnitOfWork;
  fiscalPeriods: FiscalPeriodReaderPort;
  saleReader: SaleReaderPort;
  purchaseReader: PurchaseReaderPort;
  saleJournalRegenNotifier: SaleJournalRegenNotifierPort;
  purchaseJournalRegenNotifier: PurchaseJournalRegenNotifierPort;
}

export interface RegenerateIvaSalesBookInput {
  organizationId: string;
  userId: string;
  fiscalPeriodId: string;
  saleId?: string;
  fechaFactura: Date;
  nitCliente: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  estadoSIN: IvaSalesEstadoSIN;
  notes?: string | null;
  inputs: IvaSalesBookEntryInputs;
}

export interface RegenerateIvaSalesBookResult {
  entry: IvaSalesBookEntry;
  correlationId: string;
}

export interface RegenerateIvaPurchaseBookInput {
  organizationId: string;
  userId: string;
  fiscalPeriodId: string;
  purchaseId?: string;
  fechaFactura: Date;
  nitProveedor: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  tipoCompra: number;
  notes?: string | null;
  inputs: IvaPurchaseBookEntryInputs;
}

export interface RegenerateIvaPurchaseBookResult {
  entry: IvaPurchaseBookEntry;
  correlationId: string;
}

/**
 * IVA-hex application service. Orchestra los use cases inbound A2:
 * regenerate / recompute / void / reactivate / applyVoidCascade × {sale,
 * purchase}. Tx-aware via `IvaBookUnitOfWork.run` (B locked single UoW + 2
 * repos), excepto `applyVoidCascade` que recibe scope vía parámetro
 * (F-α locked).
 *
 * **Scope Ciclo 3** — primer use cases entregados:
 * `regenerateSale` + `regeneratePurchase`. Mirror legacy
 * `iva-books.service.ts:230-298` (createPurchase) + `:405-470` (createSale).
 *
 * **Defense-in-depth IVA totals** — los use cases recomputan
 * `IvaCalcResult` server-side via `computeIvaTotals(inputs)` ignorando
 * cualquier `calcResult` cliente-provisto (paridad legacy
 * `computeIvaFields` líneas 28-66).
 *
 * **Period CLOSED gate** — A locked: `FiscalPeriodReader` validado
 * pre-tx para cubrir path sale (sale-hex no valida periodo internamente).
 * Throw condicionado a `linked + POSTED + CLOSED` mirror legacy regla #1
 * (standalone IVA con period CLOSED no lanza — paridad legacy).
 *
 * **Bridge gate** — `JournalRegenNotifier` invocado solo si
 * `linked + POSTED + period OPEN`. NO comparte tx con `IvaBookScope`
 * (D-1 lockeada: bridge regen es side-effect post-UoW; sale-hex falla
 * → IvaBook persiste pero journal queda desincronizado, recuperable
 * por reintento manual).
 */
export class IvaBookService {
  constructor(private readonly deps: IvaBookServiceDeps) {}

  async regenerateSale(
    input: RegenerateIvaSalesBookInput,
  ): Promise<RegenerateIvaSalesBookResult> {
    const period = await this.deps.fiscalPeriods.getById(
      input.organizationId,
      input.fiscalPeriodId,
    );

    let sale = null;
    if (input.saleId) {
      sale = await this.deps.saleReader.getById(
        input.organizationId,
        input.saleId,
      );
    }

    if (sale && sale.status === "POSTED" && period.status !== "OPEN") {
      throw new IvaBookFiscalPeriodClosed({
        entityType: "sale",
        operation: "create",
      });
    }

    const calcResult = computeIvaTotals(input.inputs);

    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = IvaSalesBookEntry.create({
          organizationId: input.organizationId,
          fiscalPeriodId: input.fiscalPeriodId,
          saleId: input.saleId,
          fechaFactura: input.fechaFactura,
          nitCliente: input.nitCliente,
          razonSocial: input.razonSocial,
          numeroFactura: input.numeroFactura,
          codigoAutorizacion: input.codigoAutorizacion,
          codigoControl: input.codigoControl,
          estadoSIN: input.estadoSIN,
          notes: input.notes ?? null,
          inputs: input.inputs,
          calcResult,
        });
        return scope.ivaSalesBooks.saveTx(entry);
      },
    );

    if (sale && sale.status === "POSTED" && period.status === "OPEN") {
      await this.deps.saleJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        input.saleId!,
        input.userId,
      );
    }

    return { entry: result, correlationId };
  }

  async regeneratePurchase(
    input: RegenerateIvaPurchaseBookInput,
  ): Promise<RegenerateIvaPurchaseBookResult> {
    const period = await this.deps.fiscalPeriods.getById(
      input.organizationId,
      input.fiscalPeriodId,
    );

    let purchase = null;
    if (input.purchaseId) {
      purchase = await this.deps.purchaseReader.getById(
        input.organizationId,
        input.purchaseId,
      );
    }

    if (purchase && purchase.status === "POSTED" && period.status !== "OPEN") {
      throw new IvaBookFiscalPeriodClosed({
        entityType: "purchase",
        operation: "create",
      });
    }

    const calcResult = computeIvaTotals(input.inputs);

    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = IvaPurchaseBookEntry.create({
          organizationId: input.organizationId,
          fiscalPeriodId: input.fiscalPeriodId,
          purchaseId: input.purchaseId,
          fechaFactura: input.fechaFactura,
          nitProveedor: input.nitProveedor,
          razonSocial: input.razonSocial,
          numeroFactura: input.numeroFactura,
          codigoAutorizacion: input.codigoAutorizacion,
          codigoControl: input.codigoControl,
          tipoCompra: input.tipoCompra,
          notes: input.notes ?? null,
          inputs: input.inputs,
          calcResult,
        });
        return scope.ivaPurchaseBooks.saveTx(entry);
      },
    );

    if (
      purchase &&
      purchase.status === "POSTED" &&
      period.status === "OPEN"
    ) {
      await this.deps.purchaseJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        input.purchaseId!,
        input.userId,
      );
    }

    return { entry: result, correlationId };
  }
}
