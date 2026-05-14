/**
 * PR3.3 [RED] — Tests for MatrixWarnings component
 * REQ-RM.16, REQ-RM.17, REQ-RM.18, REQ-RM.19, REQ-RM.20
 *
 * All tests must fail with "Cannot find module '@/components/settings/matrix-warnings'"
 * until PR3.4 [GREEN] creates the component.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, it, expect } from "vitest";
import { MatrixWarnings } from "@/components/settings/matrix-warnings";
import type { Warning } from "@/lib/settings/compute-warnings";

afterEach(cleanup);

describe("<MatrixWarnings />", () => {
  // (a) Empty array → renders nothing (null)
  it("(a) empty warnings array → renders nothing", () => {
    const { container } = render(<MatrixWarnings warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // (b) 1 warning → renders 1 message
  it("(b) one empty-sidebar warning → renders its message", () => {
    const warnings: Warning[] = [
      {
        severity: "soft",
        kind: "empty-sidebar",
        message: "Este rol no va a ver ningún módulo. ¿Seguro querés guardarlo así?",
      },
    ];
    render(<MatrixWarnings warnings={warnings} />);
    expect(
      screen.getByText(/Este rol no va a ver ningún módulo/),
    ).toBeInTheDocument();
  });

  // (c) write-without-read warning → message contains resource Spanish label
  it("(c) write-without-read warning → badge contains Libro Diario and Ver/Editar hint", () => {
    const warnings: Warning[] = [
      {
        severity: "soft",
        kind: "write-without-read",
        resource: "journal",
        message: `Activaste Editar en "Libro Diario" sin Ver. El rol no va a poder llegar a la pantalla.`,
      },
    ];
    render(<MatrixWarnings warnings={warnings} />);
    expect(screen.getByText(/Libro Diario/)).toBeInTheDocument();
    // Message contains the word "Ver"
    expect(screen.getByText(/Ver/)).toBeInTheDocument();
  });

  // (d) post-without-write warning → message contains resource Spanish label + Editar/Registrar
  it("(d) post-without-write warning → badge contains Ventas and Editar/Registrar hint", () => {
    const warnings: Warning[] = [
      {
        severity: "soft",
        kind: "post-without-write",
        resource: "sales",
        message: `Activaste Registrar en "Ventas" sin Editar. Sin Editar no vas a poder cargar el comprobante.`,
      },
    ];
    render(<MatrixWarnings warnings={warnings} />);
    expect(screen.getByText(/Ventas/)).toBeInTheDocument();
    expect(screen.getByText(/Editar/)).toBeInTheDocument();
  });

  // (e) visual treatment — warning semantic token class (migrated a91279ac), NOT red
  it("(e) warning container uses warning semantic token class (not red)", () => {
    const warnings: Warning[] = [
      {
        severity: "soft",
        kind: "empty-sidebar",
        message: "Este rol no va a ver ningún módulo. ¿Seguro querés guardarlo así?",
      },
    ];
    const { container } = render(<MatrixWarnings warnings={warnings} />);
    const html = container.innerHTML;
    // Must have at least one warning-token class (semantic: bg-warning/*, text-warning, border-warning/*)
    // or yellow/amber literal classes (both accepted for forward-compat)
    const hasWarningClass =
      html.includes("bg-warning") ||
      html.includes("border-warning") ||
      html.includes("text-warning") ||
      html.includes("bg-yellow") ||
      html.includes("border-yellow") ||
      html.includes("text-yellow") ||
      html.includes("bg-amber") ||
      html.includes("border-amber") ||
      html.includes("text-amber");
    expect(hasWarningClass).toBe(true);
    // Must NOT use red
    const hasRed =
      html.includes("bg-red") ||
      html.includes("border-red") ||
      html.includes("text-red");
    expect(hasRed).toBe(false);
  });

  // 3 warnings → renders 3 items
  it("(combined) 3 warnings → renders 3 separate messages", () => {
    const warnings: Warning[] = [
      {
        severity: "soft",
        kind: "empty-sidebar",
        message: "Este rol no va a ver ningún módulo. ¿Seguro querés guardarlo así?",
      },
      {
        severity: "soft",
        kind: "write-without-read",
        resource: "journal",
        message: `Activaste Editar en "Libro Diario" sin Ver. El rol no va a poder llegar a la pantalla.`,
      },
      {
        severity: "soft",
        kind: "post-without-write",
        resource: "sales",
        message: `Activaste Registrar en "Ventas" sin Editar. Sin Editar no vas a poder cargar el comprobante.`,
      },
    ];
    render(<MatrixWarnings warnings={warnings} />);
    // All three distinct pieces of text must be present
    expect(screen.getByText(/ningún módulo/)).toBeInTheDocument();
    expect(screen.getByText(/Libro Diario/)).toBeInTheDocument();
    expect(screen.getByText(/Ventas/)).toBeInTheDocument();
  });
});
