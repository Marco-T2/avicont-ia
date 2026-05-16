// Reusable executive-style PDF header for accounting reports.
//
// Renders the canonical block used by Balance General, Estado de Resultados,
// Balance de Sumas y Saldos, and Estado de Evolución del Patrimonio Neto.
// Each org-info field gets its own line (membrete-style); empty fields are
// omitted gracefully:
//
//   Empresa: {orgName}                       ← bold
//   NIT: {nit}
//   Dirección: {address}
//   {city}
//   {TITLE IN CAPS}                          ← title, bold, centered
//   {subtitle / period}                      ← centered
//   (Expresado en {currency})                ← italic, centered
//
// Pure function — returns pdfmake Content[]. No I/O, no module-level state.

import type { Content } from "pdfmake/interfaces";

export type ExecutivePdfHeaderOptions = {
  /** Razón social o nombre comercial. */
  orgName: string;
  /** NIT — omitido si null/undefined/vacío. */
  orgNit?: string | null;
  /** Dirección (sin ciudad) — omitida si null/undefined/vacía. */
  orgAddress?: string | null;
  /** Ciudad — omitida si null/undefined/vacía. Se renderiza en línea propia debajo de dirección. */
  orgCity?: string | null;
  /** Título del documento (renderizado en CAPS automáticamente). */
  title: string;
  /** Subtítulo: período o fecha de corte (ej: "Al 16/05/2026"). */
  subtitle: string;
  /** Moneda de los importes — por defecto "Bolivianos". */
  currency?: string;
  /** Tamaño de fuente del título (default 14). */
  titleFontSize?: number;
  /** Tamaño base de fuente para subtítulo (fecha) y currency (default 10). */
  subtitleFontSize?: number;
  /**
   * Tamaño de las líneas de identidad organizacional (Empresa + NIT/Dirección).
   * Default = subtitleFontSize. Bajalo para look "membrete" (datos chicos arriba).
   */
  orgInfoFontSize?: number;
  /**
   * Alineación de las líneas de identidad organizacional. Default "center".
   * Use "right" para patrón membrete corporativo (datos a la derecha, título centrado).
   */
  orgInfoAlignment?: "left" | "center" | "right";
};

/**
 * Construye los bloques pdfmake del encabezado ejecutivo.
 *
 * Graceful omission: si tanto `orgNit` como `orgAddress` son null/vacíos,
 * la línea NIT/Dirección no se emite.
 */
export function buildExecutivePdfHeader(opts: ExecutivePdfHeaderOptions): Content[] {
  const {
    orgName,
    orgNit,
    orgAddress,
    orgCity,
    title,
    subtitle,
    currency = "Bolivianos",
    subtitleFontSize = 10,
    titleFontSize = 14,
    orgInfoFontSize = subtitleFontSize,
    orgInfoAlignment = "center",
  } = opts;

  const blocks: Content[] = [];

  /**
   * Emite una línea de identidad organizacional con estilo consistente.
   * Bold sólo para la primera (Empresa) — el resto en regular.
   */
  const pushOrgLine = (text: string, bold = false) => {
    blocks.push({
      text,
      fontSize: orgInfoFontSize,
      bold,
      alignment: orgInfoAlignment,
      margin: [0, 0, 0, 1],
    } as Content);
  };

  pushOrgLine(`Empresa: ${orgName}`, true);

  if (orgNit && orgNit.trim().length > 0) {
    pushOrgLine(`NIT: ${orgNit}`);
  }
  if (orgAddress && orgAddress.trim().length > 0) {
    pushOrgLine(`Dirección: ${orgAddress}`);
  }
  if (orgCity && orgCity.trim().length > 0) {
    pushOrgLine(orgCity);
  }

  blocks.push({
    text: title.toUpperCase(),
    fontSize: titleFontSize,
    bold: true,
    alignment: "center",
    margin: [0, 6, 0, 4],
  } as Content);

  blocks.push({
    text: subtitle,
    fontSize: subtitleFontSize,
    alignment: "center",
    margin: [0, 0, 0, 2],
  } as Content);

  blocks.push({
    text: `(Expresado en ${currency})`,
    fontSize: subtitleFontSize,
    italics: true,
    alignment: "center",
    margin: [0, 0, 0, 10],
  } as Content);

  return blocks;
}
