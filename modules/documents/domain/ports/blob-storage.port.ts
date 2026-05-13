/**
 * BlobStoragePort — abstracts @vercel/blob (upload + delete).
 *
 * DIFFERS from modules/org-profile/domain/ports/blob-storage.port.ts (del-only).
 * documents-specific port — upload() is required because the documents service
 * persists user-supplied files. No reuse of org-profile's port possible
 * (textually verified).
 *
 * domain/ — R5 absoluta: no infra concerns leak in. NO `server-only` here
 * (REQ-005 NEGATIVE sentinel).
 */
export interface BlobStoragePort {
  /**
   * Upload a file blob scoped to org+user.
   * @returns the public URL and pathname of the stored blob.
   */
  upload(
    file: File,
    organizationId: string,
    userId: string,
  ): Promise<{ url: string; pathname: string }>;

  /** Delete a blob by URL. Best-effort — adapter implementation decides errors. */
  del(url: string): Promise<void>;
}
