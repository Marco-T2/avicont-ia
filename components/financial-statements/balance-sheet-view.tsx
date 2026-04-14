"use client";

// Vista jerárquica del Balance General (Estado de Situación Patrimonial)
// Recibe datos ya serializados desde la API (Decimals → strings)
// Los enums como VALUES se importan desde @/generated/prisma/enums (regla cliente)
import { useState } from "react";
import { AccountSubtype } from "@/generated/prisma/enums";
import { formatSubtypeLabel } from "@/features/accounting/account-subtype.utils";
import { StatementLineRow } from "./statement-line-row";
import { formatBOB } from "./format-money";

// Tipo serializado: los Decimals llegan como strings desde serializeStatement
type SerializedAccount = {
  accountId: string;
  code: string;
  name: string;
  balance: string;
};

type SerializedSubtypeGroup = {
  subtype: AccountSubtype;
  label: string;
  accounts: SerializedAccount[];
  total: string;
};

type SerializedBalanceSheetCurrent = {
  asOfDate: string;
  assets: { groups: SerializedSubtypeGroup[]; total: string };
  liabilities: { groups: SerializedSubtypeGroup[]; total: string };
  equity: {
    groups: SerializedSubtypeGroup[];
    total: string;
    retainedEarningsOfPeriod: string;
  };
  imbalanced: boolean;
  imbalanceDelta: string;
  preliminary: boolean;
};

export type SerializedBalanceSheet = {
  orgId: string;
  current: SerializedBalanceSheetCurrent;
};

interface BalanceSheetViewProps {
  statement: SerializedBalanceSheet;
}

interface SectionProps {
  title: string;
  groups: SerializedSubtypeGroup[];
  total: string;
  showZero: boolean;
}

function Section({ title, groups, total, showZero }: SectionProps) {
  return (
    <div className="mb-6">
      <StatementLineRow type="header" label={title} level={0} />
      {groups.map((group) => {
        const visibleAccounts = showZero
          ? group.accounts
          : group.accounts.filter(
              (a) => parseFloat(a.balance) !== 0 || a.accountId === "__synthetic_retained_earnings__",
            );

        if (visibleAccounts.length === 0) return null;

        return (
          <div key={group.subtype}>
            <StatementLineRow
              type="header"
              label={formatSubtypeLabel(group.subtype)}
              level={1}
            />
            {visibleAccounts.map((acc) => (
              <StatementLineRow
                key={acc.accountId}
                type="account"
                label={`${acc.code !== "—" ? acc.code + " — " : ""}${acc.name}`}
                balance={formatBOB(acc.balance)}
                level={2}
              />
            ))}
            <StatementLineRow
              type="subtotal"
              label={`Subtotal ${formatSubtypeLabel(group.subtype)}`}
              balance={formatBOB(group.total)}
              level={1}
            />
          </div>
        );
      })}
      <StatementLineRow
        type="total"
        label={`Total ${title}`}
        balance={formatBOB(total)}
        level={0}
      />
    </div>
  );
}

export function BalanceSheetView({ statement }: BalanceSheetViewProps) {
  const [showZero, setShowZero] = useState(false);
  const { current } = statement;

  const fechaFormateada = new Date(current.asOfDate).toLocaleDateString(
    "es-BO",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div className="space-y-4">
      {/* Encabezado de fecha de corte */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Al {fechaFormateada}</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showZero}
            onChange={(e) => setShowZero(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
            aria-label="Mostrar cuentas sin movimientos"
          />
          Mostrar cuentas sin movimientos
        </label>
      </div>

      {/* ACTIVO */}
      <Section
        title="Activo"
        groups={current.assets.groups}
        total={current.assets.total}
        showZero={showZero}
      />

      {/* PASIVO */}
      <Section
        title="Pasivo"
        groups={current.liabilities.groups}
        total={current.liabilities.total}
        showZero={showZero}
      />

      {/* PATRIMONIO */}
      <Section
        title="Patrimonio"
        groups={current.equity.groups}
        total={current.equity.total}
        showZero={showZero}
      />

      {/* Ecuación contable */}
      <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <p className="font-semibold text-gray-700">Verificación de Ecuación Contable</p>
        <div className="mt-1 flex flex-wrap gap-4 font-mono text-gray-600">
          <span>Activo: {formatBOB(current.assets.total)}</span>
          <span>=</span>
          <span>Pasivo: {formatBOB(current.liabilities.total)}</span>
          <span>+</span>
          <span>Patrimonio: {formatBOB(current.equity.total)}</span>
        </div>
      </div>
    </div>
  );
}
