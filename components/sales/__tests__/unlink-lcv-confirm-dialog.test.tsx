/**
 * T2.1 RED → T2.2 GREEN
 * UnlinkLcvConfirmDialog — copy correctness + interaction
 *
 * REQ-A.3: modal debe distinguir explícitamente de "Anular venta".
 * No debe contener la palabra "Anular".
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnlinkLcvConfirmDialog } from "../unlink-lcv-confirm-dialog";

afterEach(() => cleanup());

describe("UnlinkLcvConfirmDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("renderiza título 'Desvincular del Libro de Ventas' cuando open=true", () => {
    render(<UnlinkLcvConfirmDialog {...baseProps} />);
    expect(
      screen.getByText("Desvincular del Libro de Ventas"),
    ).toBeInTheDocument();
  });

  it("renderiza el cuerpo explicando que la venta NO se anula", () => {
    render(<UnlinkLcvConfirmDialog {...baseProps} />);
    // Debe contener la aclaración de que la venta se conserva
    expect(screen.getByText(/venta se conserva/i)).toBeInTheDocument();
    // Debe mencionar que el asiento se regenera sin IVA ni IT
    expect(screen.getByText(/sin IVA ni IT/i)).toBeInTheDocument();
  });

  it("el contenido visible NO contiene la palabra 'Anular'", () => {
    const { container } = render(<UnlinkLcvConfirmDialog {...baseProps} />);
    expect(container.textContent).not.toMatch(/anular/i);
  });

  it("renderiza botón 'Cancelar'", () => {
    render(<UnlinkLcvConfirmDialog {...baseProps} />);
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("renderiza botón 'Desvincular'", () => {
    render(<UnlinkLcvConfirmDialog {...baseProps} />);
    expect(screen.getByRole("button", { name: /^desvincular$/i })).toBeInTheDocument();
  });

  it("click en 'Cancelar' llama onOpenChange(false) y NO llama onConfirm", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <UnlinkLcvConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("click en 'Desvincular' llama onConfirm una vez", () => {
    const onConfirm = vi.fn();
    render(
      <UnlinkLcvConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^desvincular$/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cuando isPending=true el botón 'Desvincular' está deshabilitado", () => {
    render(<UnlinkLcvConfirmDialog {...baseProps} isPending={true} />);
    const confirmBtn = screen.getByRole("button", { name: /desvincul/i });
    expect(confirmBtn).toBeDisabled();
  });

  it("cuando isPending=true muestra estado de carga (spinner o texto)", () => {
    render(<UnlinkLcvConfirmDialog {...baseProps} isPending={true} />);
    // El botón debe mostrar indicador de carga — buscamos el spinner o "Desvinculando..."
    const btn = screen.getByRole("button", { name: /desvincul/i });
    // Debe estar deshabilitado (isPending guard)
    expect(btn).toBeDisabled();
    // Y debe tener algún indicador visual de carga
    expect(
      btn.querySelector('[data-lucide="loader-2"]') !== null ||
      btn.textContent?.includes("...") ||
      btn.querySelector(".animate-spin") !== null,
    ).toBe(true);
  });

  it("cuando open=false no renderiza contenido del diálogo", () => {
    render(
      <UnlinkLcvConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Desvincular del Libro de Ventas"),
    ).not.toBeInTheDocument();
  });
});
