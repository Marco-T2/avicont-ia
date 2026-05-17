import type { CreateTagInput, Tag } from "../tag.types";

/**
 * TagsRepositoryPort — design §4.
 *
 * Operations:
 *  - listByOrg: REQ-46 GET endpoint payload.
 *  - findBySlugs: adapter slug -> id resolution for REQ-43 AND-semantics filter.
 *  - create: REQ-44 server-side slug derivation happens in the service before this call.
 *  - attachToDocument: REQ-45 upload-time tag attachment (M:N via DocumentTag).
 */
export interface TagsRepositoryPort {
  listByOrg(orgId: string): Promise<Tag[]>;
  findBySlugs(orgId: string, slugs: string[]): Promise<Tag[]>;
  create(input: CreateTagInput & { slug: string }): Promise<Tag>;
  attachToDocument(documentId: string, tagIds: string[]): Promise<void>;
}
