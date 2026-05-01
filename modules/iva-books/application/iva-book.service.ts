import type { IvaSalesBookEntryInputs } from "../domain/iva-sales-book-entry.entity";
import { IvaSalesBookEntry } from "../domain/iva-sales-book-entry.entity";
import type { IvaPurchaseBookEntryInputs } from "../domain/iva-purchase-book-entry.entity";
import { IvaPurchaseBookEntry } from "../domain/iva-purchase-book-entry.entity";
import type {
  ApplyIvaSalesBookEntryEditInput,
} from "../domain/iva-sales-book-entry.entity";
import type {
  ApplyIvaPurchaseBookEntryEditInput,
} from "../domain/iva-purchase-book-entry.entity";
import type { IvaSalesEstadoSIN } from "../domain/value-objects/iva-sales-estado-sin";
import {
  IvaBookFiscalPeriodClosed,
  IvaBookNotFound,
} from "../domain/errors/iva-book-errors";
import { computeIvaTotals } from "../domain/compute-iva-totals";
import type {
  IvaBookScope,
  IvaBookUnitOfWork,
} from "./iva-book-unit-of-work";
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

export type PartialIvaSalesBookEntryInputs = Partial<IvaSalesBookEntryInputs>;
export type PartialIvaPurchaseBookEntryInputs = Partial<IvaPurchaseBookEntryInputs>;

export interface RecomputeIvaSalesBookInput {
  organizationId: string;
  userId: string;
  id: string;
  fechaFactura?: Date;
  nitCliente?: string;
  razonSocial?: string;
  numeroFactura?: string;
  codigoAutorizacion?: string;
  codigoControl?: string;
  estadoSIN?: IvaSalesEstadoSIN;
  notes?: string | null;
  inputs?: PartialIvaSalesBookEntryInputs;
}

export interface RecomputeIvaSalesBookResult {
  entry: IvaSalesBookEntry;
  correlationId: string;
}

export interface RecomputeIvaPurchaseBookInput {
  organizationId: string;
  userId: string;
  id: string;
  fechaFactura?: Date;
  nitProveedor?: string;
  razonSocial?: string;
  numeroFactura?: string;
  codigoAutorizacion?: string;
  codigoControl?: string;
  tipoCompra?: number;
  notes?: string | null;
  inputs?: PartialIvaPurchaseBookEntryInputs;
}

export interface RecomputeIvaPurchaseBookResult {
  entry: IvaPurchaseBookEntry;
  correlationId: string;
}

export interface VoidIvaSalesBookInput {
  organizationId: string;
  userId: string;
  id: string;
}

export interface VoidIvaSalesBookResult {
  entry: IvaSalesBookEntry;
  correlationId: string;
}

export interface VoidIvaPurchaseBookInput {
  organizationId: string;
  userId: string;
  id: string;
}

export interface VoidIvaPurchaseBookResult {
  entry: IvaPurchaseBookEntry;
  correlationId: string;
}

export interface ReactivateIvaSalesBookInput {
  organizationId: string;
  userId: string;
  id: string;
}

export interface ReactivateIvaSalesBookResult {
  entry: IvaSalesBookEntry;
  correlationId: string;
}

export interface ReactivateIvaPurchaseBookInput {
  organizationId: string;
  userId: string;
  id: string;
}

export interface ReactivateIvaPurchaseBookResult {
  entry: IvaPurchaseBookEntry;
  correlationId: string;
}

export interface ApplyIvaBookVoidCascadeFromSaleInput {
  organizationId: string;
  saleId: string;
}

export interface ApplyIvaBookVoidCascadeFromPurchaseInput {
  organizationId: string;
  purchaseId: string;
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

  async recomputeSale(
    input: RecomputeIvaSalesBookInput,
  ): Promise<RecomputeIvaSalesBookResult> {
    const monetaryChange = hasMonetaryFieldChange(input.inputs);

    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = await scope.ivaSalesBooks.findByIdTx(
          input.organizationId,
          input.id,
        );
        if (!entry) {
          throw new IvaBookNotFound("sale");
        }

        let sale = null;
        let period = null;
        if (entry.saleId) {
          sale = await this.deps.saleReader.getById(
            input.organizationId,
            entry.saleId,
          );
          period = await this.deps.fiscalPeriods.getById(
            input.organizationId,
            entry.fiscalPeriodId,
          );
          if (
            sale &&
            sale.status === "POSTED" &&
            period.status !== "OPEN"
          ) {
            throw new IvaBookFiscalPeriodClosed({
              entityType: "sale",
              operation: "modify",
            });
          }
        }

        let mergedInputs = entry.inputs;
        let calcResult = entry.calcResult;
        if (monetaryChange) {
          mergedInputs = mergeSalesMonetaryInputs(entry.inputs, input.inputs!);
          calcResult = computeIvaTotals(mergedInputs);
        }

        const editInput: ApplyIvaSalesBookEntryEditInput = {
          fechaFactura: input.fechaFactura,
          nitCliente: input.nitCliente,
          razonSocial: input.razonSocial,
          numeroFactura: input.numeroFactura,
          codigoAutorizacion: input.codigoAutorizacion,
          codigoControl: input.codigoControl,
          estadoSIN: input.estadoSIN,
          inputs: monetaryChange ? mergedInputs : undefined,
          calcResult: monetaryChange ? calcResult : undefined,
        };
        if ("notes" in input) editInput.notes = input.notes ?? null;

        const updated = entry.applyEdit(editInput);
        const persisted = await scope.ivaSalesBooks.updateTx(updated);
        return { entry: persisted, sale, period };
      },
    );

    if (
      result.sale &&
      result.sale.status === "POSTED" &&
      result.period?.status === "OPEN"
    ) {
      await this.deps.saleJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        result.entry.saleId!,
        input.userId,
      );
    }

    return { entry: result.entry, correlationId };
  }

  async recomputePurchase(
    input: RecomputeIvaPurchaseBookInput,
  ): Promise<RecomputeIvaPurchaseBookResult> {
    const monetaryChange = hasMonetaryFieldChange(input.inputs);

    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = await scope.ivaPurchaseBooks.findByIdTx(
          input.organizationId,
          input.id,
        );
        if (!entry) {
          throw new IvaBookNotFound("purchase");
        }

        let purchase = null;
        let period = null;
        if (entry.purchaseId) {
          purchase = await this.deps.purchaseReader.getById(
            input.organizationId,
            entry.purchaseId,
          );
          period = await this.deps.fiscalPeriods.getById(
            input.organizationId,
            entry.fiscalPeriodId,
          );
          if (
            purchase &&
            purchase.status === "POSTED" &&
            period.status !== "OPEN"
          ) {
            throw new IvaBookFiscalPeriodClosed({
              entityType: "purchase",
              operation: "modify",
            });
          }
        }

        let mergedInputs = entry.inputs;
        let calcResult = entry.calcResult;
        if (monetaryChange) {
          mergedInputs = mergePurchaseMonetaryInputs(
            entry.inputs,
            input.inputs!,
          );
          calcResult = computeIvaTotals(mergedInputs);
        }

        const editInput: ApplyIvaPurchaseBookEntryEditInput = {
          fechaFactura: input.fechaFactura,
          nitProveedor: input.nitProveedor,
          razonSocial: input.razonSocial,
          numeroFactura: input.numeroFactura,
          codigoAutorizacion: input.codigoAutorizacion,
          codigoControl: input.codigoControl,
          tipoCompra: input.tipoCompra,
          inputs: monetaryChange ? mergedInputs : undefined,
          calcResult: monetaryChange ? calcResult : undefined,
        };
        if ("notes" in input) editInput.notes = input.notes ?? null;

        const updated = entry.applyEdit(editInput);
        const persisted = await scope.ivaPurchaseBooks.updateTx(updated);
        return { entry: persisted, purchase, period };
      },
    );

    if (
      result.purchase &&
      result.purchase.status === "POSTED" &&
      result.period?.status === "OPEN"
    ) {
      await this.deps.purchaseJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        result.entry.purchaseId!,
        input.userId,
      );
    }

    return { entry: result.entry, correlationId };
  }

  async voidSale(
    input: VoidIvaSalesBookInput,
  ): Promise<VoidIvaSalesBookResult> {
    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = await scope.ivaSalesBooks.findByIdTx(
          input.organizationId,
          input.id,
        );
        if (!entry) {
          throw new IvaBookNotFound("sale");
        }

        let sale = null;
        let period = null;
        if (entry.saleId) {
          sale = await this.deps.saleReader.getById(
            input.organizationId,
            entry.saleId,
          );
          period = await this.deps.fiscalPeriods.getById(
            input.organizationId,
            entry.fiscalPeriodId,
          );
          if (
            sale &&
            sale.status === "POSTED" &&
            period.status !== "OPEN"
          ) {
            throw new IvaBookFiscalPeriodClosed({
              entityType: "sale",
              operation: "modify",
            });
          }
        }

        const updated = entry.void();
        const persisted = await scope.ivaSalesBooks.updateTx(updated);
        return { entry: persisted, sale, period };
      },
    );

    if (
      result.sale &&
      result.sale.status === "POSTED" &&
      result.period?.status === "OPEN"
    ) {
      await this.deps.saleJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        result.entry.saleId!,
        input.userId,
      );
    }

    return { entry: result.entry, correlationId };
  }

  async voidPurchase(
    input: VoidIvaPurchaseBookInput,
  ): Promise<VoidIvaPurchaseBookResult> {
    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = await scope.ivaPurchaseBooks.findByIdTx(
          input.organizationId,
          input.id,
        );
        if (!entry) {
          throw new IvaBookNotFound("purchase");
        }

        let purchase = null;
        let period = null;
        if (entry.purchaseId) {
          purchase = await this.deps.purchaseReader.getById(
            input.organizationId,
            entry.purchaseId,
          );
          period = await this.deps.fiscalPeriods.getById(
            input.organizationId,
            entry.fiscalPeriodId,
          );
          if (
            purchase &&
            purchase.status === "POSTED" &&
            period.status !== "OPEN"
          ) {
            throw new IvaBookFiscalPeriodClosed({
              entityType: "purchase",
              operation: "modify",
            });
          }
        }

        const updated = entry.void();
        const persisted = await scope.ivaPurchaseBooks.updateTx(updated);
        return { entry: persisted, purchase, period };
      },
    );

    if (
      result.purchase &&
      result.purchase.status === "POSTED" &&
      result.period?.status === "OPEN"
    ) {
      await this.deps.purchaseJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        result.entry.purchaseId!,
        input.userId,
      );
    }

    return { entry: result.entry, correlationId };
  }

  async reactivateSale(
    input: ReactivateIvaSalesBookInput,
  ): Promise<ReactivateIvaSalesBookResult> {
    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = await scope.ivaSalesBooks.findByIdTx(
          input.organizationId,
          input.id,
        );
        if (!entry) {
          throw new IvaBookNotFound("sale");
        }

        let sale = null;
        let period = null;
        if (entry.saleId) {
          sale = await this.deps.saleReader.getById(
            input.organizationId,
            entry.saleId,
          );
          period = await this.deps.fiscalPeriods.getById(
            input.organizationId,
            entry.fiscalPeriodId,
          );
          if (
            sale &&
            sale.status === "POSTED" &&
            period.status !== "OPEN"
          ) {
            throw new IvaBookFiscalPeriodClosed({
              entityType: "sale",
              operation: "modify",
            });
          }
        }

        const updated = entry.reactivate();
        const persisted = await scope.ivaSalesBooks.updateTx(updated);
        return { entry: persisted, sale, period };
      },
    );

    if (
      result.sale &&
      result.sale.status === "POSTED" &&
      result.period?.status === "OPEN"
    ) {
      await this.deps.saleJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        result.entry.saleId!,
        input.userId,
      );
    }

    return { entry: result.entry, correlationId };
  }

  async reactivatePurchase(
    input: ReactivateIvaPurchaseBookInput,
  ): Promise<ReactivateIvaPurchaseBookResult> {
    const { result, correlationId } = await this.deps.uow.run(
      { userId: input.userId, organizationId: input.organizationId },
      async (scope) => {
        const entry = await scope.ivaPurchaseBooks.findByIdTx(
          input.organizationId,
          input.id,
        );
        if (!entry) {
          throw new IvaBookNotFound("purchase");
        }

        let purchase = null;
        let period = null;
        if (entry.purchaseId) {
          purchase = await this.deps.purchaseReader.getById(
            input.organizationId,
            entry.purchaseId,
          );
          period = await this.deps.fiscalPeriods.getById(
            input.organizationId,
            entry.fiscalPeriodId,
          );
          if (
            purchase &&
            purchase.status === "POSTED" &&
            period.status !== "OPEN"
          ) {
            throw new IvaBookFiscalPeriodClosed({
              entityType: "purchase",
              operation: "modify",
            });
          }
        }

        const updated = entry.reactivate();
        const persisted = await scope.ivaPurchaseBooks.updateTx(updated);
        return { entry: persisted, purchase, period };
      },
    );

    if (
      result.purchase &&
      result.purchase.status === "POSTED" &&
      result.period?.status === "OPEN"
    ) {
      await this.deps.purchaseJournalRegenNotifier.regenerateJournalForIvaChange(
        input.organizationId,
        result.entry.purchaseId!,
        input.userId,
      );
    }

    return { entry: result.entry, correlationId };
  }

  async applyVoidCascadeFromSale(
    input: ApplyIvaBookVoidCascadeFromSaleInput,
    scope: IvaBookScope,
  ): Promise<void> {
    const entry = await scope.ivaSalesBooks.findBySaleIdTx(
      input.organizationId,
      input.saleId,
    );
    if (!entry || entry.status === "VOIDED") return;
    const voided = entry.void();
    await scope.ivaSalesBooks.updateTx(voided);
  }

  async applyVoidCascadeFromPurchase(
    input: ApplyIvaBookVoidCascadeFromPurchaseInput,
    scope: IvaBookScope,
  ): Promise<void> {
    const entry = await scope.ivaPurchaseBooks.findByPurchaseIdTx(
      input.organizationId,
      input.purchaseId,
    );
    if (!entry || entry.status === "VOIDED") return;
    const voided = entry.void();
    await scope.ivaPurchaseBooks.updateTx(voided);
  }
}

function hasMonetaryFieldChange<T extends object>(
  inputs: Partial<T> | undefined,
): inputs is Partial<T> {
  if (!inputs) return false;
  for (const key of Object.keys(inputs) as (keyof T)[]) {
    if (inputs[key] !== undefined) return true;
  }
  return false;
}

function mergeSalesMonetaryInputs(
  current: IvaSalesBookEntryInputs,
  patch: PartialIvaSalesBookEntryInputs,
): IvaSalesBookEntryInputs {
  return {
    importeTotal: patch.importeTotal ?? current.importeTotal,
    importeIce: patch.importeIce ?? current.importeIce,
    importeIehd: patch.importeIehd ?? current.importeIehd,
    importeIpj: patch.importeIpj ?? current.importeIpj,
    tasas: patch.tasas ?? current.tasas,
    otrosNoSujetos: patch.otrosNoSujetos ?? current.otrosNoSujetos,
    exentos: patch.exentos ?? current.exentos,
    tasaCero: patch.tasaCero ?? current.tasaCero,
    codigoDescuentoAdicional:
      patch.codigoDescuentoAdicional ?? current.codigoDescuentoAdicional,
    importeGiftCard: patch.importeGiftCard ?? current.importeGiftCard,
  };
}

function mergePurchaseMonetaryInputs(
  current: IvaPurchaseBookEntryInputs,
  patch: PartialIvaPurchaseBookEntryInputs,
): IvaPurchaseBookEntryInputs {
  return {
    importeTotal: patch.importeTotal ?? current.importeTotal,
    importeIce: patch.importeIce ?? current.importeIce,
    importeIehd: patch.importeIehd ?? current.importeIehd,
    importeIpj: patch.importeIpj ?? current.importeIpj,
    tasas: patch.tasas ?? current.tasas,
    otrosNoSujetos: patch.otrosNoSujetos ?? current.otrosNoSujetos,
    exentos: patch.exentos ?? current.exentos,
    tasaCero: patch.tasaCero ?? current.tasaCero,
    codigoDescuentoAdicional:
      patch.codigoDescuentoAdicional ?? current.codigoDescuentoAdicional,
    importeGiftCard: patch.importeGiftCard ?? current.importeGiftCard,
  };
}
