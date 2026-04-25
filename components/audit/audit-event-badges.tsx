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
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  indirecta: {
    label: "Indirecta",
    className: "bg-muted text-muted-foreground",
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
    className: "bg-info/10 text-info dark:bg-info/20",
  },
  UPDATE: {
    label: "Actualización",
    className: "bg-warning/10 text-warning dark:bg-warning/20",
  },
  DELETE: {
    label: "Eliminación",
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
  STATUS_CHANGE: {
    label: "Cambio de estado",
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
  },
};

interface ActionBadgeProps {
  action: AuditAction;
}

export function ActionBadge({ action }: ActionBadgeProps) {
  const config = ACTION_CONFIG[action];
  return <Badge className={config.className}>{config.label}</Badge>;
}
