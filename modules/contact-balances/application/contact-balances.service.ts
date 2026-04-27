import type { ContactExistencePort } from "../domain/ports/contact-existence.port";
import type { PaymentCreditPort } from "../domain/ports/payment-credit.port";
import type { ReceivablesQueryPort } from "../domain/ports/receivables-query.port";
import type { PayablesQueryPort } from "../domain/ports/payables-query.port";
import type { Contact } from "@/modules/contacts/domain/contact.entity";
import type { ContactsService } from "@/modules/contacts/application/contacts.service";
import type { ContactFilters } from "@/modules/contacts/domain/contact.repository";
import { CreditBalance } from "../domain/value-objects/credit-balance";

export interface ContactBalanceSummary {
  contactId: string;
  totalReceivable: number;
  totalPayable: number;
  netPosition: number;
  openReceivableCount: number;
  openPayableCount: number;
}

export interface PendingDocument {
  id: string;
  type: "receivable" | "payable";
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
}

export interface ContactWithBalance {
  contact: Contact;
  balanceSummary: ContactBalanceSummary;
}

export interface ContactBalancesDeps {
  contacts: ContactsService;
  existence: ContactExistencePort;
  payments: PaymentCreditPort;
  receivables: ReceivablesQueryPort;
  payables: PayablesQueryPort;
}

export class ContactBalancesService {
  private readonly contacts: ContactsService;
  private readonly existence: ContactExistencePort;
  private readonly payments: PaymentCreditPort;
  private readonly receivables: ReceivablesQueryPort;
  private readonly payables: PayablesQueryPort;

  constructor(deps: ContactBalancesDeps) {
    this.contacts = deps.contacts;
    this.existence = deps.existence;
    this.payments = deps.payments;
    this.receivables = deps.receivables;
    this.payables = deps.payables;
  }

  async getCreditBalance(orgId: string, contactId: string): Promise<number> {
    await this.existence.assertExists(orgId, contactId);
    const payments = await this.payments.findActivePaymentsForContact(
      orgId,
      contactId,
    );
    return CreditBalance.fromPayments(payments).toNumber();
  }

  async getPendingDocuments(
    orgId: string,
    contactId: string,
    type: "receivable" | "payable",
  ): Promise<PendingDocument[]> {
    await this.existence.assertExists(orgId, contactId);
    const port = type === "receivable" ? this.receivables : this.payables;
    const docs = await port.findPendingByContact(orgId, contactId);
    return docs.map((d) => ({ ...d, type }));
  }

  async getBalanceSummary(
    orgId: string,
    contactId: string,
  ): Promise<ContactBalanceSummary> {
    const [receivable, payable] = await Promise.all([
      this.receivables.aggregateOpen(orgId, contactId),
      this.payables.aggregateOpen(orgId, contactId),
    ]);
    return {
      contactId,
      totalReceivable: receivable.totalBalance,
      totalPayable: payable.totalBalance,
      netPosition: receivable.totalBalance - payable.totalBalance,
      openReceivableCount: receivable.count,
      openPayableCount: payable.count,
    };
  }

  async listWithBalances(
    orgId: string,
    filters?: ContactFilters,
  ): Promise<ContactWithBalance[]> {
    const contacts = await this.contacts.list(orgId, filters);
    return Promise.all(
      contacts.map(async (contact) => ({
        contact,
        balanceSummary: await this.getBalanceSummary(orgId, contact.id),
      })),
    );
  }
}
