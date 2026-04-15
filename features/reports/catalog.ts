// ── Catálogo de Reportes ─────────────────────────────────────────────────────
// Registro estático de todos los reportes disponibles y planificados.
// PR2: tipos + arrays stub (vacíos). PR3 poblará los datos.

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
}

// ── Categorías ───────────────────────────────────────────────────────────────

export const reportCategories: readonly ReportCategory[] = [
  { id: "estados-financieros", label: "Estados Financieros",     order: 1 },
  { id: "para-mi-contador",    label: "Para mi contador",         order: 2 },
  { id: "quien-te-debe",       label: "Quién te debe",            order: 3 },
  { id: "lo-que-debes",        label: "Lo que debes",             order: 4 },
  { id: "ventas-clientes",     label: "Ventas y clientes",        order: 5 },
  { id: "gastos-proveedores",  label: "Gastos y proveedores",     order: 6 },
  { id: "empresa",             label: "Empresa y actividad",      order: 7 },
  { id: "impuestos",           label: "Impuestos",                order: 8 },
  { id: "nomina-empleados",    label: "Nómina y empleados",       order: 9 },
];

// ── Registro de reportes ─────────────────────────────────────────────────────

export const reportRegistry: readonly ReportEntry[] = [
  // ── Estados Financieros — disponibles ──────────────────────────────────────
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

  // ── Estados Financieros — planificados ─────────────────────────────────────
  {
    id: "cash-flow",
    title: "Flujo de Efectivo",
    description: "Movimientos de entrada y salida de efectivo del período.",
    category: "estados-financieros",
    status: "planned",
    route: null,
    icon: "Banknote",
  },
  {
    id: "equity-changes",
    title: "Cambios en el Patrimonio",
    description: "Evolución del patrimonio neto durante el ejercicio.",
    category: "estados-financieros",
    status: "planned",
    route: null,
    icon: "GitBranch",
  },
  {
    id: "balance-comparative",
    title: "Balance Comparativo",
    description: "Comparación del Balance General entre dos períodos.",
    category: "estados-financieros",
    status: "planned",
    route: null,
    icon: "Columns2",
  },

  // ── Para mi contador — disponibles ─────────────────────────────────────────
  {
    id: "trial-balance",
    title: "Balance de Comprobación",
    description: "Sumas y saldos de todas las cuentas del período.",
    category: "para-mi-contador",
    status: "available",
    route: "/accounting/reports",
    icon: "BookOpen",
  },

  // ── Para mi contador — planificados ────────────────────────────────────────
  {
    id: "worksheet",
    title: "Hoja de Trabajo",
    description: "Herramienta auxiliar de ajustes y balance comprobación.",
    category: "para-mi-contador",
    status: "planned",
    route: null,
    icon: "TableProperties",
  },
  {
    id: "sumas-saldos",
    title: "Sumas y Saldos",
    description: "Detalle de débitos, créditos y saldos por cuenta.",
    category: "para-mi-contador",
    status: "planned",
    route: null,
    icon: "ListOrdered",
  },
  {
    id: "initial-balance",
    title: "Balance Inicial",
    description: "Estado de apertura al inicio del ejercicio contable.",
    category: "para-mi-contador",
    status: "planned",
    route: null,
    icon: "FlagTriangleRight",
  },
  {
    id: "caratula",
    title: "Carátula de Estados Financieros",
    description: "Portada oficial con datos del ente y período.",
    category: "para-mi-contador",
    status: "planned",
    route: null,
    icon: "FileText",
  },
  {
    id: "notes-statements",
    title: "Notas a los Estados Financieros",
    description: "Revelaciones y notas explicativas de los EEFF.",
    category: "para-mi-contador",
    status: "planned",
    route: null,
    icon: "FileQuestion",
  },
  {
    id: "general-ledger-detail",
    title: "Mayor Analítico",
    description: "Movimientos detallados por cuenta del período.",
    category: "para-mi-contador",
    status: "planned",
    route: null,
    icon: "Layers",
  },

  // ── Quién te debe — planificados ───────────────────────────────────────────
  {
    id: "ar-aging",
    title: "Antigüedad de Cuentas por Cobrar",
    description: "Clasificación de saldos por cobrar según vencimiento.",
    category: "quien-te-debe",
    status: "planned",
    route: null,
    icon: "Clock",
  },
  {
    id: "customer-balance-summary",
    title: "Resumen de Saldos de Clientes",
    description: "Balance consolidado por cliente al corte seleccionado.",
    category: "quien-te-debe",
    status: "planned",
    route: null,
    icon: "Users",
  },
  {
    id: "ar-statement",
    title: "Extracto por Cliente",
    description: "Historial de transacciones y saldo de un cliente.",
    category: "quien-te-debe",
    status: "planned",
    route: null,
    icon: "UserSearch",
  },

  // ── Lo que debes — planificados ────────────────────────────────────────────
  {
    id: "ap-aging",
    title: "Antigüedad de Cuentas por Pagar",
    description: "Clasificación de saldos por pagar según vencimiento.",
    category: "lo-que-debes",
    status: "planned",
    route: null,
    icon: "Hourglass",
  },
  {
    id: "supplier-balance-summary",
    title: "Resumen de Saldos de Proveedores",
    description: "Balance consolidado por proveedor al corte seleccionado.",
    category: "lo-que-debes",
    status: "planned",
    route: null,
    icon: "Building2",
  },
  {
    id: "ap-statement",
    title: "Extracto por Proveedor",
    description: "Historial de transacciones y saldo de un proveedor.",
    category: "lo-que-debes",
    status: "planned",
    route: null,
    icon: "Search",
  },

  // ── Ventas y clientes — planificados ───────────────────────────────────────
  {
    id: "sales-by-customer",
    title: "Ventas por Cliente",
    description: "Total de ventas agrupado por cliente en el período.",
    category: "ventas-clientes",
    status: "planned",
    route: null,
    icon: "ShoppingCart",
  },
  {
    id: "sales-by-product",
    title: "Ventas por Producto",
    description: "Total de ventas agrupado por producto o servicio.",
    category: "ventas-clientes",
    status: "planned",
    route: null,
    icon: "Package",
  },
  {
    id: "sales-by-period",
    title: "Ventas por Período",
    description: "Comparativo de ventas mensuales o por rango de fecha.",
    category: "ventas-clientes",
    status: "planned",
    route: null,
    icon: "CalendarDays",
  },

  // ── Gastos y proveedores — planificados ────────────────────────────────────
  {
    id: "expenses-by-supplier",
    title: "Gastos por Proveedor",
    description: "Detalle de compras y gastos agrupados por proveedor.",
    category: "gastos-proveedores",
    status: "planned",
    route: null,
    icon: "Receipt",
  },
  {
    id: "expenses-by-category",
    title: "Gastos por Categoría",
    description: "Distribución de gastos según tipo o cuenta contable.",
    category: "gastos-proveedores",
    status: "planned",
    route: null,
    icon: "PieChart",
  },
  {
    id: "purchases-by-period",
    title: "Compras por Período",
    description: "Comparativo de compras mensuales o por rango de fecha.",
    category: "gastos-proveedores",
    status: "planned",
    route: null,
    icon: "CalendarRange",
  },

  // ── Empresa y actividad — disponibles ──────────────────────────────────────
  {
    id: "correlation-audit",
    title: "Auditoría de Correlativos",
    description: "Verificación de secuencia y correlatividad de comprobantes.",
    category: "empresa",
    status: "available",
    route: "/accounting/correlation-audit",
    icon: "ShieldCheck",
  },

  // ── Impuestos — disponibles ────────────────────────────────────────────────
  {
    id: "iva-book-sales",
    title: "Libro de Ventas IVA",
    description: "Registro oficial de ventas gravadas y débito fiscal.",
    category: "impuestos",
    status: "available",
    route: "/informes/impuestos/libro-ventas",
    icon: "BookMarked",
  },
  {
    id: "iva-book-purchases",
    title: "Libro de Compras IVA",
    description: "Registro oficial de compras gravadas y crédito fiscal.",
    category: "impuestos",
    status: "available",
    route: "/informes/impuestos/libro-compras",
    icon: "BookMarked",
  },

  // ── Impuestos — planificados ───────────────────────────────────────────────
  {
    id: "rc-iva-summary",
    title: "Resumen RC-IVA",
    description: "Liquidación del régimen complementario al IVA.",
    category: "impuestos",
    status: "planned",
    route: null,
    icon: "ReceiptText",
  },

  // ── Nómina y empleados — planificados ──────────────────────────────────────
  {
    id: "payroll-summary",
    title: "Resumen de Planilla",
    description: "Detalle de haberes, descuentos y aportes del período.",
    category: "nomina-empleados",
    status: "planned",
    route: null,
    icon: "Users2",
  },
];
