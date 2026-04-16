/**
 * Tests RTL: ConfirmTrimDialog — presentational component.
 *
 * REQ-6, SC-11, SC-12: muestra tabla de asignaciones afectadas,
 * dispara onConfirm al confirmar, onCancel al cancelar,
 * y no renderiza nada cuando open=false.
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmTrimDialog } from "../confirm-trim-dialog";
import type { TrimPreviewItem } from "../confirm-trim-dialog";

afterEach(() => cleanup());

// Radix Dialog usa pointerCapture en jsdom — shimear para silenciar warning
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

const PREVIEW: TrimPreviewItem[] = [
  {
    allocationId: "alloc-1",
    paymentDate: "2026-01-10",
    originalAmount: "500.00",
    trimmedTo: "300.00",
  },
  {
    allocationId: "alloc-2",
    paymentDate: "2026-01-20",
    originalAmount: "200.00",
    trimmedTo: "0.00",
  },
];

describe("ConfirmTrimDialog", () => {
  it("CD-1 — renders trim preview table with allocation details (REQ-6, SC-11)", () => {
    render(
      <ConfirmTrimDialog
        open={true}
        onOpenChange={vi.fn()}
        trimPreview={PREVIEW}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Título del diálogo
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/pagos afectados/i)).toBeInTheDocument();

    // Encabezados de la tabla
    expect(screen.getByText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByText(/monto original/i)).toBeInTheDocument();
    expect(screen.getByText(/se reducirá a/i)).toBeInTheDocument();

    // Filas de datos
    expect(screen.getByText("2026-01-10")).toBeInTheDocument();
    expect(screen.getByText("500.00")).toBeInTheDocument();
    expect(screen.getByText("300.00")).toBeInTheDocument();
    expect(screen.getByText("2026-01-20")).toBeInTheDocument();
    expect(screen.getByText("200.00")).toBeInTheDocument();
    expect(screen.getByText("0.00")).toBeInTheDocument();
  });

  it("CD-2 — clicking Confirmar calls onConfirm callback (REQ-6, SC-12)", () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmTrimDialog
        open={true}
        onOpenChange={vi.fn()}
        trimPreview={PREVIEW}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("CD-3 — clicking Cancelar calls onCancel callback (REQ-6)", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmTrimDialog
        open={true}
        onOpenChange={vi.fn()}
        trimPreview={PREVIEW}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("CD-4 — renders nothing (no dialog) when open=false", () => {
    render(
      <ConfirmTrimDialog
        open={false}
        onOpenChange={vi.fn()}
        trimPreview={PREVIEW}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("CD-5 — Confirmar button is disabled and shows loading state when isLoading=true", () => {
    render(
      <ConfirmTrimDialog
        open={true}
        onOpenChange={vi.fn()}
        trimPreview={PREVIEW}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />,
    );

    // When isLoading, the button text changes to "Guardando..."
    const confirmBtn = screen.getByRole("button", { name: /guardando/i });
    expect(confirmBtn).toBeDisabled();
  });
});
