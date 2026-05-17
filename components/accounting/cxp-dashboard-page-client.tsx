"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Eye, Users, ArrowDown, ArrowUp } from "lucide-react";
import { formatDateBO } from "@/lib/date-utils";

// Sister of cxc-dashboard-page-client.tsx — only difference es `BASE = "cxp"`
// para el Ver link target (PROVEEDOR detail page).

interface ContactDashboardRow {
  contactId: string;
  name: string;
  lastMovementDate: string | null;
  openBalance: string;
}

interface ContactDashboardPaginatedDto {
  items: ContactDashboardRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface DashboardFilters {
  includeZeroBalance?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "openBalance" | "name" | "lastMovementDate";
  direction?: "asc" | "desc";
}

interface CxpDashboardPageClientProps {
  orgSlug: string;
  dashboard: ContactDashboardPaginatedDto;
  filters: DashboardFilters;
}

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

function buildDashboardHref(
  orgSlug: string,
  base: "cxc" | "cxp",
  patch: DashboardFilters,
  current: DashboardFilters,
): string {
  const sp = new URLSearchParams();
  const merged = { ...current, ...patch };
  if (merged.includeZeroBalance) sp.set("includeZeroBalance", "true");
  if (merged.sort) sp.set("sort", merged.sort);
  if (merged.direction) sp.set("direction", merged.direction);
  if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
  if (merged.pageSize && merged.pageSize !== 20)
    sp.set("pageSize", String(merged.pageSize));
  const q = sp.toString();
  return `/${orgSlug}/accounting/${base}${q ? `?${q}` : ""}`;
}

const BASE: "cxp" = "cxp";

export default function CxpDashboardPageClient({
  orgSlug,
  dashboard,
  filters,
}: CxpDashboardPageClientProps) {
  const router = useRouter();
  const includeZero = filters.includeZeroBalance ?? false;
  const sort = filters.sort ?? "openBalance";
  const direction = filters.direction ?? "desc";

  function handleToggleZero(e: React.ChangeEvent<HTMLInputElement>) {
    const newIncludeZero = !e.target.checked;
    router.push(
      buildDashboardHref(
        orgSlug,
        BASE,
        { includeZeroBalance: newIncludeZero, page: 1 },
        filters,
      ),
    );
  }

  function handleSortClick(
    nextSort: "openBalance" | "name" | "lastMovementDate",
  ) {
    const newDirection =
      sort === nextSort ? (direction === "desc" ? "asc" : "desc") : "desc";
    router.push(
      buildDashboardHref(
        orgSlug,
        BASE,
        { sort: nextSort, direction: newDirection, page: 1 },
        filters,
      ),
    );
  }

  function sortIcon(col: "openBalance" | "name" | "lastMovementDate") {
    if (sort !== col) return null;
    return direction === "desc" ? (
      <ArrowDown className="inline h-3 w-3 ml-1" />
    ) : (
      <ArrowUp className="inline h-3 w-3 ml-1" />
    );
  }

  return (
    <>
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!includeZero}
              onChange={handleToggleZero}
              className="h-4 w-4 rounded border-input"
              aria-label="Solo con saldo abierto"
            />
            Solo con saldo
          </label>
          {dashboard.total > 0 && (
            <span className="text-sm text-muted-foreground ml-auto">
              {dashboard.total} contacto{dashboard.total === 1 ? "" : "s"}
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th
                    role="columnheader"
                    aria-label="Nombre"
                    className="text-left py-3 px-4 font-medium text-muted-foreground"
                    data-sort-active={sort === "name" ? "true" : "false"}
                    data-sort-direction={sort === "name" ? direction : ""}
                  >
                    <button
                      type="button"
                      className="hover:underline focus:underline"
                      onClick={() => handleSortClick("name")}
                    >
                      Nombre
                      {sortIcon("name")}
                    </button>
                  </th>
                  <th
                    role="columnheader"
                    aria-label="Fecha último movimiento"
                    className="text-left py-3 px-4 font-medium text-muted-foreground"
                    data-sort-active={
                      sort === "lastMovementDate" ? "true" : "false"
                    }
                    data-sort-direction={
                      sort === "lastMovementDate" ? direction : ""
                    }
                  >
                    <button
                      type="button"
                      className="hover:underline focus:underline"
                      onClick={() => handleSortClick("lastMovementDate")}
                    >
                      Fecha último movimiento
                      {sortIcon("lastMovementDate")}
                    </button>
                  </th>
                  <th
                    role="columnheader"
                    aria-label="Total Bs abierto"
                    className="text-right py-3 px-4 font-medium text-muted-foreground"
                    data-sort-active={sort === "openBalance" ? "true" : "false"}
                    data-sort-direction={
                      sort === "openBalance" ? direction : ""
                    }
                  >
                    <button
                      type="button"
                      className="hover:underline focus:underline"
                      onClick={() => handleSortClick("openBalance")}
                    >
                      Total Bs
                      {sortIcon("openBalance")}
                    </button>
                  </th>
                  <th
                    role="columnheader"
                    aria-label="Ver"
                    className="text-center py-3 px-4 font-medium text-muted-foreground"
                  >
                    Ver
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboard.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <Users className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No hay contactos para mostrar
                      </p>
                    </td>
                  </tr>
                ) : (
                  dashboard.items.map((row) => {
                    const balanceNum = parseFloat(row.openBalance);
                    return (
                      <tr
                        key={row.contactId}
                        className="border-b hover:bg-accent/50 transition-colors"
                      >
                        <td className="py-3 px-4">{row.name}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {row.lastMovementDate
                            ? formatDateBO(row.lastMovementDate)
                            : "—"}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-medium ${
                            balanceNum >= 0 ? "text-info" : "text-destructive"
                          }`}
                        >
                          {formatCurrency(row.openBalance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Link
                            href={`/${orgSlug}/accounting/${BASE}/${row.contactId}`}
                            className="inline-flex items-center gap-1 text-info hover:underline"
                            aria-label={`Ver ${row.name}`}
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Link>
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

      {dashboard.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={buildDashboardHref(
                  orgSlug,
                  BASE,
                  { page: Math.max(1, dashboard.page - 1) },
                  filters,
                )}
                aria-disabled={dashboard.page <= 1}
                className={
                  dashboard.page <= 1
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                text="Anterior"
              />
            </PaginationItem>
            {Array.from(
              { length: dashboard.totalPages },
              (_, i) => i + 1,
            ).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href={buildDashboardHref(
                    orgSlug,
                    BASE,
                    { page: p },
                    filters,
                  )}
                  isActive={p === dashboard.page}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={buildDashboardHref(
                  orgSlug,
                  BASE,
                  {
                    page: Math.min(dashboard.totalPages, dashboard.page + 1),
                  },
                  filters,
                )}
                aria-disabled={dashboard.page >= dashboard.totalPages}
                className={
                  dashboard.page >= dashboard.totalPages
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                text="Siguiente"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
}
