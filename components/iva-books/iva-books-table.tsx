"use client";

/**
 * Tabla de entradas del Libro de Compras/Ventas IVA.
 *
 * Muestra todas las columnas SIN según el tipo (purchases=23cols / sales=24cols).
 * Soporta variant prop para cambiar el conjunto de columnas.
 *
 * Usa scrollX horizontal para acomodar las 23-24 columnas SIN.
 */

import type { IvaPurchaseBookDTO, IvaSalesBookDTO } from "@/features/accounting/iva-books";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const s = String(value);
  return s;
}

function fmtMoney(value: unknown): string {
  if (value === null || value === undefined) return "0.00";
  const n = parseFloat(String(value));
  if (isNaN(n)) return "0.00";
  return n.toFixed(2);
}

// ── Tipos ────────────────────────────────────────────────────────────────────

interface IvaBooksTableProps {
  variant: "purchases" | "sales";
  entries: IvaPurchaseBookDTO[] | IvaSalesBookDTO[];
  onVoid?: (id: string) => void;
}

// ── Columnas Libro de Compras ─────────────────────────────────────────────

function PurchasesTable({
  entries,
  onVoid,
}: {
  entries: IvaPurchaseBookDTO[];
  onVoid?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[1400px]">
        <thead>
          <tr className="border-b bg-muted text-left">
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Fecha</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">NIT Proveedor</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap min-w-[150px]">Razón Social</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Nro. Factura</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Cód. Autorización</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Tipo Compra</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Importe Total</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">ICE</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">IEHD</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">IPJ</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Tasas</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Otros NoSuj.</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Exentos</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Tasa 0%</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Subtotal</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Descuento</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Gift Card</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Base CF</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">CF IVA</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Estado</th>
            {onVoid && <th className="py-2 px-2 w-16" />}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td
                colSpan={onVoid ? 21 : 20}
                className="py-12 text-center text-sm text-muted-foreground/70"
              >
                No hay entradas para el período seleccionado
              </td>
            </tr>
          )}
          {entries.map((e) => (
            <tr
              key={e.id}
              className={`border-b hover:bg-accent/50 ${e.status === "VOIDED" ? "opacity-50 line-through" : ""}`}
              data-testid={`purchase-row-${e.id}`}
            >
              <td className="py-1.5 px-2 whitespace-nowrap">{fmt(e.fechaFactura)}</td>
              <td className="py-1.5 px-2 font-mono">{fmt(e.nitProveedor)}</td>
              <td className="py-1.5 px-2">{fmt(e.razonSocial)}</td>
              <td className="py-1.5 px-2 font-mono">{fmt(e.numeroFactura)}</td>
              <td className="py-1.5 px-2 font-mono text-xs truncate max-w-[120px]" title={fmt(e.codigoAutorizacion)}>{fmt(e.codigoAutorizacion)}</td>
              <td className="py-1.5 px-2 text-center">{fmt(e.tipoCompra)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeTotal)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeIce)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeIehd)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeIpj)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.tasas)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.otrosNoSujetos)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.exentos)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.tasaCero)}</td>
              <td className="py-1.5 px-2 text-right font-mono font-medium">{fmtMoney(e.subtotal)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.codigoDescuentoAdicional)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeGiftCard)}</td>
              <td className="py-1.5 px-2 text-right font-mono font-medium">{fmtMoney(e.baseIvaSujetoCf)}</td>
              <td className="py-1.5 px-2 text-right font-mono font-bold text-info">{fmtMoney(e.dfCfIva)}</td>
              <td className="py-1.5 px-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  e.status === "ACTIVE" ? "bg-success/10 text-success dark:bg-success/20" : "bg-destructive/10 text-destructive dark:bg-destructive/20"
                }`}>
                  {e.status === "ACTIVE" ? "Activo" : "Anulado"}
                </span>
              </td>
              {onVoid && (
                <td className="py-1.5 px-2">
                  {e.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => onVoid(e.id)}
                      className="text-xs text-destructive hover:text-destructive/80 underline"
                    >
                      Anular
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Columnas Libro de Ventas ──────────────────────────────────────────────

function SalesTable({
  entries,
  onVoid,
}: {
  entries: IvaSalesBookDTO[];
  onVoid?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[1500px]">
        <thead>
          <tr className="border-b bg-muted text-left">
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Fecha</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">NIT Cliente</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap min-w-[150px]">Razón Social</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Nro. Factura</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Cód. Autorización</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Estado SIN</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Importe Total</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">ICE</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">IEHD</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">IPJ</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Tasas</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Otros NoSuj.</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Exentos</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Tasa 0%</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Subtotal</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Descuento</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Gift Card</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">Base DF</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap text-right">DF IVA</th>
            <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Estado</th>
            {onVoid && <th className="py-2 px-2 w-16" />}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td
                colSpan={onVoid ? 21 : 20}
                className="py-12 text-center text-sm text-muted-foreground/70"
              >
                No hay entradas para el período seleccionado
              </td>
            </tr>
          )}
          {entries.map((e) => (
            <tr
              key={e.id}
              className={`border-b hover:bg-accent/50 ${e.status === "VOIDED" ? "opacity-50 line-through" : ""}`}
              data-testid={`sale-row-${e.id}`}
            >
              <td className="py-1.5 px-2 whitespace-nowrap">{fmt(e.fechaFactura)}</td>
              <td className="py-1.5 px-2 font-mono">{fmt(e.nitCliente)}</td>
              <td className="py-1.5 px-2">{fmt(e.razonSocial)}</td>
              <td className="py-1.5 px-2 font-mono">{fmt(e.numeroFactura)}</td>
              <td className="py-1.5 px-2 font-mono text-xs truncate max-w-[120px]" title={fmt(e.codigoAutorizacion)}>{fmt(e.codigoAutorizacion)}</td>
              <td className="py-1.5 px-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-primary/10 text-primary dark:bg-primary/20">
                  {fmt(e.estadoSIN)}
                </span>
              </td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeTotal)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeIce)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeIehd)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeIpj)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.tasas)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.otrosNoSujetos)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.exentos)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.tasaCero)}</td>
              <td className="py-1.5 px-2 text-right font-mono font-medium">{fmtMoney(e.subtotal)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.codigoDescuentoAdicional)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(e.importeGiftCard)}</td>
              <td className="py-1.5 px-2 text-right font-mono font-medium">{fmtMoney(e.baseIvaSujetoCf)}</td>
              <td className="py-1.5 px-2 text-right font-mono font-bold text-warning">{fmtMoney(e.dfIva)}</td>
              <td className="py-1.5 px-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  e.status === "ACTIVE" ? "bg-success/10 text-success dark:bg-success/20" : "bg-destructive/10 text-destructive dark:bg-destructive/20"
                }`}>
                  {e.status === "ACTIVE" ? "Activo" : "Anulado"}
                </span>
              </td>
              {onVoid && (
                <td className="py-1.5 px-2">
                  {e.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => onVoid(e.id)}
                      className="text-xs text-destructive hover:text-destructive/80 underline"
                    >
                      Anular
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function IvaBooksTable({ variant, entries, onVoid }: IvaBooksTableProps) {
  if (variant === "purchases") {
    return (
      <PurchasesTable
        entries={entries as IvaPurchaseBookDTO[]}
        onVoid={onVoid}
      />
    );
  }
  return (
    <SalesTable
      entries={entries as IvaSalesBookDTO[]}
      onVoid={onVoid}
    />
  );
}
