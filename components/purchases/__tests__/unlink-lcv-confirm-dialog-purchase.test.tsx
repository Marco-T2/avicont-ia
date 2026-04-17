/**
 * T4.1 RED → T4.2 GREEN
 * REQ-A.3: Confirm dialog for unlink purchase from LCV.
 *
 * Assertions:
 * (a) title renders "Desvincular del Libro de Compras"
 * (b) body copy does NOT contain the word "Anular"
 * (c) body explicitly mentions the purchase is preserved
 * (d) primary button "Desvincular" calls onConfirm
 * (e) "Cancelar" calls onOpenChange(false) without calling onConfirm
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnlinkLcvConfirmDialogPurchase } from "../unlink-lcv-confirm-dialog-purchase";

afterEach(() => cleanup());

describe("UnlinkLcvConfirmDialogPurchase (T4.1 REQ-A.3)", () => {
  function renderDialog({
    onConfirm = vi.fn(),
    onOpenChange = vi.fn(),
  }: {
    onConfirm?: () => void;
    onOpenChange?: (open: boolean) => void;
  } = {}) {
    return render(
      <UnlinkLcvConfirmDialogPurchase
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
  }

  it("(a) title renders 'Desvincular del Libro de Compras'", () => {
    renderDialog();
    expect(screen.getByText(/desvincular del libro de compras/i)).toBeInTheDocument();
  });

  it("(b) body copy does NOT contain the word 'Anular'", () => {
    renderDialog();
    const description = screen.getByRole("dialog");
    expect(description.textContent).not.toMatch(/anular/i);
  });

  it("(c) body explicitly mentions the purchase is preserved", () => {
    renderDialog();
    expect(screen.getByText(/compra se conserva/i)).toBeInTheDocument();
  });

  it("(d) primary button 'Desvincular' calls onConfirm", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    const btn = screen.getByRole("button", { name: /^desvincular$/i });
    fireEvent.pointerDown(btn);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("(e) 'Cancelar' calls onOpenChange(false) without calling onConfirm", () => {
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
