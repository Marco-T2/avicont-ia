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
import type {
  IvaSalesBookEntryRepository,
  ListSalesQuery,
} from "../domain/ports/iva-sales-book-entry-repository.port";
import type {
  IvaPurchaseBookEntryRepository,
  ListPurchasesQuery,
} from "../domain/ports/iva-purchase-book-entry-repository.port";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

export interface IvaBookServiceDeps {
  uow: IvaBookUnitOfWork;
  fiscalPeriods: FiscalPeriodReaderPort;
  saleReader: SaleReaderPort;
  purchaseReader: PurchaseReaderPort;
  saleJournalRegenNotifier: SaleJournalRegenNotifierPort;
  purchaseJournalRegenNotifier: PurchaseJournalRegenNotifierPort;
  /**
   * Non-tx sales repo — A2.5. Same port used inside the UoW scope (tx-bound
   * instance), here a non-tx instance bound to the default Prisma client
   * para servir read paths (`getSaleById`, `listSalesByPeriod`). Production
   * wiring crea instancia distinta (non-tx) en composition-root.
   */
  ivaSalesBooks: IvaSalesBookEntryRepository;
  /**
   * Non-tx purchases repo — A2.5. Mirror simétrico de `ivaSalesBooks`.
   * Same port used inside the UoW scope (tx-bound instance), here a
   * non-tx instance bound to the default Prisma client para servir read
   * paths (`getPurchaseById`, `listPurchasesByPeriod`). Production
   * wiring crea instancia distinta (non-tx) en composition-root.
   */
  ivaPurchaseBooks: IvaPurchaseBookEntryRepository;
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

export interface RecomputeIvaSalesBookFromSaleCascadeInput {
  organizationId: string;
  saleId: string;
  newTotal: MonetaryAmount;
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
 * por reintento manual). C locked: IVA NO escribe journals ni balances
 * directamente — el bridge es el único side-effect cross-module (ver
 * `iva-book-unit-of-work.ts:21-27`).
 *
 * **Notes patch-vs-preserve distingo (recompute × {sale, purchase})** —
 * `if ("notes" in input) editInput.notes = input.notes ?? null;` distingue
 * patch-with-null (SET null) vs preserve (skip cuando key ausente).
 * Mirror operacional del legacy `iva-books.service.ts:481` updateSale +
 * `:312` updatePurchase, que delega a Prisma undefined-skip implicit.
 * Drift heredado aceptado: edge case `{ notes: undefined }` con key
 * explícitamente presente — legacy skip vs hex SET null (`?? null`
 * coalesce). NO caller en práctica pasa `{ notes: undefined }` explícito
 * (TypeScript indistinguible de key ausente); fix requeriría revisar
 * firma repo + tests adicionales fuera scope C7 closing sweep.
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

    applyBridgePeriodGate(sale, period, "sale", "create");

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

    await applyBridgeNotifyIfPosted(
      sale,
      period,
      this.deps.saleJournalRegenNotifier,
      input.organizationId,
      input.saleId!,
      input.userId,
    );

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

    applyBridgePeriodGate(purchase, period, "purchase", "create");

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

    await applyBridgeNotifyIfPosted(
      purchase,
      period,
      this.deps.purchaseJournalRegenNotifier,
      input.organizationId,
      input.purchaseId!,
      input.userId,
    );

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
          applyBridgePeriodGate(sale, period, "sale", "modify");
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

    await applyBridgeNotifyIfPosted(
      result.sale,
      result.period,
      this.deps.saleJournalRegenNotifier,
      input.organizationId,
      result.entry.saleId!,
      input.userId,
    );

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
          applyBridgePeriodGate(purchase, period, "purchase", "modify");
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

    await applyBridgeNotifyIfPosted(
      result.purchase,
      result.period,
      this.deps.purchaseJournalRegenNotifier,
      input.organizationId,
      result.entry.purchaseId!,
      input.userId,
    );

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
          applyBridgePeriodGate(sale, period, "sale", "modify");
        }

        const updated = entry.void();
        const persisted = await scope.ivaSalesBooks.updateTx(updated);
        return { entry: persisted, sale, period };
      },
    );

    await applyBridgeNotifyIfPosted(
      result.sale,
      result.period,
      this.deps.saleJournalRegenNotifier,
      input.organizationId,
      result.entry.saleId!,
      input.userId,
    );

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
          applyBridgePeriodGate(purchase, period, "purchase", "modify");
        }

        const updated = entry.void();
        const persisted = await scope.ivaPurchaseBooks.updateTx(updated);
        return { entry: persisted, purchase, period };
      },
    );

    await applyBridgeNotifyIfPosted(
      result.purchase,
      result.period,
      this.deps.purchaseJournalRegenNotifier,
      input.organizationId,
      result.entry.purchaseId!,
      input.userId,
    );

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
          applyBridgePeriodGate(sale, period, "sale", "modify");
        }

        const updated = entry.reactivate();
        const persisted = await scope.ivaSalesBooks.updateTx(updated);
        return { entry: persisted, sale, period };
      },
    );

    await applyBridgeNotifyIfPosted(
      result.sale,
      result.period,
      this.deps.saleJournalRegenNotifier,
      input.organizationId,
      result.entry.saleId!,
      input.userId,
    );

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
          applyBridgePeriodGate(purchase, period, "purchase", "modify");
        }

        const updated = entry.reactivate();
        const persisted = await scope.ivaPurchaseBooks.updateTx(updated);
        return { entry: persisted, purchase, period };
      },
    );

    await applyBridgeNotifyIfPosted(
      result.purchase,
      result.period,
      this.deps.purchaseJournalRegenNotifier,
      input.organizationId,
      result.entry.purchaseId!,
      input.userId,
    );

    return { entry: result.entry, correlationId };
  }

  /**
   * IVA cascade entry point invocado por sale-hex `voidSale` cascade chain.
   *
   * **E locked (POC #11.0c A2)** — NO valida periodo (fidelidad legacy
   * regla #1). Legacy `iva-books.service.ts:559-602` ejecuta el void
   * cascade INDEPENDIENTE del estado periodo. Asimetría intencional con
   * regenerate / recompute / void / reactivate (que sí validan periodo).
   * Defense-in-depth contra fix accidental: NO agregar `fiscalPeriods.getById`
   * acá — rompe fidelidad legacy regla #1.
   *
   * **F-α locked** — recibe `scope: IvaBookScope` por parámetro (no
   * `uow.run()` interno). Ver `iva-book-unit-of-work.ts:29-37`.
   */
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

  /**
   * IVA cascade entry point invocado por purchase-hex `voidPurchase`
   * cascade chain. **E locked + F-α locked** — mirror simétrico
   * `applyVoidCascadeFromSale`. Legacy `iva-books.service.ts:618-659`.
   */
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

  /**
   * IVA cascade entry point invocado por sale-hex `editPosted` cascade chain
   * cuando cambia `importeTotal` de un sale POSTED+linked. Recomputa derivados
   * IVA preserving 9 deducciones (paridad legacy `iva-books.service.ts:559-602`).
   *
   * **E locked (POC #11.0c A2)** — NO valida periodo (fidelidad legacy regla
   * #1 I1). Cascade ejecuta INDEPENDIENTE del estado periodo. Asimetría
   * intencional con regenerate / recompute / void / reactivate (que sí
   * validan). Defense-in-depth: NO agregar `fiscalPeriods.getById` acá.
   *
   * **F-α locked** — recibe `scope: IvaBookScope` por parámetro (no
   * `uow.run()` interno). Caller (sale UoW notifier adapter A4-c) ya tiene
   * tx parent abierta. Mirror simétrico `applyVoidCascadeFromSale`.
   *
   * **Lock C textual preservado** (`iva-book-unit-of-work.ts:21-27`): IVA NO
   * escribe journals/balances/receivables/payables — solo `scope.ivaSalesBooks`
   * (own aggregate). Cascade preserve esta invariante.
   *
   * **I2 architectural enforced by scope shape**: cascade methods reciben
   * `IvaBookScope` (NO `SaleJournalRegenNotifierPort`) — invariante "NO loop
   * Sale→IVA→Journal→Sale" garantizado estructuralmente, no por runtime check.
   *
   * **Defense-in-depth (paridad legacy I4-I5)**: recomputa `IvaCalcResult`
   * server-side via `computeIvaTotals(updatedInputs)`; preserva 9 deducciones
   * (`importeIce/importeIehd/importeIpj/tasas/otrosNoSujetos/exentos/tasaCero/
   * codigoDescuentoAdicional/importeGiftCard`) sin modificar — solo
   * `importeTotal` cambia + derivados (`subtotal/baseIvaSujetoCf/dfIva/dfCfIva/
   * tasaIva`) recomputed.
   *
   * **No-op contract (paridad legacy I3)**: si no existe entry para `saleId`,
   * return sin throw.
   *
   * **VOIDED preserve (paridad legacy I6 — bug latente Marco lock Ciclo 5c
   * sale 5c (b))**: SIN status filter — opera sobre ACTIVE+VOIDED igual.
   * Adapter NO inventa "defensive" filter; legacy bug "mutate VOIDED" se
   * arregla en POC dedicado, no via mejora unilateral.
   *
   * **Asimetrías declaradas vs legacy** (NO drift, A1-A5):
   *   - A1 input named (interface), no positional — paridad shape A2.5/A4-a
   *   - A2 `MonetaryAmount` VO clean boundary (caller A4-c notifier wraps
   *     `Prisma.Decimal`)
   *   - A3 scope param F-α en lugar de external tx — mirror precedent
   *   - A4 `entry.applyEdit({ inputs, calcResult })` domain-centric
   *     (entity owns derived field consistency) en lugar de Prisma
   *     `update({ data })` direct
   *   - A5 NO `tasaIva: TASA_IVA` explícito — `IvaCalcResult` ya incluye
   *     `tasaIva` (defense-in-depth A2 C3)
   */
  async recomputeFromSaleCascade(
    input: RecomputeIvaSalesBookFromSaleCascadeInput,
    scope: IvaBookScope,
  ): Promise<void> {
    const entry = await scope.ivaSalesBooks.findBySaleIdTx(
      input.organizationId,
      input.saleId,
    );
    if (!entry) return;

    const updatedInputs: IvaSalesBookEntryInputs = {
      ...entry.inputs,
      importeTotal: input.newTotal,
    };
    const calcResult = computeIvaTotals(updatedInputs);
    const updated = entry.applyEdit({ inputs: updatedInputs, calcResult });
    await scope.ivaSalesBooks.updateTx(updated);
  }

  // ── A2.5 reads (sales) ────────────────────────────────────────────────────

  async getSaleById(
    organizationId: string,
    id: string,
  ): Promise<IvaSalesBookEntry> {
    const entry = await this.deps.ivaSalesBooks.findById(organizationId, id);
    if (!entry) throw new IvaBookNotFound("sale");
    return entry;
  }

  async listSalesByPeriod(
    organizationId: string,
    query: ListSalesQuery,
  ): Promise<IvaSalesBookEntry[]> {
    return this.deps.ivaSalesBooks.findByPeriod(organizationId, query);
  }

  // ── A2.5 reads (purchases) ────────────────────────────────────────────────

  async getPurchaseById(
    organizationId: string,
    id: string,
  ): Promise<IvaPurchaseBookEntry> {
    const entry = await this.deps.ivaPurchaseBooks.findById(organizationId, id);
    if (!entry) throw new IvaBookNotFound("purchase");
    return entry;
  }

  async listPurchasesByPeriod(
    organizationId: string,
    query: ListPurchasesQuery,
  ): Promise<IvaPurchaseBookEntry[]> {
    return this.deps.ivaPurchaseBooks.findByPeriod(organizationId, query);
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

// ── Bridge gate helpers (§13 #2 emergente — POC #11.0c A2 C7) ─────────────────

type EntityWithStatus = { status: string };
type PeriodWithStatus = { status: string };

interface BridgeNotifier {
  regenerateJournalForIvaChange(
    organizationId: string,
    entityId: string,
    userId: string,
  ): Promise<unknown>;
}

/**
 * Period CLOSED gate (pre-UoW o in-UoW): throw si entity POSTED + period
 * !== OPEN. Standalone IVA con period CLOSED NO lanza (paridad legacy
 * regla #1).
 */
function applyBridgePeriodGate(
  entity: EntityWithStatus | null,
  period: PeriodWithStatus,
  entityType: "sale" | "purchase",
  operation: "create" | "modify",
): void {
  if (entity && entity.status === "POSTED" && period.status !== "OPEN") {
    throw new IvaBookFiscalPeriodClosed({ entityType, operation });
  }
}

/**
 * Bridge regen notify post-UoW: invoca notifier solo si entity POSTED +
 * period OPEN. D-1 lockeada — side-effect post-UoW, no comparte tx scope
 * con `IvaBookScope`.
 */
async function applyBridgeNotifyIfPosted(
  entity: EntityWithStatus | null,
  period: PeriodWithStatus | null | undefined,
  notifier: BridgeNotifier,
  organizationId: string,
  entityId: string,
  userId: string,
): Promise<void> {
  if (entity && entity.status === "POSTED" && period?.status === "OPEN") {
    await notifier.regenerateJournalForIvaChange(
      organizationId,
      entityId,
      userId,
    );
  }
}
