import type { Resource } from "@/features/permissions";

export const RESOURCE_LABELS: Record<Resource, string> = {
  members: "Miembros",
  "accounting-config": "Config. contable",
  sales: "Ventas",
  purchases: "Compras",
  payments: "Cobros y Pagos",
  journal: "Libro Diario",
  dispatches: "Despachos",
  reports: "Informes",
  contacts: "Contactos",
  farms: "Granjas",
  documents: "Documentos",
  agent: "Agente IA",
  period: "Período Fiscal",
  audit: "Auditoría",
};
