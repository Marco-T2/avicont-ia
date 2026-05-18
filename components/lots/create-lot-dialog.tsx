"use client";

import { useEffect, useState } from "react";
import { todayLocal } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateLotDialogProps {
  orgSlug: string;
  onCreated?: () => void;
}

/**
 * Post simplify-lot-identifier (apply-directo): the dialog is now a
 * 3-field form — Granja (farmName autocomplete from REQ-205),
 * Cantidad Inicial (initialCount), Fecha de Inicio (startDate). The
 * legacy `Nombre del Lote` + `Numero de Galpon` inputs are gone:
 * Marco-locked simplification: "para qué poner nombre a un lote si
 * simplemente sería 'Granja Vinto'" + "para qué quiero barnNumber si
 * todo se puede consultar por el id directamente". The lot identifier
 * is now `"{farmName} - DD/MM/YYYY"` derived server-side from
 * `farmName + startDate` (DB-level @@unique enforces "nunca 2 del
 * mismo" — surfaced via LotForFarmAtDateExists on collision).
 */
const MAX_SUGGESTIONS = 4;
const DATALIST_ID = "create-lot-dialog-farm-suggestions";

interface LotSuggestionRow {
  farmName?: string;
}

function pickSuggestions(rows: LotSuggestionRow[]): string[] {
  const unique = new Set<string>();
  for (const row of rows) {
    if (typeof row.farmName === "string" && row.farmName.trim().length > 0) {
      unique.add(row.farmName.trim());
    }
  }
  return Array.from(unique)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_SUGGESTIONS);
}

export default function CreateLotDialog({
  orgSlug,
  onCreated,
}: CreateLotDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [initialCount, setInitialCount] = useState("");
  const [farmName, setFarmName] = useState("");
  const [startDate, setStartDate] = useState(todayLocal());
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // REQ-205: derive suggestions client-side from same GET /lots
  // endpoint used by /lots page. Fires once on dialog open so the
  // datalist is ready before the user focuses the input.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${orgSlug}/lots`,
          { method: "GET" },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as LotSuggestionRow[];
        if (cancelled) return;
        setSuggestions(pickSuggestions(rows));
      } catch {
        // Soft-fail: autocomplete is a convenience, not a hard
        // requirement. Free-text input keeps working.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, orgSlug]);

  const handleSubmit = async () => {
    if (!farmName.trim()) {
      toast.error("El nombre de la granja es requerido");
      return;
    }
    if (!initialCount || Number(initialCount) < 1) {
      toast.error("La cantidad inicial debe ser al menos 1");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/lots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            initialCount: Number(initialCount),
            startDate,
            farmName: farmName.trim(),
          }),
        },
      );

      if (response.ok) {
        toast.success("Lote creado exitosamente");
        setInitialCount("");
        setFarmName("");
        setStartDate(todayLocal());
        setIsOpen(false);
        onCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al crear el lote");
      }
    } catch (error) {
      console.error("Error creating lot:", error);
      toast.error("Error al crear el lote");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setInitialCount("");
      setFarmName("");
      setStartDate(todayLocal());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Lote</DialogTitle>
          <DialogDescription>
            El lote se identifica como &quot;Granja - Fecha&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Granja *
            </label>
            <Input
              list={DATALIST_ID}
              placeholder="Ej: Capinota"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              disabled={isLoading}
            />
            <datalist id={DATALIST_ID}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Cantidad Inicial de Pollos *
            </label>
            <Input
              type="number"
              min={1}
              placeholder="Ej: 5000"
              value={initialCount}
              onChange={(e) => setInitialCount(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Fecha de Inicio *
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              !farmName.trim() ||
              !initialCount
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Lote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
