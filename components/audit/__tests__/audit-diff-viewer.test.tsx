/**
 * T27 RED — AuditDiffViewer whitelist + edge cases.
 *
 * Expected failure: `Cannot find module '../audit-diff-viewer'`. GREEN tras T22.
 *
 * Cobertura REQ-AUDIT.9 (A9-S1 … A9-S5) + edge cases de INSERT/DELETE/absent field.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditEvent } from "@/modules/audit/presentation";
import { AuditDiffViewer } from "../audit-diff-viewer";

afterEach(() => cleanup());

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: overrides.id ?? "audit_1",
    createdAt: overrides.createdAt ?? new Date("2026-04-24T12:00:00Z"),
    entityType: overrides.entityType ?? "sales",
    entityId: overrides.entityId ?? "sale_1",
    action: overrides.action ?? "UPDATE",
    classification: overrides.classification ?? "directa",
    changedBy: overrides.changedBy ?? { id: "u1", name: "Alice" },
    justification: overrides.justification ?? null,
    parentVoucherType: overrides.parentVoucherType ?? "sales",
    parentVoucherId: overrides.parentVoucherId ?? "sale_1",
    parentSourceType: overrides.parentSourceType ?? null,
    oldValues: overrides.oldValues ?? null,
    newValues: overrides.newValues ?? null,
    correlationId: overrides.correlationId ?? null,
  };
}

describe("AuditDiffViewer — whitelist por entityType (A9-S1)", () => {
  it("solo renderiza campos de DIFF_FIELDS['sales'] — ignora internalNotes y createdBy", () => {
    render(
      <AuditDiffViewer
        event={makeEvent({
          entityType: "sales",
          oldValues: {
            totalAmount: 100,
            internalNotes: "secret",
            createdBy: "user_ghost",
          },
          newValues: {
            totalAmount: 150,
            internalNotes: "updated secret",
            createdBy: "user_ghost",
          },
        })}
      />,
    );

    // "Monto total" está en DIFF_FIELDS['sales']
    expect(screen.getByText("Monto total")).toBeInTheDocument();
    // internalNotes y createdBy NO están en DIFF_FIELDS['sales']
    expect(screen.queryByText("internalNotes")).not.toBeInTheDocument();
    expect(screen.queryByText("createdBy")).not.toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.queryByText("user_ghost")).not.toBeInTheDocument();
  });
});

describe("AuditDiffViewer — labels en español (A9-S2)", () => {
  it("renderiza 'Monto total' en vez de 'totalAmount'", () => {
    render(
      <AuditDiffViewer
        event={makeEvent({
          entityType: "sales",
          oldValues: { totalAmount: 100 },
          newValues: { totalAmount: 150 },
        })}
      />,
    );
    expect(screen.getByText("Monto total")).toBeInTheDocument();
    expect(screen.queryByText("totalAmount")).not.toBeInTheDocument();
  });
});

describe("AuditDiffViewer — cambio de valor destacado (A9-S3)", () => {
  it("muestra antes y después cuando el valor cambió", () => {
    render(
      <AuditDiffViewer
        event={makeEvent({
          entityType: "sales",
          oldValues: { description: "Pedido abril" },
          newValues: { description: "Pedido abril corregido" },
        })}
      />,
    );
    expect(screen.getByText("Pedido abril")).toBeInTheDocument();
    expect(screen.getByText("Pedido abril corregido")).toBeInTheDocument();
  });
});

describe("AuditDiffViewer — oldValues null (INSERT)", () => {
  it("no crashea y no renderiza columna 'Antes' poblada", () => {
    render(
      <AuditDiffViewer
        event={makeEvent({
          entityType: "sales",
          action: "CREATE",
          oldValues: null,
          newValues: { description: "Nuevo pedido", totalAmount: 500 },
        })}
      />,
    );
    // Los valores de newValues se muestran
    expect(screen.getByText("Nuevo pedido")).toBeInTheDocument();
  });
});

describe("AuditDiffViewer — newValues null (DELETE)", () => {
  it("no crashea y muestra valores viejos en columna 'Antes'", () => {
    render(
      <AuditDiffViewer
        event={makeEvent({
          entityType: "sales",
          action: "DELETE",
          oldValues: { description: "Pedido cancelado", totalAmount: 500 },
          newValues: null,
        })}
      />,
    );
    expect(screen.getByText("Pedido cancelado")).toBeInTheDocument();
  });
});

describe("AuditDiffViewer — campo ausente en una de las dos versiones (A9-S4)", () => {
  it("renderiza '—' cuando el campo está presente en oldValues pero ausente en newValues", () => {
    render(
      <AuditDiffViewer
        event={makeEvent({
          entityType: "sales",
          oldValues: { description: "texto viejo" },
          newValues: {}, // description ausente en newValues
        })}
      />,
    );
    expect(screen.getByText("texto viejo")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("AuditDiffViewer — valores idénticos no se renderizan", () => {
  it("cuando oldValue === newValue la fila no aparece", () => {
    render(
      <AuditDiffViewer
        event={makeEvent({
          entityType: "sales",
          oldValues: { description: "igual", totalAmount: 100 },
          newValues: { description: "igual", totalAmount: 150 },
        })}
      />,
    );
    // Description tiene el mismo valor en old y new — NO debería renderizarse
    expect(screen.queryByText("igual")).not.toBeInTheDocument();
    // Pero totalAmount sí cambió
    expect(screen.getByText("Monto total")).toBeInTheDocument();
  });
});

describe("AuditDiffViewer — entityType sin entrada en DIFF_FIELDS (A9-S5)", () => {
  it("no renderiza ningún campo (fallback seguro)", () => {
    // Simulamos un entityType hipotético que no está en DIFF_FIELDS — casteamos
    // para forzar el type-check mientras testeamos el runtime fallback.
    const event = makeEvent({
      // @ts-expect-error — intencional para probar el fallback defensivo
      entityType: "unknown_table",
      oldValues: { someField: "should not render" },
      newValues: { someField: "neither this" },
    });

    const { container } = render(<AuditDiffViewer event={event} />);
    // No debe aparecer ninguno de los valores JSONB
    expect(screen.queryByText("should not render")).not.toBeInTheDocument();
    expect(screen.queryByText("neither this")).not.toBeInTheDocument();
    // Wrapper puede existir pero sin filas de datos
    expect(container.querySelectorAll("tr").length).toBeLessThanOrEqual(1);
  });
});
