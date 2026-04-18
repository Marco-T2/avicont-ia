/**
 * T6.1 RED — accounting-rbac PR6
 *
 * REQ-ui-gating (resource=accounting-config, action=write):
 * - Matrix: accounting-config write = [owner, admin]
 * - contador/cobrador/auxiliar/member NO ven acciones de admin (Crear/Editar/Toggle)
 * - admin/owner SÍ ven acciones
 *
 * RED antes de que VoucherTypesManager envuelva las acciones con <Gated>.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import VoucherTypesManager from "../voucher-types-manager";

afterEach(cleanup);

// ── Mocks compartidos ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// useOrgRole mock — variable externa para ajustar por test
const mockRole = vi.hoisted(() => ({ current: "owner" as string | null }));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: mockRole.current, isLoading: false, orgSlug: "test-org" }),
}));

const ACTIVE = {
  id: "vt-ci",
  code: "CI",
  name: "Comprobante de Ingreso",
  prefix: "I",
  description: null,
  isActive: true,
  _count: { journalEntries: 12 },
};

function renderManager() {
  return render(
    <VoucherTypesManager orgSlug="test-org" initialVoucherTypes={[ACTIVE]} />,
  );
}

// ── contador hides admin actions ──

describe("VoucherTypesManager — RBAC gating (accounting-config/write)", () => {
  it("T6.1-vt-1 — role=contador: Crear/Editar/Toggle están OCULTOS", () => {
    mockRole.current = "contador";
    renderManager();

    // 'Crear' button (label: 'Nuevo tipo de comprobante')
    expect(
      screen.queryByRole("button", { name: /nuevo tipo de comprobante/i }),
    ).not.toBeInTheDocument();
    // Editar (icon button title=Editar) — not rendered
    expect(screen.queryByTitle(/editar/i)).not.toBeInTheDocument();
    // Toggle (title=Desactivar / Reactivar)
    expect(screen.queryByTitle(/desactivar|reactivar/i)).not.toBeInTheDocument();
  });

  it("T6.1-vt-2 — role=cobrador: acciones OCULTAS", () => {
    mockRole.current = "cobrador";
    renderManager();

    expect(
      screen.queryByRole("button", { name: /nuevo tipo de comprobante/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle(/editar/i)).not.toBeInTheDocument();
  });

  it("T6.1-vt-3 — role=admin: acciones VISIBLES", () => {
    mockRole.current = "admin";
    renderManager();

    expect(
      screen.getByRole("button", { name: /nuevo tipo de comprobante/i }),
    ).toBeInTheDocument();
    expect(screen.getByTitle(/editar/i)).toBeInTheDocument();
    expect(screen.getByTitle(/desactivar|reactivar/i)).toBeInTheDocument();
  });

  it("T6.1-vt-4 — role=owner: acciones VISIBLES", () => {
    mockRole.current = "owner";
    renderManager();

    expect(
      screen.getByRole("button", { name: /nuevo tipo de comprobante/i }),
    ).toBeInTheDocument();
  });
});
