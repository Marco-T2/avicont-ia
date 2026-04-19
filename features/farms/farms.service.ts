import "server-only";
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

  // ── Listar todas las granjas de una organización ──

  async list(organizationId: string): Promise<FarmWithLots[]> {
    return this.repo.findAll(organizationId);
  }

  // ── Listar granjas de un miembro específico ──

  async listByMember(organizationId: string, memberId: string): Promise<FarmWithLots[]> {
    return this.repo.findByMember(organizationId, memberId);
  }

  // ── Obtener una granja individual ──

  async getById(organizationId: string, id: string): Promise<FarmWithLots> {
    const farm = await this.repo.findById(organizationId, id);
    if (!farm) throw new NotFoundError("Granja");
    return farm;
  }

  // ── Crear una granja ──

  async create(organizationId: string, input: CreateFarmInput): Promise<FarmWithLots> {
    const existing = await this.repo.findByName(organizationId, input.name);
    if (existing) throw new ConflictError("Granja con ese nombre");

    // Validar que el miembro esté activo (no desactivado)
    const member = await this.orgsService.getMemberById(organizationId, input.memberId);
    if (!member) {
      throw new NotFoundError(
        "Miembro asignado no encontrado o está desactivado",
      );
    }

    return this.repo.create(organizationId, input);
  }

  // ── Actualizar una granja ──

  async update(organizationId: string, id: string, input: UpdateFarmInput): Promise<FarmWithLots> {
    const farm = await this.repo.findById(organizationId, id);
    if (!farm) throw new NotFoundError("Granja");

    if (input.name && input.name !== farm.name) {
      const existing = await this.repo.findByName(organizationId, input.name);
      if (existing) throw new ConflictError("Granja con ese nombre");
    }

    return this.repo.update(organizationId, id, input);
  }

  // ── Eliminar una granja ──

  async delete(organizationId: string, id: string): Promise<void> {
    const farm = await this.repo.findById(organizationId, id);
    if (!farm) throw new NotFoundError("Granja");

    await this.repo.delete(organizationId, id);
  }
}
