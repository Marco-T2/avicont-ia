/**
 * /accounting/cxc/[contactId] page — C8 tabs RSC test.
 *
 * RED expected failure mode: page.tsx currently renders ONLY
 * <ContactLedgerPageClient> (C5 surface). The new contract embeds it inside a
 * `<Tabs.Root defaultValue="ledger">` with two tabs:
 *   - "Libro Mayor" (default) → ContactLedgerPageClient
 *   - "CxC individuales"      → ReceivableList (pre-filtered by contactId)
 *
 * RSC tests do NOT render the React tree — they assert on:
 *   1. Service calls (mockReceivablesList + mockAttachContacts) — RSC fetch path.
 *   2. JSX tree shape returned by the async page function (traverses children
 *      to verify both ContactLedgerPageClient + ReceivableList are present and
 *      that ReceivableList received the pre-filtered receivables prop).
 *
 * Expected RED failures:
 *   1. mockReceivablesList NOT called (page does not fetch receivables).
 *   2. ReceivableList not present in returned JSX tree.
 *   3. ReceivableList props.receivables not pre-filtered.
 *
 * Mock targets bundled per [[mock_hygiene_commit_scope]] +
 * [[cross_module_boundary_mock_target_rewrite]].
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

const {
  mockRedirect,
  mockRequirePermission,
  mockContactsList,
  mockGetContactLedgerPaginated,
  mockReceivablesList,
  mockAttachContacts,
  mockReceivableList,
  mockContactLedgerPageClient,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockContactsList: vi.fn(),
  mockGetContactLedgerPaginated: vi.fn(),
  mockReceivablesList: vi.fn(),
  mockAttachContacts: vi.fn(),
  mockReceivableList: vi.fn().mockReturnValue(null),
  mockContactLedgerPageClient: vi.fn().mockReturnValue(null),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/accounting/presentation/server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/accounting/presentation/server")
  >();
  return {
    ...actual,
    makeLedgerService: () => ({
      getContactLedgerPaginated: mockGetContactLedgerPaginated,
    }),
  };
});

vi.mock("@/modules/contacts/presentation/server", () => ({
  makeContactsService: () => ({ list: mockContactsList }),
}));

vi.mock("@/modules/receivables/presentation/server", () => ({
  makeReceivablesService: () => ({ list: mockReceivablesList }),
  attachContacts: mockAttachContacts,
}));

vi.mock("@/components/accounting/contact-ledger-page-client", () => ({
  default: mockContactLedgerPageClient,
}));

vi.mock("@/components/accounting/receivable-list", () => ({
  default: mockReceivableList,
}));

import CxcContactLedgerPage from "../page";

const ORG_SLUG = "acme";
const CONTACT_ID = "contact-xyz";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, contactId: CONTACT_ID });
}

function makeSearchParams(
  sp: Record<string, string | string[] | undefined> = {},
) {
  return Promise.resolve(sp);
}

// Walk a returned JSX tree and collect every element whose `type` matches the
// given component reference. Works because React JSX is a plain tree of
// objects with `type`, `props`, `props.children`.
function collectByType(node: unknown, target: unknown): ReactElement[] {
  const found: ReactElement[] = [];
  const walk = (n: unknown): void => {
    if (n == null || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const el = n as ReactElement;
    if (el.type === target) found.push(el);
    if (el.props && (el.props as { children?: unknown }).children !== undefined) {
      walk((el.props as { children: unknown }).children);
    }
  };
  walk(node);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
  mockContactsList.mockResolvedValue([]);
  mockGetContactLedgerPaginated.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    openingBalance: "0.00",
  });
  mockReceivablesList.mockResolvedValue([]);
  mockAttachContacts.mockResolvedValue([]);
});

describe("/accounting/cxc/[contactId] — C8 tabs", () => {
  it("fetches receivables filtered by contactId for the embedded tab", async () => {
    await CxcContactLedgerPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    expect(mockReceivablesList).toHaveBeenCalledTimes(1);
    expect(mockReceivablesList).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ contactId: CONTACT_ID }),
    );
    expect(mockAttachContacts).toHaveBeenCalledWith("org-1", []);
  });

  it("returns a JSX tree containing both ContactLedgerPageClient and ReceivableList", async () => {
    const tree = await CxcContactLedgerPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    const ledgerNodes = collectByType(tree, mockContactLedgerPageClient);
    const listNodes = collectByType(tree, mockReceivableList);
    expect(ledgerNodes).toHaveLength(1);
    expect(listNodes).toHaveLength(1);
  });

  it("passes orgSlug and pre-filtered receivables to ReceivableList (preserves actions)", async () => {
    const fakeRow = {
      id: "r-1",
      organizationId: "org-1",
      contactId: CONTACT_ID,
      amount: "100.00",
      paid: "0.00",
      balance: "100.00",
      status: "PENDING",
      description: "test",
      dueDate: new Date().toISOString(),
      contact: { id: CONTACT_ID, name: "Foo SRL" },
    };
    mockReceivablesList.mockResolvedValue([{ id: "r-1" }]);
    mockAttachContacts.mockResolvedValue([fakeRow]);

    const tree = await CxcContactLedgerPage({
      params: makeParams(),
      searchParams: makeSearchParams(),
    });

    const [listEl] = collectByType(tree, mockReceivableList);
    expect(listEl).toBeDefined();
    const props = listEl.props as { orgSlug: string; receivables: Array<{ contactId: string }> };
    expect(props.orgSlug).toBe(ORG_SLUG);
    expect(Array.isArray(props.receivables)).toBe(true);
    expect(props.receivables).toHaveLength(1);
    expect(props.receivables[0].contactId).toBe(CONTACT_ID);
  });
});
