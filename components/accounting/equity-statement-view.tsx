"use client";

/**
 * EquityStatementView — Renders a serialized EquityStatement as an HTML table.
 *
 * Columns: Descripción + visible equity columns + Total Patrimonio.
 * Rows: SALDO_INICIAL, optional typed rows (APORTE_CAPITAL, CONSTITUCION_RESERVA,
 *       DISTRIBUCION_DIVIDENDO), RESULTADO_EJERCICIO, SALDO_FINAL (bold).
 *       Typed rows are emitted by the builder only when the period has a
 *       non-zero net movement for that voucher code.
 * Imbalance and preliminary banners shown when applicable.
 *
 * Receives a serialized statement (Decimals as strings) — same shape as API JSON response.
 */

import { type FC } from "react";

// ── Serialized types (Decimals as strings) ─────────────────────────────────────

interface SerializedCell {
  column: string;
  amount: string;
}

interface SerializedRow {
  key: string;
  label: string;
  cells: SerializedCell[];
  total: string;
}

interface SerializedColumn {
  key: string;
  label: string;
  visible: boolean;
}

interface SerializedStatement {
  orgId: string;
  dateFrom: string;
  dateTo: string;
  columns: SerializedColumn[];
  rows: SerializedRow[];
  columnTotals: Record<string, string>;
  grandTotal: string;
  periodResult: string;
  imbalanced: boolean;
  imbalanceDelta: string;
  preliminary: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: string | undefined, isTotal: boolean): string {
  if (v === undefined || v === null) return isTotal ? "0,00" : "";
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (n === 0) {
    return isTotal
      ? n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";
  }
  if (n < 0) {
    return `(${Math.abs(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EquityStatementViewProps {
  statement: SerializedStatement;
}

export const EquityStatementView: FC<EquityStatementViewProps> = ({ statement }) => {
  const visibleCols = statement.columns.filter((c) => c.visible);

  return (
    <div className="space-y-2">
      {/* Imbalance banner */}
      {statement.imbalanced && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
        >
          <div className="font-semibold">
            Diferencia patrimonial sin clasificar: Bs. {fmtNum(statement.imbalanceDelta, true)}
          </div>
          <div className="mt-1 font-normal">
            Probables causas: aportes de capital, distribuciones a socios o constitución de reservas durante el período. Revisar los movimientos de cuentas 3.x.
          </div>
        </div>
      )}

      {/* Preliminary banner */}
      {statement.preliminary && !statement.imbalanced && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-sm font-medium"
        >
          PRELIMINAR — Este reporte cubre un período no cerrado
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold min-w-[200px]">Descripción</th>
              {visibleCols.map((col) => (
                <th key={col.key} className="px-2 py-2 text-right font-semibold min-w-[120px]">
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold min-w-[130px]">
                Total Patrimonio
              </th>
            </tr>
          </thead>
          <tbody>
            {statement.rows.map((row) => {
              const isFinal = row.key === "SALDO_FINAL";
              return (
                <tr
                  key={row.key}
                  className={`border-b border-gray-100 ${isFinal ? "border-t border-gray-700 font-bold" : "hover:bg-gray-50"}`}
                >
                  <td className={`px-3 py-2 ${isFinal ? "font-bold" : ""}`}>{row.label}</td>
                  {visibleCols.map((col) => {
                    const cell = row.cells.find((c) => c.column === col.key);
                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-2 text-right tabular-nums ${isFinal ? "font-bold" : ""}`}
                      >
                        {fmtNum(cell?.amount, isFinal)}
                      </td>
                    );
                  })}
                  <td className={`px-2 py-2 text-right tabular-nums ${isFinal ? "font-bold" : ""}`}>
                    {fmtNum(row.total, isFinal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
