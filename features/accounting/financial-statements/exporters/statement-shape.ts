// Tipos intermedios compartidos entre pdf.exporter y excel.exporter.
// Independientes de pdfmake y exceljs — solo estructuras de datos planas.

// Tipo de fila en el documento de export
export type ExportRowType = "header-section" | "header-subtype" | "account" | "subtotal" | "total" | "imbalance";

export type ExportRow = {
  type: ExportRowType;
  /** Etiqueta: nombre de sección, subtipo, cuenta, o totalizador */
  label: string;
  /** Código de cuenta (vacío para headers/totales) */
  code?: string;
  /**
   * Saldo formateado (columna única — backward compat).
   * Para multi-columna usar `balances`.
   */
  balance?: string;
  /**
   * Saldos por columna (multi-columna PR4).
   * Clave = ExportColumn.id → valor formateado con 2 decimales.
   * Siempre presente en sheets generadas por PR4 (incluso en columna única).
   */
  balances?: Record<string, string>;
  /** Nivel de indentación (0 = sección, 1 = subtipo, 2 = cuenta) */
  indent: number;
  /** Si la fila debe ir en negrita */
  bold: boolean;
};

/** Metadato de columna de valor en el ExportSheet (PR4). */
export type ExportColumn = {
  id: string;
  label: string;
  role: "current" | "comparative" | "diff_percent";
};

export type ExportSheet = {
  title: string;
  subtitle: string;
  dateLabel: string;
  orgName: string;
  rows: ExportRow[];
  /** Si el estado es preliminar (muestra watermark/banner) */
  preliminary: boolean;
  /** Si la ecuación está desbalanceada */
  imbalanced: boolean;
  /** Delta de desbalance formateado (solo presente si imbalanced=true) */
  imbalanceDelta?: string;
  /**
   * Columnas de valor del export (PR4).
   * Siempre tiene al menos 1 elemento.
   */
  columns: ExportColumn[];
  /**
   * Orientación de página para PDF.
   * Siempre "portrait" — el PDF usa chunking horizontal QB-style en lugar de landscape.
   * El campo se mantiene en el tipo para no romper consumidores externos que lo lean.
   */
  orientation: "portrait" | "landscape";
};

export type WatermarkConfig = {
  text: string;
  color: string;
  opacity: number;
  bold: boolean;
  italics: boolean;
};
