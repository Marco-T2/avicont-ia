"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { VoucherTypeCfg } from "@/generated/prisma/client";
import type { CorrelationAuditResult, CorrelationGap } from "@/features/accounting/journal.types";

interface CorrelationAuditViewProps {
  orgSlug: string;
  voucherTypes: VoucherTypeCfg[];
}

export default function CorrelationAuditView({
  orgSlug,
  voucherTypes,
}: CorrelationAuditViewProps) {
  const [voucherTypeId, setVoucherTypeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState<CorrelationAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAudit() {
    if (!voucherTypeId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ voucherTypeId });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(
        `/api/organizations/${orgSlug}/accounting/correlation-audit?${params}`,
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al obtener la auditoría");
        return;
      }

      setResult(data as CorrelationAuditResult);
    } catch {
      setError("Error de conexión al obtener la auditoría");
    } finally {
      setLoading(false);
    }
  }

  // Build a gap index: Map<prevNumber, CorrelationGap> keyed by gap.from - 1
  // This allows O(1) lookup when rendering the sequence
  const gapByPrev = new Map<number, CorrelationGap>();
  if (result) {
    for (const gap of result.gaps) {
      gapByPrev.set(gap.from - 1, gap);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audit-voucher-type">
                Tipo de Comprobante <span className="text-red-500">*</span>
              </Label>
              <Select value={voucherTypeId} onValueChange={setVoucherTypeId}>
                <SelectTrigger id="audit-voucher-type">
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  {voucherTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-date-from">Desde (opcional)</Label>
              <Input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-date-to">Hasta (opcional)</Label>
              <Input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAudit}
              disabled={!voucherTypeId || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : (
                "Auditar Correlativos"
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary row */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>
                <strong>{result.totalEntries}</strong> asientos en total
              </span>
              <span>
                <strong>{result.entries.length}</strong> con número de referencia
              </span>
              {result.entriesWithoutReference > 0 && (
                <span className="text-amber-600">
                  <strong>{result.entriesWithoutReference}</strong> sin número de referencia en este rango
                </span>
              )}
              {result.hasGaps && (
                <span className="text-red-600 font-medium">
                  <strong>{result.gaps.length}</strong>{" "}
                  {result.gaps.length === 1 ? "salto detectado" : "saltos detectados"}
                </span>
              )}
            </div>

            {/* No entries case */}
            {result.entries.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">
                No hay asientos con número de referencia para los filtros seleccionados.
              </p>
            )}

            {/* No gaps indicator */}
            {result.entries.length > 0 && !result.hasGaps && (
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <CheckCircle className="h-5 w-5" />
                <span>Sin saltos detectados</span>
              </div>
            )}

            {/* Sequence visualization */}
            {result.entries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {result.entries.map((entry, idx) => {
                  const prevNumber =
                    idx > 0 ? result.entries[idx - 1].referenceNumber : null;
                  const gap =
                    prevNumber !== null ? gapByPrev.get(prevNumber) : null;

                  return (
                    <span key={entry.id} className="flex items-center gap-2">
                      {gap && (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 px-2 py-1">
                          <AlertTriangle className="h-3 w-3" />
                          Salto: {gap.from}–{gap.to} ausentes
                        </Badge>
                      )}
                      <Badge
                        className="bg-blue-50 text-blue-800 border border-blue-200 font-mono px-2 py-1"
                        title={entry.description}
                      >
                        {entry.referenceNumber}
                      </Badge>
                    </span>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
