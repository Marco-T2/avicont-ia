"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Pendiente",
    className: "bg-warning/10 text-warning dark:bg-warning/20",
  },
  PARTIAL: {
    label: "Parcial",
    className: "bg-info/10 text-info dark:bg-info/20",
  },
  PAID: {
    label: "Pagado",
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return <Badge className={config.className}>{config.label}</Badge>;
}
