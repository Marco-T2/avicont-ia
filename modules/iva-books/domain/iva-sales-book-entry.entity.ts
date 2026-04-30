import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { IvaBookStatus } from "./value-objects/iva-book-status";
import type { IvaSalesEstadoSIN } from "./value-objects/iva-sales-estado-sin";
import type { IvaCalcResult } from "./value-objects/iva-calc-result";
import { IvaBookReactivateNonVoided } from "./errors/iva-book-errors";

export interface IvaSalesBookEntryInputs {
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

export interface IvaSalesBookEntryHeader {
  fechaFactura: Date;
  nitCliente: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  estadoSIN: IvaSalesEstadoSIN;
  notes: string | null;
}

export interface IvaSalesBookEntryProps extends IvaSalesBookEntryHeader {
  id: string;
  organizationId: string;
  fiscalPeriodId: string;
  saleId: string | null;
  inputs: IvaSalesBookEntryInputs;
  calcResult: IvaCalcResult;
  status: IvaBookStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIvaSalesBookEntryInput extends IvaSalesBookEntryHeader {
  organizationId: string;
  fiscalPeriodId: string;
  saleId?: string;
  inputs: IvaSalesBookEntryInputs;
  calcResult: IvaCalcResult;
}

export interface ApplyIvaSalesBookEntryEditInput {
  fechaFactura?: Date;
  nitCliente?: string;
  razonSocial?: string;
  numeroFactura?: string;
  codigoAutorizacion?: string;
  codigoControl?: string;
  estadoSIN?: IvaSalesEstadoSIN;
  notes?: string | null;
  inputs?: IvaSalesBookEntryInputs;
  calcResult?: IvaCalcResult;
}

export class IvaSalesBookEntry {
  private constructor(private readonly props: IvaSalesBookEntryProps) {}

  static create(input: CreateIvaSalesBookEntryInput): IvaSalesBookEntry {
    const now = new Date();
    return new IvaSalesBookEntry({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      fiscalPeriodId: input.fiscalPeriodId,
      saleId: input.saleId ?? null,
      inputs: input.inputs,
      calcResult: input.calcResult,
      fechaFactura: input.fechaFactura,
      nitCliente: input.nitCliente,
      razonSocial: input.razonSocial,
      numeroFactura: input.numeroFactura,
      codigoAutorizacion: input.codigoAutorizacion,
      codigoControl: input.codigoControl,
      estadoSIN: input.estadoSIN,
      notes: input.notes,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: IvaSalesBookEntryProps): IvaSalesBookEntry {
    return new IvaSalesBookEntry(props);
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
  get saleId(): string | null {
    return this.props.saleId;
  }
  get inputs(): IvaSalesBookEntryInputs {
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
  get nitCliente(): string {
    return this.props.nitCliente;
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
  get estadoSIN(): IvaSalesEstadoSIN {
    return this.props.estadoSIN;
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

  void(): IvaSalesBookEntry {
    if (this.props.status === "VOIDED") return this;
    return new IvaSalesBookEntry({
      ...this.props,
      status: "VOIDED",
      updatedAt: new Date(),
    });
  }

  reactivate(): IvaSalesBookEntry {
    if (this.props.status !== "VOIDED") {
      throw new IvaBookReactivateNonVoided("sale");
    }
    return new IvaSalesBookEntry({
      ...this.props,
      status: "ACTIVE",
      updatedAt: new Date(),
    });
  }

  applyEdit(input: ApplyIvaSalesBookEntryEditInput): IvaSalesBookEntry {
    const next: IvaSalesBookEntryProps = { ...this.props };
    if (input.fechaFactura !== undefined) next.fechaFactura = input.fechaFactura;
    if (input.nitCliente !== undefined) next.nitCliente = input.nitCliente;
    if (input.razonSocial !== undefined) next.razonSocial = input.razonSocial;
    if (input.numeroFactura !== undefined) next.numeroFactura = input.numeroFactura;
    if (input.codigoAutorizacion !== undefined) {
      next.codigoAutorizacion = input.codigoAutorizacion;
    }
    if (input.codigoControl !== undefined) next.codigoControl = input.codigoControl;
    if (input.estadoSIN !== undefined) next.estadoSIN = input.estadoSIN;
    if ("notes" in input) next.notes = input.notes ?? null;
    if (input.inputs !== undefined) next.inputs = input.inputs;
    if (input.calcResult !== undefined) next.calcResult = input.calcResult;
    next.updatedAt = new Date();
    return new IvaSalesBookEntry(next);
  }
}
