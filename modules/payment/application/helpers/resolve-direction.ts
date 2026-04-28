import {
  NotFoundError,
  ValidationError,
  PAYMENT_DIRECTION_REQUIRED,
} from "@/features/shared/errors";
import type { PaymentDirection } from "../../domain/value-objects/payment-direction";
import type { ContactReadPort } from "../../domain/ports/contact-read.port";

/**
 * Snapshot fragment used to derive direction from existing or proposed
 * allocations. Either `receivableId` or `payableId` is non-null per
 * allocation (XOR enforced upstream by AllocationTarget VO and validation).
 */
export interface AllocationDirectionInput {
  receivableId?: string | null;
  payableId?: string | null;
}

/**
 * Derives the payment direction (COBRO / PAGO) using the same algorithm as
 * the legacy `resolveDirection` (features/payment/payment.service.ts:1300):
 *
 *   1. If `explicitDirection` is provided, use it.
 *   2. Else, if there's at least one allocation, derive from the first one:
 *      - receivableId set → COBRO
 *      - else (payableId set) → PAGO
 *   3. Else, look up `Contact.type` via the ContactReadPort:
 *      - CLIENTE → COBRO
 *      - PROVEEDOR → PAGO
 *      - otherwise: throw NotFoundError or PAYMENT_DIRECTION_REQUIRED
 *
 * The lookup is tx-aware because legacy reads contact.type inside the post
 * transaction.
 */
export async function resolveDirection(
  tx: unknown,
  contacts: ContactReadPort,
  allocations: AllocationDirectionInput[],
  contactId: string,
  explicitDirection?: PaymentDirection,
): Promise<PaymentDirection> {
  if (explicitDirection) return explicitDirection;

  if (allocations.length > 0) {
    return allocations[0].receivableId ? "COBRO" : "PAGO";
  }

  const type = await contacts.findType(tx, contactId);
  if (type === null) throw new NotFoundError("Contacto");
  if (type === "CLIENTE") return "COBRO";
  if (type === "PROVEEDOR") return "PAGO";

  throw new ValidationError(
    "No se puede determinar la dirección del pago. Especifique la dirección o agregue al menos una asignación.",
    PAYMENT_DIRECTION_REQUIRED,
  );
}
