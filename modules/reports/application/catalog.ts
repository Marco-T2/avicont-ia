// ── Catálogo de Reportes ─────────────────────────────────────────────────────
// Registro estático de reportes disponibles.
//
// Historia: PR2 introdujo tipos + stubs; PR3 pobló con 11 available + 19
// planned. La lista de planned se retiró del registry (decision logged in
// engram topic `reports/roadmap-planned`) — se irá repoblando a medida que
// cada reporte se implemente. El type union conserva "planned" | "hidden"
// para soportar reactivación sin tocar contratos.

import type { Resource } from "@/features/permissions";

export type ReportStatus = "available" | "planned" | "hidden";

export interface ReportCategory {
  /** Slug único, ej. "estados-financieros" */
  id: string;
  /** Etiqueta en español, ej. "Estados Financieros" */
  label: string;
  /** Orden de renderizado ascendente */
  order: number;
}

export interface ReportEntry {
  /** Slug único global */
  id: string;
  /** Título del reporte en español */
  title: string;
  /** Descripción corta (una línea) */
  description: string;
  /** Debe coincidir con ReportCategory.id */
  category: string;
  status: ReportStatus;
  /**
   * Ruta sin el prefijo /{orgSlug}, ej. "/accounting/financial-statements/balance-sheet".
   * Requerida si status === "available"; null en caso contrario.
   */
  route: string | null;
  /** Nombre de ícono Lucide (opcional). Si se omite, la UI usa "FileText". */
  icon?: string;
  /**
   * RBAC gate: when set, the entry is only visible if the caller can read this
   * resource. Resolved server-side in `app/(dashboard)/[orgSlug]/informes/page.tsx`
   * before passing the filtered list to <CatalogPage>. Entries without a
   * resource are always visible (back-compat).
   */
  resource?: Resource;
}

// ── Categorías ───────────────────────────────────────────────────────────────

export const reportCategories: readonly ReportCategory[] = [
  { id: "estados-financieros", label: "Estados Financieros",     order: 1 },
  { id: "para-mi-contador",    label: "Para mi contador",         order: 2 },
  { id: "mayores-auxiliares",  label: "Mayores Auxiliares",       order: 3 },
  { id: "empresa",             label: "Empresa y actividad",      order: 4 },
];

// ── Registro de reportes ─────────────────────────────────────────────────────

export const reportRegistry: readonly ReportEntry[] = [
  // ── Estados Financieros ────────────────────────────────────────────────────
  {
    id: "balance-sheet",
    title: "Balance General",
    description: "Estado de situación financiera a una fecha determinada.",
    category: "estados-financieros",
    status: "available",
    route: "/accounting/financial-statements/balance-sheet",
    icon: "Scale",
  },
  {
    id: "income-statement",
    title: "Estado de Resultados",
    description: "Ingresos, costos y gastos del período contable.",
    category: "estados-financieros",
    status: "available",
    route: "/accounting/financial-statements/income-statement",
    icon: "TrendingUp",
  },
  {
    id: "equity-changes",
    title: "Cambios en el Patrimonio",
    description: "Evolución del patrimonio neto durante el ejercicio.",
    category: "estados-financieros",
    status: "available",
    route: "/accounting/equity-statement",
    icon: "GitBranch",
  },
  {
    id: "initial-balance",
    title: "Balance Inicial",
    description: "Estado de apertura al inicio del ejercicio contable.",
    category: "estados-financieros",
    status: "available",
    route: "/accounting/initial-balance",
    icon: "FlagTriangleRight",
  },

  // ── Para mi contador ───────────────────────────────────────────────────────
  {
    id: "worksheet",
    title: "Hoja de Trabajo",
    description: "Herramienta auxiliar de ajustes y balance comprobación.",
    category: "para-mi-contador",
    status: "available",
    route: "/accounting/worksheet",
    icon: "TableProperties",
  },
  {
    id: "sumas-saldos",
    title: "Balance de Comprobación de Sumas y Saldos",
    description: "Detalle de débitos, créditos y saldos por cuenta.",
    category: "para-mi-contador",
    status: "available",
    route: "/accounting/trial-balance",
    icon: "ListOrdered",
  },

  // ── Mayores Auxiliares ─────────────────────────────────────────────────────
  {
    id: "cuentas-por-cobrar",
    title: "Cuentas por Cobrar",
    description: "Saldos pendientes de cobro por cliente.",
    category: "mayores-auxiliares",
    status: "available",
    route: "/accounting/cxc",
    icon: "HandCoins",
    resource: "sales",
  },
  {
    id: "cuentas-por-pagar",
    title: "Cuentas por Pagar",
    description: "Saldos pendientes de pago por proveedor.",
    category: "mayores-auxiliares",
    status: "available",
    route: "/accounting/cxp",
    icon: "Receipt",
    resource: "purchases",
  },

  // ── Empresa y actividad ────────────────────────────────────────────────────
  {
    id: "correlation-audit",
    title: "Auditoría de Correlativos",
    description: "Verificación de secuencia y correlatividad de comprobantes.",
    category: "empresa",
    status: "available",
    route: "/accounting/correlation-audit",
    icon: "ShieldCheck",
  },

];
