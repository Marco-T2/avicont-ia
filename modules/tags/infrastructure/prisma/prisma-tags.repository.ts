import type { CreateTagInput, Tag } from "../../domain/tag.types";
import type { TagsRepositoryPort } from "../../domain/ports/tags-repository.port";

/**
 * PrismaTagsRepository — F4-PRE skeleton stub.
 *
 * Implementations land in F4-POST after Marco runs the schema migration that
 * generates the Tag + DocumentTag Prisma client types. Until then the methods
 * throw TODO sentinels so the composition root can wire without runtime use.
 */
export class PrismaTagsRepository implements TagsRepositoryPort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  listByOrg(orgId: string): Promise<Tag[]> {
    throw new Error("TODO F4-POST");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findBySlugs(orgId: string, slugs: string[]): Promise<Tag[]> {
    throw new Error("TODO F4-POST");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(input: CreateTagInput & { slug: string }): Promise<Tag> {
    throw new Error("TODO F4-POST");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attachToDocument(documentId: string, tagIds: string[]): Promise<void> {
    throw new Error("TODO F4-POST");
  }
}
