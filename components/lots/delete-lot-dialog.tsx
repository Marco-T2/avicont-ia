"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface DeleteLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  lotId: string;
  lotName: string;
  onDeleted?: () => void;
}

/**
 * Confirms a Lot cascade delete and triggers the DELETE call.
 * Spec REQ-101 / REQ-102. Shows counts of child Expense +
 * MortalityLog records fetched from the delete-preview endpoint.
 * Marco-locked: simple confirm, NO type-to-confirm (overkill for
 * single-user farmer control). Sin fricción extra.
 */
export function DeleteLotDialog({
  open,
  onOpenChange,
  orgSlug,
  lotId,
  lotName,
  onDeleted,
}: DeleteLotDialogProps) {
  const [counts, setCounts] = useState<
    { expensesCount: number; mortalityCount: number } | null
  >(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    fetch(
      `/api/organizations/${orgSlug}/lots/${lotId}/delete-preview`,
      { method: "GET" },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("preview-failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCounts({
          expensesCount: Number(data.expensesCount ?? 0),
          mortalityCount: Number(data.mortalityCount ?? 0),
        });
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("No se pudo cargar la vista previa del borrado");
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orgSlug, lotId, onOpenChange]);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/lots/${lotId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al borrar el lote");
        return;
      }
      toast.success("Lote borrado");
      onOpenChange(false);
      onDeleted?.();
    } catch (e) {
      console.error("delete-lot:", e);
      toast.error("Error al borrar el lote");
    } finally {
      setDeleting(false);
    }
  };

  const description = loadingPreview ? (
    <span>Cargando vista previa...</span>
  ) : counts ? (
    <span>
      Se borrará el lote <strong>&quot;{lotName}&quot;</strong> junto con{" "}
      <strong>{counts.expensesCount}</strong> gasto(s) y{" "}
      <strong>{counts.mortalityCount}</strong> registro(s) de mortalidad
      asociados. Esta acción no se puede deshacer.
    </span>
  ) : null;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Borrar lote"
      description={description}
      confirmLabel="Borrar definitivamente"
      cancelLabel="Cancelar"
      variant="destructive"
      loading={deleting || loadingPreview}
      onConfirm={handleConfirm}
    />
  );
}
