/**
 * Phase 5 RED → GREEN — <OrgSettingsForm> account-code combobox-with-search
 *
 * SDD change: org-settings-account-picker (combobox upgrade).
 * REQ:
 *  - Account pickers are comboboxes: trigger has role="combobox", popover opens on click.
 *  - A search input appears in the popover (placeholder "Buscar cuenta...").
 *  - Typing in the search input filters the displayed account options.
 *  - Only detail accounts appear in detail fields; only parent accounts in parent fields.
 *  - Selecting an account updates state → submit sends the chosen code.
 *
 * Pattern: Popover (radix-ui) + Input + list of <button> items — mirrors contact-selector.tsx.
 * Items are NOT role="option" (custom buttons). Opening/closing via trigger click.
 *
 * RED failure mode declared: tests that open the popover and look for a search input
 * ("Buscar cuenta...") will fail with "Unable to find an element with the placeholder
 * text of: /buscar cuenta/i" because the current implementation renders a plain Radix
 * <Select> with no search input.
 *
 * Scoping note: after opening a popover, assertions about its content use within() on
 * the data-testid="account-combobox-content" element to avoid false-negatives from
 * other trigger buttons whose selected values happen to share text with option labels.
 */

import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrgSettingsForm } from "../org-settings-form";
import type { AccountOption } from "../org-settings-form";

afterEach(() => cleanup());

beforeEach(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const DETAIL_ACCOUNTS: AccountOption[] = [
  { code: "1.1.1.1", name: "Caja General M/N", isDetail: true },
  { code: "1.1.3.1", name: "Banco 1 M/N", isDetail: true },
  { code: "1.1.3.2", name: "Banco 2 M/N", isDetail: true },
  { code: "1.1.4.1", name: "CxC Comerciales", isDetail: true },
  { code: "2.1.1.1", name: "CxP Comerciales", isDetail: true },
  { code: "5.1.9", name: "Fletes y Transporte", isDetail: true },
  { code: "5.1.1", name: "Pollo Faenado", isDetail: true },
];

const PARENT_ACCOUNTS: AccountOption[] = [
  { code: "1.1.1", name: "Caja", isDetail: false },
  { code: "1.1.2", name: "Caja Chica", isDetail: false },
  { code: "1.1.3", name: "Bancos", isDetail: false },
];

const SETTINGS = {
  id: "settings-1",
  cajaGeneralAccountCode: "1.1.1.1",
  bancoAccountCode: "1.1.3.1",
  cxcAccountCode: "1.1.4.1",
  cxpAccountCode: "2.1.1.1",
  roundingThreshold: 0.7,
  cashParentCode: "1.1.1",
  pettyCashParentCode: "1.1.2",
  bankParentCode: "1.1.3",
  fleteExpenseAccountCode: "5.1.9",
  polloFaenadoCOGSAccountCode: "5.1.1",
};

function renderForm() {
  return render(
    <OrgSettingsForm
      orgSlug="test-org"
      settings={SETTINGS}
      detailAccounts={DETAIL_ACCOUNTS}
      parentAccounts={PARENT_ACCOUNTS}
    />,
  );
}

/** Wait for the Radix Popover content portal to appear after trigger click. */
async function openPopoverFor(triggerName: string) {
  const trigger = screen.getByRole("combobox", { name: triggerName });
  fireEvent.click(trigger);
  const content = await screen.findByTestId("account-combobox-content");
  return { trigger, content };
}

describe("OrgSettingsForm — account combobox-with-search", () => {
  it("renders 9 account combobox triggers (6 detail + 3 parent)", () => {
    renderForm();
    // Each account field is a trigger button with role="combobox".
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(9);
    // roundingThreshold stays a numeric input, not a combobox.
    expect(screen.getByLabelText(/umbral de redondeo/i)).toHaveAttribute(
      "type",
      "number",
    );
  });

  it("shows the current account label on the banco trigger before opening", () => {
    renderForm();
    // settings.bancoAccountCode = "1.1.3.1" → label "1.1.3.1 - Banco 1 M/N"
    expect(screen.getByText("1.1.3.1 - Banco 1 M/N")).toBeInTheDocument();
  });

  it("opens a popover with a search input when the banco trigger is clicked", async () => {
    renderForm();
    // RED failure mode: current Radix <Select> has no search input → findByPlaceholderText
    // times out ("Unable to find an element with the placeholder text of: /buscar cuenta/i").
    const { content } = await openPopoverFor("Banco");
    const searchInput = within(content).getByPlaceholderText(/buscar cuenta/i);
    expect(searchInput).toBeInTheDocument();
  });

  it("banco popover lists only detail accounts — parent accounts excluded", async () => {
    renderForm();
    const { content } = await openPopoverFor("Banco");
    const w = within(content);

    // detail account must appear as an option button
    expect(w.getByText("1.1.3.2 - Banco 2 M/N")).toBeInTheDocument();

    // parent account code must NOT appear inside the banco popover
    expect(w.queryByText("1.1.3 - Bancos")).not.toBeInTheDocument();
  });

  it("typing in the search input filters the account list", async () => {
    renderForm();
    const { content } = await openPopoverFor("Banco");
    const w = within(content);

    const searchInput = w.getByPlaceholderText(/buscar cuenta/i);
    fireEvent.change(searchInput, { target: { value: "Banco 2" } });

    // "Banco 2 M/N" should still be visible
    expect(w.getByText("1.1.3.2 - Banco 2 M/N")).toBeInTheDocument();
    // "Banco 1 M/N" should be filtered out
    expect(w.queryByText("1.1.3.1 - Banco 1 M/N")).not.toBeInTheDocument();
  });

  it("cash-parent popover lists only parent accounts (isDetail:false) — detail excluded", async () => {
    renderForm();
    const { content } = await openPopoverFor("Cuenta padre — Caja");
    const w = within(content);

    expect(w.getByText("1.1.1 - Caja")).toBeInTheDocument();
    // a detail account must NOT appear inside the parent-field popover
    expect(w.queryByText("1.1.1.1 - Caja General M/N")).not.toBeInTheDocument();
  });

  it("selecting a new banco account submits the chosen code to the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderForm();
    const { content } = await openPopoverFor("Banco");

    // Click the new account option inside the popover
    fireEvent.click(within(content).getByText("1.1.3.2 - Banco 2 M/N"));

    // Trigger save
    fireEvent.click(
      screen.getByRole("button", { name: /guardar configuración/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/organizations/test-org/settings",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"bancoAccountCode":"1.1.3.2"'),
        }),
      );
    });
  });
});
