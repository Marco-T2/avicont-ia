"use client";

import { Badge } from "@/components/ui/badge";
import type { AuditAction, AuditClassification } from "@/features/audit";

// ── ClassificationBadge ──────────────────────────────────────────────────────

const CLASSIFICATION_CONFIG: Record<
  AuditClassification,
  { label: string; className: string }
> = {
  directa: {
    label: "Directa",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  indirecta: {
    label: "Indirecta",
    className: "bg-gray-100 text-gray-600 hover:bg-gray-100",
  },
};

interface ClassificationBadgeProps {
  classification: AuditClassification;
}

export function ClassificationBadge({ classification }: ClassificationBadgeProps) {
  const config = CLASSIFICATION_CONFIG[classification];
  return <Badge className={config.className}>{config.label}</Badge>;
}

// ── ActionBadge ──────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<AuditAction, { label: string; className: string }> = {
  CREATE: {
    label: "Creación",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  UPDATE: {
    label: "Actualización",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  DELETE: {
    label: "Eliminación",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
  STATUS_CHANGE: {
    label: "Cambio de estado",
    className: "bg-violet-100 text-violet-800 hover:bg-violet-100",
  },
};

interface ActionBadgeProps {
  action: AuditAction;
}

export function ActionBadge({ action }: ActionBadgeProps) {
  const config = ACTION_CONFIG[action];
  return <Badge className={config.className}>{config.label}</Badge>;
}
