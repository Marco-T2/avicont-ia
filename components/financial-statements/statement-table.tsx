"use client";

// Tabla jerárquica QuickBooks-style para estados financieros.
// Usa TanStack Table v8 con expand/collapse nativo y columna nombre sticky por CSS.
// Las filas reciben clases semánticas: top-level-grouped-row, custom-grouped-row,
// custom-bg-white, total-row. El modo compacto cambia el data-compact del wrapper.
import { useState, useRef, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  type ExpandedState,
} from "@tanstack/react-table";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { StatementTableRow } from "@/modules/accounting/financial-statements/presentation";
import type { SerializedColumn } from "@/modules/accounting/financial-statements/presentation";

interface StatementTableProps {
  columns: SerializedColumn[];
  rows: StatementTableRow[];
  compact?: boolean;
  onRefresh?: () => void;
  title?: string;
  orgName?: string;
  subtitle?: string;
}

const colHelper = createColumnHelper<StatementTableRow>();

export function StatementTable({
  columns,
  rows,
  compact = false,
  onRefresh: _onRefresh,
  title,
  orgName,
  subtitle,
}: StatementTableProps) {
  // Estado de expansión: raíz expandida por defecto, subtypes colapsados
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    const initial: Record<string, boolean> = {};
    rows.forEach((_row, idx) => {
      // Expandir solo las secciones raíz (depth 0) por defecto
      initial[String(idx)] = true;
    });
    return initial;
  });

  // Región aria-live para anuncios de lector de pantalla
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = "";
      // Forzar reflow para que el lector de pantalla detecte el cambio
      void liveRegionRef.current.offsetHeight;
      liveRegionRef.current.textContent = message;
    }
  }, []);

  // Construir definiciones de columnas para TanStack Table
  const tanstackColumns = [
    // Columna 0: nombre de cuenta — sticky izquierda
    colHelper.accessor("name", {
      id: "name",
      header: "Cuenta",
      cell: ({ row, getValue }) => {
        const canExpand = row.getCanExpand();
        const isExpanded = row.getIsExpanded();
        const paddingLeft = `${row.depth * 16 + 8}px`;
        const code = row.original.code;

        return (
          <div style={{ paddingLeft }} className="flex items-center gap-1 min-w-0">
            {canExpand ? (
              <button
                onClick={() => {
                  row.toggleExpanded();
                  const action = isExpanded ? "colapsado" : "expandido";
                  announce(`${getValue()} ${action}`);
                }}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Colapsar ${getValue()}` : `Expandir ${getValue()}`}
                className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="flex-shrink-0 w-5" aria-hidden="true" />
            )}
            {code && (
              <span className="font-mono text-xs text-muted-foreground tabular-nums flex-shrink-0">
                {code}
              </span>
            )}
            <span className="truncate text-sm">{getValue()}</span>
          </div>
        );
      },
    }),
    // Columnas de valor: una por cada StatementColumn[] del response
    ...columns.map((col) =>
      colHelper.accessor((row) => row.columnValues[col.id] ?? "—", {
        id: col.id,
        header: col.label,
        cell: ({ getValue, row }) => {
          const val = getValue();
          const isNegative = val !== "—" && parseFloat(val) < 0;
          return (
            <span
              className={`font-mono text-sm tabular-nums ${
                col.role === "diff_percent"
                  ? isNegative
                    ? "text-destructive"
                    : "text-success"
                  : isNegative
                    ? "text-destructive"
                    : ""
              } ${row.original.semanticClass === "total-row" ? "font-semibold" : ""}`}
            >
              {col.role === "diff_percent" && val !== "—"
                ? `${parseFloat(val).toFixed(1)}%`
                : val === "—"
                  ? val
                  : formatBOB(val)}
            </span>
          );
        },
      }),
    ),
  ];

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.subRows,
  });

  return (
    <div
      className="relative overflow-x-auto overflow-y-visible"
      data-compact={compact ? "true" : "false"}
    >
      {/* Región aria-live — invisible, solo para lectores de pantalla */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Encabezado QuickBooks-style — centrado, arriba de la tabla */}
      {(title || orgName || subtitle) && (
        <div className="text-center mb-4 px-4 pt-2">
          {title && (
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">
              {title}
            </h2>
          )}
          {orgName && (
            <div className="text-base text-foreground mt-1">{orgName}</div>
          )}
          {subtitle && (
            <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
          )}
        </div>
      )}

      <table className="mx-auto w-auto border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border bg-muted">
              {headerGroup.headers.map((header, colIndex) => (
                <th
                  key={header.id}
                  className={[
                    "px-3 py-2 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap",
                    // Columna nombre: sticky izquierda
                    colIndex === 0
                      ? "sticky left-0 z-10 bg-muted w-[280px]"
                      : "text-right w-[140px]",
                  ].join(" ")}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => {
            const semanticClass = row.original.semanticClass;
            return (
              <tr
                key={row.id}
                className={[
                  semanticClass,
                  // Clases base según semántica
                  semanticClass === "top-level-grouped-row"
                    ? "bg-muted font-semibold border-t border-border"
                    : semanticClass === "custom-grouped-row"
                      ? "bg-muted/50 font-medium border-t border-border"
                      : semanticClass === "total-row"
                        ? "bg-card font-semibold border-t-2 border-border"
                        : "bg-card hover:bg-accent/50 transition-colors",
                  // Compacto: padding reducido via data-compact en el wrapper
                  "data-[compact=true]:py-0",
                ].join(" ")}
              >
                {row.getVisibleCells().map((cell, colIndex) => (
                  <td
                    key={cell.id}
                    className={[
                      "px-3 border-b border-border",
                      // Altura normal vs compacta
                      compact ? "py-0.5" : "py-2",
                      // Columna nombre: sticky izquierda, z-index para no solapar
                      colIndex === 0
                        ? [
                            "sticky left-0 z-[1] w-[280px]",
                            semanticClass === "top-level-grouped-row"
                              ? "bg-muted"
                              : semanticClass === "custom-grouped-row"
                                ? "bg-muted/50"
                                : semanticClass === "total-row"
                                  ? "bg-card"
                                  : "bg-card",
                          ].join(" ")
                        : "text-right w-[140px]",
                    ].join(" ")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Formateo de moneda BOB (duplicado local para no depender de import de features/) ──

function formatBOB(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
