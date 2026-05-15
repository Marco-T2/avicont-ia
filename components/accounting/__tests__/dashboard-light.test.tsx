import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardLight } from "../dashboard-light";

afterEach(() => cleanup());

const BASE_PROPS = {
  orgSlug: "test-org",
  totalEntries: 5,
  lastEntryDate: "2026-05-10",
};

describe("DashboardLight", () => {
  it("always renders the two basic stat cards", () => {
    render(
      <DashboardLight
        {...BASE_PROPS}
        allowedResources={["accounting-config", "journal", "reports"]}
      />,
    );
    expect(screen.getByText("Total de Asientos")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Último Asiento")).toBeInTheDocument();
    expect(screen.getByText(/10\/05\/2026/)).toBeInTheDocument();
  });

  it("renders 'Sin registros' when lastEntryDate is null", () => {
    render(
      <DashboardLight
        {...BASE_PROPS}
        totalEntries={0}
        lastEntryDate={null}
        allowedResources={[]}
      />,
    );
    expect(screen.getByText(/Sin registros/i)).toBeInTheDocument();
  });

  it("hides accesos cards whose resource is missing from allowedResources", () => {
    render(<DashboardLight {...BASE_PROPS} allowedResources={["journal"]} />);

    expect(screen.getByRole("link", { name: /Libro Diario/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Libro Mayor/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Plan de Cuentas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Reportes/i })).not.toBeInTheDocument();
  });

  it("hides Reportes card when reports resource is not in allowedResources", () => {
    render(
      <DashboardLight
        {...BASE_PROPS}
        allowedResources={["accounting-config", "journal"]}
      />,
    );

    expect(screen.queryByRole("link", { name: /Reportes/i })).not.toBeInTheDocument();
  });

  it("renders no accesos when allowedResources is empty", () => {
    render(<DashboardLight {...BASE_PROPS} allowedResources={[]} />);

    expect(screen.queryByRole("link", { name: /Plan de Cuentas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Libro Diario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Libro Mayor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Reportes/i })).not.toBeInTheDocument();
  });
});
