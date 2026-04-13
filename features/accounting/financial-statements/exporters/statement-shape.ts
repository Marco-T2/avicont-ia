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
  /** Saldo formateado como string con 2 decimales */
  balance?: string;
  /** Nivel de indentación (0 = sección, 1 = subtipo, 2 = cuenta) */
  indent: number;
  /** Si la fila debe ir en negrita */
  bold: boolean;
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
};

export type WatermarkConfig = {
  text: string;
  color: string;
  opacity: number;
  bold: boolean;
  italics: boolean;
};
