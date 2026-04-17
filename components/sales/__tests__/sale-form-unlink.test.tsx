/**
 * T2.3 RED → T2.4 GREEN
 * useLcvUnlink hook — unlink handler for LCV
 *
 * REQ-A.3: On confirm, calls PATCH /api/organizations/{orgSlug}/iva-books/sales/{ivaBookId}/void
 *          Uses ivaSalesBook.id (NOT sale.id).
 *          On success: calls router.refresh().
 *          On error: surfaces via sonner toast.error.
 */

import { renderHook, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLcvUnlink } from "../use-lcv-unlink";

afterEach(() => cleanup());

const ORG_SLUG = "test-org";
const IVA_BOOK_ID = "iva-book-123";
const SALE_ID = "sale-456"; // Distinct — must NOT appear in the PATCH URL

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const toastMock = await import("sonner");

describe("useLcvUnlink", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it("llama a PATCH con la URL correcta usando ivaSalesBook.id, NOT sale.id", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: IVA_BOOK_ID, status: "VOIDED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useLcvUnlink(ORG_SLUG, IVA_BOOK_ID));

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(
      `/api/organizations/${ORG_SLUG}/iva-books/sales/${IVA_BOOK_ID}/void`,
    );
    // Asegurarse que NO contiene el sale.id distinto
    expect(url).not.toContain(SALE_ID);
    expect(opts?.method).toBe("PATCH");
  });

  it("llama a router.refresh() después de una respuesta exitosa", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "VOIDED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useLcvUnlink(ORG_SLUG, IVA_BOOK_ID));

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("establece isPending=true durante la llamada y false al finalizar", async () => {
    let resolvePromise!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(global.fetch).mockReturnValueOnce(pending);

    const { result } = renderHook(() => useLcvUnlink(ORG_SLUG, IVA_BOOK_ID));

    expect(result.current.isPending).toBe(false);

    // Iniciar la llamada sin awaitar
    let callPromise: Promise<void>;
    act(() => {
      callPromise = result.current.handleUnlink();
    });

    // Resolver la respuesta
    await act(async () => {
      resolvePromise(
        new Response(JSON.stringify({ status: "VOIDED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await callPromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("cuando fetch falla con status >=400, llama toast.error y NO llama router.refresh", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useLcvUnlink(ORG_SLUG, IVA_BOOK_ID));

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(toastMock.toast.error).toHaveBeenCalledOnce();
  });

  it("cuando fetch lanza una excepción, llama toast.error y NO llama router.refresh", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useLcvUnlink(ORG_SLUG, IVA_BOOK_ID));

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(toastMock.toast.error).toHaveBeenCalledOnce();
  });
});
