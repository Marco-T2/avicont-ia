/**
 * T4.1 RED (REQ-B.1, S-B1.1..S-B1.5) — origin badge in list rows
 * T5.4 RED (REQ-C.1, S-C1.5) — Origen <Select> filter control renders with correct value
 *
 * T4.1 fails until JournalEntry interface and badge cell are added (T4.3).
 * T5.4 fails until the Origen Select control is added to filters bar (T5.8).
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

// ── T5.4: Origen <Select> filter control (REQ-C.1, S-C1.5) ──

describe("JournalEntryList — Origen filter control (REQ-C.1)", () => {
  it("T5.4a — Origen Select label is rendered in the filters bar", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[]}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{}}
      />,
    );
    // "Origen" appears both as filter Label and as table <th> column header
    const origenElements = screen.getAllByText("Origen");
    expect(origenElements.length).toBeGreaterThanOrEqual(1);
  });

  it("T5.4b — filters.origin='auto' → Select shows value 'Automático'", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[]}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{ origin: "auto" }}
      />,
    );
    // The SelectTrigger value text should be visible
    expect(screen.getByText("Automático")).toBeInTheDocument();
  });

  it("T5.4c — filters.origin='manual' → Select shows value 'Manual'", () => {
    render(
      <JournalEntryList
        orgSlug="test-org"
        entries={[]}
        periods={[BASE_PERIOD] as any}
        voucherTypes={[BASE_VOUCHER_TYPE] as any}
        filters={{ origin: "manual" }}
      />,
    );
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });
});
