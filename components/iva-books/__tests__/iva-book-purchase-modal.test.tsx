/**
 * Tests para IvaBookPurchaseModal
 *
 * Cubre:
 * - Renderización de campos SIN obligatorios
 * - Auto-calc en onBlur de importeTotal
 * - Pre-fill desde sourcePurchase
 * - Validación bloquea submit si faltan campos requeridos
 * - Flujo de éxito: POST → onSuccess llamado
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { IvaBookPurchaseModal } from "../iva-book-purchase-modal";

afterEach(() => cleanup());

// ── Mocks globales ──────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPeriods = [
  { id: "period-1", name: "Enero 2025", startDate: "2025-01-01", endDate: "2025-01-31", status: "OPEN" },
];

function renderModal(props: Partial<Parameters<typeof IvaBookPurchaseModal>[0]> = {}) {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    orgSlug: "test-org",
    periods: mockPeriods,
    mode: "create-standalone" as const,
  };
  return render(<IvaBookPurchaseModal {...defaults} {...props} />);
}

describe("IvaBookPurchaseModal — campos SIN obligatorios", () => {
  it("renderiza el campo número de factura", () => {
    renderModal();
    expect(screen.getByLabelText(/número de factura/i)).toBeInTheDocument();
  });

  it("renderiza el campo NIT del proveedor", () => {
    renderModal();
    expect(screen.getByLabelText(/nit del proveedor/i)).toBeInTheDocument();
  });

  it("renderiza el campo razón social", () => {
    renderModal();
    expect(screen.getByLabelText(/razón social/i)).toBeInTheDocument();
  });

  it("renderiza el campo importe total", () => {
    renderModal();
    expect(screen.getByLabelText(/importe total/i)).toBeInTheDocument();
  });

  it("renderiza el campo código de autorización", () => {
    renderModal();
    expect(screen.getByLabelText(/código de autorización/i)).toBeInTheDocument();
  });

  it("renderiza el campo fecha de factura", () => {
    renderModal();
    expect(screen.getByLabelText(/fecha de factura/i)).toBeInTheDocument();
  });
});

describe("IvaBookPurchaseModal — auto-calc en onBlur", () => {
  it("calcula subtotal y crédito fiscal al salir del campo importeTotal", async () => {
    renderModal();

    const importeTotalInput = screen.getByLabelText(/importe total/i);
    fireEvent.change(importeTotalInput, { target: { value: "1000" } });
    fireEvent.blur(importeTotalInput);

    // SIN nominal: subtotal = 1000, base = 1000, cfIva = 1000 × 0.13 = 130.00
    await waitFor(() => {
      expect(screen.getByTestId("computed-subtotal")).toHaveTextContent("1000.00");
    });
    await waitFor(() => {
      expect(screen.getByTestId("computed-credito-fiscal")).toHaveTextContent("130.00");
    });
  });

  it("muestra crédito fiscal = 0 cuando importeTotal = 0", async () => {
    renderModal();

    const importeTotalInput = screen.getByLabelText(/importe total/i);
    fireEvent.change(importeTotalInput, { target: { value: "0" } });
    fireEvent.blur(importeTotalInput);

    await waitFor(() => {
      expect(screen.getByTestId("computed-credito-fiscal")).toHaveTextContent("0.00");
    });
  });
});

describe("IvaBookPurchaseModal — pre-fill desde sourcePurchase", () => {
  it("pre-rellena los campos con datos de la compra fuente", () => {
    const sourcePurchase = {
      id: "purchase-123",
      date: "2025-01-15",
      totalAmount: 2500,
      contact: {
        name: "Proveedor SA",
        nit: "12345678",
      },
    };

    renderModal({ mode: "create-from-source", sourcePurchase });

    expect((screen.getByLabelText(/importe total/i) as HTMLInputElement).value).toBe("2500.00");
    expect((screen.getByLabelText(/nit del proveedor/i) as HTMLInputElement).value).toBe("12345678");
    expect((screen.getByLabelText(/razón social/i) as HTMLInputElement).value).toBe("Proveedor SA");
    expect((screen.getByLabelText(/fecha de factura/i) as HTMLInputElement).value).toBe("2025-01-15");
  });
});

describe("IvaBookPurchaseModal — validación", () => {
  it("bloquea submit cuando faltan campos requeridos", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "1" }) });
    renderModal();

    const submitBtn = screen.getByRole("button", { name: /registrar/i });
    fireEvent.click(submitBtn);

    // fetch NO debe haberse llamado
    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe("IvaBookPurchaseModal — flujo de éxito", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("llama al API de compras y ejecuta onSuccess tras submit exitoso", async () => {
    const onSuccess = vi.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-purchase-entry" }),
    });

    renderModal({ onSuccess });

    fireEvent.change(screen.getByLabelText(/fecha de factura/i), { target: { value: "2025-01-15" } });
    fireEvent.change(screen.getByLabelText(/nit del proveedor/i), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: "Proveedor SA" } });
    fireEvent.change(screen.getByLabelText(/número de factura/i), { target: { value: "001" } });
    fireEvent.change(screen.getByLabelText(/código de autorización/i), { target: { value: "AUTH-001" } });
    fireEvent.change(screen.getByLabelText(/importe total/i), { target: { value: "1000" } });
    fireEvent.change(screen.getByTestId("period-select"), { target: { value: "period-1" } });

    const submitBtn = screen.getByRole("button", { name: /registrar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/iva-books/purchases"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

// ── PR6 Hotfix: edit-mode fetch ───────────────────────────────────────────────

describe("IvaBookPurchaseModal — mode=edit pre-fill (PR6)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("llama al endpoint GET para pre-fill cuando mode=edit y entryId está presente", async () => {
    const entryData = {
      id: "entry-abc",
      fechaFactura: "2025-03-15",
      nitProveedor: "55667788",
      razonSocial: "Proveedor Editado",
      numeroFactura: "COMP-999",
      codigoAutorizacion: "AUTH-COMP-999",
      codigoControl: "",
      tipoCompra: 1,
      fiscalPeriodId: "period-1",
      notes: "",
      importeTotal: "1130.00",
      importeIce: "0.00",
      importeIehd: "0.00",
      importeIpj: "0.00",
      tasas: "0.00",
      otrosNoSujetos: "0.00",
      exentos: "0.00",
      tasaCero: "0.00",
      codigoDescuentoAdicional: "0.00",
      importeGiftCard: "0.00",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => entryData,
    });

    renderModal({ mode: "edit", entryId: "entry-abc" });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/iva-books/purchases/entry-abc"),
      );
    });
  });

  it("pre-rellena el campo NIT del proveedor desde la respuesta del GET en mode=edit", async () => {
    const entryData = {
      id: "entry-abc",
      fechaFactura: "2025-03-15",
      nitProveedor: "55667788",
      razonSocial: "Proveedor Editado",
      numeroFactura: "COMP-999",
      codigoAutorizacion: "AUTH-COMP-999",
      codigoControl: "",
      tipoCompra: 1,
      fiscalPeriodId: "period-1",
      notes: "",
      importeTotal: "1130.00",
      importeIce: "0.00",
      importeIehd: "0.00",
      importeIpj: "0.00",
      tasas: "0.00",
      otrosNoSujetos: "0.00",
      exentos: "0.00",
      tasaCero: "0.00",
      codigoDescuentoAdicional: "0.00",
      importeGiftCard: "0.00",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => entryData,
    });

    renderModal({ mode: "edit", entryId: "entry-abc" });

    await waitFor(() => {
      expect((screen.getByLabelText(/nit del proveedor/i) as HTMLInputElement).value).toBe("55667788");
    });
  });

  it("NO llama al GET cuando mode=create-standalone", async () => {
    mockFetch.mockReset();

    renderModal({ mode: "create-standalone" });

    await new Promise((r) => setTimeout(r, 10));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
