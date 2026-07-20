import "server-only";
import { TagsService } from "../application/tags.service";
import { PrismaTagsRepository } from "../infrastructure/prisma/prisma-tags.repository";

/**
 * Re-exported so OTHER modules can wire the concrete `TagsRepositoryPort`
 * adapter from their own composition roots WITHOUT reaching into
 * `modules/tags/infrastructure/` (module-boundary violation).
 *
 * `makeTagsService()` is not a substitute: `TagsService` does NOT satisfy
 * `TagsRepositoryPort` (`list`/`resolveBySlugs` vs `listByOrg`/`findBySlugs`),
 * so consumers that need the port must receive the repository itself.
 *
 * Mirror: modules/operational-doc-type/presentation/composition-root.ts, which
 * re-exports `PrismaOperationalDocTypesRepository` for modules/dispatch.
 */
export { PrismaTagsRepository };

export function makeTagsService(): TagsService {
  return new TagsService(new PrismaTagsRepository());
}
