import type { Tag } from "../domain/tag.types";
import type { TagsRepositoryPort } from "../domain/ports/tags-repository.port";

/**
 * TagsService — F4-PRE skeleton. Methods land in F4-POST (per SDD tasks C4.4+).
 *
 * Intent (design §4):
 *  - list(orgId): TagsRepositoryPort.listByOrg passthrough.
 *  - resolveBySlugs(orgId, slugs): findBySlugs passthrough for adapter slug->id resolution.
 *  - create(orgId, name, color?): slugify(name) server-side (REQ-44), reuse from
 *    `@/modules/organizations/presentation`, then repo.create.
 *  - attach(documentId, tagIds): repo.attachToDocument passthrough.
 */
export class TagsService {
  constructor(private readonly repo: TagsRepositoryPort) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  list(orgId: string): Promise<Tag[]> {
    throw new Error("TODO F4-POST");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resolveBySlugs(orgId: string, slugs: string[]): Promise<Tag[]> {
    throw new Error("TODO F4-POST");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(orgId: string, name: string, color?: string): Promise<Tag> {
    throw new Error("TODO F4-POST");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attach(documentId: string, tagIds: string[]): Promise<void> {
    throw new Error("TODO F4-POST");
  }
}
