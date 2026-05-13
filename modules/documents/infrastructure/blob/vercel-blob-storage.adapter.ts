import { put, del } from "@vercel/blob";
import type { BlobStoragePort } from "@/modules/documents/domain/ports/blob-storage.port";

/**
 * VercelBlobStorageAdapter — implements BlobStoragePort via @vercel/blob.
 *
 * DIFFERS from modules/org-profile/infrastructure/vercel-blob-storage.adapter.ts
 * (del-only). Documents requires upload(file, orgId, userId) → {url, pathname}.
 *
 * R5 isolation: only this file imports @vercel/blob. NO Prisma here. NO
 * server-only marker (REQ-005 NEGATIVE — server-only concern is carried by
 * presentation/server.ts barrel).
 */
export class VercelBlobStorageAdapter implements BlobStoragePort {
  async upload(
    file: File,
    organizationId: string,
    userId: string,
  ): Promise<{ url: string; pathname: string }> {
    try {
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const pathname = `org-${organizationId}/user-${userId}/${filename}`;

      const blob = await put(pathname, file, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN!,
      });

      return {
        url: blob.url,
        pathname: blob.pathname,
      };
    } catch (error) {
      console.error("Blob upload error:", error);
      throw new Error("Failed to upload file");
    }
  }

  async del(url: string): Promise<void> {
    try {
      await del(url, {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
      });
    } catch (error) {
      console.error("Blob delete error:", error);
      throw new Error("Failed to delete file");
    }
  }
}
