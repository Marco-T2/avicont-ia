"use client";

// Vista jerárquica del Estado de Resultados
// Recibe datos ya serializados desde la API (Decimals → strings)
// Los enums como VALUES se importan desde @/generated/prisma/enums (regla cliente)
import { useState } from "react";
import { AccountSubtype } from "@/generated/prisma/enums";
import { formatSubtypeLabel } from "@/features/accounting/account-subtype.utils";
import { StatementLineRow } from "./statement-line-row";
import { formatBOB } from "./format-money";

// Tipo serializado (Decimals → strings por serializeStatement)
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

type SerializedIncomeStatementCurrent = {
  dateFrom: string;
  dateTo: string;
  income: { groups: SerializedSubtypeGroup[]; total: string };
  expenses: { groups: SerializedSubtypeGroup[]; total: string };
  operatingIncome: string;
  netIncome: string;
  preliminary: boolean;
};

export type SerializedIncomeStatement = {
  orgId: string;
  current: SerializedIncomeStatementCurrent;
};

interface IncomeStatementViewProps {
  statement: SerializedIncomeStatement;
}

interface GroupSectionProps {
  groups: SerializedSubtypeGroup[];
  showZero: boolean;
}

function GroupSection({ groups, showZero }: GroupSectionProps) {
  return (
    <>
      {groups.map((group) => {
        const visibleAccounts = showZero
          ? group.accounts
          : group.accounts.filter((a) => parseFloat(a.balance) !== 0);

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
                label={`${acc.code} — ${acc.name}`}
                balance={formatBOB(acc.balance)}
                level={2}
              />
            ))}
            <StatementLineRow
              type="subtotal"
              label={`Total ${formatSubtypeLabel(group.subtype)}`}
              balance={formatBOB(group.total)}
              level={1}
            />
          </div>
        );
      })}
    </>
  );
}

export function IncomeStatementView({ statement }: IncomeStatementViewProps) {
  const [showZero, setShowZero] = useState(false);
  const { current } = statement;

  const fechaDesde = new Date(current.dateFrom).toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fechaHasta = new Date(current.dateTo).toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Determinar color de la Utilidad Neta según signo
  const netIncomeValue = parseFloat(current.netIncome);
  const netIncomeClass =
    netIncomeValue >= 0
      ? "text-green-700 font-bold"
      : "text-red-700 font-bold";

  // Separar grupos de ingresos y gastos según subtipo
  const incomeGroups = current.income.groups;
  const expenseGroups = current.expenses.groups;

  // Grupos de gastos operativos vs otros gastos
  const operatingExpenseGroups = expenseGroups.filter(
    (g) => g.subtype === AccountSubtype.GASTO_OPERATIVO,
  );
  const otherExpenseGroups = expenseGroups.filter(
    (g) => g.subtype !== AccountSubtype.GASTO_OPERATIVO,
  );

  return (
    <div className="space-y-4">
      {/* Encabezado de período */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Del {fechaDesde} al {fechaHasta}
        </p>
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

      {/* 1. INGRESOS OPERATIVOS */}
      <div>
        <StatementLineRow type="header" label="Ingresos Operativos" level={0} />
        <GroupSection
          groups={incomeGroups.filter(
            (g) => g.subtype === AccountSubtype.INGRESO_OPERATIVO,
          )}
          showZero={showZero}
        />
      </div>

      {/* 2. GASTOS OPERATIVOS */}
      <div>
        <StatementLineRow type="header" label="Gastos Operativos" level={0} />
        <GroupSection groups={operatingExpenseGroups} showZero={showZero} />
      </div>

      {/* 3. UTILIDAD OPERATIVA */}
      <div className="rounded-md bg-blue-50 px-4 py-2">
        <StatementLineRow
          type="total"
          label="Utilidad Operativa"
          balance={formatBOB(current.operatingIncome)}
          level={0}
        />
      </div>

      {/* 4. INGRESOS NO OPERATIVOS */}
      {incomeGroups.some(
        (g) => g.subtype === AccountSubtype.INGRESO_NO_OPERATIVO,
      ) && (
        <div>
          <StatementLineRow
            type="header"
            label="Ingresos No Operativos"
            level={0}
          />
          <GroupSection
            groups={incomeGroups.filter(
              (g) => g.subtype === AccountSubtype.INGRESO_NO_OPERATIVO,
            )}
            showZero={showZero}
          />
        </div>
      )}

      {/* 5. OTROS GASTOS (administrativos, financieros, no operativos) */}
      {otherExpenseGroups.length > 0 && (
        <div>
          <StatementLineRow type="header" label="Otros Gastos" level={0} />
          <GroupSection groups={otherExpenseGroups} showZero={showZero} />
        </div>
      )}

      {/* 6. UTILIDAD NETA */}
      <div className="rounded-md px-4 py-2">
        <div
          className={`flex items-center justify-between border-t-2 border-gray-800 pt-2 ${netIncomeClass}`}
        >
          <span className="text-base font-bold">Utilidad Neta</span>
          <span className="font-mono text-base font-bold">
            {formatBOB(current.netIncome)}
          </span>
        </div>
      </div>
    </div>
  );
}
