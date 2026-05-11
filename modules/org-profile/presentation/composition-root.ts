import "server-only";
import { OrgProfileService } from "../application/org-profile.service";
import { PrismaOrgProfileRepository } from "../infrastructure/prisma-org-profile.repository";
import { VercelBlobStorageAdapter } from "../infrastructure/vercel-blob-storage.adapter";

export function makeOrgProfileService(): OrgProfileService {
  return new OrgProfileService(
    new PrismaOrgProfileRepository(),
    new VercelBlobStorageAdapter(),
  );
}
