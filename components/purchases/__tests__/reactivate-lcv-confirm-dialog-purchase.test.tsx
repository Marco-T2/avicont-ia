/**
 * T5.1 RED → T5.2 GREEN
 * REQ-A.4: Confirm dialog for reactivating a VOIDED purchase LCV record.
 *
 * (a) title "Reactivar registro en el Libro de Compras"
 * (b) body mentions LCV registration will be restored and journal updated
 * (c) primary "Reactivar" button (default variant) calls onConfirm
 * (d) "Cancelar" closes without calling onConfirm
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReactivateLcvConfirmDialogPurchase } from "../reactivate-lcv-confirm-dialog-purchase";

afterEach(() => cleanup());

describe("ReactivateLcvConfirmDialogPurchase (T5.1 REQ-A.4)", () => {
  function renderDialog({
    onConfirm = vi.fn(),
    onOpenChange = vi.fn(),
  }: {
    onConfirm?: () => void;
    onOpenChange?: (open: boolean) => void;
  } = {}) {
    return render(
      <ReactivateLcvConfirmDialogPurchase
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
  }

  it("(a) title renders 'Reactivar registro en el Libro de Compras'", () => {
    renderDialog();
    expect(screen.getByText(/reactivar registro en el libro de compras/i)).toBeInTheDocument();
  });

  it("(b) body mentions LCV registration will be restored and journal updated", () => {
    renderDialog();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toMatch(/reactivará/i);
    expect(dialog.textContent).toMatch(/lcv/i);
    expect(dialog.textContent).toMatch(/regenerará/i);
  });

  it("(c) primary 'Reactivar' button calls onConfirm", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    const btn = screen.getByRole("button", { name: /^reactivar$/i });
    fireEvent.pointerDown(btn);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("(d) 'Cancelar' calls onOpenChange(false) without calling onConfirm", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onConfirm, onOpenChange });
    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.pointerDown(cancelBtn);
    fireEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
