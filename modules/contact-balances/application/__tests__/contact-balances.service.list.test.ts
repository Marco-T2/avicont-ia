/**
 * RED — ContactBalancesService.listContactsWithOpenBalance contract (C6b).
 *
 * Cases:
 *   T1 — delegates to the ContactsLedgerDashboardPort with (orgId, type,
 *        options).
 *   T2 — default options: includeZeroBalance=false, page=1, pageSize=20,
 *        sort=openBalance, direction=desc.
 *   T3 — passes through explicit options unchanged.
 *   T4 — type=PROVEEDOR forwards "PROVEEDOR" to the port.
 *   T5 — invalid type → ValidationError (boundary defense; service must
 *        only accept "CLIENTE" | "PROVEEDOR").
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   `service.listContactsWithOpenBalance` does not exist (TypeError: ... is
 *   not a function) AND constructor will eventually require a new
 *   `dashboard: ContactsLedgerDashboardPort` dependency. C6b GREEN adds the
 *   method + wires the port into the constructor; C6b GREEN also updates
 *   the existing service test factory to include the new port default per
 *   [[mock_hygiene_commit_scope]].
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContactBalancesService } from "../contact-balances.service";
import type { ContactExistencePort } from "../../domain/ports/contact-existence.port";
import type { PaymentCreditPort } from "../../domain/ports/payment-credit.port";
import type { ReceivablesQueryPort } from "../../domain/ports/receivables-query.port";
import type { PayablesQueryPort } from "../../domain/ports/payables-query.port";
import type { ContactsLedgerDashboardPort } from "../../domain/ports/contacts-ledger-dashboard.port";
import type { ContactsService } from "@/modules/contacts/application/contacts.service";
import { ValidationError } from "@/features/shared/errors";

const ORG = "org-1";

const fakeExistence = (): ContactExistencePort => ({
  assertExists: vi.fn().mockResolvedValue(undefined),
});
const fakePayments = (): PaymentCreditPort => ({
  findActivePaymentsForContact: vi.fn().mockResolvedValue([]),
});
const fakeReceivables = (): ReceivablesQueryPort => ({
  aggregateOpen: vi.fn().mockResolvedValue({ totalBalance: 0, count: 0 }),
  findPendingByContact: vi.fn().mockResolvedValue([]),
});
const fakePayables = (): PayablesQueryPort => ({
  aggregateOpen: vi.fn().mockResolvedValue({ totalBalance: 0, count: 0 }),
  findPendingByContact: vi.fn().mockResolvedValue([]),
});
const fakeContacts = (): ContactsService =>
  ({ list: vi.fn().mockResolvedValue([]) }) as unknown as ContactsService;

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

function build(
  over: Partial<{
    dashboard: ContactsLedgerDashboardPort;
  }> = {},
) {
  return new ContactBalancesService({
    contacts: fakeContacts(),
    existence: fakeExistence(),
    payments: fakePayments(),
    receivables: fakeReceivables(),
    payables: fakePayables(),
    dashboard: over.dashboard ?? fakeDashboard(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContactBalancesService.listContactsWithOpenBalance", () => {
  it("T1 — delegates to the dashboard port with (orgId, type, options)", async () => {
    const dashboard = fakeDashboard();
    const svc = build({ dashboard });
    await svc.listContactsWithOpenBalance(ORG, "CLIENTE", {
      includeZeroBalance: true,
      page: 2,
      pageSize: 10,
      sort: "name",
      direction: "asc",
    });
    expect(dashboard.listContactsWithOpenBalance).toHaveBeenCalledWith(
      ORG,
      "CLIENTE",
      {
        includeZeroBalance: true,
        page: 2,
        pageSize: 10,
        sort: "name",
        direction: "asc",
      },
    );
  });

  it("T2 — defaults: includeZeroBalance=false, page=1, pageSize=20, sort=openBalance, direction=desc", async () => {
    const dashboard = fakeDashboard();
    const svc = build({ dashboard });
    await svc.listContactsWithOpenBalance(ORG, "CLIENTE");
    expect(dashboard.listContactsWithOpenBalance).toHaveBeenCalledWith(
      ORG,
      "CLIENTE",
      {
        includeZeroBalance: false,
        page: 1,
        pageSize: 20,
        sort: "openBalance",
        direction: "desc",
      },
    );
  });

  it("T3 — passes through explicit options unchanged", async () => {
    const dashboard = fakeDashboard();
    const svc = build({ dashboard });
    await svc.listContactsWithOpenBalance(ORG, "PROVEEDOR", {
      sort: "lastMovementDate",
      direction: "asc",
    });
    expect(dashboard.listContactsWithOpenBalance).toHaveBeenCalledWith(
      ORG,
      "PROVEEDOR",
      {
        includeZeroBalance: false,
        page: 1,
        pageSize: 20,
        sort: "lastMovementDate",
        direction: "asc",
      },
    );
  });

  it("T4 — type=PROVEEDOR forwards 'PROVEEDOR' to the port", async () => {
    const dashboard = fakeDashboard();
    const svc = build({ dashboard });
    await svc.listContactsWithOpenBalance(ORG, "PROVEEDOR");
    expect(
      vi.mocked(dashboard.listContactsWithOpenBalance).mock.calls[0]![1],
    ).toBe("PROVEEDOR");
  });

  it("T5 — invalid type → ValidationError", async () => {
    const svc = build();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      svc.listContactsWithOpenBalance(ORG, "INVALID" as any),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
