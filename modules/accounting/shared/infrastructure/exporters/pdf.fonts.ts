// Configuración de fuentes Roboto bundled de pdfmake/build/vfs_fonts.
// No se usan fuentes custom en v1 — solo Roboto incluida en el paquete.
// R5 (design): pdfmake incluye Roboto; basta registrar el VFS antes de crear documentos.
//
// NOTA: @types/pdfmake no declara `virtualfs` ni `setUrlAccessPolicy` porque son APIs
// de la variante server-side. Se acceden vía cast a `unknown` para evitar error de TS.

import type { TCreatedPdf, TDocumentDefinitions } from "pdfmake/interfaces";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmakeRuntime = require("pdfmake") as {
  virtualfs: {
    writeFileSync: (filename: string, content: Buffer) => void;
  };
  addFonts: (fonts: Record<string, Record<string, string>>) => void;
  setUrlAccessPolicy: (policy: () => boolean) => void;
  createPdf: (docDef: TDocumentDefinitions) => TCreatedPdf;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfsRaw = require("pdfmake/build/vfs_fonts") as {
  default?: Record<string, string>;
} & Record<string, string>;

const vfs: Record<string, string> = vfsRaw.default ?? vfsRaw;

/** Indica si las fuentes ya fueron registradas (singleton por proceso). */
let fontsRegistered = false;

/**
 * Registra las fuentes Roboto en el VirtualFileSystem de pdfmake.
 * Idempotente — puede llamarse múltiples veces sin efecto.
 *
 * IMPORTANTE: debe llamarse antes de cualquier `pdfmake.createPdf()`.
 * El objeto `pdfmake` importado como CommonJS singleton comparte el mismo VFS.
 */
export function registerFonts(): void {
  if (fontsRegistered) return;

  // vfs_fonts almacena el contenido de los .ttf como strings base64.
  // writeFileSync espera Buffer binario.
  for (const [filename, content] of Object.entries(vfs)) {
    const buf = Buffer.from(content, "base64");
    pdfmakeRuntime.virtualfs.writeFileSync(filename, buf);
  }

  pdfmakeRuntime.addFonts({
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  });

  // Política de acceso a URLs externas: bloqueado (no se descarga nada externo)
  pdfmakeRuntime.setUrlAccessPolicy(() => false);

  fontsRegistered = true;
}

/**
 * Exporta el singleton de pdfmake ya configurado con acceso a las APIs server-side.
 * Se usa en pdf.exporter.ts para crear documentos PDF.
 */
export { pdfmakeRuntime };
