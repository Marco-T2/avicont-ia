"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Account } from "@/generated/prisma/client";
import Decimal from "decimal.js";
import { eq, sumDecimals } from "@/modules/accounting/presentation";
import { todayLocal } from "@/lib/date-utils";

interface JournalLineRow {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

interface CreateJournalEntryFormProps {
  orgSlug: string;
  accounts: Account[];
  onCancel: () => void;
  onCreated: () => void;
}

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

export default function CreateJournalEntryForm({
  orgSlug,
  accounts,
  onCancel,
  onCreated,
}: CreateJournalEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [description, setDescription] = useState("");
  const [voucherType, setVoucherType] = useState("");
  const [lines, setLines] = useState<JournalLineRow[]>([
    { id: nextRowId(), accountId: "", debit: "", credit: "", description: "" },
    { id: nextRowId(), accountId: "", debit: "", credit: "", description: "" },
  ]);

  const activeAccounts = accounts.filter((a) => a.isActive);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { id: nextRowId(), accountId: "", debit: "", credit: "", description: "" },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length <= 2) {
      toast.error("Un asiento debe tener al menos 2 lineas");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, field: keyof JournalLineRow, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    );
  }

  const debits = lines.map((l) => new Decimal(l.debit || "0"));
  const credits = lines.map((l) => new Decimal(l.credit || "0"));
  const totalDebitD = sumDecimals(debits);
  const totalCreditD = sumDecimals(credits);
  const totalDebit = totalDebitD.toNumber();
  const totalCredit = totalCreditD.toNumber();
  const isBalanced = eq(totalDebitD, totalCreditD) && totalDebitD.gt(0);

  const allLinesValid = lines.every(
    (l) =>
      l.accountId &&
      (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0),
  );

  const canSubmit =
    date && description && voucherType && isBalanced && allLinesValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const body = {
        date,
        description,
        voucherType,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined,
        })),
      };

      const res = await fetch(`/api/organizations/${orgSlug}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al crear el asiento");
      }

      toast.success("Asiento contable creado exitosamente");
      onCreated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el asiento",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver al Libro Diario
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Asiento Contable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-date">Fecha</Label>
              <Input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voucher-type">Tipo de Comprobante</Label>
              <Select value={voucherType} onValueChange={setVoucherType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGRESO">Ingreso</SelectItem>
                  <SelectItem value="EGRESO">Egreso</SelectItem>
                  <SelectItem value="TRASPASO">Traspaso</SelectItem>
                  <SelectItem value="DIARIO">Diario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="entry-description">Descripcion</Label>
              <Input
                id="entry-description"
                placeholder="Descripcion del asiento"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lineas del Asiento</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar Linea
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground w-64">
                    Cuenta
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                    Descripcion
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-36">
                    Debe
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-36">
                    Haber
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b">
                    <td className="py-2 px-2">
                      <Select
                        value={line.accountId}
                        onValueChange={(val) =>
                          updateLine(line.id, "accountId", val)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccione cuenta" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        placeholder="Detalle (opcional)"
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.id, "description", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="text-right font-mono"
                        value={line.debit}
                        onChange={(e) =>
                          updateLine(line.id, "debit", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="text-right font-mono"
                        value={line.credit}
                        onChange={(e) =>
                          updateLine(line.id, "credit", e.target.value)
                        }
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted">
                  <td colSpan={2} className="py-3 px-2 text-right font-bold">
                    Totales
                  </td>
                  <td
                    className={`py-3 px-2 text-right font-mono font-bold ${
                      isBalanced ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(totalDebit)}
                  </td>
                  <td
                    className={`py-3 px-2 text-right font-mono font-bold ${
                      isBalanced ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(totalCredit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {!isBalanced && totalDebit > 0 && (
            <p className="mt-3 text-sm text-destructive">
              Los debitos y creditos no balancean. Diferencia:{" "}
              {formatCurrency(Math.abs(totalDebit - totalCredit))}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar Asiento"
          )}
        </Button>
      </div>
    </form>
  );
}
