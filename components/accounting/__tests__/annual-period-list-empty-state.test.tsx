/**
 * RED — empty-state CTA + header "Nueva gestión" button + PeriodCreateDialog wire.
 *
 * Bug: when an organization is newly created (no FiscalPeriods yet),
 * `app/(dashboard)/[orgSlug]/settings/periods/page.tsx` passes
 * `periodsByYear = []` to `AnnualPeriodList`, which renders an empty
 * accordion with NO call-to-action — the user is blocked from creating
 * the 12 monthly periods that frame their first fiscal year ("gestión").
 *
 * Fix scope: empty-state with prominent "Crear primera gestión" button +
 * always-visible header "Nueva gestión" button (covers forward/historical
 * planning). Both buttons open the existing (orphan) `PeriodCreateDialog`,
 * which already supports batch creation of 12 months via its internal
 * "Crear los 12 meses de {year}" action.
 *
 * Conceptual note (Marco aclaró): the ANNUAL gestión is the externally
 * validated unit (fiscal/regulator). The monthly close is an INTERNAL
 * org control — important but not externally validated.
 *
 * Expected RED failure mode:
 *   - TEST 1: empty state text NOT rendered today (component returns
 *     empty <Accordion /> when periodsByYear=[]).
 *   - TEST 2: header "Nueva gestión" button does not exist.
 *   - TEST 3: PeriodCreateDialog mock is NEVER opened — no consumer wired.
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("../annual-close-dialog", () => ({
  default: vi.fn(() => null),
}));

// Stub PeriodCreateDialog so we can assert open=true without exercising the
// real dialog's form fields. Renders a testid div ONLY when open.
vi.mock("../period-create-dialog", () => ({
  default: ({
    open,
    orgSlug,
  }: {
    open: boolean;
    orgSlug: string;
    onOpenChange: (o: boolean) => void;
    onCreated: () => void;
  }) =>
    open ? (
      <div data-testid="period-create-dialog-stub" data-org-slug={orgSlug} />
    ) : null,
}));

import AnnualPeriodList, {
  type PeriodsByYear,
} from "../annual-period-list";

const ORG_SLUG = "acme";

function buildPeriod(year: number, month: number, status: "OPEN" | "CLOSED") {
  return {
    id: `p-${year}-${String(month).padStart(2, "0")}`,
    organizationId: "org-1",
    name: `Mes ${month} ${year}`,
    year,
    month,
    startDate: new Date(`${year}-${String(month).padStart(2, "0")}-01`),
    endDate: new Date(`${year}-${String(month).padStart(2, "0")}-28`),
    status,
    closedAt:
      status === "CLOSED"
        ? new Date(`${year}-${String(month).padStart(2, "0")}-28`)
        : null,
    closedBy: status === "CLOSED" ? "user-1" : null,
    createdById: "user-1",
    createdAt: new Date(`${year}-01-01`),
    updatedAt: new Date(`${year}-01-01`),
  };
}

function singleYearGroup(year: number): PeriodsByYear[number] {
  return {
    year,
    periods: Array.from({ length: 12 }, (_, i) =>
      buildPeriod(year, i + 1, "OPEN"),
    ),
    fiscalYear: {
      id: `fy-${year}`,
      status: "OPEN",
      closedAt: null,
      closingEntryId: null,
      openingEntryId: null,
    },
    summary: null,
  };
}

describe("AnnualPeriodList — empty state (org sin gestiones)", () => {
  it("renderiza mensaje 'no tiene gestiones registradas' cuando periodsByYear=[]", () => {
    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={[]} />);

    expect(
      screen.getByText(/no tiene gestiones registradas/i),
    ).toBeInTheDocument();
  });

  it("renderiza botón CTA 'Crear primera gestión' cuando periodsByYear=[]", () => {
    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={[]} />);

    expect(
      screen.getByRole("button", { name: /crear primera gestión/i }),
    ).toBeInTheDocument();
  });
});

describe("AnnualPeriodList — header 'Nueva gestión' button (siempre visible)", () => {
  it("renderiza botón 'Nueva gestión' en header cuando hay gestiones existentes", () => {
    render(
      <AnnualPeriodList
        orgSlug={ORG_SLUG}
        periodsByYear={[singleYearGroup(2026)]}
      />,
    );

    const btn = screen.getByRole("button", { name: /nueva gestión/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });
});

describe("AnnualPeriodList — PeriodCreateDialog wire", () => {
  it("click en CTA empty state abre PeriodCreateDialog (mock renderea cuando open=true)", () => {
    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={[]} />);

    // Antes del click: dialog stub NO renderea
    expect(
      screen.queryByTestId("period-create-dialog-stub"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /crear primera gestión/i }),
    );

    // Después del click: dialog stub renderea con orgSlug propagado
    const dialog = screen.getByTestId("period-create-dialog-stub");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-org-slug", ORG_SLUG);
  });

  it("click en botón header 'Nueva gestión' abre PeriodCreateDialog", () => {
    render(
      <AnnualPeriodList
        orgSlug={ORG_SLUG}
        periodsByYear={[singleYearGroup(2026)]}
      />,
    );

    expect(
      screen.queryByTestId("period-create-dialog-stub"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nueva gestión/i }));

    expect(
      screen.getByTestId("period-create-dialog-stub"),
    ).toBeInTheDocument();
  });
});
