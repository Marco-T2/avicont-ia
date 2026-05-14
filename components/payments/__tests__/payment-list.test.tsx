/**
 * PaymentList — unified actions dropdown (3-dots pattern)
 *
 * RED hasta que payment-list.tsx reemplace los botones inline por
 * DropdownMenu + MoreHorizontal con aria-label="Acciones".
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentList from "../payment-list";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: `pay-${Math.random()}`,
    organizationId: "org-1",
    contactId: "c-1",
    date: new Date("2026-04-17T12:00:00.000Z"),
    amount: 100,
    method: "EFECTIVO",
    description: "Test payment",
    status: "DRAFT",
    referenceNumber: null,
    operationalDocType: null,
    contact: { id: "c-1", name: "Cliente Uno", type: "CLIENTE" },
    allocations: [],
    journalEntryId: null,
    periodId: "p-1",
    createdById: "u-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const CONTACTS = [{ id: "c-1", name: "Cliente Uno", type: "CLIENTE" }];

describe("PaymentList — actions dropdown", () => {
  it("renderiza un botón 'Acciones' por cada fila (MoreHorizontal)", () => {
    const payments = [
      makePayment({ id: "p-draft", status: "DRAFT" }),
      makePayment({ id: "p-posted", status: "POSTED" }),
      makePayment({ id: "p-locked", status: "LOCKED" }),
      makePayment({ id: "p-voided", status: "VOIDED" }),
    ];
    render(
      <PaymentList
        orgSlug="test-org"
        items={payments as any}
        total={payments.length}
        page={1}
        pageSize={25}
        totalPages={1}
        contacts={CONTACTS}
      />,
    );
    const triggers = screen.getAllByRole("button", { name: /acciones/i });
    expect(triggers.length).toBe(4);
  });

  it("ya no renderiza múltiples botones inline por fila (Editar/Contabilizar/Eliminar)", () => {
    const payments = [makePayment({ status: "DRAFT" })];
    render(
      <PaymentList
        orgSlug="test-org"
        items={payments as any}
        total={payments.length}
        page={1}
        pageSize={25}
        totalPages={1}
        contacts={CONTACTS}
      />,
    );
    // Antes había 3 botones visibles (Editar + Contabilizar + Eliminar).
    // Con el dropdown, esos textos SÓLO aparecen dentro del menú (oculto hasta click).
    expect(screen.queryByRole("button", { name: /^editar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^contabilizar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^eliminar$/i })).toBeNull();
  });

  it("empty state usa colSpan=11 (columna Acciones preservada)", () => {
    render(
      <PaymentList
        orgSlug="test-org"
        items={[]}
        total={0}
        page={1}
        pageSize={25}
        totalPages={1}
        contacts={CONTACTS}
      />,
    );
    const emptyCell = screen
      .getByText(/no hay cobros ni pagos registrados/i)
      .closest("td");
    expect(emptyCell).not.toBeNull();
    expect(emptyCell).toHaveAttribute("colspan", "11");
  });
});
