/**
 * ReceivableList — unified actions dropdown (3-dots pattern)
 *
 * RED hasta que receivable-list.tsx reemplace los botones inline por
 * DropdownMenu + MoreHorizontal con aria-label="Acciones".
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReceivableList from "../receivable-list";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/contacts/contact-selector", () => ({
  default: () => <div data-testid="contact-selector" />,
}));

vi.mock("../receivable-form", () => ({
  default: () => null,
}));

vi.mock("../status-update-dialog", () => ({
  default: () => null,
}));

function makeReceivable(overrides: Record<string, unknown> = {}) {
  return {
    id: `cxc-${Math.random()}`,
    organizationId: "org-1",
    contactId: "c-1",
    description: "Factura",
    amount: 1000,
    paid: 0,
    balance: 1000,
    dueDate: new Date("2026-05-01T12:00:00.000Z"),
    status: "PENDING",
    contact: { id: "c-1", name: "Cliente Uno" },
    sourceType: null,
    sourceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ReceivableList — actions dropdown", () => {
  it("renderiza un botón 'Acciones' SOLO en filas con acciones disponibles (PENDING/PARTIAL)", () => {
    const receivables = [
      makeReceivable({ id: "r-pending", status: "PENDING" }),
      makeReceivable({ id: "r-partial", status: "PARTIAL" }),
      makeReceivable({ id: "r-paid", status: "PAID" }),
      makeReceivable({ id: "r-cancelled", status: "CANCELLED" }),
    ];
    render(<ReceivableList orgSlug="test-org" receivables={receivables as any} />);
    const triggers = screen.getAllByRole("button", { name: /acciones/i });
    expect(triggers.length).toBe(2);
  });

  it("ya no renderiza los botones inline 'Actualizar estado' ni 'Cancelar'", () => {
    const receivables = [makeReceivable({ status: "PENDING" })];
    render(<ReceivableList orgSlug="test-org" receivables={receivables as any} />);
    expect(
      screen.queryByRole("button", { name: /^actualizar estado$/i }),
    ).toBeNull();
    // Hay otros botones con "Cancelar" posibles (el dialog), pero ninguno inline en la fila.
    // Con el dropdown, el item "Cancelar" vive como menuitem, no como button directo.
    const rowCancelButtons = screen
      .queryAllByRole("button", { name: /^cancelar$/i })
      .filter((b) => b.closest("tr[data-row='cxc']"));
    expect(rowCancelButtons.length).toBe(0);
  });

  it("empty state usa colSpan=8 (columna Acciones preservada)", () => {
    render(<ReceivableList orgSlug="test-org" receivables={[]} />);
    const emptyCell = screen
      .getByText(/no hay cuentas por cobrar registradas/i)
      .closest("td");
    expect(emptyCell).not.toBeNull();
    expect(emptyCell).toHaveAttribute("colspan", "8");
  });
});
