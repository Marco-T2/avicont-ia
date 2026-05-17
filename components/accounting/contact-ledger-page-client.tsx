"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import ContactSelector from "@/components/contacts/contact-selector";
import {
  Search,
  Calculator,
  Printer,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { Contact } from "@/modules/contacts/presentation/index";
import type { ContactType } from "@/generated/prisma/client";
import { formatDateBO } from "@/lib/date-utils";

// Shadow wire shapes — mirror sister precedent (`ledger-page-client.tsx`)
// where the canonical DTO `date: Date` is downgraded to `string` at the
// JSON boundary (RSC `JSON.parse(JSON.stringify(...))`). Decimal columns
// already serialize as `string` server-side. Consumers parse via
// `parseFloat()` at display time, preserving wire precision (DEC-1).
interface ContactLedgerEntry {
  entryId: string;
  date: string;
  entryNumber: number;
  voucherCode: string;
  displayNumber: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  status: string | null;
  dueDate: string | null;
  voucherTypeHuman: string;
  sourceType: string | null;
  paymentMethod: string | null;
  bankAccountName: string | null;
  withoutAuxiliary: boolean;
}

interface ContactLedgerPaginatedDto {
  items: ContactLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  openingBalance: string;
}

// es-BO negative parens formatter — REQ "Cross-Cutting Constraints"
// + "Saldo negativo es-BO". Positive amounts render via the sister
// `formatCurrency` shape (`Bs. 1.234,56`); negatives strip the minus and
// wrap the absolute value in parens (`(150,50)`) for accountant-friendly
// reading. Used for the Saldo column where negative balances appear.
function formatCurrency(amount: string): string {
  const n = parseFloat(amount);
  if (n < 0) {
    return `(${Math.abs(n).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })})`;
  }
  return `Bs. ${n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Same local-timezone helpers as sister ledger-page-client — avoid UTC
// drift around midnight boundaries (input[type=date] interprets value as
// local).
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateTo(): string {
  return localISO(new Date());
}

function defaultDateFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return localISO(d);
}

// Tipo column human-readable copy. Spec REQ "Type Column":
//   SALE → voucherTypeHuman (e.g. "Nota de Despacho", "Factura") fallback
//   "Venta"
//   PURCHASE → voucherTypeHuman fallback "Compra"
//   RECEIPT → "Cobranza (<paymentMethod>)"  -- append forma de pago
//   PAYMENT → "Pago (<paymentMethod>)"      -- append forma de pago
//   MANUAL (sourceType=null) → "Ajuste"
function humanPaymentMethod(
  pm: string | null,
  bank: string | null,
): string {
  switch (pm) {
    case "EFECTIVO":
      return "efectivo";
    case "TRANSFERENCIA":
      return bank ? `transferencia ${bank}` : "transferencia";
    case "CHEQUE":
      return "cheque";
    case "DEPOSITO":
      return bank ? `depósito ${bank}` : "depósito";
    default:
      return pm ?? "";
  }
}

function renderTipo(entry: ContactLedgerEntry): string {
  const src = entry.sourceType?.toLowerCase() ?? null;
  if (src === "receipt") {
    const pm = humanPaymentMethod(entry.paymentMethod, entry.bankAccountName);
    return pm ? `Cobranza (${pm})` : "Cobranza";
  }
  if (src === "payment") {
    const pm = humanPaymentMethod(entry.paymentMethod, entry.bankAccountName);
    return pm ? `Pago (${pm})` : "Pago";
  }
  if (src === "sale") {
    return entry.voucherTypeHuman || "Venta";
  }
  if (src === "purchase") {
    return entry.voucherTypeHuman || "Compra";
  }
  // null sourceType — manual / withoutAuxiliary fallback.
  return "Ajuste";
}

// Status display. Spec REQ "Status Column":
//   - PAID → "Pagado"
//   - PARTIAL → "Parcial"
//   - PENDING → "Pendiente" (unless dueDate < hoy → "ATRASADO" runtime)
//   - VOIDED / CANCELLED → "Anulado"
//   - withoutAuxiliary=true → "Sin auxiliar" with warning icon
//   - null → "—"
type EstadoDisplay = {
  label: string;
  variant: "default" | "warning" | "destructive" | "muted";
};

function renderEstado(entry: ContactLedgerEntry): EstadoDisplay {
  if (entry.withoutAuxiliary) {
    return { label: "Sin auxiliar", variant: "warning" };
  }

  const status = entry.status;
  if (status === null || status === undefined) {
    return { label: "—", variant: "muted" };
  }

  // ATRASADO derivado runtime: PENDING / PARTIAL with past due date.
  if (
    (status === "PENDING" || status === "PARTIAL") &&
    entry.dueDate &&
    new Date(entry.dueDate) < new Date()
  ) {
    return { label: "ATRASADO", variant: "destructive" };
  }

  switch (status) {
    case "PAID":
      return { label: "Pagado", variant: "default" };
    case "PARTIAL":
      return { label: "Parcial", variant: "default" };
    case "PENDING":
      return { label: "Pendiente", variant: "default" };
    case "VOIDED":
    case "CANCELLED":
      return { label: "Anulado", variant: "muted" };
    default:
      return { label: status, variant: "default" };
  }
}

/**
 * URL builder for the contact-ledger detail page — sister parity with
 * ledger-page-client.buildHref shape adapted to `contactId` instead of
 * `accountId`. RSC pages live at `/{orgSlug}/accounting/(cxc|cxp)/[contactId]`
 * so the query string preserves the date filters + pagination only (contactId
 * is a path segment).
 */
function buildHref(
  orgSlug: string,
  ledgerBase: "cxc" | "cxp",
  contactId: string,
  page: number,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): string {
  const sp = new URLSearchParams();
  if (page > 1) sp.set("page", String(page));
  if (dateFrom) sp.set("dateFrom", dateFrom);
  if (dateTo) sp.set("dateTo", dateTo);
  const q = sp.toString();
  return `/${orgSlug}/accounting/${ledgerBase}/${contactId}${q ? `?${q}` : ""}`;
}

interface ContactLedgerPageClientProps {
  orgSlug: string;
  contacts: Contact[];
  ledger: ContactLedgerPaginatedDto | null;
  filters: {
    contactId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  typeFilter: ContactType;
}

export default function ContactLedgerPageClient({
  orgSlug,
  contacts,
  ledger,
  filters,
  typeFilter,
}: ContactLedgerPageClientProps) {
  const router = useRouter();
  const ledgerBase: "cxc" | "cxp" =
    typeFilter === "CLIENTE" ? "cxc" : "cxp";

  // LOCAL state ONLY for filter UI (before submit) — sister precedent
  // R3 LOCKED: navigation only on submit.
  const [draftContactId, setDraftContactId] = useState<string | null>(
    filters.contactId ?? null,
  );
  const [draftDateFrom, setDraftDateFrom] = useState(
    filters.dateFrom ?? defaultDateFrom(),
  );
  const [draftDateTo, setDraftDateTo] = useState(
    filters.dateTo ?? defaultDateTo(),
  );

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === filters.contactId) ?? null,
    [contacts, filters.contactId],
  );

  function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    if (!draftContactId) return;
    router.push(
      buildHref(orgSlug, ledgerBase, draftContactId, 1, draftDateFrom, draftDateTo),
    );
  }

  function handleReset() {
    setDraftContactId(null);
    setDraftDateFrom(defaultDateFrom());
    setDraftDateTo(defaultDateTo());
    router.push(`/${orgSlug}/accounting/${ledgerBase}`);
  }

  // ── Export handlers ──
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  const canExport = Boolean(
    filters.contactId && filters.dateFrom && filters.dateTo,
  );

  function buildExportUrl(format: "pdf" | "xlsx"): string | null {
    if (!canExport) return null;
    const params = new URLSearchParams({
      contactId: filters.contactId!,
      dateFrom: filters.dateFrom!,
      dateTo: filters.dateTo!,
      format,
    });
    return `/api/organizations/${orgSlug}/contact-ledger?${params.toString()}`;
  }

  function handleOpenPdf() {
    const url = buildExportUrl("pdf");
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDownloadXlsx() {
    const url = buildExportUrl("xlsx");
    if (!url) return;
    setLoadingXlsx(true);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(
          "Error al exportar Libro Mayor por contacto (xlsx):",
          res.status,
        );
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const contactSlug = selectedContact
        ? selectedContact.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
        : "contacto";
      a.download = `libro-mayor-${contactSlug}-${filters.dateFrom}_${filters.dateTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar Libro Mayor por contacto:", err);
    } finally {
      setLoadingXlsx(false);
    }
  }

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent>
          <form
            onSubmit={handleConsultar}
            className="flex flex-wrap items-end gap-4"
          >
            <div className="space-y-1 min-w-[280px] flex-1">
              <Label htmlFor="contact-ledger-contact" className="text-sm">
                Contacto
              </Label>
              <ContactSelector
                orgSlug={orgSlug}
                typeFilter={typeFilter}
                value={draftContactId}
                onChange={setDraftContactId}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-ledger-date-from" className="text-sm">
                Desde
              </Label>
              <Input
                id="contact-ledger-date-from"
                type="date"
                value={draftDateFrom}
                onChange={(e) => setDraftDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-ledger-date-to" className="text-sm">
                Hasta
              </Label>
              <Input
                id="contact-ledger-date-to"
                type="date"
                value={draftDateTo}
                onChange={(e) => setDraftDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button type="submit" disabled={!draftContactId}>
              <Search className="h-4 w-4 mr-2" />
              Consultar
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Limpiar
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenPdf}
                disabled={!canExport}
                aria-label="Abrir PDF en pestaña nueva"
              >
                <Printer className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadXlsx}
                disabled={!canExport || loadingXlsx}
                aria-label="Descargar como Excel"
              >
                {loadingXlsx ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Excel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Empty state when no contact selected */}
      {ledger === null && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calculator className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Seleccione un contacto y presione Consultar para ver los
                movimientos
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {ledger !== null && (
        <Card>
          <CardContent className="p-0">
            <div className="px-6 pt-2 pb-4 text-center">
              <h2 className="text-xl font-bold tracking-wide">
                LIBRO MAYOR POR CONTACTO
                {selectedContact ? ` — ${selectedContact.name}` : ""}
              </h2>
              {filters.dateFrom && filters.dateTo && (
                <p className="text-sm text-muted-foreground mt-1">
                  Del {formatDateBO(filters.dateFrom)} al{" "}
                  {formatDateBO(filters.dateTo)}
                </p>
              )}
              <p className="text-xs italic text-muted-foreground">
                (Expresado en Bolivianos)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Fecha
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Nº
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Descripción
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
                  {/* Decorative opening row — sister precedent (SC-5''):
                      rendered as first <tr> of <tbody> when openingBalance
                      !== "0.00", aria-label "Saldo inicial acumulado". */}
                  {ledger.openingBalance !== "0.00" && (
                    <tr
                      className="bg-muted/30 font-medium border-b-2"
                      aria-label="Saldo inicial acumulado"
                    >
                      <td className="py-3 px-4 text-muted-foreground">—</td>
                      <td className="py-3 px-4 text-muted-foreground">—</td>
                      <td className="py-3 px-4 text-muted-foreground">—</td>
                      <td className="py-3 px-4 text-muted-foreground">—</td>
                      <td className="py-3 px-4 italic text-muted-foreground">
                        Saldo inicial acumulado
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(ledger.openingBalance)}
                      </td>
                    </tr>
                  )}
                  {ledger.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <Calculator className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          No hay movimientos para este contacto
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ledger.items.map((entry) => {
                      const estado = renderEstado(entry);
                      const tipo = renderTipo(entry);
                      const balanceNum = parseFloat(entry.balance);
                      return (
                        <tr
                          key={entry.entryId}
                          className="border-b hover:bg-accent/50 transition-colors"
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            {formatDateBO(entry.date)}
                          </td>
                          <td className="py-3 px-4">{tipo}</td>
                          <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                            {entry.displayNumber}
                          </td>
                          <td className="py-3 px-4">
                            {estado.variant === "warning" ? (
                              <span
                                className="inline-flex items-center gap-1 text-warning"
                                aria-label="Sin auxiliar"
                              >
                                <AlertTriangle
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {estado.label}
                              </span>
                            ) : estado.variant === "destructive" ? (
                              <span className="font-semibold text-destructive">
                                {estado.label}
                              </span>
                            ) : estado.variant === "muted" ? (
                              <span className="text-muted-foreground">
                                {estado.label}
                              </span>
                            ) : (
                              <span>{estado.label}</span>
                            )}
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
                              balanceNum >= 0 ? "text-info" : "text-destructive"
                            }`}
                          >
                            {formatCurrency(entry.balance)}
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
      )}

      {/* Pagination — sister shape, contactId is path segment so buildHref
          only varies page + date filters. */}
      {ledger !== null && filters.contactId && ledger.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={buildHref(
                  orgSlug,
                  ledgerBase,
                  filters.contactId,
                  Math.max(1, ledger.page - 1),
                  filters.dateFrom,
                  filters.dateTo,
                )}
                aria-disabled={ledger.page <= 1}
                className={
                  ledger.page <= 1
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                text="Anterior"
              />
            </PaginationItem>
            {Array.from({ length: ledger.totalPages }, (_, i) => i + 1).map(
              (p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href={buildHref(
                      orgSlug,
                      ledgerBase,
                      filters.contactId!,
                      p,
                      filters.dateFrom,
                      filters.dateTo,
                    )}
                    isActive={p === ledger.page}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={buildHref(
                  orgSlug,
                  ledgerBase,
                  filters.contactId,
                  Math.min(ledger.totalPages, ledger.page + 1),
                  filters.dateFrom,
                  filters.dateTo,
                )}
                aria-disabled={ledger.page >= ledger.totalPages}
                className={
                  ledger.page >= ledger.totalPages
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                text="Siguiente"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {ledger !== null && ledger.total > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Mostrando {(ledger.page - 1) * ledger.pageSize + 1}-
          {Math.min(ledger.page * ledger.pageSize, ledger.total)} de{" "}
          {ledger.total}
        </p>
      )}
    </>
  );
}
