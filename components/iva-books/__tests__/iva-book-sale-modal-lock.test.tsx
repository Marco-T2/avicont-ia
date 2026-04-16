/**
 * Tests PR4 — Bloqueo de campos monetarios cuando la entrada está vinculada a una Venta.
 *
 * Cubre:
 * - REQ-8, SC-15: campos monetarios son readOnly cuando saleId está presente
 * - REQ-9, SC-17: campos fiscales permanecen editables cuando saleId está presente
 * - REQ-10, SC-19: todos los campos son editables cuando saleId es null (standalone)
 * - REQ-8: banner informativo visible cuando los campos monetarios están bloqueados
 */

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

type EntryData = {
  id: string;
  fechaFactura: string;
  nitCliente: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  estadoSIN: string;
  fiscalPeriodId: string;
  notes: string;
  saleId: string | null;
  importeTotal: string;
  importeIce: string;
  importeIehd: string;
  importeIpj: string;
  tasas: string;
  otrosNoSujetos: string;
  exentos: string;
  tasaCero: string;
  codigoDescuentoAdicional: string;
  importeGiftCard: string;
};

/** Entrada vinculada a una venta (saleId presente) */
const linkedEntryData: EntryData = {
  id: "entry-linked",
  fechaFactura: "2025-03-15",
  nitCliente: "11223344",
  razonSocial: "Cliente Vinculado SA",
  numeroFactura: "FACT-001",
  codigoAutorizacion: "AUTH-001",
  codigoControl: "",
  estadoSIN: "A",
  fiscalPeriodId: "period-1",
  notes: "",
  saleId: "sale-abc-123",          // ← vinculada
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

/** Entrada standalone (sin saleId) */
const standaloneEntryData: EntryData = {
  ...linkedEntryData,
  id: "entry-standalone",
  saleId: null,                     // ← standalone
};

function renderEditModal(entryData: EntryData) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => entryData,
  });

  return render(
    <IvaBookSaleModal
      open={true}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      orgSlug="test-org"
      periods={mockPeriods}
      mode="edit"
      entryId={entryData.id}
    />,
  );
}

// ── REQ-8, SC-15: campos monetarios son readOnly cuando saleId está presente ──

describe("IvaBookSaleModal — bloqueo monetario cuando saleId vinculado (REQ-8, SC-15)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("importeTotal tiene atributo readOnly cuando la entrada está vinculada a una venta", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe total/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("importeIce tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe ice/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("importeIehd tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe iehd/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("importeIpj tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe ipj/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("tasas tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/tasas/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("otrosNoSujetos tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/otros no sujetos/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("exentos tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/exentos/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("tasaCero tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/tasa cero/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("descuento tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/descuento/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("importeGiftCard tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/gift card/i) as HTMLInputElement;
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("muestra banner informativo cuando los campos monetarios están bloqueados (REQ-8)", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      expect(
        screen.getByText(/importes se calculan automáticamente desde la venta vinculada/i),
      ).toBeInTheDocument();
    });
  });
});

// ── REQ-9, SC-17: campos fiscales permanecen editables cuando saleId está presente ──

describe("IvaBookSaleModal — campos fiscales editables cuando saleId vinculado (REQ-9, SC-17)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("nitCliente NO tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/nit.*cliente/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("razonSocial NO tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/razón social/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("numeroFactura NO tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/número de factura/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("codigoAutorizacion NO tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/código de autorización/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("estadoSIN (select) NO está deshabilitado cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const select = screen.getByTestId("estado-sin-select") as HTMLSelectElement;
      expect(select).not.toBeDisabled();
    });
  });
});

// ── REQ-10, SC-19: todos los campos son editables cuando saleId es null (standalone) ──

describe("IvaBookSaleModal — todos los campos editables cuando standalone (REQ-10, SC-19)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("importeTotal NO tiene readOnly cuando saleId es null", async () => {
    renderEditModal(standaloneEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe total/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("importeIce NO tiene readOnly cuando saleId es null", async () => {
    renderEditModal(standaloneEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe ice/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("tasas NO tiene readOnly cuando saleId es null", async () => {
    renderEditModal(standaloneEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/tasas/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("NO muestra el banner de bloqueo cuando saleId es null", async () => {
    renderEditModal(standaloneEntryData);

    // Wait for fetch to resolve, then assert banner is absent
    await waitFor(() => {
      expect(
        screen.queryByText(/importes se calculan automáticamente desde la venta vinculada/i),
      ).not.toBeInTheDocument();
    });
  });
});
