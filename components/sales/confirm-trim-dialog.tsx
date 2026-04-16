"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { TrimPreviewItem } from "@/features/shared/document-lifecycle.service";

export type { TrimPreviewItem };

// ── Props ──

interface ConfirmTrimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trimPreview: TrimPreviewItem[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ── Componente presentacional ──

export function ConfirmTrimDialog({
  open,
  onOpenChange,
  trimPreview,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmTrimDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagos afectados</DialogTitle>
          <DialogDescription>
            Editar esta venta afectará los siguientes pagos aplicados:
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="py-2 px-3 text-left font-medium text-gray-600">
                  Fecha
                </th>
                <th className="py-2 px-3 text-right font-medium text-gray-600">
                  Monto original
                </th>
                <th className="py-2 px-3 text-right font-medium text-gray-600">
                  Se reducirá a
                </th>
              </tr>
            </thead>
            <tbody>
              {trimPreview.map((item) => (
                <tr key={item.allocationId} className="border-b last:border-0">
                  <td className="py-2 px-3 font-mono text-sm">
                    {item.paymentDate}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {item.originalAmount}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-amber-700 font-medium">
                    {item.trimmedTo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
