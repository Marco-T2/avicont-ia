"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import AccountSelector from "@/components/accounting/account-selector";
import { Search, Calculator } from "lucide-react";
import type { Account } from "@/generated/prisma/client";
import { formatDateBO } from "@/lib/date-utils";

// Shadow interface mirrors LedgerEntry + LedgerPaginatedDto from
// @/modules/accounting/presentation/dto/ledger.types. Monetary fields wire
// as string (Decimal precision preserved server-side, parsed at display).
interface LedgerEntry {
  date: string;
  entryNumber: number;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

interface LedgerPaginatedDto {
  items: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  openingBalance: string;
}

function formatCurrency(amount: string): string {
  return `Bs. ${parseFloat(amount).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Local-timezone ISO date (YYYY-MM-DD). Avoids toISOString UTC drift around
// midnight boundaries — input[type=date] interprets the value as local.
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

/**
 * Builds the ledger page URL preserving orgSlug + page + filter params
 * (accountId, dateFrom, dateTo, periodId). 6-param shape mirror journal-
 * entry-list.tsx L104-120 (sister-2 precedent — closer paridad for ledger's
 * 5-param filter shape than sale-list.tsx sister-1). Used by shadcn
 * Pagination links + Consultar/Limpiar submit handlers.
 */
function buildHref(
  orgSlug: string,
  page: number,
  accountId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  periodId: string | undefined,
): string {
  const sp = new URLSearchParams();
  if (page > 1) sp.set("page", String(page));
  if (accountId) sp.set("accountId", accountId);
  if (dateFrom) sp.set("dateFrom", dateFrom);
  if (dateTo) sp.set("dateTo", dateTo);
  if (periodId) sp.set("periodId", periodId);
  const q = sp.toString();
  return `/${orgSlug}/accounting/ledger${q ? `?${q}` : ""}`;
}

interface LedgerPageClientProps {
  orgSlug: string;
  accounts: Account[];
  ledger: LedgerPaginatedDto | null;
  filters: {
    accountId?: string;
    dateFrom?: string;
    dateTo?: string;
    periodId?: string;
  };
}

export default function LedgerPageClient({
  orgSlug,
  accounts,
  ledger,
  filters,
}: LedgerPageClientProps) {
  const router = useRouter();
  // LOCAL state ONLY for filter UI (before submit). AccountSelector onChange
  // writes draftAccountId; "Consultar" submit → router.push(buildHref(...))
  // — R3 LOCKED: navigation only on submit per REQ-8/SC-8.
  const [draftAccountId, setDraftAccountId] = useState(
    filters.accountId ?? "",
  );
  const [draftDateFrom, setDraftDateFrom] = useState(
    filters.dateFrom ?? defaultDateFrom(),
  );
  const [draftDateTo, setDraftDateTo] = useState(
    filters.dateTo ?? defaultDateTo(),
  );

  // Only postable (detail) active accounts — mirror of journal-line-row.tsx
  const postableAccounts = useMemo(
    () => accounts.filter((a) => a.isActive && a.isDetail),
    [accounts],
  );

  const selectedAccount = accounts.find((a) => a.id === filters.accountId);

  function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    if (!draftAccountId) return;
    // Filter submit resets to page=1 (SC-9).
    router.push(
      buildHref(
        orgSlug,
        1,
        draftAccountId,
        draftDateFrom,
        draftDateTo,
        filters.periodId,
      ),
    );
  }

  function handleReset() {
    setDraftAccountId("");
    setDraftDateFrom(defaultDateFrom());
    setDraftDateTo(defaultDateTo());
    router.push(`/${orgSlug}/accounting/ledger`);
  }

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={handleConsultar}
            className="flex flex-wrap items-end gap-4"
          >
            <div className="space-y-1 min-w-[280px] flex-1">
              <Label htmlFor="ledger-account" className="text-sm">
                Cuenta
              </Label>
              <AccountSelector
                id="ledger-account"
                ariaLabel="Cuenta"
                accounts={postableAccounts}
                value={draftAccountId}
                onChange={setDraftAccountId}
                valueKey="id"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ledger-date-from" className="text-sm">
                Desde
              </Label>
              <Input
                id="ledger-date-from"
                type="date"
                value={draftDateFrom}
                onChange={(e) => setDraftDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ledger-date-to" className="text-sm">
                Hasta
              </Label>
              <Input
                id="ledger-date-to"
                type="date"
                value={draftDateTo}
                onChange={(e) => setDraftDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button type="submit" disabled={!draftAccountId}>
              <Search className="h-4 w-4 mr-2" />
              Consultar
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Limpiar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Empty state when no account selected */}
      {ledger === null && (
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

      {/* Results */}
      {ledger !== null && selectedAccount && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>
                {selectedAccount.code} - {selectedAccount.name}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {ledger.total}{" "}
                {ledger.total === 1 ? "movimiento" : "movimientos"}
              </span>
            </div>
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
                  {/* Decorative opening row (SC-5'' supersedes SC-5' which
                      superseded original SC-5 per [[named_rule_immutability]]).
                      Renders as first <tr> of <tbody> when openingBalance
                      !== "0.00" — page-independent (SC-5' Bug #3 a51877dc).
                      Text "Saldo inicial acumulado" (SC-5'' text change from
                      "Saldo de Apertura" — more accurate semantics: cumulative
                      carry-over from history before the filter window).
                      Decorative: NOT counted in `total` / pagination; renders
                      alongside empty-state placeholder when items=[] AND
                      opening !== "0.00" (Marco Case C — all history is prior
                      to filter range). */}
                  {ledger.openingBalance !== "0.00" && (
                    <tr
                      className="bg-muted/30 font-medium border-b-2"
                      aria-label="Saldo inicial acumulado"
                    >
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
                      <td colSpan={6} className="py-12 text-center">
                        <Calculator className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          No hay movimientos para esta cuenta
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ledger.items.map((entry, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-3 px-4">{formatDateBO(entry.date)}</td>
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

      {/* Pagination — shadcn block verbatim from sale-list.tsx L383-421
          (sister-1 precedent); buildHref 6-param adapted for ledger filter
          shape (SC-13). */}
      {ledger !== null && ledger.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={buildHref(
                  orgSlug,
                  Math.max(1, ledger.page - 1),
                  filters.accountId,
                  filters.dateFrom,
                  filters.dateTo,
                  filters.periodId,
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
            {Array.from(
              { length: ledger.totalPages },
              (_, i) => i + 1,
            ).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href={buildHref(
                    orgSlug,
                    p,
                    filters.accountId,
                    filters.dateFrom,
                    filters.dateTo,
                    filters.periodId,
                  )}
                  isActive={p === ledger.page}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={buildHref(
                  orgSlug,
                  Math.min(ledger.totalPages, ledger.page + 1),
                  filters.accountId,
                  filters.dateFrom,
                  filters.dateTo,
                  filters.periodId,
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
