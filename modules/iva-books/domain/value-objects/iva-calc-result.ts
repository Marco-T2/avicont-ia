import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidIvaCalcResult } from "../errors/iva-book-errors";

export interface IvaCalcResultProps {
  subtotal: MonetaryAmount;
  baseImponible: MonetaryAmount;
  ivaAmount: MonetaryAmount;
}

export class IvaCalcResult {
  private constructor(private readonly props: IvaCalcResultProps) {}

  static of(props: IvaCalcResultProps): IvaCalcResult {
    if (props.baseImponible.isGreaterThan(props.subtotal)) {
      throw new InvalidIvaCalcResult(
        "baseImponible no puede exceder subtotal",
        {
          subtotal: props.subtotal.value,
          baseImponible: props.baseImponible.value,
        },
      );
    }
    if (props.ivaAmount.isGreaterThan(props.baseImponible)) {
      throw new InvalidIvaCalcResult(
        "ivaAmount no puede exceder baseImponible",
        {
          baseImponible: props.baseImponible.value,
          ivaAmount: props.ivaAmount.value,
        },
      );
    }
    return new IvaCalcResult(props);
  }

  get subtotal(): MonetaryAmount {
    return this.props.subtotal;
  }
  get baseImponible(): MonetaryAmount {
    return this.props.baseImponible;
  }
  get ivaAmount(): MonetaryAmount {
    return this.props.ivaAmount;
  }

  equals(other: IvaCalcResult): boolean {
    return (
      this.props.subtotal.equals(other.props.subtotal) &&
      this.props.baseImponible.equals(other.props.baseImponible) &&
      this.props.ivaAmount.equals(other.props.ivaAmount)
    );
  }
}
