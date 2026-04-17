/**
 * T4.3 RED → T4.4 GREEN
 * REQ-A.3: useLcvUnlinkPurchase hook.
 *
 * (a) handleUnlink calls fetch with PATCH to .../iva-books/purchases/{ivaBookId}/void
 *     (URL uses ivaBookId, NOT purchaseId)
 * (b) on 200 calls router.refresh() + toast.success
 * (c) on error response calls toast.error
 * (d) when ivaBookId is undefined, no fetch call made
 */

import { renderHook, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLcvUnlinkPurchase } from "../use-lcv-unlink-purchase";

afterEach(() => cleanup());

const ORG_SLUG = "test-org";
const IVA_BOOK_ID = "iva-book-123";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const toastMock = await import("sonner");

describe("useLcvUnlinkPurchase (T4.3 REQ-A.3)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it("(a) handleUnlink calls PATCH to iva-books/purchases/{ivaBookId}/void — URL uses ivaBookId NOT purchaseId", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: IVA_BOOK_ID, status: "VOIDED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() =>
      useLcvUnlinkPurchase(ORG_SLUG, IVA_BOOK_ID),
    );

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(
      `/api/organizations/${ORG_SLUG}/iva-books/purchases/${IVA_BOOK_ID}/void`,
    );
    expect(opts?.method).toBe("PATCH");
  });

  it("(b) on 200 calls router.refresh() + toast.success('Compra desvinculada del LCV')", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "VOIDED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() =>
      useLcvUnlinkPurchase(ORG_SLUG, IVA_BOOK_ID),
    );

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(mockRefresh).toHaveBeenCalledOnce();
    expect(toastMock.toast.success).toHaveBeenCalledWith("Compra desvinculada del LCV");
  });

  it("(c) on error response calls toast.error and NOT router.refresh", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Conflict" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() =>
      useLcvUnlinkPurchase(ORG_SLUG, IVA_BOOK_ID),
    );

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(toastMock.toast.error).toHaveBeenCalledOnce();
  });

  it("(d) when ivaBookId is undefined, no fetch call made", async () => {
    const { result } = renderHook(() =>
      useLcvUnlinkPurchase(ORG_SLUG, undefined),
    );

    await act(async () => {
      await result.current.handleUnlink();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
