"use client";

/**
 * StatementTable — tabla plana HTML para Balance General + Estado de Resultados.
 *
 * Reemplazo del TanStack Table previo (expand/collapse + chevrons + sticky col)
 * por una tabla simple sin estado, paridad visual con `initial-balance-view`:
 * cuentas con formato "{código} — {NOMBRE}", backgrounds suaves por semántica,
 * formatBOB con prefix literal "Bs. ".
 *
 * Soporta multi-col (current + comparative + diff_percent) — cada columna del
 * response se renderiza como un `<td>` adicional en cada fila.
 */

import { type CSSProperties } from "react";
import type {
  StatementTableRow,
  SerializedColumn,
} from "@/modules/accounting/financial-statements/presentation";

type SemanticClass = StatementTableRow["semanticClass"];

interface StatementTableProps {
  columns: SerializedColumn[];
  rows: StatementTableRow[];
  /** Reservado para futuras integraciones — no usado por la tabla plana. */
  onRefresh?: () => void;
  title?: string;
  /** Backwards-compat — ya no se renderiza (redundante con el H1 de la página). */
  orgName?: string;
  subtitle?: string;
}

export function StatementTable({
  columns,
  rows,
  onRefresh: _onRefresh,
  title,
  orgName: _orgName,
  subtitle,
}: StatementTableProps) {
  // Aplanamos las subRows recursivamente — todo siempre visible (sin expand)
  const flatRows = flattenRows(rows);

  return (
    <div className="overflow-x-auto">
      {/* Sub-header del Card — paridad con initial-balance */}
      {(title || subtitle) && (
        <div className="px-6 pb-4 text-center">
          {title && (
            <h2 className="text-xl font-bold tracking-wide">{title.toUpperCase()}</h2>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
          <p className="text-xs italic text-muted-foreground">
            (Expresado en Bolivianos)
          </p>
        </div>
      )}

      <table className="mx-auto w-auto border-collapse text-sm">
        <tbody>
          {flatRows.map((row) => (
            <tr key={row.id} className={rowClassName(row.semanticClass)}>
              <td
                className={`px-3 py-1 text-left w-[320px] border-b border-border`}
                style={nameCellIndent(row.semanticClass)}
              >
                {rowLabel(row)}
              </td>
              {columns.map((col) => {
                const raw = row.columnValues[col.id];
                return (
                  <td
                    key={col.id}
                    className={`px-3 py-1 text-right w-[140px] font-mono tabular-nums border-b border-border`}
                  >
                    {formatCell(raw, col.role)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Flatten helper ─────────────────────────────────────────────────────────────

function flattenRows(rows: StatementTableRow[]): StatementTableRow[] {
  const out: StatementTableRow[] = [];
  for (const row of rows) {
    out.push(row);
    if (row.subRows && row.subRows.length > 0) {
      out.push(...flattenRows(row.subRows));
    }
  }
  return out;
}

// ── Styling por semántica (paridad con initial-balance-view) ───────────────────

function rowClassName(kind: SemanticClass): string {
  switch (kind) {
    case "top-level-grouped-row":
      return "bg-muted font-semibold border-t border-border";
    case "custom-grouped-row":
      return "bg-muted/50 font-medium border-t border-border";
    case "total-row":
      return "bg-card font-semibold border-t-2 border-border";
    case "custom-bg-white":
    default:
      return "bg-card hover:bg-accent/50 transition-colors";
  }
}

function nameCellIndent(kind: SemanticClass): CSSProperties {
  switch (kind) {
    case "top-level-grouped-row":
    case "total-row":
      return { paddingLeft: "0px" };
    case "custom-grouped-row":
      return { paddingLeft: "8px" };
    case "custom-bg-white":
    default:
      return { paddingLeft: "24px" };
  }
}

function rowLabel(row: StatementTableRow): string {
  // Detail rows (cuentas individuales) → "{código} — {NOMBRE EN MAYÚS}"
  if (row.semanticClass === "custom-bg-white") {
    return row.code ? `${row.code} — ${row.name.toUpperCase()}` : row.name.toUpperCase();
  }
  // Headers + totales → MAYÚSCULAS plano
  return row.name.toUpperCase();
}

// ── Formato de celdas ──────────────────────────────────────────────────────────

function formatCell(value: string | undefined, role: SerializedColumn["role"]): string {
  if (value === undefined || value === null || value === "") return "—";
  if (role === "diff_percent") {
    const num = parseFloat(value);
    return isNaN(num) ? "—" : `${num.toFixed(1)}%`;
  }
  return formatBOB(value);
}

/**
 * Formato monetario boliviano: "Bs. 1.234,56" (prefix literal + es-BO decimal).
 * Paridad con `formatBOB` de `format-money.ts` y `initial-balance-view`.
 */
function formatBOB(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "Bs. 0,00";
  const formatted = new Intl.NumberFormat("es-BO", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `Bs. ${formatted}`;
}
