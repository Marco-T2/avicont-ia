"use client";

/**
 * InitialBalancePageClient — fetches the Balance Inicial statement on mount
 * and wires Export PDF / Export XLSX buttons with blob-download pattern.
 *
 * No date filter: the Balance Inicial is a point-in-time snapshot tied to
 * the Comprobante de Apertura date, so no date picker is needed.
 */

import { useState, useEffect } from "react";
import { Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateBO } from "@/lib/date-utils";
import { InitialBalanceView } from "./initial-balance-view";

// ── Serialized types (Decimals as strings) ─────────────────────────────────────

interface SerializedRow {
  accountId: string;
  code: string;
  name: string;
  amount: string;
}

interface SerializedGroup {
  subtype: string;
  label: string;
  rows: SerializedRow[];
  subtotal: string;
}

interface SerializedSection {
  key: string;
  label: string;
  groups: SerializedGroup[];
  sectionTotal: string;
}

interface SerializedStatement {
  orgId: string;
  dateAt: string;
  sections: [SerializedSection, SerializedSection];
  imbalanced: boolean;
  imbalanceDelta: string;
  multipleCA: boolean;
  caCount: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface InitialBalancePageClientProps {
  orgSlug: string;
}

export function InitialBalancePageClient({ orgSlug }: InitialBalancePageClientProps) {
  const [statement, setStatement] = useState<SerializedStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  // ── Fetch on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug]);

  async function fetchStatement() {
    setLoading(true);
    setError(null);

    const url = `/api/organizations/${orgSlug}/initial-balance?format=json`;

    try {
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ??
          `Error al generar el Balance Inicial (${res.status})`;
        setError(msg);
        return;
      }

      const data = (await res.json()) as SerializedStatement;
      setStatement(data);
    } catch {
      setError("Error de conexión. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  // ── Export handlers ────────────────────────────────────────────────────────
  // PDF: navegación nativa — el browser hace el GET, renderiza con su visor
  // y respeta las cookies de Clerk (mismo origen). Sin fetch+blob.
  // Excel: blob+download — el browser no renderiza .xlsx inline.

  function handleOpenPdf() {
    const url = `/api/organizations/${orgSlug}/initial-balance?format=pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDownloadXlsx() {
    setLoadingXlsx(true);
    const url = `/api/organizations/${orgSlug}/initial-balance?format=xlsx`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Error al exportar Balance Inicial (xlsx):`, res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `balance-inicial.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar Balance Inicial:", err);
    } finally {
      setLoadingXlsx(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Cargando Balance Inicial...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive"
        >
          {error}
        </div>
      )}

      {/* Results */}
      {statement && !loading && (
        <div className="space-y-4">
          {/* Export buttons — match al statement-toolbar (balance-sheet/income) */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPdf}
              aria-label="Abrir PDF en pestaña nueva"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadXlsx}
              disabled={loadingXlsx}
              aria-label="Descargar como Excel"
            >
              {loadingXlsx ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              )}
              Excel
            </Button>
          </div>

          {/* View */}
          <Card>
            <CardContent className="pt-0 pb-6 px-0 overflow-hidden">
              {/* Sub-header dentro del card: título + fecha + moneda */}
              <div className="px-6 pb-4 text-center">
                <h2 className="text-xl font-bold tracking-wide">BALANCE INICIAL</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Al {formatDateBO(new Date(statement.dateAt))}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  (Expresado en Bolivianos)
                </p>
              </div>
              <InitialBalanceView statement={statement} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
