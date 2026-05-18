/**
 * Post simplify-lot-identifier: 3-col flat table with the derived
 * `displayName` ("Granja - DD/MM/YYYY") as the linked identifier.
 * Galpón column dropped; raw `name` field dropped. Sort: createdAt
 * DESC. Replaces the 5-col version from REQ-204 / D-8.
 */
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

// /lots client mounts CreateLotDialog which calls useRouter().refresh()
// after a successful create (T19 wiring). Stub the navigation surface so
// the App Router invariant doesn't fire when the table renders in jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import LotsPageClient from "@/app/(dashboard)/[orgSlug]/lots/lots-client";
import type { LotSnapshot } from "@/modules/lot/presentation/server";

afterEach(() => cleanup());

function makeLot(overrides: Partial<LotSnapshot> = {}): LotSnapshot {
  const farmName = overrides.farmName ?? "Capinota";
  const startDate = overrides.startDate ?? new Date("2026-05-01");
  return {
    id: "l-1",
    initialCount: 5000,
    startDate,
    endDate: null,
    status: "ACTIVE",
    farmName,
    displayName: overrides.displayName ?? `${farmName} - 01/05/2026`,
    memberId: "m-1",
    organizationId: "org-1",
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
    ...overrides,
  };
}

describe("LotsPageClient — 3-col flat table (post simplify-lot-identifier)", () => {
  it("renders the 3 column headers in the exact spec order", () => {
    render(<LotsPageClient orgSlug="acme" lots={[makeLot()]} />);

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim());
    expect(headers).toEqual(["Lote", "Pollos", "Estado"]);
  });

  it("renders each lot as a row with the displayName-linked identifier", () => {
    const lots = [
      makeLot({ id: "l-1", farmName: "Capinota" }),
      makeLot({
        id: "l-2",
        farmName: "Pocona",
        startDate: new Date("2026-04-01"),
        displayName: "Pocona - 01/04/2026",
        createdAt: new Date("2026-04-01"),
      }),
    ];
    render(<LotsPageClient orgSlug="acme" lots={lots} />);

    const link1 = screen.getByRole("link", { name: /Capinota - 01\/05\/2026/ });
    expect(link1).toHaveAttribute("href", "/acme/lots/l-1");

    const link2 = screen.getByRole("link", { name: /Pocona - 01\/04\/2026/ });
    expect(link2).toHaveAttribute("href", "/acme/lots/l-2");
  });

  it("sorts rows by createdAt DESC (newest first)", () => {
    const older = makeLot({
      id: "l-old",
      farmName: "Vieja",
      startDate: new Date("2026-01-01"),
      displayName: "Vieja - 01/01/2026",
      createdAt: new Date("2026-01-01"),
    });
    const newer = makeLot({
      id: "l-new",
      farmName: "Nueva",
      startDate: new Date("2026-05-01"),
      displayName: "Nueva - 01/05/2026",
      createdAt: new Date("2026-05-01"),
    });
    render(
      // unsorted input — client must sort
      <LotsPageClient orgSlug="acme" lots={[older, newer]} />,
    );

    const rows = screen
      .getAllByRole("row")
      .slice(1) // drop header row
      .map((r) => within(r).getAllByRole("cell")[0]?.textContent?.trim());
    expect(rows).toEqual(["Nueva - 01/05/2026", "Vieja - 01/01/2026"]);
  });

  it("renders empty state when lots list is empty", () => {
    render(<LotsPageClient orgSlug="acme" lots={[]} />);

    expect(
      screen.getByText(/No tenes lotes todavia/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
