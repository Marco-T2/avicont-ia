/**
 * Tests para IvaBookSaleModal
 *
 * Cubre:
 * - Renderización de todos los campos SIN
 * - estadoSIN es mandatory dropdown (A/V/C/L), sin valor default
 * - Auto-calc en onBlur de importeTotal
 * - Pre-fill desde sourceSale
 * - estadoSIN NO se pre-rellena
 * - Flujo de éxito llama endpoint de ventas
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { IvaBookSaleModal } from "../iva-book-sale-modal";

afterEach(() => cleanup());

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

function renderModal(props: Partial<Parameters<typeof IvaBookSaleModal>[0]> = {}) {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    orgSlug: "test-org",
    periods: mockPeriods,
    mode: "create-standalone" as const,
  };
  return render(<IvaBookSaleModal {...defaults} {...props} />);
}

describe("IvaBookSaleModal — campos SIN obligatorios", () => {
  it("renderiza el campo estadoSIN como select nativo", () => {
    renderModal();
    expect(screen.getByTestId("estado-sin-select")).toBeInTheDocument();
  });

  it("estadoSIN no tiene valor por defecto seleccionado", () => {
    renderModal();
    const select = screen.getByTestId("estado-sin-select") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("renderiza opciones A, V, C, L en estadoSIN", () => {
    renderModal();
    // Los valores de las options deben existir
    const select = screen.getByTestId("estado-sin-select") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(values).toContain("A");
    expect(values).toContain("V");
    expect(values).toContain("C");
    expect(values).toContain("L");
  });

  it("renderiza NIT del cliente", () => {
    renderModal();
    expect(screen.getByLabelText(/nit.*cliente/i)).toBeInTheDocument();
  });

  it("renderiza número de factura", () => {
    renderModal();
    expect(screen.getByLabelText(/número de factura/i)).toBeInTheDocument();
  });
});

describe("IvaBookSaleModal — estadoSIN obligatorio", () => {
  it("bloquea submit cuando estadoSIN no está seleccionado", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "1" }) });
    renderModal();

    // Rellenar todos los campos EXCEPTO estadoSIN
    fireEvent.change(screen.getByLabelText(/fecha de factura/i), { target: { value: "2025-01-15" } });
    fireEvent.change(screen.getByLabelText(/nit.*cliente/i), { target: { value: "87654321" } });
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: "Cliente SA" } });
    fireEvent.change(screen.getByLabelText(/número de factura/i), { target: { value: "001" } });
    fireEvent.change(screen.getByLabelText(/código de autorización/i), { target: { value: "AUTH-001" } });
    fireEvent.change(screen.getByLabelText(/importe total/i), { target: { value: "500" } });
    // estadoSIN queda vacío

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("permite submit cuando estadoSIN está seleccionado", async () => {
    const onSuccess = vi.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "sale-entry-1" }),
    });

    renderModal({ onSuccess });

    fireEvent.change(screen.getByLabelText(/fecha de factura/i), { target: { value: "2025-01-15" } });
    fireEvent.change(screen.getByLabelText(/nit.*cliente/i), { target: { value: "87654321" } });
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: "Cliente SA" } });
    fireEvent.change(screen.getByLabelText(/número de factura/i), { target: { value: "001" } });
    fireEvent.change(screen.getByLabelText(/código de autorización/i), { target: { value: "AUTH-001" } });
    fireEvent.change(screen.getByLabelText(/importe total/i), { target: { value: "500" } });
    fireEvent.change(screen.getByTestId("estado-sin-select"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("period-select"), { target: { value: "period-1" } });

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

describe("IvaBookSaleModal — auto-calc en onBlur", () => {
  it("calcula subtotal y débito fiscal al salir del campo importeTotal", async () => {
    renderModal();

    const importeTotalInput = screen.getByLabelText(/importe total/i);
    fireEvent.change(importeTotalInput, { target: { value: "1130" } });
    fireEvent.blur(importeTotalInput);

    // 1130 * 13/113 = 130.00
    await waitFor(() => {
      expect(screen.getByTestId("computed-subtotal")).toHaveTextContent("1130.00");
    });
    await waitFor(() => {
      expect(screen.getByTestId("computed-debito-fiscal")).toHaveTextContent("130.00");
    });
  });
});

describe("IvaBookSaleModal — pre-fill desde sourceSale", () => {
  it("pre-rellena los campos con datos de la venta fuente", () => {
    const sourceSale = {
      id: "sale-456",
      date: "2025-02-10",
      totalAmount: 3000,
      contact: {
        name: "Cliente Corporativo",
        nit: "99887766",
      },
    };

    renderModal({ mode: "create-from-source", sourceSale });

    expect((screen.getByLabelText(/importe total/i) as HTMLInputElement).value).toBe("3000.00");
    expect((screen.getByLabelText(/nit.*cliente/i) as HTMLInputElement).value).toBe("99887766");
    expect((screen.getByLabelText(/razón social/i) as HTMLInputElement).value).toBe("Cliente Corporativo");
    expect((screen.getByLabelText(/fecha de factura/i) as HTMLInputElement).value).toBe("2025-02-10");
  });

  it("estadoSIN NO se pre-rellena aunque venga de sourceSale", () => {
    const sourceSale = {
      id: "sale-456",
      date: "2025-02-10",
      totalAmount: 3000,
      contact: { name: "Cliente SA", nit: "12345" },
    };

    renderModal({ mode: "create-from-source", sourceSale });

    const select = screen.getByTestId("estado-sin-select") as HTMLSelectElement;
    expect(select.value).toBe("");
  });
});

describe("IvaBookSaleModal — endpoint correcto", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("llama al endpoint de ventas (no compras)", async () => {
    const onSuccess = vi.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "sale-entry-new" }),
    });

    renderModal({ onSuccess });

    fireEvent.change(screen.getByLabelText(/fecha de factura/i), { target: { value: "2025-01-15" } });
    fireEvent.change(screen.getByLabelText(/nit.*cliente/i), { target: { value: "87654321" } });
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: "Cliente SA" } });
    fireEvent.change(screen.getByLabelText(/número de factura/i), { target: { value: "001" } });
    fireEvent.change(screen.getByLabelText(/código de autorización/i), { target: { value: "AUTH-001" } });
    fireEvent.change(screen.getByLabelText(/importe total/i), { target: { value: "500" } });
    fireEvent.change(screen.getByTestId("estado-sin-select"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("period-select"), { target: { value: "period-1" } });

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/iva-books/sales"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
