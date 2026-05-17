import "server-only";
import { BaseRepository } from "@/modules/shared/infrastructure/base.repository";
import type { CreateTagInput, Tag } from "../../domain/tag.types";
import type { TagsRepositoryPort } from "../../domain/ports/tags-repository.port";

/**
 * PrismaTagsRepository — design §4 adapter for TagsRepositoryPort.
 *
 * Thin wrapper over `prisma.tag` and `prisma.documentTag`. Extends
 * BaseRepository to inherit the optional-db-override constructor used by
 * every other hex Prisma adapter (test injection of a fake PrismaClient).
 *
 * Slug derivation is the service's responsibility (REQ-44); `create`
 * here expects a pre-derived slug. The unique constraint
 * `@@unique([organizationId, slug])` enforces uniqueness at the DB level
 * — collisions surface as Prisma errors and bubble up to the API layer.
 *
 * `attachToDocument` short-circuits on empty input to avoid an empty
 * `createMany` round-trip; `skipDuplicates: true` makes re-attach
 * idempotent without a pre-flight read.
 */
export class PrismaTagsRepository extends BaseRepository implements TagsRepositoryPort {
  async listByOrg(orgId: string): Promise<Tag[]> {
    const rows = await this.db.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });
    return rows.map(toDomain);
  }

  async findBySlugs(orgId: string, slugs: string[]): Promise<Tag[]> {
    if (slugs.length === 0) return [];
    const rows = await this.db.tag.findMany({
      where: { organizationId: orgId, slug: { in: slugs } },
    });
    return rows.map(toDomain);
  }

  async create(input: CreateTagInput & { slug: string }): Promise<Tag> {
    const row = await this.db.tag.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        color: input.color ?? null,
      },
    });
    return toDomain(row);
  }

  async attachToDocument(documentId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    await this.db.documentTag.createMany({
      data: tagIds.map((tagId) => ({ documentId, tagId })),
      skipDuplicates: true,
    });
  }
}

type PrismaTagRow = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: Date;
};

function toDomain(row: PrismaTagRow): Tag {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    slug: row.slug,
    color: row.color,
    createdAt: row.createdAt,
  };
}
