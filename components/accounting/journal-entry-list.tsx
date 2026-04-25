"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  CheckCircle,
  XCircle,
  FileDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { FiscalPeriod, VoucherTypeCfg } from "@/generated/prisma/client";
import { formatCorrelativeNumber } from "@/features/accounting/correlative.utils";
import {
  sourceTypeLabel,
  sourceTypeBadgeClassName,
} from "@/features/accounting/journal.ui";
import { formatDateBO } from "@/lib/date-utils";

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Borrador",
    className: "bg-warning/10 text-warning dark:bg-warning/20",
  },
  POSTED: {
    label: "Contabilizado",
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  VOIDED: {
    label: "Anulado",
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
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

// ── Row sub-component with actions dropdown ─────────────────────────────────

interface JournalEntryRowProps {
  orgSlug: string;
  entry: JournalEntry;
  voucherName: string;
  voucherPrefix: string | undefined;
  periodName: string;
  periodStatus: string;
  isLoading: boolean;
  onPost: (entry: JournalEntry) => void;
  onVoid: (entry: JournalEntry) => void;
}

function JournalEntryRow({
  orgSlug,
  entry,
  voucherName,
  voucherPrefix,
  periodName,
  periodStatus,
  isLoading,
  onPost,
  onVoid,
}: JournalEntryRowProps) {
  const router = useRouter();

  const statusBadge = STATUS_BADGE[entry.status] ?? {
    label: entry.status,
    className: "bg-gray-100 text-gray-800",
  };

  const totalDebit = entry.lines.reduce(
    (sum, line) => sum + Number(line.debit),
    0,
  );

  const displayNumber = voucherPrefix
    ? formatCorrelativeNumber(voucherPrefix, entry.date, entry.number)
    : null;

  const viewPath = `/${orgSlug}/accounting/journal/${entry.id}`;
  const editPath = `/${orgSlug}/accounting/journal/${entry.id}/edit`;
  const pdfPath = `/api/organizations/${orgSlug}/journal/${entry.id}?format=pdf`;

  // Mirror JournalEntryDetail.canEdit logic
  const canEdit =
    (entry.status === "DRAFT" ||
      (entry.status === "POSTED" && !entry.sourceType)) &&
    periodStatus === "OPEN";

  return (
    <tr
      className="border-b hover:bg-gray-50 cursor-pointer"
      onClick={() => router.push(viewPath)}
    >
      <td className="py-3 px-4 font-mono text-blue-600 font-medium">
        {displayNumber ?? entry.number}
      </td>
      <td className="py-3 px-4 font-mono text-gray-500">
        {entry.referenceNumber ?? "—"}
      </td>
      <td className="py-3 px-4 whitespace-nowrap">{formatDateBO(entry.date)}</td>
      <td className="py-3 px-4">{voucherName}</td>
      <td className="py-3 px-4 text-gray-500">{periodName}</td>
      <td className="py-3 px-4 max-w-xs truncate">{entry.description}</td>
      <td className="py-3 px-4 text-gray-500">{entry.contact?.name ?? "—"}</td>
      <td className="py-3 px-4 text-center">
        <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
      </td>
      <td className="py-3 px-4">
        <Badge className={sourceTypeBadgeClassName(entry.sourceType ?? null)}>
          {sourceTypeLabel(entry.sourceType ?? null)}
        </Badge>
      </td>
      <td className="py-3 px-4 text-right font-mono">
        {formatCurrency(totalDebit)}
      </td>
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8"
                aria-label="Acciones"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(viewPath)}>
                <Eye className="h-4 w-4 mr-2" />
                Ver
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => router.push(editPath)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <a href={pdfPath} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-4 w-4 mr-2" />
                  Imprimir PDF
                </a>
              </DropdownMenuItem>
              {entry.status === "DRAFT" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onPost(entry)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Contabilizar
                  </DropdownMenuItem>
                </>
              )}
              {entry.status === "POSTED" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onVoid(entry)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Anular
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

export default function JournalEntryList({
  orgSlug,
  entries,
  periods,
  voucherTypes,
  filters,
}: JournalEntryListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [voidEntry, setVoidEntry] = useState<JournalEntry | null>(null);
  const [postEntry, setPostEntry] = useState<JournalEntry | null>(null);

  // Build lookup maps
  const periodMap = new Map(periods.map((p) => [p.id, p.name]));
  const periodStatusMap = new Map(periods.map((p) => [p.id, p.status]));
  const voucherTypeMap = new Map(voucherTypes.map((vt) => [vt.id, vt.name]));
  const voucherTypePrefixMap = new Map(voucherTypes.map((vt) => [vt.id, vt.prefix]));

  async function executeTransition(
    entry: JournalEntry,
    targetStatus: "POSTED" | "VOIDED",
  ) {
    setActioningId(entry.id);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/journal/${entry.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cambiar el estado");
      }
      toast.success(
        targetStatus === "POSTED"
          ? "Asiento contabilizado exitosamente"
          : "Asiento anulado exitosamente",
      );
      setPostEntry(null);
      setVoidEntry(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cambiar el estado",
      );
    } finally {
      setActioningId(null);
    }
  }

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
                  <th className="w-12 py-3 px-4 font-medium text-gray-600 text-center">
                    Acciones
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
                  entries.map((entry) => (
                    <JournalEntryRow
                      key={entry.id}
                      orgSlug={orgSlug}
                      entry={entry}
                      voucherName={voucherTypeMap.get(entry.voucherTypeId) ?? "—"}
                      voucherPrefix={voucherTypePrefixMap.get(entry.voucherTypeId)}
                      periodName={periodMap.get(entry.periodId) ?? "—"}
                      periodStatus={periodStatusMap.get(entry.periodId) ?? "OPEN"}
                      isLoading={actioningId === entry.id}
                      onPost={setPostEntry}
                      onVoid={setVoidEntry}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog — CONTABILIZAR */}
      <Dialog
        open={postEntry !== null}
        onOpenChange={(open) => !open && setPostEntry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contabilizar Asiento</DialogTitle>
            <DialogDescription>
              Esta acción contabilizará el asiento #{postEntry?.number} y
              actualizará los saldos contables.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actioningId !== null}
              onClick={() => setPostEntry(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={actioningId !== null}
              onClick={() => postEntry && executeTransition(postEntry, "POSTED")}
            >
              {actioningId !== null ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Contabilizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog — ANULAR */}
      <Dialog
        open={voidEntry !== null}
        onOpenChange={(open) => !open && setVoidEntry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Asiento</DialogTitle>
            <DialogDescription>
              Esta acción anulará el asiento #{voidEntry?.number} y revertirá
              los saldos contables. Esta operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actioningId !== null}
              onClick={() => setVoidEntry(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={actioningId !== null}
              onClick={() => voidEntry && executeTransition(voidEntry, "VOIDED")}
            >
              {actioningId !== null ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
