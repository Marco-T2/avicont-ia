/**
 * T6.1 — LabelPicker component tests.
 *
 * Covers REQ-OP.10:
 *   - initial labels render in order
 *   - ↓ reorders ["ELABORADO","APROBADO"] → ["APROBADO","ELABORADO"]
 *   - × removes label
 *   - "Agregar" dropdown adds a previously absent label
 *   - already-selected labels are NOT offered in "Agregar"
 *   - showReceiverRow checkbox toggles and fires onChange
 */
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LabelPicker } from "../label-picker";

afterEach(() => cleanup());

beforeEach(() => {
  // Radix Select shims
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

describe("LabelPicker", () => {
  it("renderiza las labels iniciales en el orden recibido", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO", "APROBADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const items = screen.getAllByTestId("label-picker-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Elaborado por");
    expect(items[1]).toHaveTextContent("Aprobado por");
  });

  it("↓ mueve la primera label hacia abajo (reorder)", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO", "APROBADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const items = screen.getAllByTestId("label-picker-item");
    const downBtn = within(items[0]).getByRole("button", { name: /bajar/i });
    fireEvent.click(downBtn);

    expect(onChange).toHaveBeenCalledWith({
      labels: ["APROBADO", "ELABORADO"],
      showReceiverRow: false,
    });
  });

  it("↑ mueve una label hacia arriba (reorder)", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO", "APROBADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const items = screen.getAllByTestId("label-picker-item");
    const upBtn = within(items[1]).getByRole("button", { name: /subir/i });
    fireEvent.click(upBtn);

    expect(onChange).toHaveBeenCalledWith({
      labels: ["APROBADO", "ELABORADO"],
      showReceiverRow: false,
    });
  });

  it("× elimina la label de la lista", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO", "APROBADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const items = screen.getAllByTestId("label-picker-item");
    const removeBtn = within(items[0]).getByRole("button", { name: /eliminar/i });
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith({
      labels: ["APROBADO"],
      showReceiverRow: false,
    });
  });

  it("el dropdown 'Agregar' NO incluye labels ya seleccionadas", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO", "APROBADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    // El picker usa un <select> nativo para el dropdown "Agregar" — le pasamos
    // test-id al elemento para localizarlo deterministamente en tests
    const select = screen.getByTestId("label-picker-add") as HTMLSelectElement;
    const values = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== ""); // skip placeholder

    expect(values).not.toContain("ELABORADO");
    expect(values).not.toContain("APROBADO");
    // Los 5 restantes deben estar disponibles
    expect(values).toEqual(
      expect.arrayContaining([
        "VISTO_BUENO",
        "PROPIETARIO",
        "REVISADO",
        "REGISTRADO",
        "CONTABILIZADO",
      ]),
    );
  });

  it("el dropdown 'Agregar' añade una label al final de la lista", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const select = screen.getByTestId("label-picker-add") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "VISTO_BUENO" } });

    expect(onChange).toHaveBeenCalledWith({
      labels: ["ELABORADO", "VISTO_BUENO"],
      showReceiverRow: false,
    });
  });

  it("el checkbox showReceiverRow dispara onChange con el nuevo valor", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByTestId("label-picker-receiver") as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({
      labels: ["ELABORADO"],
      showReceiverRow: true,
    });
  });

  it("↑ en la primera label no hace nada (ya está arriba)", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO", "APROBADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const items = screen.getAllByTestId("label-picker-item");
    const upBtn = within(items[0]).getByRole("button", { name: /subir/i });
    expect(upBtn).toBeDisabled();
  });

  it("↓ en la última label está disabled", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker
        labels={["ELABORADO", "APROBADO"]}
        showReceiverRow={false}
        onChange={onChange}
      />,
    );

    const items = screen.getAllByTestId("label-picker-item");
    const downBtn = within(items[1]).getByRole("button", { name: /bajar/i });
    expect(downBtn).toBeDisabled();
  });
});
