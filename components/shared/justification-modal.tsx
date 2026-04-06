"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (justification: string) => void;
  title?: string;
  description?: string;
  isLoading?: boolean;
}

export function JustificationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Justificación Requerida",
  description = "Este documento está bloqueado. Ingrese una justificación para continuar con la modificación.",
  isLoading = false,
}: JustificationModalProps) {
  const [justification, setJustification] = useState("");

  const isValid = justification.trim().length >= 10;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(justification.trim());
      setJustification("");
    }
  };

  const handleClose = () => {
    setJustification("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="justification">Motivo del cambio</Label>
          <Textarea
            id="justification"
            placeholder="Explique el motivo de esta modificación (mínimo 10 caracteres)..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={3}
          />
          {justification.length > 0 && justification.trim().length < 10 && (
            <p className="text-xs text-destructive">
              La justificación debe tener al menos 10 caracteres ({justification.trim().length}/10)
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isLoading}>
            {isLoading ? "Procesando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
