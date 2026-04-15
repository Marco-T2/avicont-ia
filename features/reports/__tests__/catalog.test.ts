import { describe, it, expect } from "vitest";
import {
  reportRegistry,
  reportCategories,
} from "@/features/reports/catalog";
import type { ReportEntry, ReportCategory, ReportStatus } from "@/features/reports/catalog";

// ── Helpers de validación puros — triangulación con fixtures ─────────────────

function hasDuplicateIds(entries: readonly ReportEntry[]): boolean {
  const ids = entries.map((e) => e.id);
  return new Set(ids).size !== ids.length;
}

function findAvailableWithoutRoute(entries: readonly ReportEntry[]): ReportEntry[] {
  return entries.filter((e) => e.status === "available" && (e.route === null || !e.route.startsWith("/")));
}

function findPlannedWithRoute(entries: readonly ReportEntry[]): ReportEntry[] {
  return entries.filter((e) => e.status === "planned" && e.route !== null);
}

function isOrderedAscending(cats: readonly ReportCategory[]): boolean {
  for (let i = 1; i < cats.length; i++) {
    if (cats[i].order <= cats[i - 1].order) return false;
  }
  return true;
}

function findOrphanedCategories(
  entries: readonly ReportEntry[],
  cats: readonly ReportCategory[],
): string[] {
  const catIds = new Set(cats.map((c) => c.id));
  return entries.filter((e) => !catIds.has(e.category)).map((e) => e.id);
}

// ── Invariantes del registro de reportes ────────────────────────────────────

describe("reportRegistry — invariantes de integridad", () => {
  it("todos los ids de entrada son únicos", () => {
    const ids = reportRegistry.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("toda entrada con status 'available' tiene route no-nulo que empieza con '/'", () => {
    const available = reportRegistry.filter((e) => e.status === "available");
    for (const entry of available) {
      expect(entry.route, `entry "${entry.id}" debe tener route`).not.toBeNull();
      expect(entry.route!.startsWith("/"), `route de "${entry.id}" debe comenzar con /`).toBe(true);
    }
  });

  it("toda entrada con status 'planned' tiene route null", () => {
    const planned = reportRegistry.filter((e) => e.status === "planned");
    for (const entry of planned) {
      expect(entry.route, `entry planned "${entry.id}" no debe tener route`).toBeNull();
    }
  });

  it("el category de cada entrada existe como id en reportCategories", () => {
    const categoryIds = new Set(reportCategories.map((c) => c.id));
    for (const entry of reportRegistry) {
      expect(
        categoryIds.has(entry.category),
        `category "${entry.category}" de entry "${entry.id}" no existe en reportCategories`,
      ).toBe(true);
    }
  });

  it("el campo icon, si está presente, es un string no vacío", () => {
    for (const entry of reportRegistry) {
      if (entry.icon !== undefined) {
        expect(typeof entry.icon).toBe("string");
        expect(entry.icon.length, `icon de "${entry.id}" no debe estar vacío`).toBeGreaterThan(0);
      }
    }
  });

  it("el status solo acepta valores válidos: available | planned | hidden", () => {
    const VALID_STATUSES: ReportStatus[] = ["available", "planned", "hidden"];
    for (const entry of reportRegistry) {
      expect(
        VALID_STATUSES.includes(entry.status),
        `status "${entry.status}" de "${entry.id}" es inválido`,
      ).toBe(true);
    }
  });
});

describe("reportCategories — invariantes de integridad", () => {
  it("los ids de categorías son únicos", () => {
    const ids = reportCategories.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("las categorías están ordenadas de forma ascendente por el campo order", () => {
    for (let i = 1; i < reportCategories.length; i++) {
      expect(
        reportCategories[i].order,
        `order[${i}] debe ser > order[${i - 1}]`,
      ).toBeGreaterThan(reportCategories[i - 1].order);
    }
  });
});

// ── TRIANGULACIÓN — validators con datos reales (no vacíos) ─────────────────
// Verifica que los helpers de validación detectan violaciones reales.

const fixtureCategories: readonly ReportCategory[] = [
  { id: "cat-a", label: "Categoría A", order: 1 },
  { id: "cat-b", label: "Categoría B", order: 2 },
];

describe("validators de invariantes con fixtures no vacíos", () => {
  it("hasDuplicateIds detecta ids duplicados", () => {
    const entries: ReportEntry[] = [
      { id: "dup", title: "A", description: "a", category: "cat-a", status: "planned", route: null },
      { id: "dup", title: "B", description: "b", category: "cat-a", status: "planned", route: null },
    ];
    expect(hasDuplicateIds(entries)).toBe(true);
  });

  it("hasDuplicateIds retorna false con ids únicos", () => {
    const entries: ReportEntry[] = [
      { id: "a", title: "A", description: "a", category: "cat-a", status: "planned", route: null },
      { id: "b", title: "B", description: "b", category: "cat-a", status: "planned", route: null },
    ];
    expect(hasDuplicateIds(entries)).toBe(false);
  });

  it("findAvailableWithoutRoute detecta available sin route", () => {
    const entries: ReportEntry[] = [
      { id: "bad", title: "Mal", description: "sin ruta", category: "cat-a", status: "available", route: null },
      { id: "ok", title: "Ok", description: "con ruta", category: "cat-a", status: "available", route: "/accounting/test" },
    ];
    const violations = findAvailableWithoutRoute(entries);
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("bad");
  });

  it("findAvailableWithoutRoute retorna vacío cuando todas las available tienen route válido", () => {
    const entries: ReportEntry[] = [
      { id: "ok", title: "Ok", description: "con ruta", category: "cat-a", status: "available", route: "/accounting/test" },
    ];
    expect(findAvailableWithoutRoute(entries)).toHaveLength(0);
  });

  it("findPlannedWithRoute detecta planned con route asignada", () => {
    const entries: ReportEntry[] = [
      { id: "bad", title: "Mal", description: "no debería tener ruta", category: "cat-a", status: "planned", route: "/algo" },
    ];
    const violations = findPlannedWithRoute(entries);
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("bad");
  });

  it("isOrderedAscending detecta categorías fuera de orden", () => {
    const unordered: ReportCategory[] = [
      { id: "x", label: "X", order: 2 },
      { id: "y", label: "Y", order: 1 },
    ];
    expect(isOrderedAscending(unordered)).toBe(false);
  });

  it("isOrderedAscending acepta categorías correctamente ordenadas", () => {
    expect(isOrderedAscending(fixtureCategories)).toBe(true);
  });

  it("findOrphanedCategories detecta entries con category inexistente", () => {
    const entries: ReportEntry[] = [
      { id: "ok", title: "Ok", description: "ok", category: "cat-a", status: "planned", route: null },
      { id: "bad", title: "Mal", description: "cat no existe", category: "cat-z", status: "planned", route: null },
    ];
    const orphans = findOrphanedCategories(entries, fixtureCategories);
    expect(orphans).toEqual(["bad"]);
  });

  it("findOrphanedCategories retorna vacío cuando todas las categorías existen", () => {
    const entries: ReportEntry[] = [
      { id: "ok1", title: "A", description: "a", category: "cat-a", status: "planned", route: null },
      { id: "ok2", title: "B", description: "b", category: "cat-b", status: "available", route: "/test" },
    ];
    expect(findOrphanedCategories(entries, fixtureCategories)).toHaveLength(0);
  });
});

// ── PR3 — Datos del catálogo curado ─────────────────────────────────────────
// Estos tests verifican que el catálogo tiene los datos reales poblados.

describe("reportCategories — datos curados (PR3)", () => {
  it("tiene exactamente 9 categorías", () => {
    expect(reportCategories).toHaveLength(9);
  });

  it("contiene las 9 categorías esperadas por id", () => {
    const expectedIds = [
      "estados-financieros",
      "para-mi-contador",
      "quien-te-debe",
      "lo-que-debes",
      "ventas-clientes",
      "gastos-proveedores",
      "empresa",
      "impuestos",
      "nomina-empleados",
    ];
    const actualIds = reportCategories.map((c) => c.id);
    for (const id of expectedIds) {
      expect(actualIds, `debe existir la categoría "${id}"`).toContain(id);
    }
  });
});

describe("reportRegistry — datos curados (PR3)", () => {
  it("tiene al menos 4 entradas con status 'available'", () => {
    const available = reportRegistry.filter((e) => e.status === "available");
    expect(available.length).toBeGreaterThanOrEqual(4);
  });

  it("las 4 entradas available conocidas existen con routes correctos", () => {
    const availableMap = new Map(
      reportRegistry
        .filter((e) => e.status === "available")
        .map((e) => [e.id, e]),
    );

    const expected = [
      { id: "balance-sheet", route: "/accounting/financial-statements/balance-sheet" },
      { id: "income-statement", route: "/accounting/financial-statements/income-statement" },
      { id: "trial-balance", route: "/accounting/reports" },
      { id: "correlation-audit", route: "/accounting/correlation-audit" },
    ];

    for (const { id, route } of expected) {
      const entry = availableMap.get(id);
      expect(entry, `debe existir la entrada available "${id}"`).toBeDefined();
      expect(entry?.route).toBe(route);
    }
  });

  it("tiene al menos 21 entradas con status 'planned'", () => {
    const planned = reportRegistry.filter((e) => e.status === "planned");
    expect(planned.length).toBeGreaterThanOrEqual(21);
  });

  it("balance-sheet pertenece a la categoría 'estados-financieros'", () => {
    const entry = reportRegistry.find((e) => e.id === "balance-sheet");
    expect(entry?.category).toBe("estados-financieros");
  });

  it("income-statement pertenece a la categoría 'estados-financieros'", () => {
    const entry = reportRegistry.find((e) => e.id === "income-statement");
    expect(entry?.category).toBe("estados-financieros");
  });

  it("trial-balance pertenece a la categoría 'para-mi-contador'", () => {
    const entry = reportRegistry.find((e) => e.id === "trial-balance");
    expect(entry?.category).toBe("para-mi-contador");
  });

  it("correlation-audit pertenece a la categoría 'empresa'", () => {
    const entry = reportRegistry.find((e) => e.id === "correlation-audit");
    expect(entry?.category).toBe("empresa");
  });
});

// ── Comprobación de tipos en tiempo de compilación (fixtures de tipo) ──────

describe("tipos — contrato de interfaz", () => {
  it("ReportEntry acepta una entrada válida completa", () => {
    const entry: ReportEntry = {
      id: "test-entry",
      title: "Reporte de Prueba",
      description: "Descripción de prueba",
      category: "empresa",
      status: "available",
      route: "/accounting/test",
      icon: "FileText",
    };
    expect(entry.id).toBe("test-entry");
    expect(entry.status).toBe("available");
  });

  it("ReportEntry acepta una entrada planned sin route y sin icon", () => {
    const entry: ReportEntry = {
      id: "planned-test",
      title: "Próximo Reporte",
      description: "Vendrá pronto",
      category: "impuestos",
      status: "planned",
      route: null,
    };
    expect(entry.route).toBeNull();
    expect(entry.icon).toBeUndefined();
  });

  it("ReportCategory acepta una categoría válida", () => {
    const cat: ReportCategory = {
      id: "estados-financieros",
      label: "Estados Financieros",
      order: 1,
    };
    expect(cat.id).toBe("estados-financieros");
    expect(cat.order).toBe(1);
  });
});
