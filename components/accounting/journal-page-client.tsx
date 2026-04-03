"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, FileText, Search } from "lucide-react";
import Link from "next/link";
import CreateJournalEntryForm from "./create-journal-entry-form";
import type { Account } from "@/generated/prisma/client";

const VOUCHER_LABELS: Record<string, { label: string; className: string }> = {
  INGRESO: { label: "Ingreso", className: "bg-green-100 text-green-800" },
  EGRESO: { label: "Egreso", className: "bg-red-100 text-red-800" },
  TRASPASO: { label: "Traspaso", className: "bg-blue-100 text-blue-800" },
  DIARIO: { label: "Diario", className: "bg-gray-100 text-gray-800" },
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

interface JournalLine {
  id: string;
  debit: string | number;
  credit: string | number;
  account: { code: string; name: string };
}

interface JournalEntry {
  id: string;
  number: number;
  date: string;
  description: string;
  voucherType: string;
  lines: JournalLine[];
}

interface JournalPageClientProps {
  orgSlug: string;
  entries: JournalEntry[];
  accounts: Account[];
}

export default function JournalPageClient({
  orgSlug,
  entries,
  accounts,
}: JournalPageClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [voucherType, setVoucherType] = useState("");

  function handleFilter() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (voucherType && voucherType !== "all") params.set("voucherType", voucherType);

    const query = params.toString();
    router.push(`/${orgSlug}/accounting/journal${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setVoucherType("");
    router.push(`/${orgSlug}/accounting/journal`);
  }

  if (showCreate) {
    return (
      <CreateJournalEntryForm
        orgSlug={orgSlug}
        accounts={accounts}
        onCancel={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
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
            <div className="space-y-1">
              <Label className="text-sm">Tipo</Label>
              <Select value={voucherType} onValueChange={setVoucherType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="INGRESO">Ingreso</SelectItem>
                  <SelectItem value="EGRESO">Egreso</SelectItem>
                  <SelectItem value="TRASPASO">Traspaso</SelectItem>
                  <SelectItem value="DIARIO">Diario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleFilter}>
              <Search className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
            <Button variant="ghost" onClick={clearFilters}>
              Limpiar
            </Button>
            <div className="flex-1" />
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Asiento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    #
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Descripcion
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Tipo
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Monto Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">
                        No hay asientos registrados
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Cree el primer asiento contable para comenzar
                      </p>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const voucher = VOUCHER_LABELS[entry.voucherType] ?? {
                      label: entry.voucherType,
                      className: "bg-gray-100 text-gray-800",
                    };
                    const totalDebit = entry.lines.reduce(
                      (sum, line) => sum + Number(line.debit),
                      0,
                    );

                    return (
                      <tr
                        key={entry.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono">
                          <Link
                            href={`/${orgSlug}/accounting/journal/${entry.id}`}
                            className="hover:underline text-blue-600"
                          >
                            {entry.number}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          {formatDate(entry.date)}
                        </td>
                        <td className="py-3 px-4">{entry.description}</td>
                        <td className="py-3 px-4">
                          <Badge className={voucher.className}>
                            {voucher.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(totalDebit)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
