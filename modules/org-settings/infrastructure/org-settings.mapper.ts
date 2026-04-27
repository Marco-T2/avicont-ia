import type { OrgSettings as OrgSettingsRow, Prisma } from "@/generated/prisma/client";
import { OrgSettings } from "../domain/org-settings.entity";

export function toDomain(row: OrgSettingsRow): OrgSettings {
  return OrgSettings.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    cajaGeneralAccountCode: row.cajaGeneralAccountCode,
    bancoAccountCode: row.bancoAccountCode,
    cxcAccountCode: row.cxcAccountCode,
    cxpAccountCode: row.cxpAccountCode,
    roundingThreshold: Number(row.roundingThreshold),
    cashParentCode: row.cashParentCode,
    pettyCashParentCode: row.pettyCashParentCode,
    bankParentCode: row.bankParentCode,
    fleteExpenseAccountCode: row.fleteExpenseAccountCode,
    polloFaenadoCOGSAccountCode: row.polloFaenadoCOGSAccountCode,
    itExpenseAccountCode: row.itExpenseAccountCode,
    itPayableAccountCode: row.itPayableAccountCode,
    defaultCashAccountIds: row.defaultCashAccountIds,
    defaultBankAccountIds: row.defaultBankAccountIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistenceCreate(
  settings: OrgSettings,
): Prisma.OrgSettingsUncheckedCreateInput {
  const snap = settings.toSnapshot();
  return {
    id: snap.id,
    organizationId: snap.organizationId,
    cajaGeneralAccountCode: snap.cajaGeneralAccountCode,
    bancoAccountCode: snap.bancoAccountCode,
    cxcAccountCode: snap.cxcAccountCode,
    cxpAccountCode: snap.cxpAccountCode,
    roundingThreshold: snap.roundingThreshold,
    cashParentCode: snap.cashParentCode,
    pettyCashParentCode: snap.pettyCashParentCode,
    bankParentCode: snap.bankParentCode,
    fleteExpenseAccountCode: snap.fleteExpenseAccountCode,
    polloFaenadoCOGSAccountCode: snap.polloFaenadoCOGSAccountCode,
    itExpenseAccountCode: snap.itExpenseAccountCode,
    itPayableAccountCode: snap.itPayableAccountCode,
    defaultCashAccountIds: snap.defaultCashAccountIds,
    defaultBankAccountIds: snap.defaultBankAccountIds,
  };
}

export function toPersistenceUpdate(
  settings: OrgSettings,
): Prisma.OrgSettingsUncheckedUpdateInput {
  const snap = settings.toSnapshot();
  // itExpenseAccountCode / itPayableAccountCode no se incluyen — son read-only
  // a nivel del módulo (ver comentario en OrgSettingsProps).
  return {
    cajaGeneralAccountCode: snap.cajaGeneralAccountCode,
    bancoAccountCode: snap.bancoAccountCode,
    cxcAccountCode: snap.cxcAccountCode,
    cxpAccountCode: snap.cxpAccountCode,
    roundingThreshold: snap.roundingThreshold,
    cashParentCode: snap.cashParentCode,
    pettyCashParentCode: snap.pettyCashParentCode,
    bankParentCode: snap.bankParentCode,
    fleteExpenseAccountCode: snap.fleteExpenseAccountCode,
    polloFaenadoCOGSAccountCode: snap.polloFaenadoCOGSAccountCode,
    defaultCashAccountIds: snap.defaultCashAccountIds,
    defaultBankAccountIds: snap.defaultBankAccountIds,
  };
}
