"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { MapPin, ArrowLeft, Egg, DollarSign, Skull } from "lucide-react";
import Link from "next/link";
import CreateLotDialog from "@/components/lots/create-lot-dialog";
import RegistrarConIABoton from "@/components/agent/registrar-con-ia-boton";
import CreateExpenseForm from "@/components/expenses/create-expense-form";
import LogMortalityForm from "@/components/mortality/log-mortality-form";
import type { FarmSnapshot } from "@/modules/farm/presentation/server";
import type { LotSnapshot, LotSummaryShape } from "@/modules/lot/presentation/server";
import type { ExpenseWithRelations } from "@/features/expenses";
import type { Mortality } from "@/modules/mortality/presentation/server";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Activo",
    className:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  },
  CLOSED: {
    label: "Cerrado",
    className:
      "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
  },
  SOLD: {
    label: "Vendido",
    className:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  ALIMENTO: {
    label: "Alimento",
    className:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
  },
  CHALA: {
    label: "Chala",
    className:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  },
  AGUA: {
    label: "Agua",
    className:
      "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
  },
  GARRAFAS: {
    label: "Garrafas",
    className:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
  },
  MANTENIMIENTO: {
    label: "Mantenimiento",
    className:
      "bg-slate-100 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200",
  },
  GALPONERO: {
    label: "Galponero",
    className:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
  },
  MEDICAMENTOS: {
    label: "Medicamentos",
    className:
      "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  },
  VETERINARIO: {
    label: "Veterinario",
    className:
      "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200",
  },
  OTROS: {
    label: "Otros",
    className:
      "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
  },
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

type ExpenseClient = Omit<ExpenseWithRelations, "amount"> & { amount: number };
type MortalityClient = ReturnType<Mortality["toJSON"]>;

interface FarmDetailClientProps {
  orgSlug: string;
  farm: FarmSnapshot;
  lots: Array<{
    lot: LotSnapshot;
    summary: LotSummaryShape;
    recentExpenses: ExpenseClient[];
    recentMortality: MortalityClient[];
  }>;
  farmMetrics: { pollosTotales: number; gastoMes: number; mortalidadMes: number };
}

export default function FarmDetailClient({
  orgSlug,
  farm,
  lots,
  farmMetrics,
}: FarmDetailClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href={`/${orgSlug}/farms`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Granjas
          </Button>
        </Link>

        <div className="flex justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{farm.name}</h1>
            {farm.location && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm">
                <MapPin className="h-4 w-4" />
                {farm.location}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <RegistrarConIABoton
              orgSlug={orgSlug}
              contextHints={{
                farmId: farm.id,
                farmName: farm.name,
              }}
            />
            <CreateLotDialog
              orgSlug={orgSlug}
              farmId={farm.id}
              onCreated={() => router.refresh()}
            />
          </div>
        </div>
      </div>

      {/* 3 granja-header métricas globales — big-picture context awareness pre-accordion */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Egg className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-xs sm:text-sm text-muted-foreground">Pollos totales</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold">
              {farmMetrics.pollosTotales.toLocaleString("es-BO")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs sm:text-sm text-muted-foreground">Gasto del mes</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold">
              {formatCurrency(farmMetrics.gastoMes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Skull className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-xs sm:text-sm text-muted-foreground">Mortalidad del mes</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold">
              {farmMetrics.mortalidadMes.toLocaleString("es-BO")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lots accordion */}
      {lots.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Egg className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                No hay lotes en esta granja
              </p>
              <p className="text-sm text-muted-foreground">
                Crea un lote para empezar a registrar tus pollos
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Lotes ({lots.length})
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {lots.map(({ lot, summary, recentExpenses, recentMortality }) => {
              const status = STATUS_CONFIG[lot.status] ?? {
                label: lot.status,
                className:
                  "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
              };
              return (
                <AccordionItem key={lot.id} value={lot.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-col gap-3 flex-1 mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base sm:text-lg">
                          {lot.name}
                        </h3>
                        <Badge className={status.className}>{status.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm text-left w-full">
                        <div>
                          <p className="text-muted-foreground">Galpón</p>
                          <p className="font-medium">#{lot.barnNumber}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total gastado</p>
                          <p className="font-medium">
                            {formatCurrency(summary.totalExpenses)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pollos vivos</p>
                          <p className="font-medium">
                            {summary.aliveCount.toLocaleString("es-BO")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Costo/pollo</p>
                          <p className="font-medium">
                            {summary.costPerChicken > 0
                              ? formatCurrency(summary.costPerChicken)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* 3 botones cluster — AI + manual gasto + manual mortalidad scoped per-lot */}
                      <div className="flex flex-wrap gap-2">
                        <RegistrarConIABoton
                          orgSlug={orgSlug}
                          contextHints={{
                            lotId: lot.id,
                            lotName: lot.name,
                            farmId: lot.farmId ?? farm.id,
                          }}
                        />
                        {lot.status === "ACTIVE" && (
                          <>
                            <CreateExpenseForm
                              orgSlug={orgSlug}
                              lotId={lot.id}
                              onCreated={() => router.refresh()}
                            />
                            <LogMortalityForm
                              orgSlug={orgSlug}
                              lotId={lot.id}
                              aliveCount={summary.aliveCount}
                              onCreated={() => router.refresh()}
                            />
                          </>
                        )}
                      </div>

                      {/* Gastos recientes — 10 max desc by date (server-sliced) */}
                      <div>
                        <h4 className="font-semibold mb-2 text-sm sm:text-base">
                          Gastos recientes
                        </h4>
                        {recentExpenses.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin gastos registrados.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {recentExpenses.map((expense) => {
                              const cat = CATEGORY_CONFIG[expense.category] ?? {
                                label: expense.category,
                                className:
                                  "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
                              };
                              return (
                                <Card key={expense.id}>
                                  <CardContent className="py-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Badge className={cat.className}>
                                          {cat.label}
                                        </Badge>
                                        <div className="min-w-0">
                                          <p className="font-medium text-sm">
                                            {formatCurrency(Number(expense.amount))}
                                          </p>
                                          {expense.description && (
                                            <p className="text-xs text-muted-foreground truncate">
                                              {expense.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground shrink-0">
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

                      {/* Mortalidad reciente — 5 max desc by date (server-sliced) */}
                      <div>
                        <h4 className="font-semibold mb-2 text-sm sm:text-base">
                          Mortalidad reciente
                        </h4>
                        {recentMortality.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin mortalidad registrada.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {recentMortality.map((m) => (
                              <Card key={m.id}>
                                <CardContent className="py-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Badge variant="destructive">
                                        -{m.count}
                                      </Badge>
                                      <div className="min-w-0">
                                        {m.cause ? (
                                          <p className="font-medium text-sm truncate">
                                            {m.cause}
                                          </p>
                                        ) : (
                                          <p className="text-xs text-muted-foreground italic">
                                            Sin causa
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground shrink-0">
                                      {formatDate(m.date)}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Ver más — preserved /lots/[lotId] route deep-link (D-POC-1-NEW-LOTS-ROUTE-PRESERVATION sinergia) */}
                      <div className="pt-1">
                        <Link href={`/${orgSlug}/lots/${lot.id}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            Ver más detalles →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
    </div>
  );
}
