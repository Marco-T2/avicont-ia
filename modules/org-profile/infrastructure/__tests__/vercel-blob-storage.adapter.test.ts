import { describe, it, expect, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
}));

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { del } from "@vercel/blob";
import { logStructured } from "@/lib/logging/structured";
import { VercelBlobStorageAdapter } from "../vercel-blob-storage.adapter";

describe("VercelBlobStorageAdapter", () => {
  // α26
  it("calls del with the URL on the happy path", async () => {
    vi.mocked(del).mockResolvedValue(undefined as never);
    const adapter = new VercelBlobStorageAdapter();

    await adapter.del("https://blob.example.com/logo.png");

    expect(del).toHaveBeenCalledWith(
      "https://blob.example.com/logo.png",
      expect.objectContaining({ token: expect.any(String) }),
    );
  });

  // α27
  it("swallows errors and never throws — logs blob_orphan_detected", async () => {
    vi.mocked(del).mockRejectedValue(new Error("network down"));
    const adapter = new VercelBlobStorageAdapter();

    await expect(adapter.del("https://blob.example.com/orphan.png")).resolves.toBeUndefined();

    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "blob_orphan_detected",
        level: "warn",
        orphanUrl: "https://blob.example.com/orphan.png",
      }),
    );
  });

  // α28
  it("does not call logStructured on success", async () => {
    vi.mocked(del).mockResolvedValue(undefined as never);
    const adapter = new VercelBlobStorageAdapter();

    await adapter.del("https://blob.example.com/ok.png");

    expect(logStructured).not.toHaveBeenCalled();
  });
});
