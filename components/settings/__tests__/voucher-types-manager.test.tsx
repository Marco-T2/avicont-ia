/**
 * T5.1 RED → T5.2 GREEN
 * REQ-A.1 — Voucher-types manager list renders rows with metadata, empty state.
 *
 * A.1-S1 list order by code (active first, inactive visually distinct)
 * A.1-S2 each row shows: code, name, prefix, active badge, JE count
 * A.1-S3 empty state when zero rows
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import VoucherTypesManager from "../voucher-types-manager";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

const INACTIVE = {
  id: "vt-old",
  code: "CX",
  name: "Legacy",
  prefix: "X",
  description: null,
  isActive: false,
  _count: { journalEntries: 3 },
};

describe("VoucherTypesManager — REQ-A.1", () => {
  it("A.1-S1 — renders each voucher type with code and name", () => {
    render(
      <VoucherTypesManager
        orgSlug="org-1"
        initialVoucherTypes={[ACTIVE, INACTIVE]}
      />,
    );

    expect(screen.getByText("CI")).toBeInTheDocument();
    expect(screen.getByText("Comprobante de Ingreso")).toBeInTheDocument();
    expect(screen.getByText("CX")).toBeInTheDocument();
    expect(screen.getByText("Legacy")).toBeInTheDocument();
  });

  it("A.1-S2 — each row shows prefix, active badge, and JE count", () => {
    render(
      <VoucherTypesManager
        orgSlug="org-1"
        initialVoucherTypes={[ACTIVE, INACTIVE]}
      />,
    );

    // prefix "I" and "X" shown
    expect(screen.getByText("I")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
    // active / inactive badges
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    // journal entry counts
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("A.1-S3 — empty state when zero voucher types", () => {
    render(<VoucherTypesManager orgSlug="org-1" initialVoucherTypes={[]} />);

    expect(screen.getByText(/no hay tipos de comprobante/i)).toBeInTheDocument();
  });
});
