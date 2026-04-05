import type { OrgSettings } from "@/generated/prisma/client";

export type { OrgSettings };

export interface UpdateOrgSettingsInput {
  cajaGeneralAccountCode?: string;
  bancoAccountCode?: string;
  cxcAccountCode?: string;
  cxpAccountCode?: string;
  roundingThreshold?: number;
}
