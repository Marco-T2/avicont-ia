/**
 * Tests PR5 — Bloqueo de campos monetarios cuando la entrada está vinculada a una Compra.
 *
 * Mirrors components/iva-books/__tests__/iva-book-sale-modal-lock.test.tsx exactly.
 *
 * Cubre:
 * - REQ-11, SC-22: campos monetarios son readOnly cuando purchaseId está presente
 * - REQ-11, SC-22: campos fiscales permanecen editables cuando purchaseId está presente
 * - REQ-11: todos los campos son editables cuando purchaseId es null (standalone)
 * - REQ-11: banner informativo visible cuando los campos monetarios están bloqueados
 */

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IvaBookPurchaseModal } from "../iva-book-purchase-modal";

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
  nitProveedor: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl: string;
  tipoCompra: number;
  fiscalPeriodId: string;
  notes: string;
  purchaseId: string | null;
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

/** Entrada vinculada a una compra (purchaseId presente) */
const linkedEntryData: EntryData = {
  id: "entry-purchase-linked",
  fechaFactura: "2025-03-15",
  nitProveedor: "77889900",
  razonSocial: "Proveedor Vinculado SA",
  numeroFactura: "FAC-COMP-001",
  codigoAutorizacion: "AUTH-COMP-001",
  codigoControl: "",
  tipoCompra: 1,
  fiscalPeriodId: "period-1",
  notes: "",
  purchaseId: "purchase-abc-123",   // ← vinculada
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

/** Entrada standalone (sin purchaseId) */
const standaloneEntryData: EntryData = {
  ...linkedEntryData,
  id: "entry-purchase-standalone",
  purchaseId: null,                  // ← standalone
};

function renderEditModal(entryData: EntryData) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => entryData,
  });

  return render(
    <IvaBookPurchaseModal
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

// ── REQ-11, SC-22: campos monetarios son readOnly cuando purchaseId está presente ──

describe("IvaBookPurchaseModal — bloqueo monetario cuando purchaseId vinculado (REQ-11, SC-22)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("importeTotal tiene atributo readOnly cuando la entrada está vinculada a una compra", async () => {
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

  it("muestra banner informativo cuando los campos monetarios están bloqueados (REQ-11)", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      expect(
        screen.getByText(/importes se calculan automáticamente desde la compra vinculada/i),
      ).toBeInTheDocument();
    });
  });
});

// ── REQ-11, SC-22: campos fiscales permanecen editables cuando purchaseId está presente ──

describe("IvaBookPurchaseModal — campos fiscales editables cuando purchaseId vinculado (REQ-11, SC-22)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("nitProveedor NO tiene atributo readOnly cuando la entrada está vinculada", async () => {
    renderEditModal(linkedEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/nit.*proveedor/i) as HTMLInputElement;
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
});

// ── REQ-11: todos los campos son editables cuando purchaseId es null (standalone) ──

describe("IvaBookPurchaseModal — todos los campos editables cuando standalone (REQ-11)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("importeTotal NO tiene readOnly cuando purchaseId es null", async () => {
    renderEditModal(standaloneEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe total/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("importeIce NO tiene readOnly cuando purchaseId es null", async () => {
    renderEditModal(standaloneEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/importe ice/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("tasas NO tiene readOnly cuando purchaseId es null", async () => {
    renderEditModal(standaloneEntryData);

    await waitFor(() => {
      const input = screen.getByLabelText(/tasas/i) as HTMLInputElement;
      expect(input).not.toHaveAttribute("readonly");
    });
  });

  it("NO muestra el banner de bloqueo cuando purchaseId es null", async () => {
    renderEditModal(standaloneEntryData);

    await waitFor(() => {
      expect(
        screen.queryByText(/importes se calculan automáticamente desde la compra vinculada/i),
      ).not.toBeInTheDocument();
    });
  });
});
