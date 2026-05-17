/**
 * RED — ContactsLedgerDashboardPort contract (C6a).
 *
 * Tests the port contract via an in-memory implementation per lección C1
 * (target the runtime surface, not a bare-object cast). The in-memory
 * implementation lives inside this test file as a `Fake` class; the real
 * Prisma adapter ships in C6a GREEN.
 *
 * Cases (mirror spec REQ "Contact Dashboard"):
 *   T1 — listContactsWithOpenBalance(orgId, type, options) → paginated dto
 *        { items, total, page, pageSize, totalPages }
 *   T2 — ContactDashboardRow shape: { contactId, name,
 *        lastMovementDate: string | null, openBalance: string }
 *   T3 — type=CLIENTE filters to CLIENTE contacts only
 *   T4 — type=PROVEEDOR filters to PROVEEDOR contacts only
 *   T5 — default includeZeroBalance=false → excludes zero-balance contacts
 *   T6 — includeZeroBalance=true → includes zero-balance contacts
 *   T7 — default sort openBalance desc
 *   T8 — sort=name asc
 *   T9 — pagination (pageSize=2, page=1 + page=2)
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   Port file `../contacts-ledger-dashboard.port.ts` does NOT exist yet —
 *   `import type { ContactsLedgerDashboardPort, ContactDashboardRow }` fails
 *   at type-check / module resolution. C6a GREEN creates the port + type.
 */

import { describe, it, expect } from "vitest";
import type {
  ContactsLedgerDashboardPort,
  ContactDashboardRow,
  ContactsDashboardListOptions,
} from "../contacts-ledger-dashboard.port";

type ContactType = "CLIENTE" | "PROVEEDOR";

interface SeedContact {
  contactId: string;
  name: string;
  type: ContactType;
  openBalance: string; // Decimal string (DEC-1)
  lastMovementDate: string | null; // ISO string or null
}

class InMemoryContactsLedgerDashboardFake
  implements ContactsLedgerDashboardPort
{
  constructor(private readonly seed: SeedContact[]) {}

  async listContactsWithOpenBalance(
    _orgId: string,
    type: ContactType,
    options: ContactsDashboardListOptions = {},
  ): Promise<{
    items: ContactDashboardRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const includeZeroBalance = options.includeZeroBalance ?? false;
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const sort = options.sort ?? "openBalance";
    const direction = options.direction ?? "desc";

    let rows = this.seed.filter((c) => c.type === type);
    if (!includeZeroBalance) {
      rows = rows.filter((c) => parseFloat(c.openBalance) !== 0);
    }
    rows = rows.slice().sort((a, b) => {
      let cmp = 0;
      if (sort === "openBalance") {
        cmp = parseFloat(a.openBalance) - parseFloat(b.openBalance);
      } else if (sort === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sort === "lastMovementDate") {
        const da = a.lastMovementDate ? Date.parse(a.lastMovementDate) : 0;
        const db = b.lastMovementDate ? Date.parse(b.lastMovementDate) : 0;
        cmp = da - db;
      }
      return direction === "asc" ? cmp : -cmp;
    });

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize).map((c) => ({
      contactId: c.contactId,
      name: c.name,
      lastMovementDate: c.lastMovementDate,
      openBalance: c.openBalance,
    }));

    return { items, total, page, pageSize, totalPages };
  }
}

const SEED: SeedContact[] = [
  {
    contactId: "c-cli-1",
    name: "Alpha Cliente",
    type: "CLIENTE",
    openBalance: "1500.50",
    lastMovementDate: "2025-01-15T00:00:00.000Z",
  },
  {
    contactId: "c-cli-2",
    name: "Beta Cliente",
    type: "CLIENTE",
    openBalance: "300.00",
    lastMovementDate: "2025-01-20T00:00:00.000Z",
  },
  {
    contactId: "c-cli-3",
    name: "Gamma Cliente",
    type: "CLIENTE",
    openBalance: "0.00",
    lastMovementDate: null,
  },
  {
    contactId: "c-pro-1",
    name: "Delta Proveedor",
    type: "PROVEEDOR",
    openBalance: "800.00",
    lastMovementDate: "2025-01-10T00:00:00.000Z",
  },
];

const ORG = "org-1";

function build(seed: SeedContact[] = SEED): ContactsLedgerDashboardPort {
  return new InMemoryContactsLedgerDashboardFake(seed);
}

describe("ContactsLedgerDashboardPort.listContactsWithOpenBalance — contract", () => {
  it("T1 — returns paginated DTO { items, total, page, pageSize, totalPages }", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "CLIENTE");
    expect(result).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("T2 — each item has shape { contactId, name, lastMovementDate, openBalance }", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "CLIENTE");
    const row = result.items[0];
    expect(row).toBeDefined();
    expect(typeof row!.contactId).toBe("string");
    expect(typeof row!.name).toBe("string");
    expect(typeof row!.openBalance).toBe("string"); // DEC-1
    // lastMovementDate string|null per port contract (ISO at boundary)
    expect(
      row!.lastMovementDate === null ||
        typeof row!.lastMovementDate === "string",
    ).toBe(true);
  });

  it("T3 — type=CLIENTE filters to CLIENTE contacts only", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "CLIENTE");
    expect(result.items.map((r) => r.contactId)).toEqual(
      expect.arrayContaining(["c-cli-1", "c-cli-2"]),
    );
    expect(result.items.find((r) => r.contactId === "c-pro-1")).toBeUndefined();
  });

  it("T4 — type=PROVEEDOR filters to PROVEEDOR contacts only", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "PROVEEDOR");
    expect(result.items.map((r) => r.contactId)).toEqual(["c-pro-1"]);
  });

  it("T5 — default includeZeroBalance=false excludes zero-balance contacts", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "CLIENTE");
    expect(result.items.find((r) => r.contactId === "c-cli-3")).toBeUndefined();
  });

  it("T6 — includeZeroBalance=true includes zero-balance contacts", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "CLIENTE", {
      includeZeroBalance: true,
    });
    expect(result.items.find((r) => r.contactId === "c-cli-3")).toBeDefined();
  });

  it("T7 — default sort = openBalance desc", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "CLIENTE");
    // 1500.50 first, then 300.00
    expect(result.items.map((r) => r.contactId)).toEqual([
      "c-cli-1",
      "c-cli-2",
    ]);
  });

  it("T8 — sort=name asc orders alphabetically", async () => {
    const port = build();
    const result = await port.listContactsWithOpenBalance(ORG, "CLIENTE", {
      sort: "name",
      direction: "asc",
    });
    expect(result.items.map((r) => r.contactId)).toEqual([
      "c-cli-1", // Alpha
      "c-cli-2", // Beta
    ]);
  });

  it("T9 — pagination (pageSize=1) yields totalPages and correct page slice", async () => {
    const port = build();
    const page1 = await port.listContactsWithOpenBalance(ORG, "CLIENTE", {
      pageSize: 1,
      page: 1,
    });
    const page2 = await port.listContactsWithOpenBalance(ORG, "CLIENTE", {
      pageSize: 1,
      page: 2,
    });
    expect(page1.total).toBe(2);
    expect(page1.totalPages).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page2.items).toHaveLength(1);
    expect(page1.items[0]!.contactId).not.toBe(page2.items[0]!.contactId);
  });
});
