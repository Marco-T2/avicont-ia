/**
 * RED → GREEN
 * ReactivateLcvConfirmDialog — copy correctness + interaction
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReactivateLcvConfirmDialog } from "../reactivate-lcv-confirm-dialog";

afterEach(() => cleanup());

describe("ReactivateLcvConfirmDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("renderiza título 'Reactivar registro en el Libro de Ventas' cuando open=true", () => {
    render(<ReactivateLcvConfirmDialog {...baseProps} />);
    expect(
      screen.getByText("Reactivar registro en el Libro de Ventas"),
    ).toBeInTheDocument();
  });

  it("renderiza el cuerpo con mención de reactivación y regeneración de asiento", () => {
    render(<ReactivateLcvConfirmDialog {...baseProps} />);
    expect(screen.getByText(/se reactivará el registro anterior del LCV/i)).toBeInTheDocument();
    expect(screen.getByText(/IVA e IT/i)).toBeInTheDocument();
  });

  it("renderiza botón 'Cancelar'", () => {
    render(<ReactivateLcvConfirmDialog {...baseProps} />);
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("renderiza botón 'Reactivar'", () => {
    render(<ReactivateLcvConfirmDialog {...baseProps} />);
    expect(screen.getByRole("button", { name: /^reactivar$/i })).toBeInTheDocument();
  });

  it("click en 'Cancelar' llama onOpenChange(false) y NO llama onConfirm", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ReactivateLcvConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("click en 'Reactivar' llama onConfirm una vez", () => {
    const onConfirm = vi.fn();
    render(
      <ReactivateLcvConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^reactivar$/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cuando isPending=true el botón 'Reactivar' está deshabilitado", () => {
    render(<ReactivateLcvConfirmDialog {...baseProps} isPending={true} />);
    // When isPending, button text changes to "Reactivando..." with a spinner icon —
    // query all buttons and find the confirm button (not Cancelar)
    const buttons = screen.queryAllByRole("button");
    const confirmBtn = buttons.find((b) => b.textContent?.includes("Reactivand") || b.textContent?.includes("Reactivar"));
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn).toBeDisabled();
  });

  it("cuando isPending=true muestra indicador de carga", () => {
    render(<ReactivateLcvConfirmDialog {...baseProps} isPending={true} />);
    const buttons = screen.queryAllByRole("button");
    const confirmBtn = buttons.find((b) => b.textContent?.includes("Reactivand") || b.textContent?.includes("Reactivar"));
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn).toBeDisabled();
    expect(
      confirmBtn!.querySelector('[data-lucide="loader-2"]') !== null ||
      confirmBtn!.textContent?.includes("...") ||
      confirmBtn!.querySelector(".animate-spin") !== null,
    ).toBe(true);
  });

  it("cuando open=false no renderiza contenido del diálogo", () => {
    render(
      <ReactivateLcvConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Reactivar registro en el Libro de Ventas"),
    ).not.toBeInTheDocument();
  });
});
