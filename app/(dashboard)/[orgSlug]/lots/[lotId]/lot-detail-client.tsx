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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ArrowLeft,
  DollarSign,
  Skull,
  Egg,
  Calculator,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import CreateExpenseForm from "@/components/expenses/create-expense-form";
import LogMortalityForm from "@/components/mortality/log-mortality-form";
import { EditLotDialog } from "@/components/lots/edit-lot-dialog";
import { DeleteLotDialog } from "@/components/lots/delete-lot-dialog";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import { EditMortalityDialog } from "@/components/mortality/edit-mortality-dialog";
import RegistrarConIABoton from "@/components/agent/registrar-con-ia-boton";
import type { LotSnapshot, LotSummary, LotSummaryShape } from "@/modules/lot/presentation/server";
import type { ExpenseSnapshot } from "@/modules/expense/presentation/server";
import type { Mortality } from "@/modules/mortality/presentation/server";

/** Slice de YYYY-MM-DD para inputs type="date" — date-utils ya usa ese formato. */
function isoDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

type _LotSummaryClassPreserved = LotSummary;

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


interface LotDetailClientProps {
  orgSlug: string;
  lot: LotSnapshot;
  summary: LotSummaryShape;
  expenses: ExpenseSnapshot[];
  mortalityLogs: ReturnType<Mortality["toJSON"]>[];
}

export default function LotDetailClient({
  orgSlug,
  lot,
  summary,
  expenses,
  mortalityLogs,
}: LotDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"expenses" | "mortality">(
    "expenses",
  );

  // Lot edit/delete dialog state
  const [editLotOpen, setEditLotOpen] = useState(false);
  const [deleteLotOpen, setDeleteLotOpen] = useState(false);

  // Per-row edit dialog state (by id; null === closed)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(
    null,
  );
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
    null,
  );
  const [editingMortalityId, setEditingMortalityId] = useState<string | null>(
    null,
  );
  const [deletingMortalityId, setDeletingMortalityId] = useState<string | null>(
    null,
  );
  const [rowDeleting, setRowDeleting] = useState(false);

  const editingExpense = editingExpenseId
    ? expenses.find((e) => e.id === editingExpenseId) ?? null
    : null;
  const deletingExpense = deletingExpenseId
    ? expenses.find((e) => e.id === deletingExpenseId) ?? null
    : null;
  const editingMortality = editingMortalityId
    ? mortalityLogs.find((m) => m.id === editingMortalityId) ?? null
    : null;
  const deletingMortality = deletingMortalityId
    ? mortalityLogs.find((m) => m.id === deletingMortalityId) ?? null
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

  const { totalExpenses, totalMortality, aliveCount, costPerChicken } =
    summary;

  const status = STATUS_CONFIG[lot.status] ?? {
    label: lot.status,
    className:
      "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
  };

  // Post-collapse (REQ-200, T20): LotSnapshot carries free-text
  // `farmName` instead of `farmId`. The C3 stub `const farmId =
  // null` is retired; the back link now points at the flat /lots
  // list landed in T18 (the /farms hierarchy is deleted in T22).
  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href={`/${orgSlug}/lots`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Mis Lotes
          </Button>
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{lot.displayName}</h1>
              <Badge className={status.className}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Granja: {lot.farmName} &middot; Inicio:{" "}
              {formatDateBO(lot.startDate)}
              {lot.endDate && ` · Cierre: ${formatDateBO(lot.endDate)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lot.status === "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditLotOpen(true)}
                aria-label="Editar lote"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteLotOpen(true)}
              aria-label="Borrar lote"
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Borrar
            </Button>
            <RegistrarConIABoton
              orgSlug={orgSlug}
              contextHints={{
                lotId: lot.id,
                lotName: lot.displayName,
                // farmId dropped (REQ-200). farmName retained as the
                // free-text grouping signal for the AI agent (REQ-205).
                farmName: lot.farmName,
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Egg className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-muted-foreground">Pollos Vivos</p>
            </div>
            <p className="text-2xl font-bold">
              {aliveCount.toLocaleString("es-BO")}
            </p>
            <p className="text-xs text-muted-foreground">
              de {lot.initialCount.toLocaleString("es-BO")} iniciales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-muted-foreground">Total Gastos</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Skull className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-sm text-muted-foreground">Mortalidad</p>
            </div>
            <p className="text-2xl font-bold">
              {totalMortality.toLocaleString("es-BO")}
            </p>
            <p className="text-xs text-muted-foreground">
              {lot.initialCount > 0
                ? `${((totalMortality / lot.initialCount) * 100).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <p className="text-sm text-muted-foreground">Costo/Pollo</p>
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
                    <DollarSign className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
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
                    className:
                      "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200",
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
                                <p className="text-sm text-muted-foreground">
                                  {expense.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-sm text-muted-foreground">
                              {formatDateBO(expense.date)}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Editar gasto"
                              onClick={() => setEditingExpenseId(expense.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Borrar gasto"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeletingExpenseId(expense.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                    <Skull className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
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
                              <p className="text-muted-foreground italic">
                                Sin causa especificada
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-muted-foreground">
                            {formatDateBO(log.date)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar registro de mortalidad"
                            onClick={() => setEditingMortalityId(log.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Borrar registro de mortalidad"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeletingMortalityId(log.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs (always mounted; visibility controlled by `open` prop) */}
      <EditLotDialog
        open={editLotOpen}
        onOpenChange={setEditLotOpen}
        orgSlug={orgSlug}
        lotId={lot.id}
        initialFarmName={lot.farmName}
        onUpdated={() => router.refresh()}
      />
      <DeleteLotDialog
        open={deleteLotOpen}
        onOpenChange={setDeleteLotOpen}
        orgSlug={orgSlug}
        lotId={lot.id}
        lotName={lot.displayName}
        onDeleted={() => {
          // Lot is gone — bounce back to the flat /lots list
          // (post-collapse REQ-200, T20).
          router.push(`/${orgSlug}/lots`);
        }}
      />
      {editingExpense ? (
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
          onUpdated={() => router.refresh()}
        />
      ) : null}
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
      {editingMortality ? (
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
          onUpdated={() => router.refresh()}
        />
      ) : null}
      <ConfirmDialog
        open={deletingMortalityId !== null}
        onOpenChange={(o) => {
          if (!o) setDeletingMortalityId(null);
        }}
        title="Borrar registro de mortalidad"
        description={
          deletingMortality
            ? `Se borrará el registro de -${deletingMortality.count} pollo(s) del ${formatDateBO(deletingMortality.date)}. La cantidad viva del lote se recupera automáticamente. Esta acción no se puede deshacer.`
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
