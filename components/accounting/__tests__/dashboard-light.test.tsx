import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCanAccess } = vi.hoisted(() => ({
  mockCanAccess: vi.fn(),
}));

vi.mock("@/features/permissions/server", () => ({
  canAccess: mockCanAccess,
}));

import { DashboardLight } from "../dashboard-light";

afterEach(() => cleanup());

beforeEach(() => {
  mockCanAccess.mockReset();
});

const PROPS = {
  orgSlug: "test-org",
  orgId: "org-1",
  role: "viewer",
  totalEntries: 5,
  lastEntryDate: "2026-05-10",
};

describe("DashboardLight", () => {
  it("always renders the two basic stat cards", async () => {
    mockCanAccess.mockResolvedValue(true);
    render(await DashboardLight(PROPS));
    expect(screen.getByText("Total de Asientos")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Último Asiento")).toBeInTheDocument();
    expect(screen.getByText(/10\/05\/2026/)).toBeInTheDocument();
  });

  it("renders 'Sin registros' when lastEntryDate is null", async () => {
    mockCanAccess.mockResolvedValue(true);
    render(
      await DashboardLight({
        ...PROPS,
        totalEntries: 0,
        lastEntryDate: null,
      }),
    );
    expect(screen.getByText(/Sin registros/i)).toBeInTheDocument();
  });

  it("hides accesos cards for which canAccess returns false", async () => {
    mockCanAccess.mockImplementation(
      async (_role: string, resource: string) => resource === "journal",
    );
    render(await DashboardLight(PROPS));

    expect(screen.getByRole("link", { name: /Libro Diario/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Libro Mayor/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Plan de Cuentas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Reportes/i })).not.toBeInTheDocument();
  });

  it("hides Reportes card when reports:read is denied", async () => {
    mockCanAccess.mockImplementation(
      async (_role: string, resource: string) => resource !== "reports",
    );
    render(await DashboardLight(PROPS));

    expect(screen.queryByRole("link", { name: /Reportes/i })).not.toBeInTheDocument();
  });

  it("queries canAccess with the expected (role, resource, action, orgId) for each card", async () => {
    mockCanAccess.mockResolvedValue(true);
    await DashboardLight(PROPS);

    expect(mockCanAccess).toHaveBeenCalledWith("viewer", "accounting-config", "read", "org-1");
    expect(mockCanAccess).toHaveBeenCalledWith("viewer", "journal", "read", "org-1");
    expect(mockCanAccess).toHaveBeenCalledWith("viewer", "reports", "read", "org-1");
  });
});
