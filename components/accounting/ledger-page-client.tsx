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
import { Search, Calculator, Loader2 } from "lucide-react";
import type { Account } from "@/generated/prisma/client";

// Shadow interface mirrors the LedgerEntry DTO from
// @/modules/accounting/presentation/dto/ledger.types. Monetary fields wire as
// string (Decimal precision preserved server-side, parsed at display).
interface LedgerEntry {
  date: string;
  entryNumber: number;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

function formatCurrency(amount: string): string {
  return `Bs. ${parseFloat(amount).toLocaleString("es-BO", {
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

interface LedgerPageClientProps {
  orgSlug: string;
  accounts: Account[];
}

export default function LedgerPageClient({
  orgSlug,
  accounts,
}: LedgerPageClientProps) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  async function fetchLedger() {
    if (!selectedAccountId) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.set("accountId", selectedAccountId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(
        `/api/organizations/${orgSlug}/ledger?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Error al cargar el libro mayor");

      const data = await res.json();
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 min-w-[240px]">
              <Label className="text-sm">Cuenta</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.isActive)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              onClick={fetchLedger}
              disabled={!selectedAccountId || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {selectedAccount && hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedAccount.code} - {selectedAccount.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Fecha
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      # Asiento
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Descripcion
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Debe
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Haber
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Calculator className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          No hay movimientos para esta cuenta
                        </p>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-3 px-4">
                          {formatDate(entry.date)}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {entry.entryNumber}
                        </td>
                        <td className="py-3 px-4">{entry.description}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {parseFloat(entry.debit) > 0
                            ? formatCurrency(entry.debit)
                            : ""}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {parseFloat(entry.credit) > 0
                            ? formatCurrency(entry.credit)
                            : ""}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-medium ${
                            parseFloat(entry.balance) >= 0
                              ? "text-info"
                              : "text-destructive"
                          }`}
                        >
                          {formatCurrency(entry.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calculator className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Seleccione una cuenta y presione Consultar para ver los
                movimientos
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
