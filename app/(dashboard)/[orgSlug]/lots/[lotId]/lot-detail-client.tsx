"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  DollarSign,
  Skull,
  Egg,
  Calculator,
} from "lucide-react";
import Link from "next/link";
import CreateExpenseForm from "@/components/expenses/create-expense-form";
import LogMortalityForm from "@/components/mortality/log-mortality-form";
import type { LotSummary } from "@/features/lots/lots.types";
import type { ExpenseWithRelations } from "@/features/expenses/expenses.types";
import type { MortalityLogWithRelations } from "@/features/mortality/mortality.types";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Activo", className: "bg-green-100 text-green-800" },
  CLOSED: { label: "Cerrado", className: "bg-gray-100 text-gray-800" },
  SOLD: { label: "Vendido", className: "bg-blue-100 text-blue-800" },
};

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  ALIMENTO: { label: "Alimento", className: "bg-amber-100 text-amber-800" },
  CHALA: { label: "Chala", className: "bg-yellow-100 text-yellow-800" },
  AGUA: { label: "Agua", className: "bg-cyan-100 text-cyan-800" },
  GARRAFAS: { label: "Garrafas", className: "bg-orange-100 text-orange-800" },
  MANTENIMIENTO: {
    label: "Mantenimiento",
    className: "bg-slate-100 text-slate-800",
  },
  GALPONERO: {
    label: "Galponero",
    className: "bg-purple-100 text-purple-800",
  },
  MEDICAMENTOS: {
    label: "Medicamentos",
    className: "bg-red-100 text-red-800",
  },
  VETERINARIO: {
    label: "Veterinario",
    className: "bg-pink-100 text-pink-800",
  },
  OTROS: { label: "Otros", className: "bg-gray-100 text-gray-800" },
};

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface LotDetailClientProps {
  orgSlug: string;
  summary: LotSummary;
  expenses: ExpenseWithRelations[];
  mortalityLogs: MortalityLogWithRelations[];
}

export default function LotDetailClient({
  orgSlug,
  summary,
  expenses,
  mortalityLogs,
}: LotDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"expenses" | "mortality">(
    "expenses",
  );

  const { lot, totalExpenses, totalMortality, aliveCount, costPerChicken } =
    summary;

  const status = STATUS_CONFIG[lot.status] ?? {
    label: lot.status,
    className: "bg-gray-100 text-gray-800",
  };

  const farmId = lot.farmId;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        {farmId && (
          <Link href={`/${orgSlug}/farms/${farmId}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a la Granja
            </Button>
          </Link>
        )}

        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{lot.name}</h1>
              <Badge className={status.className}>{status.label}</Badge>
            </div>
            <p className="text-gray-500 mt-1">
              Galpon #{lot.barnNumber} &middot; Inicio:{" "}
              {formatDate(lot.startDate)}
              {lot.endDate && ` &middot; Cierre: ${formatDate(lot.endDate)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Egg className="h-4 w-4 text-green-600" />
              <p className="text-sm text-gray-500">Pollos Vivos</p>
            </div>
            <p className="text-2xl font-bold">
              {aliveCount.toLocaleString("es-BO")}
            </p>
            <p className="text-xs text-gray-400">
              de {lot.initialCount.toLocaleString("es-BO")} iniciales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-gray-500">Total Gastos</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Skull className="h-4 w-4 text-red-600" />
              <p className="text-sm text-gray-500">Mortalidad</p>
            </div>
            <p className="text-2xl font-bold">
              {totalMortality.toLocaleString("es-BO")}
            </p>
            <p className="text-xs text-gray-400">
              {lot.initialCount > 0
                ? `${((totalMortality / lot.initialCount) * 100).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-purple-600" />
              <p className="text-sm text-gray-500">Costo/Pollo</p>
            </div>
            <p className="text-2xl font-bold">
              {costPerChicken > 0
                ? formatCurrency(costPerChicken)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-2 border-b pb-2 mb-4">
          <Button
            variant={activeTab === "expenses" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("expenses")}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Gastos ({expenses.length})
          </Button>
          <Button
            variant={activeTab === "mortality" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("mortality")}
          >
            <Skull className="h-4 w-4 mr-1" />
            Mortalidad ({mortalityLogs.length})
          </Button>
        </div>

        {/* Expenses Tab */}
        {activeTab === "expenses" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {lot.status === "ACTIVE" && (
                <CreateExpenseForm
                  orgSlug={orgSlug}
                  lotId={lot.id}
                  onCreated={() => router.refresh()}
                />
              )}
            </div>

            {expenses.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <DollarSign className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">
                      No hay gastos registrados
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => {
                  const cat = CATEGORY_CONFIG[expense.category] ?? {
                    label: expense.category,
                    className: "bg-gray-100 text-gray-800",
                  };

                  return (
                    <Card key={expense.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={cat.className}>
                              {cat.label}
                            </Badge>
                            <div>
                              <p className="font-medium">
                                {formatCurrency(Number(expense.amount))}
                              </p>
                              {expense.description && (
                                <p className="text-sm text-gray-500">
                                  {expense.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatDate(expense.date)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mortality Tab */}
        {activeTab === "mortality" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              {lot.status === "ACTIVE" && (
                <LogMortalityForm
                  orgSlug={orgSlug}
                  lotId={lot.id}
                  aliveCount={aliveCount}
                  onCreated={() => router.refresh()}
                />
              )}
            </div>

            {mortalityLogs.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <Skull className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">
                      No hay registros de mortalidad
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {mortalityLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive">
                            -{log.count}
                          </Badge>
                          <div>
                            {log.cause ? (
                              <p className="font-medium">{log.cause}</p>
                            ) : (
                              <p className="text-gray-500 italic">
                                Sin causa especificada
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatDate(log.date)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
