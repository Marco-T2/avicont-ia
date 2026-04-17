"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { FiscalPeriod, VoucherTypeCfg } from "@/generated/prisma/client";
import { formatCorrelativeNumber } from "@/features/accounting/correlative.utils";
import {
  sourceTypeLabel,
  sourceTypeBadgeClassName,
} from "@/features/accounting/journal.ui";

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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
};

interface JournalLine {
  debit: string | number;
  credit: string | number;
  account: { code: string; name: string };
}

interface JournalEntry {
  id: string;
  number: number;
  referenceNumber?: number | null;
  date: string;
  description: string;
  status: string;
  periodId: string;
  voucherTypeId: string;
  sourceType?: string | null;
  contact?: { name: string } | null;
  lines: JournalLine[];
}

interface JournalEntryListProps {
  orgSlug: string;
  entries: JournalEntry[];
  periods: FiscalPeriod[];
  voucherTypes: VoucherTypeCfg[];
  /** Active filter values (from URL search params) */
  filters: {
    periodId?: string;
    voucherTypeId?: string;
    status?: string;
    origin?: "manual" | "auto";
  };
}

export default function JournalEntryList({
  orgSlug,
  entries,
  periods,
  voucherTypes,
  filters,
}: JournalEntryListProps) {
  const router = useRouter();

  // Build lookup maps
  const periodMap = new Map(periods.map((p) => [p.id, p.name]));
  const voucherTypeMap = new Map(voucherTypes.map((vt) => [vt.id, vt.name]));
  const voucherTypeCodeMap = new Map(voucherTypes.map((vt) => [vt.id, vt.code]));

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (filters.periodId) params.set("periodId", filters.periodId);
    if (filters.voucherTypeId) params.set("voucherTypeId", filters.voucherTypeId);
    if (filters.status) params.set("status", filters.status);
    if (filters.origin) params.set("origin", filters.origin);

    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    const query = params.toString();
    router.push(`/${orgSlug}/accounting/journal${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    router.push(`/${orgSlug}/accounting/journal`);
  }

  const hasFilters = !!(filters.periodId || filters.voucherTypeId || filters.status || filters.origin);

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Período</Label>
              <Select
                value={filters.periodId ?? "all"}
                onValueChange={(v) => applyFilter("periodId", v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos los períodos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los períodos</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Tipo de Comprobante</Label>
              <Select
                value={filters.voucherTypeId ?? "all"}
                onValueChange={(v) => applyFilter("voucherTypeId", v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {voucherTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Estado</Label>
              <Select
                value={filters.status ?? "all"}
                onValueChange={(v) => applyFilter("status", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="POSTED">Contabilizado</SelectItem>
                  <SelectItem value="VOIDED">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Origen</Label>
              <Select
                value={filters.origin ?? "all"}
                onValueChange={(v) => applyFilter("origin", v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="auto">Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Search className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
            )}

            <div className="flex-1" />

            <Link href={`/${orgSlug}/accounting/journal/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Asiento
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Comprobante</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Ref.</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Tipo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Período
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Descripción
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Contacto
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Origen
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No hay asientos registrados</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {hasFilters
                          ? "Ningún asiento coincide con los filtros aplicados"
                          : "Cree el primer asiento contable para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const statusBadge = STATUS_BADGE[entry.status] ?? {
                      label: entry.status,
                      className: "bg-gray-100 text-gray-800",
                    };
                    const totalDebit = entry.lines.reduce(
                      (sum, line) => sum + Number(line.debit),
                      0,
                    );
                    const voucherName = voucherTypeMap.get(entry.voucherTypeId) ?? "—";
                    const periodName = periodMap.get(entry.periodId) ?? "—";

                    return (
                      <tr
                        key={entry.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() =>
                          router.push(`/${orgSlug}/accounting/journal/${entry.id}`)
                        }
                      >
                        <td className="py-3 px-4 font-mono text-blue-600 font-medium">
                          {(() => {
                            const code = voucherTypeCodeMap.get(entry.voucherTypeId);
                            const display = code
                              ? formatCorrelativeNumber(code, entry.date, entry.number)
                              : null;
                            return display ?? entry.number;
                          })()}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500">
                          {entry.referenceNumber ?? "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="py-3 px-4">{voucherName}</td>
                        <td className="py-3 px-4 text-gray-500">{periodName}</td>
                        <td className="py-3 px-4 max-w-xs truncate">
                          {entry.description}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {entry.contact?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={sourceTypeBadgeClassName(entry.sourceType ?? null)}
                          >
                            {sourceTypeLabel(entry.sourceType ?? null)}
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
