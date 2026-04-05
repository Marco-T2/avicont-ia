"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PARTIAL", "PAID", "CANCELLED"],
  PARTIAL: ["PAID", "CANCELLED"],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

const STATUS_BUTTON_STYLES: Record<string, string> = {
  PARTIAL: "border-blue-500 text-blue-700 hover:bg-blue-50",
  PAID: "border-green-500 text-green-700 hover:bg-green-50",
  CANCELLED: "border-gray-400 text-gray-600 hover:bg-gray-50",
};

interface StatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  onConfirm: (status: string, paidAmount?: number) => Promise<void>;
}

export default function StatusUpdateDialog({
  open,
  onOpenChange,
  currentStatus,
  onConfirm,
}: StatusUpdateDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transitions = TRANSITIONS[currentStatus] ?? [];

  function handleClose() {
    setSelectedStatus(null);
    setPaidAmount("");
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (!selectedStatus) return;
    setIsSubmitting(true);
    try {
      const amount =
        selectedStatus === "PARTIAL" && paidAmount
          ? parseFloat(paidAmount)
          : undefined;
      await onConfirm(selectedStatus, amount);
      setSelectedStatus(null);
      setPaidAmount("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar Estado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            Estado actual:{" "}
            <span className="font-medium">
              {STATUS_LABELS[currentStatus] ?? currentStatus}
            </span>
          </p>

          {transitions.length === 0 ? (
            <p className="text-sm text-gray-500">
              No hay transiciones disponibles para este estado.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Seleccione el nuevo estado:
              </p>
              <div className="flex flex-wrap gap-2">
                {transitions.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant="outline"
                    className={`${STATUS_BUTTON_STYLES[status] ?? ""} ${
                      selectedStatus === status
                        ? "ring-2 ring-offset-1 ring-current"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedStatus(status);
                      if (status !== "PARTIAL") setPaidAmount("");
                    }}
                  >
                    {STATUS_LABELS[status] ?? status}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedStatus === "PARTIAL" && (
            <div className="space-y-2">
              <Label htmlFor="paidAmount">Monto pagado</Label>
              <Input
                id="paidAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !selectedStatus ||
              isSubmitting ||
              (selectedStatus === "PARTIAL" && !paidAmount)
            }
          >
            {isSubmitting ? (
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
