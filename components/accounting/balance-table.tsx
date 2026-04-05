"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale } from "lucide-react";

interface Period {
  id: string;
  name: string;
  year: number;
  status: string;
}

interface Balance {
  id: string;
  totalDebit: number | string;
  totalCredit: number | string;
  balance: number | string;
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    nature: string;
  };
  period: {
    id: string;
    name: string;
    year: number;
  };
}

interface BalanceTableProps {
  orgSlug: string;
  periods: Period[];
  balances: Balance[];
  selectedPeriodId?: string;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: "Activo",
  LIABILITY: "Pasivo",
  EQUITY: "Patrimonio",
  REVENUE: "Ingreso",
  EXPENSE: "Gasto",
};

function formatAmount(value: number | string): string {
  const num = Number(value);
  return num.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function BalanceTable({
  orgSlug,
  periods,
  balances,
  selectedPeriodId,
}: BalanceTableProps) {
  const router = useRouter();

  function handlePeriodChange(value: string) {
    if (value === "none") {
      router.push(`/${orgSlug}/accounting/balances`);
    } else {
      router.push(`/${orgSlug}/accounting/balances?periodId=${value}`);
    }
  }

  const totalDebits = balances.reduce(
    (sum, b) => sum + Number(b.totalDebit),
    0,
  );
  const totalCredits = balances.reduce(
    (sum, b) => sum + Number(b.totalCredit),
    0,
  );

  return (
    <>
      {/* Period selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 min-w-[280px]">
              <Label className="text-sm">Período Fiscal</Label>
              <Select
                value={selectedPeriodId ?? "none"}
                onValueChange={handlePeriodChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccione un período</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.year}){" "}
                      {p.status === "OPEN" ? "— Abierto" : "— Cerrado"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No period selected */}
      {!selectedPeriodId && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Scale className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">
                Seleccione un período fiscal para ver los saldos de cuentas
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balances table */}
      {selectedPeriodId && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Código
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Cuenta
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Tipo
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Débitos
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Créditos
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {balances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Scale className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600">
                          No hay saldos para este período
                        </p>
                      </td>
                    </tr>
                  ) : (
                    balances.map((b) => {
                      const balanceNum = Number(b.balance);
                      const isNegative = balanceNum < 0;

                      return (
                        <tr key={b.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-gray-700">
                            {b.account.code}
                          </td>
                          <td className="py-3 px-4">{b.account.name}</td>
                          <td className="py-3 px-4 text-gray-600">
                            {ACCOUNT_TYPE_LABELS[b.account.type] ??
                              b.account.type}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatAmount(b.totalDebit)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatAmount(b.totalCredit)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-medium ${
                              isNegative ? "text-red-600" : "text-gray-900"
                            }`}
                          >
                            {formatAmount(b.balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {balances.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td colSpan={3} className="py-3 px-4 text-gray-700">
                        Totales
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatAmount(totalDebits)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatAmount(totalCredits)}
                      </td>
                      <td className="py-3 px-4" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
