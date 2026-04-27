import type { PaymentForCreditCalc } from "./types";

export interface PaymentCreditPort {
  findActivePaymentsForContact(
    organizationId: string,
    contactId: string,
  ): Promise<PaymentForCreditCalc[]>;
}
