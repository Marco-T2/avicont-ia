"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, BarChart3, Loader2, FileSpreadsheet } from "lucide-react";

const ACCOUNT_TYPE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVO: { label: "Activo", className: "bg-blue-100 text-blue-800" },
  PASIVO: { label: "Pasivo", className: "bg-red-100 text-red-800" },
  PATRIMONIO: {
    label: "Patrimonio",
    className: "bg-purple-100 text-purple-800",
  },
  INGRESO: { label: "Ingreso", className: "bg-green-100 text-green-800" },
  GASTO: { label: "Gasto", className: "bg-orange-100 text-orange-800" },
};

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface ReportsPageClientProps {
  orgSlug: string;
}

export default function ReportsPageClient({
  orgSlug,
}: ReportsPageClientProps) {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function fetchTrialBalance() {
    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);

      const res = await fetch(
        `/api/organizations/${orgSlug}/ledger?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Error al cargar el balance");

      const data = await res.json();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  const totalDebit = rows.reduce((sum, r) => sum + r.totalDebit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.totalCredit, 0);

  return (
    <>
      {/* Navigation card — Sumas y Saldos (C9.S3) */}
      <Link href={`/${orgSlug}/accounting/trial-balance`}>
        <Card className="hover:bg-accent transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Sumas y Saldos</CardTitle>
              <CardDescription>
                Formulario F-605 · Balance de Comprobación
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      {/* Navigation card — Estado de Evolución del Patrimonio Neto */}
      <Link href={`/${orgSlug}/accounting/equity-statement`}>
        <Card className="hover:bg-accent transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Estado de Evolución del Patrimonio Neto</CardTitle>
              <CardDescription>
                Formulario F-605 · Patrimonio Neto
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Balance de Comprobacion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Fecha de corte (opcional)</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-48"
              />
            </div>
            <Button onClick={fetchTrialBalance} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Generar Reporte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>
              Balance de Comprobacion
              {date && ` al ${new Date(date).toLocaleDateString("es-BO")}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Codigo
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Cuenta
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Tipo
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Debe
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Haber
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600">
                          No hay datos para mostrar
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows
                      .filter(
                        (r) => r.totalDebit > 0 || r.totalCredit > 0,
                      )
                      .map((row, idx) => {
                        const typeConfig = ACCOUNT_TYPE_CONFIG[
                          row.accountType
                        ] ?? {
                          label: row.accountType,
                          className: "bg-gray-100 text-gray-800",
                        };

                        return (
                          <tr key={idx} className="border-b">
                            <td className="py-3 px-4 font-mono text-gray-600">
                              {row.accountCode}
                            </td>
                            <td className="py-3 px-4">{row.accountName}</td>
                            <td className="py-3 px-4">
                              <Badge className={typeConfig.className}>
                                {typeConfig.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {row.totalDebit > 0
                                ? formatCurrency(row.totalDebit)
                                : ""}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {row.totalCredit > 0
                                ? formatCurrency(row.totalCredit)
                                : ""}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-medium ${
                                row.balance >= 0
                                  ? "text-blue-700"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(row.balance)}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td colSpan={3} className="py-3 px-4 text-right">
                        Totales
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(totalCredit)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono ${
                          Math.round(totalDebit * 100) ===
                          Math.round(totalCredit * 100)
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrency(totalDebit - totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">
                Presione Generar Reporte para ver el Balance de Comprobacion
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
