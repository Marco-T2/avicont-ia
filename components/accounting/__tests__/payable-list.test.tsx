/**
 * PayableList — unified actions dropdown (3-dots pattern)
 *
 * RED hasta que payable-list.tsx reemplace los botones inline por
 * DropdownMenu + MoreHorizontal con aria-label="Acciones".
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PayableList from "../payable-list";

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

vi.mock("../payable-form", () => ({
  default: () => null,
}));

vi.mock("../status-update-dialog", () => ({
  default: () => null,
}));

function makePayable(overrides: Record<string, unknown> = {}) {
  return {
    id: `cxp-${Math.random()}`,
    organizationId: "org-1",
    contactId: "c-1",
    description: "Factura proveedor",
    amount: 1000,
    paid: 0,
    balance: 1000,
    dueDate: new Date("2026-05-01T12:00:00.000Z"),
    status: "PENDING",
    contact: { id: "c-1", name: "Proveedor Uno" },
    sourceType: null,
    sourceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("PayableList — actions dropdown", () => {
  it("renderiza un botón 'Acciones' SOLO en filas con acciones disponibles (PENDING/PARTIAL)", () => {
    const payables = [
      makePayable({ id: "p-pending", status: "PENDING" }),
      makePayable({ id: "p-partial", status: "PARTIAL" }),
      makePayable({ id: "p-paid", status: "PAID" }),
      makePayable({ id: "p-cancelled", status: "CANCELLED" }),
    ];
    render(<PayableList orgSlug="test-org" payables={payables as any} />);
    const triggers = screen.getAllByRole("button", { name: /acciones/i });
    expect(triggers.length).toBe(2);
  });

  it("ya no renderiza los botones inline 'Actualizar estado' ni 'Cancelar'", () => {
    const payables = [makePayable({ status: "PENDING" })];
    render(<PayableList orgSlug="test-org" payables={payables as any} />);
    expect(
      screen.queryByRole("button", { name: /^actualizar estado$/i }),
    ).toBeNull();
    const rowCancelButtons = screen
      .queryAllByRole("button", { name: /^cancelar$/i })
      .filter((b) => b.closest("tr[data-row='cxp']"));
    expect(rowCancelButtons.length).toBe(0);
  });

  it("empty state usa colSpan=8 (columna Acciones preservada)", () => {
    render(<PayableList orgSlug="test-org" payables={[]} />);
    const emptyCell = screen
      .getByText(/no hay cuentas por pagar registradas/i)
      .closest("td");
    expect(emptyCell).not.toBeNull();
    expect(emptyCell).toHaveAttribute("colspan", "8");
  });
});
