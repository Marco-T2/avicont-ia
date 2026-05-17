import "server-only";
import { TagsService } from "../application/tags.service";
import { PrismaTagsRepository } from "../infrastructure/prisma/prisma-tags.repository";

export function makeTagsService(): TagsService {
  return new TagsService(new PrismaTagsRepository());
}
