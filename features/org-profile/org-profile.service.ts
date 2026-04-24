import "server-only";
import { del } from "@vercel/blob";
import { logStructured } from "@/lib/logging/structured";
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
      await this.deleteLogoBlob(previousUrl, organizationId);
    }
    return after;
  }

  /** Best-effort blob delete. Never throws — failures are logged as orphan. */
  async deleteLogoBlob(url: string, orgId?: string): Promise<void> {
    try {
      await del(url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (error) {
      logStructured({
        event: "blob_orphan_detected",
        level: "warn",
        resource: "organization_logo",
        orgId,
        orphanUrl: url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
