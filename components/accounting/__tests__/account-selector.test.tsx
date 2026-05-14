/**
 * RED → GREEN — <AccountSelector> generalization
 *
 * SDD task: consolidate the two duplicated account comboboxes (this one + the
 * inline AccountCombobox in org-settings-form) into a single shared component.
 *
 * Generalized contract:
 *  - NO internal hardcoded filter (`isActive && isDetail`). The parent passes the
 *    account list already filtered. The component renders exactly what it receives.
 *  - New prop `valueKey: "id" | "code"` (default "id"). The component matches the
 *    selected account and emits `onChange` using that key.
 *  - UX preserved: search by code or name, `{code} - {name}` display, clear button,
 *    role="combobox", input focus on open.
 *
 * RED failure mode declared:
 *  1. `valueKey` tests fail because the prop does not exist yet — the component
 *     always matches on `a.id`, so a `valueKey="code"` value never resolves to a
 *     selected account ("Seleccione cuenta..." stays on the trigger / onChange
 *     emits the id instead of the code).
 *  2. "renders every account it is given" fails because the current component
 *     filters internally to `a.isActive && a.isDetail`, so a non-detail / inactive
 *     account passed by the parent is dropped from the list.
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccountSelector from "../account-selector";

afterEach(() => cleanup());

type TestAccount = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isDetail: boolean;
};

const ACCOUNTS: TestAccount[] = [
  { id: "acc-1", code: "1.1.1.1", name: "Caja General", isActive: true, isDetail: true },
  { id: "acc-2", code: "1.1.3.1", name: "Banco 1", isActive: true, isDetail: true },
  { id: "acc-3", code: "1.1.3", name: "Bancos (parent)", isActive: true, isDetail: false },
  { id: "acc-4", code: "9.9.9", name: "Inactiva", isActive: false, isDetail: true },
];

function open() {
  fireEvent.click(screen.getByRole("combobox"));
}

describe("AccountSelector — generalized shared component", () => {
  it("renders every account it is given — no internal isActive/isDetail filter", () => {
    render(
      <AccountSelector accounts={ACCOUNTS} value="" onChange={() => {}} />,
    );
    open();
    // parent + inactive accounts must NOT be dropped by the component
    expect(screen.getByText("Bancos (parent)")).toBeInTheDocument();
    expect(screen.getByText("Inactiva")).toBeInTheDocument();
    expect(screen.getByText("Caja General")).toBeInTheDocument();
  });

  it("default valueKey is 'id' — matches selected account by id and emits id", () => {
    const onChange = vi.fn();
    render(
      <AccountSelector accounts={ACCOUNTS} value="acc-2" onChange={onChange} />,
    );
    // selected label resolved by id
    expect(screen.getByText("1.1.3.1 - Banco 1")).toBeInTheDocument();
    open();
    fireEvent.click(screen.getByText("Caja General"));
    expect(onChange).toHaveBeenCalledWith("acc-1");
  });

  it("valueKey='code' — matches selected account by code", () => {
    render(
      <AccountSelector
        accounts={ACCOUNTS}
        value="1.1.3.1"
        onChange={() => {}}
        valueKey="code"
      />,
    );
    // RED: prop does not exist → component matches a.id === "1.1.3.1" → no match
    expect(screen.getByText("1.1.3.1 - Banco 1")).toBeInTheDocument();
  });

  it("valueKey='code' — emits the code on selection", () => {
    const onChange = vi.fn();
    render(
      <AccountSelector
        accounts={ACCOUNTS}
        value=""
        onChange={onChange}
        valueKey="code"
      />,
    );
    open();
    fireEvent.click(screen.getByText("Banco 1"));
    // RED: current component always emits account.id
    expect(onChange).toHaveBeenCalledWith("1.1.3.1");
  });

  it("filters the list by code or name from the search input", () => {
    render(
      <AccountSelector accounts={ACCOUNTS} value="" onChange={() => {}} />,
    );
    open();
    const input = screen.getByPlaceholderText(/buscar/i);
    fireEvent.change(input, { target: { value: "Banco 1" } });
    expect(screen.getByText("Banco 1")).toBeInTheDocument();
    expect(screen.queryByText("Caja General")).not.toBeInTheDocument();
  });

  it("clear button emits the empty string", () => {
    const onChange = vi.fn();
    render(
      <AccountSelector accounts={ACCOUNTS} value="acc-1" onChange={onChange} />,
    );
    const trigger = screen.getByRole("combobox");
    // X (clear) icon is the first svg inside the trigger; ChevronsUpDown is the last
    const clearIcon = trigger.querySelectorAll("svg")[0];
    fireEvent.click(clearIcon);
    expect(onChange).toHaveBeenCalledWith("");
  });
});
