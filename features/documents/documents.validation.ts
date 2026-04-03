import { z } from "zod";

export const createDocumentSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  content: z.string().optional(),
  organizationId: z.string().min(1, "El ID de organización es requerido"),
});

export const documentIdSchema = z.string().cuid("ID de documento inválido");

export const listDocumentsSchema = z.object({
  organizationId: z.string().min(1, "El ID de organización es requerido"),
});

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;
export type ListDocumentsDto = z.infer<typeof listDocumentsSchema>;
