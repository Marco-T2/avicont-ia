import { NotFoundError, ConflictError } from "@/features/shared/errors";
import {
  Farm,
  type CreateFarmInput,
  type UpdateFarmInput,
} from "../domain/farm.entity";
import {
  type FarmRepository,
  type FarmFilters,
} from "../domain/farm.repository";
import type { MemberInquiryPort } from "../domain/ports/member-inquiry.port";

export type CreateFarmServiceInput = Omit<CreateFarmInput, "organizationId">;

export class FarmService {
  constructor(
    private readonly repo: FarmRepository,
    private readonly members: MemberInquiryPort,
  ) {}

  async list(organizationId: string, filters?: FarmFilters): Promise<Farm[]> {
    return this.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Farm> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Granja");
    return found;
  }

  async create(
    organizationId: string,
    input: CreateFarmServiceInput,
  ): Promise<Farm> {
    await this.members.assertActive(organizationId, input.memberId);
    const existing = await this.repo.findByName(organizationId, input.name);
    if (existing) throw new ConflictError("Granja con ese nombre");
    const farm = Farm.create({ ...input, organizationId });
    await this.repo.save(farm);
    return farm;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateFarmInput,
  ): Promise<Farm> {
    const existing = await this.getById(organizationId, id);
    if (input.name !== undefined && input.name !== existing.name) {
      const duplicate = await this.repo.findByName(organizationId, input.name);
      if (duplicate) throw new ConflictError("Granja con ese nombre");
    }
    const updated = existing.update(input);
    await this.repo.update(updated);
    return updated;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.getById(organizationId, id);
    await this.repo.delete(organizationId, id);
  }
}
