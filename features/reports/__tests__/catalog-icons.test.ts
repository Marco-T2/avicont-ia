import { describe, it, expect } from "vitest";
import * as LucideIcons from "lucide-react";
import { reportRegistry } from "@/features/reports/catalog";

// ── Validación de íconos Lucide contra exportaciones reales ──────────────────
// Garantiza que cada nombre de ícono en el catálogo corresponde a un export
// real de lucide-react, evitando referencias rotas en tiempo de ejecución.

describe("reportRegistry — validación de íconos Lucide", () => {
  it("todos los íconos referenciados en el catálogo existen como exports de lucide-react", () => {
    const entriesWithIcon = reportRegistry.filter(
      (entry) => entry.icon !== undefined,
    );

    expect(
      entriesWithIcon.length,
      "debe haber al menos una entrada con ícono para validar",
    ).toBeGreaterThan(0);

    const invalid: Array<{ id: string; icon: string }> = [];

    for (const entry of entriesWithIcon) {
      const iconName = entry.icon as string;
      const exported = (LucideIcons as Record<string, unknown>)[iconName];
      if (typeof exported !== "function" && typeof exported !== "object") {
        invalid.push({ id: entry.id, icon: iconName });
      }
    }

    expect(
      invalid,
      `Los siguientes íconos NO existen en lucide-react: ${JSON.stringify(invalid, null, 2)}`,
    ).toHaveLength(0);
  });

  it("los íconos exportados por lucide-react son componentes React (función u objeto forwardRef)", () => {
    const entriesWithIcon = reportRegistry.filter(
      (entry) => entry.icon !== undefined,
    );

    for (const entry of entriesWithIcon) {
      const iconName = entry.icon as string;
      const exported = (LucideIcons as Record<string, unknown>)[iconName];
      const isComponent =
        typeof exported === "function" ||
        (typeof exported === "object" &&
          exported !== null &&
          "$$typeof" in exported);

      expect(
        isComponent,
        `"${iconName}" (entry "${entry.id}") no es un componente React válido`,
      ).toBe(true);
    }
  });
});
