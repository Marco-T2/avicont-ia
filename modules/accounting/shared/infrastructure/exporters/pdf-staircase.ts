// Reusable helpers for the BCB-style staircase PDF layout.
//
// Used by financial-statements + initial-balance PDF exporters. Extracted to
// shared/ so both modules share the same visual primitives (letter-spacing for
// banners/grand-totals + nested-table workaround for column-scoped horizontal
// lines).

import type { Content } from "pdfmake/interfaces";

/**
 * Emula letter-spacing intercalando espacios entre letras y triple espacio
 * entre palabras. Reservado para banners y grand-totals por sección.
 *
 * Ejemplo: "TOTAL ACTIVO" → "T O T A L   A C T I V O"
 */
export function spaceLetters(text: string): string {
  return text
    .split(" ")
    .map((word) => word.split("").join(" "))
    .join("   ");
}

/**
 * pdfmake bug: cuando el layout outer define `hLineWidth: () => 0`, los
 * `cell.border` top quedan suprimidos también (la regla global gana sobre la
 * cell-level). Para dibujar una línea horizontal SÓLO bajo la columna del
 * saldo (estilo BCB), envolvemos el saldo en una nested table de 1×1 cuyo
 * layout dibuja su propia hLine en i=0 (encima del contenido).
 *
 * `borderColor` default `#000000`. Padding interno 0 para que el wrapper no
 * agregue altura extra visible.
 */
export function wrapWithTopBorder(
  content: Record<string, unknown>,
  opts: { borderColor?: string } = {},
): Content {
  const color = opts.borderColor ?? "#000000";
  return {
    table: {
      widths: ["*"],
      body: [[content as unknown as Content]],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => color,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  } as unknown as Content;
}
