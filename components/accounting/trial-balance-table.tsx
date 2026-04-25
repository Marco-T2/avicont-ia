"use client";

/**
 * TrialBalanceTable — Renders a serialized TrialBalanceReport as a 7-column HTML table.
 *
 * Columns: N°, Código, Cuenta, Sumas Debe, Sumas Haber, Saldo Deudor, Saldo Acreedor.
 * Flat list (no grouping); TOTAL row appended at the bottom.
 * Imbalance banner (red) shown above the table when report.imbalanced=true.
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
}

interface SerializedRow extends SerializedTotals {
  accountId: string;
  code: string;
  name: string;
}

interface SerializedReport {
  orgId: string;
  dateFrom: string;
  dateTo: string;
  rows: SerializedRow[];
  totals: SerializedTotals;
  imbalanced: boolean;
  deltaSumas: string;
  deltaSaldos: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: string): string {
  if (!v || v === "0" || v === "0.00") return "";
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (n < 0) {
    return `(${Math.abs(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTotal(v: string): string {
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (n < 0) {
    return `(${Math.abs(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TrialBalanceTableProps {
  report: SerializedReport;
}

export const TrialBalanceTable: FC<TrialBalanceTableProps> = ({ report }) => {
  return (
    <div className="space-y-2">
      {/* Imbalance banner */}
      {report.imbalanced && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm font-medium"
        >
          Balance desbalanceado — Delta Sumas: {report.deltaSumas} · Delta Saldos:{" "}
          {report.deltaSaldos}
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="px-2 py-2 text-center font-semibold w-10">N°</th>
              <th className="px-2 py-2 text-left font-semibold w-24">Código</th>
              <th className="px-2 py-2 text-left font-semibold">Cuenta</th>
              <th className="px-2 py-2 text-right font-semibold w-32">Sumas Debe</th>
              <th className="px-2 py-2 text-right font-semibold w-32">Sumas Haber</th>
              <th className="px-2 py-2 text-right font-semibold w-32">Saldo Deudor</th>
              <th className="px-2 py-2 text-right font-semibold w-32">Saldo Acreedor</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, idx) => (
              <tr key={row.accountId} className="border-b border-border hover:bg-accent/50">
                <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
                <td className="px-2 py-1.5 font-mono text-xs">{row.code}</td>
                <td className="px-2 py-1.5">{row.name}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(row.sumasDebe)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(row.sumasHaber)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(row.saldoDeudor)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(row.saldoAcreedor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td className="px-2 py-2" colSpan={3}>
                TOTAL
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtTotal(report.totals.sumasDebe)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtTotal(report.totals.sumasHaber)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtTotal(report.totals.saldoDeudor)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtTotal(report.totals.saldoAcreedor)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
