import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { IvaBookStatus } from "./value-objects/iva-book-status";
import type { IvaCalcResult } from "./value-objects/iva-calc-result";
import { IvaBookReactivateNonVoided } from "./errors/iva-book-errors";

export interface IvaPurchaseBookEntryInputs {
  importeTotal: MonetaryAmount;
  importeIce: MonetaryAmount;
  importeIehd: MonetaryAmount;
  importeIpj: MonetaryAmount;
  tasas: MonetaryAmount;
  otrosNoSujetos: MonetaryAmount;
  exentos: MonetaryAmount;
  tasaCero: MonetaryAmount;
  codigoDescuentoAdicional: MonetaryAmount;
  importeGiftCard: MonetaryAmount;
}

export interface IvaPurchaseBookEntryHeader {
  fechaFactura: Date;
  nitProveedor: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  tipoCompra: number;
  notes: string | null;
}

export interface IvaPurchaseBookEntryProps extends IvaPurchaseBookEntryHeader {
  id: string;
  organizationId: string;
  fiscalPeriodId: string;
  purchaseId: string | null;
  inputs: IvaPurchaseBookEntryInputs;
  calcResult: IvaCalcResult;
  status: IvaBookStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIvaPurchaseBookEntryInput
  extends IvaPurchaseBookEntryHeader {
  organizationId: string;
  fiscalPeriodId: string;
  purchaseId?: string;
  inputs: IvaPurchaseBookEntryInputs;
  calcResult: IvaCalcResult;
}

export class IvaPurchaseBookEntry {
  private constructor(private readonly props: IvaPurchaseBookEntryProps) {}

  static create(input: CreateIvaPurchaseBookEntryInput): IvaPurchaseBookEntry {
    const now = new Date();
    return new IvaPurchaseBookEntry({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      fiscalPeriodId: input.fiscalPeriodId,
      purchaseId: input.purchaseId ?? null,
      inputs: input.inputs,
      calcResult: input.calcResult,
      fechaFactura: input.fechaFactura,
      nitProveedor: input.nitProveedor,
      razonSocial: input.razonSocial,
      numeroFactura: input.numeroFactura,
      codigoAutorizacion: input.codigoAutorizacion,
      codigoControl: input.codigoControl,
      tipoCompra: input.tipoCompra,
      notes: input.notes,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(
    props: IvaPurchaseBookEntryProps,
  ): IvaPurchaseBookEntry {
    return new IvaPurchaseBookEntry(props);
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get fiscalPeriodId(): string {
    return this.props.fiscalPeriodId;
  }
  get purchaseId(): string | null {
    return this.props.purchaseId;
  }
  get inputs(): IvaPurchaseBookEntryInputs {
    return this.props.inputs;
  }
  get calcResult(): IvaCalcResult {
    return this.props.calcResult;
  }
  get status(): IvaBookStatus {
    return this.props.status;
  }
  get fechaFactura(): Date {
    return this.props.fechaFactura;
  }
  get nitProveedor(): string {
    return this.props.nitProveedor;
  }
  get razonSocial(): string {
    return this.props.razonSocial;
  }
  get numeroFactura(): string {
    return this.props.numeroFactura;
  }
  get codigoAutorizacion(): string {
    return this.props.codigoAutorizacion;
  }
  get codigoControl(): string {
    return this.props.codigoControl;
  }
  get tipoCompra(): number {
    return this.props.tipoCompra;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  void(): IvaPurchaseBookEntry {
    if (this.props.status === "VOIDED") return this;
    return new IvaPurchaseBookEntry({
      ...this.props,
      status: "VOIDED",
      updatedAt: new Date(),
    });
  }

  reactivate(): IvaPurchaseBookEntry {
    if (this.props.status !== "VOIDED") {
      throw new IvaBookReactivateNonVoided("purchase");
    }
    return new IvaPurchaseBookEntry({
      ...this.props,
      status: "ACTIVE",
      updatedAt: new Date(),
    });
  }
}
