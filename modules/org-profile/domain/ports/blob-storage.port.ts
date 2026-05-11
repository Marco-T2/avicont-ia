/**
 * Port for blob storage operations — abstracts @vercel/blob so
 * domain/application layers remain framework-agnostic (R5 absoluta).
 */
export interface BlobStoragePort {
  /** Delete a blob by URL. Must never throw — failures are swallowed. */
  del(url: string): Promise<void>;
}
