"use client";

/**
 * InitialBalanceView — Renders a serialized InitialBalanceStatement as a
 * centered compact table with two stacked sections (ACTIVO, then PASIVO Y PATRIMONIO).
 *
 * Visual pattern: mirrors BalanceSheetView — centered compact table (`mx-auto w-auto`)
 * with fixed-width columns for name and amount. formatBOB for all amounts.
 * Zero-amount detail rows are skipped.
 *
 * Detail rows show "{code} — {name}" format (em dash, Bolivian legal format).
 *
 * Banners: imbalance alert (red) when `imbalanced: true`; multipleCA warning
 * (amber) when `multipleCA: true`. Banners render above the table — full-width.
 *
 * Receives a serialized statement (Decimals as strings) — same shape as API
 * JSON response.
 */

import { type FC, type CSSProperties } from "react";
import { formatBOB } from "@/components/financial-statements/format-money";

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

// ── Row type definitions ───────────────────────────────────────────────────────

type TableRow =
  | { kind: "section-header"; label: string }
  | { kind: "group-header"; label: string }
  | { kind: "detail"; code: string; name: string; amount: string }
  | { kind: "subtotal"; label: string; amount: string }
  | { kind: "section-total"; label: string; amount: string };

// ── Flatten statement into ordered rows ───────────────────────────────────────

function flattenSection(section: SerializedSection): TableRow[] {
  const rows: TableRow[] = [];

  rows.push({ kind: "section-header", label: section.label });

  for (const group of section.groups) {
    rows.push({ kind: "group-header", label: group.label });

    for (const row of group.rows) {
      if (parseFloat(row.amount) === 0) continue;
      rows.push({ kind: "detail", code: row.code, name: row.name, amount: row.amount });
    }

    rows.push({ kind: "subtotal", label: `Subtotal ${group.label}`, amount: group.subtotal });
  }

  rows.push({ kind: "section-total", label: `Total ${section.label}`, amount: section.sectionTotal });

  return rows;
}

// ── Row class and indentation helpers ─────────────────────────────────────────

function rowClassName(kind: TableRow["kind"]): string {
  switch (kind) {
    case "section-header":
      return "bg-gray-100 font-semibold border-t border-gray-300";
    case "group-header":
      return "bg-gray-50 font-medium border-t border-gray-200";
    case "detail":
      return "bg-white hover:bg-blue-50/30 transition-colors";
    case "subtotal":
      return "bg-gray-50 font-medium border-t border-gray-200";
    case "section-total":
      return "bg-white font-semibold border-t-2 border-gray-400";
  }
}

function nameCellIndent(kind: TableRow["kind"]): CSSProperties {
  switch (kind) {
    case "section-header":
      return { paddingLeft: "0px" };
    case "group-header":
      return { paddingLeft: "8px" };
    case "detail":
      return { paddingLeft: "24px" };
    case "subtotal":
      return { paddingLeft: "8px" };
    case "section-total":
      return { paddingLeft: "0px" };
  }
}

function rowLabel(row: TableRow): string {
  switch (row.kind) {
    case "section-header":
      return row.label;
    case "group-header":
      return row.label;
    case "detail":
      return `${row.code} — ${row.name}`;
    case "subtotal":
      return row.label;
    case "section-total":
      return row.label;
  }
}

function rowAmount(row: TableRow): string | null {
  if (row.kind === "section-header" || row.kind === "group-header") return null;
  return formatBOB(row.amount);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface InitialBalanceViewProps {
  statement: SerializedStatement;
}

export const InitialBalanceView: FC<InitialBalanceViewProps> = ({ statement }) => {
  const [activoSection, pasivoSection] = statement.sections;
  const rows: TableRow[] = [
    ...flattenSection(activoSection),
    ...flattenSection(pasivoSection),
  ];

  return (
    <div className="space-y-4">
      {/* Imbalance banner */}
      {statement.imbalanced && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
        >
          <div className="font-semibold">
            Desequilibrio contable detectado — Diferencia:{" "}
            {formatBOB(statement.imbalanceDelta)}
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

      {/* Centered compact table */}
      <div className="overflow-x-auto">
        <table className="mx-auto w-auto border-collapse text-sm">
          <tbody>
            {rows.map((row, idx) => {
              const amount = rowAmount(row);
              return (
                <tr key={idx} className={rowClassName(row.kind)}>
                  <td
                    className="px-3 py-1 text-left w-[320px] border-b border-gray-100"
                    style={nameCellIndent(row.kind)}
                  >
                    {rowLabel(row)}
                  </td>
                  <td className="px-3 py-1 text-right w-[140px] font-mono tabular-nums border-b border-gray-100">
                    {amount ?? ""}
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
