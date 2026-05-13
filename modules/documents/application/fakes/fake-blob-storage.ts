import type { BlobStoragePort } from "@/modules/documents/domain/ports/blob-storage.port";

/**
 * In-memory test fake for BlobStoragePort.
 * Captures invocations and returns deterministic URL/pathname so application
 * logic can be exercised without touching @vercel/blob.
 */
export class FakeBlobStorage implements BlobStoragePort {
  public uploadCalls: Array<{ file: File; organizationId: string; userId: string }> = [];
  public delCalls: string[] = [];

  async upload(
    file: File,
    organizationId: string,
    userId: string,
  ): Promise<{ url: string; pathname: string }> {
    this.uploadCalls.push({ file, organizationId, userId });
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const pathname = `org-${organizationId}/user-${userId}/${filename}`;
    return { url: `https://fake-blob.test/${pathname}`, pathname };
  }

  async del(url: string): Promise<void> {
    this.delCalls.push(url);
  }
}
