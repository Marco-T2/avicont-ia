import { del } from "@vercel/blob";
import { logStructured } from "@/lib/logging/structured";
import type { BlobStoragePort } from "../domain/ports/blob-storage.port";

/**
 * VercelBlobStorageAdapter — implements BlobStoragePort via @vercel/blob.
 *
 * Best-effort delete: failures are logged as blob_orphan_detected and
 * swallowed — they must never fail the caller's operation.
 */
export class VercelBlobStorageAdapter implements BlobStoragePort {
  async del(url: string): Promise<void> {
    try {
      await del(url, {
        token: process.env.BLOB_READ_WRITE_TOKEN ?? "",
      });
    } catch (error) {
      logStructured({
        event: "blob_orphan_detected",
        level: "warn",
        resource: "organization_logo",
        orphanUrl: url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
