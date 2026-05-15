import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardProClient } from "../dashboard-pro-client";
import type { AccountingDashboardDTO } from "@/modules/accounting/presentation/dto/dashboard.types";

afterEach(() => cleanup());

const ORG_SLUG = "test-org";

const FULL_DTO: AccountingDashboardDTO = {
  kpi: {
    totalEntries: 42,
    lastEntryDate: "2026-05-14",
    currentPeriod: { name: "Mayo 2026", status: "ABIERTO" },
    activoTotal: "12500.00",
    pasivoTotal: "3400.00",
    patrimonioTotal: "9100.00",
  },
  topAccounts: [
    { code: "1101", name: "Caja", movementTotal: "5000.00" },
    { code: "1201", name: "Bancos", movementTotal: "3200.00" },
    { code: "4101", name: "Ventas Mostrador", movementTotal: "2900.00" },
  ],
  monthlyTrend: [],
  closeStatus: null,
};

const EMPTY_DTO: AccountingDashboardDTO = {
  kpi: {
    totalEntries: 0,
    lastEntryDate: null,
    currentPeriod: null,
    activoTotal: "0.00",
    pasivoTotal: "0.00",
    patrimonioTotal: "0.00",
  },
  topAccounts: [],
  monthlyTrend: [],
  closeStatus: null,
};

describe("DashboardProClient", () => {
  it("renders KPI row from the DTO", () => {
    render(<DashboardProClient data={FULL_DTO} orgSlug={ORG_SLUG} />);
    expect(screen.getByText("Total de Asientos")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/Mayo 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Activo/)).toBeInTheDocument();
    expect(screen.getByText(/12.500,00|12,500\.00|12500\.00/)).toBeInTheDocument();
  });

  it("lists top accounts in the bar-chart section", () => {
    render(<DashboardProClient data={FULL_DTO} orgSlug={ORG_SLUG} />);
    expect(screen.getByText(/Cuentas más movidas/i)).toBeInTheDocument();
    expect(screen.getByText("Caja")).toBeInTheDocument();
    expect(screen.getByText("Bancos")).toBeInTheDocument();
    expect(screen.getByText("Ventas Mostrador")).toBeInTheDocument();
  });

  it("renders top-accounts empty placeholder when there are no rows", () => {
    render(<DashboardProClient data={EMPTY_DTO} orgSlug={ORG_SLUG} />);
    expect(screen.getByText(/Sin movimientos en el período/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /Registrar asiento|nuevo asiento/i });
    expect(cta).toHaveAttribute("href", expect.stringContaining(`/${ORG_SLUG}/accounting/journal`));
  });

  it("renders monthly-trend empty placeholder when the trend is empty", () => {
    render(<DashboardProClient data={FULL_DTO} orgSlug={ORG_SLUG} />);
    expect(screen.getByText(/Ingresos vs Egresos/i)).toBeInTheDocument();
    expect(screen.getByText(/Tendencia mensual no disponible|Sin datos de tendencia/i)).toBeInTheDocument();
  });

  it("renders accesos directos cards at the bottom", () => {
    render(<DashboardProClient data={FULL_DTO} orgSlug={ORG_SLUG} />);
    expect(screen.getByRole("link", { name: /Plan de Cuentas/i })).toHaveAttribute(
      "href",
      `/${ORG_SLUG}/accounting/accounts`,
    );
    expect(screen.getByRole("link", { name: /Libro Diario/i })).toHaveAttribute(
      "href",
      `/${ORG_SLUG}/accounting/journal`,
    );
  });
});
