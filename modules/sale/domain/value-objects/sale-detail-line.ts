import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidSaleDetailLine } from "../errors/sale-errors";

export interface SaleDetailLineProps {
  description: string;
  lineAmount: MonetaryAmount;
  incomeAccountId: string;
  order: number;
  quantity?: number;
  unitPrice?: MonetaryAmount;
}

export class SaleDetailLine {
  private constructor(private readonly props: SaleDetailLineProps) {}

  static create(props: SaleDetailLineProps): SaleDetailLine {
    if (props.description.trim().length === 0) {
      throw new InvalidSaleDetailLine(
        "La descripción de la línea no puede estar vacía",
        { field: "description" },
      );
    }
    if (props.incomeAccountId.length === 0) {
      throw new InvalidSaleDetailLine(
        "Cada línea de detalle debe tener una cuenta de ingreso asociada",
        { field: "incomeAccountId" },
      );
    }
    if (!Number.isInteger(props.order) || props.order < 0) {
      throw new InvalidSaleDetailLine(
        `El orden de la línea debe ser un entero no negativo: ${props.order}`,
        { field: "order", value: props.order },
      );
    }
    if (props.quantity !== undefined && props.quantity < 0) {
      throw new InvalidSaleDetailLine(
        `La cantidad de la línea no puede ser negativa: ${props.quantity}`,
        { field: "quantity", value: props.quantity },
      );
    }
    return new SaleDetailLine(props);
  }

  get description(): string {
    return this.props.description;
  }

  get lineAmount(): MonetaryAmount {
    return this.props.lineAmount;
  }

  get incomeAccountId(): string {
    return this.props.incomeAccountId;
  }

  get order(): number {
    return this.props.order;
  }

  get quantity(): number | undefined {
    return this.props.quantity;
  }

  get unitPrice(): MonetaryAmount | undefined {
    return this.props.unitPrice;
  }
}
