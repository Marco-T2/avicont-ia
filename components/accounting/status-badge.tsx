"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Pendiente",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  PARTIAL: {
    label: "Parcial",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  PAID: {
    label: "Pagado",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-gray-100 text-gray-600 hover:bg-gray-100",
  },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-600 hover:bg-gray-100",
  };

  return <Badge className={config.className}>{config.label}</Badge>;
}
