import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidSaleDetailLine } from "./errors/sale-errors";

export interface SaleDetailProps {
  id: string;
  saleId: string;
  description: string;
  lineAmount: MonetaryAmount;
  order: number;
  quantity?: number;
  unitPrice?: number;
  incomeAccountId: string;
}

export interface CreateSaleDetailInput {
  saleId: string;
  description: string;
  lineAmount: MonetaryAmount;
  order: number;
  quantity?: number;
  unitPrice?: number;
  incomeAccountId: string;
}

export class SaleDetail {
  private constructor(private readonly props: SaleDetailProps) {}

  static create(input: CreateSaleDetailInput): SaleDetail {
    if (input.description.trim().length === 0) {
      throw new InvalidSaleDetailLine(
        "La descripción de la línea no puede estar vacía",
        { field: "description" },
      );
    }
    if (input.incomeAccountId.length === 0) {
      throw new InvalidSaleDetailLine(
        "Cada línea de detalle debe tener una cuenta de ingreso asociada",
        { field: "incomeAccountId" },
      );
    }
    if (!Number.isInteger(input.order) || input.order < 0) {
      throw new InvalidSaleDetailLine(
        `El orden de la línea debe ser un entero no negativo: ${input.order}`,
        { field: "order", value: input.order },
      );
    }
    if (input.quantity !== undefined && input.quantity < 0) {
      throw new InvalidSaleDetailLine(
        `La cantidad de la línea no puede ser negativa: ${input.quantity}`,
        { field: "quantity", value: input.quantity },
      );
    }
    if (input.unitPrice !== undefined && input.unitPrice < 0) {
      throw new InvalidSaleDetailLine(
        `El precio unitario de la línea no puede ser negativo: ${input.unitPrice}`,
        { field: "unitPrice", value: input.unitPrice },
      );
    }
    return new SaleDetail({
      id: crypto.randomUUID(),
      saleId: input.saleId,
      description: input.description,
      lineAmount: input.lineAmount,
      order: input.order,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      incomeAccountId: input.incomeAccountId,
    });
  }

  static fromPersistence(props: SaleDetailProps): SaleDetail {
    return new SaleDetail(props);
  }

  get id(): string {
    return this.props.id;
  }
  get saleId(): string {
    return this.props.saleId;
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
  get incomeAccountId(): string {
    return this.props.incomeAccountId;
  }
}
