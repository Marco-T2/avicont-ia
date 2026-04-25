"use client";

/**
 * WorksheetTable — Renders a serialized WorksheetReport as a 14-column HTML table.
 *
 * Columns: Código (1) + Cuenta (2) + 12 numeric (3-14).
 * Groups in canonical order: ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO.
 * Carry-over row and grand totals appended at the bottom.
 *
 * Covers REQ-9 (grouping + canonical order), REQ-6 (contra-account display),
 * REQ-7 (carry-over row label), design §6.
 *
 * Receives a serialized report (Decimals as strings) — same shape as API JSON response.
 */

import { type FC } from "react";

// ── Types (serialized — Decimals as strings) ──────────────────────────────────

interface SerializedTotals {
  sumasDebe: string;
  sumasHaber: string;
  saldoDeudor: string;
  saldoAcreedor: string;
  ajustesDebe: string;
  ajustesHaber: string;
  saldoAjDeudor: string;
  saldoAjAcreedor: string;
  resultadosPerdidas: string;
  resultadosGanancias: string;
  bgActivo: string;
  bgPasPat: string;
}

interface SerializedRow extends SerializedTotals {
  accountId: string;
  code: string;
  name: string;
  isContraAccount: boolean;
  accountType: string;
  isCarryOver: boolean;
}

interface SerializedGroup {
  accountType: string;
  rows: SerializedRow[];
  subtotals: SerializedTotals;
}

interface SerializedReport {
  orgId: string;
  dateFrom: string;
  dateTo: string;
  groups: SerializedGroup[];
  carryOverRow?: SerializedRow;
  grandTotals: SerializedTotals;
  imbalanced: boolean;
  imbalanceDelta: string;
}

interface WorksheetTableProps {
  report: SerializedReport;
}

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Format a numeric string for display.
 * - "0" or "0.00" → "" (empty — accountant convention for detail rows)
 * - Negative → "(value)" with es-BO locale
 * - Positive → es-BO formatted
 */
function fmtNum(value: string, isTotal = false): string {
  const n = parseFloat(value);
  if (isNaN(n)) return "";
  if (n === 0) return isTotal ? fmtLocale(0) : "";
  if (n < 0) return `(${fmtLocale(Math.abs(n))})`;
  return fmtLocale(n);
}

function fmtLocale(n: number): string {
  return n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Column order for the 12 numeric cells ────────────────────────────────────

const NUMERIC_KEYS: (keyof SerializedTotals)[] = [
  "sumasDebe",
  "sumasHaber",
  "saldoDeudor",
  "saldoAcreedor",
  "ajustesDebe",
  "ajustesHaber",
  "saldoAjDeudor",
  "saldoAjAcreedor",
  "resultadosPerdidas",
  "resultadosGanancias",
  "bgActivo",
  "bgPasPat",
];

// ── Row renderers ─────────────────────────────────────────────────────────────

function NumericCells({
  row,
  isTotal,
}: {
  row: SerializedTotals;
  isTotal: boolean;
}) {
  return (
    <>
      {NUMERIC_KEYS.map((key) => (
        <td
          key={key}
          className="text-right px-1 py-0.5 tabular-nums text-xs"
        >
          {fmtNum(row[key], isTotal)}
        </td>
      ))}
    </>
  );
}

function DetailRow({ row }: { row: SerializedRow }) {
  return (
    <tr className={row.isCarryOver ? "font-bold italic" : ""}>
      <td className="px-1 py-0.5 text-xs whitespace-nowrap">{row.code}</td>
      <td className="px-1 py-0.5 text-xs">{row.name}</td>
      <NumericCells row={row} isTotal={false} />
    </tr>
  );
}

function SubtotalRow({
  label,
  totals,
}: {
  label: string;
  totals: SerializedTotals;
}) {
  return (
    <tr data-subtotal className="font-bold border-t border-border">
      <td className="px-1 py-0.5 text-xs" />
      <td className="px-1 py-0.5 text-xs">{label}</td>
      <NumericCells row={totals} isTotal={true} />
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const WorksheetTable: FC<WorksheetTableProps> = ({ report }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted font-bold text-center">
            <th rowSpan={2} className="px-1 py-1 text-left border-b border-border">
              Código
            </th>
            <th rowSpan={2} className="px-1 py-1 text-left border-b border-border">
              Cuenta
            </th>
            <th colSpan={2} className="px-1 py-1 border-b border-border">
              Sumas
            </th>
            <th colSpan={2} className="px-1 py-1 border-b border-border">
              Saldos
            </th>
            <th colSpan={2} className="px-1 py-1 border-b border-border">
              Ajustes
            </th>
            <th colSpan={2} className="px-1 py-1 border-b border-border">
              Saldos Ajustados
            </th>
            <th colSpan={2} className="px-1 py-1 border-b border-border">
              Resultados
            </th>
            <th colSpan={2} className="px-1 py-1 border-b border-border">
              Balance General
            </th>
          </tr>
          <tr className="bg-muted text-center">
            {["Debe", "Haber", "Deudor", "Acreedor", "Debe", "Haber", "Deudor", "Acreedor", "Pérdidas", "Ganancias", "Activo", "Pas-Pat"].map(
              (h, i) => (
                <th key={`${i}-${h}`} className="px-1 py-0.5 border-b border-border font-semibold">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>

        {report.groups.map((group) => (
          <tbody key={group.accountType} role="rowgroup">
            {/* Group header */}
            <tr className="bg-muted/50">
              <td className="px-1 py-1 text-xs" />
              <td
                data-group-header
                colSpan={13}
                className="px-1 py-1 text-xs font-bold"
              >
                {group.accountType}
              </td>
            </tr>

            {/* Detail rows */}
            {group.rows.map((row) => (
              <DetailRow key={row.accountId} row={row} />
            ))}

            {/* Subtotal row */}
            <SubtotalRow
              label={`Total ${group.accountType}`}
              totals={group.subtotals}
            />
          </tbody>
        ))}

        {/* Carry-over row */}
        {report.carryOverRow && (
          <tbody role="rowgroup">
            <DetailRow row={report.carryOverRow} />
          </tbody>
        )}

        {/* Grand totals */}
        <tbody role="rowgroup">
          <SubtotalRow label="TOTALES" totals={report.grandTotals} />
        </tbody>
      </table>

      {/* Imbalance warning */}
      {report.imbalanced && (
        <p className="mt-2 text-destructive text-xs font-bold">
          Ecuación contable desbalanceada — Delta:{" "}
          {fmtNum(report.imbalanceDelta, true)} BOB
        </p>
      )}
    </div>
  );
};
