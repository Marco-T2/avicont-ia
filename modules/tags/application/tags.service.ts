import type { Tag } from "../domain/tag.types";
import type { TagsRepositoryPort } from "../domain/ports/tags-repository.port";
import { slugify } from "@/modules/organizations/presentation";

/**
 * TagsService — design §4.
 *
 * Slug derivation is server-side per REQ-44 — reuses the org-profile
 * `slugify` (paired-sister default: `@/modules/organizations/presentation`),
 * NFKD + diacritic strip + lowercase + dashes + length cap. Any
 * `slug` field a caller might pass alongside `name` is ignored at this
 * layer because `create` only accepts `(orgId, name, color?)` — there
 * is no positional or named `slug` parameter to thread through.
 *
 * The rest of the methods are intentionally thin passthroughs over
 * `TagsRepositoryPort`; orchestration happens at the route / agent
 * composition root, not here.
 */
export class TagsService {
  constructor(private readonly repo: TagsRepositoryPort) {}

  list(orgId: string): Promise<Tag[]> {
    return this.repo.listByOrg(orgId);
  }

  resolveBySlugs(orgId: string, slugs: string[]): Promise<Tag[]> {
    return this.repo.findBySlugs(orgId, slugs);
  }

  create(orgId: string, name: string, color?: string): Promise<Tag> {
    const slug = slugify(name);
    return this.repo.create({
      organizationId: orgId,
      name,
      color,
      slug,
    });
  }

  attach(documentId: string, tagIds: string[]): Promise<void> {
    return this.repo.attachToDocument(documentId, tagIds);
  }
}
