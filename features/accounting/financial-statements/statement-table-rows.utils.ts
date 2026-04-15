// Utilidades puras para convertir el response serializado de la API
// en el árbol de StatementTableRow[] que consume statement-table.tsx.
//
// Reglas:
//  - Sin imports de React ni Prisma — código puro Node/TS.
//  - Los valores de balance llegan como strings (serializeStatement ya los convirtió).
//  - Los IDs de fila siguen el formato path-based del diseño §3.3.

import type { SemanticRowClass } from "./financial-statements.types";

// ── Tipos serializados que vienen de la API ──

export type SerializedAccount = {
  accountId: string;
  code: string;
  name: string;
  balance: string;
};

export type SerializedSubtypeGroup = {
  subtype: string;
  label: string;
  accounts: SerializedAccount[];
  total: string;
};

export type SerializedColumn = {
  id: string;
  label: string;
  role: "current" | "comparative" | "diff_percent";
};

// Secciones del Balance General serializado
type SerializedBSCurrent = {
  asOfDate: string;
  assets: { groups: SerializedSubtypeGroup[]; total: string };
  liabilities: { groups: SerializedSubtypeGroup[]; total: string };
  equity: { groups: SerializedSubtypeGroup[]; total: string; retainedEarningsOfPeriod: string };
  imbalanced: boolean;
  imbalanceDelta: string;
  preliminary: boolean;
};

// Secciones del Estado de Resultados serializado
type SerializedISCurrent = {
  dateFrom: string;
  dateTo: string;
  income: { groups: SerializedSubtypeGroup[]; total: string };
  expenses: { groups: SerializedSubtypeGroup[]; total: string };
  operatingIncome: string;
  netIncome: string;
  preliminary: boolean;
};

export type SerializedBalanceSheetResponse = {
  orgId: string;
  current: SerializedBSCurrent;
  columns: SerializedColumn[];
};

export type SerializedIncomeStatementResponse = {
  orgId: string;
  current: SerializedISCurrent;
  columns: SerializedColumn[];
};

// ── Tipo de fila para TanStack Table ──

export type StatementTableRow = {
  id: string;
  name: string;
  code?: string;
  semanticClass: SemanticRowClass;
  indent: number;
  // columnId → valor de balance como string (para formateo en la celda)
  columnValues: Record<string, string>;
  subRows?: StatementTableRow[];
};

// ── Helper: construir row ID con formato path-based ──

/**
 * Genera un ID de fila basado en la ruta jerárquica.
 *
 * Ejemplos:
 *   buildRowId("activo")                              → "row-activo"
 *   buildRowId("activo", "activo-corriente")          → "row-activo_activo-corriente"
 *   buildRowId("activo", "activo-corriente", "acc1")  → "row-activo_activo-corriente_acc1"
 *   buildRowId("activo", "__total")                   → "row-activo___total"
 */
export function buildRowId(section: string, subtype?: string, accountId?: string): string {
  const parts: string[] = [`row-${section}`];
  if (subtype !== undefined) parts.push(`_${subtype}`);
  if (accountId !== undefined) parts.push(`_${accountId}`);
  return parts.join("");
}

// ── Normalizar subtype a slug para IDs ──

function subtypeToSlug(subtype: string): string {
  return subtype.toLowerCase().replace(/_/g, "-");
}

// ── Construir subRows de un grupo de subtipos ──

function buildSubtypeRows(
  sectionKey: string,
  groups: SerializedSubtypeGroup[],
  columns: SerializedColumn[],
): StatementTableRow[] {
  const rows: StatementTableRow[] = [];

  for (const group of groups) {
    const subtypeSlug = subtypeToSlug(group.subtype);

    // Filas de cuentas individuales
    const accountRows: StatementTableRow[] = group.accounts.map((acc) => ({
      id: buildRowId(sectionKey, subtypeSlug, acc.accountId),
      name: acc.name,
      code: acc.code !== "—" ? acc.code : undefined,
      semanticClass: "custom-bg-white",
      indent: 2,
      // Todas las columnas muestran el mismo balance para cuentas individuales
      // (multi-columna: la cuenta lleva el balance de su respectiva columna)
      columnValues: Object.fromEntries(columns.map((col) => [col.id, acc.balance])),
    }));

    // Fila de total del subtipo
    const subtypeTotalRow: StatementTableRow = {
      id: buildRowId(sectionKey, subtypeSlug, "__total"),
      name: `Total ${group.label}`,
      semanticClass: "total-row",
      indent: 1,
      columnValues: Object.fromEntries(columns.map((col) => [col.id, group.total])),
    };

    // Fila de encabezado del subtipo
    const subtypeRow: StatementTableRow = {
      id: buildRowId(sectionKey, subtypeSlug),
      name: group.label,
      semanticClass: "custom-grouped-row",
      indent: 1,
      columnValues: Object.fromEntries(columns.map((col) => [col.id, group.total])),
      subRows: [...accountRows, subtypeTotalRow],
    };

    rows.push(subtypeRow);
  }

  return rows;
}

// ── Balance General → StatementTableRow[] ──

/**
 * Convierte el response serializado del Balance General
 * en un árbol de StatementTableRow[] para TanStack Table.
 *
 * Estructura resultante:
 *   row-activo (top-level-grouped-row)
 *     row-activo_activo-corriente (custom-grouped-row)
 *       row-activo_activo-corriente_<id> (custom-bg-white)
 *       row-activo_activo-corriente___total (total-row)
 *     row-activo___total (total-row)
 *   row-pasivo ...
 *   row-patrimonio ...
 */
export function buildBalanceSheetTableRows(
  statement: SerializedBalanceSheetResponse,
): StatementTableRow[] {
  const { current, columns } = statement;
  const colIds = columns.map((c) => c.id);

  function emptyCols(): Record<string, string> {
    return Object.fromEntries(colIds.map((id) => [id, "0.00"]));
  }

  const buildSection = (
    sectionKey: string,
    name: string,
    groups: SerializedSubtypeGroup[],
    sectionTotal: string,
  ): StatementTableRow => {
    const subtypeRows = buildSubtypeRows(sectionKey, groups, columns);

    const sectionTotalRow: StatementTableRow = {
      id: buildRowId(sectionKey, "__total"),
      name: `Total ${name}`,
      semanticClass: "total-row",
      indent: 0,
      columnValues: Object.fromEntries(colIds.map((id) => [id, sectionTotal])),
    };

    return {
      id: buildRowId(sectionKey),
      name,
      semanticClass: "top-level-grouped-row",
      indent: 0,
      columnValues: emptyCols(),
      subRows: [...subtypeRows, sectionTotalRow],
    };
  };

  return [
    buildSection("activo", "Activo", current.assets.groups, current.assets.total),
    buildSection("pasivo", "Pasivo", current.liabilities.groups, current.liabilities.total),
    buildSection("patrimonio", "Patrimonio", current.equity.groups, current.equity.total),
  ];
}

// ── Estado de Resultados → StatementTableRow[] ──

/**
 * Convierte el response serializado del Estado de Resultados
 * en un árbol de StatementTableRow[] para TanStack Table.
 *
 * Estructura:
 *   row-ingresos (top-level-grouped-row)
 *     subtipo rows...
 *     row-ingresos___total (total-row)
 *   row-gastos (top-level-grouped-row)
 *     subtipo rows...
 *     row-gastos___total (total-row)
 *   row-utilidad-neta (total-row)
 */
export function buildIncomeStatementTableRows(
  statement: SerializedIncomeStatementResponse,
): StatementTableRow[] {
  const { current, columns } = statement;
  const colIds = columns.map((c) => c.id);

  const incomeSubtypeRows = buildSubtypeRows("ingresos", current.income.groups, columns);
  const expenseSubtypeRows = buildSubtypeRows("gastos", current.expenses.groups, columns);

  const ingresosSection: StatementTableRow = {
    id: buildRowId("ingresos"),
    name: "Ingresos",
    semanticClass: "top-level-grouped-row",
    indent: 0,
    columnValues: Object.fromEntries(colIds.map((id) => [id, current.income.total])),
    subRows: [
      ...incomeSubtypeRows,
      {
        id: buildRowId("ingresos", "__total"),
        name: "Total Ingresos",
        semanticClass: "total-row",
        indent: 0,
        columnValues: Object.fromEntries(colIds.map((id) => [id, current.income.total])),
      },
    ],
  };

  const gastosSection: StatementTableRow = {
    id: buildRowId("gastos"),
    name: "Gastos",
    semanticClass: "top-level-grouped-row",
    indent: 0,
    columnValues: Object.fromEntries(colIds.map((id) => [id, current.expenses.total])),
    subRows: [
      ...expenseSubtypeRows,
      {
        id: buildRowId("gastos", "__total"),
        name: "Total Gastos",
        semanticClass: "total-row",
        indent: 0,
        columnValues: Object.fromEntries(colIds.map((id) => [id, current.expenses.total])),
      },
    ],
  };

  const utilidadNetaRow: StatementTableRow = {
    id: "row-utilidad-neta",
    name: "Utilidad Neta",
    semanticClass: "total-row",
    indent: 0,
    columnValues: Object.fromEntries(colIds.map((id) => [id, current.netIncome])),
  };

  return [ingresosSection, gastosSection, utilidadNetaRow];
}
