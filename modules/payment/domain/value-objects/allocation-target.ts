import type { PaymentDirection } from "./payment-direction";

export type AllocationKind = "RECEIVABLE" | "PAYABLE";

/**
 * Tagged value object that encodes the XOR invariant of payment allocations:
 * an allocation targets EITHER a receivable OR a payable, never both, never
 * neither. The XOR is enforced at the call site (static factories) so an
 * AllocationTarget instance is, by construction, always valid.
 */
export class AllocationTarget {
  private constructor(
    public readonly kind: AllocationKind,
    public readonly id: string,
  ) {}

  static forReceivable(id: string): AllocationTarget {
    return new AllocationTarget("RECEIVABLE", id);
  }

  static forPayable(id: string): AllocationTarget {
    return new AllocationTarget("PAYABLE", id);
  }

  get receivableId(): string | null {
    return this.kind === "RECEIVABLE" ? this.id : null;
  }

  get payableId(): string | null {
    return this.kind === "PAYABLE" ? this.id : null;
  }

  get direction(): PaymentDirection {
    return this.kind === "RECEIVABLE" ? "COBRO" : "PAGO";
  }

  equals(other: AllocationTarget): boolean {
    return this.kind === other.kind && this.id === other.id;
  }
}
