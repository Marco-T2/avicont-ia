"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Encapsula el flujo de desvinculación del Libro de Ventas (LCV).
 *
 * Llama a PATCH /api/organizations/{orgSlug}/iva-books/sales/{ivaBookId}/void
 * — el `id` es ivaSalesBook.id, NO sale.id (D5 en design.md).
 *
 * En éxito: router.refresh() para revalidar el server component.
 * En error: toast.error con el mensaje.
 */
export function useLcvUnlink(orgSlug: string, ivaBookId: string | undefined) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleUnlink(): Promise<void> {
    if (!ivaBookId) return;

    setIsPending(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/iva-books/sales/${ivaBookId}/void`,
        { method: "PATCH" },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Error al desvincular del LCV",
        );
      }

      toast.success("Venta desvinculada del LCV");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al desvincular del LCV",
      );
    } finally {
      setIsPending(false);
    }
  }

  return { handleUnlink, isPending };
}
