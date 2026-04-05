import { NotFoundError, ConflictError } from "@/features/shared/errors";
import { FarmsRepository } from "./farms.repository";
import { OrganizationsService } from "@/features/organizations/organizations.service";
import type { CreateFarmInput, UpdateFarmInput, FarmWithLots } from "./farms.types";

export class FarmsService {
  private readonly repo: FarmsRepository;
  private readonly orgsService: OrganizationsService;

  constructor(repo?: FarmsRepository, orgsService?: OrganizationsService) {
    this.repo = repo ?? new FarmsRepository();
    this.orgsService = orgsService ?? new OrganizationsService();
  }

  // ── List all farms in an organization ──

  async list(organizationId: string): Promise<FarmWithLots[]> {
    return this.repo.findAll(organizationId);
  }

  // ── List farms for a specific member ──

  async listByMember(organizationId: string, memberId: string): Promise<FarmWithLots[]> {
    return this.repo.findByMember(organizationId, memberId);
  }

  // ── Get a single farm ──

  async getById(organizationId: string, id: string): Promise<FarmWithLots> {
    const farm = await this.repo.findById(organizationId, id);
    if (!farm) throw new NotFoundError("Granja");
    return farm;
  }

  // ── Create a farm ──

  async create(organizationId: string, input: CreateFarmInput): Promise<FarmWithLots> {
    const existing = await this.repo.findByName(organizationId, input.name);
    if (existing) throw new ConflictError("Granja con ese nombre");

    // Validate member is active (not deactivated)
    const member = await this.orgsService.getMemberById(organizationId, input.memberId);
    if (!member) {
      throw new NotFoundError(
        "Miembro asignado no encontrado o está desactivado",
      );
    }

    return this.repo.create(organizationId, input);
  }

  // ── Update a farm ──

  async update(organizationId: string, id: string, input: UpdateFarmInput): Promise<FarmWithLots> {
    const farm = await this.repo.findById(organizationId, id);
    if (!farm) throw new NotFoundError("Granja");

    if (input.name && input.name !== farm.name) {
      const existing = await this.repo.findByName(organizationId, input.name);
      if (existing) throw new ConflictError("Granja con ese nombre");
    }

    return this.repo.update(organizationId, id, input);
  }

  // ── Delete a farm ──

  async delete(organizationId: string, id: string): Promise<void> {
    const farm = await this.repo.findById(organizationId, id);
    if (!farm) throw new NotFoundError("Granja");

    await this.repo.delete(organizationId, id);
  }
}
