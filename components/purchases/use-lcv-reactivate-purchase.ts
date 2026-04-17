"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Encapsula el flujo de reactivación del Libro de Compras (LCV).
 *
 * Llama a PATCH /api/organizations/{orgSlug}/iva-books/purchases/{ivaBookId}/reactivate
 * — el `id` es ivaPurchaseBook.id, NO purchase.id (D6 en design.md).
 *
 * Reactiva la entrada VOIDED → ACTIVE y regenera el asiento con IVA e IT.
 *
 * En éxito: router.refresh() para revalidar el server component.
 * En error: toast.error con el mensaje.
 */
export function useLcvReactivatePurchase(orgSlug: string, ivaBookId: string | undefined) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleReactivate(): Promise<void> {
    if (!ivaBookId) return;

    setIsPending(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/iva-books/purchases/${ivaBookId}/reactivate`,
        { method: "PATCH" },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Error al reactivar el registro LCV",
        );
      }

      toast.success("Compra reactivada en el LCV");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al reactivar el registro LCV",
      );
    } finally {
      setIsPending(false);
    }
  }

  return { handleReactivate, isPending };
}
