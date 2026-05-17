import { describe, it, expect, vi } from "vitest";
import { ContactBalancesService } from "../contact-balances.service";
import type { ContactExistencePort } from "../../domain/ports/contact-existence.port";
import type { PaymentCreditPort } from "../../domain/ports/payment-credit.port";
import type { ReceivablesQueryPort } from "../../domain/ports/receivables-query.port";
import type { PayablesQueryPort } from "../../domain/ports/payables-query.port";
import type { ContactsLedgerDashboardPort } from "../../domain/ports/contacts-ledger-dashboard.port";
import type { ContactsService } from "@/modules/contacts/application/contacts.service";
import { Contact } from "@/modules/contacts/domain/contact.entity";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";

const ORG = "org-1";
const CONTACT_ID = "c1";

const fakeExistence = (
  overrides: Partial<ContactExistencePort> = {},
): ContactExistencePort => ({
  assertExists: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const fakePayments = (
  overrides: Partial<PaymentCreditPort> = {},
): PaymentCreditPort => ({
  findActivePaymentsForContact: vi.fn().mockResolvedValue([]),
  ...overrides,
});

const fakeReceivables = (
  overrides: Partial<ReceivablesQueryPort> = {},
): ReceivablesQueryPort => ({
  aggregateOpen: vi.fn().mockResolvedValue({ totalBalance: 0, count: 0 }),
  findPendingByContact: vi.fn().mockResolvedValue([]),
  ...overrides,
});

const fakePayables = (
  overrides: Partial<PayablesQueryPort> = {},
): PayablesQueryPort => ({
  aggregateOpen: vi.fn().mockResolvedValue({ totalBalance: 0, count: 0 }),
  findPendingByContact: vi.fn().mockResolvedValue([]),
  ...overrides,
});

const fakeContacts = (
  overrides: Partial<ContactsService> = {},
): ContactsService =>
  ({
    list: vi.fn().mockResolvedValue([]),
    ...overrides,
  }) as unknown as ContactsService;

const fakeDashboard = (
  overrides: Partial<ContactsLedgerDashboardPort> = {},
): ContactsLedgerDashboardPort => ({
  listContactsWithOpenBalance: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  }),
  ...overrides,
});

const build = (over: Partial<{
  existence: ContactExistencePort;
  payments: PaymentCreditPort;
  receivables: ReceivablesQueryPort;
  payables: PayablesQueryPort;
  contacts: ContactsService;
  dashboard: ContactsLedgerDashboardPort;
}> = {}) =>
  new ContactBalancesService({
    contacts: over.contacts ?? fakeContacts(),
    existence: over.existence ?? fakeExistence(),
    payments: over.payments ?? fakePayments(),
    receivables: over.receivables ?? fakeReceivables(),
    payables: over.payables ?? fakePayables(),
    dashboard: over.dashboard ?? fakeDashboard(),
  });

describe("ContactBalancesService.getCreditBalance", () => {
  it("asserts the contact exists before querying payments", async () => {
    const existence = fakeExistence({
      assertExists: vi.fn().mockRejectedValue(new ContactNotFound()),
    });
    const payments = fakePayments();
    const service = build({ existence, payments });
    await expect(service.getCreditBalance(ORG, CONTACT_ID)).rejects.toThrow(
      ContactNotFound,
    );
    expect(payments.findActivePaymentsForContact).not.toHaveBeenCalled();
  });

  it("computes credit balance from payment allocations", async () => {
    const payments = fakePayments({
      findActivePaymentsForContact: vi.fn().mockResolvedValue([
        {
          amount: 1000,
          allocations: [{ amount: 300, targetVoided: false }],
        },
      ]),
    });
    const service = build({ payments });
    expect(await service.getCreditBalance(ORG, CONTACT_ID)).toBe(700);
  });
});

describe("ContactBalancesService.getPendingDocuments", () => {
  it("delegates to the receivables port when type=receivable", async () => {
    const receivables = fakeReceivables({
      findPendingByContact: vi.fn().mockResolvedValue([
        {
          id: "r1",
          description: "Factura 001",
          amount: 100,
          paid: 50,
          balance: 50,
          dueDate: new Date(),
          sourceType: "SALE",
          sourceId: "s1",
          createdAt: new Date(),
        },
      ]),
    });
    const payables = fakePayables();
    const service = build({ receivables, payables });
    const result = await service.getPendingDocuments(ORG, CONTACT_ID, "receivable");
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("receivable");
    expect(payables.findPendingByContact).not.toHaveBeenCalled();
  });

  it("delegates to the payables port when type=payable", async () => {
    const receivables = fakeReceivables();
    const payables = fakePayables({
      findPendingByContact: vi.fn().mockResolvedValue([
        {
          id: "p1",
          description: "Compra 001",
          amount: 200,
          paid: 0,
          balance: 200,
          dueDate: new Date(),
          sourceType: "PURCHASE",
          sourceId: "pu1",
          createdAt: new Date(),
        },
      ]),
    });
    const service = build({ receivables, payables });
    const result = await service.getPendingDocuments(ORG, CONTACT_ID, "payable");
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("payable");
    expect(receivables.findPendingByContact).not.toHaveBeenCalled();
  });

  it("asserts contact exists before querying", async () => {
    const existence = fakeExistence({
      assertExists: vi.fn().mockRejectedValue(new ContactNotFound()),
    });
    const service = build({ existence });
    await expect(
      service.getPendingDocuments(ORG, CONTACT_ID, "receivable"),
    ).rejects.toThrow(ContactNotFound);
  });
});

describe("ContactBalancesService.getBalanceSummary", () => {
  it("aggregates totals and computes netPosition", async () => {
    const receivables = fakeReceivables({
      aggregateOpen: vi
        .fn()
        .mockResolvedValue({ totalBalance: 1500, count: 3 }),
    });
    const payables = fakePayables({
      aggregateOpen: vi
        .fn()
        .mockResolvedValue({ totalBalance: 400, count: 2 }),
    });
    const service = build({ receivables, payables });
    const summary = await service.getBalanceSummary(ORG, CONTACT_ID);
    expect(summary).toEqual({
      contactId: CONTACT_ID,
      totalReceivable: 1500,
      totalPayable: 400,
      netPosition: 1100,
      openReceivableCount: 3,
      openPayableCount: 2,
    });
  });
});

describe("ContactBalancesService.listWithBalances", () => {
  it("returns each contact paired with its balance summary", async () => {
    const c1 = Contact.create({
      organizationId: ORG,
      type: "CLIENTE",
      name: "Acme",
    });
    const c2 = Contact.create({
      organizationId: ORG,
      type: "PROVEEDOR",
      name: "Prov",
    });
    const contacts = fakeContacts({
      list: vi.fn().mockResolvedValue([c1, c2]),
    });
    const receivables = fakeReceivables({
      aggregateOpen: vi
        .fn()
        .mockResolvedValueOnce({ totalBalance: 100, count: 1 })
        .mockResolvedValueOnce({ totalBalance: 0, count: 0 }),
    });
    const payables = fakePayables({
      aggregateOpen: vi
        .fn()
        .mockResolvedValueOnce({ totalBalance: 0, count: 0 })
        .mockResolvedValueOnce({ totalBalance: 50, count: 1 }),
    });
    const service = build({ contacts, receivables, payables });
    const result = await service.listWithBalances(ORG);
    expect(result).toHaveLength(2);
    expect(result[0]!.contact).toBe(c1);
    expect(result[0]!.balanceSummary.totalReceivable).toBe(100);
    expect(result[1]!.contact).toBe(c2);
    expect(result[1]!.balanceSummary.totalPayable).toBe(50);
  });
});
