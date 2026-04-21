"use client";

/**
 * InitialBalanceView — Renders a serialized InitialBalanceStatement as two HTML sections.
 *
 * Sections: ACTIVO and PASIVO Y PATRIMONIO, each rendered with subsections per AccountSubtype.
 * Banners: imbalance alert (red) when `imbalanced: true`; multipleCA warning (amber) when `multipleCA: true`.
 * Amount formatting: es-BO locale, 2 decimal places.
 *   - Positive:  1234.56  → "1.234,56"
 *   - Negative: -1234.56  → "(1.234,56)"
 *   - Zero (detail row)   → "" (empty)
 *   - Zero (total row)    → "0,00"
 *
 * Receives a serialized statement (Decimals as strings) — same shape as API JSON response.
 */

import { type FC } from "react";

// ── Serialized types (Decimals as strings) ─────────────────────────────────────

interface SerializedRow {
  accountId: string;
  code: string;
  name: string;
  amount: string;
}

interface SerializedGroup {
  subtype: string;
  label: string;
  rows: SerializedRow[];
  subtotal: string;
}

interface SerializedSection {
  key: string;
  label: string;
  groups: SerializedGroup[];
  sectionTotal: string;
}

interface SerializedStatement {
  orgId: string;
  dateAt: string;
  sections: [SerializedSection, SerializedSection];
  imbalanced: boolean;
  imbalanceDelta: string;
  multipleCA: boolean;
  caCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats a string-encoded Decimal using es-BO locale.
 * isTotal=true  → zero renders as "0,00"
 * isTotal=false → zero renders as "" (empty)
 * Negative values use parentheses instead of minus sign.
 */
function fmtAmount(v: string | undefined, isTotal: boolean): string {
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

interface InitialBalanceViewProps {
  statement: SerializedStatement;
}

export const InitialBalanceView: FC<InitialBalanceViewProps> = ({ statement }) => {
  return (
    <div className="space-y-4">
      {/* Imbalance banner */}
      {statement.imbalanced && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
        >
          <div className="font-semibold">
            Desequilibrio contable detectado — Diferencia: Bs.{" "}
            {fmtAmount(statement.imbalanceDelta, true)}
          </div>
          <div className="mt-1 font-normal">
            El total del ACTIVO no coincide con el total del PASIVO Y PATRIMONIO. Revise el
            Comprobante de Apertura.
          </div>
        </div>
      )}

      {/* Multiple CA warning banner */}
      {statement.multipleCA && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-sm font-medium"
        >
          Múltiples Comprobantes de Apertura ({statement.caCount}) — Los saldos han sido
          acumulados. Verifique que el Balance Inicial sea correcto.
        </div>
      )}

      {/* Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {statement.sections.map((section) => (
          <div key={section.key} className="space-y-2">
            <h2 className="text-base font-bold uppercase tracking-wide border-b-2 border-gray-800 pb-1">
              {section.label}
            </h2>

            {section.groups.map((group) => (
              <div key={group.subtype} className="space-y-0.5">
                {/* Group label */}
                <div className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded">
                  <span className="text-sm font-semibold text-gray-700">{group.label}</span>
                </div>

                {/* Rows */}
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.accountId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-1 text-gray-600 w-20 font-mono text-xs">
                          {row.code}
                        </td>
                        <td className="px-2 py-1">{row.name}</td>
                        <td className="px-2 py-1 text-right tabular-nums w-28">
                          {fmtAmount(row.amount, false)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-400 font-semibold">
                      <td className="px-3 py-1 text-xs text-gray-500" colSpan={2}>
                        Subtotal {group.label}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums w-28">
                        {fmtAmount(group.subtotal, true)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            {/* Section total */}
            <div className="flex items-center justify-between border-t-2 border-gray-800 pt-1 mt-2">
              <span className="text-sm font-bold uppercase">Total {section.label}</span>
              <span className="text-sm font-bold tabular-nums">
                {fmtAmount(section.sectionTotal, true)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
