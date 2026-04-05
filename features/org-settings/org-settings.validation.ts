import { z } from "zod";

export const updateOrgSettingsSchema = z.object({
  cajaGeneralAccountCode: z.string().min(1).optional(),
  bancoAccountCode: z.string().min(1).optional(),
  cxcAccountCode: z.string().min(1).optional(),
  cxpAccountCode: z.string().min(1).optional(),
  roundingThreshold: z.number().min(0).max(1).optional(),
});

export type UpdateOrgSettingsDto = z.infer<typeof updateOrgSettingsSchema>;
