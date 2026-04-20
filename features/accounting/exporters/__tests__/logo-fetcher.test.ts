import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchLogoAsDataUrl } from "@/features/accounting/exporters/logo-fetcher";

// Helper: construye una Response mock con body binario y Content-Type dado.
function makeResponse(status: number, contentType: string, bytes: Uint8Array): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => (key.toLowerCase() === "content-type" ? contentType : null),
    },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  } as unknown as Response;
}

describe("fetchLogoAsDataUrl", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("retorna data URL base64 con MIME correcto cuando el fetch es 200 con PNG", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fetchSpy.mockResolvedValue(makeResponse(200, "image/png", pngBytes));

    const result = await fetchLogoAsDataUrl("https://org.public.blob.vercel-storage.com/logo.png");

    expect(result).toBe(`data:image/png;base64,${Buffer.from(pngBytes).toString("base64")}`);
  });

  it("retorna undefined cuando el fetch es 404", async () => {
    fetchSpy.mockResolvedValue(makeResponse(404, "text/plain", new Uint8Array()));

    const result = await fetchLogoAsDataUrl("https://org.public.blob.vercel-storage.com/missing.png");

    expect(result).toBeUndefined();
  });

  it("retorna undefined cuando el fetch lanza (timeout / red caída)", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await fetchLogoAsDataUrl("https://org.public.blob.vercel-storage.com/logo.png");

    expect(result).toBeUndefined();
  });

  it("retorna data URL con MIME image/jpeg cuando el Content-Type es JPEG", async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    fetchSpy.mockResolvedValue(makeResponse(200, "image/jpeg", jpegBytes));

    const result = await fetchLogoAsDataUrl("https://org.public.blob.vercel-storage.com/logo.jpg");

    expect(result).toBe(`data:image/jpeg;base64,${Buffer.from(jpegBytes).toString("base64")}`);
  });

  it("cae a image/png por defecto cuando no hay Content-Type", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    fetchSpy.mockResolvedValue(makeResponse(200, "", bytes));

    const result = await fetchLogoAsDataUrl("https://org.public.blob.vercel-storage.com/logo");

    expect(result).toBe(`data:image/png;base64,${Buffer.from(bytes).toString("base64")}`);
  });

  it("retorna undefined cuando el url es undefined/null (input inválido)", async () => {
    expect(await fetchLogoAsDataUrl(undefined)).toBeUndefined();
    expect(await fetchLogoAsDataUrl("")).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
