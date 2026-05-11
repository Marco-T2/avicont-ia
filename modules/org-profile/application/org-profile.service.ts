import {
  OrgProfile,
  type UpdateOrgProfileInput,
  type OrgProfileSnapshot,
} from "../domain/org-profile.entity";
import type { OrgProfileRepository } from "../domain/org-profile.repository";
import type { BlobStoragePort } from "../domain/ports/blob-storage.port";

export class OrgProfileService {
  constructor(
    private readonly repo: OrgProfileRepository,
    private readonly blobStorage: BlobStoragePort,
  ) {}

  async getOrCreate(organizationId: string): Promise<OrgProfileSnapshot> {
    const existing = await this.repo.findByOrgId(organizationId);
    if (existing) return existing.toSnapshot();

    const entity = OrgProfile.create(organizationId);
    await this.repo.save(entity);
    return entity.toSnapshot();
  }

  async update(
    organizationId: string,
    patch: UpdateOrgProfileInput,
  ): Promise<OrgProfileSnapshot> {
    let entity = await this.repo.findByOrgId(organizationId);
    if (!entity) {
      entity = OrgProfile.create(organizationId);
    }
    entity.applyUpdate(patch);
    await this.repo.save(entity);
    return entity.toSnapshot();
  }

  async updateLogo(
    organizationId: string,
    newUrl: string,
  ): Promise<OrgProfileSnapshot> {
    let entity = await this.repo.findByOrgId(organizationId);
    if (!entity) {
      entity = OrgProfile.create(organizationId);
    }

    const previousUrl = entity.logoUrl;
    entity.applyUpdate({ logoUrl: newUrl });
    await this.repo.save(entity);

    if (previousUrl && previousUrl !== newUrl) {
      await this.blobStorage.del(previousUrl);
    }

    return entity.toSnapshot();
  }
}
