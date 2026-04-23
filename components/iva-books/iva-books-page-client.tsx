"use client";

/**
 * Componente cliente compartido para Libro de Compras y Libro de Ventas.
 *
 * Gestiona:
 * - Estado del período seleccionado
 * - Fetch de entradas por período
 * - Apertura del modal de nueva entrada
 * - Anulación de entradas
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { IvaBooksToolbar } from "./iva-books-toolbar";
import { IvaBooksTable } from "./iva-books-table";
import { IvaBookPurchaseModal } from "./iva-book-purchase-modal";
import { IvaBookSaleModal } from "./iva-book-sale-modal";
import type { IvaPurchaseBookDTO, IvaSalesBookDTO } from "@/features/accounting/iva-books";

interface FiscalPeriodOption {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface IvaBooksPageClientProps {
  orgSlug: string;
  kind: "purchases" | "sales";
  periods: FiscalPeriodOption[];
}

export function IvaBooksPageClient({ orgSlug, kind, periods }: IvaBooksPageClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    periods.find((p) => p.status === "OPEN")?.id ?? periods[0]?.id ?? "",
  );
  const [entries, setEntries] = useState<IvaPurchaseBookDTO[] | IvaSalesBookDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPeriodId) params.set("fiscalPeriodId", selectedPeriodId);

      const url = `/api/organizations/${orgSlug}/iva-books/${kind}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al cargar entradas");

      const data = await res.json();
      setEntries(Array.isArray(data) ? data : (data.data ?? []));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar datos");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, kind, selectedPeriodId]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  async function handleVoid(id: string) {
    if (!window.confirm("¿Anular esta entrada? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/iva-books/${kind}/${id}/void`,
        { method: "PATCH" },
      );
      if (!res.ok) throw new Error("Error al anular");
      toast.success("Entrada anulada");
      await fetchEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    }
  }

  function handleSuccess() {
    void fetchEntries();
  }

  const kindLabel = kind === "purchases" ? "Compras" : "Ventas";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <IvaBooksToolbar
        orgSlug={orgSlug}
        kind={kind}
        selectedPeriodId={selectedPeriodId}
        onPeriodChange={setSelectedPeriodId}
        onNewEntry={() => setModalOpen(true)}
        hasData={entries.length > 0}
      />

      {/* Estado de carga */}
      {loading && (
        <div className="py-8 text-center text-sm text-gray-500" aria-live="polite">
          Cargando entradas...
        </div>
      )}

      {/* Tabla */}
      {!loading && (
        <div className="rounded-md border">
          <IvaBooksTable
            variant={kind}
            entries={entries}
            onVoid={handleVoid}
          />
        </div>
      )}

      {/* Resumen de totales */}
      {!loading && entries.length > 0 && (
        <div className="text-xs text-gray-500 text-right">
          {entries.length} {entries.length === 1 ? "entrada" : "entradas"} en Libro de {kindLabel}
          {selectedPeriodId
            ? ` — período: ${periods.find((p) => p.id === selectedPeriodId)?.name ?? selectedPeriodId}`
            : ""}
        </div>
      )}

      {/* Modal de nueva entrada */}
      {kind === "purchases" ? (
        <IvaBookPurchaseModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
          orgSlug={orgSlug}
          periods={periods}
          mode="create-standalone"
        />
      ) : (
        <IvaBookSaleModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
          orgSlug={orgSlug}
          periods={periods}
          mode="create-standalone"
        />
      )}
    </div>
  );
}
