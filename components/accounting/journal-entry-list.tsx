"use client";

import { useEffect, useRef, useState } from "react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Sparkles,
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
import JournalEntryAiModal from "./journal-entry-ai-modal";
import PeriodFilter from "./period-filter";
import { toast } from "sonner";
import Link from "next/link";
import type { FiscalPeriod, VoucherTypeCfg } from "@/generated/prisma/client";
import { formatCorrelativeNumber } from "@/features/accounting/correlative.utils";
import {
  sourceTypeLabel,
  sourceTypeBadgeClassName,
} from "@/features/accounting/journal.ui";
import { formatDateBO } from "@/lib/date-utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { PaginatedResult } from "@/modules/shared/domain/value-objects/pagination";

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

/**
 * Builds the journal page URL preserving orgSlug + page + filter params
 * (periodId, voucherTypeId, status, origin). Mirror Purchase precedent
 * `buildHref` 5-param shape. Used by shadcn Pagination links.
 */
function buildHref(
  orgSlug: string,
  page: number,
  year: number | undefined,
  periodId: string | undefined,
  voucherTypeId: string | undefined,
  status: string | undefined,
): string {
  const sp = new URLSearchParams();
  if (page > 1) sp.set("page", String(page));
  if (year) sp.set("year", String(year));
  if (periodId) sp.set("periodId", periodId);
  if (voucherTypeId) sp.set("voucherTypeId", voucherTypeId);
  if (status) sp.set("status", status);
  const q = sp.toString();
  return `/${orgSlug}/accounting/journal${q ? `?${q}` : ""}`;
}

type JournalEntryListProps = PaginatedResult<JournalEntry> & {
  orgSlug: string;
  periods: FiscalPeriod[];
  /** Distinct fiscal years (4-digit) the org has periods for, sorted DESC. */
  availableYears: number[];
  /** Currently-selected fiscal year (driven by URL `?year=`, or defaulted server-side
   *  to the OPEN FiscalYear). All filters scope to this year. */
  selectedYear: number;
  voucherTypes: VoucherTypeCfg[];
  /** Active filter values (from URL search params) */
  filters: {
    periodId?: string;
    voucherTypeId?: string;
    status?: string;
  };
  /**
   * ID del entry recién creado por el modal de captura asistida. Lo pinta con
   * un anillo púrpura por 3 segundos y limpia el query param post-aplicación
   * (router.replace) para que un refresh del browser no re-dispare el
   * highlight. One-shot, resistente a recarga.
   */
  highlightId?: string;
  /** Indica si el rol del usuario puede crear asientos (controla visibilidad del botón IA). */
  canWrite?: boolean;
};

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
  isHighlighted,
  onPost,
  onVoid,
}: JournalEntryRowProps & { isHighlighted: boolean }) {
  const router = useRouter();
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  const statusBadge = STATUS_BADGE[entry.status] ?? {
    label: entry.status,
    className: "bg-muted text-muted-foreground",
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
      ref={rowRef}
      data-entry-id={entry.id}
      className={`border-b hover:bg-accent/50 cursor-pointer transition-colors ${
        isHighlighted
          ? "ring-2 ring-purple-500/50 bg-purple-500/5 dark:bg-purple-500/10"
          : ""
      }`}
      onClick={() => router.push(viewPath)}
    >
      <td className="py-3 px-4 text-muted-foreground">{periodName}</td>
      <td className="py-3 px-4 whitespace-nowrap">{formatDateBO(entry.date)}</td>
      <td className="py-3 px-4">{voucherName}</td>
      <td className="py-3 px-4 font-mono text-info font-medium">
        {displayNumber ?? entry.number}
      </td>
      <td className="py-3 px-4 font-mono text-muted-foreground">
        {entry.referenceNumber ?? "—"}
      </td>
      <td className="py-3 px-4 max-w-xs truncate">{entry.description}</td>
      <td className="py-3 px-4 text-muted-foreground">{entry.contact?.name ?? "—"}</td>
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
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
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
                    className="text-destructive focus:text-destructive"
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
  items,
  total,
  page,
  pageSize,
  totalPages,
  periods,
  availableYears,
  selectedYear,
  voucherTypes,
  filters,
  highlightId,
  canWrite = false,
}: JournalEntryListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [voidEntry, setVoidEntry] = useState<JournalEntry | null>(null);
  const [postEntry, setPostEntry] = useState<JournalEntry | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Highlight: muestra el anillo por 3 segundos y limpia el query param vía
  // router.replace para que un refresh manual no lo re-dispare. One-shot,
  // resistente a recarga (el query param desaparece del URL al recargar
  // queda automatically en estado "no highlight").
  const [activeHighlightId, setActiveHighlightId] = useState<string | undefined>(highlightId);
  useEffect(() => {
    if (!highlightId) return;
    setActiveHighlightId(highlightId);
    // Limpieza del query param: reemplazamos la URL sin el param para que el
    // back/forward y el refresh no traigan el highlight de vuelta.
    const params = new URLSearchParams(window.location.search);
    params.delete("highlightId");
    const query = params.toString();
    router.replace(`/${orgSlug}/accounting/journal${query ? `?${query}` : ""}`, {
      scroll: false,
    });
    const t = setTimeout(() => setActiveHighlightId(undefined), 3000);
    return () => clearTimeout(t);
  }, [highlightId, orgSlug, router]);

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
    params.set("year", String(selectedYear));
    if (filters.periodId) params.set("periodId", filters.periodId);
    if (filters.voucherTypeId) params.set("voucherTypeId", filters.voucherTypeId);
    if (filters.status) params.set("status", filters.status);

    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    const query = params.toString();
    router.push(`/${orgSlug}/accounting/journal${query ? `?${query}` : ""}`);
  }

  // Año changes invalidate periodId (periods belong to a single year). Mantener
  // el resto de filtros (voucherType/status) — son ortogonales al año.
  function changeYear(year: number) {
    const params = new URLSearchParams();
    params.set("year", String(year));
    if (filters.voucherTypeId) params.set("voucherTypeId", filters.voucherTypeId);
    if (filters.status) params.set("status", filters.status);
    router.push(`/${orgSlug}/accounting/journal?${params.toString()}`);
  }

  function changePeriod(periodId: string | null) {
    applyFilter("periodId", periodId ?? "all");
  }

  function clearFilters() {
    // Limpieza preserva la gestión activa — "limpiar filtros" no debería
    // mandar al usuario a otra gestión.
    router.push(`/${orgSlug}/accounting/journal?year=${selectedYear}`);
  }

  const hasFilters = !!(filters.periodId || filters.voucherTypeId || filters.status);

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <PeriodFilter
              periods={periods}
              availableYears={availableYears}
              selectedYear={selectedYear}
              selectedPeriodId={filters.periodId ?? null}
              onYearChange={changeYear}
              onPeriodChange={changePeriod}
            />

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

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Search className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
            )}

            <div className="flex-1" />

            {canWrite && (
              <Button
                variant="outline"
                onClick={() => setAiModalOpen(true)}
                className="border-purple-500/50 text-purple-600 hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-400"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Crear Asiento con IA
              </Button>
            )}

            <Link href={`/${orgSlug}/accounting/journal/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Asiento
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <JournalEntryAiModal
        orgSlug={orgSlug}
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
      />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Período
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Tipo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Comprobante</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ref.</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Descripción
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Contacto
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Origen
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="w-12 py-3 px-4 font-medium text-muted-foreground text-center">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                      <p className="text-muted-foreground">No hay asientos registrados</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        {hasFilters
                          ? "Ningún asiento coincide con los filtros aplicados"
                          : "Cree el primer asiento contable para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((entry) => (
                    <JournalEntryRow
                      key={entry.id}
                      orgSlug={orgSlug}
                      entry={entry}
                      voucherName={voucherTypeMap.get(entry.voucherTypeId) ?? "—"}
                      voucherPrefix={voucherTypePrefixMap.get(entry.voucherTypeId)}
                      periodName={periodMap.get(entry.periodId) ?? "—"}
                      periodStatus={periodStatusMap.get(entry.periodId) ?? "OPEN"}
                      isLoading={actioningId === entry.id}
                      isHighlighted={activeHighlightId === entry.id}
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

      {/* Paginación */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={buildHref(
                  orgSlug,
                  Math.max(1, page - 1),
                  selectedYear,
                  filters.periodId,
                  filters.voucherTypeId,
                  filters.status,
                )}
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                text="Anterior"
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href={buildHref(
                    orgSlug,
                    p,
                    selectedYear,
                    filters.periodId,
                    filters.voucherTypeId,
                    filters.status,
                  )}
                  isActive={p === page}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={buildHref(
                  orgSlug,
                  Math.min(totalPages, page + 1),
                  selectedYear,
                  filters.periodId,
                  filters.voucherTypeId,
                  filters.status,
                )}
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages ? "pointer-events-none opacity-50" : undefined
                }
                text="Siguiente"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {total > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total}
        </p>
      )}

      <ConfirmDialog
        open={postEntry !== null}
        onOpenChange={(open) => !open && setPostEntry(null)}
        title="Contabilizar asiento"
        description={
          postEntry
            ? `Esta acción contabilizará el asiento #${postEntry.number} y actualizará los saldos contables.`
            : null
        }
        confirmLabel="Contabilizar"
        variant="default"
        loading={actioningId !== null}
        onConfirm={async () => {
          if (postEntry) await executeTransition(postEntry, "POSTED");
        }}
      />

      <ConfirmDialog
        open={voidEntry !== null}
        onOpenChange={(open) => !open && setVoidEntry(null)}
        title="Anular asiento"
        description={
          voidEntry
            ? `Esta acción anulará el asiento #${voidEntry.number} y revertirá los saldos contables. Esta operación no se puede deshacer.`
            : null
        }
        confirmLabel="Anular"
        variant="destructive"
        loading={actioningId !== null}
        onConfirm={async () => {
          if (voidEntry) await executeTransition(voidEntry, "VOIDED");
        }}
      />
    </>
  );
}
