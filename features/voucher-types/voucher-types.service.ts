import { NotFoundError, ValidationError, VOUCHER_TYPE_NOT_IN_ORG } from "@/features/shared/errors";
import { VoucherTypesRepository } from "./voucher-types.repository";
import type { VoucherTypeCfg, VoucherTypeCode } from "@/generated/prisma/client";
import type { UpdateVoucherTypeInput } from "./voucher-types.types";

const DEFAULT_VOUCHER_TYPES: Array<{
  code: VoucherTypeCode;
  name: string;
  description: string;
}> = [
  {
    code: "CI",
    name: "Comprobante de Ingreso",
    description: "Registra entrada de dinero (cobros, ventas)",
  },
  {
    code: "CE",
    name: "Comprobante de Egreso",
    description: "Registra salida de dinero (pagos, compras)",
  },
  {
    code: "CD",
    name: "Comprobante de Diario",
    description: "Registra ajustes, depreciaciones, provisiones",
  },
  {
    code: "CT",
    name: "Comprobante de Traspaso",
    description: "Registra movimientos entre cuentas propias",
  },
  {
    code: "CA",
    name: "Comprobante de Apertura",
    description: "Registra asiento de apertura del periodo",
  },
];

export class VoucherTypesService {
  private readonly repo: VoucherTypesRepository;

  constructor(repo?: VoucherTypesRepository) {
    this.repo = repo ?? new VoucherTypesRepository();
  }

  // ── List all voucher types for an org ──

  async list(organizationId: string): Promise<VoucherTypeCfg[]> {
    return this.repo.findAll(organizationId);
  }

  // ── Get a single voucher type ──

  async getById(organizationId: string, id: string): Promise<VoucherTypeCfg> {
    const type = await this.repo.findById(organizationId, id);
    if (!type) throw new NotFoundError("Tipo de comprobante");
    return type;
  }

  // ── Get a voucher type by code ──

  async getByCode(organizationId: string, code: VoucherTypeCode): Promise<VoucherTypeCfg> {
    const type = await this.repo.findByCode(organizationId, code);
    if (!type) {
      throw new ValidationError(
        `Tipo de comprobante ${code} no configurado para esta organización`,
        VOUCHER_TYPE_NOT_IN_ORG,
      );
    }
    return type;
  }

  // ── Seed default voucher types for a new org (idempotent) ──

  async seedForOrg(organizationId: string): Promise<VoucherTypeCfg[]> {
    return this.repo.createMany(organizationId, DEFAULT_VOUCHER_TYPES);
  }

  // ── Update a voucher type ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateVoucherTypeInput,
  ): Promise<VoucherTypeCfg> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Tipo de comprobante");
    return this.repo.update(organizationId, id, input);
  }
}
