import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidPurchaseDetailLine } from "./errors/purchase-errors";

export interface PurchaseDetailProps {
  id: string;
  purchaseId: string;
  description: string;
  lineAmount: MonetaryAmount;
  order: number;
  quantity?: number;
  unitPrice?: number;
  expenseAccountId?: string;
  fecha?: Date;
  docRef?: string;
  chickenQty?: number;
  pricePerChicken?: number;
  productTypeId?: string;
  detailNote?: string;
  boxes?: number;
  grossWeight?: number;
  tare?: number;
  netWeight?: number;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
}

export interface CreatePurchaseDetailInput {
  purchaseId: string;
  description: string;
  lineAmount: MonetaryAmount;
  order: number;
  quantity?: number;
  unitPrice?: number;
  expenseAccountId?: string;
  fecha?: Date;
  docRef?: string;
  chickenQty?: number;
  pricePerChicken?: number;
  productTypeId?: string;
  detailNote?: string;
  boxes?: number;
  grossWeight?: number;
  tare?: number;
  netWeight?: number;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
}

export class PurchaseDetail {
  private constructor(private readonly props: PurchaseDetailProps) {}

  static create(input: CreatePurchaseDetailInput): PurchaseDetail {
    if (!Number.isInteger(input.order) || input.order < 0) {
      throw new InvalidPurchaseDetailLine(
        `El orden de la línea debe ser un entero no negativo: ${input.order}`,
        { field: "order", value: input.order },
      );
    }
    if (input.quantity !== undefined && input.quantity < 0) {
      throw new InvalidPurchaseDetailLine(
        `La cantidad de la línea no puede ser negativa: ${input.quantity}`,
        { field: "quantity", value: input.quantity },
      );
    }
    if (input.unitPrice !== undefined && input.unitPrice < 0) {
      throw new InvalidPurchaseDetailLine(
        `El precio unitario de la línea no puede ser negativo: ${input.unitPrice}`,
        { field: "unitPrice", value: input.unitPrice },
      );
    }
    return new PurchaseDetail({
      id: crypto.randomUUID(),
      purchaseId: input.purchaseId,
      description: input.description,
      lineAmount: input.lineAmount,
      order: input.order,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      expenseAccountId: input.expenseAccountId,
      fecha: input.fecha,
      docRef: input.docRef,
      chickenQty: input.chickenQty,
      pricePerChicken: input.pricePerChicken,
      productTypeId: input.productTypeId,
      detailNote: input.detailNote,
      boxes: input.boxes,
      grossWeight: input.grossWeight,
      tare: input.tare,
      netWeight: input.netWeight,
      shrinkage: input.shrinkage,
      shortage: input.shortage,
      realNetWeight: input.realNetWeight,
    });
  }

  static fromPersistence(props: PurchaseDetailProps): PurchaseDetail {
    return new PurchaseDetail(props);
  }

  get id(): string {
    return this.props.id;
  }
  get purchaseId(): string {
    return this.props.purchaseId;
  }
  get description(): string {
    return this.props.description;
  }
  get lineAmount(): MonetaryAmount {
    return this.props.lineAmount;
  }
  get order(): number {
    return this.props.order;
  }
  get quantity(): number | undefined {
    return this.props.quantity;
  }
  get unitPrice(): number | undefined {
    return this.props.unitPrice;
  }
  get expenseAccountId(): string | undefined {
    return this.props.expenseAccountId;
  }
  get fecha(): Date | undefined {
    return this.props.fecha;
  }
  get docRef(): string | undefined {
    return this.props.docRef;
  }
  get chickenQty(): number | undefined {
    return this.props.chickenQty;
  }
  get pricePerChicken(): number | undefined {
    return this.props.pricePerChicken;
  }
  get productTypeId(): string | undefined {
    return this.props.productTypeId;
  }
  get detailNote(): string | undefined {
    return this.props.detailNote;
  }
  get boxes(): number | undefined {
    return this.props.boxes;
  }
  get grossWeight(): number | undefined {
    return this.props.grossWeight;
  }
  get tare(): number | undefined {
    return this.props.tare;
  }
  get netWeight(): number | undefined {
    return this.props.netWeight;
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
