/**
 * T4.1 RED (REQ-B.1, S-B1.1..S-B1.5)
 *
 * JournalEntryList renders an origin badge for each entry using
 * sourceTypeLabel(). Fails until JournalEntry interface and badge cell
 * are added in T4.3 GREEN.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import JournalEntryList from "../journal-entry-list";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// ── Fixtures ──

const BASE_PERIOD = {
  id: "period-1",
  name: "Abril 2026",
  startDate: new Date("2026-04-01"),
  endDate: new Date("2026-04-30"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BASE_VOUCHER_TYPE = {
  id: "vt-1",
  code: "CE",
  name: "Egreso",
  description: null,
  isActive: true,
  organizationId: "org-1",
};

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: `entry-${Math.random()}`,
    number: 1,
    referenceNumber: null,
    date: "2026-04-17",
    description: "Test entry",
    status: "DRAFT",
    periodId: "period-1",
    voucherTypeId: "vt-1",
    contact: null,
    lines: [{ debit: "100", credit: "0", account: { code: "1.1.1", name: "Caja" } }],
    sourceType: null,
    ...overrides,
  };
}

// ── T4.1: list renders origin badge per sourceType ──

describe("JournalEntryList — origin badge (REQ-B.1)", () => {
  it("S-B1.1 — sourceType=null renders badge 'Manual'", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[makeEntry({ sourceType: null })] as any}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{}}
      />,
    );
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("S-B1.2 — sourceType='sale' renders badge 'Generado por Venta'", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[makeEntry({ sourceType: "sale" })] as any}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{}}
      />,
    );
    expect(screen.getByText("Generado por Venta")).toBeInTheDocument();
  });

  it("S-B1.3 — sourceType='purchase' renders badge 'Generado por Compra'", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[makeEntry({ sourceType: "purchase" })] as any}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{}}
      />,
    );
    expect(screen.getByText("Generado por Compra")).toBeInTheDocument();
  });

  it("S-B1.4 — sourceType='dispatch' renders badge 'Generado por Despacho'", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[makeEntry({ sourceType: "dispatch" })] as any}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{}}
      />,
    );
    expect(screen.getByText("Generado por Despacho")).toBeInTheDocument();
  });

  it("S-B1.5 — sourceType='payment' renders badge 'Generado por Pago'", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[makeEntry({ sourceType: "payment" })] as any}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{}}
      />,
    );
    expect(screen.getByText("Generado por Pago")).toBeInTheDocument();
  });

  it("S-B1.all — five entries with different sourceTypes render five distinct badges", () => {
    const entries = [
      makeEntry({ id: "e1", sourceType: null }),
      makeEntry({ id: "e2", sourceType: "sale" }),
      makeEntry({ id: "e3", sourceType: "purchase" }),
      makeEntry({ id: "e4", sourceType: "dispatch" }),
      makeEntry({ id: "e5", sourceType: "payment" }),
    ];
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={entries as any}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{}}
      />,
    );
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Generado por Venta")).toBeInTheDocument();
    expect(screen.getByText("Generado por Compra")).toBeInTheDocument();
    expect(screen.getByText("Generado por Despacho")).toBeInTheDocument();
    expect(screen.getByText("Generado por Pago")).toBeInTheDocument();
  });
});
