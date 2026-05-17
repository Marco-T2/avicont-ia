"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDateBO } from "@/lib/date-utils";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MapPin, ArrowLeft, Egg, DollarSign, Skull, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import CreateLotDialog from "@/components/lots/create-lot-dialog";
import { EditLotDialog } from "@/components/lots/edit-lot-dialog";
import { DeleteLotDialog } from "@/components/lots/delete-lot-dialog";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import { EditMortalityDialog } from "@/components/mortality/edit-mortality-dialog";
import RegistrarConIABoton from "@/components/agent/registrar-con-ia-boton";
import CreateExpenseForm from "@/components/expenses/create-expense-form";
import LogMortalityForm from "@/components/mortality/log-mortality-form";
import type { FarmSnapshot } from "@/modules/farm/presentation/server";
import type { LotSnapshot, LotSummaryShape } from "@/modules/lot/presentation/server";
import type { ExpenseSnapshot } from "@/modules/expense/presentation/server";
import type { Mortality } from "@/modules/mortality/presentation/server";

function isoDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

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


type ExpenseClient = ExpenseSnapshot;
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
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [editingMortalityId, setEditingMortalityId] = useState<string | null>(null);
  const [deletingMortalityId, setDeletingMortalityId] = useState<string | null>(null);
  const [rowDeleting, setRowDeleting] = useState(false);

  const editingLot = lots.find((l) => l.lot.id === editingLotId)?.lot;
  const deletingLot = lots.find((l) => l.lot.id === deletingLotId)?.lot;

  // Flat lookups across all lots — recentExpenses/recentMortality are
  // nested per-lot in this page, vs. flat arrays in lot-detail-client.
  const allExpenses = lots.flatMap((l) => l.recentExpenses);
  const allMortality = lots.flatMap((l) => l.recentMortality);
  const editingExpense = editingExpenseId
    ? allExpenses.find((e) => e.id === editingExpenseId) ?? null
    : null;
  const deletingExpense = deletingExpenseId
    ? allExpenses.find((e) => e.id === deletingExpenseId) ?? null
    : null;
  const editingMortality = editingMortalityId
    ? allMortality.find((m) => m.id === editingMortalityId) ?? null
    : null;
  const deletingMortality = deletingMortalityId
    ? allMortality.find((m) => m.id === deletingMortalityId) ?? null
    : null;

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    setRowDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/expenses/${deletingExpense.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al borrar el gasto");
        return;
      }
      toast.success("Gasto borrado");
      setDeletingExpenseId(null);
      router.refresh();
    } catch (e) {
      console.error("delete-expense:", e);
      toast.error("Error al borrar el gasto");
    } finally {
      setRowDeleting(false);
    }
  };

  const handleDeleteMortality = async () => {
    if (!deletingMortality) return;
    setRowDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/mortality/${deletingMortality.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al borrar el registro");
        return;
      }
      toast.success("Registro de mortalidad borrado");
      setDeletingMortalityId(null);
      router.refresh();
    } catch (e) {
      console.error("delete-mortality:", e);
      toast.error("Error al borrar el registro");
    } finally {
      setRowDeleting(false);
    }
  };

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
          <Accordion type="single" collapsible className="w-full space-y-3">
            {lots.map(({ lot, summary, recentExpenses, recentMortality }) => {
              const status = STATUS_CONFIG[lot.status] ?? {
                label: lot.status,
                className:
                  "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
              };
              return (
                <AccordionItem
                  key={lot.id}
                  value={lot.id}
                  className="border-2 rounded-lg bg-card px-4 shadow"
                >
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
                      {/* Lote actions — editar/eliminar sin entrar al detail page */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingLotId(lot.id)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar lote
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                          onClick={() => setDeletingLotId(lot.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar lote
                        </Button>
                      </div>

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

                      {/* Gastos + Mortalidad recientes — side-by-side en desktop, stack en mobile.
                          Filas compactas con border-b (no Card por item) para densidad visual. */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2 text-sm sm:text-base">
                            Gastos recientes
                          </h4>
                          {recentExpenses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Sin gastos registrados.
                            </p>
                          ) : (
                            <ul className="divide-y rounded-md border bg-background">
                              {recentExpenses.map((expense) => {
                                const cat = CATEGORY_CONFIG[expense.category] ?? {
                                  label: expense.category,
                                  className:
                                    "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
                                };
                                return (
                                  <li
                                    key={expense.id}
                                    className="flex items-center justify-between gap-2 px-3 py-2"
                                  >
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
                                    <div className="flex items-center gap-1 shrink-0">
                                      <p className="text-xs text-muted-foreground mr-1">
                                        {formatDateBO(expense.date)}
                                      </p>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Editar gasto"
                                        className="h-7 w-7"
                                        onClick={() => setEditingExpenseId(expense.id)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Borrar gasto"
                                        className="h-7 w-7 text-red-600 hover:text-red-700"
                                        onClick={() => setDeletingExpenseId(expense.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 text-sm sm:text-base">
                            Mortalidad reciente
                          </h4>
                          {recentMortality.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Sin mortalidad registrada.
                            </p>
                          ) : (
                            <ul className="divide-y rounded-md border bg-background">
                              {recentMortality.map((m) => (
                                <li
                                  key={m.id}
                                  className="flex items-center justify-between gap-2 px-3 py-2"
                                >
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
                                  <div className="flex items-center gap-1 shrink-0">
                                    <p className="text-xs text-muted-foreground mr-1">
                                      {formatDateBO(m.date)}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Editar registro de mortalidad"
                                      className="h-7 w-7"
                                      onClick={() => setEditingMortalityId(m.id)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Borrar registro de mortalidad"
                                      className="h-7 w-7 text-red-600 hover:text-red-700"
                                      onClick={() => setDeletingMortalityId(m.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
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

      {/* Lot dialogs — mounted at root level; visibility driven by selection state. */}
      {editingLot && (
        <EditLotDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditingLotId(null);
          }}
          orgSlug={orgSlug}
          lotId={editingLot.id}
          initialName={editingLot.name}
          initialBarnNumber={editingLot.barnNumber}
          onUpdated={() => {
            setEditingLotId(null);
            router.refresh();
          }}
        />
      )}
      {deletingLot && (
        <DeleteLotDialog
          open
          onOpenChange={(o) => {
            if (!o) setDeletingLotId(null);
          }}
          orgSlug={orgSlug}
          lotId={deletingLot.id}
          lotName={deletingLot.name}
          onDeleted={() => {
            setDeletingLotId(null);
            router.refresh();
          }}
        />
      )}

      {/* Expense + Mortality dialogs — mirror lot-detail-client pattern. */}
      {editingExpense && (
        <EditExpenseDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditingExpenseId(null);
          }}
          orgSlug={orgSlug}
          expenseId={editingExpense.id}
          initialAmount={Number(editingExpense.amount)}
          initialCategory={editingExpense.category}
          initialDescription={editingExpense.description}
          initialDate={isoDate(editingExpense.date)}
          onUpdated={() => {
            setEditingExpenseId(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={deletingExpenseId !== null}
        onOpenChange={(o) => {
          if (!o) setDeletingExpenseId(null);
        }}
        title="Borrar gasto"
        description={
          deletingExpense
            ? `Se borrará el gasto de ${formatCurrency(Number(deletingExpense.amount))} del ${formatDateBO(deletingExpense.date)}. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Borrar"
        variant="destructive"
        loading={rowDeleting}
        onConfirm={handleDeleteExpense}
      />

      {editingMortality && (
        <EditMortalityDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditingMortalityId(null);
          }}
          orgSlug={orgSlug}
          logId={editingMortality.id}
          initialCount={editingMortality.count}
          initialCause={editingMortality.cause}
          initialDate={isoDate(editingMortality.date)}
          onUpdated={() => {
            setEditingMortalityId(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={deletingMortalityId !== null}
        onOpenChange={(o) => {
          if (!o) setDeletingMortalityId(null);
        }}
        title="Borrar registro de mortalidad"
        description={
          deletingMortality
            ? `Se borrará el registro de ${deletingMortality.count} ave(s) del ${formatDateBO(deletingMortality.date)}. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Borrar"
        variant="destructive"
        loading={rowDeleting}
        onConfirm={handleDeleteMortality}
      />
    </div>
  );
}
