/**
 * Phase 5 RED — <OrgSettingsForm> account-code <Select> dropdowns
 *
 * SDD change: org-settings-account-picker — Domain 3 (org-settings-account-picker).
 * REQ:
 *  - Account Picker Shows Only Detail Accounts (postable fields list isDetail:true,
 *    parent fields list isDetail:false; option label = "{code} - {name}")
 *  - Selecting an Account Updates the Field Value (submit sends the chosen code)
 *
 * Radix Select interaction in jsdom mirrors the established precedent in
 * components/settings/__tests__/role-create-dialog.test.tsx
 * (getAllByRole("combobox") + pointerDown + findByRole("option")).
 */

import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
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

describe("OrgSettingsForm — account-code <Select> dropdowns", () => {
  it("renders each postable account field as a combobox (not a free-text input)", () => {
    renderForm();
    // 9 account-code fields become comboboxes (6 postable + 3 parent).
    // The old free-text <Input> for these fields is gone.
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(9);
    // roundingThreshold stays a numeric input
    expect(screen.getByLabelText(/umbral de redondeo/i)).toHaveAttribute(
      "type",
      "number",
    );
  });

  it("shows the current account code + name on the banco trigger", () => {
    renderForm();
    // settings.bancoAccountCode = "1.1.3.1" → option label "1.1.3.1 - Banco 1 M/N"
    expect(screen.getByText("1.1.3.1 - Banco 1 M/N")).toBeInTheDocument();
  });

  it("banco dropdown lists only detail accounts as '{code} - {name}' — parents excluded", async () => {
    renderForm();
    const bancoSelect = screen.getByRole("combobox", { name: "Banco" });
    fireEvent.pointerDown(bancoSelect, { button: 0, ctrlKey: false });
    fireEvent.click(bancoSelect);

    // detail account appears as an option
    const banco2 = await screen.findByRole("option", {
      name: "1.1.3.2 - Banco 2 M/N",
    });
    expect(banco2).toBeInTheDocument();

    // parent account "1.1.3 - Bancos" MUST NOT be a selectable option here
    expect(
      screen.queryByRole("option", { name: "1.1.3 - Bancos" }),
    ).not.toBeInTheDocument();
  });

  it("cash-parent dropdown lists only parent accounts (isDetail:false)", async () => {
    renderForm();
    const cashParentSelect = screen.getByRole("combobox", {
      name: "Cuenta padre — Caja",
    });
    fireEvent.pointerDown(cashParentSelect, { button: 0, ctrlKey: false });
    fireEvent.click(cashParentSelect);

    expect(
      await screen.findByRole("option", { name: "1.1.1 - Caja" }),
    ).toBeInTheDocument();
    // a detail account must NOT be offered for a parent field
    expect(
      screen.queryByRole("option", { name: "1.1.1.1 - Caja General M/N" }),
    ).not.toBeInTheDocument();
  });

  it("selecting a new banco account submits the chosen code to the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderForm();
    const bancoSelect = screen.getByRole("combobox", { name: "Banco" });
    fireEvent.pointerDown(bancoSelect, { button: 0, ctrlKey: false });
    fireEvent.click(bancoSelect);
    const banco2 = await screen.findByRole("option", {
      name: "1.1.3.2 - Banco 2 M/N",
    });
    fireEvent.click(banco2);

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
