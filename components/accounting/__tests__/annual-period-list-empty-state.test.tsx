/**
 * AnnualPeriodList — empty-state CTA tests.
 *
 * The empty state (org with no fiscal periods yet) renders a prominent Card
 * with "Crear primera gestión" button. The non-empty header "Nueva gestión"
 * button moved out to `<NewGestionButton />` so it can sit on the same row
 * as the page title — its own test lives in `new-gestion-button.test.tsx`.
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

describe("AnnualPeriodList — does NOT render the header 'Nueva gestión' button", () => {
  it("no renderiza 'Nueva gestión' cuando hay gestiones (moved to NewGestionButton in page header)", () => {
    render(
      <AnnualPeriodList
        orgSlug={ORG_SLUG}
        periodsByYear={[singleYearGroup(2026)]}
      />,
    );

    // Empty-state CTA stays inside this component; the always-visible
    // "Nueva gestión" header CTA moved to <NewGestionButton /> at the page
    // level so it can share a row with the page title.
    expect(
      screen.queryByRole("button", { name: /nueva gestión/i }),
    ).not.toBeInTheDocument();
  });
});

describe("AnnualPeriodList — empty-state PeriodCreateDialog wire", () => {
  it("click en CTA empty state abre PeriodCreateDialog (mock renderea cuando open=true)", () => {
    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={[]} />);

    expect(
      screen.queryByTestId("period-create-dialog-stub"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /crear primera gestión/i }),
    );

    const dialog = screen.getByTestId("period-create-dialog-stub");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-org-slug", ORG_SLUG);
  });
});
