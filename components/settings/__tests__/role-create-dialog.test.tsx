/**
 * PR7.3 RED — <RoleCreateDialog> with template selection
 *
 * REQ: CR.3-S1, CR.4-S1, U.5-S3, D.5
 * (a) Save disabled until template selected
 * (b) POST called with { name, templateSlug, slug } on Save
 * (c) slug preview updates as name typed
 * (d) dialog closes on success + triggers list refresh
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoleCreateDialog from "../role-create-dialog";

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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function setupFetch(ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => (ok ? { role: { slug: "nuevo-rol" } } : { error: "Error" }),
  }) as unknown as typeof fetch;
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /crear rol/i }));
}

describe("RoleCreateDialog (PR7.3)", () => {
  it("T7.3-1 — Save button is disabled when no template selected", async () => {
    setupFetch();
    render(<RoleCreateDialog orgSlug="test-org" onCreated={vi.fn()} />);
    await openDialog();

    const nameInput = screen.getByLabelText(/nombre/i);
    fireEvent.change(nameInput, { target: { value: "Nuevo Rol" } });

    const saveBtn = screen.getByRole("button", { name: /guardar/i });
    expect(saveBtn).toBeDisabled();
  });

  it("T7.3-2 — Save enabled once template is selected", async () => {
    setupFetch();
    render(<RoleCreateDialog orgSlug="test-org" onCreated={vi.fn()} />);
    await openDialog();

    // Type a name
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Nuevo Rol" },
    });

    // Select template
    const templateSelect = screen.getAllByRole("combobox")[0];
    fireEvent.pointerDown(templateSelect, { button: 0, ctrlKey: false });
    fireEvent.click(templateSelect);
    const memberOption = await screen.findByRole("option", { name: /member/i });
    fireEvent.click(memberOption);

    const saveBtn = screen.getByRole("button", { name: /guardar/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it("T7.3-3 — slug preview updates as name is typed", async () => {
    setupFetch();
    render(<RoleCreateDialog orgSlug="test-org" onCreated={vi.fn()} />);
    await openDialog();

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Facturador Especial" },
    });

    // slug preview should show slugified value
    expect(screen.getByText(/facturador-especial/i)).toBeInTheDocument();
  });

  it("T7.3-4 — POST called with correct payload on Save", async () => {
    setupFetch();
    render(<RoleCreateDialog orgSlug="test-org" onCreated={vi.fn()} />);
    await openDialog();

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Facturador" },
    });

    // Select template
    const templateSelect = screen.getAllByRole("combobox")[0];
    fireEvent.pointerDown(templateSelect, { button: 0, ctrlKey: false });
    fireEvent.click(templateSelect);
    const adminOption = await screen.findByRole("option", { name: /admin/i });
    fireEvent.click(adminOption);

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/organizations/test-org/roles",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"templateSlug":"admin"'),
        }),
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/organizations/test-org/roles",
        expect.objectContaining({
          body: expect.stringContaining('"name":"Facturador"'),
        }),
      );
    });
  });

  it("T7.3-5 — dialog closes on success and triggers onCreated callback", async () => {
    setupFetch(true);
    const onCreated = vi.fn();
    render(<RoleCreateDialog orgSlug="test-org" onCreated={onCreated} />);
    await openDialog();

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Nuevo" },
    });

    const templateSelect = screen.getAllByRole("combobox")[0];
    fireEvent.pointerDown(templateSelect, { button: 0, ctrlKey: false });
    fireEvent.click(templateSelect);
    const memberOption = await screen.findByRole("option", { name: /member/i });
    fireEvent.click(memberOption);

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  });
});
