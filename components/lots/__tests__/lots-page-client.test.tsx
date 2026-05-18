/**
 * T18 [RED → GREEN] — LotsPageClient flat table (REQ-204, D-8).
 *
 * Tabla plana cols: `Granja | Lote | Galpon | Pollos | Estado`.
 * Sort: `createdAt DESC`. Filas linkean a `/[orgSlug]/lots/[lotId]`.
 *
 * Subject lives at `app/(dashboard)/[orgSlug]/lots/lots-client.tsx`
 * (Next.js page co-location), but this RTL test lives under
 * `components/lots/__tests__/` because vitest.config restricts
 * `.test.tsx` to the `components` project (jsdom env). Aliased
 * import keeps the link explicit.
 *
 * Expected failure mode (RED): module under test does NOT exist
 * yet — vitest fails with `Failed to load url
 * @/app/(dashboard)/[orgSlug]/lots/lots-client`. After T18 GREEN
 * landing the client, all 4 cases pass.
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

import LotsPageClient from "@/app/(dashboard)/[orgSlug]/lots/lots-client";
import type { LotSnapshot } from "@/modules/lot/presentation/server";

afterEach(() => cleanup());

function makeLot(overrides: Partial<LotSnapshot> = {}): LotSnapshot {
  return {
    id: "l-1",
    name: "Lote Mayo",
    barnNumber: 1,
    initialCount: 5000,
    startDate: new Date("2026-05-01"),
    endDate: null,
    status: "ACTIVE",
    farmName: "Capinota",
    memberId: "m-1",
    organizationId: "org-1",
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
    ...overrides,
  };
}

describe("LotsPageClient — flat table (REQ-204, D-8)", () => {
  it("renders the 5 column headers in the exact spec order", () => {
    render(<LotsPageClient orgSlug="acme" lots={[makeLot()]} />);

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      "Granja",
      "Lote",
      "Galpon",
      "Pollos",
      "Estado",
    ]);
  });

  it("renders each lot as a row with link to /[orgSlug]/lots/[lotId]", () => {
    const lots = [
      makeLot({ id: "l-1", name: "Lote A", farmName: "Capinota" }),
      makeLot({
        id: "l-2",
        name: "Lote B",
        farmName: "Pocona",
        createdAt: new Date("2026-04-01"),
      }),
    ];
    render(<LotsPageClient orgSlug="acme" lots={lots} />);

    const link1 = screen.getByRole("link", { name: /Lote A/i });
    expect(link1).toHaveAttribute("href", "/acme/lots/l-1");

    const link2 = screen.getByRole("link", { name: /Lote B/i });
    expect(link2).toHaveAttribute("href", "/acme/lots/l-2");
  });

  it("sorts rows by createdAt DESC (newest first)", () => {
    const older = makeLot({
      id: "l-old",
      name: "Lote Viejo",
      createdAt: new Date("2026-01-01"),
    });
    const newer = makeLot({
      id: "l-new",
      name: "Lote Nuevo",
      createdAt: new Date("2026-05-01"),
    });
    render(
      // unsorted input — client must sort
      <LotsPageClient orgSlug="acme" lots={[older, newer]} />,
    );

    const rows = screen
      .getAllByRole("row")
      .slice(1) // drop header row
      .map((r) => within(r).getAllByRole("cell")[1]?.textContent?.trim());
    expect(rows).toEqual(["Lote Nuevo", "Lote Viejo"]);
  });

  it("renders empty state when lots list is empty", () => {
    render(<LotsPageClient orgSlug="acme" lots={[]} />);

    expect(
      screen.getByText(/No tenes lotes todavia/i),
    ).toBeInTheDocument();
    // No table rendered when empty
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
