/**
 * T4.2 RED (REQ-B.2, S-B2.1 + S-B2.2)
 *
 * JournalEntryDetail renders an origin badge in the metadata section.
 * Fails until sourceType field and badge are added in T4.4 GREEN.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import JournalEntryDetail from "../journal-entry-detail";

afterEach(() => cleanup());

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
