import { z } from "zod";

// Los account codes legacy (cajaGeneral, banco, cxc, cxp, cashParent, etc.) se aceptan
// como strings sin verificar que existan en la tabla Account. Decisión consciente,
// fuera de scope de este PR. Los campos defaultCashAccountIds/defaultBankAccountIds SÍ
// se validan en OrgSettingsService.update — los IDs deben existir, ser de la org, ser
// detail+activos y descender del parent code apropiado.
export const updateOrgSettingsSchema = z.object({
  cajaGeneralAccountCode: z.string().min(1).optional(),
  bancoAccountCode: z.string().min(1).optional(),
  cxcAccountCode: z.string().min(1).optional(),
  cxpAccountCode: z.string().min(1).optional(),
  roundingThreshold: z.number().min(0).max(1).optional(),
  cashParentCode: z.string().min(1).optional(),
  pettyCashParentCode: z.string().min(1).optional(),
  bankParentCode: z.string().min(1).optional(),
  defaultCashAccountIds: z.array(z.string().min(1)).optional(),
  defaultBankAccountIds: z.array(z.string().min(1)).optional(),
});
