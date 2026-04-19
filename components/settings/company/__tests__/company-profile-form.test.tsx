/**
 * T6.7 — CompanyProfileForm tests.
 *
 * Covers REQ-OP.10:
 *   - Saving Identidad only PATCHes /profile (not signature-configs)
 *   - 400 response renders fieldErrors under the correct inputs
 *   - 200 response fires toast.success and router.refresh()
 */
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRouter = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { CompanyProfileForm } from "../company-profile-form";
import type { DocumentPrintType } from "@/generated/prisma/client";

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

const ORG_SLUG = "test-org";

const defaultProfile = {
  id: "p-1",
  organizationId: "org-1",
  razonSocial: "Empresa X",
  nit: "12345",
  direccion: "Calle 1",
  ciudad: "Sucre",
  telefono: "123",
  nroPatronal: null as string | null,
  logoUrl: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeViews() {
  const types: DocumentPrintType[] = [
    "BALANCE_GENERAL",
    "ESTADO_RESULTADOS",
    "COMPROBANTE",
    "DESPACHO",
    "VENTA",
    "COMPRA",
    "COBRO",
    "PAGO",
  ];
  return types.map((documentType) => ({
    documentType,
    labels: [],
    showReceiverRow: false,
  }));
}

describe("CompanyProfileForm — Identity save", () => {
  it("al guardar Identidad, solo PATCH al endpoint /profile (no signature-configs)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...defaultProfile, razonSocial: "Nueva Razón" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CompanyProfileForm
        orgSlug={ORG_SLUG}
        profile={defaultProfile}
        views={makeViews()}
      />,
    );

    const input = screen.getByTestId("identity-razonSocial");
    fireEvent.change(input, { target: { value: "Nueva Razón" } });

    const saveBtn = screen.getByTestId("identity-save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/organizations/${ORG_SLUG}/profile`);
    expect(init.method).toBe("PATCH");
    // No llamó a signature-configs
    const signatureCalls = calls.filter((c) =>
      String(c[0]).includes("/signature-configs"),
    );
    expect(signatureCalls).toHaveLength(0);
  });

  it("en 200: llama toast.success y router.refresh()", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...defaultProfile, razonSocial: "OK" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CompanyProfileForm
        orgSlug={ORG_SLUG}
        profile={defaultProfile}
        views={makeViews()}
      />,
    );

    const saveBtn = screen.getByTestId("identity-save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
      expect(mockRouter.refresh).toHaveBeenCalled();
    });
  });

  it("en 400 con fieldErrors: renderiza el error bajo el input correcto", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Datos inválidos",
        details: {
          fieldErrors: {
            razonSocial: ["La razón social es requerida"],
          },
          formErrors: [],
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CompanyProfileForm
        orgSlug={ORG_SLUG}
        profile={defaultProfile}
        views={makeViews()}
      />,
    );

    const saveBtn = screen.getByTestId("identity-save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const err = screen.getByTestId("identity-razonSocial-error");
      expect(err).toHaveTextContent("La razón social es requerida");
    });
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });
});
