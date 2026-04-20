// Descarga un logo desde una URL pública (Vercel Blob) y lo convierte
// a data URL base64 para embebido en PDF.
//
// Devuelve undefined ante cualquier falla (network, 4xx/5xx, URL vacía):
// el exporter debe seguir renderizando sin logo, no bloquear el PDF.

const DEFAULT_MIME = "image/png";

export async function fetchLogoAsDataUrl(
  url: string | undefined | null,
): Promise<string | undefined> {
  if (!url) return undefined;

  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const contentType = response.headers.get("content-type") || "";
    const mime = contentType.startsWith("image/") ? contentType : DEFAULT_MIME;

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}
