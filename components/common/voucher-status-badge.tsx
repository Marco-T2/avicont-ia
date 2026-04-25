"use client";

import { Badge } from "@/components/ui/badge";

export const VOUCHER_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Borrador",
    className: "bg-warning/10 text-warning dark:bg-warning/20",
  },
  POSTED: {
    label: "Contabilizado",
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  LOCKED: {
    label: "Bloqueado",
    className: "bg-info/10 text-info border-info/30 dark:bg-info/20",
  },
  VOIDED: {
    label: "Anulado",
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
};

export const VOUCHER_STATUS_FALLBACK = {
  label: "—",
  className: "bg-muted text-muted-foreground",
};

interface VoucherStatusBadgeProps {
  status: string;
}

export default function VoucherStatusBadge({ status }: VoucherStatusBadgeProps) {
  const cfg = VOUCHER_STATUS_BADGE[status] ?? VOUCHER_STATUS_FALLBACK;
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}
