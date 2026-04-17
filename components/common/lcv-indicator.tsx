"use client";

import { BookOpen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type LcvState = "S1" | "S2" | "S3";

export interface LcvIndicatorProps {
  /** Estado explícito de la máquina: S1 borrador, S2 guardado sin LCV, S3 vinculado */
  state: LcvState;
  /** Si el período fiscal está abierto (S2/S3 se deshabilitan cuando false) */
  periodOpen: boolean;
  /** S2: abre el modal de registro en LCV */
  onRegister?: () => void;
  /** S3: abre el modal de edición del registro LCV */
  onEdit?: () => void;
  /** S3: dispara el flujo de desvinculación */
  onUnlink?: () => void;
}

// ── Helpers puros — sin lógica en JSX ────────────────────────────────────────

interface StateVisuals {
  label: string;
  className: string;
  icon: React.ReactNode;
}

function getStateVisuals(state: LcvState): StateVisuals {
  switch (state) {
    case "S1":
      return {
        label: "LCV no disponible",
        className:
          "cursor-not-allowed text-muted-foreground border-border bg-muted",
        icon: <Lock className="size-4 shrink-0" />,
      };
    case "S2":
      return {
        label: "Registrar en LCV",
        className: "",
        icon: <BookOpen className="size-4 shrink-0" />,
      };
    case "S3":
      return {
        label: "Registrado en LCV",
        className:
          "bg-emerald-50 border border-emerald-600 text-emerald-700 hover:bg-emerald-100",
        icon: <BookOpen className="size-4 shrink-0" />,
      };
  }
}

// ── Helpers de estado ────────────────────────────────────────────────────────

/** S1 siempre deshabilitado; S2/S3 deshabilitados cuando el período está cerrado */
function isStateDisabled(state: LcvState, periodOpen: boolean): boolean {
  return state === "S1" || !periodOpen;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function LcvIndicator({
  state,
  periodOpen,
  onRegister,
  onEdit,
  onUnlink,
}: LcvIndicatorProps) {
  const visuals = getStateVisuals(state);
  const disabled = isStateDisabled(state, periodOpen);

  // S1 — deshabilitado, sin interacción
  if (state === "S1") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        data-lcv-state="S1"
        className={visuals.className}
      >
        {visuals.icon}
        <span>{visuals.label}</span>
      </Button>
    );
  }

  // S2 — botón neutro, abre flujo de registro
  if (state === "S2") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        data-lcv-state="S2"
        onClick={onRegister}
      >
        {visuals.icon}
        <span>{visuals.label}</span>
      </Button>
    );
  }

  // S3 — emerald, DropdownMenu con Ver/Editar/Desvincular
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          data-lcv-state="S3"
          className={visuals.className}
        >
          {visuals.icon}
          <span>{visuals.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={onEdit}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onUnlink}>
          Desvincular del LCV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
