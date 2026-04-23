import { z } from "zod";

const documentScopeEnum = z.enum(["ORGANIZATION", "ACCOUNTING", "FARM"]);

export const createDocumentSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  content: z.string().optional(),
  organizationId: z.string().min(1, "El ID de organización es requerido"),
  scope: documentScopeEnum.optional().default("ORGANIZATION"),
});

export const listDocumentsSchema = z.object({
  organizationId: z.string().min(1, "El ID de organización es requerido"),
});

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;
export type ListDocumentsDto = z.infer<typeof listDocumentsSchema>;
