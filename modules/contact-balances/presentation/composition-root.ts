import "server-only";
import { ContactBalancesService } from "../application/contact-balances.service";
import { ContactsExistenceAdapter } from "../infrastructure/contacts-existence.adapter";
import { PrismaPaymentCreditAdapter } from "../infrastructure/prisma-payment-credit.adapter";
import { ReceivablesQueryAdapter } from "../infrastructure/receivables.adapter";
import { PayablesQueryAdapter } from "../infrastructure/payables.adapter";
import { PrismaContactsLedgerDashboardAdapter } from "../infrastructure/prisma-contacts-ledger-dashboard.adapter";
import { makeContactsService } from "@/modules/contacts/presentation/composition-root";

export function makeContactBalancesService(): ContactBalancesService {
  const contacts = makeContactsService();
  return new ContactBalancesService({
    contacts,
    existence: new ContactsExistenceAdapter(contacts),
    payments: new PrismaPaymentCreditAdapter(),
    receivables: new ReceivablesQueryAdapter(),
    payables: new PayablesQueryAdapter(),
    dashboard: new PrismaContactsLedgerDashboardAdapter(),
  });
}
