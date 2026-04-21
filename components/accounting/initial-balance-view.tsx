"use client";

/**
 * InitialBalanceView — Renders a serialized InitialBalanceStatement as a
 * single-column list of two stacked sections (ACTIVO, then PASIVO Y PATRIMONIO).
 *
 * Visual pattern: mirrors BalanceSheetView — StatementLineRow for every row
 * type, formatBOB for all amounts. Zero-amount detail rows are skipped.
 *
 * Banners: imbalance alert (red) when `imbalanced: true`; multipleCA warning
 * (amber) when `multipleCA: true`. Banners render above the sections.
 *
 * Receives a serialized statement (Decimals as strings) — same shape as API
 * JSON response.
 */

import { type FC } from "react";
import { StatementLineRow } from "@/components/financial-statements/statement-line-row";
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

// ── Section component ─────────────────────────────────────────────────────────

interface SectionProps {
  section: SerializedSection;
}

function Section({ section }: SectionProps) {
  return (
    <div className="mb-6">
      {/* Section header: level 0 */}
      <StatementLineRow type="header" label={section.label} level={0} />

      {section.groups.map((group) => {
        // Filter out detail rows with zero amount
        const visibleRows = group.rows.filter(
          (row) => parseFloat(row.amount) !== 0,
        );

        return (
          <div key={group.subtype}>
            {/* Subtype group header: level 1 */}
            <StatementLineRow
              type="header"
              label={group.label}
              level={1}
            />

            {/* Detail rows: level 2 (zero rows skipped) */}
            {visibleRows.map((row) => (
              <StatementLineRow
                key={row.accountId}
                type="account"
                label={row.name}
                balance={formatBOB(row.amount)}
                level={2}
              />
            ))}

            {/* Subtotal: level 1 */}
            <StatementLineRow
              type="subtotal"
              label={`Subtotal ${group.label}`}
              balance={formatBOB(group.subtotal)}
              level={1}
            />
          </div>
        );
      })}

      {/* Section total: level 0 */}
      <StatementLineRow
        type="total"
        label={`Total ${section.label}`}
        balance={formatBOB(section.sectionTotal)}
        level={0}
      />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface InitialBalanceViewProps {
  statement: SerializedStatement;
}

export const InitialBalanceView: FC<InitialBalanceViewProps> = ({ statement }) => {
  const [activoSection, pasivoSection] = statement.sections;

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

      {/* Sections: single column, stacked vertically */}
      <div className="space-y-6">
        <Section section={activoSection} />
        <Section section={pasivoSection} />
      </div>
    </div>
  );
};
