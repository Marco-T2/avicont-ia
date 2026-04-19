import { del } from "@vercel/blob";
import { OrgProfileRepository } from "./org-profile.repository";
import type { OrgProfile, UpdateOrgProfileInput } from "./org-profile.types";

/**
 * Service for OrgProfile.
 *
 * Covers REQ-OP.1 (lazy getOrCreate, partial update) and REQ-OP.3
 * (updateLogo swaps URL then deletes previous blob best-effort).
 */
export class OrgProfileService {
  private readonly repo: OrgProfileRepository;

  constructor(repo?: OrgProfileRepository) {
    this.repo = repo ?? new OrgProfileRepository();
  }

  async getOrCreate(organizationId: string): Promise<OrgProfile> {
    const existing = await this.repo.findByOrgId(organizationId);
    if (existing) return existing;
    return this.repo.create(organizationId);
  }

  async update(
    organizationId: string,
    patch: UpdateOrgProfileInput,
  ): Promise<OrgProfile> {
    await this.getOrCreate(organizationId);
    return this.repo.update(organizationId, patch);
  }

  /**
   * Set a new logoUrl and best-effort delete the previous blob. Deletion
   * failures are logged and swallowed — they must not fail the user's save.
   */
  async updateLogo(
    organizationId: string,
    newUrl: string,
  ): Promise<OrgProfile> {
    const before = await this.getOrCreate(organizationId);
    const previousUrl = before.logoUrl ?? null;
    const after = await this.repo.update(organizationId, { logoUrl: newUrl });

    if (previousUrl && previousUrl !== newUrl) {
      // Fire-and-forget; never let a blob delete failure propagate.
      await this.deleteLogoBlob(previousUrl);
    }
    return after;
  }

  /** Best-effort blob delete. Never throws — all errors are logged. */
  async deleteLogoBlob(url: string): Promise<void> {
    try {
      await del(url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (error) {
      console.error("[OrgProfileService] deleteLogoBlob failed:", error);
    }
  }
}
