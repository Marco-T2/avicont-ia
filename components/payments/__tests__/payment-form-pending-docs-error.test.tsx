/**
 * RED → GREEN — payment-form NO debe tragarse en silencio un fallo de red
 * al cargar documentos pendientes en modo ALTA (isNew).
 *
 * Bug real (2026-05-22): el fetch de pending-documents devolvía 404 (route
 * handler dinámico no resuelto por Turbopack stale). En `fetchPendingDocuments`
 * el error solo se toasteaba cuando `!isNew`; en alta (isNew) el `!docsRes.ok`
 * caía en NINGUNA rama → la UI mostraba "No hay documentos pendientes para este
 * cliente" disfrazando un fallo de red de "el cliente no debe nada".
 *
 * Contrato esperado: un `!docsRes.ok` debe surfacear un toast.error en AMBOS
 * modos (alta y edición). El empty-state "No hay documentos" queda reservado
 * para el caso legítimo (fetch ok + lista vacía).
 *
 * RED failure mode declarado: con el código actual, en create-mode COBRO el
 * fetch !ok NO llama a toast.error → `expect(toast.error).toHaveBeenCalled()`
 * falla. Tras el fix, pasa.
 */

import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import PaymentForm from "../payment-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "owner", isLoading: false, orgSlug: "test-org" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/shared/justification-modal", () => ({
  JustificationModal: () => null,
}));

// fetch mock por URL: pending-documents falla (!ok), el resto OK para aislar
// el path bajo prueba (que NO crashee por undefined.map en unapplied/credit).
beforeEach(() => {
  vi.mocked(toast.error).mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/pending-documents")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        });
      }
      if (url.includes("/credit-balance")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ creditBalance: 0 }) });
      }
      if (url.includes("/unapplied-payments")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ payments: [] }) });
      }
      // Lista del ContactSelector: /api/organizations/test-org/contacts?...
      if (url.includes("/contacts?")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ contacts: [{ id: "contact-1", name: "Marco", type: "CLIENTE", nit: null }] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Fixtures ──

const BASE_PERIOD = {
  id: "period-1",
  name: "Mayo 2026",
  startDate: new Date("2026-05-01"),
  endDate: new Date("2026-05-31"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  month: 5,
  closedAt: null,
  closedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BASE_CONTACTS = [{ id: "contact-1", name: "Marco", type: "CLIENTE" }];

function renderCreateMode() {
  return render(
    <SystemRoleProvider role="owner">
      <PaymentForm
        orgSlug="test-org"
        contacts={BASE_CONTACTS}
        periods={[BASE_PERIOD]}
        defaultType="COBRO"
        userRole="owner"
      />
    </SystemRoleProvider>,
  );
}

// ── Test ──

describe("payment-form — fallo de red al cargar pendientes NO se traga en silencio (alta)", () => {
  it("create-mode COBRO: pending-documents !ok dispara toast.error", async () => {
    renderCreateMode();

    // Abrir el ContactSelector (scope al card "Cliente" para evitar el otro combobox).
    const contactLabel = screen.getByText(/^Cliente$/);
    const card = contactLabel.closest("div.space-y-2") as HTMLElement;
    fireEvent.click(within(card).getByRole("combobox"));

    // Esperar a que la lista cargue y seleccionar el contacto → setContactId →
    // useEffect → fetchPendingDocuments → pending-documents !ok.
    fireEvent.click(await screen.findByText("Marco"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
