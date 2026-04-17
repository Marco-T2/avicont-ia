/**
 * T4.2 RED (REQ-B.2, S-B2.1 + S-B2.2)
 * T6.4 RED (REQ-D.2) — detail renders date via formatDateBO (TZ-safe DD/MM/YYYY)
 *
 * T4.2 fails until sourceType field and badge are added in T4.4 GREEN.
 * T6.4 fails until local formatDate is replaced with formatDateBO (T6.5).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import JournalEntryDetail from "../journal-entry-detail";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Fixtures ──

function makeDetailEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "je-1",
    number: 42,
    date: "2026-04-17",
    description: "Asiento de prueba",
    status: "DRAFT",
    periodId: "period-1",
    voucherTypeId: "vt-1",
    createdAt: "2026-04-17T10:00:00.000Z",
    contact: null,
    lines: [
      {
        id: "line-1",
        debit: "500",
        credit: "0",
        description: null,
        account: { code: "1.1.1", name: "Caja" },
        contact: null,
      },
      {
        id: "line-2",
        debit: "0",
        credit: "500",
        description: null,
        account: { code: "4.1.1", name: "Ventas" },
        contact: null,
      },
    ],
    sourceType: null,
    ...overrides,
  };
}

// ── T4.2: detail renders origin badge in metadata section ──

describe("JournalEntryDetail — origin badge (REQ-B.2)", () => {
  it("S-B2.1 — sourceType=null renders badge 'Manual' in metadata", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ sourceType: null }) as any}
        periodName="Abril 2026"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("S-B2.2 — sourceType='sale' renders badge 'Generado por Venta' in metadata", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ sourceType: "sale" }) as any}
        periodName="Abril 2026"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.getByText("Generado por Venta")).toBeInTheDocument();
  });
});

// ── T6.4 RED: detail renders date via formatDateBO (TZ-safe) ──

describe("JournalEntryDetail — display-date TZ-safe (REQ-D.2)", () => {
  it("T6.4 — renders entry date as DD/MM/YYYY, not shifted under UTC-4", () => {
    // Simulate Bolivia at 21:00 local = 01:00 UTC next day
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    // Entry date stored at UTC-noon (TZ-safe convention)
    const entry = makeDetailEntry({
      date: "2026-04-17T12:00:00.000Z",
      createdAt: "2026-04-17T12:00:00.000Z",
    });

    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={entry as any}
        periodName="Abril 2026"
        voucherTypeName="Egreso"
      />,
    );

    // Must show 17/04/2026, not the locale long format ("17 de abril de 2026")
    // getAllByText because date and createdAt both render the same value
    const dateEls = screen.getAllByText("17/04/2026");
    expect(dateEls.length).toBeGreaterThanOrEqual(1);
  });
});
