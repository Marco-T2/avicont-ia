/**
 * /payments/new — shortcut-mode tests.
 *
 * Phase 3 of register-payment-shortcut SDD change. Asserts that the Server
 * Component reads `searchParams`, calls `fetchShortcutSource`, and branches
 * on its discriminated result (ok / not-found / cross-org / voided /
 * fully-paid / invalid-params).
 *
 * Mock seam: `@/modules/payment/application/helpers/fetch-shortcut-source`
 * is mocked directly at the module boundary (page-level test convention) so
 * Prisma never enters the unit. PaymentForm is mocked too — Phase 3 only
 * verifies the prop is passed; Phase 4 owns PaymentForm itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";

const {
  mockRedirect,
  mockNotFound,
  mockRequirePermission,
  mockFetchShortcutSource,
  mockContactsList,
  mockPeriodsList,
  mockDocTypesList,
  mockOrgSettingsGetOrCreate,
  mockAccountsFindChildren,
  mockPaymentForm,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockFetchShortcutSource: vi.fn(),
  mockContactsList: vi.fn(),
  mockPeriodsList: vi.fn(),
  mockDocTypesList: vi.fn(),
  mockOrgSettingsGetOrCreate: vi.fn(),
  mockAccountsFindChildren: vi.fn(),
  mockPaymentForm: vi.fn().mockReturnValue(null),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock("@/modules/permissions/application/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/payment/application/helpers/fetch-shortcut-source", () => ({
  fetchShortcutSource: mockFetchShortcutSource,
}));

vi.mock("@/modules/contacts/presentation/server", () => ({
  makeContactsService: () => ({ list: mockContactsList }),
}));

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({ list: mockPeriodsList })),
}));

vi.mock("@/modules/operational-doc-type/presentation/server", () => ({
  makeOperationalDocTypeService: vi.fn(() => ({ list: mockDocTypesList })),
}));

vi.mock("@/modules/accounting/infrastructure/prisma-accounts.repo", () => {
  class PrismaAccountsRepo {
    findDetailChildrenByParentCodes = mockAccountsFindChildren;
  }
  return { PrismaAccountsRepo };
});

vi.mock("@/modules/org-settings/presentation/server", () => ({
  makeOrgSettingsService: () => ({
    getOrCreate: mockOrgSettingsGetOrCreate,
  }),
}));

vi.mock("@/components/payments/payment-form", () => ({
  default: mockPaymentForm,
}));

import NewPaymentPage from "../page";

const ORG_SLUG = "acme";
const ORG_ID = "org-1";
const SALE_ID = "sale-uuid-1";
const PURCHASE_ID = "purchase-uuid-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams(sp: Record<string, string>) {
  return Promise.resolve(sp);
}

function okSaleSource() {
  return {
    kind: "ok" as const,
    source: {
      kind: "sale" as const,
      id: SALE_ID,
      contactId: "cnt-1",
      voucherCode: "V-42",
      number: 42,
      referenceNumber: "REF-001",
      allocationTargetId: "rcv-1",
      balance: new Decimal("1000.00"),
      defaultDescription: "Cobro Venta #42",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });
  mockContactsList.mockResolvedValue([]);
  mockPeriodsList.mockResolvedValue([]);
  mockDocTypesList.mockResolvedValue([]);
  mockOrgSettingsGetOrCreate.mockResolvedValue({
    toSnapshot: () => ({
      cashParentCode: "1.1.1",
      pettyCashParentCode: "1.1.2",
      bankParentCode: "1.1.3",
      cajaGeneralAccountCode: "1.1.1.01",
      bancoAccountCode: "1.1.3.01",
    }),
  });
  mockAccountsFindChildren.mockResolvedValue([]);
  // redirect and notFound throw to mirror Next.js runtime behaviour and
  // terminate page rendering — keeps assertion order honest.
  mockRedirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  mockNotFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

// ── T-10 — searchParams branch + helper call ────────────────────────────────
describe("/payments/new — shortcut mode: searchParams branch (T-10)", () => {
  it("calls fetchShortcutSource once when searchParams carry type=COBRO & saleId", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce(okSaleSource());

    await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams({ type: "COBRO", saleId: SALE_ID }),
    });

    expect(mockFetchShortcutSource).toHaveBeenCalledTimes(1);
    expect(mockFetchShortcutSource).toHaveBeenCalledWith({
      orgId: ORG_ID,
      type: "COBRO",
      saleId: SALE_ID,
    });
  });

  it("calls fetchShortcutSource once when searchParams carry type=PAGO & purchaseId", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({
      kind: "ok" as const,
      source: {
        kind: "purchase" as const,
        id: PURCHASE_ID,
        contactId: "cnt-2",
        voucherCode: "C-7",
        number: 7,
        referenceNumber: null,
        allocationTargetId: "pay-1",
        balance: new Decimal("250.00"),
        defaultDescription: "Pago Compra #7",
      },
    });

    await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams({
        type: "PAGO",
        purchaseId: PURCHASE_ID,
      }),
    });

    expect(mockFetchShortcutSource).toHaveBeenCalledWith({
      orgId: ORG_ID,
      type: "PAGO",
      purchaseId: PURCHASE_ID,
    });
  });

  it("does NOT call fetchShortcutSource when neither saleId nor purchaseId is present", async () => {
    await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams({ type: "COBRO" }),
    });

    expect(mockFetchShortcutSource).not.toHaveBeenCalled();
  });

  it("falls through to the manual form (no notFound/redirect) when helper returns invalid-params", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({ kind: "invalid-params" });

    const element = await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams({ type: "COBRO", saleId: SALE_ID }),
    });

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    // The Server Component returns a React element tree without invoking the
    // PaymentForm function. Inspect the rendered PaymentForm element's props
    // directly via findPaymentFormProps().
    const formProps = findPaymentFormProps(element);
    expect(formProps).toBeDefined();
    expect(formProps?.initialValues).toBeUndefined();
  });
});

// ── T-11 — ok → PaymentForm initialValues ───────────────────────────────────
describe("/payments/new — shortcut mode: ok → initialValues (T-11)", () => {
  it("passes a fully-coerced ShortcutInitialValues to PaymentForm on ok-sale", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce(okSaleSource());

    const element = await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams({ type: "COBRO", saleId: SALE_ID }),
    });

    const formProps = findPaymentFormProps(element);
    expect(formProps).toBeDefined();
    expect(formProps?.initialValues).toEqual({
      type: "COBRO",
      contactId: "cnt-1",
      description: "Cobro Venta #42",
      sourceKind: "sale",
      sourceId: SALE_ID,
      voucherCode: "V-42",
      referenceNumber: "REF-001",
      allocationTargetId: "rcv-1",
      allocationBalance: 1000,
    });
    // DEC-1 boundary: balance must be a JS number, not a Decimal instance.
    const iv = formProps?.initialValues as { allocationBalance: number };
    expect(typeof iv.allocationBalance).toBe("number");
  });

  it("coerces decimal balance with HALF_UP to two decimal places at the boundary", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({
      kind: "ok" as const,
      source: {
        kind: "purchase" as const,
        id: PURCHASE_ID,
        contactId: "cnt-2",
        voucherCode: "C-7",
        number: 7,
        referenceNumber: null,
        allocationTargetId: "pay-1",
        // 12.345 → HALF_UP @ 2dp → 12.35
        balance: new Decimal("12.345"),
        defaultDescription: "Pago Compra #7",
      },
    });

    const element = await NewPaymentPage({
      params: makeParams(),
      searchParams: makeSearchParams({
        type: "PAGO",
        purchaseId: PURCHASE_ID,
      }),
    });

    const formProps = findPaymentFormProps(element);
    const iv = formProps?.initialValues as {
      allocationBalance: number;
      sourceKind: string;
    };
    expect(iv.allocationBalance).toBe(12.35);
    expect(iv.sourceKind).toBe("purchase");
  });
});

// ── T-12 — not-found → notFound() ───────────────────────────────────────────
describe("/payments/new — shortcut mode: not-found (T-12)", () => {
  it("calls Next.js notFound() when helper returns not-found", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({ kind: "not-found" });

    await expect(
      NewPaymentPage({
        params: makeParams(),
        searchParams: makeSearchParams({ type: "COBRO", saleId: SALE_ID }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalledTimes(1);
    // Page must NOT continue past notFound() — no redirect should fire.
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

// ── T-13 — cross-org → redirect to /{orgSlug}/payments ──────────────────────
describe("/payments/new — shortcut mode: cross-org (T-13)", () => {
  it("redirects to /{orgSlug}/payments when helper returns cross-org", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({ kind: "cross-org" });

    await expect(
      NewPaymentPage({
        params: makeParams(),
        searchParams: makeSearchParams({ type: "COBRO", saleId: SALE_ID }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}/payments`);
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});

// ── T-14 — voided → redirect to source with ?error=voided ───────────────────
describe("/payments/new — shortcut mode: voided (T-14)", () => {
  it("redirects to sale detail with ?error=voided for COBRO", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({ kind: "voided" });

    await expect(
      NewPaymentPage({
        params: makeParams(),
        searchParams: makeSearchParams({ type: "COBRO", saleId: SALE_ID }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/sales/${SALE_ID}?error=voided`,
    );
  });

  it("redirects to purchase detail with ?error=voided for PAGO", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({ kind: "voided" });

    await expect(
      NewPaymentPage({
        params: makeParams(),
        searchParams: makeSearchParams({
          type: "PAGO",
          purchaseId: PURCHASE_ID,
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/purchases/${PURCHASE_ID}?error=voided`,
    );
  });
});

// ── T-15 — fully-paid → redirect to source with ?error=fully-paid ───────────
describe("/payments/new — shortcut mode: fully-paid (T-15)", () => {
  it("redirects to sale detail with ?error=fully-paid for COBRO", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({ kind: "fully-paid" });

    await expect(
      NewPaymentPage({
        params: makeParams(),
        searchParams: makeSearchParams({ type: "COBRO", saleId: SALE_ID }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/sales/${SALE_ID}?error=fully-paid`,
    );
  });

  it("redirects to purchase detail with ?error=fully-paid for PAGO", async () => {
    mockFetchShortcutSource.mockResolvedValueOnce({ kind: "fully-paid" });

    await expect(
      NewPaymentPage({
        params: makeParams(),
        searchParams: makeSearchParams({
          type: "PAGO",
          purchaseId: PURCHASE_ID,
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/purchases/${PURCHASE_ID}?error=fully-paid`,
    );
  });
});

/**
 * Walk the React element tree returned by the Server Component and return
 * the props of the first PaymentForm element encountered. Returns undefined
 * if no PaymentForm element is present in the tree.
 *
 * The page test mocks `@/components/payments/payment-form` with a hoisted
 * `mockPaymentForm` vi.fn — that same identity is the `type` of the rendered
 * element, so we can compare by reference.
 */
function findPaymentFormProps(
  // React element shape — minimal duck-typing avoids importing react types.
  element: unknown,
): Record<string, unknown> | undefined {
  if (!element || typeof element !== "object") return undefined;
  const node = element as { type?: unknown; props?: Record<string, unknown> };
  if (node.type === mockPaymentForm) {
    return node.props ?? {};
  }
  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const c of children) {
      const found = findPaymentFormProps(c);
      if (found) return found;
    }
    return undefined;
  }
  return findPaymentFormProps(children);
}
