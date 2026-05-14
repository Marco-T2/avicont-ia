import { AccountCode } from "./value-objects/account-code";
import { RoundingThreshold } from "./value-objects/rounding-threshold";

export interface OrgSettingsProps {
  id: string;
  organizationId: string;
  cajaGeneralAccountCode: AccountCode;
  bancoAccountCode: AccountCode;
  cxcAccountCode: AccountCode;
  cxpAccountCode: AccountCode;
  roundingThreshold: RoundingThreshold;
  cashParentCode: AccountCode;
  pettyCashParentCode: AccountCode;
  bankParentCode: AccountCode;
  fleteExpenseAccountCode: AccountCode;
  polloFaenadoCOGSAccountCode: AccountCode;
  // itExpenseAccountCode / itPayableAccountCode existen en persistencia con default
  // pero NO son updateables vía este módulo (el legacy service nunca los expuso).
  // Se preservan read-only en la entity para no perderlos al persistir update().
  itExpenseAccountCode: AccountCode;
  itPayableAccountCode: AccountCode;
  defaultCashAccountIds: string[];
  defaultBankAccountIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgSettingsPersistenceProps {
  id: string;
  organizationId: string;
  cajaGeneralAccountCode: string;
  bancoAccountCode: string;
  cxcAccountCode: string;
  cxpAccountCode: string;
  roundingThreshold: number;
  cashParentCode: string;
  pettyCashParentCode: string;
  bankParentCode: string;
  fleteExpenseAccountCode: string;
  polloFaenadoCOGSAccountCode: string;
  itExpenseAccountCode: string;
  itPayableAccountCode: string;
  defaultCashAccountIds: string[];
  defaultBankAccountIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOrgSettingsInput {
  cajaGeneralAccountCode?: string;
  bancoAccountCode?: string;
  cxcAccountCode?: string;
  cxpAccountCode?: string;
  roundingThreshold?: number;
  cashParentCode?: string;
  pettyCashParentCode?: string;
  bankParentCode?: string;
  fleteExpenseAccountCode?: string;
  polloFaenadoCOGSAccountCode?: string;
  defaultCashAccountIds?: string[];
  defaultBankAccountIds?: string[];
}

export interface CreateDefaultInput {
  id: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgSettingsSnapshot {
  id: string;
  organizationId: string;
  cajaGeneralAccountCode: string;
  bancoAccountCode: string;
  cxcAccountCode: string;
  cxpAccountCode: string;
  roundingThreshold: number;
  cashParentCode: string;
  pettyCashParentCode: string;
  bankParentCode: string;
  fleteExpenseAccountCode: string;
  polloFaenadoCOGSAccountCode: string;
  itExpenseAccountCode: string;
  itPayableAccountCode: string;
  defaultCashAccountIds: string[];
  defaultBankAccountIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Códigos canónicos de cuenta para una org recién creada. DEBEN apuntar a
// cuentas existentes en el plan de cuentas seed (ver prisma/seeds/chart-of-accounts.ts).
// banco → 1.1.3.1 (antes 1.1.2.1, que era Caja Chica — typo).
// flete → 5.1.9   (antes 5.1.3, que era Medicamentos y Vacunas — bug).
// Mantener en sync con @default() de OrgSettings en prisma/schema.prisma.
const DEFAULTS = {
  cajaGeneralAccountCode: "1.1.1.1",
  bancoAccountCode: "1.1.3.1",
  cxcAccountCode: "1.1.4.1",
  cxpAccountCode: "2.1.1.1",
  cashParentCode: "1.1.1",
  pettyCashParentCode: "1.1.2",
  bankParentCode: "1.1.3",
  fleteExpenseAccountCode: "5.1.9",
  polloFaenadoCOGSAccountCode: "5.1.1",
  itExpenseAccountCode: "5.3.3",
  itPayableAccountCode: "2.1.7",
} as const;

export class OrgSettings {
  private constructor(private readonly props: OrgSettingsProps) {}

  static createDefault(input: CreateDefaultInput): OrgSettings {
    return new OrgSettings({
      id: input.id,
      organizationId: input.organizationId,
      cajaGeneralAccountCode: AccountCode.of(DEFAULTS.cajaGeneralAccountCode),
      bancoAccountCode: AccountCode.of(DEFAULTS.bancoAccountCode),
      cxcAccountCode: AccountCode.of(DEFAULTS.cxcAccountCode),
      cxpAccountCode: AccountCode.of(DEFAULTS.cxpAccountCode),
      roundingThreshold: RoundingThreshold.default(),
      cashParentCode: AccountCode.of(DEFAULTS.cashParentCode),
      pettyCashParentCode: AccountCode.of(DEFAULTS.pettyCashParentCode),
      bankParentCode: AccountCode.of(DEFAULTS.bankParentCode),
      fleteExpenseAccountCode: AccountCode.of(DEFAULTS.fleteExpenseAccountCode),
      polloFaenadoCOGSAccountCode: AccountCode.of(DEFAULTS.polloFaenadoCOGSAccountCode),
      itExpenseAccountCode: AccountCode.of(DEFAULTS.itExpenseAccountCode),
      itPayableAccountCode: AccountCode.of(DEFAULTS.itPayableAccountCode),
      defaultCashAccountIds: [],
      defaultBankAccountIds: [],
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });
  }

  static fromPersistence(p: OrgSettingsPersistenceProps): OrgSettings {
    return new OrgSettings({
      id: p.id,
      organizationId: p.organizationId,
      cajaGeneralAccountCode: AccountCode.of(p.cajaGeneralAccountCode),
      bancoAccountCode: AccountCode.of(p.bancoAccountCode),
      cxcAccountCode: AccountCode.of(p.cxcAccountCode),
      cxpAccountCode: AccountCode.of(p.cxpAccountCode),
      roundingThreshold: RoundingThreshold.of(p.roundingThreshold),
      cashParentCode: AccountCode.of(p.cashParentCode),
      pettyCashParentCode: AccountCode.of(p.pettyCashParentCode),
      bankParentCode: AccountCode.of(p.bankParentCode),
      fleteExpenseAccountCode: AccountCode.of(p.fleteExpenseAccountCode),
      polloFaenadoCOGSAccountCode: AccountCode.of(p.polloFaenadoCOGSAccountCode),
      itExpenseAccountCode: AccountCode.of(p.itExpenseAccountCode),
      itPayableAccountCode: AccountCode.of(p.itPayableAccountCode),
      defaultCashAccountIds: [...p.defaultCashAccountIds],
      defaultBankAccountIds: [...p.defaultBankAccountIds],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get cashParent(): AccountCode { return this.props.cashParentCode; }
  get pettyCashParent(): AccountCode { return this.props.pettyCashParentCode; }
  get bankParent(): AccountCode { return this.props.bankParentCode; }
  get defaultCashAccountIds(): readonly string[] { return this.props.defaultCashAccountIds; }
  get defaultBankAccountIds(): readonly string[] { return this.props.defaultBankAccountIds; }

  update(input: UpdateOrgSettingsInput): OrgSettings {
    const next: OrgSettingsProps = { ...this.props };

    if (input.cajaGeneralAccountCode !== undefined) {
      next.cajaGeneralAccountCode = AccountCode.of(input.cajaGeneralAccountCode);
    }
    if (input.bancoAccountCode !== undefined) {
      next.bancoAccountCode = AccountCode.of(input.bancoAccountCode);
    }
    if (input.cxcAccountCode !== undefined) {
      next.cxcAccountCode = AccountCode.of(input.cxcAccountCode);
    }
    if (input.cxpAccountCode !== undefined) {
      next.cxpAccountCode = AccountCode.of(input.cxpAccountCode);
    }
    if (input.roundingThreshold !== undefined) {
      next.roundingThreshold = RoundingThreshold.of(input.roundingThreshold);
    }
    if (input.cashParentCode !== undefined) {
      next.cashParentCode = AccountCode.of(input.cashParentCode);
    }
    if (input.pettyCashParentCode !== undefined) {
      next.pettyCashParentCode = AccountCode.of(input.pettyCashParentCode);
    }
    if (input.bankParentCode !== undefined) {
      next.bankParentCode = AccountCode.of(input.bankParentCode);
    }
    if (input.fleteExpenseAccountCode !== undefined) {
      next.fleteExpenseAccountCode = AccountCode.of(input.fleteExpenseAccountCode);
    }
    if (input.polloFaenadoCOGSAccountCode !== undefined) {
      next.polloFaenadoCOGSAccountCode = AccountCode.of(
        input.polloFaenadoCOGSAccountCode,
      );
    }
    if (input.defaultCashAccountIds !== undefined) {
      next.defaultCashAccountIds = [...input.defaultCashAccountIds];
    }
    if (input.defaultBankAccountIds !== undefined) {
      next.defaultBankAccountIds = [...input.defaultBankAccountIds];
    }

    return new OrgSettings(next);
  }

  toSnapshot(): OrgSettingsSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      cajaGeneralAccountCode: this.props.cajaGeneralAccountCode.value,
      bancoAccountCode: this.props.bancoAccountCode.value,
      cxcAccountCode: this.props.cxcAccountCode.value,
      cxpAccountCode: this.props.cxpAccountCode.value,
      roundingThreshold: this.props.roundingThreshold.value,
      cashParentCode: this.props.cashParentCode.value,
      pettyCashParentCode: this.props.pettyCashParentCode.value,
      bankParentCode: this.props.bankParentCode.value,
      fleteExpenseAccountCode: this.props.fleteExpenseAccountCode.value,
      polloFaenadoCOGSAccountCode: this.props.polloFaenadoCOGSAccountCode.value,
      itExpenseAccountCode: this.props.itExpenseAccountCode.value,
      itPayableAccountCode: this.props.itPayableAccountCode.value,
      defaultCashAccountIds: [...this.props.defaultCashAccountIds],
      defaultBankAccountIds: [...this.props.defaultBankAccountIds],
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
