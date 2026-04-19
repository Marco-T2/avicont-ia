import "server-only";
import {
  NotFoundError,
  ConflictError,
  OPERATIONAL_DOC_TYPE_DUPLICATE_CODE,
  OPERATIONAL_DOC_TYPE_IN_USE,
} from "@/features/shared/errors";
import { OperationalDocTypesRepository } from "./operational-doc-types.repository";
import type {
  OperationalDocType,
  CreateOperationalDocTypeInput,
  UpdateOperationalDocTypeInput,
  OperationalDocTypeFilters,
} from "./operational-doc-types.types";

export class OperationalDocTypesService {
  private readonly repo: OperationalDocTypesRepository;

  constructor(repo?: OperationalDocTypesRepository) {
    this.repo = repo ?? new OperationalDocTypesRepository();
  }

  // ── Listar tipos de documentos operacionales ──

  async list(
    organizationId: string,
    filters?: OperationalDocTypeFilters,
  ): Promise<OperationalDocType[]> {
    // Por defecto: solo activos
    const effectiveFilters: OperationalDocTypeFilters =
      filters?.isActive !== undefined ? filters : { ...filters, isActive: true };
    return this.repo.findAll(organizationId, effectiveFilters);
  }

  // ── Obtener un tipo de documento operacional individual ──

  async getById(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocType> {
    const docType = await this.repo.findById(organizationId, id);
    if (!docType) throw new NotFoundError("Tipo de documento operacional");
    return docType;
  }

  // ── Crear un tipo de documento operacional ──

  async create(
    organizationId: string,
    input: CreateOperationalDocTypeInput,
  ): Promise<OperationalDocType> {
    try {
      return await this.repo.create(organizationId, input);
    } catch (error: unknown) {
      // Capturar violación de restricción única (código de error Prisma P2002)
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ConflictError(
          `Un tipo de documento con el código "${input.code}"`,
          OPERATIONAL_DOC_TYPE_DUPLICATE_CODE,
        );
      }
      throw error;
    }
  }

  // ── Actualizar un tipo de documento operacional ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateOperationalDocTypeInput,
  ): Promise<OperationalDocType> {
    // Verificar que existe
    await this.getById(organizationId, id);

    return this.repo.update(organizationId, id, input);
  }

  // ── Desactivar un tipo de documento operacional (borrado suave) ──

  async deactivate(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocType> {
    // Verificar que existe
    await this.getById(organizationId, id);

    const activeCount = await this.repo.countActivePayments(organizationId, id);
    if (activeCount > 0) {
      throw new ConflictError(
        `El tipo de documento tiene ${activeCount} pago(s) activo(s) asociado(s)`,
        OPERATIONAL_DOC_TYPE_IN_USE,
      );
    }

    return this.repo.update(organizationId, id, { isActive: false });
  }
}
