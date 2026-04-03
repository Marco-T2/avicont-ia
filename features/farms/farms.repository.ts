import { BaseRepository } from "@/features/shared/base.repository";
import type { Farm } from "@/generated/prisma/client";
import type { CreateFarmInput, UpdateFarmInput, FarmWithLots } from "./farms.types";

const farmIncludeLots = {
  lots: true,
} as const;

export class FarmsRepository extends BaseRepository {
  async findAll(organizationId: string): Promise<FarmWithLots[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.farm.findMany({
      where: scope,
      include: farmIncludeLots,
      orderBy: { name: "asc" },
    }) as Promise<FarmWithLots[]>;
  }

  async findById(organizationId: string, id: string): Promise<FarmWithLots | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.farm.findFirst({
      where: { id, ...scope },
      include: farmIncludeLots,
    }) as Promise<FarmWithLots | null>;
  }

  async findByMember(organizationId: string, memberId: string): Promise<FarmWithLots[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.farm.findMany({
      where: { memberId, ...scope },
      include: farmIncludeLots,
      orderBy: { name: "asc" },
    }) as Promise<FarmWithLots[]>;
  }

  async findByName(organizationId: string, name: string): Promise<Farm | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.farm.findFirst({
      where: { name, ...scope },
    });
  }

  async create(organizationId: string, data: CreateFarmInput): Promise<FarmWithLots> {
    const scope = this.requireOrg(organizationId);

    return this.db.farm.create({
      data: {
        name: data.name,
        location: data.location ?? null,
        memberId: data.memberId,
        organizationId: scope.organizationId,
      },
      include: farmIncludeLots,
    }) as Promise<FarmWithLots>;
  }

  async update(organizationId: string, id: string, data: UpdateFarmInput): Promise<FarmWithLots> {
    this.requireOrg(organizationId);

    return this.db.farm.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.location !== undefined && { location: data.location }),
      },
      include: farmIncludeLots,
    }) as Promise<FarmWithLots>;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    this.requireOrg(organizationId);

    await this.db.farm.delete({
      where: { id },
    });
  }
}
