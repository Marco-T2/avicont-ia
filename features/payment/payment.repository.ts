import "server-only";
import { PrismaPaymentsRepository } from "@/modules/payment/presentation/server";
import type { UnappliedPayment } from "./payment.types";

/**
 * Backward-compat shim. Extends `PrismaPaymentsRepository` from
 * `modules/payment/` to keep the legacy class name and add the
 * `findUnappliedPayments` alias (module renamed it to
 * `findUnappliedByContact`). Other tx-aware methods are inherited as-is.
 */
export class PaymentRepository extends PrismaPaymentsRepository {
  async findUnappliedPayments(
    organizationId: string,
    contactId: string,
    excludePaymentId?: string,
  ): Promise<UnappliedPayment[]> {
    return this.findUnappliedByContact(organizationId, contactId, excludePaymentId);
  }
}
