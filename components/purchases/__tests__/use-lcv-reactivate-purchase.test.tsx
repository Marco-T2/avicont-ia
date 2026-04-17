/**
 * T5.3 RED → T5.4 GREEN
 * REQ-A.4: useLcvReactivatePurchase hook.
 *
 * (a) handleReactivate calls fetch PATCH to .../iva-books/purchases/{ivaBookId}/reactivate
 * (b) on 200 calls router.refresh() + toast.success('Compra reactivada en el LCV')
 * (c) on error calls toast.error
 * (d) undefined ivaBookId → no fetch
 */

import { renderHook, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLcvReactivatePurchase } from "../use-lcv-reactivate-purchase";

afterEach(() => cleanup());

const ORG_SLUG = "test-org";
const IVA_BOOK_ID = "iva-book-456";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const toastMock = await import("sonner");

describe("useLcvReactivatePurchase (T5.3 REQ-A.4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it("(a) handleReactivate calls PATCH to iva-books/purchases/{ivaBookId}/reactivate", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: IVA_BOOK_ID, status: "ACTIVE" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() =>
      useLcvReactivatePurchase(ORG_SLUG, IVA_BOOK_ID),
    );

    await act(async () => {
      await result.current.handleReactivate();
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(
      `/api/organizations/${ORG_SLUG}/iva-books/purchases/${IVA_BOOK_ID}/reactivate`,
    );
    expect(opts?.method).toBe("PATCH");
  });

  it("(b) on 200 calls router.refresh() + toast.success('Compra reactivada en el LCV')", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ACTIVE" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() =>
      useLcvReactivatePurchase(ORG_SLUG, IVA_BOOK_ID),
    );

    await act(async () => {
      await result.current.handleReactivate();
    });

    expect(mockRefresh).toHaveBeenCalledOnce();
    expect(toastMock.toast.success).toHaveBeenCalledWith("Compra reactivada en el LCV");
  });

  it("(c) on error response calls toast.error and NOT router.refresh", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Conflict" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() =>
      useLcvReactivatePurchase(ORG_SLUG, IVA_BOOK_ID),
    );

    await act(async () => {
      await result.current.handleReactivate();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(toastMock.toast.error).toHaveBeenCalledOnce();
  });

  it("(d) when ivaBookId is undefined, no fetch call made", async () => {
    const { result } = renderHook(() =>
      useLcvReactivatePurchase(ORG_SLUG, undefined),
    );

    await act(async () => {
      await result.current.handleReactivate();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
