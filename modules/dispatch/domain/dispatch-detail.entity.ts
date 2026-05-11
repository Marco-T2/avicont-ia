import { InvalidDispatchDetailLine } from "./errors/dispatch-errors";

export interface DispatchDetailProps {
  id: string;
  dispatchId: string;
  description: string;
  boxes: number;
  grossWeight: number;
  tare: number;
  netWeight: number;
  unitPrice: number;
  lineAmount: number;
  order: number;
  productTypeId?: string;
  detailNote?: string;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
}

export interface CreateDispatchDetailInput {
  dispatchId: string;
  description: string;
  boxes: number;
  grossWeight: number;
  tare: number;
  netWeight: number;
  unitPrice: number;
  lineAmount: number;
  order: number;
  productTypeId?: string;
  detailNote?: string;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
}

export class DispatchDetail {
  private constructor(private readonly props: DispatchDetailProps) {}

  static create(input: CreateDispatchDetailInput): DispatchDetail {
    if (input.description.trim().length === 0) {
      throw new InvalidDispatchDetailLine(
        "La descripción de la línea no puede estar vacía",
        { field: "description" },
      );
    }
    if (!Number.isInteger(input.order) || input.order < 0) {
      throw new InvalidDispatchDetailLine(
        `El orden de la línea debe ser un entero no negativo: ${input.order}`,
        { field: "order", value: input.order },
      );
    }
    return new DispatchDetail({
      id: crypto.randomUUID(),
      ...input,
    });
  }

  static fromPersistence(props: DispatchDetailProps): DispatchDetail {
    return new DispatchDetail(props);
  }

  get id(): string {
    return this.props.id;
  }
  get dispatchId(): string {
    return this.props.dispatchId;
  }
  get description(): string {
    return this.props.description;
  }
  get boxes(): number {
    return this.props.boxes;
  }
  get grossWeight(): number {
    return this.props.grossWeight;
  }
  get tare(): number {
    return this.props.tare;
  }
  get netWeight(): number {
    return this.props.netWeight;
  }
  get unitPrice(): number {
    return this.props.unitPrice;
  }
  get lineAmount(): number {
    return this.props.lineAmount;
  }
  get order(): number {
    return this.props.order;
  }
  get productTypeId(): string | undefined {
    return this.props.productTypeId;
  }
  get detailNote(): string | undefined {
    return this.props.detailNote;
  }
  get shrinkage(): number | undefined {
    return this.props.shrinkage;
  }
  get shortage(): number | undefined {
    return this.props.shortage;
  }
  get realNetWeight(): number | undefined {
    return this.props.realNetWeight;
  }
}
