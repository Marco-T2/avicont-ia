import "server-only";

export { makeTagsService } from "./composition-root";

export { TagsService } from "../application/tags.service";

export type { Tag, CreateTagInput } from "../domain/tag.types";
export type { TagsRepositoryPort } from "../domain/ports/tags-repository.port";
