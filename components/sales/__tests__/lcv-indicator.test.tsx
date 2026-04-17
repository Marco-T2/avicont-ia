/**
 * Tests RTL: LcvIndicator — máquina de estados S1/S2/S3.
 *
 * REQ-A.2: el indicador LCV debe implementar tres estados:
 *   S1 — borrador/no guardado → deshabilitado, sin interacción
 *   S2 — guardado, sin IvaSalesBook → botón neutro, onRegister al hacer click
 *   S3 — guardado, con IvaSalesBook → emerald, DropdownMenu con Ver/Editar/Desvincular
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LcvIndicator } from "../lcv-indicator";

afterEach(() => cleanup());

// Radix Dropdown usa pointerCapture en jsdom — shimear para silenciar warnings
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

// ── S1: DRAFT / no guardado ─────────────────────────────────────────────────

describe("LcvIndicator — S1 (borrador)", () => {
  it("LCV-S1-1 — renderiza un botón deshabilitado en estado S1", () => {
    render(
      <LcvIndicator
        state="S1"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("LCV-S1-2 — el botón S1 no llama a ningún handler al hacer click", () => {
    const onRegister = vi.fn();
    const onEdit = vi.fn();
    const onUnlink = vi.fn();

    render(
      <LcvIndicator
        state="S1"
        periodOpen={true}
        onRegister={onRegister}
        onEdit={onEdit}
        onUnlink={onUnlink}
      />,
    );

    // Disabled button no debe disparar click
    const btn = screen.getByRole("button");
    fireEvent.click(btn);

    expect(onRegister).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("LCV-S1-3 — el botón S1 tiene apariencia gris (clase text-muted-foreground o similar)", () => {
    render(
      <LcvIndicator
        state="S1"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    const btn = screen.getByRole("button");
    // Debe tener data-state="S1" para poder hacer asserts semánticos
    expect(btn).toHaveAttribute("data-lcv-state", "S1");
  });
});

// ── S2: guardado, sin IvaSalesBook ──────────────────────────────────────────

describe("LcvIndicator — S2 (guardado, sin LCV)", () => {
  it("LCV-S2-1 — renderiza un botón habilitado en estado S2", () => {
    render(
      <LcvIndicator
        state="S2"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
  });

  it("LCV-S2-2 — click en S2 llama a onRegister", () => {
    const onRegister = vi.fn();

    render(
      <LcvIndicator
        state="S2"
        periodOpen={true}
        onRegister={onRegister}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("LCV-S2-3 — periodOpen=false deshabilita el botón S2", () => {
    render(
      <LcvIndicator
        state="S2"
        periodOpen={false}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("LCV-S2-4 — el botón S2 tiene data-lcv-state='S2'", () => {
    render(
      <LcvIndicator
        state="S2"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    expect(screen.getByRole("button")).toHaveAttribute("data-lcv-state", "S2");
  });
});

// ── S3: guardado, con IvaSalesBook ──────────────────────────────────────────

describe("LcvIndicator — S3 (guardado, vinculado al LCV)", () => {
  it("LCV-S3-1 — renderiza un botón con clases emerald en estado S3", () => {
    render(
      <LcvIndicator
        state="S3"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-lcv-state", "S3");
    // Las clases emerald deben estar presentes en el className
    expect(btn.className).toMatch(/emerald/);
  });

  it("LCV-S3-2 — click en S3 abre el DropdownMenu mostrando las opciones", async () => {
    render(
      <LcvIndicator
        state="S3"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    // Radix DropdownMenu requiere pointerdown + click para abrirse en jsdom
    const trigger = screen.getByRole("button");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(trigger);

    // Las opciones del menú deben ser visibles tras el click
    expect(
      await screen.findByText(/editar/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/desvincular del lcv/i),
    ).toBeInTheDocument();
    // "Ver detalle LCV" fue removido — no debe aparecer
    expect(screen.queryByText(/ver detalle lcv/i)).not.toBeInTheDocument();
  });

  it("LCV-S3-3 — item 'Editar' del menú S3 llama a onEdit", async () => {
    const onEdit = vi.fn();

    render(
      <LcvIndicator
        state="S3"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={onEdit}
        onUnlink={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(trigger);
    const editItem = await screen.findByText(/editar/i);
    fireEvent.click(editItem);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("LCV-S3-4 — item 'Desvincular' del menú S3 llama a onUnlink", async () => {
    const onUnlink = vi.fn();

    render(
      <LcvIndicator
        state="S3"
        periodOpen={true}
        onRegister={vi.fn()}
        onEdit={vi.fn()}
        onUnlink={onUnlink}
      />,
    );

    const trigger = screen.getByRole("button");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(trigger);
    const unlinkItem = await screen.findByText(/desvincular del lcv/i);
    fireEvent.click(unlinkItem);

    expect(onUnlink).toHaveBeenCalledTimes(1);
  });
});
