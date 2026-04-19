import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { OrgProfile } from "@/generated/prisma/client";
import type { UpdateOrgProfileInput } from "./org-profile.types";

/**
 * Data access for OrgProfile. All methods take `organizationId` as the first
 * required parameter — no overload omits it. REQ-OP.7 enforced at compile time.
 */
export class OrgProfileRepository extends BaseRepository {
  async findByOrgId(organizationId: string): Promise<OrgProfile | null> {
    return this.db.orgProfile.findUnique({
      where: { organizationId },
    });
  }

  async create(organizationId: string): Promise<OrgProfile> {
    // All string fields default to "" in the schema; nullable fields default to null.
    return this.db.orgProfile.create({
      data: { organizationId },
    });
  }

  async update(
    organizationId: string,
    data: UpdateOrgProfileInput,
  ): Promise<OrgProfile> {
    // Only include keys that were explicitly supplied, so omitted fields are
    // preserved. `null` is a valid value for nullable fields (clears them),
    // so we treat `undefined` — not `null` — as the "omit" sentinel.
    const patch: Record<string, unknown> = {};
    if (data.razonSocial !== undefined) patch.razonSocial = data.razonSocial;
    if (data.nit !== undefined) patch.nit = data.nit;
    if (data.direccion !== undefined) patch.direccion = data.direccion;
    if (data.ciudad !== undefined) patch.ciudad = data.ciudad;
    if (data.telefono !== undefined) patch.telefono = data.telefono;
    if (data.nroPatronal !== undefined) patch.nroPatronal = data.nroPatronal;
    if (data.logoUrl !== undefined) patch.logoUrl = data.logoUrl;

    return this.db.orgProfile.update({
      where: { organizationId },
      data: patch,
    });
  }
}
