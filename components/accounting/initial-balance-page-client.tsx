"use client";

/**
 * InitialBalancePageClient — fetches the Balance Inicial statement on mount
 * and wires Export PDF / Export XLSX buttons with blob-download pattern.
 *
 * No date filter: the Balance Inicial is a point-in-time snapshot tied to
 * the Comprobante de Apertura date, so no date picker is needed.
 */

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [loadingPdf, setLoadingPdf] = useState(false);
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

  // ── Blob download helper ───────────────────────────────────────────────────

  async function handleExport(format: "pdf" | "xlsx") {
    const setExportLoading = format === "pdf" ? setLoadingPdf : setLoadingXlsx;
    setExportLoading(true);

    const ext = format === "pdf" ? "pdf" : "xlsx";
    const url = `/api/organizations/${orgSlug}/initial-balance?format=${format}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Error al exportar Balance Inicial (${format}):`, res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `balance-inicial.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar Balance Inicial:", err);
    } finally {
      setExportLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">Cargando Balance Inicial...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700"
        >
          {error}
        </div>
      )}

      {/* Results */}
      {statement && !loading && (
        <div className="space-y-4">
          {/* Export buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={loadingPdf || loadingXlsx}
              aria-label="Exportar Balance Inicial en formato PDF"
            >
              {loadingPdf && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("xlsx")}
              disabled={loadingPdf || loadingXlsx}
              aria-label="Exportar Balance Inicial en formato Excel"
            >
              {loadingXlsx && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Export XLSX
            </Button>
          </div>

          {/* View */}
          <Card>
            <CardContent className="pt-4 pb-6 px-0 overflow-hidden">
              <InitialBalanceView statement={statement} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
